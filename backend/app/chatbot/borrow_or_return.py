from datetime import datetime, date, time as pytime
from sqlalchemy.orm import Session
from backend.app.models.models import Book, BorrowedBook, User
from google import genai
from google.genai import types
import os

# MAIN HANDLER
def handle_borrow_return(session, user_message, resolved_book, db: Session):
    try:
        user_id = session.get("user_id")
        dept = session["department"]
        
        # 1. Fetch user from DB
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
             return f"Error: User with ID '{user_id}' not found in database."

        # 2. Fetch books (only from user's department for context)
        db_books = db.query(Book).filter(Book.department.ilike(f"%{dept}%")).all()
        books_text = "\n".join([
            f"{b.book_id} | {b.title} | Available: {b.available_copies}"
            for b in db_books
        ])

        # 3. Fetch user's current borrowings
        active_borrows = db.query(BorrowedBook).filter(
            BorrowedBook.user_id == user.user_id,
            BorrowedBook.status == "issued"
        ).all()
        
        history_text = "\n".join([
            f"{b.Book_ID}"
            for b in active_borrows
        ]) or "None"

        # GEMINI PROMPT
        system_instruction = f"""
You are a STRICT library transaction engine.

IMPORTANT RULES:
- You MUST ONLY choose Book_ID from the provided dataset
- DO NOT invent Book_IDs
- If unsure, return ERROR

Available Books:
{books_text}

User Borrowed Books (Currently Issued):
{history_text}

User Request:
{user_message} (User is referring to: {resolved_book})

Respond ONLY in format:
ACTION:BORROW or RETURN
BOOK_ID:[exact id from list]

OR
ACTION:ERROR
MESSAGE:[reason]
"""

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents="Process",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0
            )
        )

        decision = response.text.strip()
        return execute_transaction(decision, user.user_id, db)

    except Exception as e:
        return f"Error: {str(e)}"


# EXECUTION (DB TRANSACTION)
def execute_transaction(decision, user_id, db: Session):
    try:
        data = {}
        for line in decision.split("\n"):
            if ":" in line:
                key, value = line.split(":", 1)
                data[key.strip().upper()] = value.strip()

        action = data.get("ACTION")
        book_id = data.get("BOOK_ID")

        if action == "ERROR":
            return data.get("MESSAGE", "Invalid request.")

        # Validate Book exists
        book = db.query(Book).filter(Book.book_id == book_id).first()
        if not book:
            return "Invalid book selection. Please try again."

        if action == "BORROW":
            return execute_borrow(user_id, book, db)
        elif action == "RETURN":
            return execute_return(user_id, book, db)
        else:
            return "Unknown action detected."

    except Exception as e:
        return f"Execution error: {str(e)}"


def execute_borrow(user_id, book, db: Session):
    # Check if already borrowed
    already_borrowed = db.query(BorrowedBook).filter(
        BorrowedBook.user_id == user_id,
        BorrowedBook.Book_ID == book.book_id,
        BorrowedBook.status == "issued"
    ).first()

    if already_borrowed:
        return f"You already have '{book.title}' issued."

    if book.available_copies <= 0:
        return f"Sorry, '{book.title}' is currently out of stock."

    # Instead of direct DB insertion, pass intent up to WebSockets!
    author = book.author if book.author else "Unknown"
    return f"__ACTION_BORROW__|{book.book_id}|{book.title}|{author}"


def execute_return(user_id, book, db: Session):
    # Find active record
    record = db.query(BorrowedBook).filter(
        BorrowedBook.user_id == user_id,
        BorrowedBook.Book_ID == book.book_id,
        BorrowedBook.status == "issued"
    ).first()

    if not record:
        return f"You don't have an active borrowing record for '{book.title}'."

    return f"To return **{book.title}**, open Borrow History and use the Return button so a librarian can approve it."
