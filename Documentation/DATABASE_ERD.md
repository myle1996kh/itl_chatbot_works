# AgentHub Database ERD - Entity Relationship Diagram

**Version:** 1.0
**Date:** 2025-11-10
**Database:** PostgreSQL 15+ with pgvector extension
**Total Tables:** 13 + 1 (LangGraph checkpoints)

---

## Visual ERD

### Complete System ERD

```
┌═══════════════════════════════════════════════════════════════════════════════┐
│                          MULTI-TENANT CORE HIERARCHY                          │
└═══════════════════════════════════════════════════════════════════════════════┘

                              ┌────────────────────┐
                              │     TENANTS        │ 🏢 Root Entity
                              ├────────────────────┤
                              │ tenant_id      PK  │ UUID
                              │ name           NN  │ VARCHAR(255)
                              │ domain         UNQ │ VARCHAR(255)
                              │ status         IDX │ VARCHAR(50) DEFAULT 'active'
                              │ created_at     NN  │ TIMESTAMP
                              │ updated_at     NN  │ TIMESTAMP
                              └─────────┬──────────┘
                                        │ 1:1
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
            ▼ 1                         ▼ 1                         ▼ *
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│ TENANT_LLM_CONFIGS     │  │ TENANT_WIDGET_CONFIGS  │  │      SESSIONS          │
├────────────────────────┤  ├────────────────────────┤  ├────────────────────────┤
│ config_id          PK  │  │ widget_config_id   PK  │  │ session_id         PK  │
│ tenant_id       FK,UNQ │─ │ tenant_id       FK,UNQ │  │ tenant_id          FK  │
│ llm_model_id       FK  │  │ ... widget settings    │  │ user_id            NN  │
│ encrypted_api_key  NN  │  │ created_at         NN  │  │ agent_id           FK  │
│ rate_limit_rpm     DEF │  │ updated_at         NN  │  │ thread_id              │
│ rate_limit_tpm     DEF │  └────────────────────────┘  │ created_at         NN  │
│ created_at         NN  │                              │ last_message_at    IDX │
│ updated_at         NN  │                              │ metadata         JSONB │
└────────────────────────┘                              └──────────┬─────────────┘
            │                                                      │ 1:*
            │ *:1                                                  ▼ *
            ▼                                          ┌────────────────────────┐
┌────────────────────────┐                             │      MESSAGES          │
│     LLM_MODELS         │                             ├────────────────────────┤
├────────────────────────┤                             │ message_id         PK  │
│ llm_model_id       PK  │                             │ session_id         FK  │
│ provider           NN  │                             │ role               NN  │
│ model_name         NN  │                             │ content            NN  │
│ display_name           │                             │ timestamp          IDX │
│ supports_tools     DEF │                             │ metadata         JSONB │
│ created_at         NN  │                             └────────────────────────┘
└────────────────────────┘
                                                       Composite Index:
                                                       - (session_id, timestamp)
Composite Index:
- (tenant_id, user_id, created_at)


┌═══════════════════════════════════════════════════════════════════════════════┐
│                         PERMISSION & ACCESS CONTROL                            │
└═══════════════════════════════════════════════════════════════════════════════┘

          ┌────────────────────────┐                ┌────────────────────────┐
          │ TENANT_AGENT_          │                │ TENANT_TOOL_           │
          │   PERMISSIONS          │                │   PERMISSIONS          │
          ├────────────────────────┤                ├────────────────────────┤
          │ tenant_id       FK,PK  │───────┐        │ tenant_id       FK,PK  │───────┐
          │ agent_id        FK,PK  │───┐   │        │ tool_id         FK,PK  │───┐   │
          │ enabled            IDX │   │   │        │ enabled            IDX │   │   │
          │ output_override_id FK  │   │   │        │ created_at         NN  │   │   │
          │ created_at         NN  │   │   │        └────────────────────────┘   │   │
          │ updated_at         NN  │   │   │                                     │   │
          └────────────────────────┘   │   │                                     │   │
                                       │   │                                     │   │
                  ┌────────────────────┘   │                  ┌──────────────────┘   │
                  │ *:1                    │ *:1              │ *:1                  │ *:1
                  ▼                        ▼                  ▼                      ▼
      ┌────────────────────────┐  ┌────────────────┐  ┌────────────────────┐  ┌────────────┐
      │   AGENT_CONFIGS        │  │   TENANTS      │  │   TOOL_CONFIGS     │  │  TENANTS   │
      └────────────────────────┘  └────────────────┘  └────────────────────┘  └────────────┘


┌═══════════════════════════════════════════════════════════════════════════════┐
│                    AGENT & TOOL CONFIGURATION (SHARED)                         │
└═══════════════════════════════════════════════════════════════════════════════┘

┌────────────────────────┐                                   ┌────────────────────────┐
│   AGENT_CONFIGS        │                                   │    TOOL_CONFIGS        │
├────────────────────────┤                                   ├────────────────────────┤
│ agent_id           PK  │                                   │ tool_id            PK  │
│ name               UNQ │                                   │ name               NN  │
│ prompt_template    NN  │                                   │ base_tool_id       FK  │
│ llm_model_id       FK  │─────┐                             │ config           JSONB │
│ default_output_    FK  │──┐  │                      ┌──────│ input_schema     JSONB │
│   format_id            │  │  │                      │      │ output_format_id   FK  │──┐
│ description            │  │  │                      │      │ description            │  │
│ handler_class      DEF │  │  │                      │      │ is_active          IDX │  │
│ is_active          IDX │  │  │                      │      │ created_at         NN  │  │
│ created_at         NN  │  │  │                      │      │ updated_at         NN  │  │
│ updated_at         NN  │  │  │                      │      └──────────┬─────────────┘  │
└──────────┬─────────────┘  │  │                      │                 │ *:1             │
           │ 1:*            │  │                      │                 ▼                 │
           ▼                │  │                      │      ┌────────────────────────┐  │
┌────────────────────────┐  │  │                      │      │    BASE_TOOLS          │  │
│    AGENT_TOOLS         │  │  │                      │      ├────────────────────────┤  │
│    (Junction Table)    │  │  │                      │      │ base_tool_id       PK  │  │
├────────────────────────┤  │  │                      │      │ name               UNQ │  │
│ agent_id        FK,PK  │──┘  │                      │      │ category           NN  │  │
│ tool_id         FK,PK  │─────┼──────────────────────┘      │ handler_class      NN  │  │
│ priority           NN  │     │                             │ description            │  │
│ created_at         NN  │     │                             │ created_at         NN  │  │
└────────────────────────┘     │                             └────────────────────────┘  │
                               │                                                         │
Composite Index:               │                                                         │
- (agent_id, priority)         │ *:1                                                     │
                               ▼                                                         │
                    ┌────────────────────────┐                                          │
                    │     LLM_MODELS         │                                          │
                    ├────────────────────────┤                                          │
                    │ llm_model_id       PK  │                                          │
                    │ provider           NN  │                                          │
                    │ model_name         NN  │                                          │
                    │ display_name           │                                          │
                    │ supports_tools     DEF │                                          │
                    │ created_at         NN  │                                          │
                    └────────────────────────┘                                          │
                                                                                         │
                                                                         ┌───────────────┘
                                                                         │ *:1
                                                                         ▼
                                                              ┌────────────────────────┐
                                                              │   OUTPUT_FORMATS       │
                                                              ├────────────────────────┤
                                                              │ format_id          PK  │
                                                              │ name               UNQ │
                                                              │ format_template    NN  │
                                                              │ instructions           │
                                                              │ created_at         NN  │
                                                              └────────────────────────┘


┌═══════════════════════════════════════════════════════════════════════════════┐
│                    KNOWLEDGE BASE (PGVECTOR - NOT SHOWN)                       │
└═══════════════════════════════════════════════════════════════════════════════┘

Note: Knowledge base uses pgvector extension with metadata-based tenant isolation.
Not a traditional table relationship - documents stored as vectors with metadata:
{
  "tenant_id": "uuid",
  "document_id": "uuid",
  "source": "filename.pdf",
  "page": 1,
  ...
}

Isolation: Queries filter by metadata["tenant_id"] during similarity_search()


┌═══════════════════════════════════════════════════════════════════════════════┐
│                    LANGGRAPH CHECKPOINTS (AUTO-CREATED)                        │
└═══════════════════════════════════════════════════════════════════════════════┘

┌────────────────────────┐
│     CHECKPOINTS        │ (Created by LangGraph)
├────────────────────────┤
│ thread_id       PK,NN  │ VARCHAR
│ checkpoint_id   PK,NN  │ VARCHAR
│ parent_id              │ VARCHAR
│ checkpoint           NN│ JSONB (full state)
│ metadata             NN│ JSONB
│ created_at         DEF │ TIMESTAMP
└────────────────────────┘

Note: This table is auto-managed by LangGraph's PostgresCheckpointSaver.
Do not manually modify or create this table.
```

---

## Table Relationships Summary

### Tenant Hierarchy (1:* relationships from tenants)

| Parent Table | Child Table | Relationship | Constraint |
|--------------|-------------|--------------|------------|
| `tenants` | `tenant_llm_configs` | 1:1 | UNIQUE(tenant_id) |
| `tenants` | `tenant_widget_configs` | 1:1 | UNIQUE(tenant_id) |
| `tenants` | `sessions` | 1:* | FK(tenant_id) |
| `tenants` | `tenant_agent_permissions` | 1:* | FK(tenant_id) |
| `tenants` | `tenant_tool_permissions` | 1:* | FK(tenant_id) |

### Session & Message Hierarchy

| Parent Table | Child Table | Relationship | Constraint |
|--------------|-------------|--------------|------------|
| `sessions` | `messages` | 1:* | FK(session_id) |
| `agent_configs` | `sessions` | 1:* | FK(agent_id) |

### Agent & Tool Configuration

| Parent Table | Child Table | Relationship | Type |
|--------------|-------------|--------------|------|
| `agent_configs` | `agent_tools` | 1:* | Many-to-many junction |
| `tool_configs` | `agent_tools` | 1:* | Many-to-many junction |
| `agent_configs` | `tenant_agent_permissions` | 1:* | Permission |
| `tool_configs` | `tenant_tool_permissions` | 1:* | Permission |

### Reference Tables

| Parent Table | Child Table | Relationship |
|--------------|-------------|--------------|
| `llm_models` | `tenant_llm_configs` | 1:* |
| `llm_models` | `agent_configs` | 1:* |
| `base_tools` | `tool_configs` | 1:* |
| `output_formats` | `agent_configs` | 1:* |
| `output_formats` | `tool_configs` | 1:* |
| `output_formats` | `tenant_agent_permissions` | 1:* (override) |

---

## Index Strategy

### Primary Indexes (Automatically Created)

All primary keys have automatic indexes:
- `tenants(tenant_id)`
- `sessions(session_id)`
- `messages(message_id)`
- `agent_configs(agent_id)`
- `tool_configs(tool_id)`
- `base_tools(base_tool_id)`
- `llm_models(llm_model_id)`
- `output_formats(format_id)`
- `tenant_llm_configs(config_id)`
- `tenant_widget_configs(widget_config_id)`

### Composite Indexes

**1. `ix_sessions_tenant_user` on `sessions`**
```sql
CREATE INDEX ix_sessions_tenant_user ON sessions(tenant_id, user_id, created_at);
```
**Purpose:** Fast lookup of user's sessions within a tenant
**Query Pattern:**
```sql
SELECT * FROM sessions
WHERE tenant_id = ? AND user_id = ?
ORDER BY created_at DESC;
```

**2. `ix_messages_session_timestamp` on `messages`**
```sql
CREATE INDEX ix_messages_session_timestamp ON messages(session_id, timestamp);
```
**Purpose:** Fast retrieval of conversation history
**Query Pattern:**
```sql
SELECT * FROM messages
WHERE session_id = ?
ORDER BY timestamp ASC;
```

**3. `ix_agent_tools_agent_priority` on `agent_tools`**
```sql
CREATE INDEX ix_agent_tools_agent_priority ON agent_tools(agent_id, priority);
```
**Purpose:** Fast tool lookup with priority ordering
**Query Pattern:**
```sql
SELECT tool_id FROM agent_tools
WHERE agent_id = ?
ORDER BY priority ASC;
```

### Single-Column Indexes

**Status & Availability Filters:**
- `tenants(status)` - Filter active/inactive tenants
- `agent_configs(is_active)` - Filter available agents
- `tool_configs(is_active)` - Filter available tools
- `tenant_agent_permissions(enabled)` - Filter enabled permissions
- `tenant_tool_permissions(enabled)` - Filter enabled permissions

**Timestamp Indexes:**
- `sessions(last_message_at)` - Find recent sessions

**Foreign Key Indexes:**
- `tenant_llm_configs(llm_model_id)` - Join to llm_models
- `tool_configs(base_tool_id)` - Join to base_tools

### Unique Constraints (Implicit Indexes)

- `tenants(domain)` - One tenant per domain
- `tenant_llm_configs(tenant_id)` - 1:1 relationship
- `tenant_widget_configs(tenant_id)` - 1:1 relationship
- `agent_configs(name)` - Unique agent names
- `base_tools(name)` - Unique tool type names
- `output_formats(name)` - Unique format names

---

## Data Isolation Patterns

### 1. **Hard Isolation (FK Constraints)**

**Tables:** `sessions`, `messages`
- **Pattern:** Direct FK to `tenant_id` + composite indexes
- **Guarantee:** Database-level referential integrity
- **Deletion:** Cascade deletes when tenant is deleted

**Example:**
```sql
-- Session isolation
ALTER TABLE sessions
ADD CONSTRAINT fk_sessions_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
ON DELETE CASCADE;

-- Messages inherit isolation via sessions
ALTER TABLE messages
ADD CONSTRAINT fk_messages_session
FOREIGN KEY (session_id) REFERENCES sessions(session_id)
ON DELETE CASCADE;
```

### 2. **Permission-Based Isolation**

**Tables:** `tenant_agent_permissions`, `tenant_tool_permissions`
- **Pattern:** Junction tables with composite PKs
- **Guarantee:** Explicit opt-in per tenant
- **Query:** INNER JOIN enforces permission check

**Example:**
```sql
-- Only load permitted agents
SELECT ac.*
FROM agent_configs ac
INNER JOIN tenant_agent_permissions tap
  ON tap.agent_id = ac.agent_id
WHERE tap.tenant_id = ?
  AND tap.enabled = true
  AND ac.is_active = true;
```

### 3. **Metadata-Based Isolation (PgVector)**

**Not a table:** Knowledge base documents
- **Pattern:** Metadata filtering during vector search
- **Guarantee:** Application-level (no FK constraint)
- **Risk:** Requires post-query validation

**Example:**
```python
# Vector search with metadata filter
results = vector_store.similarity_search_with_score(
    query="...",
    k=5,
    filter={"tenant_id": str(tenant_id)}
)

# ⚠️ MUST validate results:
for doc, score in results:
    assert doc.metadata["tenant_id"] == str(tenant_id)
```

---

## Migration Strategy

### Current Alembic Versions

All 13 tables are managed by Alembic migrations in `backend/alembic/versions/`.

**Migration Workflow:**
1. Modify SQLAlchemy models in `backend/src/models/`
2. Generate migration:
   ```bash
   alembic revision --autogenerate -m "description"
   ```
3. Review generated migration in `alembic/versions/`
4. Test migration:
   ```bash
   # Upgrade
   alembic upgrade head

   # Test rollback
   alembic downgrade -1

   # Re-upgrade
   alembic upgrade head
   ```
5. Commit migration file to version control

### Common Migration Scenarios

**Adding a new tenant-scoped table:**
```python
# models/new_table.py
class NewTable(Base):
    __tablename__ = "new_table"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID, ForeignKey("tenants.tenant_id"), nullable=False)
    # ... other columns

    # ALWAYS add composite index for tenant queries
    __table_args__ = (
        Index('ix_new_table_tenant', 'tenant_id', 'created_at'),
    )
```

**Adding a column to existing table:**
```bash
alembic revision -m "add column to sessions"
```

```python
# In generated migration
def upgrade():
    op.add_column('sessions',
        sa.Column('new_column', sa.String(100), nullable=True)
    )

def downgrade():
    op.drop_column('sessions', 'new_column')
```

---

## Database Performance Considerations

### Query Optimization

**1. Always use tenant_id in WHERE clause**
```sql
-- ✅ Good: Uses composite index
SELECT * FROM sessions
WHERE tenant_id = ? AND user_id = ?;

-- ❌ Bad: Cannot use tenant_user index efficiently
SELECT * FROM sessions
WHERE user_id = ?;
```

**2. Use EXPLAIN ANALYZE for slow queries**
```sql
EXPLAIN ANALYZE
SELECT m.* FROM messages m
INNER JOIN sessions s ON s.session_id = m.session_id
WHERE s.tenant_id = ?
ORDER BY m.timestamp DESC
LIMIT 50;
```

**3. Monitor index usage**
```sql
-- Check index usage statistics
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename IN ('sessions', 'messages', 'agent_configs')
ORDER BY idx_scan ASC;
```

### Connection Pooling

**SQLAlchemy Engine Configuration:**
```python
# config.py
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # Max connections in pool
    max_overflow=10,       # Max temporary connections
    pool_timeout=30,       # Timeout waiting for connection
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True,    # Validate connections before use
    echo=False             # Disable SQL logging in production
)
```

### PgVector Performance

**HNSW Index Creation:**
```sql
-- Create HNSW index for fast similarity search
CREATE INDEX knowledge_documents_embedding_idx
ON knowledge_documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Performance Tuning:**
- `m = 16`: Number of connections per layer (higher = better recall, slower build)
- `ef_construction = 64`: Size of candidate list during construction
- `vector_cosine_ops`: Use cosine similarity (recommended for normalized embeddings)

---

## Backup & Recovery Strategy

### Database Backup

**Daily Full Backup:**
```bash
# Backup entire database
pg_dump -h localhost -U agenthub -d agenthub -F c -f agenthub_$(date +%Y%m%d).backup

# Backup with compression
pg_dump -h localhost -U agenthub -d agenthub -F c -Z 9 -f agenthub_$(date +%Y%m%d).backup.gz
```

**Per-Tenant Backup:**
```sql
-- Export single tenant's data
COPY (
    SELECT * FROM sessions WHERE tenant_id = '...'
) TO '/tmp/tenant_sessions.csv' WITH CSV HEADER;

COPY (
    SELECT m.* FROM messages m
    INNER JOIN sessions s ON s.session_id = m.session_id
    WHERE s.tenant_id = '...'
) TO '/tmp/tenant_messages.csv' WITH CSV HEADER;
```

### Disaster Recovery

**Point-in-Time Recovery (PITR):**
1. Enable WAL archiving in `postgresql.conf`:
   ```
   wal_level = replica
   archive_mode = on
   archive_command = 'cp %p /path/to/archive/%f'
   ```

2. Take base backup:
   ```bash
   pg_basebackup -h localhost -U agenthub -D /backup/base -P
   ```

3. Restore to specific point:
   ```bash
   pg_restore -h localhost -U agenthub -d agenthub -1 backup.file
   ```

---

## Security Considerations

### 1. **Sensitive Data Columns**

**Encrypted at Rest:**
- `tenant_llm_configs.encrypted_api_key` - Fernet encrypted

**Should Be Encrypted (Future):**
- `messages.content` - Consider field-level encryption for PII
- `sessions.metadata` - May contain user data

### 2. **Row-Level Security (RLS) - Optional**

For additional defense-in-depth:
```sql
-- Enable RLS on sessions table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their tenant's sessions
CREATE POLICY tenant_isolation_policy ON sessions
    FOR ALL
    TO authenticated_users
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Trade-off:** Performance overhead vs. additional security layer

### 3. **Audit Logging**

**Recommended Table:**
```sql
CREATE TABLE audit_log (
    log_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(tenant_id),
    user_id         VARCHAR(255),
    action          VARCHAR(100) NOT NULL,  -- 'create', 'update', 'delete'
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    timestamp       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_log_tenant ON audit_log(tenant_id, timestamp DESC);
```

---

## Appendix: Full Schema DDL

### Database Creation

```sql
-- Create database
CREATE DATABASE agenthub WITH ENCODING 'UTF8';

-- Connect to database
\c agenthub

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### Table Creation Order (Respecting Dependencies)

**Order matters due to foreign key constraints:**

1. `tenants` (no dependencies)
2. `llm_models` (no dependencies)
3. `output_formats` (no dependencies)
4. `base_tools` (no dependencies)
5. `tenant_llm_configs` (→ tenants, llm_models)
6. `tenant_widget_configs` (→ tenants)
7. `agent_configs` (→ llm_models, output_formats)
8. `tool_configs` (→ base_tools, output_formats)
9. `agent_tools` (→ agent_configs, tool_configs)
10. `tenant_agent_permissions` (→ tenants, agent_configs, output_formats)
11. `tenant_tool_permissions` (→ tenants, tool_configs)
12. `sessions` (→ tenants, agent_configs)
13. `messages` (→ sessions)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Maintained By:** Engineering Team
**Review Frequency:** After major schema changes
