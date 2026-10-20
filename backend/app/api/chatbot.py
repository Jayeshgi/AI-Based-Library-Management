from collections import OrderedDict
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.chatbot.agent import gemini_agent
from backend.app.core.database import get_db
from backend.app.core.security import current_student
from backend.app.models.models import User

router = APIRouter(tags=["Chatbot"])
# shortcut: history is per-process and lost on restart; use shared storage before adding workers.
user_sessions = OrderedDict()
chat_lock = Lock()


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=2000)


class InitRequest(BaseModel):
    session_id: str
    user_id: str
    department: str


@router.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db), user: User = Depends(current_student)):
    if request.session_id != user.admission_number:
        raise HTTPException(status_code=403, detail="You can only use your own chat session")
    # One AI request at a time bounds memory and prevents overlapping history updates.
    if not chat_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Chatbot is busy. Please try again shortly.")
    try:
        session = user_sessions.pop(user.user_id, {"chat_history": []})
        session.update(user_id=user.user_id, username=user.name,
                       department=user.department or "CS", year=user.class_name or "Unknown")
        user_sessions[user.user_id] = session
        if len(user_sessions) > 100:
            user_sessions.popitem(last=False)
        session["chat_history"] = session["chat_history"][-10:]
        response = gemini_agent(session, request.message, db=db)
        session["chat_history"].extend([
            {"user": "user", "user_message": request.message},
            {"user": "bot", "user_message": response[:8000]},
        ])
        return {"response": response}
    except Exception:
        raise HTTPException(status_code=503, detail="AI service is unavailable. Please try again later.")
    finally:
        chat_lock.release()


@router.post("/chat/init")
def init_chatbot(request: InitRequest, user: User = Depends(current_student)):
    if request.session_id != user.admission_number or request.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="You can only use your own chat session")
    return {"status": "initialized", "session_id": user.admission_number}
