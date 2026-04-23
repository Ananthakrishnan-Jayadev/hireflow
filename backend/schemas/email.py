from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime

_VALID_TEMPLATE_TYPES = {"outreach", "follow_up", "interview_invite", "rejection", "offer", "custom"}
TEMPLATE_TYPES = list(_VALID_TEMPLATE_TYPES)


class EmailTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)
    subject: str = Field(..., min_length=1, max_length=200, strip_whitespace=True)
    body: str = Field(..., min_length=1, max_length=20_000)
    template_type: Optional[str] = Field(default=None, max_length=30)

    @field_validator("template_type")
    @classmethod
    def valid_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_TEMPLATE_TYPES:
            raise ValueError(f"Template type must be one of: {', '.join(sorted(_VALID_TEMPLATE_TYPES))}")
        return v


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100, strip_whitespace=True)
    subject: Optional[str] = Field(default=None, max_length=200, strip_whitespace=True)
    body: Optional[str] = Field(default=None, max_length=20_000)
    template_type: Optional[str] = Field(default=None, max_length=30)

    @field_validator("template_type")
    @classmethod
    def valid_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_TEMPLATE_TYPES:
            raise ValueError(f"Template type must be one of: {', '.join(sorted(_VALID_TEMPLATE_TYPES))}")
        return v


class EmailTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    subject: str
    body: str
    template_type: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class EmailSendRequest(BaseModel):
    candidate_ids: List[int] = Field(..., min_length=1, max_length=500)
    template_id: Optional[int] = None
    subject: str = Field(..., min_length=1, max_length=200, strip_whitespace=True)
    body: str = Field(..., min_length=1, max_length=20_000)


class EmailSendResponse(BaseModel):
    sent: int
    failed: int


class EmailLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: Optional[int] = None
    candidate_name: Optional[str] = None
    template_id: Optional[int] = None
    subject: str
    body: str
    status: str
    sent_at: datetime
