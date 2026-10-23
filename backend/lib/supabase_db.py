"""Supabase Postgres connection (SQLAlchemy async + asyncpg). Only used when DATABASE_URL is set.

DATABASE_URL must be the Supabase *Transaction Pooler* URI:
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_engine = None
_Session: async_sessionmaker[AsyncSession] | None = None


def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _engine, _Session
    if _Session is None:
        url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://", 1)
        _engine = create_async_engine(
            url,
            pool_size=10,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=False,
            echo=False,
            connect_args={"statement_cache_size": 0, "command_timeout": 30},  # required by the transaction pooler
        )
        _Session = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    return _Session


@asynccontextmanager
async def session_scope():
    async with _sessionmaker()() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def dispose() -> None:
    if _engine is not None:
        await _engine.dispose()
