from pydantic import BaseModel
from typing import List, Optional


class JDGenerateRequest(BaseModel):
    title: str
    department: Optional[str] = ""
    requirements: str
    tone: str = "professional"          # professional | casual | startup
    location: Optional[str] = ""
    job_type: Optional[str] = ""


class JDGenerateResponse(BaseModel):
    description: str
    responsibilities: List[str]
    qualifications: List[str]
    nice_to_haves: List[str]
    benefits: List[str]


class EmailComposeRequest(BaseModel):
    candidate_name: str
    candidate_email: str
    job_title: str
    current_stage: str
    intent: str          # outreach | follow_up | interview_invite | rejection | offer
    additional_context: Optional[str] = ""


class EmailComposeResponse(BaseModel):
    subject: str
    body: str
