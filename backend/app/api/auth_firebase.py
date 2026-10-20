import uuid
from fastapi import APIRouter, HTTPException, Depends
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.models.models import User
from backend.app.schemas.schemas import GoogleUserCompleteProfile, GoogleUserCreateCredentials
from backend.app.core.security import hash_password, create_access_token, current_identity
from backend.app.api.auth import _user_payload, _valid_password

router = APIRouter(prefix="/auth/google", tags=["Google Authentication"])

class TokenRequest(BaseModel):
    id_token: str

@router.post("/login")
def google_login(token: TokenRequest, db: Session = Depends(get_db)):
    try:
        # Set clock_skew_seconds to 10 to handle slight clock drift between client and server
        decoded_token = firebase_auth.verify_id_token(token.id_token, clock_skew_seconds=10)
        email = (decoded_token.get("email") or "").lower().strip()
        name = decoded_token.get("name")

        if not email or not decoded_token.get("email_verified", False):
            raise HTTPException(
                status_code=403,
                detail="Please sign in with a verified Google email address"
            )

        # Check if the user already exists in MySQL
        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            return {
                "message": "login successful",
                "new_user": False,
                "user_id": existing_user.user_id,
                "admission_number": existing_user.admission_number,
                "name": existing_user.name,
                "department": existing_user.department,
                "email": existing_user.email,
                "class_name": existing_user.class_name,
                "contact_no": existing_user.contact_no,
                "access_token": create_access_token({"sub": existing_user.user_id, "role": "student"})
            }
        else:
            # User is not in DB. Send flag 'new_user: true' so UI can prompt for admission_number, department, etc.
            return {
                "message": "User not found. Please complete profile.",
                "new_user": True,
                "email": email,
                "name": name,
                "access_token": create_access_token({"sub": email, "role": "google_signup"})
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified")

@router.post("/create-credentials")
def create_credentials(data: GoogleUserCreateCredentials, db: Session = Depends(get_db), identity: dict = Depends(current_identity)):
    """ Endpoint to hit when a new Google user provides their admission number and password on the Login page. """
    if identity["role"] != "google_signup" or identity["sub"] != data.email.lower().strip():
        raise HTTPException(status_code=403, detail="Verify this Google account first")
    if not _valid_password(data.password):
        raise HTTPException(status_code=400, detail="Password must contain 8 to 128 characters")
    data.email = identity["sub"]
    data.admission_number = data.admission_number.strip()
    existing_user_adm = db.query(User).filter(User.admission_number == data.admission_number).first()
    if existing_user_adm:
        raise HTTPException(status_code=400, detail="Admission number already in use.")
        
    existing_user_email = db.query(User).filter(User.email == data.email).first()
    if existing_user_email:
        raise HTTPException(status_code=400, detail="Email already registered.")

    new_user = User(
        user_id=str(uuid.uuid4()), # Generate a unique user_id
        admission_number=data.admission_number,
        password=hash_password(data.password),
        name=data.name,
        department=data.department,
        email=data.email
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "Credentials successful",
        "new_user": True,
        "user_id": new_user.user_id,
        "admission_number": new_user.admission_number,
        "name": new_user.name,
        "email": new_user.email,
        **_user_payload(new_user)
    }


@router.post("/complete-profile")
def complete_profile(data: GoogleUserCompleteProfile, db: Session = Depends(get_db), identity: dict = Depends(current_identity)):
    """ Endpoint to hit after the user fills the new user popup with their details. """
    if identity["role"] != "google_signup" or identity["sub"] != data.email.lower().strip():
        raise HTTPException(status_code=403, detail="Verify this Google account first")
    data.email = identity["sub"]
    data.admission_number = data.admission_number.strip()
    existing_user_adm = db.query(User).filter(User.admission_number == data.admission_number).first()
    if existing_user_adm:
        raise HTTPException(status_code=400, detail="Admission number already in use.")
        
    existing_user_email = db.query(User).filter(User.email == data.email).first()
    if existing_user_email:
        raise HTTPException(status_code=400, detail="Email already registered.")

    new_user = User(
        user_id=str(uuid.uuid4()), # Generate a unique user_id
        admission_number=data.admission_number,
        password="!", # Google-only accounts cannot use password login.
        name=data.name,
        department=data.department,
        email=data.email,
        class_name=data.class_name,
        contact_no=data.contact_no
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "Registration successful",
        "user_id": new_user.user_id,
        **_user_payload(new_user)
    }
