-- Step 1: Verify SupervisorAgent was inserted
SELECT agent_id, name, description, is_active, created_at
FROM agent_configs
WHERE name = 'SupervisorAgent';

-- Step 2: Check existing permissions for the 2 tenants
SELECT tap.tenant_id, t.name as tenant_name, ac.name as agent_name, tap.enabled
FROM tenant_agent_permissions tap
JOIN tenants t ON t.tenant_id = tap.tenant_id
JOIN agent_configs ac ON ac.agent_id = tap.agent_id
WHERE tap.tenant_id IN (
    'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::uuid,
    '1193a40f-1d03-4ecd-a601-901a55589f56'::uuid
)
AND ac.name = 'SupervisorAgent';

-- Step 3: Add supervisor permissions for the 2 specific tenants (if not already exist)
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled, created_at, updated_at)
SELECT
    t.tenant_id,
    ac.agent_id,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    VALUES
        ('f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::uuid),
        ('1193a40f-1d03-4ecd-a601-901a55589f56'::uuid)
) AS t(tenant_id)
CROSS JOIN agent_configs ac
WHERE ac.name = 'SupervisorAgent'
ON CONFLICT (tenant_id, agent_id) DO UPDATE
SET enabled = true, updated_at = CURRENT_TIMESTAMP;

-- Step 4: Check existing RAG tool_configs
SELECT
    tc.tool_id,
    tc.name,
    tc.config,
    bt.name as base_tool_name,
    bt.handler_class
FROM tool_configs tc
JOIN base_tools bt ON bt.base_tool_id = tc.base_tool_id
WHERE bt.handler_class = 'tools.rag.RAGTool';

-- Step 5: Update RAG tool_configs with new parameters (if they don't have them)
-- This adds default values for new RAG configuration parameters
UPDATE tool_configs
SET config = config || jsonb_build_object(
    'chunk_size', 600,
    'chunk_overlap', 200,
    'separators', '["\\n\\n", "\\n", ". ", " ", ""]'::jsonb,
    'embedding_model', 'all-MiniLM-L6-v2',
    'embedding_dimension', 384,
    'distance_strategy', 'COSINE'
),
updated_at = CURRENT_TIMESTAMP
WHERE base_tool_id IN (
    SELECT base_tool_id FROM base_tools WHERE handler_class = 'tools.rag.RAGTool'
)
AND NOT (config ? 'chunk_size');  -- Only update if chunk_size doesn't exist

-- Step 6: Verify RAG configs were updated
SELECT
    tc.tool_id,
    tc.name,
    tc.config
FROM tool_configs tc
JOIN base_tools bt ON bt.base_tool_id = tc.base_tool_id
WHERE bt.handler_class = 'tools.rag.RAGTool';
