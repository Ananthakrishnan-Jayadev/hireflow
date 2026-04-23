"""
Analytics service — aggregation queries for dashboard + analytics page.
All queries use PostgreSQL-compatible SQLAlchemy expressions.
"""
from datetime import datetime, timezone, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from models.activity import Activity
from models.candidate import Candidate
from models.email_log import EmailLog
from models.interview import Interview
from models.job import Job


async def get_overview(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_jobs = (
        await db.execute(select(func.count()).select_from(Job))
    ).scalar_one()

    open_jobs = (
        await db.execute(select(func.count()).select_from(Job).where(Job.status == "open"))
    ).scalar_one()

    total_candidates = (
        await db.execute(select(func.count()).select_from(Candidate))
    ).scalar_one()

    candidates_this_month = (
        await db.execute(
            select(func.count()).select_from(Candidate).where(Candidate.applied_at >= month_start)
        )
    ).scalar_one()

    total_interviews = (
        await db.execute(select(func.count()).select_from(Interview))
    ).scalar_one()

    upcoming_interviews = (
        await db.execute(
            select(func.count())
            .select_from(Interview)
            .where(Interview.scheduled_at >= now, Interview.status == "scheduled")
        )
    ).scalar_one()

    emails_sent_total = (
        await db.execute(select(func.count()).select_from(EmailLog))
    ).scalar_one()

    emails_sent_this_month = (
        await db.execute(
            select(func.count()).select_from(EmailLog).where(EmailLog.sent_at >= month_start)
        )
    ).scalar_one()

    hired_count = (
        await db.execute(
            select(func.count()).select_from(Candidate).where(Candidate.current_stage == "Hired")
        )
    ).scalar_one()

    conversion_rate = (
        round(hired_count / total_candidates * 100, 1) if total_candidates else 0.0
    )

    return {
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "total_candidates": total_candidates,
        "candidates_this_month": candidates_this_month,
        "total_interviews": total_interviews,
        "upcoming_interviews": upcoming_interviews,
        "emails_sent_total": emails_sent_total,
        "emails_sent_this_month": emails_sent_this_month,
        "hired_count": hired_count,
        "conversion_rate": conversion_rate,
    }


async def get_stage_counts(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(
            Candidate.current_stage,
            func.count(Candidate.id).label("count"),
        )
        .group_by(Candidate.current_stage)
        .order_by(func.count(Candidate.id).desc())
    )
    return [{"stage": row[0], "count": row[1]} for row in result.all()]


async def get_source_counts(db: AsyncSession) -> list[dict]:
    # Use raw text() to avoid asyncpg parameterising the 'Direct' literal
    # as two separate bind slots ($1, $2) in SELECT vs GROUP BY.
    from sqlalchemy import text

    result = await db.execute(
        text("""
            SELECT COALESCE(source, 'Direct') AS source,
                   COUNT(id)                  AS count
            FROM   candidates
            GROUP  BY COALESCE(source, 'Direct')
            ORDER  BY COUNT(id) DESC
        """)
    )
    return [{"source": row.source, "count": row.count} for row in result.all()]


async def get_candidates_over_time(db: AsyncSession) -> list[dict]:
    """Returns weekly application counts for the last 12 weeks.

    Uses a raw text() query because SQLAlchemy parameterises the 'week'
    literal as separate bind params ($1, $3, $4) when func.date_trunc is
    repeated in SELECT / GROUP BY / ORDER BY, which causes PostgreSQL to
    raise a GroupingError (it sees them as different expressions).
    """
    from sqlalchemy import text

    cutoff = datetime.now(timezone.utc) - timedelta(weeks=12)
    result = await db.execute(
        text("""
            SELECT date_trunc('week', applied_at) AS week,
                   COUNT(id)                      AS count
            FROM   candidates
            WHERE  applied_at >= :cutoff
            GROUP  BY date_trunc('week', applied_at)
            ORDER  BY date_trunc('week', applied_at)
        """),
        {"cutoff": cutoff},
    )
    rows = result.all()
    return [{"week": str(row.week.date()), "count": row.count} for row in rows]


async def get_top_jobs(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(
            Job.title,
            func.count(Candidate.id).label("candidate_count"),
            func.sum(
                case((Candidate.current_stage == "Hired", 1), else_=0)
            ).label("hired_count"),
        )
        .outerjoin(Candidate, Candidate.job_id == Job.id)
        .group_by(Job.id, Job.title)
        .order_by(func.count(Candidate.id).desc())
        .limit(10)
    )
    rows = result.all()
    return [
        {
            "job_title": row.title,
            "candidate_count": row.candidate_count,
            "hired_count": row.hired_count or 0,
        }
        for row in rows
    ]


async def get_recent_activity(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Activity)
        .options(joinedload(Activity.candidate))
        .order_by(Activity.created_at.desc())
        .limit(15)
    )
    activities = result.unique().scalars().all()
    return [
        {
            "id": a.id,
            "activity_type": a.activity_type,
            "content": a.content,
            "created_at": a.created_at,
            "candidate_name": a.candidate.name if a.candidate else None,
        }
        for a in activities
    ]
