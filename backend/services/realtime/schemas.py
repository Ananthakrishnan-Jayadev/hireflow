from datetime import datetime
from typing import Any, Literal, Optional, List

from pydantic import BaseModel, Field, field_validator

_PROVIDERS = {"openai", "anthropic", "ollama"}


class CopilotSessionCreateRequest(BaseModel):
    job_id: Optional[int] = None
    interview_context: Optional[str] = None
    provider: Optional[str] = None
    source: Optional[str] = None
    meeting_link: Optional[str] = None

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        norm = v.strip().lower()
        if norm not in _PROVIDERS:
            raise ValueError("provider must be one of: openai, anthropic, ollama")
        return norm


class CopilotSessionCreateResponse(BaseModel):
    session_id: str
    provider: str
    ws_ticket: str
    ws_ticket_expires_at: datetime
    created_at: datetime


class CopilotWsTicketResponse(BaseModel):
    session_id: str
    ws_ticket: str
    ws_ticket_expires_at: datetime


class CoachingNormalizedOutput(BaseModel):
    answer_suggestion: str
    talking_points: list[str] = Field(default_factory=list)
    follow_up_strategy: list[str] = Field(default_factory=list)


class TranscriptChunkPayload(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    timestamp_ms: int | None = Field(default=None, ge=0)
    is_final: bool = False
    end_of_turn: bool = False
    confidence: float = 1.0


class TranscriptChunkEvent(BaseModel):
    event: Literal["transcript.chunk"]
    data: TranscriptChunkPayload


class TranscriptBufferPayload(BaseModel):
    text: str
    last_chunk_ms: int | None = None


class CoachingDeltaEvent(BaseModel):
    event: Literal["coaching.token"] = "coaching.token"
    data: dict[str, str]


class CoachingMetaEvent(BaseModel):
    event: Literal["coaching.meta"] = "coaching.meta"
    data: dict[str, list[str]]


class CoachingFinalPayload(BaseModel):
    answer_suggestion: str
    provider: str


class CoachingFinalEvent(BaseModel):
    event: Literal["coaching.final"] = "coaching.final"
    data: CoachingFinalPayload


class StatusEventPayload(BaseModel):
    state: str
    reason: str | None = None
    question_text: str | None = None


class ErrorEventPayload(BaseModel):
    message: str


class StreamingEventEnvelope(BaseModel):
    event: str
    data: dict[str, Any]


class MeetStreamWord(BaseModel):
    word: str
    start: float
    end: float
    confidence: float
    speaker: str
    punctuated_word: str
    speech_confidence: float


class MeetStreamWebhookPayload(BaseModel):
    bot_id: str
    speakerName: str
    timestamp: str
    transcript: str
    utterance: str = ""
    words: List[MeetStreamWord]
    is_final: bool
    end_of_turn: bool
    turn_is_formatted: bool = False
    transcription_mode: str = "raw"
    custom_attributes: dict = {}
