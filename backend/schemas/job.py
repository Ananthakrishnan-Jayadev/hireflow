from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime

_VALID_STATUSES  = {"draft", "open", "closed", "archived"}
_VALID_JOB_TYPES = {"full_time", "part_time", "contract", "internship"}
_DEFAULT_STAGES  = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]


class JobCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200, strip_whitespace=True)
    department: Optional[str] = Field(default=None, max_length=100, strip_whitespace=True)
    location: Optional[str] = Field(default=None, max_length=150, strip_whitespace=True)
    job_type: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=50_000)
    requirements: Optional[str] = Field(default=None, max_length=20_000)
    salary_min: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    salary_max: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    status: str = Field(default="draft", max_length=20)
    pipeline_stages: List[str] = Field(default_factory=lambda: list(_DEFAULT_STAGES))

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in _VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v

    @field_validator("job_type")
    @classmethod
    def valid_job_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_JOB_TYPES:
            raise ValueError(f"Job type must be one of: {', '.join(sorted(_VALID_JOB_TYPES))}")
        return v

    @field_validator("pipeline_stages")
    @classmethod
    def valid_stages(cls, v: List[str]) -> List[str]:
        if not v:
            return list(_DEFAULT_STAGES)
        if len(v) > 20:
            raise ValueError("Cannot have more than 20 pipeline stages.")
        return [s.strip()[:50] for s in v if s.strip()]

    @model_validator(mode="after")
    def salary_min_le_max(self) -> "JobCreate":
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min must not exceed salary_max.")
        return self


class JobUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200, strip_whitespace=True)
    department: Optional[str] = Field(default=None, max_length=100, strip_whitespace=True)
    location: Optional[str] = Field(default=None, max_length=150, strip_whitespace=True)
    job_type: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=50_000)
    requirements: Optional[str] = Field(default=None, max_length=20_000)
    salary_min: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    salary_max: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    status: Optional[str] = Field(default=None, max_length=20)
    pipeline_stages: Optional[List[str]] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v

    @field_validator("job_type")
    @classmethod
    def valid_job_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_JOB_TYPES:
            raise ValueError(f"Job type must be one of: {', '.join(sorted(_VALID_JOB_TYPES))}")
        return v


class JobResponse(BaseModel):
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
    status: str
    pipeline_stages: List[str]
    created_at: datetime
    updated_at: Optional[datetime] = None
    candidate_count: int = 0


class JobDetailResponse(JobResponse):
    stage_counts: dict = Field(default_factory=dict)


class JobListResponse(BaseModel):
    items: List[JobResponse]
    total: int
    page: int
    pages: int
