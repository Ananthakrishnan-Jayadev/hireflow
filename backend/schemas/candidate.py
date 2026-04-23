import re
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime

_VALID_STAGES  = {"Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"}
_VALID_SOURCES = {"linkedin", "referral", "careers_page", "indeed", "other"}


def _clean_search(v: Optional[str]) -> Optional[str]:
    """Strip leading/trailing whitespace; return None if empty."""
    if v is None:
        return None
    v = v.strip()
    return v if v else None


class CandidateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, strip_whitespace=True)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    resume_url: Optional[str] = Field(default=None, max_length=500)
    resume_text: Optional[str] = Field(default=None, max_length=200_000)
    source: Optional[str] = Field(default=None, max_length=50)
    job_id: Optional[int] = None
    current_stage: str = Field(default="Applied", max_length=50)
    rating: int = Field(default=0, ge=0, le=5)
    tags: List[str] = Field(default_factory=list, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=10_000)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        # Allow +, digits, spaces, dashes, parentheses
        if not re.match(r"^[\+\d\s\-\(\)]{6,30}$", v):
            raise ValueError("Phone number contains invalid characters.")
        return v

    @field_validator("current_stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        if v not in _VALID_STAGES:
            raise ValueError(f"Stage must be one of: {', '.join(sorted(_VALID_STAGES))}")
        return v

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in _VALID_SOURCES:
            raise ValueError(f"Source must be one of: {', '.join(sorted(_VALID_SOURCES))}")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        return [tag.strip()[:50] for tag in v if tag.strip()][:20]


class CandidateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150, strip_whitespace=True)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    resume_url: Optional[str] = Field(default=None, max_length=500)
    resume_text: Optional[str] = Field(default=None, max_length=200_000)
    source: Optional[str] = Field(default=None, max_length=50)
    job_id: Optional[int] = None
    current_stage: Optional[str] = Field(default=None, max_length=50)
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    tags: Optional[List[str]] = None
    notes: Optional[str] = Field(default=None, max_length=10_000)

    @field_validator("current_stage")
    @classmethod
    def validate_stage(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_STAGES:
            raise ValueError(f"Stage must be one of: {', '.join(sorted(_VALID_STAGES))}")
        return v

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_SOURCES:
            raise ValueError(f"Source must be one of: {', '.join(sorted(_VALID_SOURCES))}")
        return v


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    resume_text: Optional[str] = None
    ai_match_score: Optional[float] = None
    source: Optional[str] = None
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    current_stage: str
    rating: int
    tags: List[str]
    notes: Optional[str] = None
    applied_at: datetime
    updated_at: Optional[datetime] = None


# Nested schemas for candidate detail
class InterviewSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    interviewer_name: str
    interview_type: Optional[str] = None
    scheduled_at: datetime
    duration_min: int
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None
    has_scorecard: bool = False


class EmailLogSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    body: str
    status: str
    sent_at: datetime
    template_id: Optional[int] = None


class ActivityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity_type: str
    content: str
    metadata_: Optional[dict] = None
    created_at: datetime


class CandidateDetailResponse(CandidateResponse):
    interviews: List[InterviewSummary] = []
    email_logs: List[EmailLogSummary] = []
    activities: List[ActivityItem] = []


class CandidateListResponse(BaseModel):
    items: List[CandidateResponse]
    total: int
    page: int
    pages: int
