from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    job_id: Optional[int] = None
    candidate_id: Optional[int] = None
    interview_context: Optional[dict[str, Any]] = None


class SessionResponse(BaseModel):
    session_id: str
    ws_ticket: str
    expires_at: datetime


class CoachingRequest(BaseModel):
    transcript: str
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    candidate_resume: Optional[str] = None
    context: Optional[dict[str, Any]] = None


class CoachingSuggestion(BaseModel):
    answer_suggestion: str
    talking_points: list[str] = Field(default_factory=list)
    follow_up_strategy: Optional[str] = None
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.0)


class CoachingResponse(BaseModel):
    suggestion: CoachingSuggestion
    provider: str
    model: str
    latency_ms: int


class TranscriptChunk(BaseModel):
    text: str
    speaker_label: Optional[str] = None
    timestamp_ms: Optional[int] = None
    is_final: bool = True


class WSEventBase(BaseModel):
    event_type: str
    session_id: str
    sequence_id: int


class WSTranscriptEvent(WSEventBase):
    event_type: str = "transcript"
    chunk: TranscriptChunk
    buffer_text: str


class WSCoachingDeltaEvent(WSEventBase):
    event_type: str = "coaching_delta"
    token: str


class WSCoachingCompleteEvent(WSEventBase):
    event_type: str = "coaching_complete"
    suggestion: CoachingSuggestion
    provider: str
    model: str


class WSErrorEvent(WSEventBase):
    event_type: str = "error"
    error_code: str
    message: str


class WSSessionEndEvent(WSEventBase):
    event_type: str = "session_end"
    reason: str


class MeetStreamTranscriptPayload(BaseModel):
    session_id: str
    transcript: list[dict[str, Any]]
    speaker_labels: Optional[dict[str, str]] = None
    is_final: bool = True


class MeetStreamSessionEvent(BaseModel):
    event_type: str
    session_id: str
    meeting_url: Optional[str] = None
    status: Optional[str] = None
    timestamp: Optional[datetime] = None