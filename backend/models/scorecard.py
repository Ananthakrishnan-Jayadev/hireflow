from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from database import Base

if TYPE_CHECKING:
    from .interview import Interview


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Scorecard(Base):
    __tablename__ = "scorecards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interview_id: Mapped[int] = mapped_column(Integer, ForeignKey("interviews.id", ondelete="CASCADE"), unique=True, nullable=False)
    technical: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    communication: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    culture_fit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    problem_solving: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    overall_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    concerns: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    interview: Mapped["Interview"] = relationship("Interview", back_populates="scorecard")
