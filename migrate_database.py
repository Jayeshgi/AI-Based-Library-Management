"""Copy an existing database into an empty destination without deleting the source."""
import os

from sqlalchemy import create_engine, select, func, text
from backend.app.core.database import Base, engine
from backend.app.models.models import User, Book, BorrowedBook, Review


def copy_records(source, destination):
    Base.metadata.create_all(destination)
    counts = {}
    with source.connect() as reader, destination.begin() as writer:
        for table in Base.metadata.sorted_tables:
            if writer.execute(select(func.count()).select_from(table)).scalar_one():
                raise ValueError("Destination must be empty; no records were copied")
        for table in Base.metadata.sorted_tables:
            rows = [dict(row) for row in reader.execute(select(table)).mappings()]
            if table.name == "users":
                for row in rows:
                    if not row["password"].startswith(("$2", "$pbkdf2-sha256$")):
                        row["password"] = "!"
            if rows:
                writer.execute(table.insert(), rows)
            counts[table.name] = len(rows)
        if destination.dialect.name == "postgresql":
            for table, column in [("borrowed_books", "issue_id"), ("review", "review_id")]:
                writer.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', '{column}'), COALESCE(MAX({column}), 1), COUNT(*) > 0) FROM {table}"))
    return counts


if __name__ == "__main__":
    source_url = os.environ["SOURCE_DATABASE_URL"]
    source = create_engine(source_url)
    print(copy_records(source, engine))
