# Free demo deployment

The app uses a Render static site, one Render Free Python service, and Neon Free
PostgreSQL. Free service quotas apply; Render sleeps when idle. Keep one backend
worker because live approval requests and chat history are in memory. Restarts
clear pending approvals and chat history, but PostgreSQL retains library records.

## Create the database

Create a Neon Free project in a region near the Render backend. Use its pooled
PostgreSQL connection URL as `DATABASE_URL`, including `sslmode=require`.
The application accepts `postgresql://` URLs and uses the psycopg driver.
Startup creates the tables and imports only the book catalog. It does not import
the supplied student CSV files or create shared-password demo accounts.

## Deploy

Connect the GitHub repository to Render and create a Blueprint using `render.yaml`.
Select Free resources only. Set the requested environment values:

- `DATABASE_URL`: Neon connection string, stored only as a backend secret.
- `ADMIN_EMAIL`: your admin email address.
- `ADMIN_PASSWORD`: a unique password of at least 12 characters.
- `CORS_ORIGINS`: the frontend HTTPS origin, without a trailing slash.
- `GEMINI_API_KEY`: your Gemini key; leave empty to run without the assistant.
- `VITE_BACKEND_URL`: the backend HTTPS origin.
- `VITE_WS_URL`: the same backend origin using `wss://`.

Render generates `SECRET_KEY`. Never change it casually: changing it invalidates
all sessions. Tokens expire after two hours and are stored in browser session
storage. Production refuses SQLite and an absent/short signing secret.

For Google login, add `FIREBASE_SERVICE_ACCOUNT_JSON` as a backend secret and
the `VITE_FIREBASE_*` values from `frontend/.env.example` to the frontend service.
Allow the frontend hostname in Firebase Authentication's authorized domains.
Without these values, admission-number login and registration still work.

After the two service URLs are assigned, update CORS and frontend URLs to the
actual values, then redeploy the frontend. Its URLs are embedded at build time.
The Blueprint includes the rewrite needed for direct visits to dashboard routes.

## Verification

```sh
python -m unittest discover -s tests -v
cd frontend
npm ci
npm run build
```

Check `/health`, register a student, sign in as admin in a separate browser,
and approve a borrow and return. Verify the book count and history after a
backend restart. Verify Google login only when Firebase is configured.

Semantic search uses Gemini embeddings over HTTPS instead of downloading a local
PyTorch model. Only book title/author text and queries are embedded. The chatbot
also sends conversation context to Gemini. API availability and free quotas
depend on the key's project. Choose a currently available `GEMINI_MODEL` for it.

The demo password reset is disabled in production. Legacy plaintext passwords
(including `demo123` and `google_oauth`) no longer grant access. Existing hashed
passwords remain supported. This deployment starts with the catalog; the local
SQLite database is left untouched.

## Optional transfer of existing records

Back up the SQLite file first. Run `python migrate_database.py` with
`SOURCE_DATABASE_URL=sqlite:///absolute/path/library.db` and the destination
`DATABASE_URL` set in the environment. The destination must be empty; all copies
are written in one transaction. Legacy plaintext/demo passwords are disabled,
not copied as working credentials. The script reports row counts and never
prints connection strings. Do not run it against an active destination.
