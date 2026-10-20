from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from backend.app.models.models import User, BorrowedBook, Book
from backend.app.core.database import get_db
from backend.app.core.security import require_admin

router = APIRouter(tags=["Analytics"], dependencies=[Depends(require_admin)])

@router.get("/debug")
def debug(db: Session = Depends(get_db)):
    books_count = db.query(Book).count()
    first_book = db.query(Book).first()
    return {
        "books_count": books_count,
        "first_book": {
            "title": first_book.title,
            "author": first_book.author
        } if first_book else "No books"
    }

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    active_users = db.query(User).count()
    total_books = db.query(Book).count()
    currently_borrowed = db.query(BorrowedBook).filter(BorrowedBook.status == "issued").count()
    total_borrows = db.query(BorrowedBook).count()

    overdue_books = db.query(BorrowedBook).filter(
        BorrowedBook.status == "issued",
        BorrowedBook.r_date < datetime.now().date()
    ).count()

    returned_books = db.query(BorrowedBook).filter(BorrowedBook.status == "returned").count()
    return_rate = round((returned_books / total_borrows * 100), 1) if total_borrows > 0 else 0

    most_borrowed_raw = db.query(
        BorrowedBook.Book_ID,
        func.count(BorrowedBook.issue_id).label('total')
    ).group_by(BorrowedBook.Book_ID).order_by(desc('total')).limit(10).all()

    most_borrowed = []
    for book_id, count in most_borrowed_raw:
        book = db.query(Book).filter(Book.book_id == book_id).first()
        title = book.title if book else book_id
        most_borrowed.append({'name': title, 'value': count})

    timeline_dates_db = [datetime.now().date() - timedelta(days=i) for i in range(14, -1, -1)]
    borrows_by_date_db = {}
    returns_by_date_db = {}

    for i in range(14, -1, -1):
        date = datetime.now().date() - timedelta(days=i)
        borrows = db.query(BorrowedBook).filter(
            func.date(BorrowedBook.b_date) == date
        ).count()
        returns = db.query(BorrowedBook).filter(
            BorrowedBook.status == "returned",
            func.date(BorrowedBook.r_date) == date
        ).count()
        borrows_by_date_db[date] = borrows
        returns_by_date_db[date] = returns

    timeline = []
    for date in timeline_dates_db:
        timeline.append({
            'date': date.isoformat(),
            'borrows': borrows_by_date_db.get(date, 0),
            'returns': returns_by_date_db.get(date, 0)
        })

    books_by_dept_raw = db.query(
        Book.department,
        func.count(BorrowedBook.issue_id).label('total')
    ).join(BorrowedBook, Book.book_id == BorrowedBook.Book_ID
    ).group_by(Book.department).order_by(desc('total')).all()

    books_borrowed_by_dept = []
    for dept, count in books_by_dept_raw:
        dept_name = {
            'Computer Science': 'Computer Science',
            'Information Technology': 'Information Technology',
            'ECS': 'ECS',
            'EXTC': 'EXTC',
            'Mechanical': 'Mechanical',
            'Automobile': 'Automobile',
            'First Year': 'Other'
        }.get(dept, dept)
        books_borrowed_by_dept.append({'name': dept_name, 'value': count})

    students_by_dept_raw = db.query(
        User.department,
        func.count(func.distinct(BorrowedBook.user_id)).label('total')
    ).join(BorrowedBook, User.user_id == BorrowedBook.user_id
    ).group_by(User.department).order_by(desc('total')).all()

    students_borrowing_by_dept = []
    for dept, count in students_by_dept_raw:
        dept_name = {
            'Computer Science': 'Computer Science',
            'Information Technology': 'Information Technology',
            'ECS': 'ECS',
            'EXTC': 'EXTC',
            'Mechanical': 'Mechanical',
            'Automobile': 'Automobile',
            'First Year': 'Other'
        }.get(dept, dept)
        students_borrowing_by_dept.append({'name': dept_name, 'value': count})

    most_searched = []

    return {
        'active_users': active_users,
        'total_books': total_books,
        'currently_borrowed': currently_borrowed,
        'total_borrows': total_borrows,
        'overdue_books': overdue_books,
        'return_rate': return_rate,
        'most_borrowed': most_borrowed,
        'timeline': timeline,
        'books_borrowed_by_dept': books_borrowed_by_dept,
        'students_borrowing_by_dept': students_borrowing_by_dept,
        'most_searched': most_searched
    }


@router.get("/recent-activity")
def get_recent_activity(limit: int = 10, db: Session = Depends(get_db)):
    """Fetch recent borrow and return activities from the borrowed_books table."""
    try:
        # Get recent activities sorted by date (most recent first)
        recent_books = db.query(BorrowedBook, User, Book).filter(
            BorrowedBook.user_id == User.user_id,
            BorrowedBook.Book_ID == Book.book_id
        ).order_by(
            desc(BorrowedBook.b_date)
        ).limit(limit).all()

        activities = []
        for borrowed, user, book in recent_books:
            activity_type = "borrow"
            activity_date = borrowed.b_date

            if borrowed.status == "returned" and borrowed.r_date:
                activity_type = "return"
                activity_date = borrowed.r_date

            activities.append({
                "type": activity_type,
                "student_name": user.name,
                "student_id": user.admission_number,
                "book_title": book.title,
                "book_id": book.book_id,
                "date": activity_date.isoformat() if activity_date else None,
                "status": borrowed.status
            })

        return {
            "success": True,
            "activities": activities
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error fetching recent activity: {str(e)}",
            "activities": []
        }
