-- Manual SQL Script to Seed Base Data for ITL_PGVector
-- This script creates LLM models, base tools, tool configs, and agent configs
-- Idempotent: Safe to run multiple times using ON CONFLICT DO NOTHING

BEGIN TRANSACTION;

-- ============================================================
-- Step 1: Seed LLM Models
-- ============================================================
INSERT INTO llm_models (
    llm_model_id,
    provider,
    model_name,
    context_window,
    cost_per_1k_input_tokens,
    cost_per_1k_output_tokens,
    is_active,
    capabilities,
    created_at
) VALUES
    (
        'a1b2c3d4-e5f6-4748-9394-a1b2c3d4e5f6'::UUID,
        'google',
        'models/gemini-1.5-flash-latest',
        1000000,
        0.075,
        0.3,
        true,
        '{"vision": true, "long_context": true}'::JSONB,
        CURRENT_TIMESTAMP
    ),
    (
        'b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7'::UUID,
        'openrouter',
        'openai/gpt-4o-mini',
        128000,
        0.15,
        0.6,
        true,
        '{"vision": true, "function_calling": true}'::JSONB,
        CURRENT_TIMESTAMP
    ),
    (
        'c3d4e5f6-a7b8-496a-b6b8-c3d4e5f6a7b8'::UUID,
        'openrouter',
        'openai/gpt-4o',
        128000,
        5.0,
        15.0,
        true,
        '{"vision": true, "function_calling": true}'::JSONB,
        CURRENT_TIMESTAMP
    ),
    (
        'd4e5f6a7-b8c9-4a7b-c7c9-d4e5f6a7b8c9'::UUID,
        'openrouter',
        'anthropic/claude-3.5-sonnet',
        200000,
        3.0,
        15.0,
        true,
        '{"vision": true, "function_calling": true}'::JSONB,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (llm_model_id) DO NOTHING;

-- ============================================================
-- Step 2: Seed Base Tools
-- ============================================================
INSERT INTO base_tools (
    base_tool_id,
    name,
    type,
    description,
    handler_class,
    is_active,
    created_at,
    updated_at
) VALUES
    (
        '11111111-1111-1111-1111-111111111111'::UUID,
        'RAG Tool',
        'knowledge_retrieval',
        'Retrieve information from knowledge base using vector similarity search',
        'tools.rag.RAGTool',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '22222222-2222-2222-2222-222222222222'::UUID,
        'HTTP GET Tool',
        'http_request',
        'Make HTTP GET requests to external APIs',
        'tools.http.HTTPGetTool',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '33333333-3333-3333-3333-333333333333'::UUID,
        'HTTP POST Tool',
        'http_request',
        'Make HTTP POST requests to external APIs',
        'tools.http.HTTPPostTool',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (base_tool_id) DO NOTHING;

-- ============================================================
-- Step 3: Seed Tool Configs
-- ============================================================
INSERT INTO tool_configs (
    tool_id,
    name,
    base_tool_id,
    description,
    config,
    input_schema,
    is_active,
    created_at,
    updated_at
) VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
        'knowledge_base_search',
        '11111111-1111-1111-1111-111111111111'::UUID,
        'Search knowledge base with customizable RAG parameters',
        '{
            "top_k": 5,
            "chunk_size": 600,
            "chunk_overlap": 200,
            "separators": ["\n\n", "\n", ". ", " ", ""],
            "embedding_model": "all-MiniLM-L6-v2",
            "embedding_dimension": 384,
            "distance_strategy": "COSINE"
        }'::JSONB,
        '{
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query for the knowledge base"
                }
            },
            "required": ["query"]
        }'::JSONB,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (tool_id) DO NOTHING;

-- ============================================================
-- Step 4: Seed Output Formats
-- ============================================================
INSERT INTO output_formats (
    output_format_id,
    name,
    description,
    content_type,
    is_active,
    created_at,
    updated_at
) VALUES
    (
        'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID,
        'text',
        'Plain text response',
        'text/plain',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::UUID,
        'json',
        'JSON formatted response',
        'application/json',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (output_format_id) DO NOTHING;

-- ============================================================
-- Step 5: Seed Agent Configs
-- ============================================================
INSERT INTO agent_configs (
    agent_id,
    name,
    description,
    handler_class,
    llm_model_id,
    default_output_format_id,
    prompt_template,
    is_active,
    created_at,
    updated_at
) VALUES
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        'AgentGuidance',
        'Guidance agent for providing instructions and recommendations using knowledge base',
        'services.domain_agents.DomainAgent',
        'b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7'::UUID,
        'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID,
        'You are a helpful guidance agent. Your role is to provide clear instructions and recommendations based on knowledge base content. Always cite sources when appropriate.',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID,
        'AgentAnalysis',
        'Analysis agent for data analysis and insights',
        'services.domain_agents.DomainAgent',
        'b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7'::UUID,
        'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID,
        'You are an analytical agent. Your role is to analyze information, identify patterns, and provide insights.',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================================
-- Step 6: Seed Agent-Tool Relationships
-- ============================================================
INSERT INTO agent_tools (
    agent_tool_id,
    agent_id,
    tool_id,
    priority,
    is_required,
    created_at,
    updated_at
) VALUES
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
        1,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::UUID,
        'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
        1,
        false,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (agent_tool_id) DO NOTHING;

COMMIT;

-- ============================================================
-- Verification Queries
-- ============================================================
-- Check LLM Models
SELECT 'LLM Models' as category, COUNT(*) as count FROM llm_models;

-- Check Base Tools
SELECT 'Base Tools' as category, COUNT(*) as count FROM base_tools;

-- Check Tool Configs
SELECT 'Tool Configs' as category, COUNT(*) as count FROM tool_configs;

-- Check Output Formats
SELECT 'Output Formats' as category, COUNT(*) as count FROM output_formats;

-- Check Agents
SELECT 'Agents' as category, COUNT(*) as count FROM agent_configs;

-- Check Agent-Tool Links
SELECT 'Agent-Tool Links' as category, COUNT(*) as count FROM agent_tools;
