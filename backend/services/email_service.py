"""
Email service — logs every send to the database.
If SMTP credentials are present in config, also attempts real delivery.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.activity import Activity
from models.email_log import EmailLog


async def send_email(
    db: AsyncSession,
    *,
    candidate_id: int,
    candidate_name: str,
    candidate_email: str,
    subject: str,
    body: str,
    template_id: int | None = None,
    job_id: int | None = None,
) -> bool:
    """
    Log the email and optionally deliver via SMTP.
    Returns True if the email was logged as 'sent', False if 'failed'.
    """
    smtp_ok = True
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            _smtp_send(to_email=candidate_email, subject=subject, body=body)
        except Exception:
            smtp_ok = False

    status = "sent" if smtp_ok else "failed"

    log = EmailLog(
        candidate_id=candidate_id,
        template_id=template_id,
        subject=subject,
        body=body,
        status=status,
    )
    db.add(log)

    activity = Activity(
        candidate_id=candidate_id,
        job_id=job_id,
        activity_type="email_sent",
        content=f"Email sent to {candidate_name}: {subject}",
    )
    db.add(activity)

    return smtp_ok


def _smtp_send(*, to_email: str, subject: str, body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.SMTP_USER
    msg["To"]      = to_email
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT or 587) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())


def render_template(template_str: str, candidate_name: str, job_title: str) -> str:
    """Replace {{candidate_name}} and {{job_title}} placeholders."""
    return (
        template_str
        .replace("{{candidate_name}}", candidate_name)
        .replace("{{job_title}}", job_title or "the position")
    )
