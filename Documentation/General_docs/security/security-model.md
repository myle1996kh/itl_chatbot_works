# Security Model

This document summarizes authentication controls, production safeguards, and security error handling.

Auth & Environment Controls
- `DISABLE_AUTH` is blocked in production (`backend/src/config.py` validator).
- Middleware rejects auth bypass at runtime in production; development may inject a test tenant for local testing.
- Startup validation prevents unsafe production configs (missing `JWT_PUBLIC_KEY`, `DISABLE_AUTH=true`).

```mermaid
flowchart TD
  ENV[ENVIRONMENT] -->|production| V[Validate settings]
  V -->|unsafe| STOP[Shutdown with critical log]
  V -->|safe| APP[Start API]
  subgraph Middleware
    A[Authorization header] --> B{JWT valid?}
    B -- no --> ERR[Reject]
    B -- yes --> OK[Proceed]
  end
```

Security Errors
- Security violations raise `SecurityError` (500 with `incident_id`).
- Critical events are logged with context and do not leak details to clients.

References
- `backend/src/config.py`
- `backend/src/middleware/auth.py`
- `backend/src/main.py`
