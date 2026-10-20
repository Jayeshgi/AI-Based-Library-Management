import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

TEMP = tempfile.TemporaryDirectory()
os.environ.update(DATABASE_URL="sqlite:///" + TEMP.name.replace("\\", "/") + "/test.db",
                  SECRET_KEY="test-only-secret-with-at-least-32-characters",
                  ADMIN_EMAIL="admin@example.com", ADMIN_PASSWORD="test-admin-password",
                  ALLOW_DEMO_PASSWORD_RESET="false", APP_ENV="test", GEMINI_API_KEY="")

from fastapi.testclient import TestClient
from jose import jwt
from starlette.websockets import WebSocketDisconnect
from backend.main import app, request_windows
from backend.app.core.database import Base, engine, SessionLocal
from backend.app.core.security import SECRET_KEY, create_access_token, verify_password, hash_password
from backend.app.models.models import User, Book, BorrowedBook
from backend.app.api.sockets import pending_requests


def tearDownModule():
    engine.dispose()
    TEMP.cleanup()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        request_windows.clear()
        pending_requests.clear()
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        with SessionLocal() as db:
            db.add_all([
                User(user_id="one", admission_number="S001", name="One", email="one@example.com", password=hash_password("password123"), department="CS"),
                User(user_id="two", admission_number="S002", name="Two", email="two@example.com", password="google_oauth", department="CS"),
                Book(book_id="B1", title="Python", author="Author", department="Computer Science", total_copies=1, available_copies=1),
            ])
            db.commit()
        self.token = create_access_token({"sub": "one", "role": "student"})
        self.headers = {"Authorization": "Bearer " + self.token}
        self.admin_token = create_access_token({"sub": "admin@example.com", "role": "admin"})
        self.admin_headers = {"Authorization": "Bearer " + self.admin_token}

    def test_health_and_catalog(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/books").json()[0]["book_id"], "B1")
        analytics = self.client.get("/analytics", headers=self.admin_headers).json()
        self.assertEqual(analytics["total_books"], 1)
        self.assertEqual(analytics["currently_borrowed"], 0)
        self.assertEqual(analytics["most_searched"], [])

    def test_admin_routes_require_admin(self):
        requests = [("GET", "/admin/students"), ("GET", "/admin/borrow-records"),
                    ("GET", "/analytics"), ("GET", "/recent-activity"),
                    ("DELETE", "/admin/books/B1"), ("POST", "/admin/books"),
                    ("PUT", "/admin/books/B1/copies"), ("GET", "/predict/borrow_analysis")]
        for method, path in requests:
            with self.subTest(path=path):
                self.assertEqual(self.client.request(method, path).status_code, 401)
                self.assertEqual(self.client.request(method, path, headers=self.headers).status_code, 403)
        self.assertEqual(self.client.get("/admin/students", headers=self.admin_headers).status_code, 200)

    def test_student_can_only_read_and_update_self(self):
        self.assertEqual(self.client.get("/user-borrow-history/S001", headers=self.headers).status_code, 200)
        self.assertEqual(self.client.get("/user-borrow-history/S002", headers=self.headers).status_code, 403)
        self.assertEqual(self.client.put("/auth/profile/S002", json={"name": "Changed"}, headers=self.headers).status_code, 403)
        self.assertEqual(self.client.post("/review", json={"book_id": "B1", "user_id": "two", "review": "Fake"}, headers=self.headers).status_code, 403)
        self.assertEqual(self.client.post("/chat", json={"session_id": "S002", "message": "hello"}, headers=self.headers).status_code, 403)

    def test_login_register_and_legacy_passwords(self):
        response = self.client.post("/auth/login", json={"admission_number": "S001", "password": "password123"})
        self.assertIn("access_token", response.json())
        self.assertFalse(verify_password("demo123", "demo123"))
        self.assertEqual(self.client.post("/auth/login", json={"admission_number": "S002", "password": "google_oauth"}).status_code, 400)
        response = self.client.post("/auth/register", json={"admission_number": "S003", "name": "Three", "email": "three@example.com", "department": "CS", "password": "password123"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("access_token", response.json())
        response = self.client.post("/auth/admin/login", json={"email": "admin@example.com", "password": "test-admin-password"})
        self.assertIn("access_token", response.json())

    def test_reset_disabled_and_google_signup_bound_to_identity(self):
        self.assertEqual(self.client.post("/auth/password-reset", json={"admission_number": "S001", "email": "one@example.com", "new_password": "changed123"}).status_code, 403)
        payload = {"admission_number": "S003", "name": "Three", "department": "CS", "email": "three@example.com", "password": "password123"}
        self.assertEqual(self.client.post("/auth/google/create-credentials", json=payload).status_code, 401)
        token = create_access_token({"sub": "another@example.com", "role": "google_signup"})
        self.assertEqual(self.client.post("/auth/google/create-credentials", json=payload, headers={"Authorization": "Bearer " + token}).status_code, 403)
        token = create_access_token({"sub": "three@example.com", "role": "google_signup"})
        result = self.client.post("/auth/google/create-credentials", json=payload, headers={"Authorization": "Bearer " + token})
        self.assertIn("access_token", result.json())

    def test_expired_and_forged_tokens_fail(self):
        for token in ["not-a-token", jwt.encode({"sub": "one", "role": "student", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}, SECRET_KEY, algorithm="HS256")]:
            self.assertEqual(self.client.get("/user-borrow-history/S001", headers={"Authorization": "Bearer " + token}).status_code, 401)

    def test_websocket_role_and_identity_checks(self):
        for path in ["/ws/borrow/admin/admin", "/ws/borrow/student/S002"]:
            with self.client.websocket_connect(path) as ws:
                ws.send_json({"token": self.token})
                with self.assertRaises(WebSocketDisconnect):
                    ws.receive_json()

    def test_live_borrow_approval_and_return(self):
        with self.client.websocket_connect("/ws/borrow/admin/admin") as admin, self.client.websocket_connect("/ws/borrow/student/S001") as student:
            admin.send_json({"token": self.admin_token})
            student.send_json({"token": self.token})
            self.assertEqual(admin.receive_json()["type"], "authenticated")
            self.assertEqual(student.receive_json()["type"], "authenticated")
            student.send_json({"type": "borrow_request", "book_id": "B1"})
            request = admin.receive_json()
            admin.send_json({**request, "type": "borrow_response", "approved": True})
            self.assertEqual(student.receive_json()["status"], "approved")
            with SessionLocal() as db:
                self.assertEqual(db.get(Book, "B1").available_copies, 0)
                issue_id = db.query(BorrowedBook).one().issue_id
            student.send_json({"type": "return_request", "issue_id": issue_id})
            request = admin.receive_json()
            admin.send_json({**request, "type": "return_response", "approved": True})
            self.assertEqual(student.receive_json()["status"], "approved")
            with SessionLocal() as db:
                self.assertEqual(db.get(Book, "B1").available_copies, 1)

    def test_inventory_validation(self):
        self.assertEqual(self.client.put("/admin/books/B1/copies", json={"total_copies": -1}, headers=self.admin_headers).status_code, 422)
        with SessionLocal() as db:
            db.add(BorrowedBook(user_id="one", Book_ID="B1", status="issued"))
            db.commit()
        self.assertEqual(self.client.delete("/admin/books/B1", headers=self.admin_headers).status_code, 409)
        from backend.app.chatbot.borrow_or_return import execute_return
        with SessionLocal() as db:
            self.assertIn("librarian", execute_return("one", db.get(Book, "B1"), db))
            self.assertEqual(db.query(BorrowedBook).one().status, "issued")

    def test_embedding_cache_and_ranking(self):
        import numpy as np
        from backend.app.chatbot.agent import ensure_books_and_embeddings, EMBEDDINGS_CACHE
        from backend.app.chatbot.recommend import get_recommendations
        EMBEDDINGS_CACHE.clear()
        with SessionLocal() as db, patch("backend.app.chatbot.agent.embed_texts", return_value=np.array([[1., 0.]])) as embed:
            books, vectors = ensure_books_and_embeddings({"department": "CS"}, db)
            ensure_books_and_embeddings({"department": "CS"}, db)
            self.assertEqual(embed.call_count, 1)
            with patch("backend.app.chatbot.recommend.embed_texts", return_value=np.array([[1., 0.]])):
                self.assertEqual(get_recommendations("Python", books, vectors)[0][1]["book_id"], "B1")
            db.get(Book, "B1").title = "Changed"
            db.commit()
            ensure_books_and_embeddings({"department": "CS"}, db)
            self.assertEqual(embed.call_count, 2)

    def test_database_copy_preserves_source_and_refuses_nonempty_target(self):
        from sqlalchemy import create_engine
        from migrate_database import copy_records
        target = create_engine("sqlite://")
        try:
            counts = copy_records(engine, target)
            self.assertEqual(counts["users"], 2)
            with target.connect() as db:
                self.assertEqual(db.execute(User.__table__.select().where(User.user_id == "two")).mappings().one()["password"], "!")
            with self.assertRaises(ValueError):
                copy_records(engine, target)
            with SessionLocal() as db:
                self.assertEqual(db.get(User, "two").password, "google_oauth")
        finally:
            target.dispose()


if __name__ == "__main__":
    unittest.main()
