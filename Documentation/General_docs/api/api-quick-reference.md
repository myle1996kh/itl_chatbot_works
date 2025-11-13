# API Quick Reference

Condensed overview of primary endpoints. See full contracts in `Documentation/api-contracts-part-1.md`.

Chat
- POST `/{tenant_id}/chat` — Send a message to the chatbot.
- POST `/{tenant_id}/test/chat` — Test endpoint.

Sessions
- GET `/{tenant_id}/session` — List sessions.
- GET `/{tenant_id}/session/{session_id}` — Get a session.

Admin · Agents
- GET `/agents` — List agents.
- POST `/agents` — Create agent.
- GET `/agents/{agent_id}` — Get agent.
- PATCH `/agents/{agent_id}` — Update agent.
- POST `/agents/reload` — Reload registry.

Admin · Tenants
- POST `/tenants` — Create tenant.
- GET `/tenants` — List tenants.
- GET `/tenants/{tenant_id}` — Get tenant.
- PATCH `/tenants/{tenant_id}` — Update tenant.
- DELETE `/tenants/{tenant_id}` — Delete tenant.
- GET `/tenants/{tenant_id}/permissions` — Get permissions.
- PATCH `/tenants/{tenant_id}/permissions` — Update permissions.

Admin · Knowledge
- POST `/tenants/{tenant_id}/knowledge` — Ingest knowledge.
- GET `/tenants/{tenant_id}/knowledge/stats` — Stats.
- DELETE `/tenants/{tenant_id}/knowledge` — Delete all.
- POST `/tenants/{tenant_id}/knowledge/upload-document` — Upload document.
- POST `/tenants/{tenant_id}/knowledge/upload-pdf` — Upload PDF.

Admin · Tools
- GET `/tools` — List tools.
- POST `/tools` — Create tool.
- GET `/tools/{tool_id}` — Get tool.
- PATCH `/tools/{tool_id}` — Update tool.
