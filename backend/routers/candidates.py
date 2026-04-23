from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from database import get_db
from models.activity import Activity
from models.candidate import Candidate
from models.interview import Interview
from models.job import Job
from schemas.candidate import (
    ActivityItem,
    CandidateCreate,
    CandidateDetailResponse,
    CandidateListResponse,
    CandidateResponse,
    CandidateUpdate,
    EmailLogSummary,
    InterviewSummary,
)

router = APIRouter()


def _to_response(candidate: Candidate, job_title: str | None = None) -> CandidateResponse:
    return CandidateResponse(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        resume_url=candidate.resume_url,
        resume_text=candidate.resume_text,
        ai_match_score=candidate.ai_match_score,
        source=candidate.source,
        job_id=candidate.job_id,
        job_title=job_title,
        current_stage=candidate.current_stage,
        rating=candidate.rating,
        tags=candidate.tags or [],
        notes=candidate.notes,
        applied_at=candidate.applied_at,
        updated_at=candidate.updated_at,
    )


@router.get("", response_model=CandidateListResponse)
async def list_candidates(
    job_id: Optional[int] = Query(None),
    stage: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    rating_min: Optional[int] = Query(None, ge=0, le=5),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Candidate).options(joinedload(Candidate.job))

    if job_id is not None:
        stmt = stmt.where(Candidate.job_id == job_id)
    if stage:
        stmt = stmt.where(Candidate.current_stage == stage)
    if source:
        stmt = stmt.where(Candidate.source == source)
    if search:
        stmt = stmt.where(
            or_(
                Candidate.name.ilike(f"%{search}%"),
                Candidate.email.ilike(f"%{search}%"),
            )
        )
    if rating_min is not None:
        stmt = stmt.where(Candidate.rating >= rating_min)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Candidate.applied_at.desc()).offset((page - 1) * per_page).limit(per_page)
    candidates = list((await db.execute(stmt)).unique().scalars().all())

    items = [_to_response(c, c.job.title if c.job else None) for c in candidates]

    return CandidateListResponse(
        items=items,
        total=total,
        page=page,
        pages=max(1, (total + per_page - 1) // per_page),
    )


@router.post("", response_model=CandidateResponse, status_code=201)
async def create_candidate(data: CandidateCreate, db: AsyncSession = Depends(get_db)):
    # Check for duplicate email
    existing = (await db.execute(select(Candidate).where(Candidate.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="A candidate with this email already exists.")

    candidate = Candidate(**data.model_dump())
    db.add(candidate)
    await db.flush()

    job_title: str | None = None
    if candidate.job_id:
        job = await db.get(Job, candidate.job_id)
        job_title = job.title if job else None

    activity = Activity(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        activity_type="candidate_applied",
        content=f"{candidate.name} applied{f' for {job_title}' if job_title else ''}",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(candidate)

    return _to_response(candidate, job_title)


@router.get("/{candidate_id}", response_model=CandidateDetailResponse)
async def get_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Candidate)
        .where(Candidate.id == candidate_id)
        .options(
            joinedload(Candidate.job),
            selectinload(Candidate.interviews).selectinload(Interview.scorecard),
            selectinload(Candidate.email_logs),
            selectinload(Candidate.activities),
        )
    )
    candidate = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_title = candidate.job.title if candidate.job else None

    interviews = [
        InterviewSummary(
            id=iv.id,
            interviewer_name=iv.interviewer_name,
            interview_type=iv.interview_type,
            scheduled_at=iv.scheduled_at,
            duration_min=iv.duration_min,
            status=iv.status,
            location=iv.location,
            notes=iv.notes,
            has_scorecard=iv.scorecard is not None,
        )
        for iv in sorted(candidate.interviews, key=lambda x: x.scheduled_at, reverse=True)
    ]

    email_logs = [
        EmailLogSummary(
            id=el.id,
            subject=el.subject,
            body=el.body,
            status=el.status,
            sent_at=el.sent_at,
            template_id=el.template_id,
        )
        for el in sorted(candidate.email_logs, key=lambda x: x.sent_at, reverse=True)
    ]

    activities = [
        ActivityItem(
            id=act.id,
            activity_type=act.activity_type,
            content=act.content,
            metadata_=act.metadata_,
            created_at=act.created_at,
        )
        for act in sorted(candidate.activities, key=lambda x: x.created_at, reverse=True)
    ]

    return CandidateDetailResponse(
        **_to_response(candidate, job_title).model_dump(),
        interviews=interviews,
        email_logs=email_logs,
        activities=activities,
    )


@router.put("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(candidate_id: int, data: CandidateUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Candidate).where(Candidate.id == candidate_id).options(joinedload(Candidate.job))
    candidate = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    updates = data.model_dump(exclude_unset=True)

    # Log note_added activity if notes changed
    if "notes" in updates and updates["notes"] != candidate.notes:
        activity = Activity(
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            activity_type="note_added",
            content=f"Note updated for {candidate.name}",
        )
        db.add(activity)

    for field, value in updates.items():
        setattr(candidate, field, value)

    candidate.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(candidate)

    job_title = candidate.job.title if candidate.job else None
    return _to_response(candidate, job_title)


@router.delete("/{candidate_id}", status_code=204)
async def delete_candidate(candidate_id: int, db: AsyncSession = Depends(get_db)):
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    await db.delete(candidate)
    await db.commit()
