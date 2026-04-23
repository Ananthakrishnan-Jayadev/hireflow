"""
Public career page API — no authentication required.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.activity import Activity
from models.candidate import Candidate
from models.job import Job
from schemas.career import ApplicationCreate, ApplicationResponse, JobPublicResponse

router = APIRouter()


@router.get("/jobs", response_model=list[JobPublicResponse])
async def list_public_jobs(db: AsyncSession = Depends(get_db)):
    """Return all open jobs for the public career page."""
    result = await db.execute(
        select(Job).where(Job.status == "open").order_by(Job.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/jobs/{job_id}/apply", response_model=ApplicationResponse, status_code=201)
async def apply_for_job(
    job_id: int, data: ApplicationCreate, db: AsyncSession = Depends(get_db)
):
    """Submit an application for an open job."""
    job = await db.get(Job, job_id)
    if not job or job.status != "open":
        raise HTTPException(status_code=404, detail="Job not found or not accepting applications.")

    # Prevent duplicate application for the same email + job
    existing = (
        await db.execute(
            select(Candidate).where(
                Candidate.email == data.email,
                Candidate.job_id == job_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An application with this email already exists for this position.",
        )

    # Strip null bytes (\x00) that some PDF extractors embed — PostgreSQL UTF-8 rejects them.
    safe_resume_text = data.resume_text.replace("\x00", "") if data.resume_text else data.resume_text

    candidate = Candidate(
        name=data.name,
        email=data.email,
        phone=data.phone,
        notes=data.cover_letter,
        resume_url=data.resume_url,
        resume_text=safe_resume_text,
        job_id=job_id,
        source="careers_page",
        current_stage="Applied",
    )
    db.add(candidate)
    await db.flush()  # populate candidate.id before creating activity

    activity = Activity(
        candidate_id=candidate.id,
        job_id=job_id,
        activity_type="applied",
        content=f"{data.name} applied for {job.title} via the career page.",
    )
    db.add(activity)
    await db.commit()

    return ApplicationResponse(
        message="Application submitted successfully!",
        candidate_id=candidate.id,
    )
