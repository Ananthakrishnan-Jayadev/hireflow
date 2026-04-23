from typing import Optional
from datetime import datetime, timezone

from services.realtime.source_adapters.base_adapter import (
    AdapterHealth,
    TranscriptChunk,
    TranscriptChunkCallback,
    TranscriptSource,
    TranscriptSourceAdapter,
)
from services.realtime.schemas import MeetStreamWebhookPayload


class MeetStreamAdapter(TranscriptSourceAdapter):
    """
    Receives transcript chunks from MeetStream webhook POSTs.
    Unlike LocalSimulator, this adapter is push-based — data arrives
    via the ingest() method called from the webhook router.
    """
    name = "meetstream"
    source = TranscriptSource.MEETSTREAM

    def __init__(self, confidence_threshold: float = 0.3):
        self.confidence_threshold = confidence_threshold
        self._callbacks: list[TranscriptChunkCallback] = []
        self._connected = False
        # Maps bot_id -> session_id for routing
        self._bot_session_map: dict[str, str] = {}
        self._last_activity_ms: Optional[int] = None

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False
        self._bot_session_map.clear()
        self._callbacks.clear()

    async def health_check(self) -> AdapterHealth:
        return AdapterHealth(
            connected=self._connected,
            error=None if self._connected else "not connected",
            last_activity_ms=self._last_activity_ms,
        )

    def register_bot_session(self, bot_id: str, session_id: str):
        """Called when a copilot session is created with MeetStream source."""
        self._bot_session_map[bot_id] = session_id

    def unregister_bot_session(self, bot_id: str):
        """Called when a copilot session ends."""
        self._bot_session_map.pop(bot_id, None)

    async def on_transcript_chunk(self, callback: TranscriptChunkCallback) -> None:
        """Register the callback that feeds into the trigger engine."""
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    async def ingest(self, payload: MeetStreamWebhookPayload) -> Optional[str]:
        """
        Called by the webhook endpoint. Returns the session_id if
        the chunk was forwarded, None if it was filtered out.
        """
        if not self._connected or not self._callbacks:
            return None

        # Calculate average confidence (default to 1.0 if no words yet in a partial)
        avg_confidence = (
            sum(w.confidence for w in payload.words) / len(payload.words)
            if payload.words else 1.0
        )

        # Filter low-confidence garbage (only for final chunks to avoid flickering)
        if payload.is_final and avg_confidence < self.confidence_threshold:
            print(f"[ADAPTER] Filtered low confidence: {avg_confidence}")
            return None

        # Filter out empty transcripts to prevent validation errors
        if not payload.transcript.strip():
            return None

        # Find the session for this bot
        session_id = self._bot_session_map.get(payload.bot_id)
        if not session_id:
            session_id = payload.custom_attributes.get("session_id")
            if not session_id:
                return None
            self._bot_session_map[payload.bot_id] = session_id

        # Update last activity
        self._last_activity_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        # Parse timestamp string
        try:
            ts_str = payload.timestamp.replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts_str)
            timestamp_ms = int(dt.timestamp() * 1000)
        except Exception:
            timestamp_ms = self._last_activity_ms

        # Convert to TranscriptChunk
        chunk = TranscriptChunk(
            text=payload.transcript,
            speaker=payload.speakerName,
            timestamp_ms=timestamp_ms,
            is_final=payload.is_final,
            end_of_turn=payload.end_of_turn,
            confidence=avg_confidence,
            source=TranscriptSource.MEETSTREAM
        )

        for cb in self._callbacks:
            await cb(session_id, chunk)
        return session_id

# Create a singleton adapter instance since the webhook router needs access
meetstream_adapter_instance = MeetStreamAdapter()

def get_meetstream_adapter() -> MeetStreamAdapter:
    return meetstream_adapter_instance