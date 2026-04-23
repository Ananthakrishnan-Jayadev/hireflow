"""
User management script for ShyftHatch.

Commands:
    python manage_users.py create   — interactively create a new user
    python manage_users.py list     — list all users
    python manage_users.py delete   — delete a user by email

Environment variable shortcuts (skip the interactive prompts):
    USER_EMAIL=... USER_PASSWORD=... USER_NAME=... USER_ROLE=recruiter python manage_users.py create
"""
import asyncio
import getpass
import os
import sys

from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import AsyncSessionLocal
from models.user import User
from services.auth_service import hash_password

VALID_ROLES = ["admin", "recruiter", "viewer"]


# ── Helpers ───────────────────────────────────────────────────────────────

def _prompt(prompt_text: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{prompt_text}{suffix}: ").strip()
    return value if value else default


def _prompt_password() -> str:
    while True:
        pwd = getpass.getpass("Password (min 8 chars, 1 letter + 1 digit): ")
        if len(pwd) < 8:
            print("  Too short — must be at least 8 characters.")
            continue
        confirm = getpass.getpass("Confirm password: ")
        if pwd != confirm:
            print("  Passwords do not match. Try again.")
            continue
        return pwd


# ── Commands ──────────────────────────────────────────────────────────────

async def cmd_create() -> None:
    email    = os.environ.get("USER_EMAIL",    "")
    password = os.environ.get("USER_PASSWORD", "")
    name     = os.environ.get("USER_NAME",     "")
    role     = os.environ.get("USER_ROLE",     "")

    print("\n── Create new user ──────────────────────────────")
    if not email:
        email = _prompt("Email")
    if not email:
        print("ERROR: Email is required.")
        sys.exit(1)

    if not name:
        name = _prompt("Full name", "")

    if not role or role not in VALID_ROLES:
        print(f"Role options: {', '.join(VALID_ROLES)}")
        role = _prompt("Role", "recruiter")
        if role not in VALID_ROLES:
            print(f"ERROR: Role must be one of: {', '.join(VALID_ROLES)}")
            sys.exit(1)

    if not password:
        password = _prompt_password()

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            print(f"\nUser '{email}' already exists (role: {existing.role}). No changes made.")
            return

        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=name or None,
            role=role,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        print(f"\n✓ User created: {email} (role: {role})")


async def cmd_list() -> None:
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User).order_by(User.created_at))).scalars().all()

    if not users:
        print("No users found.")
        return

    print(f"\n{'ID':<5} {'Email':<35} {'Name':<20} {'Role':<12} {'Active'}")
    print("─" * 80)
    for u in users:
        active = "Yes" if u.is_active else "No"
        print(f"{u.id:<5} {u.email:<35} {(u.full_name or ''):<20} {u.role:<12} {active}")
    print()


async def cmd_delete() -> None:
    email = os.environ.get("USER_EMAIL", "") or _prompt("Email of user to delete")
    if not email:
        print("ERROR: Email is required.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            print(f"User '{email}' not found.")
            return

        confirm = input(f"Delete '{email}' (role: {user.role})? Type YES to confirm: ").strip()
        if confirm != "YES":
            print("Aborted.")
            return

        await db.delete(user)
        await db.commit()
        print(f"✓ User '{email}' deleted.")


# ── Entry point ───────────────────────────────────────────────────────────

COMMANDS = {"create": cmd_create, "list": cmd_list, "delete": cmd_delete}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in COMMANDS:
        print(f"Usage: python {os.path.basename(__file__)} <{'|'.join(COMMANDS)}>")
        sys.exit(1)
    asyncio.run(COMMANDS[cmd]())

