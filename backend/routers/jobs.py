from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.activity import Activity
from models.candidate import Candidate
from models.job import Job
from schemas.job import JobCreate, JobDetailResponse, JobListResponse, JobResponse, JobUpdate

router = APIRouter()


def _build_response(job: Job, candidate_count: int = 0, stage_counts: dict | None = None) -> dict:
    return {
        "id": job.id,
        "title": job.title,
        "department": job.department,
        "location": job.location,
        "job_type": job.job_type,
        "description": job.description,
        "requirements": job.requirements,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "status": job.status,
        "pipeline_stages": job.pipeline_stages or ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"],
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "candidate_count": candidate_count,
        **({"stage_counts": stage_counts or {}} if stage_counts is not None else {}),
    }


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Job)

    if status:
        stmt = stmt.where(Job.status == status)
    if department:
        stmt = stmt.where(Job.department == department)
    if search:
        stmt = stmt.where(
            or_(
                Job.title.ilike(f"%{search}%"),
                Job.department.ilike(f"%{search}%"),
                Job.location.ilike(f"%{search}%"),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()

    # Paginated results
    stmt = stmt.order_by(Job.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    jobs = list((await db.execute(stmt)).scalars().all())

    # Bulk candidate counts for all jobs on this page
    job_ids = [j.id for j in jobs]
    counts: dict[int, int] = {}
    if job_ids:
        count_query = (
            select(Candidate.job_id, func.count(Candidate.id).label("cnt"))
            .where(Candidate.job_id.in_(job_ids))
            .group_by(Candidate.job_id)
        )
        for row in (await db.execute(count_query)).all():
            counts[row.job_id] = row.cnt

    items = [JobResponse(**_build_response(j, counts.get(j.id, 0))) for j in jobs]

    return JobListResponse(
        items=items,
        total=total,
        page=page,
        pages=max(1, (total + per_page - 1) // per_page),
    )


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(data: JobCreate, db: AsyncSession = Depends(get_db)):
    job = Job(**data.model_dump())
    db.add(job)
    await db.flush()

    activity = Activity(
        job_id=job.id,
        activity_type="job_created",
        content=f"Job '{job.title}' was created",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(job)

    return JobResponse(**_build_response(job, 0))


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Stage counts
    stage_rows = (
        await db.execute(
            select(Candidate.current_stage, func.count(Candidate.id).label("cnt"))
            .where(Candidate.job_id == job_id)
            .group_by(Candidate.current_stage)
        )
    ).all()
    stage_counts = {row.current_stage: row.cnt for row in stage_rows}
    total_candidates = sum(stage_counts.values())

    return JobDetailResponse(**_build_response(job, total_candidates, stage_counts))


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(job_id: int, data: JobUpdate, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    was_open = job.status == "open"
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(job, field, value)

    job.updated_at = datetime.now(timezone.utc)

    # Log job_closed activity when status changes to closed
    if "status" in updates and updates["status"] in ("closed", "archived") and was_open:
        activity = Activity(
            job_id=job.id,
            activity_type="job_closed",
            content=f"Job '{job.title}' was {updates['status']}",
        )
        db.add(activity)

    # Count candidates for response
    cnt = (
        await db.execute(
            select(func.count(Candidate.id)).where(Candidate.job_id == job_id)
        )
    ).scalar_one()

    await db.commit()
    await db.refresh(job)

    return JobResponse(**_build_response(job, cnt))


@router.delete("/{job_id}", status_code=204)
async def delete_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = "archived"
    job.updated_at = datetime.now(timezone.utc)

    activity = Activity(
        job_id=job.id,
        activity_type="job_closed",
        content=f"Job '{job.title}' was archived",
    )
    db.add(activity)
    await db.commit()
