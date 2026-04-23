from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class ScorecardCreate(BaseModel):
    technical: Optional[int] = None       # 1-5
    communication: Optional[int] = None   # 1-5
    culture_fit: Optional[int] = None     # 1-5
    problem_solving: Optional[int] = None # 1-5
    overall_rating: Optional[int] = None  # 1-5
    recommendation: Optional[str] = None  # strong_yes | yes | neutral | no | strong_no
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    notes: Optional[str] = None


class ScorecardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    interview_id: int
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
