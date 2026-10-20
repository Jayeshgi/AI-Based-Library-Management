import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '.env')
load_dotenv(_env_path, override=False)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")
if DATABASE_URL.startswith(("postgres://", "postgresql://")):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.split("://", 1)[1]
if os.getenv("APP_ENV") == "production" and not DATABASE_URL.startswith("postgresql+psycopg://"):
    raise RuntimeError("Production requires a persistent PostgreSQL DATABASE_URL")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
