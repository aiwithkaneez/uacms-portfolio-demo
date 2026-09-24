# UACMS — AI-Powered Complaint Management Demo

UACMS is a portfolio version of a role-based complaint management system. It demonstrates complaint submission and tracking, automatic desk assignment, status timelines, dashboards, encryption for sensitive complaint text, and retrieval-based procedural suggestions.

This public edition contains fictional sample policies and demo accounts only. It excludes employer documents, internal roadmaps, real complaints, employee data, production credentials, and proprietary branding.

## Stack

- React and Vite frontend
- FastAPI backend
- PostgreSQL, SQLAlchemy, and Alembic
- SentenceTransformers semantic retrieval
- JWT authentication and role-based access control
- Fernet encryption for sensitive complaint descriptions

## Main features

- Public and employee complaint submission
- Complaint IDs, tracking, assignment, and audit timeline
- Employee, desk owner, executive, knowledge-base admin, and system-admin roles
- Retrieval-based procedural suggestions with human accept, modify, or override decisions
- Dashboard metrics and spreadsheet exports
- Optional email confirmation through environment-based SMTP settings

## Run locally

1. Follow [backend/README.md](backend/README.md) to configure PostgreSQL, install dependencies, run migrations, seed fictional demo users, and start FastAPI.
2. Follow [uacms-app/README.md](uacms-app/README.md) to install frontend dependencies and start Vite.
3. Use only the included demo accounts and sample data.

## Portfolio note

This sanitized repository demonstrates the software architecture and implementation. Company-specific requirements, policy wording, internal documents, production configuration, and real user data are intentionally excluded.
