"""
seed.py — Populate the ShyftHatch database with realistic demo data.

Run from the backend/ directory:
    python seed.py
"""
import asyncio
from datetime import datetime, timezone, timedelta

from sqlalchemy import delete

from database import AsyncSessionLocal
from models.activity import Activity
from models.candidate import Candidate
from models.email_log import EmailLog
from models.email_template import EmailTemplate
from models.interview import Interview
from models.job import Job
from models.scorecard import Scorecard


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ago(days: int, hours: int = 0) -> datetime:
    return utcnow() - timedelta(days=days, hours=hours)


def ahead(days: int, hours: int = 0) -> datetime:
    return utcnow() + timedelta(days=days, hours=hours)


async def clear_all(db) -> None:
    for Model in [Scorecard, EmailLog, Activity, Interview, Candidate, Job, EmailTemplate]:
        await db.execute(delete(Model))
    await db.flush()


async def seed() -> None:
    async with AsyncSessionLocal() as db:

        # ── Clear ─────────────────────────────────────────────────────────
        print("Clearing existing data…")
        await clear_all(db)

        # ── Email templates ────────────────────────────────────────────────
        print("Seeding email templates…")
        t_received = EmailTemplate(
            name="Application Received",
            subject="We received your application — {{job_title}}",
            body=(
                "Hi {{candidate_name}},\n\n"
                "Thank you for applying for the {{job_title}} role at ShyftHatch. "
                "We've received your application and our team will review it shortly.\n\n"
                "We'll be in touch within 5–7 business days.\n\n"
                "Best,\nThe ShyftHatch Team"
            ),
            template_type="outreach",
        )
        t_interview = EmailTemplate(
            name="Interview Invitation",
            subject="Interview Invitation — {{job_title}}",
            body=(
                "Hi {{candidate_name}},\n\n"
                "Congratulations! We'd love to schedule an interview for the {{job_title}} position. "
                "Please reply with your availability for the next two weeks.\n\n"
                "Looking forward to speaking with you!\n\n"
                "Best,\nThe ShyftHatch Team"
            ),
            template_type="interview_invite",
        )
        t_offer = EmailTemplate(
            name="Offer Letter",
            subject="Offer of Employment — {{job_title}}",
            body=(
                "Hi {{candidate_name}},\n\n"
                "We're thrilled to extend an offer of employment for the {{job_title}} role. "
                "Please find the details attached. We hope you'll join us!\n\n"
                "Best,\nThe ShyftHatch Team"
            ),
            template_type="offer",
        )
        t_rejection = EmailTemplate(
            name="Application Update",
            subject="Your application for {{job_title}}",
            body=(
                "Hi {{candidate_name}},\n\n"
                "Thank you for taking the time to interview with us for the {{job_title}} role. "
                "After careful consideration, we've decided to move forward with other candidates.\n\n"
                "We were impressed and encourage you to apply for future openings.\n\n"
                "Best,\nThe ShyftHatch Team"
            ),
            template_type="rejection",
        )
        db.add_all([t_received, t_interview, t_offer, t_rejection])
        await db.flush()

        # ── Jobs ──────────────────────────────────────────────────────────
        print("Seeding jobs…")
        j1 = Job(
            title="Senior Backend Engineer",
            department="Engineering",
            location="Remote",
            job_type="Full-time",
            description=(
                "We're looking for a Senior Backend Engineer to lead development of our core API "
                "infrastructure. You'll work closely with product and design to ship features that "
                "delight thousands of hiring teams worldwide."
            ),
            requirements=(
                "5+ years backend experience\n"
                "Proficiency in Python, Go, or Node.js\n"
                "Experience with PostgreSQL and Redis\n"
                "Familiarity with AWS or GCP\n"
                "Strong API design and system design skills"
            ),
            salary_min=130000, salary_max=160000,
            status="open", created_at=ago(45),
        )
        j2 = Job(
            title="Product Designer",
            department="Design",
            location="New York, NY",
            job_type="Full-time",
            description=(
                "Join our design team to craft beautiful, intuitive experiences. You'll own "
                "end-to-end product design — from research and wireframes to high-fidelity "
                "prototypes and design systems."
            ),
            requirements=(
                "3+ years product design experience\n"
                "Expert-level Figma skills\n"
                "Strong portfolio demonstrating UX and UI skills\n"
                "Experience with user research and usability testing\n"
                "Ability to work cross-functionally with engineering and product"
            ),
            salary_min=95000, salary_max=130000,
            status="open", created_at=ago(38),
        )
        j3 = Job(
            title="Marketing Manager",
            department="Marketing",
            location="Chicago, IL",
            job_type="Full-time",
            description=(
                "We're hiring a Marketing Manager to drive growth across content, SEO, and demand "
                "generation channels. You'll own the marketing roadmap and partner closely with Sales."
            ),
            requirements=(
                "4+ years B2B SaaS marketing experience\n"
                "Proven track record in demand generation\n"
                "Experience with HubSpot or Marketo\n"
                "Strong writing and communication skills\n"
                "Data-driven mindset with experience in A/B testing"
            ),
            salary_min=85000, salary_max=110000,
            status="open", created_at=ago(30),
        )
        j4 = Job(
            title="Data Scientist",
            department="Data & AI",
            location="Remote",
            job_type="Full-time",
            description=(
                "As a Data Scientist at ShyftHatch, you'll build models that power AI-driven hiring "
                "recommendations, bias detection, and talent analytics for thousands of companies."
            ),
            requirements=(
                "MS or PhD in Computer Science, Statistics, or a related field\n"
                "Proficiency in Python (pandas, scikit-learn, PyTorch or TensorFlow)\n"
                "Experience with NLP and large language models\n"
                "Strong SQL skills\n"
                "Ability to communicate insights to non-technical stakeholders"
            ),
            salary_min=120000, salary_max=155000,
            status="open", created_at=ago(22),
        )
        j5 = Job(
            title="Sales Development Representative",
            department="Sales",
            location="Austin, TX",
            job_type="Full-time",
            description=(
                "Drive top-of-funnel pipeline by identifying and qualifying outbound prospects. "
                "You'll be a key part of our growing revenue team at an exciting stage of growth."
            ),
            requirements=(
                "1–2 years outbound sales experience\n"
                "Excellent verbal and written communication\n"
                "Familiarity with Salesforce or HubSpot CRM\n"
                "Self-motivated and target-driven"
            ),
            salary_min=60000, salary_max=80000,
            status="closed", created_at=ago(90),
        )
        j6 = Job(
            title="DevOps Engineer",
            department="Engineering",
            location="Remote",
            job_type="Full-time",
            description=(
                "Build and maintain our cloud infrastructure, CI/CD pipelines, and observability "
                "stack. You'll work closely with engineering to ensure reliable, scalable deployments."
            ),
            requirements=(
                "3+ years DevOps or SRE experience\n"
                "Strong Kubernetes and Docker skills\n"
                "Experience with Terraform or Pulumi\n"
                "AWS or GCP expertise\n"
                "Monitoring experience (Datadog, Grafana, or equivalent)"
            ),
            salary_min=110000, salary_max=145000,
            status="draft", created_at=ago(7),
        )
        db.add_all([j1, j2, j3, j4, j5, j6])
        await db.flush()

        # ── Candidates ────────────────────────────────────────────────────
        print("Seeding candidates…")

        # Job 1 — Senior Backend Engineer
        c1 = Candidate(
            name="Alex Chen", email="alex.chen@example.com", phone="+1 415 555 0101",
            job_id=j1.id, source="linkedin", current_stage="Hired", rating=5,
            ai_match_score=88.0,
            resume_text=(
                "Senior software engineer with 7 years of experience in Python, Go, and distributed "
                "systems. Led backend platform teams at Stripe and Airbnb. Expert in PostgreSQL, Redis, "
                "Kafka, and AWS. MS Computer Science, Stanford University."
            ),
            notes="Exceptional systems thinker with glowing references. Accepted offer at $155k.",
            tags=["python", "go", "distributed-systems", "aws"],
            applied_at=ago(42),
        )
        c2 = Candidate(
            name="Maria Santos", email="maria.santos@example.com", phone="+1 617 555 0202",
            job_id=j1.id, source="linkedin", current_stage="Interview", rating=4,
            ai_match_score=72.0,
            resume_text=(
                "Backend engineer with 6 years experience in Python and Node.js. Currently at HubSpot "
                "building microservices architecture. Strong PostgreSQL and Kubernetes background. "
                "BS Computer Science, MIT."
            ),
            notes="Solid technical background. Second round technical interview scheduled.",
            tags=["python", "node", "kubernetes", "microservices"],
            applied_at=ago(35),
        )
        c3 = Candidate(
            name="James Wright", email="james.wright@example.com", phone="+1 312 555 0303",
            job_id=j1.id, source="indeed", current_stage="Screening", rating=3,
            ai_match_score=55.0,
            resume_text=(
                "Backend developer with 4 years building REST APIs in Python and Django. "
                "MySQL and some AWS experience. Currently at a mid-size fintech startup."
            ),
            notes="Decent fundamentals but limited distributed systems depth for a senior role.",
            tags=["python", "django", "rest-api"],
            applied_at=ago(28),
        )
        c4 = Candidate(
            name="Priya Patel", email="priya.patel@example.com", phone="+1 408 555 0404",
            job_id=j1.id, source="referral", current_stage="Rejected", rating=2,
            ai_match_score=31.0,
            resume_text=(
                "Junior developer with 2 years experience in Java and Spring Boot. "
                "Limited cloud or distributed systems experience. Recently completed a bootcamp."
            ),
            notes="Not enough experience for senior level. Encouraged to reapply in 2 years.",
            tags=["java", "junior"],
            applied_at=ago(40),
        )
        c16 = Candidate(
            name="Marcus Liu", email="marcus.liu@example.com", phone="+1 310 555 1616",
            job_id=j1.id, source="linkedin", current_stage="Screening", rating=2,
            ai_match_score=44.0,
            resume_text=(
                "Software developer with 3 years experience mainly in PHP and Laravel. "
                "Some Python scripting. Limited cloud experience."
            ),
            notes="Less relevant stack. Moved to screening to assess fundamentals.",
            tags=["php", "laravel"],
            applied_at=ago(10),
        )

        # Job 2 — Product Designer
        c5 = Candidate(
            name="Sofia Garcia", email="sofia.garcia@example.com", phone="+1 646 555 0505",
            job_id=j2.id, source="linkedin", current_stage="Offer", rating=5,
            ai_match_score=91.0,
            resume_text=(
                "Senior product designer with 6 years experience. Previously at Figma and Notion. "
                "Expert in design systems, user research, and high-fidelity prototyping. "
                "Strong B2B SaaS portfolio with measurable impact."
            ),
            notes="Outstanding portfolio and culture fit. Offer extended at $125k.",
            tags=["figma", "design-systems", "ux-research", "top-candidate"],
            applied_at=ago(33),
        )
        c6 = Candidate(
            name="David Kim", email="david.kim@example.com", phone="+1 213 555 0606",
            job_id=j2.id, source="linkedin", current_stage="Interview", rating=4,
            ai_match_score=68.0,
            resume_text=(
                "Product designer with 4 years experience at fintech startups. Proficient in Figma. "
                "Led redesigns that improved conversion by 30%. Solid research and prototyping skills."
            ),
            notes="Creative thinker. Portfolio strong but less enterprise SaaS depth.",
            tags=["figma", "fintech", "prototyping"],
            applied_at=ago(25),
        )
        c7 = Candidate(
            name="Emma Thompson", email="emma.thompson@example.com", phone="+1 503 555 0707",
            job_id=j2.id, source="indeed", current_stage="Applied", rating=0,
            resume_text=(
                "UX designer with 3 years experience. Skilled in Sketch and Adobe XD, "
                "transitioning to Figma. E-commerce and mobile app focus."
            ),
            applied_at=ago(5),
        )

        # Job 3 — Marketing Manager
        c8 = Candidate(
            name="Ryan Mitchell", email="ryan.mitchell@example.com", phone="+1 512 555 0808",
            job_id=j3.id, source="linkedin", current_stage="Screening", rating=3,
            ai_match_score=62.0,
            resume_text=(
                "Marketing manager with 5 years B2B SaaS experience. HubSpot certified. "
                "Led demand gen campaigns generating $2M pipeline annually. Strong SEO and content background."
            ),
            notes="Good experience but slightly below budget expectations.",
            tags=["demand-gen", "hubspot", "content", "seo"],
            applied_at=ago(20),
        )
        c9 = Candidate(
            name="Aisha Johnson", email="aisha.johnson@example.com", phone="+1 404 555 0909",
            job_id=j3.id, source="referral", current_stage="Interview", rating=4,
            ai_match_score=79.0,
            resume_text=(
                "Head of Marketing at a B2B SaaS company with 7 years experience. "
                "Built marketing team from scratch. Managed $1.5M annual budget. "
                "Expert in demand generation, content marketing, and account-based marketing."
            ),
            notes="Referred by VP Sales. Impressive ABM background. Strong strategic thinker.",
            tags=["abm", "demand-gen", "leadership", "referral"],
            applied_at=ago(18),
        )
        c10 = Candidate(
            name="Connor Walsh", email="connor.walsh@example.com", phone="+1 617 555 1010",
            job_id=j3.id, source="careers_page", current_stage="Applied", rating=0,
            resume_text=(
                "Marketing coordinator with 2 years experience in social media and email marketing. "
                "Recent marketing graduate. Looking to grow into a management role."
            ),
            applied_at=ago(3),
        )

        # Job 4 — Data Scientist
        c11 = Candidate(
            name="Lena Mueller", email="lena.mueller@example.com", phone="+1 206 555 1111",
            job_id=j4.id, source="linkedin", current_stage="Screening", rating=3,
            ai_match_score=59.0,
            resume_text=(
                "Data scientist with 4 years experience in Python, pandas, and scikit-learn. "
                "Some NLP project work. Currently building recommendation systems at an e-commerce company. "
                "MS Statistics, University of Washington."
            ),
            notes="Good ML fundamentals but limited NLP/LLM depth for this role.",
            tags=["python", "ml", "scikit-learn", "recommendation-systems"],
            applied_at=ago(19),
        )
        c12 = Candidate(
            name="Raj Sharma", email="raj.sharma@example.com", phone="+1 510 555 1212",
            job_id=j4.id, source="indeed", current_stage="Applied", rating=0,
            resume_text=(
                "ML engineer with PhD in Computer Science from Carnegie Mellon. "
                "3 years industry experience. Research focus on NLP and transformer models. "
                "Published papers on bias detection in hiring algorithms. Excellent SQL and Python."
            ),
            applied_at=ago(2),
        )
        c13 = Candidate(
            name="Nadia Okonkwo", email="nadia.okonkwo@example.com", phone="+1 650 555 1313",
            job_id=j4.id, source="linkedin", current_stage="Interview", rating=4,
            ai_match_score=74.0,
            resume_text=(
                "Senior data scientist with 6 years experience. PhD Applied Mathematics, Columbia University. "
                "Expert in NLP and large language models. Previously at Google Brain and OpenAI. "
                "Published researcher. Strong SQL, Python, and communication skills."
            ),
            notes="Impressive research background. Excellent LLM experience. Clear communicator.",
            tags=["nlp", "llm", "phd", "research", "openai"],
            applied_at=ago(16),
        )

        # Job 5 — SDR (closed, 1 hire)
        c14 = Candidate(
            name="Tom Bradley", email="tom.bradley@example.com", phone="+1 737 555 1414",
            job_id=j5.id, source="referral", current_stage="Hired", rating=4,
            ai_match_score=83.0,
            resume_text=(
                "Sales development rep with 2 years outbound experience. Consistently exceeded quota "
                "by 120%. Salesforce certified. Strong track record at early-stage SaaS startups."
            ),
            notes="Excellent energy and communication skills. Started 2 months ago, already crushing it.",
            tags=["outbound", "salesforce", "quota-buster"],
            applied_at=ago(88),
        )

        # Unassigned / exploratory
        c15 = Candidate(
            name="Zara Ahmed", email="zara.ahmed@example.com", phone="+1 917 555 1515",
            source="other", current_stage="Applied", rating=0,
            resume_text=(
                "Full-stack developer with 3 years experience in React and Node.js. "
                "Looking for a senior engineering role at a growth-stage startup."
            ),
            applied_at=ago(1),
        )

        all_candidates = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10,
                          c11, c12, c13, c14, c15, c16]
        db.add_all(all_candidates)
        await db.flush()

        # ── Activities ────────────────────────────────────────────────────
        print("Seeding activities…")

        job_title_map = {j1.id: j1.title, j2.id: j2.title, j3.id: j3.title,
                         j4.id: j4.title, j5.id: j5.title, j6.id: j6.title}

        activities: list[Activity] = []

        # Applied activities for every candidate
        for c in all_candidates:
            jt = job_title_map.get(c.job_id, "") if c.job_id else ""
            activities.append(Activity(
                candidate_id=c.id, job_id=c.job_id,
                activity_type="applied",
                content=f"{c.name} applied{f' for {jt}' if jt else ''}.",
                created_at=c.applied_at,
            ))

        # Stage-change activities for candidates who progressed
        progressions = [
            (c1,  [("Screening", 39), ("Interview", 35), ("Offer", 20), ("Hired", 14)],  j1),
            (c2,  [("Screening", 32), ("Interview", 25)],                                j1),
            (c3,  [("Screening", 24)],                                                   j1),
            (c4,  [("Screening", 37), ("Rejected", 33)],                                 j1),
            (c5,  [("Screening", 30), ("Interview", 24), ("Offer", 10)],                 j2),
            (c6,  [("Screening", 22), ("Interview", 16)],                                j2),
            (c8,  [("Screening", 17)],                                                   j3),
            (c9,  [("Screening", 15), ("Interview", 10)],                                j3),
            (c11, [("Screening", 16)],                                                   j4),
            (c13, [("Screening", 13), ("Interview", 8)],                                 j4),
            (c14, [("Screening", 85), ("Interview", 80), ("Offer", 75), ("Hired", 72)],  j5),
            (c16, [("Screening", 8)],                                                    j1),
        ]
        for candidate, stages, job in progressions:
            for stage, days_back in stages:
                activities.append(Activity(
                    candidate_id=candidate.id, job_id=job.id,
                    activity_type="stage_change",
                    content=f"{candidate.name} moved to {stage} for {job.title}.",
                    created_at=ago(days_back),
                ))

        # Note activities
        activities += [
            Activity(candidate_id=c1.id, job_id=j1.id, activity_type="note_added",
                     content="Note updated for Alex Chen", created_at=ago(20)),
            Activity(candidate_id=c5.id, job_id=j2.id, activity_type="note_added",
                     content="Note updated for Sofia Garcia", created_at=ago(12)),
            Activity(candidate_id=c9.id, job_id=j3.id, activity_type="note_added",
                     content="Note updated for Aisha Johnson", created_at=ago(9)),
        ]

        db.add_all(activities)
        await db.flush()

        # ── Interviews ────────────────────────────────────────────────────
        print("Seeding interviews…")
        iv1 = Interview(
            candidate_id=c1.id, job_id=j1.id,
            interviewer_name="Sarah Kim", interview_type="technical",
            scheduled_at=ago(34), duration_min=60, status="completed", location="Zoom",
            notes="Outstanding system design. Depth in distributed systems was exceptional.",
        )
        iv2 = Interview(
            candidate_id=c1.id, job_id=j1.id,
            interviewer_name="Marcus Chen", interview_type="cultural",
            scheduled_at=ago(28), duration_min=45, status="completed", location="Zoom",
            notes="Warm, collaborative, humble. Team unanimous — this is our hire.",
        )
        iv3 = Interview(
            candidate_id=c4.id, job_id=j1.id,
            interviewer_name="Sarah Kim", interview_type="technical",
            scheduled_at=ago(36), duration_min=60, status="completed", location="Zoom",
            notes="Struggled with scaling and distributed systems questions. Not ready for senior.",
        )
        iv4 = Interview(
            candidate_id=c2.id, job_id=j1.id,
            interviewer_name="Sarah Kim", interview_type="technical",
            scheduled_at=ahead(4), duration_min=60, status="scheduled", location="Google Meet",
        )
        iv5 = Interview(
            candidate_id=c5.id, job_id=j2.id,
            interviewer_name="James Park", interview_type="portfolio_review",
            scheduled_at=ago(22), duration_min=90, status="completed", location="Zoom",
            notes="World-class portfolio. Design system work is the best I've seen at this level.",
        )
        iv6 = Interview(
            candidate_id=c5.id, job_id=j2.id,
            interviewer_name="Emily Chen", interview_type="final",
            scheduled_at=ago(12), duration_min=60, status="completed",
            location="In-person – NYC Office",
            notes="Met the whole team. Outstanding chemistry. Offer extended same day.",
        )
        iv7 = Interview(
            candidate_id=c6.id, job_id=j2.id,
            interviewer_name="James Park", interview_type="portfolio_review",
            scheduled_at=ahead(7), duration_min=90, status="scheduled", location="Zoom",
        )
        iv8 = Interview(
            candidate_id=c9.id, job_id=j3.id,
            interviewer_name="Tom Richards", interview_type="behavioral",
            scheduled_at=ahead(3), duration_min=60, status="scheduled", location="Zoom",
        )
        iv9 = Interview(
            candidate_id=c13.id, job_id=j4.id,
            interviewer_name="Dr. Wei Zhang", interview_type="technical",
            scheduled_at=ahead(10), duration_min=90, status="scheduled", location="Google Meet",
        )
        iv10 = Interview(
            candidate_id=c14.id, job_id=j5.id,
            interviewer_name="Lisa Monroe", interview_type="behavioral",
            scheduled_at=ago(82), duration_min=45, status="completed", location="Zoom",
            notes="High energy. Excellent track record. Great culture fit. Easy hire.",
        )

        all_interviews = [iv1, iv2, iv3, iv4, iv5, iv6, iv7, iv8, iv9, iv10]
        db.add_all(all_interviews)
        await db.flush()

        # ── Scorecards ────────────────────────────────────────────────────
        print("Seeding scorecards…")
        scorecards = [
            Scorecard(
                interview_id=iv1.id,
                technical=5, communication=5, culture_fit=4, problem_solving=5,
                overall_rating=5, recommendation="strong_yes",
                strengths="Exceptional system design depth. Clear, concise communicator under pressure.",
                concerns="Slightly over initial budget — worth every penny.",
                notes="One of the strongest technical interviews I've conducted in 5 years.",
                submitted_at=ago(33),
            ),
            Scorecard(
                interview_id=iv2.id,
                technical=None, communication=5, culture_fit=5, problem_solving=None,
                overall_rating=5, recommendation="strong_yes",
                strengths="Collaborative, humble, and genuinely excited about our mission.",
                concerns="None.",
                notes="Whole team loved him. Easy decision.",
                submitted_at=ago(27),
            ),
            Scorecard(
                interview_id=iv3.id,
                technical=2, communication=3, culture_fit=3, problem_solving=2,
                overall_rating=2, recommendation="no",
                strengths="Eager to learn and improve.",
                concerns="Struggled on basic distributed systems and scaling questions.",
                notes="Not ready for a senior role. Revisit in 2 years.",
                submitted_at=ago(35),
            ),
            Scorecard(
                interview_id=iv5.id,
                technical=None, communication=5, culture_fit=5, problem_solving=5,
                overall_rating=5, recommendation="strong_yes",
                strengths="World-class portfolio. Rigorous user research process. Stunning design systems.",
                concerns="None.",
                notes="Best designer I've interviewed in my career.",
                submitted_at=ago(21),
            ),
            Scorecard(
                interview_id=iv6.id,
                technical=None, communication=5, culture_fit=5, problem_solving=4,
                overall_rating=5, recommendation="strong_yes",
                strengths="Whole team loved her. Strategic thinker with strong execution track record.",
                concerns="None.",
                notes="Offer extended same day. She accepted.",
                submitted_at=ago(11),
            ),
            Scorecard(
                interview_id=iv10.id,
                technical=None, communication=5, culture_fit=5, problem_solving=4,
                overall_rating=4, recommendation="yes",
                strengths="High energy, great track record, Salesforce expertise.",
                concerns="Still building enterprise deal experience.",
                notes="Right hire for our current stage. Onboarding went smoothly.",
                submitted_at=ago(81),
            ),
        ]
        db.add_all(scorecards)
        await db.flush()

        # ── Email logs ────────────────────────────────────────────────────
        print("Seeding email logs…")
        email_logs = [
            # Alex Chen — full journey
            EmailLog(candidate_id=c1.id, template_id=t_received.id,
                     subject="We received your application — Senior Backend Engineer",
                     body="Hi Alex,\n\nThank you for applying for the Senior Backend Engineer role at ShyftHatch...",
                     status="sent", sent_at=ago(42)),
            EmailLog(candidate_id=c1.id, template_id=t_interview.id,
                     subject="Interview Invitation — Senior Backend Engineer",
                     body="Hi Alex,\n\nCongratulations! We'd love to schedule a technical interview...",
                     status="sent", sent_at=ago(36)),
            EmailLog(candidate_id=c1.id, template_id=t_offer.id,
                     subject="Offer of Employment — Senior Backend Engineer",
                     body="Hi Alex,\n\nWe're thrilled to extend an offer of employment for $155,000...",
                     status="sent", sent_at=ago(18)),

            # Priya Patel — rejection
            EmailLog(candidate_id=c4.id, template_id=t_received.id,
                     subject="We received your application — Senior Backend Engineer",
                     body="Hi Priya,\n\nThank you for applying...",
                     status="sent", sent_at=ago(40)),
            EmailLog(candidate_id=c4.id, template_id=t_rejection.id,
                     subject="Your application for Senior Backend Engineer",
                     body="Hi Priya,\n\nThank you for taking the time to interview with us...",
                     status="sent", sent_at=ago(31)),

            # Maria Santos — in progress
            EmailLog(candidate_id=c2.id, template_id=t_received.id,
                     subject="We received your application — Senior Backend Engineer",
                     body="Hi Maria,\n\nThank you for applying...",
                     status="sent", sent_at=ago(35)),
            EmailLog(candidate_id=c2.id, template_id=t_interview.id,
                     subject="Interview Invitation — Senior Backend Engineer",
                     body="Hi Maria,\n\nWe'd love to schedule a technical interview...",
                     status="sent", sent_at=ago(10)),

            # Sofia Garcia — offer
            EmailLog(candidate_id=c5.id, template_id=t_received.id,
                     subject="We received your application — Product Designer",
                     body="Hi Sofia,\n\nThank you for applying for the Product Designer role...",
                     status="sent", sent_at=ago(33)),
            EmailLog(candidate_id=c5.id, template_id=t_interview.id,
                     subject="Portfolio Review Invitation — Product Designer",
                     body="Hi Sofia,\n\nWe'd love to schedule a portfolio review...",
                     status="sent", sent_at=ago(25)),
            EmailLog(candidate_id=c5.id, template_id=t_offer.id,
                     subject="Offer of Employment — Product Designer",
                     body="Hi Sofia,\n\nWe're thrilled to extend an offer of employment for $125,000...",
                     status="sent", sent_at=ago(10)),

            # Aisha Johnson — interview
            EmailLog(candidate_id=c9.id, template_id=t_received.id,
                     subject="We received your application — Marketing Manager",
                     body="Hi Aisha,\n\nThank you for applying...",
                     status="sent", sent_at=ago(18)),
            EmailLog(candidate_id=c9.id, template_id=t_interview.id,
                     subject="Interview Invitation — Marketing Manager",
                     body="Hi Aisha,\n\nCongratulations! We'd love to schedule an interview...",
                     status="sent", sent_at=ago(12)),

            # Tom Bradley — hired SDR
            EmailLog(candidate_id=c14.id, template_id=t_received.id,
                     subject="We received your application — Sales Development Representative",
                     body="Hi Tom,\n\nThank you for applying for the SDR role...",
                     status="sent", sent_at=ago(88)),
            EmailLog(candidate_id=c14.id, template_id=t_interview.id,
                     subject="Interview Invitation — Sales Development Representative",
                     body="Hi Tom,\n\nWe'd love to schedule a call...",
                     status="sent", sent_at=ago(84)),
            EmailLog(candidate_id=c14.id, template_id=t_offer.id,
                     subject="Offer of Employment — Sales Development Representative",
                     body="Hi Tom,\n\nWe're thrilled to extend an offer of employment...",
                     status="sent", sent_at=ago(74)),
        ]
        db.add_all(email_logs)
        await db.flush()

        # Email-sent activities (one per log)
        candidate_name_map = {c.id: c.name for c in all_candidates}
        email_activities = [
            Activity(
                candidate_id=el.candidate_id, job_id=None,
                activity_type="email_sent",
                content=f"Email sent: {el.subject}",
                created_at=el.sent_at,
            )
            for el in email_logs
            if el.candidate_id and el.candidate_id in candidate_name_map
        ]
        db.add_all(email_activities)

        # Interview-scheduled activities for upcoming interviews
        upcoming_activities = [
            Activity(candidate_id=iv4.candidate_id,  job_id=iv4.job_id,
                     activity_type="interview_scheduled",
                     content=f"Technical interview scheduled with {iv4.interviewer_name}.",
                     created_at=ago(3)),
            Activity(candidate_id=iv7.candidate_id,  job_id=iv7.job_id,
                     activity_type="interview_scheduled",
                     content=f"Portfolio review scheduled with {iv7.interviewer_name}.",
                     created_at=ago(2)),
            Activity(candidate_id=iv8.candidate_id,  job_id=iv8.job_id,
                     activity_type="interview_scheduled",
                     content=f"Behavioral interview scheduled with {iv8.interviewer_name}.",
                     created_at=ago(2)),
            Activity(candidate_id=iv9.candidate_id,  job_id=iv9.job_id,
                     activity_type="interview_scheduled",
                     content=f"Technical interview scheduled with {iv9.interviewer_name}.",
                     created_at=ago(1)),
        ]
        db.add_all(upcoming_activities)

        await db.commit()

        print("\n✓ Seed complete!")
        print(f"  6 jobs  (4 open · 1 closed · 1 draft)")
        print(f"  4 email templates")
        print(f"  {len(all_candidates)} candidates across all pipeline stages")
        print(f"  {len(all_interviews)} interviews  (6 completed · 4 upcoming)")
        print(f"  {len(scorecards)} scorecards")
        print(f"  {len(email_logs)} email logs")
        print(f"  {len(activities) + len(email_activities) + len(upcoming_activities)} activity records")


if __name__ == "__main__":
    asyncio.run(seed())
