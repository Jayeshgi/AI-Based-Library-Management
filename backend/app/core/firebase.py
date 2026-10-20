import firebase_admin
from firebase_admin import credentials, firestore, auth

import os
import json

db = None
def test_db():
    global db
    try:
        cred_path = "backend/app/credentials/firebase_key.json"
        # If the file does not exist, return None gracefully
        secret_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not secret_json and not os.path.exists(cred_path):
            print(f"Firebase credentials not found at {cred_path}. Please follow the setup guide.")
            return None

        if not firebase_admin._apps:
            cred = credentials.Certificate(json.loads(secret_json) if secret_json else cred_path)
            firebase_admin.initialize_app(cred)
        if db is None:
            db = firestore.client()
        return db

    except Exception as e:
        print(f"Firebase connection error: {e}")
        return None

def verify_firebase_token(token: str):
    return auth.verify_id_token(token)
