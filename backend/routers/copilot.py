import asyncio
import contextlib
import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from starlette.websockets import WebSocketState
from redis.asyncio import Redis

from config import settings
from dependencies.auth import require_auth
from models.user import User
from services.realtime.llm_router import LLMRouter
from services.realtime.orchestrator import CoachingOrchestrator
from services.realtime.source_adapters.adapter_factory import create_transcript_adapter
from services.realtime.source_adapters.base_adapter import TranscriptChunk
from services.realtime.schemas import (
    CopilotSessionCreateRequest,
    CopilotSessionCreateResponse,
    CopilotWsTicketResponse,
    TranscriptChunkEvent,
    TranscriptChunkPayload,
)
from services.realtime.session_manager import SessionManager, TriggeredQuestion

router = APIRouter()

_session_manager = SessionManager()
_llm_router = LLMRouter()
_orchestrator = CoachingOrchestrator(_llm_router)
_redis_client: Redis | None = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _event(event: str, data: dict) -> dict:
    return {"event": event, "data": data}


def _get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def shutdown_copilot_services() -> None:
    global _redis_client
    await _session_manager.shutdown()
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


async def _global_meetstream_callback(sid: str, chunk: TranscriptChunk) -> None:
    """
    Global callback for MeetStream adapter that fans out transcripts to Redis.
    This ensures that even if no websocket is connected yet, the transcripts
    are buffered in Redis or at least processed by the session manager if needed.
    """
    try:
        redis_client = _get_redis()
        channel = _session_manager.redis_channel(sid)
        payload_data = TranscriptChunkPayload(
            text=chunk.text,
            timestamp_ms=chunk.timestamp_ms,
            is_final=chunk.is_final,
            end_of_turn=chunk.end_of_turn,
            confidence=chunk.confidence
        )
        # We publish to Redis so any active or future websocket can see it
        await redis_client.publish(channel, json.dumps(payload_data.model_dump()))
    except Exception as e:
        print(f"[COPILOT] Error in global MeetStream callback: {e}")


@router.post("/sessions", response_model=CopilotSessionCreateResponse)
async def create_session(request: Request, req: CopilotSessionCreateRequest, _: User = Depends(require_auth)):
    provider_name = _llm_router.resolve_provider_name(req.provider)
    session = await _session_manager.create_session(
        provider=provider_name,
        job_id=req.job_id,
        interview_context=req.interview_context,
    )

    source = req.source or settings.COPILOT_TRANSCRIPT_SOURCE
    if source == "meetstream":
        if not req.meeting_link:
            raise HTTPException(status_code=400, detail="meeting_link is required for meetstream source")
        if not settings.MEETSTREAM_API_KEY:
            raise HTTPException(status_code=500, detail="MEETSTREAM_API_KEY is not configured")
            
        from services.meetstream_client import MeetStreamClient
        from services.realtime.source_adapters.meetstream_adapter import get_meetstream_adapter
        client = MeetStreamClient()
        # Use MEETSTREAM_WEBHOOK_BASE_URL from settings (e.g., https://xyz.ngrok.io)
        webhook_base = (settings.MEETSTREAM_WEBHOOK_BASE_URL or str(request.base_url)).rstrip("/")
        
        # Ensure adapter is connected and callback is registered BEFORE creating bot
        adapter = get_meetstream_adapter()
        await adapter.connect()
        await adapter.on_transcript_chunk(_global_meetstream_callback)

        try:
            bot_info = await client.create_bot(req.meeting_link, session.session_id, webhook_base)
            bot_id = bot_info.get("bot_id")
            if bot_id:
                adapter.register_bot_session(bot_id, session.session_id)
                print(f"[COPILOT] Registered bot_id={bot_id} → session_id={session.session_id}")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to create MeetStream bot: {str(exc)}")

    return CopilotSessionCreateResponse(
        session_id=session.session_id,
        provider=session.provider,
        ws_ticket=session.ws_ticket,
        ws_ticket_expires_at=session.ws_ticket_expires_at,
        created_at=session.created_at,
    )


@router.post("/sessions/{session_id}/ws-ticket", response_model=CopilotWsTicketResponse)
async def refresh_ws_ticket(session_id: str, _: User = Depends(require_auth)):
    ticket_result = await _session_manager.refresh_ws_ticket(session_id)
    if not ticket_result:
        raise HTTPException(status_code=404, detail="Copilot session not found or expired.")
    ws_ticket, ws_ticket_expires_at = ticket_result
    return CopilotWsTicketResponse(
        session_id=session_id,
        ws_ticket=ws_ticket,
        ws_ticket_expires_at=ws_ticket_expires_at,
    )


async def _handle_trigger(
    websocket: WebSocket,
    send_lock: asyncio.Lock,
    session_id: str,
    provider_name: str,
    interview_context: str | None,
    trigger: TriggeredQuestion,
) -> None:
    print(f"[COPILOT] Handling trigger: reason={trigger.reason}, text='{trigger.question_text}'")
    strategy = settings.COPILOT_OVERLAP_STRATEGY
    is_generating = await _session_manager.is_generating(session_id)

    if is_generating and strategy == "queue":
        print(f"[COPILOT] Generation in progress, queuing trigger.")
        await _session_manager.queue_trigger(session_id, trigger)
        return

    # For "cancel_restart" or if not generating, start/replace generation task
    print(f"[COPILOT] Starting/Replacing generation task.")
    await _start_generation(
        websocket=websocket,
        send_lock=send_lock,
        session_id=session_id,
        provider_name=provider_name,
        interview_context=interview_context,
        trigger=trigger,
    )


async def _start_generation(
    websocket: WebSocket,
    send_lock: asyncio.Lock,
    session_id: str,
    provider_name: str,
    interview_context: str | None,
    trigger: TriggeredQuestion,
) -> None:
    async def _send(event: str, payload: dict) -> None:
        async with send_lock:
            await websocket.send_json(_event(event, payload))

    async def _runner() -> None:
        print(f"[COPILOT] Runner started for session {session_id}")
        current_trigger: TriggeredQuestion | None = trigger
        while current_trigger:
            try:
                # Always fetch fresh history for each trigger in the loop
                qa_history = await _session_manager.get_qa_context(session_id)
                
                print(f"[COPILOT] Streaming from orchestrator for: '{current_trigger.question_text}'")
                await _send(
                    "status.generating",
                    {
                        "state": "generating",
                        "reason": current_trigger.reason,
                        "question_text": current_trigger.question_text,
                    },
                )
                answer_text = ""
                async for event_name, payload in _orchestrator.stream(
                    question_text=current_trigger.question_text,
                    interview_context=interview_context,
                    qa_history=qa_history,
                    provider_name=provider_name,
                ):
                    await _send(event_name, payload)
                    if event_name == "coaching.final" and "answer_suggestion" in payload:
                        answer_text = payload["answer_suggestion"]
                
                if answer_text:
                    await _session_manager.add_qa_pair(session_id, current_trigger.question_text, answer_text)
            
            except asyncio.CancelledError:
                with contextlib.suppress(Exception):
                    await _send(
                        "status.cancelled",
                        {
                            "state": "cancelled",
                            "reason": "superseded_by_new_context",
                            "question_text": current_trigger.question_text if current_trigger else "unknown",
                        },
                    )
                raise
            except Exception as exc:
                with contextlib.suppress(Exception):
                    await _send("error.event", {"message": f"Generation failed: {exc}"})
            
            # Check for next trigger if strategy is queue
            if settings.COPILOT_OVERLAP_STRATEGY == "queue":
                current_trigger = await _session_manager.get_queued_trigger(session_id)
            else:
                current_trigger = None

    await _session_manager.replace_generation_task(session_id, _runner)


@router.websocket("/ws/{session_id}")
async def websocket_session(
    websocket: WebSocket,
    session_id: str,
    ticket: str = Query(min_length=12),
):
    await websocket.accept()
    send_lock = asyncio.Lock()

    def _safe_payload(payload: TranscriptChunkPayload) -> dict:
        return payload.model_dump()

    async def _send(event_name: str, payload: dict) -> None:
        async with send_lock:
            await websocket.send_json(_event(event_name, payload))

    pubsub = None
    local_queue: asyncio.Queue[TranscriptChunkPayload] = asyncio.Queue()
    redis_client: Redis | None = None
    channel: str | None = None
    adapter = None
    try:
        valid = await _session_manager.validate_ws_ticket(session_id, ticket)
        if not valid:
            await _send("error.event", {"message": "Invalid or expired websocket ticket."})
            await websocket.close(code=1008)
            return

        session = await _session_manager.get_session(session_id)
        if not session:
            await _send("error.event", {"message": "Copilot session not found or expired."})
            await websocket.close(code=1008)
            return

        # Initialize adapter based on configuration
        try:
            adapter = create_transcript_adapter()
            await adapter.connect()
        except Exception as exc:
            await _send("error.event", {"message": f"Failed to initialize transcript adapter: {exc}"})

        # Prefer Redis transport for transcript fan-out
        try:
            redis_client = _get_redis()
            await redis_client.ping()
            channel = _session_manager.redis_channel(session_id)
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(channel)
        except Exception:
            redis_client = None
            channel = None
            pubsub = None

        await _send(
            "status.connected",
            {
                "state": "connected",
                "session_id": session_id,
                "provider": session.provider,
                "transcript_source": adapter.source if adapter else "local_fallback",
            },
        )

        async def _receiver() -> None:
            if adapter and adapter.source == "local":
                # For local simulator, we still register a specific callback for this session
                # so it can push directly to this websocket's local_queue if Redis is down.
                async def _local_adapter_callback(sid: str, chunk: TranscriptChunk) -> None:
                    if sid != "local" and sid != session_id:
                        return
                    payload_data = TranscriptChunkPayload(
                        text=chunk.text,
                        timestamp_ms=chunk.timestamp_ms,
                        is_final=chunk.is_final,
                        end_of_turn=chunk.end_of_turn,
                        confidence=chunk.confidence
                    )
                    if redis_client is not None and channel is not None:
                        await redis_client.publish(channel, json.dumps(_safe_payload(payload_data)))
                    else:
                        await local_queue.put(payload_data)

                await adapter.on_transcript_chunk(_local_adapter_callback)
                # Keep receiver alive to handle other client messages if any
                while True:
                    await websocket.receive_json()
            elif adapter and adapter.source != "local":
                # For MeetStream, the global callback is already registered at session creation.
                # Here we just keep the receiver alive.
                while True:
                    await websocket.receive_json()
            else:
                while True:
                    raw = await websocket.receive_json()
                    try:
                        incoming = TranscriptChunkEvent.model_validate(raw)
                    except Exception:
                        await _send("error.event", {"message": "Invalid websocket payload."})
                        continue
                    payload = incoming.data
                    if redis_client is not None and channel is not None:
                        await redis_client.publish(channel, json.dumps(_safe_payload(payload)))
                    else:
                        await local_queue.put(payload)

        async def _processor() -> None:
            while True:
                payload: TranscriptChunkPayload | None = None
                if pubsub is not None:
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.2)
                    if msg and msg.get("type") == "message":
                        try:
                            payload = TranscriptChunkPayload.model_validate_json(msg["data"])
                        except Exception:
                            await _send("error.event", {"message": "Malformed transcript chunk message."})
                            continue
                else:
                    try:
                        payload = await asyncio.wait_for(local_queue.get(), timeout=0.2)
                    except asyncio.TimeoutError:
                        payload = None

                if payload is not None:
                    updated_session, trigger = await _session_manager.ingest_chunk(
                        session_id=session_id,
                        text=payload.text,
                        timestamp_ms=payload.timestamp_ms,
                        is_final=payload.is_final,
                        end_of_turn=payload.end_of_turn,
                    )
                    if not updated_session:
                        await _send("error.event", {"message": "Session expired."})
                        return

                    buffer_text = await _session_manager.get_buffer_snapshot(session_id)
                    await _send(
                        "transcript.buffer",
                        {
                            "text": buffer_text,
                            "last_chunk_ms": payload.timestamp_ms,
                        },
                    )

                    if trigger:
                        await _handle_trigger(
                            websocket=websocket,
                            send_lock=send_lock,
                            session_id=session_id,
                            provider_name=updated_session.provider,
                            interview_context=updated_session.interview_context,
                            trigger=trigger,
                        )

                _, timer_trigger = await _session_manager.evaluate_timer(session_id, _now_ms())
                if timer_trigger:
                    current = await _session_manager.get_session(session_id)
                    if not current:
                        await _send("error.event", {"message": "Session expired."})
                        return
                    await _handle_trigger(
                        websocket=websocket,
                        send_lock=send_lock,
                        session_id=session_id,
                        provider_name=current.provider,
                        interview_context=current.interview_context,
                        trigger=timer_trigger,
                    )

        receiver_task = asyncio.create_task(_receiver(), name=f"copilot-recv-{session_id[:8]}")
        processor_task = asyncio.create_task(_processor(), name=f"copilot-proc-{session_id[:8]}")
        done, pending = await asyncio.wait(
            {receiver_task, processor_task},
            return_when=asyncio.FIRST_EXCEPTION,
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        for task in done:
            exc = task.exception()
            if exc:
                raise exc
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        with contextlib.suppress(Exception):
            await websocket.send_json(_event("error.event", {"message": str(exc)}))
    finally:
        await _session_manager.cancel_generation(session_id)
        if adapter:
            with contextlib.suppress(Exception):
                await adapter.disconnect()
        if pubsub is not None:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe()
            with contextlib.suppress(Exception):
                await pubsub.close()
        with contextlib.suppress(Exception):
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()
