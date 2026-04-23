from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.analytics import (
    JobStat,
    OverviewStats,
    RecentActivityItem,
    SourceCount,
    StageCount,
    WeeklyCount,
)
from services import analytics_service

router = APIRouter()


@router.get("/overview", response_model=OverviewStats)
async def get_overview(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_overview(db)


@router.get("/pipeline", response_model=list[StageCount])
async def get_pipeline(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_stage_counts(db)


@router.get("/by-source", response_model=list[SourceCount])
async def get_by_source(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_source_counts(db)


@router.get("/candidates-over-time", response_model=list[WeeklyCount])
async def get_over_time(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_candidates_over_time(db)


@router.get("/by-job", response_model=list[JobStat])
async def get_by_job(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_top_jobs(db)


@router.get("/recent-activity", response_model=list[RecentActivityItem])
async def get_activity(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_recent_activity(db)
