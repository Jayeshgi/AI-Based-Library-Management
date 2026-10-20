from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from pydantic import BaseModel, Field
from typing import Optional
import random
from backend.app.models.models import User, Book, BorrowedBook, Review
from backend.app.core.database import get_db
from backend.app.core.security import require_admin, require_own_account, current_student

router = APIRouter(tags=["Library"])

@router.get("/books")
def get_all_books(db: Session = Depends(get_db)):
    """
    Fetches the complete catalog of books from MySQL.
    """
    books = db.query(Book).all()
    return books

@router.get("/user-borrow-history/{admission_number}", dependencies=[Depends(require_own_account)])
def get_user_borrow_history(admission_number: str, db: Session = Depends(get_db)):
    """
    Fetches the complete borrowing history for a student from MySQL.
    """
    user = db.query(User).filter(User.admission_number == admission_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    history = db.query(BorrowedBook).filter(BorrowedBook.user_id == user.user_id).order_by(BorrowedBook.issue_id.desc()).all()
    
    if not history:
        return {"message": "No borrowing history found", "history": []}

    results = []
    for record in history:
        book = db.query(Book).filter(Book.book_id == record.Book_ID).first()
        
        # Check if user already reviewed this exact book
        existing_review = db.query(Review).filter(
            Review.book_id == record.Book_ID,
            Review.user_id == user.user_id
        ).first()
        
        results.append({
            "issue_id": record.issue_id,
            "book_id": record.Book_ID,
            "book_title": book.title if book else record.Book_ID,
            "author": book.author if book else "Unknown",
            "b_date": record.b_date.strftime("%Y-%m-%d") if record.b_date else None,
            "r_date": record.r_date.strftime("%Y-%m-%d") if record.r_date else None,
            "status": record.status,
            "has_reviewed": bool(existing_review)
        })

    return results

@router.get("/user-active-borrows/{admission_number}", dependencies=[Depends(require_own_account)])
def get_user_active_borrows(admission_number: str, db: Session = Depends(get_db)):
    """
    Fetches currently issued books for the dashboard.
    """
    user = db.query(User).filter(User.admission_number == admission_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    active = db.query(BorrowedBook).filter(
        BorrowedBook.user_id == user.user_id,
        BorrowedBook.status == "issued"
    ).order_by(BorrowedBook.issue_id.desc()).all()

    if not active:
        return {"message": "No books borrowed yet", "active_borrows": []}

    # Enrich with book titles for the dashboard cards
    results = []
    for record in active:
        book = db.query(Book).filter(Book.book_id == record.Book_ID).first()
        results.append({
            "issue_id": record.issue_id,
            "book_id": record.Book_ID,
            "book_title": book.title if book else record.Book_ID,
            "author": book.author if book else "Unknown",
            "b_date": record.b_date.strftime("%Y-%m-%d") if record.b_date else None,
            "r_date": record.r_date.strftime("%Y-%m-%d") if record.r_date else None,
            "status": record.status
        })

    return results

@router.post("/borrow", dependencies=[Depends(require_admin)])
def borrow_book(admission_number: str, book_id: str, db: Session = Depends(get_db)):
    """
    API endpoint for borrowing a book (Syncs with the chatbot logic).
    """
    user = db.query(User).filter(User.admission_number == admission_number).first()
    book = db.query(Book).filter(Book.book_id == book_id).with_for_update().first()

    if not user or not book:
        raise HTTPException(status_code=404, detail="User or Book not found")

    if book.available_copies <= 0:
        raise HTTPException(status_code=400, detail="Book out of stock")

    # Check if already issued
    existing = db.query(BorrowedBook).filter(
        BorrowedBook.user_id == user.user_id,
        BorrowedBook.Book_ID == book_id,
        BorrowedBook.status == "issued"
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Book already issued to this user")

    # Transaction
    book.available_copies -= 1
    new_record = BorrowedBook(
        user_id=user.user_id,
        Book_ID=book_id,
        b_date=datetime.now().date(),
        b_time=datetime.now().time(),
        status="issued"
    )
    db.add(new_record)
    db.commit()
    return {"message": "Book issued successfully", "book": book.title}


class ReviewCreate(BaseModel):
    book_id: str
    user_id: str
    review: str = Field(min_length=1, max_length=5000)

@router.post("/review")
def add_review(payload: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(current_student)):
    """
    Submits a user review for a specific book to the MySQL database.
    """
    if payload.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="You can only review as yourself")
    if db.get(Book, payload.book_id) is None:
        raise HTTPException(status_code=404, detail="Book not found")
    new_review = Review(
        book_id=payload.book_id,
        user_id=payload.user_id,
        review=payload.review
    )
    db.add(new_review)
    db.commit()
    
    return {"message": "Review submitted successfully!"}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/borrow-records", dependencies=[Depends(require_admin)])
def get_all_borrow_records(db: Session = Depends(get_db)):
    """
    Returns all borrow records with student names and book titles for the admin dashboard.
    Computes overdue status dynamically.
    """
    records = db.query(BorrowedBook).order_by(BorrowedBook.b_date.desc()).all()
    results = []
    today = date.today()

    for record in records:
        book = db.query(Book).filter(Book.book_id == record.Book_ID).first()
        user = db.query(User).filter(User.user_id == record.user_id).first()

        # Compute display status
        display_status = record.status or "issued"
        overdue_days = 0
        if record.status == "issued" and record.r_date:
            diff = (today - record.r_date).days
            if diff > 0:
                display_status = f"overdue"
                overdue_days = diff
        elif record.status == "returned":
            display_status = "returned"

        results.append({
            "issue_id": record.issue_id,
            "user_id": record.user_id,
            "student_name": user.name if user else record.user_id,
            "student_id": user.admission_number if user else record.user_id,
            "book_id": record.Book_ID,
            "book_title": book.title if book else record.Book_ID,
            "b_date": record.b_date.strftime("%Y-%m-%d") if record.b_date else None,
            "b_time": record.b_time.strftime("%H:%M") if record.b_time else None,
            "r_date": record.r_date.strftime("%Y-%m-%d") if record.r_date else None,
            "r_time": record.r_time.strftime("%H:%M") if record.r_time else None,
            "status": display_status,
            "overdue_days": overdue_days,
            "or_date": record.or_date.strftime("%Y-%m-%d") if record.or_date else None,
        })

    return results


@router.get("/admin/students", dependencies=[Depends(require_admin)])
def get_all_students(db: Session = Depends(get_db)):
    """
    Returns all students with their total and active borrow counts for the admin directory.
    """
    students = db.query(User).all()
    results = []

    for student in students:
        # Active borrows
        active_count = db.query(BorrowedBook).filter(
            BorrowedBook.user_id == student.user_id,
            BorrowedBook.status == "issued"
        ).count()
        
        # Total borrows (history)
        total_count = db.query(BorrowedBook).filter(
            BorrowedBook.user_id == student.user_id
        ).count()

        results.append({
            "user_id": student.user_id,
            "admission_number": student.admission_number,
            "name": student.name,
            "email": student.email,
            "department": student.department,
            "class_name": student.class_name,
            "contact_no": student.contact_no,
            "books_borrowed": active_count, # Keeping name for frontend compatibility
            "total_borrows": total_count,
        })

    return results


@router.get("/admin/student/{user_id}/borrows", dependencies=[Depends(require_admin)])
def get_student_borrow_details(user_id: str, db: Session = Depends(get_db)):
    """
    Returns detailed borrow history for a specific student (for View Details modal).
    """
    borrows = db.query(BorrowedBook).filter(BorrowedBook.user_id == user_id).order_by(BorrowedBook.b_date.desc()).all()
    results = []
    for record in borrows:
        book = db.query(Book).filter(Book.book_id == record.Book_ID).first()
        results.append({
            "issue_id": record.issue_id,
            "book_id": record.Book_ID,
            "book_title": book.title if book else record.Book_ID,
            "b_date": record.b_date.strftime("%Y-%m-%d") if record.b_date else None,
            "b_time": record.b_time.strftime("%H:%M:%S") if record.b_time else None,
            "r_date": record.r_date.strftime("%Y-%m-%d") if record.r_date else None,
            "r_time": record.r_time.strftime("%H:%M:%S") if record.r_time else None,
            "status": record.status,
        })
    return results


class BookCreate(BaseModel):
    title: str
    author: str
    department: str
    total_copies: int = Field(ge=0, le=100000)
    available_copies: Optional[int] = Field(default=None, ge=0, le=100000)
    column_dept: Optional[str] = None
    shelf_no: Optional[str] = None
    rack_no: Optional[str] = None


@router.post("/admin/books", dependencies=[Depends(require_admin)])
def add_book(payload: BookCreate, db: Session = Depends(get_db)):
    """
    Adds a new book with an auto-generated book_id (B-XXX format).
    """
    if payload.available_copies is not None and payload.available_copies > payload.total_copies:
        raise HTTPException(status_code=400, detail="Available copies cannot exceed total copies")
    # Auto-generate a unique book_id in B-XXX format
    existing_ids = set(
        row[0] for row in db.query(Book.book_id).all()
    )
    for _ in range(1000):
        rand_num = random.randint(100, 999)
        candidate = f"B-{rand_num}"
        if candidate not in existing_ids:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique book ID")

    new_book = Book(
        book_id=candidate,
        title=payload.title,
        author=payload.author,
        department=payload.department,
        total_copies=payload.total_copies,
        available_copies=payload.available_copies if payload.available_copies is not None else payload.total_copies,
        column_dept=payload.column_dept or payload.department,
        shelf_no=payload.shelf_no,
        rack_no=payload.rack_no,
    )
    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    return {"message": "Book added successfully", "book_id": candidate, "title": new_book.title}


class BookCopiesUpdate(BaseModel):
    total_copies: int = Field(ge=0, le=100000)


@router.put("/admin/books/{book_id}/copies", dependencies=[Depends(require_admin)])
def update_book_copies(book_id: str, payload: BookCopiesUpdate, db: Session = Depends(get_db)):
    """
    Updates total_copies and auto-adjusts available_copies proportionally.
    E.g. total 5->6 means available 2->3 (diff added to available).
    """
    book = db.query(Book).filter(Book.book_id == book_id).with_for_update().first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    diff = payload.total_copies - book.total_copies
    if book.available_copies + diff < 0:
        raise HTTPException(status_code=400, detail="Total copies cannot be less than copies currently borrowed")
    book.total_copies = payload.total_copies
    book.available_copies = max(0, book.available_copies + diff)
    db.commit()
    db.refresh(book)

    return {
        "message": "Copies updated",
        "book_id": book_id,
        "total_copies": book.total_copies,
        "available_copies": book.available_copies,
    }


@router.delete("/admin/books/{book_id}", dependencies=[Depends(require_admin)])
def delete_book(book_id: str, db: Session = Depends(get_db)):
    """
    Deletes a book from the catalog.
    """
    book = db.query(Book).filter(Book.book_id == book_id).with_for_update().first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if db.query(BorrowedBook).filter_by(Book_ID=book_id, status="issued").first():
        raise HTTPException(status_code=409, detail="Return all issued copies before deleting this book")
    db.delete(book)
    db.commit()
    return {"message": "Book deleted successfully", "book_id": book_id}

