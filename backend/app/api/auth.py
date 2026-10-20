import os
import uuid
from hmac import compare_digest
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.models.models import User
from backend.app.schemas.schemas import AdminLogin, PasswordReset, UserCreate, UserLogin, UserProfileUpdate
from backend.app.core.database import get_db
from backend.app.core.security import hash_password, verify_password, create_access_token, require_own_account

router = APIRouter(prefix="/auth", tags=["Auth"])

def _valid_password(password: str) -> bool:
    return 8 <= len(password) <= 128

def _password_matches(plain: str, stored: str) -> bool:
    return verify_password(plain, stored)

def _user_payload(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "admission_number": user.admission_number,
        "name": user.name,
        "department": user.department,
        "email": user.email,
        "class_name": user.class_name,
        "contact_no": user.contact_no,
        "access_token": create_access_token({"sub": user.user_id, "role": "student"}),
    }

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.admission_number == data.admission_number).first()

    if not user or not _password_matches(data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid admission number or password")
    return {"message": "Login successful", **_user_payload(user)}

@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):
    data.admission_number = data.admission_number.strip()
    data.email = data.email.lower().strip()
    if not _valid_password(data.password):
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")
    if db.query(User).filter(User.admission_number == data.admission_number).first():
        raise HTTPException(status_code=400, detail="Admission number is already registered")
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    user = User(
        user_id=str(uuid.uuid4()),
        admission_number=data.admission_number.strip(),
        name=data.name.strip(),
        department=data.department.strip(),
        email=data.email.lower().strip(),
        password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Account created", **_user_payload(user)}

@router.post("/password-reset")
def password_reset(data: PasswordReset, db: Session = Depends(get_db)):
    # This local-demo reset deliberately requires both values. Production must use
    # an emailed OTP or identity-provider verification before enabling this route.
    if os.getenv("APP_ENV") == "production" or os.getenv("ALLOW_DEMO_PASSWORD_RESET", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Password reset is disabled by the administrator")
    if not _valid_password(data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")
    user = db.query(User).filter(
        User.admission_number == data.admission_number.strip(),
        User.email == data.email.lower().strip(),
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Admission number and email do not match an account")
    user.password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated. Please sign in with your new password."}

@router.post("/admin/login")
def admin_login(data: AdminLogin):
    expected_email = os.getenv("ADMIN_EMAIL", "")
    expected_password = os.getenv("ADMIN_PASSWORD", "")
    if not expected_email or len(expected_password) < 12:
        raise HTTPException(status_code=503, detail="Administrator login is not configured")
    if not (compare_digest(data.email.lower().strip(), expected_email.lower()) and compare_digest(data.password, expected_password)):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"message": "Admin login successful", "email": expected_email,
            "access_token": create_access_token({"sub": expected_email, "role": "admin"})}


@router.put("/profile/{admission_number}", dependencies=[Depends(require_own_account)])
def update_profile(admission_number: str, profile_data: UserProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.admission_number == admission_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update only fields that are provided
    if profile_data.name is not None:
        user.name = profile_data.name
    if profile_data.department is not None:
        user.department = profile_data.department
    if profile_data.class_name is not None:
        user.class_name = profile_data.class_name
    if profile_data.contact_no is not None:
        user.contact_no = profile_data.contact_no

    # db.commit() will save the changes directly to MySQL
    db.commit()
    db.refresh(user)

    return {"message": "Profile updated successfully", "user": {"name": user.name, "department": user.department, "class": user.class_name, "contact_no": user.contact_no}}
