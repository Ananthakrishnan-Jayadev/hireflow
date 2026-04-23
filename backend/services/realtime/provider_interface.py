from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from services.realtime.schemas import CoachingNormalizedOutput


class LLMProvider(ABC):
    name: str

    @abstractmethod
    async def generate_coaching(self, system_prompt: str, user_prompt: str) -> CoachingNormalizedOutput:
        """Return fully structured coaching output."""
        raise NotImplementedError

    @abstractmethod
    async def stream_coaching(self, system_prompt: str, user_prompt: str) -> AsyncIterator[str]:
        """Yield answer text deltas for progressive UI rendering."""
        raise NotImplementedError

