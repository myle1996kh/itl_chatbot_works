# Tool Registry Improvements Plan

## Comparison: LangGraph BigTool vs Current System

### Our Strengths
1. ✅ **Multi-tenancy**: Full tenant isolation + permissions
2. ✅ **Database-driven config**: Admin can add/edit tools via API
3. ✅ **Security**: JWT auth + encrypted API keys
4. ✅ **Rich metadata**: JSON config + input schemas + output formats
5. ✅ **Priority-based loading**: Explicit control over tool selection

### BigTool Strengths (What We Can Learn)
1. 🔍 **Semantic tool retrieval**: Vector search to find relevant tools
2. 📈 **Scalability**: Designed for 100s-1000s of tools
3. 🎭 **Two-stage pattern**: Search → Invoke (reduces LLM context)
4. 🔧 **Custom retrieval**: Injectable retrieval functions

---

## 🚀 Proposed Improvements

### Improvement 1: Add Semantic Tool Discovery
**Goal**: Scale to 50+ tools per tenant using vector search

**Current State**:
```python
# Load top 5 tools by priority (static)
tools = load_agent_tools(db, agent_id, tenant_id, jwt_token, top_n=5)
llm_with_tools = llm.bind_tools(tools)  # All 5 tools always bound
```

**Improved State**:
```python
# Stage 1: Dynamically retrieve relevant tools based on query
relevant_tools = await retrieve_relevant_tools(user_message, top_k=3)

# Stage 2: Bind only relevant tools
llm_with_tools = llm.bind_tools(relevant_tools)
```

**Implementation Steps**:

#### Step 1.1: Add `tool_embeddings` table
```sql
CREATE TABLE tool_embeddings (
    tool_id UUID PRIMARY KEY REFERENCES tool_configs(tool_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    name_embedding vector(384),          -- Embed tool name
    description_embedding vector(384),   -- Embed tool description
    combined_embedding vector(384),      -- Embed name + description
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tool_embeddings_tenant ON tool_embeddings(tenant_id);
CREATE INDEX idx_tool_embeddings_combined ON tool_embeddings USING ivfflat (combined_embedding vector_cosine_ops);
```

#### Step 1.2: Create embedding service for tools
```python
# backend/src/services/tool_embedding_service.py

class ToolEmbeddingService:
    """Generate and store embeddings for tool discovery."""

    def __init__(self, db: Session, embedding_service: EmbeddingService):
        self.db = db
        self.embedding_service = embedding_service

    def embed_tool(self, tool: ToolConfig) -> List[float]:
        """Create combined embedding for tool name + description."""
        combined_text = f"{tool.name}: {tool.description}"
        embedding = self.embedding_service.embed(combined_text)

        # Store in database
        self.db.execute("""
            INSERT INTO tool_embeddings (tool_id, tenant_id, combined_embedding)
            VALUES (:tool_id, :tenant_id, :embedding)
            ON CONFLICT (tool_id)
            DO UPDATE SET combined_embedding = :embedding, updated_at = NOW()
        """, {
            "tool_id": tool.tool_id,
            "tenant_id": tool.tenant_id,  # Assuming we add tenant_id to tool_configs
            "embedding": embedding
        })

        return embedding

    async def search_tools(
        self,
        tenant_id: str,
        query: str,
        top_k: int = 3,
        filter_agent_id: Optional[str] = None
    ) -> List[str]:
        """Semantic search for relevant tools."""
        # Embed query
        query_embedding = self.embedding_service.embed(query)

        # Search with tenant + agent filtering
        filter_clause = "WHERE te.tenant_id = :tenant_id"
        if filter_agent_id:
            filter_clause += " AND EXISTS (SELECT 1 FROM agent_tools WHERE tool_id = te.tool_id AND agent_id = :agent_id)"

        results = self.db.execute(f"""
            SELECT te.tool_id, tc.name, tc.description,
                   te.combined_embedding <=> :query_emb::vector as distance
            FROM tool_embeddings te
            JOIN tool_configs tc ON te.tool_id = tc.tool_id
            {filter_clause}
            ORDER BY distance ASC
            LIMIT :top_k
        """, {
            "query_emb": query_embedding,
            "tenant_id": tenant_id,
            "agent_id": filter_agent_id,
            "top_k": top_k
        })

        return [str(row['tool_id']) for row in results]
```

#### Step 1.3: Update DomainAgent with semantic retrieval
```python
# backend/src/services/domain_agents.py

class DomainAgent:
    def __init__(self, db, agent_id, tenant_id, jwt_token, session_id=None):
        # ... existing code ...

        # Initialize tool embedding service
        self.tool_embedding_service = ToolEmbeddingService(db, get_embedding_service())

    async def _retrieve_relevant_tools(self, user_message: str, top_k: int = 3):
        """Dynamically retrieve tools using semantic search."""
        # Search for relevant tools
        relevant_tool_ids = await self.tool_embedding_service.search_tools(
            tenant_id=self.tenant_id,
            query=user_message,
            top_k=top_k,
            filter_agent_id=self.agent_id  # Only search within agent's tools
        )

        # Load tools
        tools = []
        for tool_id in relevant_tool_ids:
            try:
                tool = tool_registry.create_tool_from_db(
                    self.db, tool_id, self.tenant_id, self.jwt_token
                )
                tools.append(tool)
            except Exception as e:
                logger.error("tool_load_failed", tool_id=tool_id, error=str(e))

        return tools

    async def invoke(self, user_message: str) -> Dict[str, Any]:
        # ... existing intent extraction ...

        if self.tools:
            # NEW: Dynamic tool retrieval
            if len(self.tools) > 5:  # Only use semantic search if many tools
                relevant_tools = await self._retrieve_relevant_tools(user_message, top_k=3)
                logger.info(
                    "semantic_tool_retrieval",
                    agent_name=self.agent_config.name,
                    total_tools=len(self.tools),
                    retrieved_tools=len(relevant_tools)
                )
            else:
                relevant_tools = self.tools  # Use all tools if small set

            # Bind only relevant tools
            llm_with_tools = self.llm.bind_tools(relevant_tools)
            # ... rest of invoke logic ...
```

**Benefits**:
- 📈 **Scale to 50+ tools** per tenant without overwhelming LLM
- 🎯 **Better accuracy**: LLM sees only relevant tools
- 💰 **Cost reduction**: Fewer tokens per request
- ⚡ **Faster responses**: Smaller context = faster LLM inference

---

### Improvement 2: Add Tool Categories/Tags
**Goal**: Enable category-based filtering (like BigTool's `Literal` hints)

**Implementation**:

#### Step 2.1: Add categories to base_tools
```sql
ALTER TABLE base_tools ADD COLUMN category VARCHAR(50);
-- Categories: 'data_retrieval', 'computation', 'communication', 'automation'

UPDATE base_tools SET category = 'data_retrieval' WHERE type = 'rag';
UPDATE base_tools SET category = 'communication' WHERE type = 'http';
```

#### Step 2.2: Create tool_tags table
```sql
CREATE TABLE tool_tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tool_tag_assignments (
    tool_id UUID REFERENCES tool_configs(tool_id),
    tag_id UUID REFERENCES tool_tags(tag_id),
    PRIMARY KEY (tool_id, tag_id)
);

-- Example tags
INSERT INTO tool_tags (name, description) VALUES
    ('search', 'Tools for searching and retrieving information'),
    ('analytics', 'Tools for data analysis and reporting'),
    ('notifications', 'Tools for sending notifications'),
    ('shipping', 'Tools related to shipment management');
```

#### Step 2.3: Update tool search with tags
```python
async def search_tools(
    self,
    tenant_id: str,
    query: str,
    top_k: int = 3,
    tags: Optional[List[str]] = None,
    category: Optional[str] = None
) -> List[str]:
    """Search tools with category/tag filtering."""
    filters = ["te.tenant_id = :tenant_id"]
    params = {"tenant_id": tenant_id, "query_emb": query_embedding, "top_k": top_k}

    if category:
        filters.append("bt.category = :category")
        params["category"] = category

    if tags:
        filters.append("""
            EXISTS (
                SELECT 1 FROM tool_tag_assignments tta
                JOIN tool_tags tt ON tta.tag_id = tt.tag_id
                WHERE tta.tool_id = te.tool_id AND tt.name = ANY(:tags)
            )
        """)
        params["tags"] = tags

    # ... execute query with filters ...
```

**Benefits**:
- 🏷️ **Better organization**: Group tools by purpose
- 🎯 **Precise retrieval**: Filter by category before semantic search
- 📊 **Analytics**: Track which tool categories are most used

---

### Improvement 3: Add Tool Usage Analytics
**Goal**: Track which tools are actually useful for optimization

**Implementation**:

#### Step 3.1: Create tool_usage_logs table
```sql
CREATE TABLE tool_usage_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tool_configs(tool_id),
    agent_id UUID REFERENCES agent_configs(agent_id),
    tenant_id UUID REFERENCES tenants(tenant_id),
    session_id UUID REFERENCES sessions(session_id),
    query TEXT,                      -- User's original question
    execution_time_ms INT,           -- Tool execution duration
    success BOOLEAN,                 -- Did tool execute successfully?
    error_message TEXT,              -- If failed, why?
    result_used BOOLEAN,             -- Did LLM use this result in final response?
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tool_usage_tenant_time ON tool_usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_tool_usage_tool ON tool_usage_logs(tool_id);
```

#### Step 3.2: Log tool usage in DomainAgent
```python
async def invoke(self, user_message: str):
    # ... tool execution ...
    for tool_call in response.tool_calls:
        start_time = time.time()
        try:
            tool_result = await tool_to_execute.ainvoke(tool_args)
            execution_time = (time.time() - start_time) * 1000

            # Log usage
            self.db.execute("""
                INSERT INTO tool_usage_logs
                (tool_id, agent_id, tenant_id, session_id, query,
                 execution_time_ms, success, result_used)
                VALUES (:tool_id, :agent_id, :tenant_id, :session_id, :query,
                        :exec_time, true, true)
            """, {
                "tool_id": tool_to_execute.tool_id,
                "agent_id": self.agent_id,
                "tenant_id": self.tenant_id,
                "session_id": self.session_id,
                "query": user_message,
                "exec_time": execution_time
            })
        except Exception as e:
            # Log failure
            # ...
```

#### Step 3.3: Create admin analytics endpoint
```python
# backend/src/api/admin/analytics.py

@router.get("/tenants/{tenant_id}/tool-analytics")
async def get_tool_analytics(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    db: Session = Depends(get_db)
):
    """Get tool usage analytics."""
    stats = db.execute("""
        SELECT
            tc.name as tool_name,
            COUNT(*) as total_calls,
            AVG(execution_time_ms) as avg_execution_time,
            SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
            SUM(CASE WHEN result_used THEN 1 ELSE 0 END)::float / COUNT(*) as utility_rate
        FROM tool_usage_logs tul
        JOIN tool_configs tc ON tul.tool_id = tc.tool_id
        WHERE tul.tenant_id = :tenant_id
          AND tul.created_at BETWEEN :start_date AND :end_date
        GROUP BY tc.tool_id, tc.name
        ORDER BY total_calls DESC
    """, {"tenant_id": tenant_id, "start_date": start_date, "end_date": end_date})

    return {"analytics": stats}
```

**Benefits**:
- 📊 **Data-driven optimization**: Know which tools are valuable
- 🐛 **Error tracking**: Identify problematic tools
- 💰 **Cost analysis**: Track execution times for billing
- 🎯 **Auto-tuning**: Adjust priority based on usage

---

## 🎬 Implementation Priority

### Phase 1: Foundation (Week 1-2)
1. ✅ Add `tool_embeddings` table
2. ✅ Create `ToolEmbeddingService`
3. ✅ Migrate existing tools → generate embeddings
4. ✅ Add admin endpoint to regenerate embeddings

### Phase 2: Semantic Retrieval (Week 3-4)
1. ✅ Implement `_retrieve_relevant_tools()` in `DomainAgent`
2. ✅ Add fallback logic (use all tools if < 5 tools)
3. ✅ Add logging for semantic retrieval
4. ✅ Test with 20+ tools

### Phase 3: Categories & Tags (Week 5)
1. ✅ Add category column to base_tools
2. ✅ Create tool_tags tables
3. ✅ Update admin UI for tagging
4. ✅ Add tag filtering to search

### Phase 4: Analytics (Week 6)
1. ✅ Create tool_usage_logs table
2. ✅ Add logging in tool execution
3. ✅ Create analytics endpoints
4. ✅ Build dashboard

---

## 📈 Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Max tools per tenant | 10 | 100+ | **10x** |
| Avg LLM context size | 5 tools × 200 tokens = 1000 | 3 tools × 200 tokens = 600 | **-40%** |
| Tool selection accuracy | 100% (all tools shown) | 95% (semantic search) | Acceptable tradeoff |
| Response time | Baseline | -15% (smaller context) | Faster |
| Cost per request | Baseline | -30% (fewer tokens) | Cheaper |

---

## ⚠️ Risks & Mitigations

### Risk 1: Semantic search misses relevant tool
**Mitigation**:
- Keep priority-based fallback for critical tools
- Add manual "always include" flag in tool config
- Monitor tool_usage_logs for missed opportunities

### Risk 2: Embedding generation overhead
**Mitigation**:
- Generate embeddings async on tool create/update
- Cache embeddings (already in tool_embeddings table)
- Batch regeneration for migrations

### Risk 3: Increased database queries
**Mitigation**:
- Use ivfflat index for fast vector search
- Cache tool embeddings in Redis
- Implement query result caching

---

## 🎯 Summary

**Keep from Current System:**
- ✅ Multi-tenancy (better than BigTool)
- ✅ Database-driven config (better than BigTool)
- ✅ Security & permissions (better than BigTool)

**Learn from BigTool:**
- 🔍 Semantic tool retrieval (implement Phase 2)
- 📈 Scale to 100+ tools (implement Phase 1-2)
- 🎭 Two-stage pattern (implement Phase 2)

**Add Our Innovations:**
- 🏷️ Tool categories & tags (Phase 3)
- 📊 Usage analytics (Phase 4)
- 🎯 Auto-tuning based on data (Future)
