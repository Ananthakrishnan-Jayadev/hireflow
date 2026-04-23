import re
from dataclasses import dataclass
from typing import Literal

from config import settings

TriggerReason = Literal["end_of_turn", "punctuation", "silence_timeout", "max_wait"]

_PUNCTUATION_RE = re.compile(r"[.?!]\s*$")


@dataclass(slots=True)
class TriggerDecision:
    should_trigger: bool
    reason: TriggerReason | None = None


class HybridTriggerEngine:
    def __init__(self) -> None:
        self._silence_ms = max(100, settings.COPILOT_TRIGGER_SILENCE_MS)
        self._max_wait_ms = max(self._silence_ms, settings.COPILOT_TRIGGER_MAX_WAIT_MS)

    @staticmethod
    def _normalize(buffer_text: str) -> str:
        return buffer_text.strip()

    def on_chunk(self, buffer_text: str, is_final: bool = False, end_of_turn: bool = False) -> TriggerDecision:
        print(f"[TRIGGER] Received chunk: text='{buffer_text}', is_final={is_final}")
        text = self._normalize(buffer_text)
        if len(text) < 3:
            return TriggerDecision(False)
        if end_of_turn:
            return TriggerDecision(True, "end_of_turn")
        if _PUNCTUATION_RE.search(text):
            return TriggerDecision(True, "punctuation")
        if is_final:
            return TriggerDecision(True, "silence_timeout")
        return TriggerDecision(False)

    def on_timer(
        self,
        buffer_text: str,
        buffer_started_ms: int | None,
        last_chunk_ms: int | None,
        now_ms: int,
    ) -> TriggerDecision:
        text = self._normalize(buffer_text)
        if len(text) < 3 or last_chunk_ms is None:
            return TriggerDecision(False)
        if now_ms - last_chunk_ms >= self._silence_ms:
            return TriggerDecision(True, "silence_timeout")
        if buffer_started_ms is not None and now_ms - buffer_started_ms >= self._max_wait_ms:
            return TriggerDecision(True, "max_wait")
        return TriggerDecision(False)
