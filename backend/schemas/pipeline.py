from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CandidatePipelineItem(BaseModel):
    id: int
    name: str
    email: str
    source: Optional[str] = None
    rating: int
    tags: List[str]
    applied_at: datetime
    current_stage: str


class PipelineStageResponse(BaseModel):
    name: str
    candidates: List[CandidatePipelineItem]


class PipelineResponse(BaseModel):
    job_id: int
    job_title: str
    stages: List[PipelineStageResponse]


class StageMoveRequest(BaseModel):
    candidate_id: int
    new_stage: str
