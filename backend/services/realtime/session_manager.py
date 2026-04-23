import asyncio
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable
from uuid import uuid4

from config import settings
from services.realtime.trigger_engine import HybridTriggerEngine, TriggerReason


@dataclass(slots=True)
class QAPair:
    question_text: str
    answer_text: str
    timestamp_ms: int


@dataclass(slots=True)
class TriggeredQuestion:
    question_text: str
    reason: TriggerReason


@dataclass(slots=True)
class CopilotSession:
    session_id: str
    provider: str
    job_id: int | None
    interview_context: str | None
    created_at: datetime
    last_seen_at: datetime
    ws_ticket: str
    ws_ticket_expires_at: datetime
    transcript_buffer: str = ""
    buffer_started_ms: int | None = None
    last_chunk_ms: int | None = None
    generation_task: asyncio.Task[None] | None = field(default=None, repr=False)
    generation_counter: int = 0
    qa_context: list[QAPair] = field(default_factory=list)
    queued_triggers: list[TriggeredQuestion] = field(default_factory=list)


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, CopilotSession] = {}
        self._lock = asyncio.Lock()
        self._trigger = HybridTriggerEngine()

    @staticmethod
    def _now_utc() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _now_ms() -> int:
        return int(time.time() * 1000)

    @staticmethod
    def redis_channel(session_id: str) -> str:
        return f"copilot:session:{session_id}:transcript"

    def _expiry_delta(self) -> timedelta:
        if settings.COPILOT_SESSION_MAX_AGE_SEC > 0:
            return timedelta(seconds=settings.COPILOT_SESSION_MAX_AGE_SEC)
        return timedelta(minutes=max(1, settings.COPILOT_SESSION_TTL_MINUTES))

    def _new_ws_ticket(self, now: datetime) -> tuple[str, datetime]:
        ticket = secrets.token_urlsafe(24)
        expires_at = now + timedelta(seconds=max(15, settings.COPILOT_WS_TICKET_EXPIRY_SEC))
        return ticket, expires_at

    @staticmethod
    def _normalize_chunk(text: str) -> str:
        return " ".join(text.split()).strip()

    @staticmethod
    def _append_buffer(existing: str, chunk: str) -> str:
        if not existing:
            return chunk
        return f"{existing} {chunk}"

    @staticmethod
    async def _cancel_tasks(tasks: list[asyncio.Task[None]]) -> None:
        if not tasks:
            return
        for task in tasks:
            if task and not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    def _consume_buffer_locked(self, session: CopilotSession, reason: TriggerReason) -> TriggeredQuestion | None:
        text = session.transcript_buffer.strip()
        session.transcript_buffer = ""
        session.buffer_started_ms = None
        session.last_chunk_ms = None
        if len(text) < 3:
            return None
        return TriggeredQuestion(question_text=text, reason=reason)

    async def _purge_expired_locked(self) -> list[asyncio.Task[None]]:
        cutoff = self._now_utc() - self._expiry_delta()
        expired_ids = [sid for sid, sess in self._sessions.items() if sess.last_seen_at < cutoff]
        tasks_to_cancel: list[asyncio.Task[None]] = []
        for sid in expired_ids:
            session = self._sessions.pop(sid, None)
            if session and session.generation_task and not session.generation_task.done():
                tasks_to_cancel.append(session.generation_task)
        return tasks_to_cancel

    async def create_session(
        self,
        provider: str,
        job_id: int | None = None,
        interview_context: str | None = None,
    ) -> CopilotSession:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            now = self._now_utc()
            ticket, ticket_expiry = self._new_ws_ticket(now)
            session = CopilotSession(
                session_id=uuid4().hex,
                provider=provider,
                job_id=job_id,
                interview_context=interview_context,
                created_at=now,
                last_seen_at=now,
                ws_ticket=ticket,
                ws_ticket_expires_at=ticket_expiry,
            )
            self._sessions[session.session_id] = session
        await self._cancel_tasks(tasks)
        return session

    async def get_session(self, session_id: str) -> CopilotSession | None:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if session:
                session.last_seen_at = self._now_utc()
        await self._cancel_tasks(tasks)
        return session

    async def refresh_ws_ticket(self, session_id: str) -> tuple[str, datetime] | None:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                result = None
            else:
                ticket, expiry = self._new_ws_ticket(self._now_utc())
                session.ws_ticket = ticket
                session.ws_ticket_expires_at = expiry
                session.last_seen_at = self._now_utc()
                result = (ticket, expiry)
        await self._cancel_tasks(tasks)
        return result

    async def validate_ws_ticket(self, session_id: str, ticket: str) -> bool:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                ok = False
            else:
                session.last_seen_at = self._now_utc()
                ok = (
                    ticket == session.ws_ticket
                    and session.ws_ticket_expires_at > self._now_utc()
                )
        await self._cancel_tasks(tasks)
        return ok

    async def ingest_chunk(
        self,
        session_id: str,
        text: str,
        timestamp_ms: int | None = None,
        *,
        is_final: bool = False,
        end_of_turn: bool = False,
    ) -> tuple[CopilotSession | None, TriggeredQuestion | None]:
        print(f"[SESSION_MANAGER] Ingesting chunk: text='{text}', is_final={is_final}, end_of_turn={end_of_turn}")
        normalized = self._normalize_chunk(text)
        if not normalized:
            return None, None
        ts = timestamp_ms if isinstance(timestamp_ms, int) and timestamp_ms >= 0 else self._now_ms()

        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                triggered = None
            else:
                session.last_seen_at = self._now_utc()
                
                # MeetStream sends cumulative text in every chunk. 
                # If we always append, we get massive duplicates.
                # FIX: For partial chunks, replace the current buffer content. 
                # For final chunks, finalize that text into the buffer.
                if not is_final and not end_of_turn:
                    # Replace current "active" segment with the new cumulative partial
                    session.transcript_buffer = normalized
                else:
                    # This is a final chunk or end of turn, append it to consolidate
                    session.transcript_buffer = self._append_buffer(session.transcript_buffer, normalized)

                if session.buffer_started_ms is None:
                    session.buffer_started_ms = ts
                session.last_chunk_ms = ts

                # Only trigger if it's a final chunk or explicitly end of turn
                if is_final or end_of_turn:
                    decision = self._trigger.on_chunk(session.transcript_buffer, is_final=is_final, end_of_turn=end_of_turn)
                    triggered = (
                        self._consume_buffer_locked(session, decision.reason) if decision.should_trigger and decision.reason else None
                    )
                else:
                    triggered = None
        await self._cancel_tasks(tasks)
        return session, triggered

    async def evaluate_timer(self, session_id: str, now_ms: int | None = None) -> tuple[CopilotSession | None, TriggeredQuestion | None]:
        now = now_ms if isinstance(now_ms, int) and now_ms >= 0 else self._now_ms()
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                triggered = None
            else:
                session.last_seen_at = self._now_utc()
                decision = self._trigger.on_timer(
                    session.transcript_buffer,
                    session.buffer_started_ms,
                    session.last_chunk_ms,
                    now,
                )
                triggered = (
                    self._consume_buffer_locked(session, decision.reason) if decision.should_trigger and decision.reason else None
                )
        await self._cancel_tasks(tasks)
        return session, triggered

    async def get_buffer_snapshot(self, session_id: str) -> str:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            snapshot = session.transcript_buffer if session else ""
            if session:
                session.last_seen_at = self._now_utc()
        await self._cancel_tasks(tasks)
        return snapshot

    async def replace_generation_task(
        self,
        session_id: str,
        task_factory: Callable[[], Awaitable[None]],
    ) -> bool:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                old_task = None
            else:
                session.last_seen_at = self._now_utc()
                old_task = session.generation_task
                session.generation_task = None

        tasks_to_cancel = tasks[:]
        if old_task and not old_task.done():
            tasks_to_cancel.append(old_task)
        await self._cancel_tasks(tasks_to_cancel)

        async with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            session.last_seen_at = self._now_utc()
            session.generation_counter += 1
            seq = session.generation_counter
            task_ref: dict[str, asyncio.Task[None]] = {}

            async def _runner() -> None:
                try:
                    await task_factory()
                finally:
                    await self._clear_generation_task_if_current(session_id, task_ref.get("task"))

            task = asyncio.create_task(
                _runner(),
                name=f"copilot-generation-{session_id[:8]}-{seq}",
            )
            task_ref["task"] = task
            session.generation_task = task
            return True

    async def _clear_generation_task_if_current(self, session_id: str, task: asyncio.Task[None] | None) -> None:
        if task is None:
            return
        async with self._lock:
            session = self._sessions.get(session_id)
            if session and session.generation_task is task:
                session.generation_task = None

    async def cancel_generation(self, session_id: str) -> None:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            task = session.generation_task if session else None
            if session:
                session.generation_task = None
                session.last_seen_at = self._now_utc()
        tasks_to_cancel = tasks[:]
        if task and not task.done():
            tasks_to_cancel.append(task)
        await self._cancel_tasks(tasks_to_cancel)

    async def is_generating(self, session_id: str) -> bool:
        async with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            return session.generation_task is not None and not session.generation_task.done()

    async def close_session(self, session_id: str) -> None:
        async with self._lock:
            tasks = await self._purge_expired_locked()
            session = self._sessions.pop(session_id, None)
            if session and session.generation_task and not session.generation_task.done():
                tasks.append(session.generation_task)
        await self._cancel_tasks(tasks)

    async def shutdown(self) -> None:
        async with self._lock:
            tasks: list[asyncio.Task[None]] = []
            for session in self._sessions.values():
                if session.generation_task and not session.generation_task.done():
                    tasks.append(session.generation_task)
            self._sessions.clear()
        await self._cancel_tasks(tasks)

    def _add_qa_pair_locked(self, session: CopilotSession, question: str, answer: str) -> None:
        pair = QAPair(
            question_text=question,
            answer_text=answer,
            timestamp_ms=self._now_ms(),
        )
        session.qa_context.append(pair)
        max_pairs = max(1, settings.COPILOT_CONTEXT_WINDOW_SIZE)
        if len(session.qa_context) > max_pairs:
            session.qa_context = session.qa_context[-max_pairs:]

    def _get_qa_context_locked(self, session: CopilotSession) -> list[QAPair]:
        return session.qa_context.copy()

    def _get_context_window_text(self, session: CopilotSession) -> str:
        if not session.qa_context:
            return ""
        lines: list[str] = []
        for pair in session.qa_context:
            lines.append(f"Q: {pair.question_text}")
            lines.append(f"A: {pair.answer_text}")
        return "\n".join(lines)

    async def add_qa_pair(self, session_id: str, question: str, answer: str) -> None:
        async with self._lock:
            await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if session:
                session.last_seen_at = self._now_utc()
                self._add_qa_pair_locked(session, question, answer)

    async def get_qa_context(self, session_id: str) -> list[QAPair]:
        async with self._lock:
            await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if session:
                session.last_seen_at = self._now_utc()
                return self._get_qa_context_locked(session)
        return []

    async def get_context_window_text(self, session_id: str) -> str:
        async with self._lock:
            await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if session:
                session.last_seen_at = self._now_utc()
                return self._get_context_window_text(session)
        return ""

    def _queue_trigger_locked(
        self, session: CopilotSession, question: TriggeredQuestion
    ) -> bool:
        max_queued = max(1, settings.COPILOT_MAX_QUEUED_TRIGGERS)
        if len(session.queued_triggers) >= max_queued:
            return False
        session.queued_triggers.append(question)
        return True

    async def queue_trigger(
        self, session_id: str, question: TriggeredQuestion
    ) -> bool:
        async with self._lock:
            await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return False
            session.last_seen_at = self._now_utc()
            return self._queue_trigger_locked(session, question)

    async def get_queued_trigger(self, session_id: str) -> TriggeredQuestion | None:
        async with self._lock:
            await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if not session:
                return None
            session.last_seen_at = self._now_utc()
            if session.queued_triggers:
                return session.queued_triggers.pop(0)
        return None

    async def clear_queued_triggers(self, session_id: str) -> None:
        async with self._lock:
            await self._purge_expired_locked()
            session = self._sessions.get(session_id)
            if session:
                session.queued_triggers.clear()
                session.last_seen_at = self._now_utc()
