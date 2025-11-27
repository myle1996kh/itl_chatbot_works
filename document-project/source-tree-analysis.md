# Source Tree Analysis

**Generated:** 2025-11-26
**Repository Type:** Multi-part
**Parts:** Backend API, Frontend Web App

## Project Root Structure

```
C:\Users\gensh\Downloads\chatbot_25.11\bmad setup/
├── backend/                    # Python FastAPI backend (Part: Backend)
├── frontend/                   # React TypeScript frontend (Part: Frontend)
├── docs/                       # Project documentation
│   ├── document-project/       # Generated brownfield documentation
│   └── *.md                    # Code reviews and notes
├── .bmad/                      # BMAD agent framework configuration
├── .claude/                    # Claude Code configuration
├── .gemini/                    # Gemini configuration
├── .agent/                     # Agent configurations
├── workflows/                  # Workflow definitions
├── .venv/                      # Python virtual environment
├── README.md                   # Main project README
├── CLAUDE.md                   # Claude Code development guide
├── pyproject.toml              # Python project configuration
├── uv.lock                     # Python dependency lock file
└── main.py                     # Project entry point

```

## Backend Structure (`./backend/`)

```
backend/
├── src/                        # ▶ Main application source code
│   ├── main.py                 # FastAPI app entry point and router registration
│   ├── config.py               # Pydantic settings (env vars, DB config)
│   │
│   ├── api/                    # ▶ REST API route handlers
│   │   ├── admin/              # Admin endpoints (agents, tools, tenants, knowledge, escalation)
│   │   │   ├── agents.py       # Agent CRUD operations
│   │   │   ├── tools.py        # Tool CRUD operations
│   │   │   ├── tenants.py      # Tenant management
│   │   │   ├── knowledge.py    # Document upload & RAG management
│   │   │   ├── escalation.py   # Human escalation management
│   │   │   ├── sessions.py     # Session monitoring
│   │   │   └── widgets.py      # Widget configuration
│   │   ├── auth.py             # Authentication endpoints (login, register, users)
│   │   ├── chat.py             # Main chat endpoint (POST /chat)
│   │   ├── sessions.py         # Session management endpoints
│   │   ├── chat_users.py       # End user management
│   │   ├── supporter.py        # Supporter interface endpoints
│   │   └── public_widgets.py   # Public widget endpoints (unauthenticated)
│   │
│   ├── services/               # ▶ Business logic layer
│   │   ├── supervisor_agent.py # Intent detection and routing agent
│   │   ├── domain_agents.py    # Domain-specific agent implementations
│   │   ├── rag_service.py      # Retrieval-augmented generation
│   │   ├── llm_manager.py      # LLM provider abstraction
│   │   ├── tool_loader.py      # Dynamic tool loading system
│   │   ├── embedding_service.py # Vector embedding generation
│   │   ├── conversation_memory.py # Chat history management
│   │   ├── checkpoint_service.py # LangGraph state persistence
│   │   ├── cache_service.py    # Redis caching layer
│   │   ├── document_processor.py # PDF/DOCX parsing
│   │   └── escalation_service.py # Human escalation logic
│   │
│   ├── models/                 # ▶ SQLAlchemy ORM models (15+ models)
│   │   ├── base.py             # Base model class
│   │   ├── tenant.py           # Tenant (organization)
│   │   ├── user.py             # System users (admin, supporter)
│   │   ├── chat_user.py        # End users/customers
│   │   ├── session.py          # Chat sessions
│   │   ├── message.py          # Chat messages
│   │   ├── agent.py            # Agent configurations
│   │   ├── tool.py             # Tool configurations
│   │   ├── base_tool.py        # Tool type templates
│   │   ├── output_format.py    # Response formatting
│   │   ├── llm_model.py        # Available LLM models
│   │   ├── tenant_llm_config.py # Per-tenant LLM settings
│   │   ├── tenant_widget_config.py # Widget customization
│   │   ├── supporter.py        # Support staff
│   │   └── permissions.py      # Tenant permission models
│   │
│   ├── schemas/                # ▶ Pydantic request/response schemas
│   │   └── [validation schemas for API contracts]
│   │
│   ├── tools/                  # ▶ Tool implementations
│   │   ├── rag.py              # RAG tool for knowledge retrieval
│   │   └── http.py             # HTTP API call tool
│   │
│   ├── middleware/             # ▶ FastAPI middleware
│   │   ├── auth.py             # JWT authentication
│   │   └── logging.py          # Request/response logging
│   │
│   └── utils/                  # ▶ Utility functions
│       ├── encryption.py       # Fernet encryption
│       └── logging.py          # Structured logging setup
│
├── alembic/                    # ▶ Database migrations
│   ├── versions/               # Migration scripts
│   └── env.py                  # Alembic environment config
│
├── migrations/                 # Custom seed data and docs
├── tests/                      # Bruno API tests (.bru files)
│   └── Chatbot/                # Test collections
│       ├── admin-agents/       # Agent admin tests
│       ├── admin-knowledge/    # Knowledge base tests
│       ├── chat/               # Chat endpoint tests
│       └── ...                 # Other test suites
│
├── Guides/                     # Setup and configuration guides (if exists)
├── requirements.txt            # Python dependencies
├── pyproject.toml              # Project metadata and dev tools config
├── alembic.ini                 # Alembic configuration
└── .env                        # Environment variables (not in git)
```

### Backend Entry Points

**Primary Entry Point:** `src/main.py`
- Initializes FastAPI app
- Registers all route handlers
- Sets up middleware (auth, logging, CORS)
- Configures database session management

**Key Initialization Flow:**
1. Load config from environment variables (`config.py`)
2. Initialize database connection (SQLAlchemy)
3. Set up Redis cache connection
4. Register API routes (chat, auth, admin, etc.)
5. Apply middleware (JWT validation, logging)
6. Start Uvicorn server

## Frontend Structure (`./frontend/`)

```
frontend/
├── src/                        # Application source code (if exists)
│   └── [React components and utilities]
│
├── components/                 # ▶ Reusable React components
│   ├── ChatWidget.tsx          # Embeddable chat widget
│   ├── AdminDashboard.tsx      # Admin panel interface
│   ├── UserInfoForm.tsx        # User information form
│   └── icons.tsx               # Icon components
│
├── pages/                      # ▶ Page-level components
│   └── LoginPage.tsx           # Login/authentication page
│
├── services/                   # ▶ API client and business logic
│   └── [API clients, data fetching, state management]
│
├── config/                     # Configuration files
│   └── [App configuration]
│
├── dist/                       # Build output (generated)
├── node_modules/               # npm dependencies (generated)
│
├── App.tsx                     # Main app component
├── index.tsx                   # React entry point
├── widget.tsx                  # Widget entry point
├── index.html                  # HTML template
├── widget.html                 # Widget HTML template
├── types.ts                    # TypeScript type definitions
├── constants.ts                # App constants
├── index.css                   # Global styles
│
├── package.json                # npm dependencies and scripts
├── package-lock.json           # npm lock file
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── vite.config.ts              # Vite build configuration
└── README.md                   # Frontend documentation
```

### Frontend Entry Points

**Primary Entry Point:** `index.tsx`
- Renders main React app
- Sets up routing
- Initializes state management
- Mounts to DOM element

**Widget Entry Point:** `widget.tsx`
- Standalone embeddable chat widget
- Independent from main app
- Configurable via tenant settings

**Build Entry Point:** `vite.config.ts`
- Defines build configuration
- Plugin setup (React, Tailwind)
- Dev server settings

## Critical Folders Summary

### Backend Critical Paths
| Path | Purpose | Files |
|------|---------|-------|
| `src/api/` | REST API endpoints | 15 route files |
| `src/services/` | Core business logic | 12 service files |
| `src/models/` | Database models | 15 model files |
| `src/tools/` | Tool implementations | 2 tool files |
| `alembic/versions/` | Database migrations | Multiple migration files |

### Frontend Critical Paths
| Path | Purpose | Files |
|------|---------|-------|
| `components/` | Reusable UI components | 4 component files |
| `pages/` | Page-level components | 1 page file |
| `services/` | API clients | Service files |

## Integration Points

### Backend → Database
- **Connection:** SQLAlchemy → PostgreSQL
- **Migrations:** Alembic manages schema versions
- **Extensions:** pgvector for embeddings

### Backend → Redis
- **Connection:** redis-py client
- **Purpose:** Session caching, agent state caching

### Backend → LLM Providers
- **Integration:** LangChain abstractions
- **Providers:** OpenAI, Anthropic, Google GenAI
- **Routing:** `llm_manager.py` handles provider selection

### Frontend → Backend
- **Protocol:** HTTPS REST API
- **Base URL:** Configurable API endpoint
- **Auth:** JWT tokens in Authorization header
- **Data Format:** JSON request/response

## Development Workflow

### Backend
1. Modify models → Generate migration → Apply migration
2. Add/update routes in `src/api/`
3. Implement business logic in `src/services/`
4. Run with: `python src/main.py` or `uvicorn src.main:app --reload`

### Frontend
1. Develop with: `npm run dev` (Vite dev server with HMR)
2. Build for production: `npm run build`
3. Preview production build: `npm run preview`

## File Naming Conventions

### Backend (Python)
- **Modules:** snake_case.py (e.g., `supervisor_agent.py`)
- **Classes:** PascalCase (e.g., `SupervisorAgent`)
- **Functions:** snake_case (e.g., `process_message`)

### Frontend (TypeScript/React)
- **Components:** PascalCase.tsx (e.g., `ChatWidget.tsx`)
- **Utilities:** camelCase.ts (e.g., `apiClient.ts`)
- **Types:** PascalCase or camelCase (e.g., `UserType` or `types.ts`)
