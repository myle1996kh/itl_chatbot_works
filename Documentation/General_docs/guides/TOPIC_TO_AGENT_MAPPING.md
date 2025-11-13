# Topic to Agent Direct Mapping

**Status**: MVP Architecture Change
**Version**: 1.0
**Date**: 2025-11-10

## Executive Summary

The frontend uses "Topics" (static, user-selectable categories) while the backend uses "Agents" (LLM-routed domain handlers). For MVP, we **skip the SupervisorAgent intermediary** and directly route to specific agents based on selected topic.

This eliminates one API call and provides predictable, fast routing.

## Current Architecture (To Be Replaced)

```
Frontend: User selects Topic
    ↓
API: POST /api/{tenant_id}/chat
    ↓
Backend: SupervisorAgent
  - Analyzes message intent
  - Routes to appropriate DomainAgent
  - (1 extra LLM call - slow)
    ↓
DomainAgent executes
    ↓
Response returned
```

**Problem**: Adds latency (SupervisorAgent LLM inference)

## New Architecture (MVP)

```
Frontend: User selects Topic
    ↓
Frontend maps Topic → Agent ID
    ↓
API: POST /api/{tenant_id}/chat
  - Include agent_id in request
    ↓
Backend: Skip SupervisorAgent
  - Directly instantiate Agent
  - Execute immediately
    ↓
Response returned

(Much faster - no intent detection overhead)
```

## Topic-to-Agent Mapping

### Frontend Mapping (Client-Side)

The frontend will maintain a configuration mapping Topics → Agents:

```typescript
// frontend/config/topic-agent-mapping.ts
export const TOPIC_TO_AGENT_MAPPING = {
  'user-support': {
    agentId: 'agent-support-guide',
    agentName: 'AgentGuideline',
    description: 'User support and account issues'
  },
  'shipment-lookup': {
    agentId: 'agent-tracking-debt',
    agentName: 'AgentTracking',
    description: 'Shipment and tracking information'
  },
  'user-guide': {
    agentId: 'agent-doc-reference',
    agentName: 'AgentDocumentation',
    description: 'System documentation and guides'
  },
  'debt-by-salesman': {
    agentId: 'agent-financial-debt',
    agentName: 'AgentFinance',
    description: 'Financial and debt tracking'
  },
};
```

### Backend Mapping (Database)

The database already has `agent_configs` table. We ensure agents are pre-configured:

```python
# Agent IDs that frontend will reference
AGENT_IDS = {
    'agent-support-guide',
    'agent-tracking-debt',
    'agent-doc-reference',
    'agent-financial-debt',
}

# In database, each agent_config has:
# - agent_id: str (unique identifier)
# - agent_name: str (display name)
# - description: str
# - system_prompt: str (specific instructions)
# - tools: list (which tools it can use)
# - llm_config: dict (temperature, max_tokens, etc.)
```

## Implementation Changes

### 1. Backend API Change

**Old Chat Endpoint**:
```python
@router.post("/{tenant_id}/chat")
def chat(
    tenant_id: str,
    request: ChatRequest,  # {session_id, user_id, message, metadata}
):
    # SupervisorAgent decides which agent to use
    supervisor = SupervisorAgent(...)
    response = await supervisor.route(request.message)
```

**New Chat Endpoint**:
```python
@router.post("/{tenant_id}/chat")
def chat(
    tenant_id: str,
    request: ChatRequest,  # {session_id, user_id, message, agent_id, metadata}
):
    # Skip SupervisorAgent - use specified agent directly
    agent_config = db.query(AgentConfig).filter(
        AgentConfig.agent_id == request.agent_id
    ).first()

    if not agent_config:
        raise HTTPException(status_code=400, detail="Invalid agent_id")

    agent = DomainAgent(config=agent_config)
    response = await agent.execute(request.message)
    return response
```

### 2. ChatRequest Schema Update

```python
# backend/src/schemas/chat.py

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    user_id: str
    message: str
    agent_id: str  # ← NEW: Specify which agent to use
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "session_id": "sess-123",
            "user_id": "user-456",
            "message": "How do I reset my password?",
            "agent_id": "agent-support-guide",  # ← Topic mapped to agent
            "metadata": {"source": "web"}
        }
    })
```

### 3. Frontend Change

**Old**: Select topic, send message, backend figures out intent

```typescript
// components/ChatWidget.tsx - OLD

const handleSendMessage = async () => {
  const response = await generateRagResponse(input, tenant, currentTopic, messages);
  // currentTopic has static context, but agent is not specified
};
```

**New**: Select topic, map to agent, send with agent_id

```typescript
// components/ChatWidget.tsx - NEW

import { TOPIC_TO_AGENT_MAPPING } from '../config/topic-agent-mapping';

const handleSendMessage = async () => {
  const topic = currentTopic;  // User selected this
  const agentMapping = TOPIC_TO_AGENT_MAPPING[topic.id];

  if (!agentMapping) {
    throw new Error(`No agent mapping for topic: ${topic.id}`);
  }

  // Send to backend with agent_id
  const response = await fetch(`/api/${tenantId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: session.id,
      user_id: userInfo.email,
      message: input,
      agent_id: agentMapping.agentId,  // ← Send agent ID
      metadata: { source: 'web', topic: topic.name }
    })
  });
};
```

## Backward Compatibility

If frontend doesn't send `agent_id`:

```python
# backend: fallback to SupervisorAgent (for backward compatibility)

def chat(request: ChatRequest):
    if request.agent_id:
        # Direct routing
        agent = get_agent(request.agent_id)
    else:
        # Fallback to SupervisorAgent
        supervisor = SupervisorAgent()
        agent = await supervisor.route(request.message)

    return await agent.execute(request.message)
```

## Pros & Cons

### Pros ✅
- **Faster**: No SupervisorAgent overhead
- **Predictable**: User explicitly selects agent
- **Simpler**: No intent detection logic needed
- **MVP-friendly**: Less complex backend

### Cons ⚠️
- **Less intelligent**: No adaptive routing
- **Fixed topics**: Can't handle new intents without UI change
- **User confusion**: If they select wrong topic

### Future Enhancement (Phase 2)
- **Hybrid**: Keep direct routing for speed, but offer "Confused? Ask SupervisorAgent" button
- **Intelligent**: Learn from selection patterns to auto-categorize
- **Multi-agent**: If message needs 2+ agents, SupervisorAgent coordinates

## Configuration Database

Ensure these agents are seeded in `agent_configs`:

```sql
-- backend/setup/seed_base_data.py

agents_to_seed = [
    {
        'agent_id': 'agent-support-guide',
        'agent_name': 'AgentGuideline',
        'description': 'Handles user support and account issues',
        'system_prompt': 'You are a helpful support agent...',
        'tools': ['rag', 'http'],
        'llm_config': {
            'model': 'claude-3-sonnet',
            'temperature': 0.7,
            'max_tokens': 1000,
        }
    },
    {
        'agent_id': 'agent-tracking-debt',
        'agent_name': 'AgentTracking',
        'description': 'Handles shipment tracking and debt inquiries',
        'system_prompt': 'You are a financial tracking specialist...',
        'tools': ['rag', 'http'],
        'llm_config': {
            'model': 'claude-3-sonnet',
            'temperature': 0.5,
            'max_tokens': 1500,
        }
    },
    # ... more agents
]
```

## Migration Path

### Step 1: Add agent_id to ChatRequest
- Update schema in `src/schemas/chat.py`
- Make it optional with default=None
- Deploy to backend

### Step 2: Update Frontend Config
- Create `topic-agent-mapping.ts`
- Update ChatWidget to send agent_id
- Test with backend

### Step 3: Optimize Backend
- Remove SupervisorAgent from chat path
- Update chat endpoint to use agent_id
- Fall back to SupervisorAgent if not provided

### Step 4: Remove SupervisorAgent (Later)
- Once frontend consistently sends agent_id
- Deprecate SupervisorAgent from chat flow
- Keep for other uses if needed

## Testing Strategy

### Unit Tests
```python
# backend/tests/unit/test_direct_routing.py

def test_chat_with_agent_id_skips_supervisor():
    """Verify SupervisorAgent is not invoked when agent_id provided"""
    # Mock DomainAgent
    # Verify SupervisorAgent.route() is NOT called
    # Verify DomainAgent.execute() IS called

def test_chat_without_agent_id_uses_supervisor():
    """Backward compatibility: fallback to SupervisorAgent"""
    # Don't provide agent_id
    # Verify SupervisorAgent.route() IS called
```

### Integration Tests
```python
# backend/tests/integration/test_frontend_chat_flow.py

def test_topic_to_agent_routing():
    """End-to-end: Frontend selects topic → Agent executes"""
    payload = {
        'session_id': 'sess-123',
        'user_id': 'user-456',
        'message': 'Help me reset password',
        'agent_id': 'agent-support-guide'
    }
    response = await client.post(
        f'/api/test-tenant/chat',
        json=payload
    )
    assert response.status_code == 200
    assert 'response' in response.json()
```

## API Documentation Update

Update `/docs` (Swagger UI) to show new parameter:

```python
@router.post(
    "/{tenant_id}/chat",
    summary="Chat with specific agent",
    description="Send message to a pre-selected agent. If agent_id omitted, SupervisorAgent will route."
)
def chat(
    tenant_id: str = Path(..., description="Tenant ID"),
    request: ChatRequest = Body(...)
):
    """
    Request body now includes:
    - agent_id (optional): Which agent to use
      Examples: 'agent-support-guide', 'agent-tracking-debt'
    """
```

## Glossary

| Term | Meaning |
|------|---------|
| **Topic** | Frontend concept - user-selectable category (e.g., "User Support") |
| **Agent** | Backend concept - domain-specific handler (e.g., "AgentGuideline") |
| **Mapping** | Topic ID ↔ Agent ID translation |
| **Direct Routing** | Skip intent detection, use specified agent |
| **SupervisorAgent** | LLM-based router (bypassed in MVP) |
