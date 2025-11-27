# ITL Chatbot - Project Documentation Index

**Generated:** 2025-11-26
**Scan Level:** Quick Scan
**Repository Type:** Multi-part (Backend API + Frontend Web App)

---

## 📋 Quick Reference

| Aspect | Detail |
|--------|--------|
| **Project Name** | ITL Chatbot (AgentHub) |
| **Type** | Multi-tenant AI chatbot framework |
| **Architecture** | Multi-part: Backend API + Frontend Web App |
| **Backend Stack** | Python 3.11+ / FastAPI / LangChain / PostgreSQL + pgvector |
| **Frontend Stack** | React 19 / TypeScript / Vite / Tailwind CSS |
| **Repository Structure** | `./backend/` + `./frontend/` |

---

## 🎯 Project Overview

### Backend (`./backend/`)
- **Type:** Backend API Service
- **Purpose:** Multi-agent AI orchestration, multi-tenancy, RAG system
- **Tech Stack:** Python + FastAPI + LangChain 0.3+ / LangGraph 0.2+
- **Database:** PostgreSQL with pgvector extension
- **Key Features:**
  - Supervisor-Domain agent pattern
  - Multi-tenant data isolation
  - RAG with sentence-transformers
  - Multi-provider LLM support (OpenAI, Anthropic, Google)
  - Human escalation workflow

### Frontend (`./frontend/`)
- **Type:** Web Application
- **Purpose:** Chat interface, admin panel, embeddable widget
- **Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS
- **Key Features:**
  - Component-based SPA
  - Admin dashboard
  - Embeddable chat widget
  - Markdown message rendering

---

## 📚 Generated Documentation

### Core Documentation
1. **[Project Overview](./project-overview.md)** ✅
   - Executive summary
   - Technology stack tables
   - Repository structure
   - Architecture patterns
   - Key features overview

2. **[Source Tree Analysis](./source-tree-analysis.md)** ✅
   - Complete directory structure
   - Annotated source tree
   - Critical folders summary
   - Entry points documentation
   - File naming conventions

### Backend Documentation
3. **[Backend Architecture](./architecture-backend.md)** ✅
   - System architecture diagram
   - Multi-agent orchestration pattern
   - Service layer components
   - RAG pipeline
   - LLM manager and tool system
   - Deployment architecture
   - Security and scalability

4. **[API Contracts - Backend](./api-contracts-backend.md)** ✅
   - All REST API endpoints
   - Request/response schemas
   - Authentication flows
   - Error responses
   - Rate limiting
   - Multi-tenancy implementation

5. **[Data Models - Backend](./data-models-backend.md)** ✅
   - 15+ SQLAlchemy models
   - Database schema
   - Relationships and constraints
   - Multi-tenancy patterns
   - Vector storage (pgvector)
   - Migration strategy

### Frontend Documentation
6. **[Frontend Architecture](./architecture-frontend.md)** ✅
   - Component-based architecture
   - State management strategy
   - Routing structure
   - Tailwind CSS styling
   - Build system (Vite)
   - Widget embedding

### Integration Documentation
7. **[Integration Architecture](./integration-architecture.md)** ✅
   - Frontend ↔ Backend integration
   - Widget embedding flows
   - Database connections
   - LLM provider integrations
   - Complete data flow diagrams
   - Security considerations
   - Deployment topologies

---

## 🚀 Getting Started

### For Developers

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
python src/main.py
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

**Prerequisites:**
- Python 3.11+
- Node.js (for frontend)
- PostgreSQL 15+ with pgvector
- Redis 5.0+

### For AI-Assisted Development

**When creating a PRD for new features:**
1. Start with [Project Overview](./project-overview.md) for context
2. Review relevant architecture:
   - [Backend Architecture](./architecture-backend.md) for API features
   - [Frontend Architecture](./architecture-frontend.md) for UI features
   - [Integration Architecture](./integration-architecture.md) for cross-cutting concerns
3. Check [API Contracts](./api-contracts-backend.md) for existing endpoints
4. Review [Data Models](./data-models-backend.md) for database changes

**For specific work types:**
- **Backend API feature:** Review Backend Architecture + API Contracts + Data Models
- **Frontend UI feature:** Review Frontend Architecture + Integration Architecture
- **Full-stack feature:** Review all architecture documents
- **Database changes:** Review Data Models + Backend Architecture
- **New integration:** Review Integration Architecture

---

## 🏗️ Architecture Highlights

### Backend Architecture Pattern
**Supervisor-Domain Agent Pattern** with multi-tenant isolation:
```
User Message
    ↓
SupervisorAgent (intent detection)
    ↓
DomainAgent (e.g., TrackingAgent)
    ↓
Tool Execution (RAG, HTTP, etc.)
    ↓
LLM Provider (OpenAI/Anthropic/Google)
    ↓
Formatted Response
```

### Multi-Tenancy Model
- **Database:** All tables have `tenant_id` foreign key
- **Services:** Tenant context in request middleware
- **Permissions:** Agent/tool access per tenant
- **RAG:** Vector metadata filtering by tenant

### RAG Pipeline
```
Document Upload → Parse → Chunk → Embed (sentence-transformers)
→ Store (pgvector) → Query → Retrieve → Generate
```

---

## 📊 Project Statistics

**Backend:**
- **API Endpoints:** 40+ REST endpoints
- **Database Models:** 15+ SQLAlchemy models
- **Services:** 12 core service modules
- **Tools:** 2 built-in tools (RAG, HTTP) + extensible framework

**Frontend:**
- **Components:** 4+ React components
- **Pages:** 1+ page components
- **Build Tool:** Vite 6.2 with Fast Refresh

---

## 🔗 Navigation by Use Case

### Planning New Features
1. [Project Overview](./project-overview.md) - Understand the system
2. [Backend Architecture](./architecture-backend.md) or [Frontend Architecture](./architecture-frontend.md) - Choose based on feature type
3. [Integration Architecture](./integration-architecture.md) - For cross-component features

### Understanding Data Models
1. [Data Models - Backend](./data-models-backend.md) - Complete schema
2. [Source Tree Analysis](./source-tree-analysis.md) - See where models are located

### API Integration Work
1. [API Contracts - Backend](./api-contracts-backend.md) - All endpoints
2. [Integration Architecture](./integration-architecture.md) - Frontend-backend communication

### Refactoring or Optimization
1. [Backend Architecture](./architecture-backend.md) - Current patterns
2. [Source Tree Analysis](./source-tree-analysis.md) - Code organization
3. [Integration Architecture](./integration-architecture.md) - Performance considerations

---

## 🛠️ Development Workflow

**Typical Development Flow:**
1. Read relevant architecture document(s)
2. Check existing API contracts and data models
3. Plan changes with tenant isolation in mind
4. Implement following established patterns:
   - Backend: Service layer → API layer → Test
   - Frontend: Component → Service → Integration
5. Create database migration if needed: `alembic revision --autogenerate`
6. Test with Bruno API tests (backend) or manual testing (frontend)

---

## 📝 Next Steps

**For Brownfield PRD:**
When planning new features, reference this documentation to understand:
- Existing architecture patterns
- Available services and components
- Database schema and relationships
- Integration points
- Multi-tenancy considerations

**Recommended Workflow:**
1. Load BMM PM agent (Product Manager)
2. Run `/bmad:bmm:workflows:prd` workflow
3. Provide this index as brownfield context: `docs/document-project/index.md`
4. PM agent will use these docs to create aligned PRD

---

## 📖 Documentation Metadata

**Scan Details:**
- **Mode:** Initial Scan (switched from deep to quick)
- **Scan Level:** Quick (pattern-based, structure analysis)
- **Generated:** 2025-11-26
- **Output Folder:** `docs/document-project/`
- **State File:** `docs/document-project/project-scan-report.json`

**Coverage:**
- ✅ Project structure classified
- ✅ Technology stacks documented
- ✅ Backend APIs cataloged (pattern-based)
- ✅ Data models documented (pattern-based)
- ✅ Architecture patterns analyzed
- ✅ Integration flows documented
- ✅ Source tree annotated

**Resume Capability:**
This documentation session can be resumed using the state file if additional deep-dive analysis is needed.

---

## 🎯 Key Takeaways for AI Agents

**Multi-Tenancy is Critical:**
- Every feature must respect tenant isolation
- All database queries must filter by tenant_id
- Agent/tool permissions enforced per tenant

**Agent Orchestration Pattern:**
- SupervisorAgent routes to DomainAgents
- Domain agents use tools (RAG, HTTP, custom)
- LLM calls abstracted through LLM Manager

**Tech Stack Maturity:**
- Production-ready with FastAPI + LangChain 0.3+
- PostgreSQL + pgvector for RAG
- React 19 with modern patterns

**Integration Points:**
- Frontend → Backend: REST API with JWT
- Backend → LLMs: Multi-provider via LangChain
- Backend → Database: SQLAlchemy ORM with Alembic
- Widget → Backend: Public endpoints (unauthenticated)

---

**End of Index** | For questions or issues, refer to specific documentation files above.
