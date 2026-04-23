# ShyftHatch - Project Documentation

## Overview

ShyftHatch is an AI-powered Applicant Tracking System (ATS) built with FastAPI (Python backend) and a lightweight vanilla-JavaScript SPA frontend. The platform provides end-to-end recruiting workflow management including job creation, candidate tracking, pipeline management, interview scheduling, email outreach, and comprehensive analytics — all enhanced with AI capabilities powered by OpenAI's GPT models.

**Project Name:** ShyftHatch  
**Type:** Full-stack Web Application (ATS/Recruiting Platform)  
**Architecture:** Monolithic backend with SPA frontend + standalone React micro-frontend for Copilot

---

## Core Features

### 1. Authentication & User Management
- JWT-based authentication with HTTP-only cookies
- Role-based access control (`admin`, `recruiter`, `viewer`)
- Admin-only user management interface
- Token refresh mechanism

### 2. Job Management
- Create, edit, and manage job postings
- Job statuses: Draft, Open, Closed
- Rich job details including requirements, benefits, and qualifications
- Public careers page auto-publication
- AI-powered Job Description generator

### 3. Candidate Management
- Candidate profiles and profiles with resume parsing
- Resume upload (PDF/DOCX) with text extraction
- Star ratings and tagging system
- Activity timeline and email history
- AI-powered candidate matching and scoring (0-100)
- Ghosting risk score with factor analysis

### 4. Pipeline Management
- Kanban-style pipeline board
- Drag-and-drop stage transitions
- Job-based filtering
- Real-time pipeline views

### 5. Interview Management
- Interview scheduling and tracking
- Interview statuses (scheduled, completed, cancelled)
- Scorecard creation and management
- Google Calendar deep-link integration
- AI-powered interview question generation
- AI interview debrief generation (with optional transcript)

### 6. Email Outreach
- Email templates management
- Bulk and individual email sending
- AI email composer with multiple intents
- Email history tracking
- Calendar booking URL support

### 7. Analytics Dashboard
- Funnel visualization
- Source tracking and analysis
- Time-to-hire metrics
- Job performance metrics
- Trend analysis with Chart.js

### 8. Public Career Page
- Standalone public job board
- Job filtering and search
- Resume upload during application
- Mobile-responsive design

---

## AI Features

### All AI Capabilities

| Feature | Description | Endpoint |
|---------|-------------|----------|
| JD Generator | Generate structured job descriptions from requirements | `POST /api/ai/generate-jd` |
| Email Composer | AI-drafted candidate emails (outreach, follow-up, interview, rejection, offer) | `POST /api/ai/compose-email` |
| Candidate Ranking | Score candidates against job requirements (0-100) | `POST /api/ai/rank-candidate` |
| Interview Questions | Generate role-specific interview questions (cached per job) | `POST /api/ai/interview-questions` |
| Talent Pool Match | Find matching candidates from existing database | `POST /api/ai/talent-pool-match` |
| Bias Auditor | Scan JDs/emails for biased language | `POST /api/ai/bias-check` |
| Ghosting Risk | Rule-based candidate ghosting risk score | `GET /api/ai/ghosting-risk/{id}` |
| Interview Debrief | Structured debrief from scorecards | `POST /api/ai/interview-debrief` |
| Live Copilot | Real-time interview coaching assistant | WebSocket `/api/copilot/ws/{session_id}` |

---

## Live Interview Copilot (New Feature)

### Architecture

The Copilot is a real-time interview coaching assistant that provides live guidance during interviews via WebSocket connections.

#### Components

**Backend:**
- `backend/routers/copilot.py` - WebSocket endpoints and session management
- `backend/services/realtime/orchestrator.py` - Coaching prompt orchestration
- `backend/services/realtime/session_manager.py` - In-memory session state and expiration
- `backend/services/realtime/trigger_engine.py` - Hybrid trigger logic (punctuation/silence timeout)
- `backend/services/realtime/llm_router.py` - Provider routing (OpenAI, Anthropic, Ollama)
- `backend/services/realtime/providers/` - LLM provider implementations
- `backend/services/realtime/schemas.py` - Request/response schemas

**Frontend:**
- `frontend/react-copilot/` - Standalone React + TypeScript + Vite + Zustand micro-frontend
- Served at `/copilot` route

#### Workflow

1. **Session Creation:** `POST /api/copilot/sessions` creates a session with optional interview context
2. **WebSocket Connection:** Client connects to `/api/copilot/ws/{session_id}?ticket=...`
3. **Transcript Streaming:** Client sends `transcript.chunk` events with speech data
4. **Buffering & Triggering:** Server buffers transcript chunks, triggers generation on:
   - Punctuation (`?`, `.`, `!`)
   - Silence timeout (default 1500ms without new chunks)
   - Max wait timeout (default 5000ms)
5. **Coaching Generation:** Orchestrator streams AI-generated coaching response
6. **Events:** 
   - `coaching.token` - Streaming answer tokens
   - `coaching.meta` - Talking points and follow-up strategy
   - `coaching.final` - Complete response

#### Provider Support

- **OpenAI:** GPT-4o (default)
- **Anthropic:** Claude Sonnet 4
- **Ollama:** Local models (configurable)

#### Configuration

```env
# In backend/.env
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434

# Copilot Settings
COPILOT_TRIGGER_SILENCE_MS=1500      # Silence before trigger
COPILOT_TRIGGER_MAX_WAIT_MS=5000     # Max buffer time
COPILOT_WS_TICKET_EXPIRY_SEC=60      # WebSocket ticket TTL
COPILOT_SESSION_MAX_AGE_SEC=7200     # Session lifetime (2h)
COPILOT_DEFAULT_PROVIDER=openai
COPILOT_MODEL_OPENAI=gpt-4o
COPILOT_MODEL_ANTHROPIC=claude-sonnet-4-20250514
COPILOT_MODEL_OLLAMA=kimi-k2.5:cloud
```

---

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | Async Python web framework |
| SQLAlchemy 2.0 | Async ORM with asyncpg driver |
| PostgreSQL | Primary database |
| Alembic | Database migrations |
| OpenAI Python SDK | GPT integration |
| pypdf | PDF text extraction |
| python-docx | DOCX text extraction |
| pydantic-settings | Environment configuration |
| Redis | Copilot session fan-out (optional) |
| passlib + bcrypt | Password hashing |
| python-jose | JWT token handling |

### Frontend
| Technology | Purpose |
|------------|---------|
| Vanilla JavaScript ES6 | Core SPA (no build step) |
| React 18 + TypeScript | Copilot micro-frontend |
| Zustand | State management (Copilot) |
| Vite | Build tool (Copilot) |
| Chart.js 4.4 | Analytics visualizations |
| Lucide Icons | Icon library (CDN) |
| Google Fonts | Typography (DM Sans, Instrument Serif) |

---

## Project Structure

```
hireflow/
├── backend/
│   ├── main.py                      # FastAPI app entry point
│   ├── config.py                    # Pydantic settings
│   ├── database.py                  # Async SQLAlchemy setup
│   ├── seed.py                      # Demo data seeder
│   ├── manage_users.py              # User management CLI
│   │
│   ├── models/                      # SQLAlchemy models
│   │   ├── user.py                  # User accounts
│   │   ├── job.py                   # Job listings
│   │   ├── candidate.py             # Candidates + AI fields
│   │   ├── interview.py             # Scheduled interviews
│   │   ├── scorecard.py             # Interview scorecards
│   │   ├── email_log.py             # Email history
│   │   ├── email_template.py        # Reusable templates
│   │   └── activity.py              # Activity timeline
│   │
│   ├── schemas/                     # Pydantic request/response models
│   │   ├── auth.py
│   │   ├── job.py
│   │   ├── candidate.py
│   │   ├── interview.py
│   │   ├── scorecard.py
│   │   ├── email.py
│   │   ├── ai.py
│   │   ├── analytics.py
│   │   ├── career.py
│   │   ├── copilot.py
│   │   └── pipeline.py
│   │
│   ├── routers/                     # FastAPI route handlers
│   │   ├── auth.py                  # Login/refresh/logout + admin CRUD
│   │   ├── jobs.py                  # Job CRUD
│   │   ├── candidates.py            # Candidate CRUD + filters
│   │   ├── pipeline.py              # Stage moves
│   │   ├── interviews.py            # Interview scheduling
│   │   ├── scorecards.py            # Scorecard CRUD
│   │   ├── emails.py                # Email send + templates
│   │   ├── ai.py                    # All AI endpoints
│   │   ├── analytics.py             # Stats + chart data
│   │   ├── uploads.py               # Resume upload
│   │   ├── career.py                # Public job board
│   │   └── copilot.py               # Live copilot WebSocket
│   │
│   ├── services/                    # Business logic/services
│   │   ├── ai_service.py            # OpenAI API calls
│   │   ├── resume_parser.py         # PDF/DOCX text extraction
│   │   ├── email_service.py         # SMTP email sending
│   │   ├── auth_service.py          # JWT auth logic
│   │   ├── analytics_service.py     # Aggregation queries
│   │   └── realtime/                # Copilot services
│   │       ├── orchestrator.py      # Coaching orchestration
│   │       ├── session_manager.py   # Session state
│   │       ├── trigger_engine.py    # Trigger logic
│   │       ├── llm_router.py       # Provider routing
│   │       ├── schemas.py           # Pydantic models
│   │       ├── source_adapters/     # Transcript sources
│   │       │   └── local_simulator.py
│   │       └── providers/           # LLM implementations
│   │           ├── openai_provider.py
│   │           ├── anthropic_provider.py
│   │           └── ollama_provider.py
│   │
│   ├── dependencies/                # FastAPI dependencies
│   │   └── auth.py                  # require_auth / require_role
│   │
│   └── alembic/                     # Database migrations
│       └── versions/
│           ├── 0001_initial_schema.py
│           ├── a57565ad8876_add_resume_text_and_ai_score.py
│           ├── b3a1c9f7d204_add_interview_questions_to_jobs.py
│           └── c4e2d8b1f305_add_users_table.py
│
├── frontend/
│   ├── index.html                   # Main SPA shell
│   ├── login.html                   # Login page
│   ├── career.html                  # Public careers page
│   │
│   ├── css/
│   │   ├── variables.css            # Design tokens
│   │   ├── reset.css                # CSS reset
│   │   ├── global.css               # Shared styles
│   │   ├── dashboard.css
│   │   └── career.css
│   │
│   ├── js/
│   │   ├── app.js                   # Hash-based SPA router
│   │   ├── api.js                   # Fetch wrapper
│   │   │
│   │   ├── pages/                   # Page modules
│   │   │   ├── dashboard.js
│   │   │   ├── analytics.js
│   │   │   ├── jobs.js
│   │   │   ├── jobCreate.js
│   │   │   ├── jobDetail.js
│   │   │   ├── candidates.js
│   │   │   ├── candidateProfile.js
│   │   │   ├── pipeline.js
│   │   │   ├── interviews.js
│   │   │   ├── scorecard.js
│   │   │   ├── emails.js
│   │   │   ├── adminUsers.js
│   │   │   └── career.js
│   │   │
│   │   └── components/              # Reusable UI components
│   │       ├── sidebar.js
│   │       ├── topbar.js
│   │       ├── modal.js
│   │       ├── toast.js
│   │       ├── table.js
│   │       ├── kanban.js
│   │       ├── charts.js
│   │       ├── biasAuditor.js
│   │       └── loader.js
│   │
│   └── react-copilot/               # Copilot React micro-frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── lib/
│       │   ├── pages/
│       │   ├── store/               # Zustand stores
│       │   ├── types/
│       │   └── styles.css
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── requirements.txt                 # Python dependencies
├── README.md                        # Setup instructions
├── notes.txt                         # AI prompt locations reference
└── PROJECT.md                        # This file
```

---

## Database Schema

### Core Models

#### User
- `id` (UUID, primary key)
- `email` (unique)
- `hashed_password`
- `full_name`
- `role` (admin/recruiter/viewer)
- `is_active`
- `created_at`, `updated_at`

#### Job
- `id` (primary key)
- `title`, `department`, `location`, `job_type`
- `description`, `requirements`, `benefits`
- `status` (draft/open/closed)
- `salary_min`, `salary_max`
- `interview_questions` (JSON, AI-generated)
- `created_at`, `updated_at`

#### Candidate
- `id` (primary key)
- `name`, `email`, `phone`
- `job_id` (foreign key)
- `stage` (applied/screening/interview/offer/hired/rejected)
- `resume_url`, `resume_text` (extracted text)
- `cover_letter`
- `ai_match_score` (0-100)
- `star_rating`
- `tags` (array)
- `notes`, `source`
- `created_at`, `updated_at`

#### Interview
- `id` (primary key)
- `candidate_id`, `job_id` (foreign keys)
- `interviewer_name`
- `scheduled_at`, `duration_minutes`
- `status` (scheduled/completed/cancelled)
- `notes`
- `created_at`, `updated_at`

#### Scorecard
- `id` (primary key)
- `interview_id` (foreign key)
- `overall_rating` (1-5)
- `technical_skills`, `communication`, `culture_fit`
- `strengths`, `weaknesses`, `notes`
- `recommendation` (hire/no_hire)
- `created_at`

#### EmailLog
- `id` (primary key)
- `candidate_id` (foreign key)
- `subject`, `body`
- `sent_at`
- `status` (sent/failed)

#### EmailTemplate
- `id` (primary key)
- `name`, `subject`, `body_template`
- `intent` (outreach/follow_up/interview/rejection/offer)

#### Activity
- `id` (primary key)
- `candidate_id` (foreign key)
- `action_type`, `description`
- `metadata` (JSON)
- `created_at`

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Login with email/password |
| POST | `/refresh` | Refresh access token |
| POST | `/logout` | Logout user |
| GET | `/me` | Get current user |
| GET | `/users` | List users (admin only) |
| POST | `/users` | Create user (admin only) |
| DELETE | `/users/{id}` | Delete user (admin only) |

### Jobs (`/api/jobs`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all jobs |
| POST | `/` | Create new job |
| GET | `/{id}` | Get job by ID |
| PUT | `/{id}` | Update job |
| DELETE | `/{id}` | Delete job |

### Candidates (`/api/candidates`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List candidates (filterable) |
| POST | `/` | Create candidate |
| GET | `/{id}` | Get candidate details |
| PUT | `/{id}` | Update candidate |
| DELETE | `/{id}` | Delete candidate |
| POST | `/{id}/star` | Toggle star rating |

### Pipeline (`/api/pipeline`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/move` | Move candidate to stage |

### Interviews (`/api/interviews`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List interviews |
| POST | `/` | Schedule interview |
| GET | `/{id}` | Get interview details |
| PUT | `/{id}` | Update interview |
| DELETE | `/{id}` | Cancel interview |

### Scorecards (`/api/scorecards`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/interview/{id}` | Get scorecard |
| POST | `/interview/{id}` | Create/update scorecard |

### Emails (`/api/emails`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates` | List email templates |
| POST | `/templates` | Create template |
| POST | `/send` | Send email to candidate |

### AI (`/api/ai`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate-jd` | Generate job description |
| POST | `/compose-email` | Compose candidate email |
| POST | `/rank-candidate` | Score candidate match |
| POST | `/interview-questions` | Generate interview questions |
| GET | `/interview-questions/{job_id}` | Get stored questions |
| POST | `/talent-pool-match` | Find matching candidates |
| POST | `/bias-check` | Audit for bias |
| GET | `/ghosting-risk/{candidate_id}` | Get ghosting risk score |
| POST | `/interview-debrief` | Generate interview debrief |

### Copilot (`/api/copilot`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions` | Create copilot session |
| POST | `/sessions/{id}/ws-ticket` | Refresh WebSocket ticket |
| WS | `/ws/{session_id}` | WebSocket connection |

### Analytics (`/api/analytics`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard stats |
| GET | `/funnel` | Pipeline funnel data |
| GET | `/sources` | Candidate sources |
| GET | `/trends` | Time-based trends |

### Uploads (`/api/uploads`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resume` | Upload resume file |

### Career (`/api/career`) - Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | Public job listings |
| GET | `/jobs/{id}` | Job details |
| POST | `/apply` | Submit application |

---

## Development Workflow

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- OpenAI API key
- Node.js 18+ (for Copilot frontend build)
- Redis (optional, for Copilot scaling)

### Setup

```bash
# 1. Clone and setup environment
cd backend
python -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
pip install "passlib[bcrypt]" "python-jose[cryptography]" "bcrypt==4.0.1"

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Create database
createdb shyfthatch

# 4. Run migrations
alembic upgrade head

# 5. Create admin user
python manage_users.py create

# 6. Seed demo data (optional)
python seed.py

# 7. Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 8. Build Copilot frontend (optional)
cd ../frontend/react-copilot
npm install
npm run build
```

### Migrations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Development URLs
- Main App: `http://localhost:8000/`
- Login: `http://localhost:8000/login`
- Career Page: `http://localhost:8000/career`
- Copilot: `http://localhost:8000/copilot`
- API Docs (debug): `http://localhost:8000/api/docs`
- ReDoc (debug): `http://localhost:8000/api/redoc`

---

## Key Technical Details

### Authentication Flow
1. User logs in → receives HTTP-only cookie with access token
2. Access token expires in 1 hour (configurable)
3. Refresh token valid for 7 days
4. Frontend checks auth on load, attempts silent refresh
5. 401 responses redirect to `/login`

### AI Service Integration
- Uses OpenAI GPT for all AI features
- Prompts are stored in `backend/services/ai_service.py` and `backend/services/realtime/orchestrator.py`
- All AI responses include JSON parsing validation
- Error handling with fallback behavior

### Resume Processing
- Supports PDF and DOCX formats
- Maximum file size: 5MB
- Extracted text stored in `candidates.resume_text`
- Used for AI ranking and matching
- Files stored in `backend/uploads/resumes/` with UUID prefix

### Ghosting Risk Algorithm
Rule-based scoring (0-100) considering:
- Time in current stage
- Days since last email
- Upcoming interview status
- Activity score (touchpoints)

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation disabled)
- `Strict-Transport-Security` (production only)

### CORS Configuration
- Configured via `ALLOWED_ORIGINS` in `.env`
- Supports credentials (cookies)
- Comma-separated list for production

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/shyfthatch

# OpenAI
OPENAI_API_KEY=sk-...

# Server
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=true
UPLOAD_DIR=uploads

# JWT
JWT_SECRET=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000

# SMTP (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your_app_password

# Redis (Copilot)
REDIS_URL=redis://localhost:6379/0

# Anthropic / Ollama (Copilot providers)
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

# Copilot Settings
COPILOT_TRIGGER_SILENCE_MS=1500
COPILOT_TRIGGER_MAX_WAIT_MS=5000
COPILOT_WS_TICKET_EXPIRY_SEC=60
COPILOT_SESSION_MAX_AGE_SEC=7200
COPILOT_DEFAULT_PROVIDER=openai
COPILOT_MODEL_OPENAI=gpt-4o
COPILOT_MODEL_ANTHROPIC=claude-sonnet-4-20250514
COPILOT_MODEL_OLLAMA=kimi-k2.5:cloud
```

---

## Recent Developments

### Phase 2: Source Adapter Abstraction & Edge Case Hardening (Completed)
- **Transcript Decoupling:** Abstracted transcript ingestion via a `TranscriptSourceAdapter` interface, allowing hot-swapping between a local simulator and external live sources (like MeetStream) without touching core WebSocket or orchestration logic.
- **Edge Case Hardening:** Enhanced the Copilot to gracefully handle rapid-fire, back-to-back questions. Implemented configurable strategies (`queue` or `cancel_restart`) to manage overlapping trigger events.
- **Context Awareness:** Confirmed sliding context windows maintain recent Q&A pairs seamlessly across consecutive triggers.

### Live Interview Copilot (Latest Feature)
- Real-time WebSocket-based interview coaching
- Supports multiple LLM providers (OpenAI, Anthropic, Ollama)
- Redis pub/sub for multi-instance scaling
- Intelligent transcript buffering with dual triggers
- Standalone React micro-frontend for dedicated UI
- Configured via environment variables

### AI Models Used
- Default: GPT-4o for Copilot
- Anthropic: Claude Sonnet 4
- Ollama: Configurable local models
- All AI endpoints use GPT-5 (legacy naming retained)

---

## Future Considerations

1. **Phase 3: MeetStream Integration (Next Step):**
   - Implement the actual WebSocket connection inside the `MeetStreamAdapter` stub.
   - Configure live transcript ingestion directly from MeetStream's API payloads into our standardized `TranscriptChunk` schema.

2. **Copilot Enhancements:**
   - Sentiment analysis during interviews
   - Auto-generated interview summaries
   - Multi-language support

3. **ATS Improvements:**
   - Calendar integration (Google, Outlook)
   - Email tracking and opens
   - Bulk actions for candidates
   - Custom pipeline stages

4. **AI Expansion:**
   - Resume parsing improvements
   - Skill extraction and matching
   - Automated screening recommendations
   - Diversity and inclusion scoring

---

## Notes

- The `notes.txt` file contains paths to editable AI prompts in the codebase
- All prompts can be customized in `backend/services/ai_service.py` and `backend/services/realtime/orchestrator.py`
- The project follows a zero-build-step philosophy for the main SPA (vanilla JS)
- Only the Copilot uses React + TypeScript + Vite build pipeline

---

## License

Private/Proprietary - Contact project owner for licensing information.