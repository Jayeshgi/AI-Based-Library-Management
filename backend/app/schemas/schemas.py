from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import date, time

# User Schemas
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    contact_no: Optional[str] = None
    # email is NOT editable

class UserLogin(BaseModel):
    admission_number: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    password: str = Field(min_length=1, max_length=128)

class UserCreate(BaseModel):
    admission_number: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=255)
    department: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class PasswordReset(BaseModel):
    admission_number: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    email: EmailStr
    new_password: str = Field(min_length=1, max_length=128)

class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class GoogleUserCompleteProfile(BaseModel):
    admission_number: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=255)
    department: str = Field(min_length=1, max_length=100)
    class_name: Optional[str] = None
    contact_no: Optional[str] = None
    email: EmailStr # Provided by google

class GoogleUserCreateCredentials(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    admission_number: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    department: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)

# Borrowed Books Schema
class BorrowRequest(BaseModel):
    admission_number: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    book_id: str
