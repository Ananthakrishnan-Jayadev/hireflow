# HireFlow

An AI-powered Applicant Tracking System (ATS) built with FastAPI + PostgreSQL and a lightweight vanilla-JS SPA UI. Create jobs, publish a public careers page, manage candidates & pipeline stages, schedule interviews, run email outreach, and track analytics — with GPT, Claude, and Ollama powering the workflow. Includes a real-time interview copilot that coaches recruiters live during calls.

---

## Product Highlights

- **End-to-end recruiting workflow**: Jobs → Candidates → Pipeline → Interviews → Outreach → Analytics
- **Public careers page**: shareable job board + simple, fast apply flow with resume upload
- **AI built into the workflow**: JD generator, email composer, candidate matching, interview assistant, debriefs, bias checks
- **Live Interview Copilot**: real-time AI coaching during interviews via WebSocket — triggered questions, live transcript ingestion via MeetStream
- **Multi-provider AI**: route between OpenAI, Anthropic (Claude), and Ollama (local) per feature
- **Production-friendly basics**: JWT auth + roles, security headers, configurable CORS, no-cache for frontend assets

---

## Features

| Module | Capabilities |
|---|---|
| **Authentication & Roles** | Login page + HTTP-only cookie refresh; role-based access (`admin`, `recruiter`, `viewer`); admin-only user management |
| **Jobs** | Create/edit jobs; statuses (draft/open/closed); rich job details; publish to public careers page |
| **AI: JD Generator** | Generate structured JDs (overview + responsibilities + qualifications + benefits) from requirements; editable before saving |
| **Candidates** | Candidate profiles; resume upload (PDF/DOCX) + extracted text; star ratings; tags; notes; activity + email history |
| **AI: Candidate Matching** | GPT match score (0–100) with 1-line reasoning; score + reasoning persisted into candidate notes |
| **Pipeline** | Kanban board; drag-and-drop stage moves; job-based filtering |
| **Interviews** | Schedule interviews; statuses; scorecards; add-to-calendar link for the scheduler (Google Calendar deep link) |
| **Interview Assistant** | Dedicated page to browse and generate AI interview question banks per job; categorised by behavioural / technical / situational / culture |
| **AI: Interview Questions** | Generate 10 role-specific interview questions with "what to listen for" guidance; stored per job with optional regenerate |
| **AI: Live Interview Copilot** | Real-time AI coach during live interviews; ingests live transcripts (via MeetStream webhook or local simulator); surfaces triggered follow-up questions over WebSocket; React-based UI served alongside the main app |
| **AI: Interview Debrief** | Generate a structured debrief from scorecard + notes; optional transcript paste-in for best results |
| **Email Outreach** | Templates; send emails to candidates; AI email composer; calendar booking URL hint support |
| **AI: Bias Auditor** | Scan JDs/emails for biased or exclusionary language and suggest inclusive replacements |
| **AI: Ghosting Risk Score** | Rule-based ghosting risk score + factors; shows in Candidates list and Candidate profile |
| **Analytics** | Interpretive charts + insight cards: funnel drop-off, sources, trends, velocity, job performance table |
| **Career Page** | Public job board at `/career`; filters/dropdowns; job detail view; apply modal with resume upload |

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async Python web framework
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/) — async ORM with `asyncpg`
- [PostgreSQL](https://www.postgresql.org/) — primary database
- [Redis](https://redis.io/) — copilot session state
- [Alembic](https://alembic.sqlalchemy.org/) — database migrations
- [OpenAI Python SDK](https://github.com/openai/openai-python) — GPT integration
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) — Claude integration
- [Ollama](https://ollama.com/) — local LLM support
- [pypdf](https://github.com/py-pdf/pypdf) — PDF text extraction
- [python-docx](https://python-docx.readthedocs.io/) — DOCX text extraction
- [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) — environment config

**Frontend (main app)**
- Vanilla JavaScript (ES6 modules, no build step)
- Hash-based SPA routing (`app.js`)
- [Chart.js 4.4](https://www.chartjs.org/) — analytics charts (CDN)
- [Lucide Icons](https://lucide.dev/) — icon set (CDN)
- Google Fonts — Inter

**Frontend (Live Copilot)**
- React 18 + TypeScript
- Vite build
- WebSocket client for real-time coaching stream

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Redis (required for the live copilot; optional for the rest of the app)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- Anthropic API key *(optional — for Claude-powered features)*
- Ollama running locally *(optional — for local LLM)*

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd hireflow
```

### 2. Create a virtual environment and install dependencies

```bash
cd backend
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r ../requirements.txt
```

### 3. Configure environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://your_user:your_password@localhost:5432/hireflow
OPENAI_API_KEY=sk-...
JWT_SECRET=change-me-in-production
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=true
UPLOAD_DIR=uploads

# Redis (required for live copilot)
REDIS_URL=redis://localhost:6379

# Anthropic (optional)
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (optional — local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# Optional: restrict browser access origins (comma-separated)
# ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

> **SMTP (optional)** — add these to enable real email sending:
> ```env
> SMTP_HOST=smtp.gmail.com
> SMTP_PORT=587
> SMTP_USER=you@gmail.com
> SMTP_PASSWORD=your_app_password
> ```

### 4. Create the database

```bash
# In psql or your preferred PostgreSQL client:
CREATE DATABASE hireflow;
```

### 5. Run migrations

```bash
cd backend
alembic upgrade head
```

### 6. Create an admin user

```bash
cd backend
python manage_users.py create
```

You can also list and delete users:

```bash
python manage_users.py list
python manage_users.py delete
```

### 7. Seed demo data (optional)

```bash
cd backend
python seed.py
```

Seeds the database with:
- 6 jobs (4 open, 1 closed, 1 draft)
- 16 candidates across all pipeline stages
- 10 interviews (6 completed with scorecards, 4 upcoming)
- 15 email logs
- 4 email templates
- Full activity timeline

> Safe to re-run — clears all existing data first.

### 8. Start the server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` in your browser.

---

## Project Structure

```
hireflow/
├── backend/
│   ├── main.py                   # FastAPI app, router registration, static file mounts
│   ├── database.py               # Async SQLAlchemy engine + session factory
│   ├── config.py                 # Pydantic settings (reads from .env)
│   ├── seed.py                   # Demo data seeder
│   ├── manage_users.py           # CLI tool for user management
│   │
│   ├── models/
│   │   ├── job.py
│   │   ├── candidate.py          # resume_text, ai_match_score
│   │   ├── interview.py
│   │   ├── scorecard.py
│   │   ├── email_log.py
│   │   ├── email_template.py
│   │   ├── user.py
│   │   └── activity.py
│   │
│   ├── schemas/                  # Pydantic request/response models
│   │
│   ├── routers/
│   │   ├── candidates.py
│   │   ├── jobs.py
│   │   ├── ai.py                 # JD, email, rank, bias, ghosting, debrief, questions
│   │   ├── auth.py               # Login/refresh/logout + admin user CRUD
│   │   ├── uploads.py            # Resume file upload
│   │   ├── pipeline.py           # Stage move endpoint
│   │   ├── interviews.py
│   │   ├── emails.py
│   │   ├── analytics.py
│   │   ├── career.py             # Public job board API
│   │   ├── copilot.py            # WebSocket live interview copilot
│   │   └── meetstream_webhook.py # MeetStream transcript ingestion webhook
│   │
│   ├── dependencies/
│   │   └── auth.py               # require_auth / require_role
│   │
│   ├── services/
│   │   ├── ai_service.py         # OpenAI calls (JD, email, ranking, bias, debrief)
│   │   ├── auth_service.py       # Auth helpers
│   │   ├── resume_parser.py      # PDF + DOCX text extraction
│   │   ├── analytics_service.py  # DB aggregation queries
│   │   ├── email_service.py      # SMTP email dispatch
│   │   ├── meetstream_client.py  # MeetStream API client
│   │   │
│   │   └── realtime/             # Live Interview Copilot engine
│   │       ├── orchestrator.py       # Coordinates transcript → coaching pipeline
│   │       ├── llm_router.py         # Routes requests to OpenAI / Claude / Ollama
│   │       ├── session_manager.py    # Per-interview session state (Redis-backed)
│   │       ├── trigger_engine.py     # Decides when to surface a question
│   │       ├── schemas.py
│   │       ├── providers/
│   │       │   ├── openai_provider.py
│   │       │   ├── anthropic_provider.py
│   │       │   └── ollama_provider.py
│   │       └── source_adapters/
│   │           ├── meetstream_adapter.py   # Live transcript via MeetStream webhook
│   │           ├── local_simulator.py      # Dev-mode transcript simulator
│   │           └── adapter_factory.py
│   │
│   ├── uploads/resumes/          # Uploaded resume files (auto-created)
│   └── alembic/versions/         # Migration history
│
└── frontend/
    ├── assets/
    │   └── logo.svg
    │
    ├── index.html                # Main app entry
    ├── career.html               # Public career page entry
    ├── career-entry.tsx
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── App.tsx               # Browser router + protected routes
        ├── styles.css            # Design system and app styles
        ├── lib/                  # API, auth, helpers
        ├── contexts/             # Auth + modal providers
        ├── store/                # Toast and copilot stores
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── Jobs.tsx / JobCreate.tsx / JobDetail.tsx
        │   ├── Candidates.tsx / CandidateProfile.tsx
        │   ├── Pipeline.tsx
        │   ├── Interviews.tsx / Scorecard.tsx / InterviewAssistant.tsx
        │   ├── Emails.tsx / Analytics.tsx / AdminUsers.tsx
        │   ├── Career.tsx
        │   └── LiveCopilot.tsx
        └── components/
            ├── layout/
            ├── ui/
            └── copilot/
```

---

## Key URLs

| URL | Description |
|---|---|
| `http://localhost:8000/` | Main app — Dashboard |
| `http://localhost:8000/login` | Login |
| `http://localhost:8000/jobs` | Job listings |
| `http://localhost:8000/candidates` | Candidate table |
| `http://localhost:8000/pipeline` | Kanban pipeline |
| `http://localhost:8000/interviews` | Interview schedule |
| `http://localhost:8000/interview-assistant` | Interview question bank |
| `http://localhost:8000/emails` | Email outreach |
| `http://localhost:8000/analytics` | Analytics & charts |
| `http://localhost:8000/admin-users` | Admin — manage users (admin-only) |
| `http://localhost:8000/copilot` | Live Interview Copilot |
| `http://localhost:8000/career` | Public job board (shareable) |
| `http://localhost:8000/api/docs` | FastAPI Swagger UI (**dev only**) |
| `http://localhost:8000/api/redoc` | FastAPI ReDoc (**dev only**) |

---

## API Overview

All API routes are prefixed with `/api/`.

| Prefix | Router | Description |
|---|---|---|
| `/api/auth` | `routers/auth.py` | Login/refresh/logout + admin user CRUD |
| `/api/jobs` | `routers/jobs.py` | Job CRUD |
| `/api/candidates` | `routers/candidates.py` | Candidate CRUD + filtering |
| `/api/pipeline` | `routers/pipeline.py` | Stage move endpoint |
| `/api/interviews` | `routers/interviews.py` | Interview scheduling |
| `/api/emails` | `routers/emails.py` | Email send + templates |
| `/api/ai` | `routers/ai.py` | All AI + matching endpoints |
| `/api/uploads` | `routers/uploads.py` | Resume file upload |
| `/api/analytics` | `routers/analytics.py` | Stats and chart data |
| `/api/career` | `routers/career.py` | Public job board + apply |
| `/api/copilot` | `routers/copilot.py` | Live copilot sessions + WebSocket |
| `/api/meetstream` | `routers/meetstream_webhook.py` | MeetStream transcript webhook |
| `/uploads/resumes/` | Static files | Uploaded resume downloads |

### AI endpoints

```
POST /api/ai/generate-jd                    Generate a job description with GPT
POST /api/ai/compose-email                  Compose a candidate email with GPT
POST /api/ai/rank-candidate                 Score a candidate against their job (0–100)
POST /api/ai/interview-questions            Generate 10 interview questions for a job (cached)
GET  /api/ai/interview-questions/{job_id}   Get stored interview questions for a job
POST /api/ai/talent-pool-match              Find top matches from existing candidate database
POST /api/ai/bias-check                     Bias audit for JD/email text + suggestions
GET  /api/ai/ghosting-risk/{candidate_id}   Ghosting risk score + factors
POST /api/ai/interview-debrief              Structured interview debrief (optional transcript)
```

### Live Copilot endpoints

```
POST /api/copilot/sessions                  Create a copilot session for an interview
GET  /api/copilot/sessions/{id}/ws-ticket   Get a short-lived WebSocket auth ticket
WS   /api/copilot/ws/{session_id}           WebSocket — receive triggered coaching questions
POST /api/meetstream/webhook                Ingest live transcript chunks from MeetStream
POST /api/meetstream/callback               Receive MeetStream bot status events
```

---

## AI Features

### Job Description Generator
On the Create/Edit Job page, click **Generate JD**. Provide a role title, department, location, and key requirements. GPT generates a structured description, responsibilities, qualifications, and benefits — editable before saving.

### Email Composer
On the Emails page, select a candidate and intent (outreach / follow-up / interview invite / rejection / offer). GPT drafts a personalised email that you can edit before sending.

### Candidate Ranking
Each candidate can be scored against their assigned job. Click **Rank** on the Candidates list or candidate profile. GPT reads the job description + candidate resume and returns a 0–100 match score with one-sentence reasoning. Stored as a colour-coded badge (green ≥ 75 · amber 50–74 · red < 50).

### Interview Assistant
A dedicated page (`/interview-assistant`) to browse all jobs and generate or view AI question banks. Questions are categorised as behavioural / technical / situational / culture and stored per job.

### Live Interview Copilot
A real-time coaching assistant that runs during live interviews. The copilot:
- Ingests live transcripts from **MeetStream** (via webhook) or a local simulator in dev mode
- Runs the transcript through a trigger engine to decide when a follow-up question is warranted
- Streams triggered questions to the recruiter in real time over a **WebSocket**
- Supports **OpenAI**, **Anthropic (Claude)**, and **Ollama** as the underlying LLM — switchable per session

The copilot UI is part of the React frontend in `frontend/` and is served alongside the main app.

### Talent Rediscovery
When you open a role, generate a ranked list of existing candidates in your database who match the job — proactive outreach without waiting for new applicants.

### Bias Auditor
Flags problematic phrases in JDs and emails (category + reason) and proposes inclusive replacements. Available inline in Job Create/Edit and Email Compose.

### Ghosting Risk Score
Rule-based risk score (0–100) based on stage time, recency of outreach, missing upcoming interviews, and touchpoint count. Shown as a badge in the Candidates list and a detailed card on the Candidate profile.

### Interview Debrief
For completed interviews, generate a structured debrief (verdict + confidence + summary + strengths/concerns + next step). Optionally paste an interview transcript before generating for higher accuracy.

---

## Resume Upload

- Accepted formats: `.pdf`, `.docx`, `.doc`
- Maximum size: 5 MB
- Files saved to `backend/uploads/resumes/` with a UUID prefix
- Extracted text stored in the database and used for AI ranking
- Served at `/uploads/resumes/<filename>`

---

## Development Notes

- **Frontend build** — `cd frontend && npm install && npm run build`; the dist is served by FastAPI
- **Hot reload** — run uvicorn with `--reload`; frontend changes take effect on browser refresh
- **CORS** — configured via `ALLOWED_ORIGINS` (comma-separated). Defaults to local dev origins.
- **Security headers** — HSTS (non-debug), frame blocking, referrer policy set via middleware
- **Auth guard** — frontend checks auth on load, attempts silent refresh, redirects to `/login` on 401
- **Migrations** — after changing any model:
  ```bash
  alembic revision --autogenerate -m "describe_change"
  alembic upgrade head
  ```
- **Re-seeding** — `python seed.py` is destructive; wipes all data before inserting fresh demo records
