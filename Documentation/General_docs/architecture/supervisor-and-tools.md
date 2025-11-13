# Supervisor Routing & Tool Discovery

This document summarizes how SupervisorAgent routes requests and how ToolRegistry auto‑discovers tool plugins.

```mermaid
flowchart TD
  DB1[(agent_configs)] --> SUP[SupervisorAgent]
  DB2[(tool_configs, base_tools)] --> REG[ToolRegistry]
  REG -->|_load_tool_plugins()| FS[Scan src/tools/*.py]
  FS --> H[Register handlers tools.module.Class]
  U[User message] --> SUP
  SUP --> ROUTE{Route to agent or MULTI_INTENT/UNCLEAR}
  ROUTE -->|agent| AG[Domain Agent]
  SUP --> TOOLS[Create tools via ToolRegistry]
  SUP --> LLM[LLMManager]
```

Highlights
- Supervisor prompt is stored in the database (see `agent_configs`) and loaded at runtime.
- ToolRegistry scans `src/tools/*.py` and registers subclasses of `src.tools.base.BaseTool`.
- Handlers are referenced by fully qualified path, e.g., `tools.rag.RAGTool`.
- Tools are created per tenant, injecting `tenant_id` and `jwt_token` as needed.

References
- `backend/src/services/supervisor_agent.py`
- `backend/src/services/tool_loader.py`
