from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.activity import Activity
from models.candidate import Candidate
from models.job import Job
from schemas.candidate import CandidateResponse
from schemas.pipeline import (
    CandidatePipelineItem,
    PipelineResponse,
    PipelineStageResponse,
    StageMoveRequest,
)

router = APIRouter()


@router.get("/{job_id}", response_model=PipelineResponse)
async def get_pipeline(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    stages = job.pipeline_stages or ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"]

    candidates = list(
        (
            await db.execute(
                select(Candidate)
                .where(Candidate.job_id == job_id)
                .order_by(Candidate.applied_at.asc())
            )
        ).scalars().all()
    )

    # Group candidates by stage (preserve declared stage order, collect unknowns last)
    grouped: dict[str, list[Candidate]] = {s: [] for s in stages}
    for c in candidates:
        if c.current_stage in grouped:
            grouped[c.current_stage].append(c)
        else:
            # Stage not in job's defined list — put in a catch-all
            grouped.setdefault(c.current_stage, []).append(c)

    ordered_stages = stages + [stage for stage in grouped.keys() if stage not in stages]

    return PipelineResponse(
        job_id=job.id,
        job_title=job.title,
        stages=[
            PipelineStageResponse(
                name=stage,
                candidates=[
                    CandidatePipelineItem(
                        id=c.id,
                        name=c.name,
                        email=c.email,
                        source=c.source,
                        rating=c.rating,
                        tags=c.tags or [],
                        applied_at=c.applied_at,
                        current_stage=c.current_stage,
                    )
                    for c in grouped.get(stage, [])
                ],
            )
            for stage in ordered_stages
        ],
    )


@router.put("/move", response_model=CandidateResponse)
async def move_candidate(data: StageMoveRequest, db: AsyncSession = Depends(get_db)):
    candidate = await db.get(Candidate, data.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate stage against job's pipeline
    if candidate.job_id:
        job = await db.get(Job, candidate.job_id)
        if job and data.new_stage not in (job.pipeline_stages or []):
            raise HTTPException(status_code=422, detail=f"'{data.new_stage}' is not a valid stage for this job.")

    old_stage = candidate.current_stage
    if old_stage == data.new_stage:
        # No-op: return current state
        from schemas.candidate import CandidateResponse as CR
        return CR(
            id=candidate.id, name=candidate.name, email=candidate.email,
            phone=candidate.phone, resume_url=candidate.resume_url,
            source=candidate.source, job_id=candidate.job_id,
            current_stage=candidate.current_stage, rating=candidate.rating,
            tags=candidate.tags or [], notes=candidate.notes,
            applied_at=candidate.applied_at, updated_at=candidate.updated_at,
        )

    candidate.current_stage = data.new_stage

    activity = Activity(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        activity_type="stage_change",
        content=f"{candidate.name} moved from {old_stage} to {data.new_stage}",
        metadata_={"from_stage": old_stage, "to_stage": data.new_stage},
    )
    db.add(activity)
    await db.commit()
    await db.refresh(candidate)

    from schemas.candidate import CandidateResponse as CR
    return CR(
        id=candidate.id, name=candidate.name, email=candidate.email,
        phone=candidate.phone, resume_url=candidate.resume_url,
        source=candidate.source, job_id=candidate.job_id,
        current_stage=candidate.current_stage, rating=candidate.rating,
        tags=candidate.tags or [], notes=candidate.notes,
        applied_at=candidate.applied_at, updated_at=candidate.updated_at,
    )
