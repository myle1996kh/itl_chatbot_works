-- Seed Tenant Data for ITL_PGVector
-- Creates eTMS and Google tenants with their configurations

-- ============================================================
-- Step 1: Seed Tenants
-- ============================================================
INSERT INTO tenants (
    tenant_id,
    name,
    domain,
    status,
    created_at,
    updated_at
) VALUES
    (
        'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::UUID,
        'eTMS',
        'etms.agenthub.local',
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '1193a40f-1d03-4ecd-a601-901a55589f56'::UUID,
        'Google Tenant',
        'google.agenthub.local',
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================
-- Step 2: Seed Tenant LLM Configs
-- ============================================================
INSERT INTO tenant_llm_configs (
    config_id,
    tenant_id,
    llm_model_id,
    encrypted_api_key,
    rate_limit_rpm,
    rate_limit_tpm,
    created_at,
    updated_at
) VALUES
    -- eTMS: Using GPT-4o-mini via OpenRouter
    (
        '11111111-1111-2222-3333-444444444441'::UUID,
        'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::UUID,
        'b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7'::UUID,
        'sk-or-v1-xxx'::TEXT,
        60,
        10000,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    -- Google: Using Gemini 1.5 Flash
    (
        '11111111-1111-2222-3333-444444444442'::UUID,
        '1193a40f-1d03-4ecd-a601-901a55589f56'::UUID,
        'a1b2c3d4-e5f6-4748-9394-a1b2c3d4e5f6'::UUID,
        'AIzaSyDhsD6edS4hdMq641a1Wx9aGYUHMYZfDuc'::TEXT,
        60,
        10000,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (config_id) DO NOTHING;

-- ============================================================
-- Step 3: Grant Agent Permissions to Tenants
-- ============================================================
INSERT INTO tenant_agent_permissions (
    tenant_id,
    agent_id,
    enabled,
    created_at,
    updated_at
) VALUES
    -- eTMS: Grant AgentGuidance
    (
        'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::UUID,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    -- eTMS: Grant AgentAnalysis
    (
        'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::UUID,
        'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    -- eTMS: Grant SupervisorAgent
    (
        'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::UUID,
        (SELECT agent_id FROM agent_configs WHERE name = 'SupervisorAgent' LIMIT 1),
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    -- Google: Grant AgentGuidance
    (
        '1193a40f-1d03-4ecd-a601-901a55589f56'::UUID,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    -- Google: Grant AgentAnalysis
    (
        '1193a40f-1d03-4ecd-a601-901a55589f56'::UUID,
        'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    -- Google: Grant SupervisorAgent
    (
        '1193a40f-1d03-4ecd-a601-901a55589f56'::UUID,
        (SELECT agent_id FROM agent_configs WHERE name = 'SupervisorAgent' LIMIT 1),
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (tenant_id, agent_id) DO UPDATE SET enabled = true, updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- Step 4: Grant Tool Permissions to Tenants
-- ============================================================
INSERT INTO tenant_tool_permissions (
    tenant_id,
    tool_id,
    enabled,
    created_at
) VALUES
    -- eTMS: Grant knowledge_base_search tool
    (
        'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'::UUID,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
        true,
        CURRENT_TIMESTAMP
    ),
    -- Google: Grant knowledge_base_search tool
    (
        '1193a40f-1d03-4ecd-a601-901a55589f56'::UUID,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
        true,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (tenant_id, tool_id) DO UPDATE SET enabled = true;
