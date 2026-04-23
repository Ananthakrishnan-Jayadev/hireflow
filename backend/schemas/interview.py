from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from datetime import datetime

_VALID_INTERVIEW_TYPES = {"phone_screen", "technical", "behavioral", "culture_fit", "onsite", "final"}
_VALID_STATUSES        = {"scheduled", "completed", "cancelled", "no_show"}


class ScorecardSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technical: Optional[int] = None
    communication: Optional[int] = None
    culture_fit: Optional[int] = None
    problem_solving: Optional[int] = None
    overall_rating: Optional[int] = None
    recommendation: Optional[str] = None
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: datetime


class InterviewCreate(BaseModel):
    candidate_id: int
    job_id: int
    interviewer_name: str = Field(..., min_length=2, max_length=150, strip_whitespace=True)
    interview_type: Optional[str] = Field(default=None, max_length=50)
    scheduled_at: datetime
    duration_min: int = Field(default=60, ge=5, le=480)
    status: str = Field(default="scheduled", max_length=20)
    location: Optional[str] = Field(default=None, max_length=300)
    notes: Optional[str] = Field(default=None, max_length=5_000)

    @field_validator("interview_type")
    @classmethod
    def valid_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_INTERVIEW_TYPES:
            raise ValueError(f"Interview type must be one of: {', '.join(sorted(_VALID_INTERVIEW_TYPES))}")
        return v

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in _VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v


class InterviewUpdate(BaseModel):
    interviewer_name: Optional[str] = Field(default=None, max_length=150, strip_whitespace=True)
    interview_type: Optional[str] = Field(default=None, max_length=50)
    scheduled_at: Optional[datetime] = None
    duration_min: Optional[int] = Field(default=None, ge=5, le=480)
    status: Optional[str] = Field(default=None, max_length=20)
    location: Optional[str] = Field(default=None, max_length=300)
    notes: Optional[str] = Field(default=None, max_length=5_000)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v


class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    job_id: int
    interviewer_name: str
    interview_type: Optional[str] = None
    scheduled_at: datetime
    duration_min: int
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    scorecard: Optional[ScorecardSummary] = None
