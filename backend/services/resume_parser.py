"""
resume_parser.py — Extract plain text from uploaded resume files.
Supports PDF (via pypdf) and DOCX (via python-docx).
"""
import io
from pathlib import Path


def extract_text(file_path: str | Path) -> str:
    """
    Extract plain text from a PDF or DOCX file.
    Returns an empty string if extraction fails or the file type is unsupported.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    try:
        if suffix == ".pdf":
            return _extract_pdf(path)
        elif suffix in (".docx", ".doc"):
            return _extract_docx(path)
        else:
            return ""
    except Exception:
        return ""


def _extract_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text.strip())
    return "\n".join(parts)


def _extract_docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    parts = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
    return "\n".join(parts)
