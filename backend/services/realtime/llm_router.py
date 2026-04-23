from fastapi import HTTPException

from config import settings
from services.realtime.provider_interface import LLMProvider
from services.realtime.providers.anthropic_provider import AnthropicProvider
from services.realtime.providers.openai_provider import OpenAIProvider
from services.realtime.providers.ollama_provider import OllamaProvider


class LLMRouter:
    def __init__(self) -> None:
        self._providers: dict[str, LLMProvider] = {
            "openai": OpenAIProvider(),
            "anthropic": AnthropicProvider(),
            "ollama": OllamaProvider(),
        }

    def resolve_provider_name(self, requested: str | None = None) -> str:
        provider = (requested or settings.COPILOT_DEFAULT_PROVIDER or "openai").strip().lower()
        if provider not in self._providers:
            raise HTTPException(status_code=422, detail="Unsupported provider. Use 'openai', 'anthropic', or 'ollama'.")
        return provider

    def get_provider(self, requested: str | None = None) -> tuple[str, LLMProvider]:
        provider_name = self.resolve_provider_name(requested)
        return provider_name, self._providers[provider_name]
