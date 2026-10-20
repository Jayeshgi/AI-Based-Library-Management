import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import User

SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(48)
if os.getenv("APP_ENV") == "production" and len(os.getenv("SECRET_KEY", "")) < 32:
    raise RuntimeError("Production requires a SECRET_KEY of at least 32 characters")

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain, hashed):
    # Never accept legacy plaintext/demo or OAuth placeholder passwords.
    if not hashed or not hashed.startswith(("$pbkdf2-sha256$", "$2")):
        return False
    try:
        return pwd_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict):
    return jwt.encode({**data, "exp": datetime.now(timezone.utc) + timedelta(hours=2)}, SECRET_KEY, algorithm="HS256")


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"require_exp": True, "require_sub": True})
        if payload.get("role") not in ("student", "admin", "google_signup"):
            raise JWTError("Invalid role")
        return payload
    except (JWTError, TypeError):
        raise HTTPException(status_code=401, detail="Please sign in again")


def current_identity(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please sign in")
    return verify_token(credentials.credentials)


def require_admin(identity: dict = Depends(current_identity)):
    if identity["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return identity


def current_student(identity: dict = Depends(current_identity), db: Session = Depends(get_db)):
    if identity["role"] != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    user = db.get(User, identity["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists")
    return user


def require_own_account(admission_number: str, user: User = Depends(current_student)):
    if user.admission_number != admission_number:
        raise HTTPException(status_code=403, detail="You can only access your own account")
    return user
