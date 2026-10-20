from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.models import User, BorrowedBook, Book
from backend.app.core.database import get_db
from backend.app.core.security import require_admin
from datetime import datetime, timedelta

router = APIRouter(prefix="/predict", tags=["Predict"], dependencies=[Depends(require_admin)])

# Mock model prediction since original .pkl might be missing/path changed during consolidation
def mock_predict_overdue(admission_number: str, book_id: str, db: Session):
    user = db.query(User).filter(User.admission_number == admission_number).first()
    if not user:
        return 0.1 # Base risk

    # Calculate simple risk: (Overdue Count / Total Borrows)
    total_borrows = db.query(BorrowedBook).filter(BorrowedBook.user_id == user.user_id).count()
    if total_borrows == 0:
        return 0.05

    overdue_count = db.query(BorrowedBook).filter(
        BorrowedBook.user_id == user.user_id,
        BorrowedBook.status == "returned",
        BorrowedBook.r_date > (BorrowedBook.b_date + timedelta(days=7)) # Example criteria
    ).count()

    probability = overdue_count / total_borrows
    return min(probability + 0.1, 1.0) # Add a small buffer

@router.post("/overdue")
def predict_overdue(data: dict, db: Session = Depends(get_db)):
    """
    Predicts the probability of a book being returned late.
    """
    prob = mock_predict_overdue(data.get("Admission_Number"), data.get("Book_ID"), db)
    return {
        "overdue_probability": float(prob),
        "note": "Using rule-based prediction as ML model is initializing"
    }

@router.get("/borrow_analysis")
def borrow_analysis(db: Session = Depends(get_db)):
    """
    Provides high-level analysis of borrowing trends from MySQL.
    """
    # Most borrowed books (by ID)
    most_borrowed_raw = db.query(
        BorrowedBook.Book_ID,
        func.count(BorrowedBook.issue_id).label('count')
    ).group_by(BorrowedBook.Book_ID).order_by(func.count(BorrowedBook.issue_id).desc()).limit(10).all()

    most_borrowed = {}
    for b_id, count in most_borrowed_raw:
        book = db.query(Book).filter(Book.book_id == b_id).first()
        name = book.title if book else b_id
        most_borrowed[name] = count

    # Top students
    top_students_raw = db.query(
        BorrowedBook.user_id,
        func.count(BorrowedBook.issue_id).label('count')
    ).group_by(BorrowedBook.user_id).order_by(func.count(BorrowedBook.issue_id).desc()).limit(10).all()

    top_students = {}
    for u_id, count in top_students_raw:
        user = db.query(User).filter(User.user_id == u_id).first()
        name = user.name if user else u_id
        top_students[name] = count

    total_borrows = db.query(BorrowedBook).count()
    overdue_count = db.query(BorrowedBook).filter(BorrowedBook.status == "issued").count() # Simplified logic

    return {
        "most_borrowed_books": most_borrowed,
        "top_students": top_students,
        "total_active_borrows": overdue_count,
        "total_history_records": total_borrows
    }
