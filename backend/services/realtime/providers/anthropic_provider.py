import json
import re
from collections.abc import AsyncIterator

from config import settings
from services.realtime.provider_interface import LLMProvider
from services.realtime.schemas import CoachingNormalizedOutput

try:
    from anthropic import AsyncAnthropic  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    AsyncAnthropic = None


def _as_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _extract_json(text: str) -> dict:
    if not text:
        return {}
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        self._client: AsyncAnthropic | None = None  # type: ignore[assignment]

    def _get_client(self):
        if AsyncAnthropic is None:
            raise RuntimeError("anthropic package is not installed.")
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured.")
        if self._client is None:
            self._client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    async def _generate_text(self, system_prompt: str, user_prompt: str) -> str:
        response = await self._get_client().messages.create(
            model=settings.COPILOT_MODEL_ANTHROPIC,
            max_tokens=900,
            temperature=0.2,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        parts: list[str] = []
        for block in response.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "".join(parts).strip()

    async def generate_coaching(self, system_prompt: str, user_prompt: str) -> CoachingNormalizedOutput:
        raw = await self._generate_text(system_prompt, user_prompt)
        payload = _extract_json(raw)
        return CoachingNormalizedOutput(
            answer_suggestion=str(payload.get("answer_suggestion", "")).strip(),
            talking_points=_as_list(payload.get("talking_points")),
            follow_up_strategy=_as_list(payload.get("follow_up_strategy")),
        )

    async def stream_coaching(self, system_prompt: str, user_prompt: str) -> AsyncIterator[str]:
        # The fallback keeps the interface consistent when native stream integration is unavailable.
        text = await self._generate_text(system_prompt, user_prompt)
        for token in re.split(r"(\s+)", text):
            if token:
                yield token

