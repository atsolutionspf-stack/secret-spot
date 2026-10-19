"""Admin PIN session: a signed JWT in an httpOnly cookie."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request, Response

COOKIE = "ss_admin"
ALGO = "HS256"


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def issue_session(response: Response) -> None:
    token = jwt.encode(
        {"role": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
        _secret(),
        algorithm=ALGO,
    )
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=True, max_age=12 * 3600, path="/")


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


def is_admin(request: Request) -> bool:
    token = request.cookies.get(COOKIE)
    if not token:
        return False
    try:
        jwt.decode(token, _secret(), algorithms=[ALGO])
        return True
    except jwt.PyJWTError:
        return False


async def require_admin(request: Request) -> None:
    if not is_admin(request):
        raise HTTPException(status_code=401, detail="unauthorized")
