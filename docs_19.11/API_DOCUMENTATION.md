# Complete API Documentation

Production-ready API reference with detailed testing examples.

## 🔑 Authentication

### JWT Token (RS256)

**Required for**:
- `POST /{tenant_id}/chat` (if `DISABLE_AUTH=false`)

**Where to Get JWT**:
- From your authentication service
- Should contain `sub` (user ID) claim
- Optional: `tenant_id` in claims for validation

**Header Format**:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Optional Auth Bypass**:
```bash
# Set environment variable
export DISABLE_AUTH=true
```

This allows testing without JWT tokens.

## 🎯 Primary Chat Endpoint

### POST `/{tenant_id}/chat`

**Production endpoint with authentication**

**URL**:
```
POST /api/{tenant_id}/chat
```

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Path Parameters**:
```
tenant_id: UUID of your tenant
```

**Request Body** (`ChatRequest`):
```json
{
  "message": "What is my invoice status?",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": null,
  "agent_name": null,
  "metadata": {
    "jwt_token": "eyJhbGc...",
    "source": "widget"
  }
}
```

**Field Descriptions**:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | String | Yes | User message (1-2000 chars) |
| `user_id` | String | Yes | User UUID or identifier |
| `session_id` | String (UUID) | No | Existing session ID; omit to create new |
| `agent_name` | String | No | Route to specific agent (skips SupervisorAgent) |
| `metadata` | Object | No | Additional context data |

**Response** (`ChatResponse`):
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "message_id": "770e8400-e29b-41d4-a716-446655440222",
  "response": {
    "text": "Your invoice INV-2025-001234 was shipped on 2025-11-15. Tracking: TRK-123456"
  },
  "agent": "InvoiceAgent",
  "intent": "check_invoice_status",
  "format": "text",
  "renderer_hint": {},
  "metadata": {
    "agent_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
    "duration_ms": 1234.5,
    "status": "success",
    "llm_model": {
      "llm_model_id": "model-uuid",
      "model_class": "ChatOpenAI",
      "model_name": "gpt-4o-mini"
    },
    "tool_calls": [
      {
        "tool_name": "lookup_invoice",
        "tool_args": {
          "invoice_id": "INV-2025-001234"
        },
        "tool_id": "tool-uuid"
      }
    ],
    "extracted_entities": {
      "invoice_id": "INV-2025-001234"
    }
  }
}
```

**Response Headers**:
```
X-RateLimit-Limit-RPM: 100
X-RateLimit-Remaining-RPM: 95
X-RateLimit-Limit-TPM: 10000
X-RateLimit-Remaining-TPM: 9500
```

**Status Codes**:

| Code | Scenario |
|------|----------|
| 200 | Success |
| 400 | Invalid request (bad user_id format, etc.) |
| 403 | Access denied (wrong tenant, auth failed) |
| 404 | Tenant not found, user not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## 🧪 Test Endpoint

### POST `/{tenant_id}/test/chat`

**Testing endpoint (no authentication required)**

**URL**:
```
POST /api/{tenant_id}/test/chat
```

**Headers**:
```
Content-Type: application/json
```

**Request Body** (same as `ChatRequest`):
```json
{
  "message": "What is my invoice status?",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": null,
  "agent_name": null,
  "metadata": {}
}
```

**Response**: Same as production endpoint

**Key Differences from Production**:
- ✅ No JWT required
- ✅ DISABLE_AUTH bypass not needed
- ✅ Same response format
- ✅ Same logging

---

## 📚 Testing Examples

### Example 1: Basic Chat (cURL)

**Scenario**: Send a simple message without specifying agent

```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is my invoice status?",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": null,
    "agent_name": null,
    "metadata": {}
  }'
```

**Response**:
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "message_id": "770e8400-e29b-41d4-a716-446655440222",
  "response": {
    "text": "Your invoice INV-2025-001234 was shipped..."
  },
  "agent": "InvoiceAgent",
  "intent": "check_invoice_status",
  "format": "text",
  "renderer_hint": {},
  "metadata": {
    "agent_id": "agent-uuid",
    "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
    "duration_ms": 1250.3,
    "status": "success",
    "extracted_entities": {
      "invoice_id": "INV-2025-001234"
    }
  }
}
```

### Example 2: Direct Agent Routing (cURL)

**Scenario**: Skip SupervisorAgent, route directly to InvoiceAgent

```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check invoice INV-2025-005678",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": null,
    "agent_name": "InvoiceAgent",
    "metadata": {}
  }'
```

**Key Difference**: `"agent_name": "InvoiceAgent"` skips supervisor routing

**Response**:
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "response": {
    "text": "Invoice INV-2025-005678 status: pending approval..."
  },
  "agent": "InvoiceAgent",
  "intent": "query",
  "metadata": {
    "tool_calls": [
      {
        "tool_name": "lookup_invoice",
        "tool_args": {"invoice_id": "INV-2025-005678"},
        "tool_id": "tool-uuid"
      }
    ]
  }
}
```

### Example 3: Session Continuation (cURL)

**Scenario**: Continue conversation in existing session

**First Request**:
```bash
# First message - creates new session
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check my invoice status",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": null,
    "metadata": {}
  }'
```

**Extract session_id from response**: `"session_id": "660e8400-e29b-41d4-a716-446655440111"`

**Second Request** (same session):
```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "When will it ship?",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": "660e8400-e29b-41d4-a716-446655440111",
    "metadata": {}
  }'
```

**Key Feature**: Conversation history is loaded from previous messages in same session

### Example 4: Python Client

```python
import requests
import json
from typing import Optional

class ChatClient:
    def __init__(self, base_url: str, tenant_id: str, use_test_endpoint: bool = True):
        self.base_url = base_url
        self.tenant_id = tenant_id
        self.use_test_endpoint = use_test_endpoint
        self.session_id = None

    def chat(
        self,
        message: str,
        user_id: str = "default_user",
        agent_name: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> dict:
        """Send message and get response."""

        endpoint = "test/chat" if self.use_test_endpoint else "chat"
        url = f"{self.base_url}/api/{self.tenant_id}/{endpoint}"

        payload = {
            "message": message,
            "user_id": user_id,
            "session_id": self.session_id,
            "agent_name": agent_name,
            "metadata": metadata or {}
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

        data = response.json()

        # Update session_id for next message
        if "session_id" in data:
            self.session_id = data["session_id"]

        return data

    def conversation(self, user_id: str, agent_name: Optional[str] = None):
        """Interactive conversation loop."""
        print(f"Starting conversation (session_id: {self.session_id})")
        while True:
            try:
                user_input = input("\nYou: ")
                if user_input.lower() in ["quit", "exit", "bye"]:
                    break

                response = self.chat(
                    message=user_input,
                    user_id=user_id,
                    agent_name=agent_name
                )

                text = response["response"]["text"]
                agent = response["agent"]
                intent = response["intent"]

                print(f"\nAgent ({agent}): {text}")
                print(f"  └─ Intent: {intent}")

                # Show extracted entities if available
                entities = response["metadata"].get("extracted_entities", {})
                if entities:
                    print(f"  └─ Entities: {entities}")

            except KeyboardInterrupt:
                print("\nConversation ended.")
                break
            except requests.exceptions.RequestException as e:
                print(f"Error: {e}")

# Usage Example:
if __name__ == "__main__":
    client = ChatClient(
        base_url="http://localhost:8000",
        tenant_id="880e8400-e29b-41d4-a716-446655440003",
        use_test_endpoint=True
    )

    # Single message
    response = client.chat(
        message="What is my invoice status?",
        user_id="550e8400-e29b-41d4-a716-446655440000"
    )
    print(json.dumps(response, indent=2))

    # Or interactive conversation
    # client.conversation(user_id="550e8400-e29b-41d4-a716-446655440000")
```

**Running Python Example**:
```bash
python chat_client.py
```

**Output**:
```
{
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "message_id": "770e8400-e29b-41d4-a716-446655440222",
  "response": {
    "text": "Your invoice INV-2025-001234 status is: shipped"
  },
  "agent": "InvoiceAgent",
  "intent": "check_invoice_status",
  ...
}
```

### Example 5: Rate Limiting Test

**Scenario**: Test rate limit (20 messages per minute by default)

```bash
#!/bin/bash

TENANT_ID="880e8400-e29b-41d4-a716-446655440003"
USER_ID="550e8400-e29b-41d4-a716-446655440000"
ENDPOINT="http://localhost:8000/api/$TENANT_ID/test/chat"

# Send 25 requests
for i in {1..25}; do
  echo "Request $i:"
  response=$(curl -s -X POST \
    "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{
      \"message\": \"Message $i\",
      \"user_id\": \"$USER_ID\",
      \"metadata\": {}
    }")

  # Check for rate limit error
  if echo "$response" | grep -q "rate limit\|429"; then
    echo "  ❌ Rate limited!"
    echo "  Response: $(echo $response | jq .)"
  else
    echo "  ✓ Success"
    remaining=$(echo "$response" | jq -r '.metadata.duration_ms // "N/A"')
    echo "  Duration: ${remaining}ms"
  fi

  sleep 0.1  # Small delay between requests
done
```

**Expected Behavior**:
- Requests 1-20: Success (200)
- Requests 21-25: Rate limited (429)

**Response When Rate Limited**:
```json
{
  "detail": "Rate limit exceeded: 20 messages per minute"
}
```

### Example 6: Error Handling

**Scenario 1: Invalid Tenant**
```bash
curl -X POST \
  "http://localhost:8000/api/invalid-uuid/test/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "user_id": "user"}'
```

**Response** (404):
```json
{
  "detail": "Tenant not found"
}
```

**Scenario 2: Invalid User ID Format**
```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "user_id": "not-a-uuid"}'
```

**Response** (400):
```json
{
  "detail": "Invalid user_id format: not-a-uuid. Must be valid UUID."
}
```

**Scenario 3: Agent Not Found**
```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "test",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_name": "NonexistentAgent"
  }'
```

**Response** (400):
```json
{
  "detail": "Agent 'NonexistentAgent' not found"
}
```

**Scenario 4: Internal Server Error**
```
Response (500):
{
  "detail": "Internal server error: [error details]"
}
```

## 📊 Response Metadata Details

### Metadata Structure

```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "duration_ms": 1234.5,
  "status": "success",
  "llm_model": {
    "llm_model_id": "model-uuid",
    "model_class": "ChatOpenAI",
    "model_name": "gpt-4o-mini"
  },
  "tool_calls": [
    {
      "tool_name": "lookup_invoice",
      "tool_args": {"invoice_id": "INV-2025-001234"},
      "tool_id": "tool-uuid"
    }
  ],
  "extracted_entities": {
    "invoice_id": "INV-2025-001234",
    "date": "2025-11-15"
  }
}
```

### Key Fields

| Field | Type | Purpose |
|-------|------|---------|
| `agent_id` | UUID | Which agent processed the request |
| `tenant_id` | UUID | Tenant context |
| `duration_ms` | Float | Total processing time |
| `status` | String | "success" or "error" |
| `llm_model` | Object | LLM provider/model information |
| `tool_calls` | Array | Which tools were invoked |
| `extracted_entities` | Object | Structured data extracted from message |

## 🔍 Monitoring & Logging

### Structured Logs

The system logs important events with context:

**User Message Received**:
```json
{
  "timestamp": "2025-11-19T10:00:00Z",
  "event": "user_message_received",
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "message_length": 42
}
```

**Supervisor Agent Routing**:
```json
{
  "event": "supervisor_agent_routing",
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "session_id": "660e8400-e29b-41d4-a716-446655440111"
}
```

**Chat Response Completed**:
```json
{
  "event": "chat_response_completed",
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "agent": "InvoiceAgent",
  "intent": "check_invoice_status",
  "duration_ms": 1234.5,
  "status": "success"
}
```

**Slow Response Warning** (>2500ms):
```json
{
  "event": "chat_response_slow",
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "duration_ms": 2751.3,
  "threshold_ms": 2500
}
```

### Debugging Tips

1. **Check message saved**:
   ```sql
   SELECT * FROM messages
   WHERE session_id = '660e8400-e29b-41d4-a716-446655440111'
   ORDER BY created_at DESC;
   ```

2. **Check session created**:
   ```sql
   SELECT * FROM chat_sessions
   WHERE session_id = '660e8400-e29b-41d4-a716-446655440111';
   ```

3. **Check agent config**:
   ```sql
   SELECT * FROM agent_configs
   WHERE name = 'InvoiceAgent';
   ```

4. **Check permissions**:
   ```sql
   SELECT * FROM tenant_agent_permissions
   WHERE tenant_id = '880e8400-e29b-41d4-a716-446655440003'
   AND agent_id = (SELECT agent_id FROM agent_configs WHERE name = 'InvoiceAgent');
   ```

---

## ✅ Testing Checklist

- [ ] Basic message send (test endpoint)
- [ ] Session continuation (reuse session_id)
- [ ] Direct agent routing (agent_name parameter)
- [ ] Rate limiting (send 20+ messages/minute)
- [ ] Error handling (invalid tenant, user, agent)
- [ ] Response metadata (check extracted_entities, tool_calls)
- [ ] Performance (monitor duration_ms, warning if >2500ms)
- [ ] Database entries (check messages, sessions created)
- [ ] Production endpoint with JWT
- [ ] Multiple agents (test different routing paths)

---

**Generated**: November 19, 2025
**API Version**: v1 (production)
**Base URL**: `http://localhost:8000` (local) or `https://api.example.com` (production)
