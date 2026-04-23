from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database import get_db
from models.candidate import Candidate
from models.email_log import EmailLog
from models.email_template import EmailTemplate
from schemas.email import (
    EmailLogResponse,
    EmailSendRequest,
    EmailSendResponse,
    EmailTemplateCreate,
    EmailTemplateResponse,
    EmailTemplateUpdate,
)
from services.email_service import render_template, send_email

router = APIRouter()


# ── Templates ─────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[EmailTemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailTemplate).order_by(EmailTemplate.created_at.desc()))
    return list(result.scalars().all())


@router.post("/templates", response_model=EmailTemplateResponse, status_code=201)
async def create_template(data: EmailTemplateCreate, db: AsyncSession = Depends(get_db)):
    tmpl = EmailTemplate(**data.model_dump())
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


@router.put("/templates/{template_id}", response_model=EmailTemplateResponse)
async def update_template(
    template_id: int, data: EmailTemplateUpdate, db: AsyncSession = Depends(get_db)
):
    tmpl = await db.get(EmailTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tmpl, field, value)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    tmpl = await db.get(EmailTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tmpl)
    await db.commit()


# ── Send ──────────────────────────────────────────────────────────────

@router.post("/send", response_model=EmailSendResponse)
async def send_emails(data: EmailSendRequest, db: AsyncSession = Depends(get_db)):
    if not data.candidate_ids:
        raise HTTPException(status_code=422, detail="At least one candidate is required.")

    sent_count = 0
    failed_count = 0

    for candidate_id in data.candidate_ids:
        stmt = (
            select(Candidate)
            .where(Candidate.id == candidate_id)
            .options(joinedload(Candidate.job))
        )
        candidate = (await db.execute(stmt)).unique().scalar_one_or_none()
        if not candidate:
            failed_count += 1
            continue

        job_title = candidate.job.title if candidate.job else ""
        subject   = render_template(data.subject, candidate.name, job_title)
        body      = render_template(data.body,    candidate.name, job_title)

        ok = await send_email(
            db,
            candidate_id=candidate.id,
            candidate_name=candidate.name,
            candidate_email=candidate.email,
            subject=subject,
            body=body,
            template_id=data.template_id,
            job_id=candidate.job_id,
        )
        if ok:
            sent_count += 1
        else:
            failed_count += 1

    await db.commit()
    return EmailSendResponse(sent=sent_count, failed=failed_count)


# ── Logs ──────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[EmailLogResponse])
async def get_logs(
    candidate_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailLog).options(joinedload(EmailLog.candidate))
    if candidate_id is not None:
        stmt = stmt.where(EmailLog.candidate_id == candidate_id)
    stmt = stmt.order_by(EmailLog.sent_at.desc()).offset((page - 1) * per_page).limit(per_page)

    logs = list((await db.execute(stmt)).unique().scalars().all())
    return [
        EmailLogResponse(
            id=log.id,
            candidate_id=log.candidate_id,
            candidate_name=log.candidate.name if log.candidate else None,
            template_id=log.template_id,
            subject=log.subject,
            body=log.body,
            status=log.status,
            sent_at=log.sent_at,
        )
        for log in logs
    ]
