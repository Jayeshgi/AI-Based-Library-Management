"""Load the repository's supplied CSV book catalog without creating demo accounts.

This script is idempotent: it adds rows that do not already exist and preserves
any books, users, and transactions created during a demo.
"""

from __future__ import annotations

import csv
from pathlib import Path

from backend.app.core.database import Base, SessionLocal, engine
from backend.app.models.models import Book


ROOT = Path(__file__).resolve().parent


def value(row: dict[str, str], key: str) -> str:
    return (row.get(key) or "").strip()


def seed_books(session) -> int:
    added = 0
    for path in (ROOT / "datasets" / "dept_books").glob("*.csv"):
        with path.open(encoding="utf-8-sig", newline="") as source:
            for row in csv.DictReader(source):
                book_id = value(row, "Book_ID")
                if not book_id or session.get(Book, book_id):
                    continue
                total = int(value(row, "Total_Copies") or 1)
                available = int(value(row, "Available_Copies") or total)
                session.add(Book(
                    book_id=book_id,
                    title=value(row, "Title"),
                    author=value(row, "Author"),
                    department=value(row, "Department"),
                    total_copies=total,
                    available_copies=available,
                    column_dept=value(row, "Department"),
                ))
                added += 1
    return added


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        books = seed_books(session)
        session.commit()
    print(f"Database ready: added {books} books.")


if __name__ == "__main__":
    main()
