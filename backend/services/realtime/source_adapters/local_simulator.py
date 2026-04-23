import argparse
import asyncio
import json
import time
from pathlib import Path
from typing import Optional

from services.realtime.source_adapters.base_adapter import (
    AdapterHealth,
    TranscriptChunk,
    TranscriptChunkCallback,
    TranscriptSource,
    TranscriptSourceAdapter,
)


class LocalSimulatorAdapter(TranscriptSourceAdapter):
    name = "local_simulator"
    source = TranscriptSource.LOCAL

    def __init__(self, chunks: list[dict]) -> None:
        self._chunks = chunks
        self._connected = False
        self._callback: Optional[TranscriptChunkCallback] = None
        self._task: Optional[asyncio.Task[None]] = None

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def on_transcript_chunk(self, callback: TranscriptChunkCallback) -> None:
        self._callback = callback
        self._task = asyncio.create_task(self._emit_chunks())

    async def _emit_chunks(self) -> None:
        for item in self._chunks:
            if not self._connected:
                break
            text = str(item.get("text") or item.get("word") or "").strip()
            if not text:
                continue
            delay_ms = int(item.get("delay_ms") or 0)
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)
            chunk = TranscriptChunk(
                text=text,
                speaker=item.get("speaker"),
                timestamp_ms=int(item.get("timestamp_ms") or int(time.time() * 1000)),
                is_final=bool(item.get("is_final", False)),
                source=TranscriptSource.LOCAL,
            )
            if self._callback:
                await self._callback("local", chunk)

    async def health_check(self) -> AdapterHealth:
        return AdapterHealth(
            connected=self._connected,
            error=None if self._connected else "not connected",
        )

    @property
    def is_connected(self) -> bool:
        return self._connected


async def _run_standalone(session_id: str, chunks_path: Path, redis_url: str) -> None:
    from redis.asyncio import Redis

    from services.realtime.session_manager import SessionManager

    redis_client = Redis.from_url(redis_url, decode_responses=True)
    await redis_client.ping()
    channel = SessionManager.redis_channel(session_id)

    raw = chunks_path.read_text(encoding="utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, list):
        raise ValueError("Input file must contain a JSON array of chunks.")

    adapter = LocalSimulatorAdapter(payload)
    await adapter.connect()

    async def publish_to_redis(sid: str, chunk: TranscriptChunk) -> None:
        await redis_client.publish(
            channel,
            json.dumps(
                {
                    "text": chunk.text,
                    "timestamp_ms": chunk.timestamp_ms,
                    "is_final": chunk.is_final,
                }
            ),
        )
        print(f"published: {chunk.text}")

    await adapter.on_transcript_chunk(publish_to_redis)
    if adapter._task:
        await adapter._task
    await adapter.disconnect()
    await redis_client.aclose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Local transcript chunk simulator for copilot phase 2.")
    parser.add_argument("--session-id", required=True, help="Active copilot session ID.")
    parser.add_argument("--input", required=True, help="Path to chunk JSON array.")
    parser.add_argument("--redis-url", default="redis://localhost:6379/0", help="Redis URL.")
    args = parser.parse_args()

    asyncio.run(_run_standalone(args.session_id, Path(args.input), args.redis_url))


if __name__ == "__main__":
    main()