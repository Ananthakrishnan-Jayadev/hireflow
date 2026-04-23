import json
import re
from collections.abc import AsyncIterator

import httpx

from config import settings
from services.realtime.provider_interface import LLMProvider
from services.realtime.schemas import CoachingNormalizedOutput


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


class OllamaProvider(LLMProvider):
    name = "ollama"

    @staticmethod
    def _http_error_detail(response: httpx.Response) -> str:
        try:
            payload = response.json()
            if isinstance(payload, dict):
                detail = payload.get("error") or payload.get("message")
                if detail:
                    return str(detail)
            return response.text.strip()[:300] or "unknown error"
        except Exception:
            return response.text.strip()[:300] or "unknown error"

    def _build_payload(self, system_prompt: str, user_prompt: str, stream: bool) -> dict:
        return {
            "model": settings.COPILOT_MODEL_OLLAMA,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": stream,
            "options": {"temperature": 0.2},
        }

    @staticmethod
    def _build_generate_prompt(system_prompt: str, user_prompt: str) -> str:
        return f"{system_prompt}\n\n{user_prompt}"

    @staticmethod
    def _extract_delta(item: dict) -> str:
        msg = item.get("message")
        if isinstance(msg, dict):
            text = msg.get("content")
            if text:
                return str(text)
        text = item.get("response")
        if text:
            return str(text)
        return ""

    async def _generate_text(self, system_prompt: str, user_prompt: str) -> str:
        timeout = settings.COPILOT_OLLAMA_TIMEOUT_SEC
        base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        chat_url = f"{base_url}/api/chat"
        generate_url = f"{base_url}/api/generate"
        payload = self._build_payload(system_prompt, user_prompt, stream=False)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(chat_url, json=payload)
                if response.status_code == 404:
                    # Compatibility fallback for older Ollama versions using /api/generate only.
                    response = await client.post(
                        generate_url,
                        json={
                            "model": settings.COPILOT_MODEL_OLLAMA,
                            "prompt": self._build_generate_prompt(system_prompt, user_prompt),
                            "stream": False,
                            "options": {"temperature": 0.2},
                        },
                    )
        except Exception as exc:
            raise RuntimeError(
                f"Could not connect to Ollama service at {base_url}. Is `ollama serve` running?"
            ) from exc

        if response.status_code >= 400:
            detail = self._http_error_detail(response)
            raise RuntimeError(
                f"Ollama request failed ({response.status_code}) for model '{settings.COPILOT_MODEL_OLLAMA}': {detail}"
            )

        data = response.json()
        return self._extract_delta(data).strip()

    async def generate_coaching(self, system_prompt: str, user_prompt: str) -> CoachingNormalizedOutput:
        raw = await self._generate_text(system_prompt, user_prompt)
        payload = _extract_json(raw)
        return CoachingNormalizedOutput(
            answer_suggestion=str(payload.get("answer_suggestion", "")).strip(),
            talking_points=_as_list(payload.get("talking_points")),
            follow_up_strategy=_as_list(payload.get("follow_up_strategy")),
        )

    async def stream_coaching(self, system_prompt: str, user_prompt: str) -> AsyncIterator[str]:
        timeout = settings.COPILOT_OLLAMA_TIMEOUT_SEC
        base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        chat_url = f"{base_url}/api/chat"
        generate_url = f"{base_url}/api/generate"
        payload = self._build_payload(system_prompt, user_prompt, stream=True)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", chat_url, json=payload) as response:
                    if response.status_code == 404:
                        # Fallback to /api/generate stream for compatibility.
                        async with client.stream(
                            "POST",
                            generate_url,
                            json={
                                "model": settings.COPILOT_MODEL_OLLAMA,
                                "prompt": self._build_generate_prompt(system_prompt, user_prompt),
                                "stream": True,
                                "options": {"temperature": 0.2},
                            },
                        ) as gen_response:
                            if gen_response.status_code >= 400:
                                detail = self._http_error_detail(gen_response)
                                raise RuntimeError(
                                    f"Ollama streaming request failed ({gen_response.status_code}) for model "
                                    f"'{settings.COPILOT_MODEL_OLLAMA}': {detail}"
                                )
                            async for line in gen_response.aiter_lines():
                                if not line:
                                    continue
                                try:
                                    item = json.loads(line)
                                except json.JSONDecodeError:
                                    continue
                                if item.get("error"):
                                    raise RuntimeError(f"Ollama streaming error: {item['error']}")
                                delta = self._extract_delta(item)
                                if delta:
                                    yield delta
                        return
                    if response.status_code >= 400:
                        detail = self._http_error_detail(response)
                        raise RuntimeError(
                            f"Ollama streaming request failed ({response.status_code}) for model "
                            f"'{settings.COPILOT_MODEL_OLLAMA}': {detail}"
                        )
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            item = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if item.get("error"):
                            raise RuntimeError(f"Ollama streaming error: {item['error']}")
                        delta = self._extract_delta(item)
                        if delta:
                            yield delta
        except RuntimeError:
            raise
        except Exception as exc:
            raise RuntimeError(
                f"Could not connect to Ollama service at {base_url}. Is `ollama serve` running?"
            ) from exc
