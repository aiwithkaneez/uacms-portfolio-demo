# UACMS Backend

FastAPI backend for the public UACMS portfolio demo. It provides JWT authentication, role-based authorization, complaint submission and assignment, status tracking, an audit timeline, dashboard aggregates, encryption at rest for sensitive descriptions, and semantic retrieval over fictional sample procedures.

The repository contains no employer policies, real complaint records, production credentials, or internal documentation.

## Local setup

1. Create a PostgreSQL database and virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and replace every placeholder with local values.
4. Run `alembic upgrade head`.
5. Run `python -m app.db.seed` to add fictional demo users.
6. Run `python -m app.scripts.ingest_policies` to embed the fictional sample corpus.
7. Start the API with `uvicorn app.main:app --reload`.

Swagger UI is available at `http://127.0.0.1:8000/docs`.

## Required environment variables

- `DATABASE_URL`
- `SECRET_KEY` with at least 32 characters
- `ENCRYPTION_KEY`, a generated Fernet key
- `ALLOWED_ORIGINS`

Optional SMTP variables are documented in `.env.example`. No real credentials are committed.

## Demo users

`python -m app.db.seed` creates fictional local accounts using `Password123!`. These credentials are intended only for local development and must never be used for a deployed system.

| Email | Role |
|---|---|
| `employee@uacms.com` | Employee |
| `deskowner@uacms.com` | Desk Owner |
| `hr.relations@uacms.com` | Desk Owner |
| `hr.learning@uacms.com` | Desk Owner |
| `fiu@uacms.com` | Desk Owner |
| `executive@uacms.com` | Executive |
| `kbadmin@uacms.com` | Knowledge Base Admin |
| `sysadmin@uacms.com` | System Admin |

## Key routes

- `POST /api/v1/auth/login`
- `POST /api/v1/complaints`
- `GET /api/v1/complaints`
- `GET /api/v1/complaints/desk`
- `GET /api/v1/complaints/{id}`
- `PATCH /api/v1/complaints/{id}/status`
- `GET /api/v1/complaints/{id}/suggestions`
- `GET /api/v1/complaints/stats`

All public sample policy text lives in `app/data/policy_corpus.py`.
