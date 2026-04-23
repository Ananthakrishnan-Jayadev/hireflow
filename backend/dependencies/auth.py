"""
FastAPI dependencies for authentication.

Usage in a protected route:
    from dependencies.auth import require_auth, require_role

    @router.get("/")
    async def list_jobs(current_user = Depends(require_auth)):
        ...

    @router.delete("/{id}")
    async def delete_job(id: int, current_user = Depends(require_role("admin"))):
        ...
"""
from typing import Callable

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from services.auth_service import decode_access_token

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated. Please log in.",
    headers={"WWW-Authenticate": "Bearer"},
)

_INACTIVE = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Account is inactive.",
)


async def require_auth(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT from either:
      - Authorization: Bearer <token>  header
      - access_token cookie
    Returns the authenticated User ORM object.
    """
    token: str | None = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    elif access_token:
        token = access_token

    if not token:
        raise _UNAUTHORIZED

    payload = decode_access_token(token)
    if not payload:
        raise _UNAUTHORIZED

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise _UNAUTHORIZED

    user = await db.get(User, user_id)
    if not user:
        raise _UNAUTHORIZED
    if not user.is_active:
        raise _INACTIVE

    return user


def require_role(*roles: str) -> Callable:
    """
    Dependency factory that enforces one of the given roles.
    Example:  Depends(require_role("admin"))
              Depends(require_role("admin", "recruiter"))
    """
    async def _check(current_user: User = Depends(require_auth)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {', '.join(roles)}.",
            )
        return current_user

    return _check
