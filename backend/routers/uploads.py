"""
uploads.py — File upload endpoint.
Accepts a resume (PDF or DOCX), saves it to disk, extracts text, returns the URL.
"""
import uuid
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from config import settings
from services.resume_parser import extract_text

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class UploadResponse(BaseModel):
    url: str
    filename: str
    resume_text: str


def _safe_filename(original: str) -> str:
    """Prefix with UUID and strip unsafe characters."""
    stem = Path(original).stem
    suffix = Path(original).suffix.lower()
    safe_stem = re.sub(r"[^\w\-]", "_", stem)[:60]
    return f"{uuid.uuid4().hex}_{safe_stem}{suffix}"


def _sanitize_text(text: str) -> str:
    """Remove characters that PostgreSQL UTF-8 cannot store (e.g. null bytes from PDFs)."""
    return text.replace("\x00", "") if text else text


@router.post("/resume", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    # Validate extension
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type. Please upload a PDF or DOCX file.",
        )

    # Read content and enforce size limit
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    # Ensure upload directory exists
    upload_dir = Path(settings.UPLOAD_DIR) / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = _safe_filename(file.filename or f"resume{suffix}")
    save_path = upload_dir / filename

    save_path.write_bytes(content)

    # Extract text for AI matching
    resume_text = extract_text(save_path)

    # PostgreSQL UTF-8 rejects null bytes (\x00) that some PDF extractors emit.
    # Strip them here so the text is always safe to store.
    resume_text = _sanitize_text(resume_text)

    # URL served by FastAPI StaticFiles mounted at /uploads
    url = f"/uploads/resumes/{filename}"

    return UploadResponse(url=url, filename=filename, resume_text=resume_text)
