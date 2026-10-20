from sqlalchemy.orm import Session
from backend.app.models.models import Book
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

# Load environment variables from .env file (explicit path so it works from any cwd)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '.env')
load_dotenv(_env_path, override=False)


def generate_summary(book_query, db: Session, session=None):
    """
    Generates a concise, academic summary of a book using Google Gemini AI.
    Fetches official book details from MySQL if possible.
    """
    if not book_query or book_query.strip() == "":
        return "Please specify a book name for the summary."

    # Try to find the book in the database first for better metadata (Robust Search)
    from backend.app.chatbot.utils import find_book
    book = find_book(db, book_query)

    if book:
        display_name = f"{book.title} by {book.author}"
    else:
        display_name = book_query

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: Gemini API key not configured."

    # Build context from session if available
    department = session.get("department", "Engineering") if session else "Engineering"
    year = session.get("year", "") if session else ""

    system_instruction = f"""You are a knowledgeable library assistant for an engineering college.
The user is from the {department} department{f', year {year}' if year else ''}.

Your task is to provide a helpful summary of the requested book.

SUMMARY FORMAT:
1. **Overview**: A 2-3 sentence description of what the book is about.
2. **Key Topics Covered**: A bullet list of the major topics/chapters (5-8 items).
3. **Who Should Read This**: One sentence on the target audience and prerequisites.
4. **Why It Matters**: One sentence on why this book is important for {department} students.

RULES:
- Keep the summary concise (under 200 words).
- Focus on practical value for engineering students.
- Based on the title/author, provide the most relevant academic summary.
"""

    try:
        client = genai.Client(api_key=api_key)
        MODEL_ID = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.4
        )

        prompt = f"Provide a summary of the book: \"{display_name}\""

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=config
        )

        summary_text = response.text.strip()

        if not summary_text:
            return f"Sorry, I couldn't generate a summary for '{display_name}'."

        return f"📖 Summary of '{display_name}':\n\n{summary_text}"

    except Exception as e:
        return f"Error generating summary: {str(e)}"

