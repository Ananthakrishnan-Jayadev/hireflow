from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database import get_db
from models.activity import Activity
from models.interview import Interview
from models.scorecard import Scorecard
from schemas.interview import (
    InterviewCreate,
    InterviewResponse,
    InterviewUpdate,
    ScorecardSummary,
)
from schemas.scorecard import ScorecardCreate, ScorecardResponse

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────

def _sc_summary(sc: Scorecard | None) -> ScorecardSummary | None:
    if sc is None:
        return None
    return ScorecardSummary(
        id=sc.id,
        technical=sc.technical,
        communication=sc.communication,
        culture_fit=sc.culture_fit,
        problem_solving=sc.problem_solving,
        overall_rating=sc.overall_rating,
        recommendation=sc.recommendation,
        strengths=sc.strengths,
        concerns=sc.concerns,
        notes=sc.notes,
        submitted_at=sc.submitted_at,
    )


def _to_response(iv: Interview) -> InterviewResponse:
    return InterviewResponse(
        id=iv.id,
        candidate_id=iv.candidate_id,
        job_id=iv.job_id,
        interviewer_name=iv.interviewer_name,
        interview_type=iv.interview_type,
        scheduled_at=iv.scheduled_at,
        duration_min=iv.duration_min,
        status=iv.status,
        location=iv.location,
        notes=iv.notes,
        created_at=iv.created_at,
        candidate_name=iv.candidate.name if iv.candidate else None,
        job_title=iv.job.title if iv.job else None,
        scorecard=_sc_summary(iv.scorecard),
    )


def _full_load():
    return [
        joinedload(Interview.candidate),
        joinedload(Interview.job),
        joinedload(Interview.scorecard),
    ]


# ── list ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[InterviewResponse])
async def list_interviews(
    candidate_id: Optional[int] = Query(None),
    job_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Interview).options(*_full_load())
    if candidate_id is not None:
        stmt = stmt.where(Interview.candidate_id == candidate_id)
    if job_id is not None:
        stmt = stmt.where(Interview.job_id == job_id)
    if status:
        stmt = stmt.where(Interview.status == status)
    if date_from:
        stmt = stmt.where(Interview.scheduled_at >= date_from)
    if date_to:
        stmt = stmt.where(Interview.scheduled_at <= date_to)
    stmt = stmt.order_by(Interview.scheduled_at.asc())
    interviews = list((await db.execute(stmt)).unique().scalars().all())
    return [_to_response(iv) for iv in interviews]


# ── get single ────────────────────────────────────────────────────────

@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(interview_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Interview)
        .where(Interview.id == interview_id)
        .options(*_full_load())
    )
    iv = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    return _to_response(iv)


# ── create ────────────────────────────────────────────────────────────

@router.post("", response_model=InterviewResponse, status_code=201)
async def create_interview(data: InterviewCreate, db: AsyncSession = Depends(get_db)):
    interview = Interview(**data.model_dump())
    db.add(interview)
    await db.flush()

    # Reload with relationships for activity content and response
    stmt = select(Interview).where(Interview.id == interview.id).options(*_full_load())
    interview = (await db.execute(stmt)).unique().scalar_one()

    activity = Activity(
        candidate_id=interview.candidate_id,
        job_id=interview.job_id,
        activity_type="interview_scheduled",
        content=(
            f"Interview scheduled with {interview.interviewer_name}"
            f" for {interview.candidate.name if interview.candidate else 'candidate'}"
        ),
    )
    db.add(activity)
    await db.commit()

    # Final reload after commit
    stmt = select(Interview).where(Interview.id == interview.id).options(*_full_load())
    interview = (await db.execute(stmt)).unique().scalar_one()
    return _to_response(interview)


# ── update ────────────────────────────────────────────────────────────

@router.put("/{interview_id}", response_model=InterviewResponse)
async def update_interview(
    interview_id: int, data: InterviewUpdate, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Interview)
        .where(Interview.id == interview_id)
        .options(*_full_load())
    )
    iv = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")

    old_status = iv.status
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(iv, field, value)

    # Log activity if interview marked completed
    if "status" in updates and updates["status"] == "completed" and old_status != "completed":
        activity = Activity(
            candidate_id=iv.candidate_id,
            job_id=iv.job_id,
            activity_type="interview_completed",
            content=f"Interview with {iv.interviewer_name} marked as completed",
        )
        db.add(activity)

    await db.commit()

    stmt = select(Interview).where(Interview.id == interview_id).options(*_full_load())
    iv = (await db.execute(stmt)).unique().scalar_one()
    return _to_response(iv)


# ── delete ────────────────────────────────────────────────────────────

@router.delete("/{interview_id}", status_code=204)
async def delete_interview(interview_id: int, db: AsyncSession = Depends(get_db)):
    iv = await db.get(Interview, interview_id)
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    await db.delete(iv)
    await db.commit()


# ── scorecard: get ────────────────────────────────────────────────────

@router.get("/{interview_id}/scorecard", response_model=ScorecardResponse)
async def get_scorecard(interview_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Interview)
        .where(Interview.id == interview_id)
        .options(joinedload(Interview.scorecard))
    )
    iv = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    if not iv.scorecard:
        raise HTTPException(status_code=404, detail="No scorecard submitted yet")
    sc = iv.scorecard
    return ScorecardResponse(
        id=sc.id, interview_id=sc.interview_id,
        technical=sc.technical, communication=sc.communication,
        culture_fit=sc.culture_fit, problem_solving=sc.problem_solving,
        overall_rating=sc.overall_rating, recommendation=sc.recommendation,
        strengths=sc.strengths, concerns=sc.concerns, notes=sc.notes,
        submitted_at=sc.submitted_at,
    )


# ── scorecard: submit ─────────────────────────────────────────────────

@router.post("/{interview_id}/scorecard", response_model=ScorecardResponse, status_code=201)
async def submit_scorecard(
    interview_id: int, data: ScorecardCreate, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Interview)
        .where(Interview.id == interview_id)
        .options(joinedload(Interview.candidate), joinedload(Interview.scorecard))
    )
    iv = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found")
    if iv.scorecard:
        raise HTTPException(status_code=409, detail="Scorecard already submitted for this interview.")

    sc = Scorecard(interview_id=interview_id, **data.model_dump())
    db.add(sc)
    await db.flush()

    # Mark interview completed and log activity
    iv.status = "completed"
    activity = Activity(
        candidate_id=iv.candidate_id,
        job_id=iv.job_id,
        activity_type="scorecard_submitted",
        content=(
            f"Scorecard submitted by {iv.interviewer_name}"
            f" for {iv.candidate.name if iv.candidate else 'candidate'}"
        ),
    )
    db.add(activity)
    await db.commit()
    await db.refresh(sc)

    return ScorecardResponse(
        id=sc.id, interview_id=sc.interview_id,
        technical=sc.technical, communication=sc.communication,
        culture_fit=sc.culture_fit, problem_solving=sc.problem_solving,
        overall_rating=sc.overall_rating, recommendation=sc.recommendation,
        strengths=sc.strengths, concerns=sc.concerns, notes=sc.notes,
        submitted_at=sc.submitted_at,
    )
