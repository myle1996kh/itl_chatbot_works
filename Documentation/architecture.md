# Architecture
## Executive Summary
Multi-tenant FastAPI backend for a chatbot with database-driven configuration, RAG via PgVector, and tool plugin architecture. Enforces security, supports rate limiting, and supervisor-based routing.

## Technology Stack
- FastAPI, Uvicorn
- SQLAlchemy, Alembic, PostgreSQL + pgvector
- LangChain (langchain-postgres), sentence-transformers
- Redis (rate limiting)
- Pydantic Settings
- structlog, prometheus-client

## Architecture Pattern
Layered design: API → Services → Models/Schemas; middleware for auth; supervisor and tool registry for extensibility.

## Data Architecture
See: [Data Models](./data-models-part-1.md)

## API Design
See: [API Contracts](./api-contracts-part-1.md)

## Source Tree
See: [Source Tree Analysis](./source-tree-analysis.md)

## Development Workflow
See: [Development & Deployment](./development-and-deployment.md)

## Deployment Architecture
ASGI app via uvicorn; environment-driven config; optional Redis; PostgreSQL with pgvector extension.

## Testing Strategy
pytest-based with async support; aim for unit + integration coverage across auth, RAG validation, and rate limiting.
