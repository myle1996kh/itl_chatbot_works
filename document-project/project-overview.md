# ITL Chatbot - Project Overview

**Generated:** 2025-11-26
**Project Type:** Multi-part Repository
**Scan Level:** Deep

## Executive Summary

ITL Chatbot (AgentHub) is a production-ready, multi-tenant chatbot framework featuring a sophisticated multi-agent orchestration system. The architecture consists of a Python/FastAPI backend with LangChain-powered AI agents and a React-based frontend for chat and administration interfaces.

## Repository Structure

**Type:** Multi-part Repository
**Parts:** 2 distinct applications

### Part 1: Backend API (`./backend/`)
- **Project Type:** Backend API Service
- **Primary Purpose:** AI Agent orchestration, multi-tenancy, RAG system
- **Root Path:** `./backend/`

### Part 2: Frontend Web App (`./frontend/`)
- **Project Type:** Web Application
- **Primary Purpose:** Chat interface, admin panel, embeddable widget
- **Root Path:** `./frontend/`

## Technology Stack Summary

### Backend
| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | Python | 3.11+ | Core language |
| Web Framework | FastAPI | 0.100+ | REST API server |
| Agent Framework | LangChain | 0.3+ | AI agent orchestration |
| Agent Framework | LangGraph | 0.2+ | Agent workflow graphs |
| Database | PostgreSQL | - | Primary data store |
| ORM | SQLAlchemy | 2.0+ | Database abstraction |
| Migrations | Alembic | 1.12+ | Schema management |
| Vector Store | pgvector | 0.3.5+ | Embeddings storage |
| Embeddings | sentence-transformers | 3.3+ | Vector generation |
| Caching | Redis | 5.0+ | Performance layer |
| LLM Providers | OpenAI, Anthropic, Google | - | Multi-provider support |
| Document Processing | pypdf, python-docx | - | RAG document ingestion |
| Security | cryptography, PyJWT | - | Encryption & auth |
| Logging | structlog | 23.1+ | Structured logging |
| Testing | pytest, pytest-asyncio | - | Test framework |

### Frontend
| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | TypeScript | ES2022 | Type-safe JavaScript |
| Framework | React | 19.2 | UI framework |
| Build Tool | Vite | 6.2 | Fast dev server & bundler |
| Styling | Tailwind CSS | 4.1 | Utility-first CSS |
| Markdown | react-markdown | 10.1 | Chat message rendering |
| PDF Viewer | pdfjs-dist | 4.5 | Document preview |
| LLM Integration | @google/genai | 1.29 | Google AI SDK |

## Architecture Patterns

### Backend Architecture
**Pattern:** Service-Oriented API with Multi-Agent Orchestration
- **Supervisor Agent Pattern:** Central routing agent delegates to specialized domain agents
- **RAG Pipeline:** Document ingestion → Embedding → pgvector → Retrieval → Generation
- **Multi-Tenancy:** Tenant-scoped data isolation at database and service layers
- **Tool System:** Dynamic tool loading with permission management

### Frontend Architecture
**Pattern:** Component-Based Single Page Application
- **Component Hierarchy:** Pages → Components → Shared UI elements
- **State Management:** React hooks and context
- **Routing:** Vite-based client-side routing
- **Widget Mode:** Embeddable chat widget for external sites

## Key Features

### Multi-Agent System
- **Supervisor Agent:** Intent detection and routing
- **Domain Agents:** Specialized agents for specific business domains
- **Tool System:** Extensible tool framework with dynamic loading
- **Entity Extraction:** LLM-powered parameter extraction

### RAG (Retrieval-Augmented Generation)
- **Document Ingestion:** PDF, DOCX support
- **Vector Storage:** pgvector with cosine similarity search
- **Multi-Tenant Isolation:** Metadata filtering per tenant
- **Embedding Model:** sentence-transformers (all-MiniLM-L6-v2, 384 dimensions)

### Multi-Tenancy
- **Tenant Isolation:** All data scoped by tenant_id
- **Custom LLM Configs:** Per-tenant model selection and parameters
- **Permission System:** Agent and tool permissions per tenant
- **Widget Customization:** Tenant-specific chat widget configuration

### Human Escalation
- **Escalation Workflow:** Auto-escalation detection
- **Supporter Management:** Support staff assignment
- **Live Chat Handoff:** Seamless human takeover

## Development Tooling

### Backend
- **Code Quality:** black (formatter), ruff (linter), mypy (type checker)
- **Testing:** pytest with async support, 80% coverage target
- **Database:** Alembic migrations for schema versioning

### Frontend
- **Build:** Vite for fast HMR and optimized production builds
- **Type Safety:** TypeScript with strict mode
- **Styling:** Tailwind CSS utility classes

## Project Metadata

- **Project Name:** ITL Chatbot (AgentHub)
- **Description:** Multi-tenant AI chatbot framework with multi-agent orchestration
- **License:** MIT
- **Python Version:** 3.11+
- **Node Version:** (inferred from package.json type: module)

## Next Steps

Refer to detailed documentation:
- [Backend Architecture](./architecture-backend.md) _(To be generated)_
- [Frontend Architecture](./architecture-frontend.md) _(To be generated)_
- [API Contracts](./api-contracts-backend.md) _(To be generated)_
- [Data Models](./data-models-backend.md) _(To be generated)_
- [Integration Architecture](./integration-architecture.md) _(To be generated)_
