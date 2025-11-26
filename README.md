# AgentHub Multi-Agent Chatbot Framework

**AgentHub** is a production-ready, multi-tenant chatbot framework designed to serve multiple organizations simultaneously. It is built on a **configuration-driven architecture**, allowing agents, tools, and LLM settings to be dynamically managed via the database rather than hardcoded logic.

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [High-Level Architecture](#high-level-architecture)
- [Frontend to Backend Data Flow](#frontend-to-backend-data-flow)
- [Core Subsystems](#core-subsystems)
- [Security & Multi-Tenancy](#security--multi-tenancy)
- [Tech Stack](#tech-stack)

---

## 🚀 Project Overview

AgentHub distinguishes itself by treating "Agents" and "Tools" as database entities. This allows for:
- **Runtime Configuration:** Change prompts, switch LLM models (OpenAI, Gemini, Anthropic), or enable/disable tools without redeploying code.
- **Multi-Tenancy:** Logical isolation where Tenant A's "Sales Agent" behaves differently from Tenant B's, despite sharing the same underlying code.
- **Hybrid Intelligence:** Combines LLM capabilities with structured tools (APIs, Database Queries) and RAG (Document retrieval).

---

## 🏗️ High-Level Architecture

The system follows a layered architecture:

1.  **Presentation Layer (Frontend/Widget)**: An embeddable chat widget (React/TypeScript) that runs as an iframe on client websites.
2.  **API Layer (FastAPI)**: RESTful endpoints secured by JWT and Role-Based Access Control (RBAC).
3.  **Orchestration Layer (LangChain)**: Manages the Supervisor-Worker agent flow, memory management, and tool execution.
4.  **Data Layer (PostgreSQL + pgvector)**: Stores relational data (users, sessions, configs) and vector embeddings for RAG.

---

## 🔄 Frontend to Backend Data Flow

This section details the lifecycle of a user interaction, from the chat widget to the database and back.

### 1. Initialization & Config Load
*   **Frontend**: The widget script loads on the client's website.
*   **Request**: `GET /api/admin/tenants/{tenant_id}/widget`
*   **Backend**: 
    *   Validates the `tenant_id`.
    *   Fetches the `TenantWidgetConfig` (theme colors, welcome message, security settings).
*   **Response**: JSON config allows the frontend to render the UI matching the tenant's branding.

### 2. User Identification (Handshake)
*   **Frontend**: User opens the chat and enters details (or is anonymously tracked).
*   **Request**: `POST /api/{tenant_id}/chat_users`
*   **Backend**: Creates or updates a `ChatUser` record to track conversation history across sessions.

### 3. Session Creation
*   **Frontend**: Initiates a new conversation.
*   **Request**: `POST /api/{tenant_id}/sessions`
*   **Backend**: 
    *   Generates a unique `session_id`.
    *   Initializes a `ChatSession` record in Postgres.
    *   Sets up a thread ID for LangGraph/Conversation Memory.

### 4. The Chat Loop (The Core Flow)
*   **Frontend**: User sends: *"Can you check the status of shipment #123?"*
*   **Request**: `POST /api/{tenant_id}/chat`
    *   Payload: `{ "message": "...", "session_id": "...", "user_id": "..." }`

*   **Backend Processing**:
    1.  **Middleware**: 
        *   Validates JWT (if auth enabled).
        *   Enforces Rate Limits (Redis-backed Token bucket).
    2.  **Chat Endpoint (`src/api/chat.py`)**:
        *   Loads the `ChatSession`.
        *   Saves the **User Message** to the `messages` table.
    3.  **Supervisor Agent (`src/services/supervisor_agent.py`)**:
        *   **Input**: User message + List of available agents (from DB).
        *   **Decision**: Uses an LLM to classify intent.
        *   **Routing**: Determines if this is a `Knowledge Query` (RAG), a `Data Query` (Tools), or `Unclear`.
    4.  **Domain Agent Execution (`src/services/domain_agents.py`)**:
        *   If routed to **AgentTracking** (example):
            *   Loads specific tools enabled for this agent via `AgentTools` table.
            *   **Tool Execution**: If the LLM decides to call `get_shipment_status`, the `ToolRegistry` dynamically instantiates the tool class, injects tenant credentials, and executes the HTTP/DB request.
    5.  **Response Generation**:
        *   The Agent synthesizes the tool output into a natural language response.
    6.  **Persistence**:
        *   Saves **Assistant Message** to `messages` table with metadata (tokens used, tool outputs).

*   **Response**: Returns the text response + structured metadata (for UI rendering, e.g., showing a tracking card).

---

## 🧩 Core Subsystems

### 1. The "Brain": Supervisor-Worker Pattern
Instead of one giant prompt, the system uses a **Supervisor Agent** as a router.
*   **Supervisor**: "This looks like a question about invoices." -> Routes to **Finance Agent**.
*   **Worker (Finance Agent)**: Has specific tools (`get_invoice`, `check_balance`) and a specialized prompt.
*   *Benefit*: Reduces hallucination and keeps context focused.

### 2. RAG Engine (Retrieval-Augmented Generation)
*   **Storage**: **pgvector** (PostgreSQL extension) stores document embeddings in the `langchain_pg_embedding` table.
*   **Ingestion**: 
    *   `DocumentProcessor` handles PDF/DOCX parsing.
    *   Smart chunking preserves document sections (e.g., "Section 2.3: Pricing").
*   **Security**: The `RAGService` explicitly filters results by `tenant_id` *before* and *after* query execution to prevent cross-tenant data leaks.

### 3. Dynamic Tool Registry
Tools are defined in the database (`ToolConfig`) and linked to Python implementations.
*   **Example**: An `HTTPGetTool` in the DB contains the endpoint URL and headers.
*   **Runtime**: The `ToolLoader` reads the config and instantiates the Python class on the fly, injecting tenant secrets (decrypted via Fernet) safely.

### 4. Human Escalation
*   **Auto-Detection**: The `EscalationService` scans messages for keywords ("angry", "supervisor", "urgent").
*   **Workflow**:
    *   Status changes: `none` -> `pending`.
    *   Admins/Supporters view the **Escalation Queue**.
    *   A Supporter "picks" the chat (`assigned`), taking over from the bot.

---

## 🔒 Security & Multi-Tenancy

*   **Logical Isolation**: Every SQL query includes `WHERE tenant_id = ...`.
*   **Encryption**: Sensitive data (API Keys for LLM providers) is encrypted at rest using **Fernet**.
*   **Authentication**: 
    *   **Admins/Staff**: RS256 JWTs.
    *   **Widget Users**: Session-based UUIDs (or optional auth).
*   **Rate Limiting**: Per-tenant RPM (Requests Per Minute) and TPM (Tokens Per Minute) limits enforced via Redis.

---

## 🛠️ Tech Stack

*   **Language**: Python 3.10+
*   **Framework**: FastAPI
*   **Database**: PostgreSQL 15+ (with `vector` extension)
*   **ORM**: SQLAlchemy (Async)
*   **AI Framework**: LangChain (v0.3+)
*   **LLM Clients**: OpenAI, Anthropic, Google Gemini, OpenRouter
*   **Caching**: Redis
*   **Logging**: Structlog (JSON formatted)
