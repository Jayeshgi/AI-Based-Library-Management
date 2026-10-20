import os

import numpy as np
from google import genai
from google.genai import types


def embed_texts(texts, task_type="RETRIEVAL_DOCUMENT"):
    if not texts:
        return np.empty((0, 768), dtype=np.float32)
    vectors = []
    with genai.Client(api_key=os.environ["GEMINI_API_KEY"], http_options=types.HttpOptions(timeout=30000)) as client:
        for start in range(0, len(texts), 50):
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=texts[start:start + 50],
                config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=768),
            )
            vectors.extend(embedding.values for embedding in response.embeddings)
    return np.asarray(vectors, dtype=np.float32)
