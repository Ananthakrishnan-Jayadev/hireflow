import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import settings
from dependencies.auth import require_auth

from routers.auth import router as auth_router
from routers.jobs import router as jobs_router
from routers.ai import router as ai_router
from routers.candidates import router as candidates_router
from routers.pipeline import router as pipeline_router
from routers.interviews import router as interviews_router
from routers.emails import router as emails_router
from routers.career import router as career_router
from routers.analytics import router as analytics_router
from routers.uploads import router as uploads_router
from routers.copilot import router as copilot_router, shutdown_copilot_services
from routers.meetstream_webhook import router as meetstream_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await shutdown_copilot_services()
    from database import engine
    await engine.dispose()


# Hide internal details from error responses in production
app = FastAPI(
    title="HireFlow API",
    description="AI-powered recruitment platform API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable the /docs and /redoc endpoints in production
    docs_url="/api/docs" if settings.APP_DEBUG else None,
    redoc_url="/api/redoc" if settings.APP_DEBUG else None,
    openapi_url="/api/openapi.json" if settings.APP_DEBUG else None,
)

# ── Security headers middleware ───────────────────────────────────────────

@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not settings.APP_DEBUG:
        # Only set HSTS in production (HTTPS)
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response

# ── CORS ─────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# ── Auth router (public — no auth dependency) ─────────────────────────────
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# ── Career router (public — no auth dependency) ───────────────────────────
app.include_router(career_router, prefix="/api/career", tags=["career"])

# ── Protected internal routers ────────────────────────────────────────────
# Every route in these routers requires a valid JWT.
_auth = [Depends(require_auth)]

app.include_router(jobs_router,        prefix="/api/jobs",        tags=["jobs"],        dependencies=_auth)
app.include_router(ai_router,          prefix="/api/ai",          tags=["ai"],          dependencies=_auth)
app.include_router(candidates_router,  prefix="/api/candidates",  tags=["candidates"],  dependencies=_auth)
app.include_router(pipeline_router,    prefix="/api/pipeline",    tags=["pipeline"],    dependencies=_auth)
app.include_router(interviews_router,  prefix="/api/interviews",  tags=["interviews"],  dependencies=_auth)
app.include_router(emails_router,      prefix="/api/emails",      tags=["emails"],      dependencies=_auth)
app.include_router(analytics_router,   prefix="/api/analytics",   tags=["analytics"],   dependencies=_auth)
app.include_router(uploads_router,     prefix="/api/uploads",     tags=["uploads"],     dependencies=_auth)
app.include_router(copilot_router,     prefix="/api/copilot",     tags=["copilot"])
app.include_router(meetstream_router)


# ── Health check (public) ─────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


# ── Static file serving ───────────────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")


@app.get("/career")
@app.get("/career.html")
async def career_page():
    career_file = os.path.join(FRONTEND_DIST, "career.html")
    if os.path.isfile(career_file):
        return FileResponse(career_file)
    return {
        "message": "React career page not built yet. Run: cd frontend && npm install && npm run build"
    }


@app.middleware("http")
async def no_cache_html(request: Request, call_next) -> Response:
    """Prevent browsers from caching the SPA entry point."""
    response = await call_next(request)
    if request.url.path in ("/", "/index.html") or not request.url.path.startswith("/static/"):
        if response.headers.get("content-type", "").startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"]        = "no-cache"
            response.headers["Expires"]       = "0"
    return response

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), settings.UPLOAD_DIR)
os.makedirs(UPLOADS_DIR, exist_ok=True)

app.mount("/assets",  StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR),                           name="uploads")

REACT_STATIC = os.path.join(FRONTEND_DIST, "static")
if os.path.isdir(REACT_STATIC):
    app.mount("/static", StaticFiles(directory=REACT_STATIC), name="react_static")


@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    """Serve the React SPA for all non-API routes."""
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {
        "message": "React app not built yet. Run: cd frontend && npm install && npm run build"
    }
