import json
from openai import AsyncOpenAI
from fastapi import HTTPException

from config import settings
from schemas.ai import JDGenerateRequest, JDGenerateResponse, EmailComposeRequest, EmailComposeResponse

MODEL = "gpt-5"

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def generate_job_description(req: JDGenerateRequest) -> JDGenerateResponse:
    tone = (req.tone or "professional").strip()
    system_prompt = """You are a senior technical recruiter and experienced job description writer.
                    Craft clear, inclusive, high-signal job descriptions to attract top candidates and accurately reflect day-to-day work.
                    Begin with a concise checklist (3–7 bullets) of what you will do; keep items conceptual, not implementation-level.
                    Return only valid JSON (no markdown, commentary, or trailing commas).
                    Use these exact top-level keys: description, responsibilities, qualifications, nice_to_haves, benefits.
                    Content requirements:
                    - description: Provide 2–3 short paragraphs in a single string. Summarize the team mission, expected outcomes in 3–6 months, and the role’s significance.
                    - responsibilities: Supply a list of 6–8 bullet-point strings. Each bullet must begin with a strong verb (e.g., "Design", "Build", "Own") and be specific and measurable when possible.
                    - qualifications: Supply a list of 5–7 bullet-point strings with must-have requirements. Avoid unnecessary years-of-experience unless provided.
                    - nice_to_haves: List 3–5 bullet-point strings for optional, preferred characteristics.
                    - benefits: List 4–6 bullet-point strings for general, credible benefits. Do not invent specifics unless given.
                    Stylistic guidelines:
                    - Use inclusive language and avoid gendered words or unnecessary degree requirements.
                    - Exclude filler phrases such as "rockstar," "ninja," or "fast-paced environment" unless specified.
                    - Do not reference compensation or salary.
                    - Omit any missing or "Not specified" input fields from the returned JSON without mentioning them.
                    - Each bullet should be a single sentence with no semicolons or multi-part statements.
                    Input and Error Handling:
                    - Expect input as a JSON object containing the required fields and an optional "tone" field. If "tone" is missing, default to "professional." Omit any keys with missing or "Not specified" values from the output.
                    - For bullet-list fields, if fewer than the specified minimum, include only the provided entries; do not invent extras. If too many, include only entries within the specified maximum, prioritizing the first items.
                    - All fields must use strings or lists of strings as appropriate.
                    After generating the output, perform a brief validation to confirm the JSON structure matches the specified format and that constraints have been applied. If validation fails, self-correct and return valid JSON.
                    Output Format:
                    Return valid JSON as follows:
                    {
                    "description": "<string: 2–3 short paragraphs>",
                    "responsibilities": ["<string>", ...],
                    "qualifications": ["<string>", ...],
                    "nice_to_haves": ["<string>", ...],
                    "benefits": ["<string>", ...]
                    }
                    Only include keys for which input data is provided. Do not include any field where input is missing or set to "Not specified." Each item must be a single-sentence string. No trailing commas.
                    """


    user_prompt = """
        Generate a job description based on the following inputs:
        Inputs:
        -tone:{tone}
        - title: {title}
        - department: {department}
        - location: {location}
        - employment_type: {job_type}
        - key_requirements: {requirements} (must be included verbatim—do not drop or paraphrase)
        Instructions:
        - Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.
        - Responsibilities and qualifications must be aligned with the provided key requirements.
        - When requirements are vague, use reasonable, typical assumptions for the specified title—avoid niche tools or terminology unless directly implied.
        - Use clear, modern phrasing, focusing on specific deliverables, owned systems, or stakeholder groups, rather than generic statements.
        - Output must be strictly valid JSON, with the exact fields listed and in the order provided.
        - For any missing or empty input fields, set their value to null within the JSON output (do not omit or reorder any fields).
        - After generating the JSON output, validate that all fields are present, in the correct order, and the structure matches the specification. If any issues are detected, self-correct before returning the final result.
        ## Output Format
        Return one JSON object in this exact order:
        1. "title": string or null
        2. "department": string or null
        3. "location": string or null
        4. "employment_type": string or null
        5. "key_requirements": string or null (verbatim input)
        6. "responsibilities": array of strings
        7. "qualifications": array of strings
        If any field is blank or missing, output null for that field. All fields must be present.
    """
    try:
        response = await get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid response. Please try again.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    return JDGenerateResponse(
        description=data.get("description", ""),
        responsibilities=data.get("responsibilities", []),
        qualifications=data.get("qualifications", []),
        nice_to_haves=data.get("nice_to_haves", []),
        benefits=data.get("benefits", []),
    )


async def compose_email(req: EmailComposeRequest) -> EmailComposeResponse:
    system_prompt = """You are a senior technical recruiter and an expert at writing candidate communication.
    Write concise, warm, professional emails that sound human (not overly salesy).
    Return ONLY valid JSON (no markdown, no commentary, no extra keys) with exactly:
    - subject: string
    - body: string

    Global constraints:
    - Keep the email body under 150 words.
    - Use the candidate's FIRST name only in the greeting (e.g., "Hi Maya,").
    - Use a clear CTA and next step.
    - Avoid sensitive or risky claims (no promises of outcomes, no visa/legal/compensation specifics unless explicitly provided).
    - Do not mention that you are an AI.


    Intent rules (match req.intent exactly):
    - outreach: Introduce an opportunity, 1–2 sentence value hook, ask for interest + availability.
    - follow_up: Brief check-in, reference prior message, offer an easy reply option.
    - interview_invite: Propose 2–3 time windows and request timezone + confirmation; include format (phone/video) if provided.
    - rejection: Respectful decline, brief appreciation, optional encouragement, keep it short; no detailed feedback unless provided.
    - offer: Enthusiastic congratulations, state that an official written offer/details follow; ask for a call to review.

    Formatting rules:
    - Subject: 3–8 words, specific, no ALL CAPS, no emojis unless explicitly requested.
    - Body: 2–5 short paragraphs max, each 1–2 sentences. No bullet lists unless the user explicitly requests.
    - Close with a professional sign-off (e.g., "Best,"), and a placeholder signature line: "{sender_name}".
    Validation:
    - Ensure the output is valid JSON and contains only the two required keys.
    - Ensure body word count is < 150. If over, rewrite shorter and re-check.
    """

    # Derive first name safely (handles "First Last", extra spaces, etc.)
    candidate_first_name = (req.candidate_name or "").strip().split(" ")[0].strip() or "there"

    # Optional: let callers pass sender_name in additional_context; otherwise default
    sender_name = "Recruiting Team"

    user_prompt = f"""Compose an email using the following inputs.

Candidate first name: {candidate_first_name}
Full candidate name (for reference only; do not use beyond greeting): {req.candidate_name}
Job title: {req.job_title}
Current stage: {req.current_stage}
Intent: {req.intent}
Additional context (use only if relevant; do not invent details): {req.additional_context or ""}

If scheduling is needed, ask for the candidate's timezone. If timezone is provided in context, use it.
Do not include compensation/salary unless explicitly provided in the additional context.
Return only JSON with keys "subject" and "body".
"""

    try:
        response = await get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid response. Please try again.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    return EmailComposeResponse(
        subject=data.get("subject", ""),
        body=data.get("body", ""),
    )


async def generate_interview_questions(
    job_title: str,
    job_description: str,
    requirements: str,
    department: str,
) -> list[dict]:
    system_prompt = """You are a senior technical interviewer designing a structured interview plan.

Return ONLY valid JSON (no markdown, no commentary, no extra keys, no trailing commas).
Return a JSON object with a single top-level key: "questions".

"questions" must be an array of exactly 10 objects. Each object MUST have:
- "question": string (specific to the role; avoid generic questions)
- "type": one of exactly: behavioural, technical, situational, culture
- "guidance": 1–2 sentences describing what to listen for in a strong answer (signals, depth, examples)

Constraints:
- Mix types intentionally: exactly 3 technical, 3 behavioural, 2 situational, 2 culture.
- Avoid repeating the same competency (e.g., “teamwork”) more than twice.
- Make questions measurable and grounded in the provided job context (title, department, description, requirements).
- Do not ask illegal or sensitive questions (age, family, medical, citizenship status, etc.).
- Keep each question to one sentence; guidance to max two sentences.

Validation:
- Ensure there are exactly 10 questions and the type distribution matches the required counts.
- Ensure "type" values match the allowed set exactly.
- If validation fails, self-correct and output valid JSON.
"""

    user_prompt = """Generate interview questions for this role.

Job Title: {job_title}
Department: {department}
Description:
{job_description}

Requirements:
{requirements}
""".format(
        job_title=job_title,
        department=department or "",
        job_description=job_description or "Not provided",
        requirements=requirements or "Not provided",
    )

    try:
        response = await get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw  = response.choices[0].message.content
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid response. Please try again.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    return data.get("questions", [])


async def check_bias(text: str) -> dict:
    system_prompt = """You are a DEI and inclusive-language reviewer specializing in recruiting content.

Task:
Analyze the provided text for biased, exclusionary, or non-inclusive language and overly restrictive requirements.

Return ONLY valid JSON (no markdown, no commentary, no extra keys, no trailing commas) with:
- "is_inclusive": boolean (true if text is already broadly inclusive)
- "score": integer 0–100 (100 = highly inclusive)
- "summary": one sentence overall assessment
- "flags": array of objects, each with:
  - "phrase": exact excerpt from the input text (copy verbatim)
  - "category": one of exactly: gender_coded, age_bias, ableist, exclusionary, overly_restrictive
  - "reason": why it may deter or exclude candidates (one sentence)
  - "suggestion": an inclusive replacement that preserves intent (one sentence)

Rules:
- Only flag phrases that appear in the text (do not invent).
- Prefer concrete rewrites over vague advice.
- Do NOT add legal claims; keep guidance general and practical.
- If there are no issues, return an empty "flags" array, "is_inclusive": true, and score >= 85.

Validation:
- Ensure category values match the allowed set exactly.
- Ensure "phrase" is an exact substring from the input.
- Self-correct if the output would be invalid JSON.
"""

    user_prompt = """Analyze this text for bias and inclusivity issues.

Text:
{text}
""".format(text=(text or "")[:6000])

    try:
        response = await get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid response.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    return {
        "is_inclusive": bool(data.get("is_inclusive", False)),
        "score": max(0, min(100, int(data.get("score", 50)))),
        "summary": data.get("summary", ""),
        "flags": data.get("flags", []),
    }


async def generate_interview_debrief(
    candidate_name: str,
    job_title: str,
    interview_type: str,
    interviewer_name: str,
    interview_notes: str,
    scorecard: dict | None,
) -> dict:
    scorecard_text = ""
    if scorecard:
        scorecard_text = """Scorecard ratings (1-5):
- Technical: {technical}
- Communication: {communication}
- Culture Fit: {culture_fit}
- Problem Solving: {problem_solving}
- Overall: {overall_rating}
- Recommendation: {recommendation}
- Strengths: {strengths}
- Concerns: {concerns}
""".format(
            technical=scorecard.get("technical", "N/A"),
            communication=scorecard.get("communication", "N/A"),
            culture_fit=scorecard.get("culture_fit", "N/A"),
            problem_solving=scorecard.get("problem_solving", "N/A"),
            overall_rating=scorecard.get("overall_rating", "N/A"),
            recommendation=scorecard.get("recommendation", "N/A"),
            strengths=scorecard.get("strengths", ""),
            concerns=scorecard.get("concerns", ""),
        )

    system_prompt = """You are a senior recruiting analyst producing a structured interview debrief.

Return ONLY valid JSON (no markdown, no commentary, no extra keys, no trailing commas) with:
- "verdict": one of exactly: strong_yes, yes, maybe, no, strong_no
- "verdict_label": short human-readable label (e.g., "Strong Yes")
- "confidence": integer 0–100 (confidence in the verdict based on evidence)
- "summary": 2–3 sentences, evidence-based, role-relevant
- "strengths": array of 3–5 specific, evidence-backed strengths (strings)
- "concerns": array of 0–4 specific concerns/risks (strings)
- "recommendation": 1–2 sentences describing the recruiter’s next step
- "highlight_quote": the single most compelling line or takeaway, quoted or tightly paraphrased

Rules:
- Base conclusions only on provided notes/scorecard; do not invent experiences, companies, or outcomes.
- If notes are thin or ambiguous, reduce confidence and choose a conservative verdict.
- Avoid sensitive traits (age, family, health, protected classes) even if mentioned; focus on job-related evidence.
- Keep "strengths" and "concerns" concrete (skills, behaviors, examples) rather than vague adjectives.

Validation:
- Ensure verdict is in the allowed set.
- Ensure confidence is 0–100 and arrays meet size constraints.
- Self-correct if output would be invalid JSON.
"""

    notes_label = "Interview transcript" if len(interview_notes) > 400 else "Interview notes"
    user_prompt = """Create a structured debrief from the information below.

Candidate: {candidate_name}
Role: {job_title}
Interview type: {interview_type}
Interviewer: {interviewer_name}

{scorecard_text}

{notes_label}:
{interview_notes}
""".format(
        candidate_name=candidate_name,
        job_title=job_title,
        interview_type=interview_type,
        interviewer_name=interviewer_name,
        scorecard_text=scorecard_text.strip(),
        notes_label=notes_label,
        interview_notes=interview_notes or "No notes or transcript provided.",
    )

    try:
        response = await get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid response.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    return {
        "verdict":         data.get("verdict", "maybe"),
        "verdict_label":   data.get("verdict_label", "Maybe"),
        "confidence":      max(0, min(100, int(data.get("confidence", 50)))),
        "summary":         data.get("summary", ""),
        "strengths":       data.get("strengths", []),
        "concerns":        data.get("concerns", []),
        "recommendation":  data.get("recommendation", ""),
        "highlight_quote": data.get("highlight_quote", ""),
    }


async def rank_candidate(
    job_description: str,
    requirements: str,
    resume_text: str,
    cover_letter: str,
) -> dict:
    system_prompt = """You are a senior technical recruiter evaluating candidate-job fit.

Return ONLY valid JSON (no markdown, no commentary, no extra keys, no trailing commas) with exactly:
- "score": integer 0–100 (overall match)
- "reasoning": one concise sentence explaining the score

Scoring rubric:
- 90–100: Strong match; directly meets most requirements with clear evidence.
- 70–89: Good match; meets many requirements, some gaps or weaker evidence.
- 50–69: Partial match; notable gaps or unclear evidence.
- 0–49: Weak match; major gaps or irrelevant background.

Rules:
- Base the score only on provided job description/requirements/resume/cover letter.
- Prefer evidence (projects, impact, tools, responsibilities) over buzzwords.
- If the resume is missing key requirements, score accordingly even if the cover letter claims them.
- Do not mention protected characteristics or make assumptions beyond the text.

Validation:
- Ensure score is an integer within 0–100.
- Ensure output contains only the two required keys.
"""

    user_prompt = """Evaluate candidate fit using the content below.

Job Description:
{job_description}

Requirements:
{requirements}

Candidate Resume:
{resume_text}

Cover Letter:
{cover_letter}
""".format(
        job_description=job_description or "Not provided",
        requirements=requirements or "Not provided",
        resume_text=resume_text or "Not provided",
        cover_letter=cover_letter or "Not provided",
    )

    try:
        response = await get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid response. Please try again.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    score = max(0, min(100, int(data.get("score", 0))))
    reasoning = data.get("reasoning", "")
    return {"score": score, "reasoning": reasoning}