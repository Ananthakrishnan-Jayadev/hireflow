import json
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from config import settings
from services.realtime.provider_interface import LLMProvider
from services.realtime.schemas import CoachingNormalizedOutput


def _as_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None

    def _get_client(self) -> AsyncOpenAI:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def generate_coaching(self, system_prompt: str, user_prompt: str) -> CoachingNormalizedOutput:
        response = await self._get_client().chat.completions.create(
            model=settings.COPILOT_MODEL_OPENAI,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        raw = response.choices[0].message.content or "{}"
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}

        return CoachingNormalizedOutput(
            answer_suggestion=str(payload.get("answer_suggestion", "")).strip(),
            talking_points=_as_list(payload.get("talking_points")),
            follow_up_strategy=_as_list(payload.get("follow_up_strategy")),
        )

    async def stream_coaching(self, system_prompt: str, user_prompt: str) -> AsyncIterator[str]:
        stream = await self._get_client().chat.completions.create(
            model=settings.COPILOT_MODEL_OPENAI,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            stream=True,
        )

        try:
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        finally:
            aclose = getattr(stream, "aclose", None)
            if callable(aclose):
                await aclose()
