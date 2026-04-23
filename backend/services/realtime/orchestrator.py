from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import HTTPException

from config import settings
from services.realtime.llm_router import LLMRouter
from services.realtime.session_manager import QAPair
from services.realtime.schemas import CoachingNormalizedOutput


def _trim_lines(values: list[str], limit: int = 6) -> list[str]:
    cleaned = [v.strip() for v in values if v and v.strip()]
    return cleaned[:limit]


@dataclass(slots=True)
class CoachingContext:
    question_text: str
    interview_context: str | None
    qa_history: list[QAPair]


class CoachingOrchestrator:
    def __init__(self, llm_router: LLMRouter) -> None:
        self._router = llm_router

    @staticmethod
    def _system_prompt_json() -> str:
        return """You are a live interview copilot helping a candidate answer interview questions in real time.

Use the provided interview context as the primary source of truth. Prioritize relevance to the specific question.
Do not invent specific facts that are not in the context.

Return JSON only as a single object with exactly these keys:
- answer_suggestion: string
- talking_points: array of short strings
- follow_up_strategy: array of short strings

Output rules:
- No markdown, no code fences, no extra keys, no extra text.
- Keep response concise, practical, and specific.
- answer_suggestion should sound like natural spoken language for the candidate.
- talking_points should be short and actionable.
- follow_up_strategy should help the candidate steer the conversation effectively.
"""

    @staticmethod
    def _system_prompt_stream() -> str:
        return """You are a live interview copilot.

Write only a concise suggested spoken answer for the candidate.
Use the interview context to make the answer more accurate and role-specific.
Do not invent details that are not provided.
No JSON, no markdown, no labels, no preface.
"""

    @staticmethod
    def _build_context(interview_context: str | None) -> str:
        if not interview_context:
            return "No additional interview context provided."
        return interview_context.strip()[:4000]

    @staticmethod
    def _build_qa_context_text(qa_history: list[QAPair]) -> str:
        if not qa_history:
            return ""
        lines: list[str] = []
        for pair in qa_history:
            lines.append(f"Q: {pair.question_text}")
            lines.append(f"A: {pair.answer_text}")
        return "\n".join(lines)

    def _generate_user_prompt(
        self, question_text: str, interview_context: str | None, qa_history: list[QAPair] | None = None
    ) -> str:
        qa_text = ""
        if qa_history:
            qa_text = self._build_qa_context_text(qa_history)
        qa_section = ""
        if qa_text:
            qa_section = f"""
Recent Q&A for context (avoid repeating or contradicting):
{qa_text}
"""
        return f"""Interview context (use this to ground your response):
{self._build_context(interview_context)}
{qa_section}
Interviewer question:
{question_text.strip()}

Task:
Generate a context-aware coaching response for this exact question.
Return the strict JSON object.
"""

    def _stream_user_prompt(
        self, question_text: str, interview_context: str | None, qa_history: list[QAPair] | None = None
    ) -> str:
        qa_text = ""
        if qa_history:
            qa_text = self._build_qa_context_text(qa_history)
        qa_section = ""
        if qa_text:
            qa_section = f"""
Recent Q&A for context (avoid repeating or contradicting):
{qa_text}
"""
        return f"""Interview context (use this to ground your response):
{self._build_context(interview_context)}
{qa_section}
Interviewer question:
{question_text.strip()}

Task:
Write only the suggested spoken answer for the candidate.
"""

    def _meta_user_prompt(
        self, question_text: str, interview_context: str | None, answer_text: str, qa_history: list[QAPair] | None = None
    ) -> str:
        qa_text = ""
        if qa_history:
            qa_text = self._build_qa_context_text(qa_history)
        qa_section = ""
        if qa_text:
            qa_section = f"""
Recent Q&A for context (avoid repeating or contradicting):
{qa_text}
"""
        return f"""Interview context (use this to ground your response):
{self._build_context(interview_context)}
{qa_section}
Interviewer question:
{question_text.strip()}

Suggested answer already shown to user:
{answer_text.strip()}

Task:
Return JSON only.
Keep answer_suggestion exactly as given.
Generate concise talking_points and follow_up_strategy arrays based on this question and context.
"""

    @staticmethod
    def _normalize(output: CoachingNormalizedOutput, fallback_answer: str = "") -> CoachingNormalizedOutput:
        answer = (output.answer_suggestion or fallback_answer).strip()
        return CoachingNormalizedOutput(
            answer_suggestion=answer,
            talking_points=_trim_lines(output.talking_points),
            follow_up_strategy=_trim_lines(output.follow_up_strategy),
        )

    async def generate(
        self,
        question_text: str,
        interview_context: str | None,
        qa_history: list[QAPair] | None = None,
        provider_name: str | None = None,
    ) -> tuple[str, CoachingNormalizedOutput]:
        resolved_name, provider = self._router.get_provider(provider_name)
        try:
            output = await provider.generate_coaching(
                self._system_prompt_json(),
                self._generate_user_prompt(question_text, interview_context, qa_history),
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Copilot provider request failed.") from exc
        return resolved_name, self._normalize(output)

    async def stream(
        self,
        question_text: str,
        interview_context: str | None,
        qa_history: list[QAPair] | None = None,
        provider_name: str | None = None,
    ) -> AsyncIterator[tuple[str, dict]]:
        resolved_name, provider = self._router.get_provider(provider_name)
        answer_parts: list[str] = []

        try:
            async for delta in provider.stream_coaching(
                self._system_prompt_stream(),
                self._stream_user_prompt(question_text, interview_context, qa_history),
            ):
                if not delta:
                    continue
                answer_parts.append(delta)
                yield "coaching.token", {"delta": delta}
        except RuntimeError as exc:
            yield "error.event", {"message": str(exc)}
            return
        except Exception:
            yield "error.event", {"message": "Copilot streaming request failed."}
            return

        answer_text = "".join(answer_parts).strip()
        if not answer_text:
            try:
                _, fallback = await self.generate(question_text, interview_context, qa_history, resolved_name)
                answer_text = fallback.answer_suggestion
                if answer_text:
                    yield "coaching.token", {"delta": answer_text}
                output = fallback
            except HTTPException as exc:
                yield "error.event", {"message": str(exc.detail)}
                return
        else:
            try:
                meta = await provider.generate_coaching(
                    self._system_prompt_json(),
                    self._meta_user_prompt(question_text, interview_context, answer_text, qa_history),
                )
                output = self._normalize(meta, fallback_answer=answer_text)
            except Exception:
                output = CoachingNormalizedOutput(
                    answer_suggestion=answer_text,
                    talking_points=[],
                    follow_up_strategy=[],
                )

        yield "coaching.meta", {
            "talking_points": output.talking_points,
            "follow_up_strategy": output.follow_up_strategy,
        }
        yield "coaching.final", {
            "answer_suggestion": output.answer_suggestion,
            "provider": resolved_name,
        }
