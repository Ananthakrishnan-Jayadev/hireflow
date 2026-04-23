from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TranscriptSource(str, Enum):
    LOCAL = "local"
    MEETSTREAM = "meetstream"


class TranscriptChunk(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    speaker: Optional[str] = Field(default=None, max_length=100)
    timestamp_ms: int = Field(ge=0)
    is_final: bool = False
    end_of_turn: bool = False
    confidence: float = 1.0
    source: TranscriptSource


class AdapterHealth(BaseModel):
    connected: bool
    error: Optional[str] = None
    last_activity_ms: Optional[int] = None


TranscriptChunkCallback = Callable[[str, TranscriptChunk], Awaitable[None]]


class TranscriptSourceAdapter(ABC):
    name: str
    source: TranscriptSource

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to the transcript source."""
        raise NotImplementedError

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the transcript source and clean up resources."""
        raise NotImplementedError

    @abstractmethod
    async def on_transcript_chunk(self, callback: TranscriptChunkCallback) -> None:
        """Register a callback to process incoming transcript chunks.
        
        The callback will be invoked for each transcript chunk received
        from the source. Implementations should call this callback with
        a standardized TranscriptChunk object.
        """
        raise NotImplementedError

    async def health_check(self) -> AdapterHealth:
        """Check the health of the transcript source connection.
        
        Returns:
            AdapterHealth with connection status and optional error message.
        """
        return AdapterHealth(connected=False, error="health_check not implemented")

    @property
    def is_connected(self) -> bool:
        """Check if the adapter is currently connected."""
        return False