import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.candidate import Candidate
from models.job import Job
from schemas.ai import (
    EmailComposeRequest,
    EmailComposeResponse,
    JDGenerateRequest,
    JDGenerateResponse,
)
from models.interview import Interview
from services.ai_service import (
    check_bias,
    compose_email,
    generate_interview_debrief,
    generate_interview_questions,
    generate_job_description,
    rank_candidate,
)

router = APIRouter()

# Separator that marks the start of an AI-generated notes block.
# Used to strip previous AI notes before re-ranking so they don't
# pollute the cover-letter input fed to the model.
_AI_NOTE_SEP = "\n\n── AI Match Analysis ──────────────────────\n"


def _cover_letter_only(notes: str | None) -> str:
    """Return only the human-written part of notes (before any AI analysis block)."""
    if not notes:
        return ""
    return notes.split(_AI_NOTE_SEP)[0].strip()


def _build_ai_note(score: int, reasoning: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (
        f"{_AI_NOTE_SEP}"
        f"AI Match Score: {score}/100  ·  {ts}\n"
        f"{reasoning}\n"
        f"────────────────────────────────────────────"
    )


class InterviewQuestionsRequest(BaseModel):
    job_id: int
    force_regenerate: bool = False


class InterviewQuestion(BaseModel):
    question: str
    type: str
    guidance: str


class InterviewQuestionsResponse(BaseModel):
    job_id: int
    job_title: str
    questions: list[InterviewQuestion]
    cached: bool = False
    generated_at: Optional[str] = None


class RankCandidateRequest(BaseModel):
    candidate_id: int


class RankCandidateResponse(BaseModel):
    candidate_id: int
    score: float
    reasoning: str


@router.get("/interview-questions/{job_id}", response_model=InterviewQuestionsResponse)
async def get_interview_questions(job_id: int, db: AsyncSession = Depends(get_db)):
    """Return stored interview questions for a job without regenerating."""
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if not job.interview_questions:
        raise HTTPException(status_code=404, detail="No questions stored yet.")

    questions = [
        InterviewQuestion(
            question=q.get("question", ""),
            type=q.get("type", "general"),
            guidance=q.get("guidance", ""),
        )
        for q in job.interview_questions
    ]

    generated_at = (
        job.interview_questions_generated_at.isoformat()
        if job.interview_questions_generated_at
        else None
    )

    return InterviewQuestionsResponse(
        job_id=job.id,
        job_title=job.title,
        questions=questions,
        cached=True,
        generated_at=generated_at,
    )


@router.post("/interview-questions", response_model=InterviewQuestionsResponse)
async def interview_questions_endpoint(
    req: InterviewQuestionsRequest, db: AsyncSession = Depends(get_db)
):
    """Generate (or return cached) interview questions for a job.

    Pass ``force_regenerate=true`` to always call the AI even if questions
    are already stored.
    """
    job = await db.get(Job, req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Return cached questions unless the caller explicitly wants new ones
    if not req.force_regenerate and job.interview_questions:
        questions = [
            InterviewQuestion(
                question=q.get("question", ""),
                type=q.get("type", "general"),
                guidance=q.get("guidance", ""),
            )
            for q in job.interview_questions
        ]
        generated_at = (
            job.interview_questions_generated_at.isoformat()
            if job.interview_questions_generated_at
            else None
        )
        return InterviewQuestionsResponse(
            job_id=job.id,
            job_title=job.title,
            questions=questions,
            cached=True,
            generated_at=generated_at,
        )

    # Generate fresh questions via AI
    questions_raw = await generate_interview_questions(
        job_title=job.title,
        job_description=job.description or "",
        requirements=job.requirements or "",
        department=job.department or "",
    )

    questions = [
        InterviewQuestion(
            question=q.get("question", ""),
            type=q.get("type", "general"),
            guidance=q.get("guidance", ""),
        )
        for q in questions_raw
    ]

    # Persist to the database
    now = datetime.now(timezone.utc)
    job.interview_questions = [q.model_dump() for q in questions]
    job.interview_questions_generated_at = now
    await db.commit()

    return InterviewQuestionsResponse(
        job_id=job.id,
        job_title=job.title,
        questions=questions,
        cached=False,
        generated_at=now.isoformat(),
    )


@router.post("/generate-jd", response_model=JDGenerateResponse)
async def generate_jd(req: JDGenerateRequest):
    return await generate_job_description(req)


@router.post("/compose-email", response_model=EmailComposeResponse)
async def compose_email_endpoint(req: EmailComposeRequest):
    return await compose_email(req)


@router.post("/rank-candidate", response_model=RankCandidateResponse)
async def rank_candidate_endpoint(
    req: RankCandidateRequest, db: AsyncSession = Depends(get_db)
):
    candidate = await db.get(Candidate, req.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    if not candidate.job_id:
        raise HTTPException(
            status_code=422,
            detail="Candidate has no job assigned. Assign a job before ranking.",
        )

    job = await db.get(Job, candidate.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Associated job not found.")

    # Use only the original cover letter — strip any previous AI analysis blocks
    # so they don't skew the model's evaluation on re-ranking.
    cover_letter = _cover_letter_only(candidate.notes)

    result = await rank_candidate(
        job_description=job.description or "",
        requirements=job.requirements or "",
        resume_text=candidate.resume_text or "",
        cover_letter=cover_letter,
    )

    score = result["score"]
    reasoning = result["reasoning"]

    # Persist score
    candidate.ai_match_score = float(score)

    # Write reasoning into the Notes field, replacing any previous AI block
    # but preserving the original human-written cover letter above it.
    candidate.notes = cover_letter + _build_ai_note(score, reasoning)

    await db.commit()

    return RankCandidateResponse(
        candidate_id=candidate.id,
        score=score,
        reasoning=reasoning,
    )


# ── Talent Pool Match ──────────────────────────────────────────────────────

VETTED_STAGES = {"Interview", "Offer", "Hired"}


class TalentPoolRequest(BaseModel):
    job_id: int
    limit: int = 10


class TalentPoolMatch(BaseModel):
    candidate_id: int
    name: str
    email: str
    current_stage: str
    previous_job_title: Optional[str]
    ai_match_score: float
    reasoning: str
    tags: list
    previously_vetted: bool


class TalentPoolResponse(BaseModel):
    job_id: int
    job_title: str
    matches: list[TalentPoolMatch]


@router.post("/talent-pool-match", response_model=TalentPoolResponse)
async def talent_pool_match(
    req: TalentPoolRequest, db: AsyncSession = Depends(get_db)
):
    job = await db.get(Job, req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Fetch candidates NOT already in this job's pipeline who have resume text.
    # Prioritise previously vetted candidates (Interview / Offer / Hired in any role)
    # by loading them first so they fill the processing cap.
    stmt = (
        select(Candidate)
        .where(Candidate.resume_text.isnot(None))
        .where(Candidate.resume_text != "")
        .where(
            (Candidate.job_id != req.job_id) | (Candidate.job_id.is_(None))
        )
    )
    result = await db.execute(stmt)
    all_candidates: list[Candidate] = result.scalars().all()

    # Sort so vetted candidates come first, then cap at 50 to limit API calls
    sorted_candidates = sorted(
        all_candidates,
        key=lambda c: (0 if c.current_stage in VETTED_STAGES else 1),
    )[:50]

    if not sorted_candidates:
        return TalentPoolResponse(job_id=job.id, job_title=job.title, matches=[])

    # Score all candidates concurrently
    async def score_one(candidate: Candidate):
        try:
            res = await rank_candidate(
                job_description=job.description or "",
                requirements=job.requirements or "",
                resume_text=candidate.resume_text or "",
                cover_letter=_cover_letter_only(candidate.notes),
            )
            return (candidate, res["score"], res["reasoning"])
        except Exception:
            return (candidate, 0, "Could not score this candidate.")

    scored = await asyncio.gather(*[score_one(c) for c in sorted_candidates])

    # Sort by score descending, take top N
    scored_sorted = sorted(scored, key=lambda x: x[1], reverse=True)[: req.limit]

    # Resolve job titles for each candidate (job relationship not loaded — use cached job_id)
    # We do a lightweight lookup for job titles of the candidates' assigned jobs
    job_ids = {c.job_id for c, _, _ in scored_sorted if c.job_id and c.job_id != req.job_id}
    job_title_map: dict[int, str] = {}
    if job_ids:
        j_stmt = select(Job.id, Job.title).where(Job.id.in_(job_ids))
        j_res = await db.execute(j_stmt)
        job_title_map = {row.id: row.title for row in j_res}

    matches = [
        TalentPoolMatch(
            candidate_id=c.id,
            name=c.name,
            email=c.email,
            current_stage=c.current_stage,
            previous_job_title=job_title_map.get(c.job_id) if c.job_id else None,
            ai_match_score=float(score),
            reasoning=reasoning,
            tags=c.tags or [],
            previously_vetted=c.current_stage in VETTED_STAGES,
        )
        for c, score, reasoning in scored_sorted
    ]

    return TalentPoolResponse(job_id=job.id, job_title=job.title, matches=matches)


# ── Feature 1: Bias Auditor ────────────────────────────────────────────────

class BiasCheckRequest(BaseModel):
    text: str


class BiasFlag(BaseModel):
    phrase: str
    category: str
    reason: str
    suggestion: str


class BiasCheckResponse(BaseModel):
    is_inclusive: bool
    score: int
    summary: str
    flags: list[BiasFlag]


@router.post("/bias-check", response_model=BiasCheckResponse)
async def bias_check(req: BiasCheckRequest):
    """Scan text (JD or email) for biased or non-inclusive language."""
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="Text must not be empty.")
    result = await check_bias(req.text)
    return BiasCheckResponse(
        is_inclusive=result["is_inclusive"],
        score=result["score"],
        summary=result["summary"],
        flags=[BiasFlag(**f) for f in result["flags"]],
    )


# ── Feature 2: Ghosting Risk Score ────────────────────────────────────────


class GhostingRiskFactor(BaseModel):
    label: str
    description: str
    weight: str   # "high" | "medium" | "low"


class GhostingRiskResponse(BaseModel):
    candidate_id: int
    score: int          # 0-100 (higher = more likely to ghost)
    level: str          # "low" | "medium" | "high" | "critical"
    level_color: str
    factors: list[GhostingRiskFactor]
    days_in_stage: int
    days_since_email: Optional[int]
    touchpoints: int


@router.get("/ghosting-risk/{candidate_id}", response_model=GhostingRiskResponse)
async def ghosting_risk(candidate_id: int, db: AsyncSession = Depends(get_db)):
    """Rule-based ghosting risk score for a candidate."""
    from models.email_log import EmailLog

    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    now = datetime.now(timezone.utc)
    score = 0
    factors: list[GhostingRiskFactor] = []

    # Factor 1: Days in current stage
    stage_since = candidate.updated_at or candidate.applied_at
    if stage_since.tzinfo is None:
        stage_since = stage_since.replace(tzinfo=timezone.utc)
    days_in_stage = (now - stage_since).days

    if days_in_stage > 21:
        score += 35
        factors.append(GhostingRiskFactor(
            label="Stale in stage",
            description=f"Candidate has been in '{candidate.current_stage}' for {days_in_stage} days.",
            weight="high",
        ))
    elif days_in_stage > 10:
        score += 20
        factors.append(GhostingRiskFactor(
            label="Slowing down",
            description=f"{days_in_stage} days in current stage — engagement may be cooling.",
            weight="medium",
        ))

    # Factor 2: Days since last email
    email_result = await db.execute(
        select(EmailLog.sent_at)
        .where(EmailLog.candidate_id == candidate_id)
        .order_by(EmailLog.sent_at.desc())
        .limit(1)
    )
    last_email_row = email_result.scalar_one_or_none()
    days_since_email: Optional[int] = None
    if last_email_row:
        sent = last_email_row if last_email_row.tzinfo else last_email_row.replace(tzinfo=timezone.utc)
        days_since_email = (now - sent).days
        if days_since_email > 14:
            score += 30
            factors.append(GhostingRiskFactor(
                label="No recent contact",
                description=f"Last email was {days_since_email} days ago — candidate may lose interest.",
                weight="high",
            ))
        elif days_since_email > 7:
            score += 15
            factors.append(GhostingRiskFactor(
                label="Contact gap",
                description=f"No email in {days_since_email} days.",
                weight="medium",
            ))
    else:
        score += 20
        factors.append(GhostingRiskFactor(
            label="Never contacted",
            description="No outreach emails have been sent to this candidate.",
            weight="high",
        ))

    # Factor 3: Total touchpoints
    touchpoint_result = await db.execute(
        select(func.count(EmailLog.id)).where(EmailLog.candidate_id == candidate_id)
    )
    touchpoints = touchpoint_result.scalar_one() or 0
    if touchpoints == 0:
        score += 15
    elif touchpoints == 1:
        score += 5

    # Factor 4: Interview stage with no upcoming interview
    if candidate.current_stage == "Interview":
        interview_result = await db.execute(
            select(func.count(Interview.id))
            .where(Interview.candidate_id == candidate_id)
            .where(Interview.scheduled_at >= now)
            .where(Interview.status == "scheduled")
        )
        upcoming = interview_result.scalar_one() or 0
        if upcoming == 0:
            score += 20
            factors.append(GhostingRiskFactor(
                label="No upcoming interview",
                description="Candidate is in Interview stage but no interview is scheduled.",
                weight="high",
            ))

    # Factor 5: Rejected/Hired — no ghosting risk
    if candidate.current_stage in ("Hired", "Rejected"):
        score = 0
        factors = []

    score = max(0, min(100, score))
    if score >= 70:
        level, color = "critical", "#dc2626"
    elif score >= 45:
        level, color = "high",     "#f97316"
    elif score >= 20:
        level, color = "medium",   "#f59e0b"
    else:
        level, color = "low",      "#16a34a"

    return GhostingRiskResponse(
        candidate_id=candidate_id,
        score=score,
        level=level,
        level_color=color,
        factors=factors,
        days_in_stage=days_in_stage,
        days_since_email=days_since_email,
        touchpoints=touchpoints,
    )


# ── Feature 3: AI Interview Debrief ───────────────────────────────────────

class DebriefRequest(BaseModel):
    interview_id: int
    transcript: Optional[str] = None   # optional paste-in interview transcript


class DebriefResponse(BaseModel):
    interview_id: int
    candidate_name: str
    job_title: str
    verdict: str
    verdict_label: str
    confidence: int
    summary: str
    strengths: list[str]
    concerns: list[str]
    recommendation: str
    highlight_quote: str


@router.post("/interview-debrief", response_model=DebriefResponse)
async def interview_debrief(req: DebriefRequest, db: AsyncSession = Depends(get_db)):
    """Generate a structured AI debrief for a completed interview."""

    # Load interview with candidate + job
    result = await db.execute(
        select(Interview)
        .options(selectinload(Interview.candidate), selectinload(Interview.scorecard))
        .where(Interview.id == req.interview_id)
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found.")

    candidate = interview.candidate
    job = await db.get(Job, interview.job_id)

    scorecard_data = None
    if interview.scorecard:
        sc = interview.scorecard
        scorecard_data = {
            "technical":       sc.technical,
            "communication":   sc.communication,
            "culture_fit":     sc.culture_fit,
            "problem_solving": sc.problem_solving,
            "overall_rating":  sc.overall_rating,
            "recommendation":  sc.recommendation,
            "strengths":       sc.strengths,
            "concerns":        sc.concerns,
            "notes":           sc.notes,
        }

    # Prefer provided transcript; fall back to stored interview notes
    notes_input = req.transcript.strip() if req.transcript and req.transcript.strip() else (interview.notes or "")

    debrief = await generate_interview_debrief(
        candidate_name=candidate.name if candidate else "Unknown",
        job_title=job.title if job else "Unknown",
        interview_type=interview.interview_type or "general",
        interviewer_name=interview.interviewer_name,
        interview_notes=notes_input,
        scorecard=scorecard_data,
    )

    return DebriefResponse(
        interview_id=req.interview_id,
        candidate_name=candidate.name if candidate else "Unknown",
        job_title=job.title if job else "Unknown",
        **debrief,
    )
