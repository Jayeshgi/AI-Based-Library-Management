
# GEMINI AI AGENT — DATA MANAGER & FORMATTER
# ===========================================
# This file is the "brain" of the library chatbot.
# Responsibilities:
#   1. Load book data from the database
#   2. Create and cache Gemini embeddings in memory
#   3. Detect user intent using Gemini AI
#   4. Route intents to specialized modules (recommend, summary, review, borrow)
#   5. Format recommendation results into premium responses

import os
from google import genai
from google.genai import types
from collections import OrderedDict
from backend.app.chatbot.embeddings import embed_texts
from dotenv import load_dotenv

# Load environment variables from .env file (explicit path so it works from any cwd)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '.env')
load_dotenv(_env_path, override=False)

from sqlalchemy.orm import Session
from backend.app.models.models import Book


# ============================================================================
# GLOBAL CACHES (In-Memory)
# ============================================================================
EMBEDDINGS_CACHE = OrderedDict()

# Map of display name to database filter name (if different)
DEPARTMENT_MAP = {
    "CS": "Computer Science",
    "IT": "Information Technology",
    "MECH": "Mechanical",
    "AUTO": "Automobile",
    "ECS": "ECS",
    "EXTC": "EXTC",
    "FY": "First Year",
}


# ============================================================================
# 1. BOOK DATA LOADING
# ============================================================================
def get_books_from_db(db: Session, department: str):
    """
    Fetches books from the MySQL database and returns a list of book
    dictionaries with standardized fields.
    """
    dept_filter = DEPARTMENT_MAP.get(department.upper(), department)
    
    # Query database
    db_books = db.query(Book).filter(Book.department == dept_filter).all()
    
    books = []
    for b in db_books:
        # Map DB fields to what the AI expects
        title = b.title or "Unknown"
        author = b.author or "Unknown"
        
        # Available copies or Total as fallback
        rating_value = b.available_copies if b.available_copies is not None else (b.total_copies or 0)
        
        search_blob = f"{title} {author}".lower()
        books.append({
            "book_id": b.book_id,
            "title": title,
            "author": author,
            "rating": rating_value,
            "search_blob": search_blob
        })
    return books


def ensure_books_and_embeddings(session, db: Session):
    dept = session["department"]
    books = get_books_from_db(db, dept)
    fingerprint = tuple((b["book_id"], b["search_blob"]) for b in books)
    cached = EMBEDDINGS_CACHE.get(dept)
    if cached is None or cached[0] != fingerprint:
        embeddings = embed_texts([b["search_blob"] for b in books])
        EMBEDDINGS_CACHE[dept] = (fingerprint, embeddings)
        if len(EMBEDDINGS_CACHE) > 16:
            EMBEDDINGS_CACHE.popitem(last=False)
    return books, EMBEDDINGS_CACHE[dept][1]


# ============================================================================
# 3. GEMINI INTENT DETECTION (with Context Awareness)
# ============================================================================
def gemini_agent(session, user_message, db: Session):
    """
    Uses Google Gemini AI as the main agent chatbot.
    Detects the user's intent and routes to the correct handler.
    """
    # Ensure books and embeddings are loaded for this department using the DB
    if not os.getenv("GEMINI_API_KEY"):
        return "The AI assistant is not configured yet. You can still browse and borrow books."
    books, book_embeddings = ensure_books_and_embeddings(session, db)

    def build_chat_context(chat_history=None):
        if chat_history is None:
            chat_history = []
        return "\n".join([
            f"{ctx['user']}: {ctx['user_message']}"
            for ctx in chat_history
        ])

    chat_context = build_chat_context(session.get("chat_history", []))

    system_instruction = f"""You are a helpful library assistant for an engineering college.
The current user is {session['username']} from {session['department']} department, year {session['year']}.
You have access to the official library information page: https://www.pce.ac.in/library/library-information/
If the user asks any general or basic questions about the library (such as timings, rules, facilities, or general information), use this page as your reference to answer accurately.
Your main jobs are:
1. Understand what the user wants
2. Extract relevant details
3. Respond in EXACT format for intents below, OR answer basic library questions using the reference link above.
4. If the user says a basic greeting like "hi", "hello", or "hey", respond with a warm, friendly greeting using their name and explicitly offer to help them find, review, borrow, or return books.
5. STRICT OFF-TOPIC RULE: If the user asks anything completely unrelated to books, library catalogs, studies, or casual greetings, you MUST strictly reply: "I can't help you with that. I am here purely as your library assistant!" Do not answer their off-topic question.

CRITICAL - CONTEXT AWARENESS & PERSISTENCE: The conversation history is provided below. 
1. RESOLVING PRONOUNS: When the user uses pronouns like "it", "that", "this", "the first one", or "this book", you MUST resolve these to the actual BOOK TITLE or AUTHOR mentioned previously.
2. PRIORITY: If the previous response was a list of recommendations, "this book" or "it" ALWAYS refers to the FIRST and MOST RELEVANT book in the "Direct Matches" section. DO NOT pick books from the "Related Resources" section unless the user explicitly mentions them (e.g., "tell me about the related one").
3. PERSISTENCE: If the user previously asked for a summary, review, or location and then just provides a book title (e.g. "it's the Algorithms book"), you should continue with that same intent.
NEVER output vague references like BOOK:it or BOOK:that. Always resolve to the real title. If you fail to resolve, output UNCLEAR.

Supported intents:
- RECOMMEND
- SUMMARY
- REVIEW
- BORROW
- RETURN
- LOCATE (Use for queries like "where is [book]", "find [book]", "locate [book]")
- UNCLEAR

For RECOMMENDATIONS:
INTENT:RECOMMEND
TOPIC:[The user's direct query PLUS 2-3 famous global real-world textbook titles that cover this topic. E.g. 'POS Tagging - Speech and Language Processing, Natural Language Processing with Python']
For SUMMARIES:
INTENT:SUMMARY
BOOK:[resolved book name - NEVER use pronouns here]
For REVIEWS:
INTENT:REVIEW
BOOK:[resolved book name - NEVER use pronouns here]
AUTHOR:[resolved author name - if available, else omit]
For BORROWING:
INTENT:BORROW
BOOK:[resolved book name - NEVER use pronouns here]
For RETURNING:
INTENT:RETURN
BOOK:[resolved book name - NEVER use pronouns here]
For LOCATING (Position in library):
INTENT:LOCATE
BOOK:[resolved book name - NEVER use pronouns here]
If unclear:
INTENT:UNCLEAR
MESSAGE:[ask for clarification]

If the user asks about the library itself, answer using the information from the reference link above.
Do NOT answer book/borrow/recommendation queries directly - only detect intent and extract details for those."""

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: Gemini API key not configured."
    try:
        client = genai.Client(api_key=api_key)
        MODEL_ID = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.3
        )
        full_prompt = f"{chat_context}\nUser: {user_message}"
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=full_prompt,
            config=config
        )
        gemini_intent = response.text.strip()
        # Debugging: Uncomment to see Gemini's raw thinking
        # print(f"--- DEBUG: Gemini Response ---\n{gemini_intent}\n--- END DEBUG ---")
        return process_intent(gemini_intent, session, user_message, books, book_embeddings, db)
    except Exception as e:
        return "The AI service is unavailable. Please try again later."


# ============================================================================
# 4. INTENT ROUTING
# ============================================================================
def process_intent(intent_response, session, user_message, books, book_embeddings, db: Session):
    """
    Parses the structured intent from Gemini and routes to the correct handler.
    For RECOMMEND: calls recommend.py's search engine, then formats with Gemini.
    """
    try:
        lines = intent_response.strip().split('\n')
        intent_info = {}
        for line in lines:
            if ':' in line:
                key, value = line.split(':', 1)
                intent_info[key.strip().upper()] = value.strip()

        intent = intent_info.get('INTENT', 'UNCLEAR').upper()

        if intent == 'RECOMMEND':
            topic = intent_info.get('TOPIC', '')
            return handle_recommendation(topic, session, books, book_embeddings)

        elif intent == 'SUMMARY':
            book = intent_info.get('BOOK', '')
            return call_summary_function(session, book, db)

        elif intent == 'REVIEW':
            book = intent_info.get('BOOK', '')
            author = intent_info.get('AUTHOR', '')
            return call_review_function(session, book, author, db)

        elif intent == 'BORROW' or intent == 'RETURN':
            book = intent_info.get('BOOK', '')
            return call_borrow_return_function(session, user_message, book, db)

        elif intent == 'LOCATE':
            book = intent_info.get('BOOK', '')
            return call_locate_function(session, book, db)

        elif intent == 'UNCLEAR':
            return intent_info.get('MESSAGE', 'Please specify your request clearly.')

        else:
            # For library-related or general responses from Gemini
            return intent_response

    except Exception as e:
        return "The AI request could not be processed. Please try again."


# ============================================================================
# 5. RECOMMENDATION HANDLER (Calls recommend.py + Premium Formatting)
# ============================================================================
def handle_recommendation(topic, session, books, book_embeddings):
    """
    1. Calls recommend.py's search engine to get top books.
    2. Uses Gemini to format the raw results into a premium, conversational response.
    """
    try:
        from backend.app.chatbot.recommend import get_recommendations
        # Get scored recommendations (Top 5)
        scored_books = get_recommendations(topic, books, book_embeddings, top_n=5)
        
        # Split into Primary and Related based on Threshold
        primary = []
        related = []
        
        for score, book in scored_books:
            # Score threshold for "Direct Match"
            if score > 0.52:
                primary.append(book)
            # Score threshold for "Related"
            elif score > 0.35:
                related.append(book)
                
        # Limit related to max 2 as requested by user
        related = related[:2]

        # Format into final conversational response
        return format_recommendations_with_gemini(primary, related, topic, session)
    except ImportError:
        return "Recommendation engine not found. Please ensure recommend.py exists."
    except Exception as e:
        return f"Error getting recommendations: {str(e)}"


def format_recommendations_with_gemini(primary_books, related_books, user_topic, session):
    """
    Uses Gemini to format two lists of books into a premium conversational response.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback
        return _simple_format(primary_books + related_books)

    # Build the book info strings
    def get_book_text(books_list):
        return "\n".join([
            f"- {b['title']} by {b['author']} (Available Copies: {b['rating']})"
            for b in books_list
        ])

    primary_text = get_book_text(primary_books)
    related_text = get_book_text(related_books)

    dept = session.get('department', 'Engineering')
    
    system_instruction = f"""
    You are a premium Library Assistant for the {dept} department.
    A student asked for recommendations on '{user_topic}'.

    I will provide you with two lists of books:
    1. DIRECT MATCHES: High confidence results.
    2. RELATED RESOURCES: Lower confidence but still relevant.

    YOUR GOAL:
    1. Write a friendly response in Markdown.
    2. Present the DIRECT MATCHES first with brief, helpful descriptions for each.
    3. Then, add a section starting with the header '### These are some related books'.
    4. List the RELATED RESOURCES under that header (max 2).
    5. If no related books are provided, omit that section.
    6. Be helpful, professional, and explain WHY these books matter.
    7. Use bold titles and bullet points.
    """

    prompt = f"DIRECT MATCHES:\n{primary_text}\n\nRELATED RESOURCES:\n{related_text}"

    try:
        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.5
        )
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
            contents=prompt,
            config=config
        )
        return response.text.strip()
    except Exception:
        return _simple_format(primary_books + related_books)


def _simple_format(top_books):
    """Fallback formatting when Gemini is unavailable."""
    if not top_books:
        return "Sorry, I couldn't find any recommendations for that topic."
    return "📚 Recommended books:\n" + "\n".join([
        f"  • {b['title']} by {b['author']}"
        for b in top_books
    ])


# ============================================================================
# 6. MODULE CALLERS (Summary, Review, Borrow/Return)
# ============================================================================
def call_summary_function(session, book_name, db: Session):
    try:
        from backend.app.chatbot.summary import generate_summary
        return generate_summary(book_name, session=session, db=db)
    except ImportError:
        return "Summary module not found."


def call_review_function(session, book_name, author, db: Session):
    try:
        from backend.app.chatbot.review import generate_review
        return generate_review(book_name, author, session=session, db=db)
    except ImportError:
        return "Review module not found."


def call_borrow_return_function(session, user_message, resolved_book, db: Session):
    try:
        from backend.app.chatbot.borrow_or_return import handle_borrow_return
        return handle_borrow_return(session, user_message, resolved_book, db=db)
    except ImportError:
        return "Borrow/Return module not found."

def call_locate_function(session, book_name, db: Session):
    try:
        from backend.app.chatbot.locate import handle_locate
        return handle_locate(book_name, session=session, db=db)
    except ImportError:
        return "Locate module not found."
