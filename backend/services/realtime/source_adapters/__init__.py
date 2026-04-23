"""Transcript source adapters for realtime copilot."""

from services.realtime.source_adapters.base_adapter import (
    AdapterHealth,
    TranscriptChunk,
    TranscriptChunkCallback,
    TranscriptSource,
    TranscriptSourceAdapter,
)
from services.realtime.source_adapters.local_simulator import LocalSimulatorAdapter
from services.realtime.source_adapters.meetstream_adapter import MeetStreamAdapter

__all__ = [
    "TranscriptSourceAdapter",
    "TranscriptSource",
    "TranscriptChunk",
    "TranscriptChunkCallback",
    "AdapterHealth",
    "LocalSimulatorAdapter",
    "MeetStreamAdapter",
]