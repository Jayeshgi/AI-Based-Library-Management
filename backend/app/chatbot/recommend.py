
# RECOMMENDATION SEARCH ENGINE
# =============================
# This file is the "search engine" of the library chatbot.
# Responsibilities:
#   1. Query expansion (add synonyms and related terms)
#   2. Scoring engine (semantic similarity + popularity + keywords)
#   3. Return the top N most relevant books
#
# This file does NOT handle:
#   - Embedding creation (that's agent.py's job)
#   - User interaction or formatting (that's agent.py's job)
#   - Caching (that's agent.py's job)

import math
import numpy as np
from backend.app.chatbot.embeddings import embed_texts


# ============================================================================
# 1. QUERY EXPANSION
# ============================================================================
# Dictionary of exam/topic keywords that are expanded for better semantic matching.
# When a student searches for "JEE", the engine automatically adds related terms
# so the AI can find books on Physics, Chemistry, etc.

QUERY_EXPANSIONS = {
    "jee": "jee engineering entrance iit entrance exam physics chemistry mathematics",
    "jee mains": "jee mains engineering entrance exam physics chemistry maths",
    "jee advanced": "jee advanced iit entrance exam physics chemistry mathematics advanced",
    "neet": "neet medical entrance biology physics chemistry",
    "upsc": "upsc civil services india history geography politics economics",
    "gate": "gate engineering exam preparation computer science",
    "gate cs": "gate computer science algorithms data structures operating systems databases",
    "cat": "cat mba entrance quantitative aptitude verbal reasoning",

    # Programming & Tech
    "python": "python programming coding scripting backend data science",
    "java": "java programming object oriented enterprise application development",
    "c++": "c++ cpp programming systems low level performance",
    "c programming": "c programming systems embedded low level",
    "web": "web development html css javascript frontend backend",
    "ml": "machine learning artificial intelligence neural networks deep learning",
    "ai": "artificial intelligence machine learning deep learning neural networks",
    "data science": "data science statistics machine learning python analysis visualization",
    "dsa": "data structures algorithms sorting searching trees graphs",

    # Engineering Subjects
    "nlp": "natural language processing nlp text mining text analysis",
    "dbms": "database management system sql relational normalization",
    "os": "operating system process scheduling memory management",
    "cn": "computer networks networking protocols tcp ip",
    "compiler": "compiler design parsing lexical analysis syntax",
    "toc": "theory of computation automata formal languages grammar",
}


def expand_query(query):
    """
    Expands a user query with related terms for better semantic matching.

    Example:
        Input:  "recommend me a book for JEE preparation"
        Output: "recommend me a book for jee preparation jee engineering entrance
                 iit entrance exam physics chemistry mathematics"

    Args:
        query (str): The user's original search query.

    Returns:
        str: The expanded query with additional keywords.
    """
    q = query.lower()
    for key in QUERY_EXPANSIONS:
        if key in q:
            q += " " + QUERY_EXPANSIONS[key]
    return q


# ============================================================================
# 2. SCORING ENGINE
# ============================================================================
def nlp_filter_books(user_prompt, books, book_embeddings, top_n=5):
    """
    The core scoring engine. Scores every book using 4 factors:

    1. Semantic Similarity (85%):  How close is the book's meaning to the query?
    2. Popularity Score   (10%):  How many copies exist (log-scaled)?
    3. Recency Score       (5%):  Slight preference for newer books.
    4. Keyword Bonus    (+0.25):  Flat bonus if the exact query appears in the title.

    Args:
        user_prompt (str):       The topic/query extracted by agent.py.
        books (list):            List of book dicts from agent.py's cache.
        book_embeddings:         Numpy array of precomputed book embeddings.
        top_n (int):             Number of top results to return.

    Returns:
        list: Top N (score, book_dict) tuples, sorted by relevance score (highest first).
    """
    if not books or len(books) == 0:
        return []

    # Step 1: Expand the query with synonyms
    expanded_query = expand_query(user_prompt)

    # Step 2: Create embedding for the expanded query
    query_embedding = embed_texts([expanded_query], "RETRIEVAL_QUERY")[0]

    # Step 3: Calculate cosine similarity between query and all book embeddings
    norms = np.linalg.norm(book_embeddings, axis=1) * np.linalg.norm(query_embedding)
    similarities = (book_embeddings @ query_embedding) / np.maximum(norms, 1e-12)

    # Step 4: Score each book using the multi-factor formula
    scored_books = []
    query_lower = user_prompt.lower()

    for idx, similarity_score in enumerate(similarities):
        book = books[idx]

        # Factor 1: Semantic similarity (0 to 1)
        # Already provided by cosine_similarity

        # Factor 2: Popularity (log-scaled to prevent dominance)
        rating = book["rating"]
        popularity_score = math.log1p(rating)

        # Factor 3 completely removed.

        # Factor 4: Keyword bonus (exact match in title/author)
        keyword_bonus = 0
        if query_lower in book["search_blob"]:
            keyword_bonus += 0.25

        # Final weighted score
        final_score = (
            0.98 * similarity_score +
            0.02 * popularity_score +
            keyword_bonus
        )

        scored_books.append((final_score, book))

    # Sort by score (highest first) and return top N
    scored_books.sort(reverse=True, key=lambda x: x[0])
    
    return scored_books[:top_n]


# ============================================================================
# 3. PUBLIC API (Called by agent.py)
# ============================================================================
def get_recommendations(topic, books, book_embeddings, top_n=5):
    """
    The main entry point for the search engine.
    Called by agent.py when a RECOMMEND intent is detected.

    Args:
        topic (str):             The topic/query the user wants recommendations for.
        books (list):            List of book dicts (from agent.py's cache).
        book_embeddings:         Numpy array of embeddings (from agent.py's cache).
        top_n (int):             Number of top results to return (default: 5).

    Returns:
        list: Top N book dicts sorted by relevance.
    """
    return nlp_filter_books(topic, books, book_embeddings, top_n=top_n)
