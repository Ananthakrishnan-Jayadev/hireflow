# ShyftHatch

An AI-powered Applicant Tracking System (ATS) built with FastAPI + Postgres and a lightweight vanilla-JS SPA UI. Create jobs, publish a public careers page, manage candidates & pipeline stages, schedule interviews, run email outreach, and track analytics — powered by GPT across the workflow.

---

## Product Highlights

- **End-to-end recruiting workflow**: Jobs → Candidates → Pipeline → Interviews → Outreach → Analytics
- **Public careers page**: shareable job board + simple, fast apply flow with resume upload
- **AI built into the workflow**: JD generator, email composer, candidate matching, interview assistant, debriefs, bias checks
- **Production-friendly basics**: JWT auth + roles, security headers, configurable CORS, no-cache for frontend assets

---

## Features (What You Can Do)

| Module | Capabilities |
|---|---|
| **Authentication & Roles** | Login page + HTTP-only cookie refresh; role-based access (`admin`, `recruiter`, `viewer`); admin-only user management |
| **Jobs** | Create/edit jobs; statuses (draft/open/closed); rich job details; publish to public careers page |
| **AI: JD Generator** | Generate structured JDs (overview + responsibilities + qualifications + benefits) from requirements; editable before saving |
| **Candidates** | Candidate profiles; resume upload (PDF/DOCX) + extracted text; star ratings; tags; notes; activity + email history |
| **AI: Candidate Matching** | GPT match score (0–100) with 1-line reasoning; score + reasoning persisted into candidate notes |
| **Pipeline** | Kanban board; drag-and-drop stage moves; job-based filtering |
| **Interviews** | Schedule interviews; statuses; scorecards; add-to-calendar link for the scheduler (Google Calendar deep link) |
| **AI: Interview Assistant** | Generate 10 role-specific interview questions; stored per job with optional “regenerate” |
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
- [Alembic](https://alembic.sqlalchemy.org/) — database migrations
- [OpenAI Python SDK](https://github.com/openai/openai-python) — GPT-5 integration
- [pypdf](https://github.com/py-pdf/pypdf) — PDF text extraction
- [python-docx](https://python-docx.readthedocs.io/) — DOCX text extraction
- [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) — environment config

**Frontend**
- Vanilla JavaScript (ES6 modules, no build step)
- Hash-based SPA routing (`app.js`)
- [Chart.js 4.4](https://www.chartjs.org/) — analytics charts (CDN)
- [Lucide Icons](https://lucide.dev/) — icon set (CDN)
- Google Fonts — DM Sans + Instrument Serif

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+
- An [OpenAI API key](https://platform.openai.com/api-keys) with access to GPT-5

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd shyfthatch
```

### 2. Create a virtual environment and install dependencies

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r ../requirements.txt

# Auth dependencies (required)
pip install "passlib[bcrypt]" "python-jose[cryptography]" "bcrypt==4.0.1"
```

### 3. Configure environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://your_user:your_password@localhost:5432/shyfthatch
OPENAI_API_KEY=sk-...
JWT_SECRET=change-me-in-production
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=true
UPLOAD_DIR=uploads

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

### 4. Create an admin user (first-time setup)

Run the user management script (admin-only features require an admin account):

```bash
cd backend
python manage_users.py create
```

You can also list and delete users:

```bash
python manage_users.py list
python manage_users.py delete
```

### 4. Create the database

```bash
# In psql or your preferred PostgreSQL client:
CREATE DATABASE shyfthatch;
```

### 5. Run migrations

```bash
cd backend
alembic upgrade head
```

This runs both migrations:
- `0001_initial_schema` — all core tables
- `a57565ad8876_add_resume_text_and_ai_score` — resume text + AI score columns

### 6. Seed demo data (optional but recommended)

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

### 7. Start the server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` in your browser.

---

## Project Structure

```
shyfthatch/
├── backend/
│   ├── main.py                   # FastAPI app, router registration, static file mounts
│   ├── database.py               # Async SQLAlchemy engine + session factory
│   ├── config.py                 # Pydantic settings (reads from .env)
│   ├── seed.py                   # Demo data seeder
│   │
│   ├── models/
│   │   ├── job.py                # Job listings
│   │   ├── candidate.py          # Candidates (resume_text, ai_match_score)
│   │   ├── interview.py          # Scheduled interviews
│   │   ├── scorecard.py          # Interview scorecards
│   │   ├── email_log.py          # Sent email history
│   │   ├── email_template.py     # Reusable email templates
│   │   ├── user.py               # App users (auth)
│   │   └── activity.py           # Activity timeline events
│   │
│   ├── schemas/                  # Pydantic request/response models
│   │   ├── candidate.py
│   │   ├── job.py
│   │   ├── ai.py
│   │   ├── auth.py
│   │   ├── career.py
│   │   ├── analytics.py
│   │   └── ...
│   │
│   ├── routers/                  # FastAPI route handlers
│   │   ├── candidates.py         # CRUD + list/filter
│   │   ├── jobs.py
│   │   ├── ai.py                 # AI endpoints (JD, email, rank, bias, ghosting, debrief, etc.)
│   │   ├── auth.py               # Login/refresh/logout + admin user CRUD
│   │   ├── uploads.py            # Resume file upload
│   │   ├── pipeline.py           # Stage moves
│   │   ├── interviews.py
│   │   ├── emails.py
│   │   ├── analytics.py
│   │   └── career.py             # Public job board API
│   │
│   ├── dependencies/
│   │   └── auth.py               # require_auth / require_role
│   ├── services/
│   │   ├── ai_service.py         # OpenAI calls (JD, email, ranking, bias, debrief)
│   │   ├── resume_parser.py      # PDF + DOCX text extraction
│   │   ├── analytics_service.py  # DB aggregation queries
│   │   └── email_service.py      # SMTP email dispatch
│   │
│   ├── uploads/                  # Uploaded resume files (auto-created)
│   │   └── resumes/
│   │
│   └── alembic/                  # Database migration history
│       └── versions/
│
└── frontend/
    ├── index.html                # SPA shell
    ├── login.html                # Dedicated login page
    ├── career.html               # Standalone public career page
    │
    ├── css/
    │   ├── variables.css         # Design tokens (colours, spacing, radius)
    │   ├── reset.css             # CSS reset
    │   ├── global.css            # Shared component styles
    │   ├── dashboard.css
    │   └── career.css
    │
    └── js/
        ├── app.js                # SPA router (hash-based)
        ├── api.js                # Fetch wrapper
        │
        ├── pages/
        │   ├── dashboard.js      # Overview stats + charts
        │   ├── analytics.js      # Full analytics page
        │   ├── jobs.js           # Job listings
        │   ├── jobCreate.js      # Create / edit job form
        │   ├── jobDetail.js      # Job detail + AI JD generator
        │   ├── candidates.js     # Candidate table + AI score column
        │   ├── candidateProfile.js  # Full profile + AI rank card
        │   ├── pipeline.js       # Kanban board
        │   ├── interviews.js     # Interview list + scheduling
        │   ├── scorecard.js      # Interview scorecard form
        │   ├── emails.js         # Email outreach + AI composer
        │   ├── adminUsers.js     # Admin user management UI
        │   └── career.js         # Public job board (standalone)
        │
        └── components/
            ├── sidebar.js
            ├── topbar.js
            ├── modal.js
            ├── toast.js
            ├── table.js          # Reusable DataTable with sort + pagination
            ├── kanban.js
            ├── charts.js         # Interpretive Chart.js wrappers + funnel visualisation
            ├── biasAuditor.js    # Reusable “Check for bias” panel (JD + emails)
            └── loader.js
```

---

## Key URLs

| URL | Description |
|---|---|
| `http://localhost:8000/` | Main app — Dashboard |
| `http://localhost:8000/login` | Login (also available as `/login.html`) |
| `http://localhost:8000/#/jobs` | Job listings |
| `http://localhost:8000/#/candidates` | Candidate table |
| `http://localhost:8000/#/pipeline` | Kanban pipeline |
| `http://localhost:8000/#/interviews` | Interview schedule |
| `http://localhost:8000/#/emails` | Email outreach |
| `http://localhost:8000/#/analytics` | Analytics & charts |
| `http://localhost:8000/#/admin-users` | Admin — manage users (admin-only) |
| `http://localhost:8000/career` | Public job board (shareable) |
| `http://localhost:8000/docs` | FastAPI Swagger UI (**dev only**; hidden when `APP_DEBUG=false`) |
| `http://localhost:8000/redoc` | FastAPI ReDoc (**dev only**; hidden when `APP_DEBUG=false`) |

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
| `/uploads/resumes/` | Static files | Uploaded resume downloads |

### AI endpoints

```
POST /api/ai/generate-jd          Generate a job description with GPT
POST /api/ai/compose-email        Compose a candidate email with GPT
POST /api/ai/rank-candidate       Score a candidate against their job (0–100)
POST /api/ai/interview-questions  Generate 10 interview questions for a job (cached)
GET  /api/ai/interview-questions/{job_id}  Get stored interview questions for a job
POST /api/ai/talent-pool-match    Find top matches from existing candidate database
POST /api/ai/bias-check           Bias audit for JD/email text + suggestions
GET  /api/ai/ghosting-risk/{candidate_id}  Ghosting risk score + factors
POST /api/ai/interview-debrief    Structured interview debrief (optional transcript)
```

### Resume upload

```
POST /api/uploads/resume          Multipart file upload
                                  Returns: { url, filename, resume_text }
```

---

## AI Features

### Job Description Generator
On the Job Detail page, click **Generate with AI**. Provide a role title, department, location, and key requirements. GPT generates a structured description, responsibilities, qualifications, and benefits — editable before saving.

### Email Composer
On the Emails page, select a candidate and intent (outreach / follow-up / interview invite / rejection / offer). GPT drafts a personalised email that you can edit before sending.

### Candidate AI Ranking
Each candidate can be scored against their assigned job. Click **Rank** (⚡) on the Candidates list or the candidate profile sidebar. GPT reads the job description + requirements and the candidate's resume text + cover letter, then returns a 0–100 match score with a one-sentence reasoning. The score is stored and displayed as a colour-coded badge (green ≥ 75 · amber 50–74 · red < 50).

> Candidates must have a job assigned before ranking. Upload a resume (PDF/DOCX) via the Apply form or the Add Candidate modal to provide richer context for the AI.

### Interview Assistant (Cached)
Generate exactly **10** job-specific interview questions (mix of behavioural/technical/situational/culture) with “what to listen for” guidance. Questions are **stored per job** so the app doesn’t regenerate unless you explicitly choose to.

### Talent Rediscovery / Proactive Matching
When you open a role, you can generate a top list of existing candidates in your database who match the job — helping you reach out proactively instead of waiting for new applicants.

### Bias Auditor (JDs + Emails)
Run a bias audit on job descriptions and candidate emails. The auditor flags problematic phrases (category + reason) and proposes inclusive replacement text. This is available inline in:
- Job Create/Edit (below the Description field)
- Email Outreach (Compose tab)

### Ghosting Risk Score
A fast rule-based risk score (0–100) that helps recruiters spot candidates who may ghost due to long stage time, lack of recent outreach, missing upcoming interviews, and low touchpoints. Displayed as:
- A **Ghosting Risk** badge column in Candidates
- A detailed Ghosting Risk card on the Candidate profile (with factor explanations)

### AI Interview Debrief (Transcript Supported)
For completed interviews, generate a structured debrief (verdict + confidence + summary + strengths/concerns + next step). The UI lets you optionally paste an **interview transcript** before generating for higher accuracy.

---

## Resume Upload

- Accepted formats: `.pdf`, `.docx`, `.doc`
- Maximum size: 5 MB
- Files are saved to `backend/uploads/resumes/` with a UUID prefix
- Extracted text is stored in the database and used for AI ranking
- Files are served at `/uploads/resumes/<filename>`

---

## Development Notes

- **No build step** — the frontend is plain ES6 modules served directly by FastAPI's `StaticFiles`
- **Hot reload** — run uvicorn with `--reload` during development; frontend changes take effect on browser refresh
- **CORS** — configured via `ALLOWED_ORIGINS` (comma-separated). Defaults to local dev origins.
- **Security headers** — common hardening headers are set via middleware (HSTS in non-debug mode, frame blocking, referrer policy, etc.)
- **Auth guard** — the frontend checks auth on load, attempts silent refresh, and redirects to `/login` on 401
- **Migrations** — after changing any model, run:
  ```bash
  alembic revision --autogenerate -m "describe_change"
  alembic upgrade head
  ```
- **Re-seeding** — `python seed.py` is destructive; it wipes all data before inserting fresh demo records
