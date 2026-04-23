from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OverviewStats(BaseModel):
    total_jobs: int
    open_jobs: int
    total_candidates: int
    candidates_this_month: int
    total_interviews: int
    upcoming_interviews: int
    emails_sent_total: int
    emails_sent_this_month: int
    hired_count: int
    conversion_rate: float  # hired / total_candidates * 100


class StageCount(BaseModel):
    stage: str
    count: int


class SourceCount(BaseModel):
    source: str
    count: int


class WeeklyCount(BaseModel):
    week: str   # ISO date string of the week start (YYYY-MM-DD)
    count: int


class JobStat(BaseModel):
    job_title: str
    candidate_count: int
    hired_count: int


class RecentActivityItem(BaseModel):
    id: int
    activity_type: str
    content: str
    created_at: datetime
    candidate_name: Optional[str] = None
