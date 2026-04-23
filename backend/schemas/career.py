import re
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


class JobPublicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    created_at: datetime


class ApplicationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, strip_whitespace=True)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    cover_letter: Optional[str] = Field(default=None, max_length=5_000)
    linkedin_url: Optional[str] = Field(default=None, max_length=300)
    resume_url: Optional[str] = Field(default=None, max_length=500)
    resume_text: Optional[str] = Field(default=None, max_length=200_000)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not re.match(r"^[\+\d\s\-\(\)]{6,30}$", v):
            raise ValueError("Phone number contains invalid characters.")
        return v

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if v and not v.startswith(("https://", "http://")):
            raise ValueError("LinkedIn URL must start with https://")
        return v

    @field_validator("name")
    @classmethod
    def no_html_in_name(cls, v: str) -> str:
        if re.search(r"[<>\"']", v):
            raise ValueError("Name contains invalid characters.")
        return v


class ApplicationResponse(BaseModel):
    message: str
    candidate_id: int
