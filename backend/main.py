import os
import time
from collections import OrderedDict
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.database import engine, Base

# Import Routers
from backend.app.api.auth import router as auth_router
from backend.app.api.auth_firebase import router as auth_firebase_router
from backend.app.api.library import router as library_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.chatbot import router as chatbot_router
from backend.app.services.prediction import router as prediction_router
from backend.app.api.sockets import router as sockets_router

# Create Database tables
Base.metadata.create_all(bind=engine)

# Initialize Firebase
from backend.app.core.firebase import test_db
test_db()

app = FastAPI(title="Library Management System & AI Chatbot", version="1.0")

# shortcut: limits and live approvals are per-process; deploy one worker until shared storage is added.
request_windows = OrderedDict()


@app.middleware("http")
async def limit_requests(request: Request, call_next):
    if request.url.path.startswith(("/auth/", "/chat")) and request.method == "POST":
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        started, count = request_windows.pop(key, (now, 0))
        if now - started >= 60:
            started, count = now, 0
        request_windows[key] = (started, count + 1)
        if len(request_windows) > 10000:
            request_windows.popitem(last=False)
        if count >= 20:
            return JSONResponse({"detail": "Too many requests. Try again in a minute."}, status_code=429, headers={"Retry-After": "60"})
    return await call_next(request)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Consolidated Library Backend Running"}

@app.get("/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}

# Include Routers
app.include_router(auth_router)
app.include_router(auth_firebase_router)
app.include_router(library_router)
app.include_router(analytics_router)
app.include_router(chatbot_router)
app.include_router(prediction_router)
app.include_router(sockets_router)
