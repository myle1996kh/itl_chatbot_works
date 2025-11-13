# Frontend API Contracts

**Status**: MVP Implementation Guide
**Version**: 1.0
**Date**: 2025-11-10

## Quick Reference

| Feature | Endpoint | Method | Auth |
|---------|----------|--------|------|
| Chat | `POST /{tenant_id}/chat` | POST | Optional (DISABLE_AUTH=true) |
| Get Sessions | `GET /{tenant_id}/sessions` | GET | Optional |
| Get Session Messages | `GET /{tenant_id}/sessions/{session_id}/messages` | GET | Optional |
| Upload Knowledge | `POST /tenants/{tenant_id}/knowledge/upload-document` | POST | Required (Staff+) |
| Enrich from Chat | `POST /tenants/{tenant_id}/knowledge/enrich-from-chat` | POST | Required (Staff+) |
| Login (Staff) | `POST /auth/login` | POST | None |
| Escalate Session | `POST /{tenant_id}/sessions/{session_id}/escalate` | POST | Optional |

## Environment Configuration

Create `.env.local` in frontend root:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8000
VITE_TENANT_ID=test-tenant-id
VITE_DISABLE_AUTH=true  # For MVP development
```

Create config file:

```typescript
// frontend/src/config/api.ts

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  TENANT_ID: import.meta.env.VITE_TENANT_ID || 'test-tenant-id',
  DISABLE_AUTH: import.meta.env.VITE_DISABLE_AUTH === 'true',
};

export const API_ENDPOINTS = {
  // Chat
  CHAT: `${API_CONFIG.BASE_URL}/api/${API_CONFIG.TENANT_ID}/chat`,
  SESSIONS: `${API_CONFIG.BASE_URL}/api/${API_CONFIG.TENANT_ID}/sessions`,
  SESSION_MESSAGES: (sessionId: string) =>
    `${API_CONFIG.BASE_URL}/api/${API_CONFIG.TENANT_ID}/sessions/${sessionId}/messages`,

  // Knowledge
  KNOWLEDGE_UPLOAD: `${API_CONFIG.BASE_URL}/api/tenants/${API_CONFIG.TENANT_ID}/knowledge/upload-document`,
  KNOWLEDGE_ENRICH: `${API_CONFIG.BASE_URL}/api/tenants/${API_CONFIG.TENANT_ID}/knowledge/enrich-from-chat`,

  // Escalation
  ESCALATE: (sessionId: string) =>
    `${API_CONFIG.BASE_URL}/api/${API_CONFIG.TENANT_ID}/sessions/${sessionId}/escalate`,

  // Auth
  LOGIN: `${API_CONFIG.BASE_URL}/api/auth/login`,
  ME: `${API_CONFIG.BASE_URL}/api/me`,
};
```

## 1. Chat Endpoint

### POST `/api/{tenant_id}/chat`

Send a user message to chatbot and receive AI response.

#### Request

```typescript
interface ChatRequest {
  session_id?: string;        // Existing session ID, or leave null for new
  user_id: string;            // User email or identifier
  message: string;            // User's question/input
  agent_id: string;           // REQUIRED: Which agent to route to
  metadata?: Record<string, any>;
}

// Example
const request = {
  session_id: 'sess-123abc',
  user_id: 'john@example.com',
  message: 'How do I reset my password?',
  agent_id: 'agent-support-guide',  // Topic mapped to agent
  metadata: {
    source: 'web',
    tenant_name: 'eTMS'
  }
};
```

#### Response

```typescript
interface ChatResponse {
  message_id: string;
  session_id: string;
  content: string;              // AI response text
  role: 'ai';
  timestamp: string;            // ISO 8601
  tokens_used?: number;

  // NEW: Escalation fields
  escalation_suggested?: boolean;
  escalation_reason?: string;   // e.g., 'urgent', 'complaint'
  escalation_confidence?: number; // 0.0 - 1.0
}

// Example
{
  "message_id": "msg-456def",
  "session_id": "sess-123abc",
  "content": "To reset your password, go to the login page...",
  "role": "ai",
  "timestamp": "2025-11-10T12:34:56Z",
  "tokens_used": 150,
  "escalation_suggested": false,
  "escalation_reason": null,
  "escalation_confidence": 0
}
```

#### Frontend Implementation

```typescript
// frontend/src/services/chatService.ts

import { API_ENDPOINTS } from '../config/api';

export const sendMessage = async (
  message: string,
  agentId: string,
  sessionId?: string,
  userId?: string
): Promise<ChatResponse> => {
  const response = await fetch(API_ENDPOINTS.CHAT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add JWT token if auth enabled
      ...(hasAuthToken() && { 'Authorization': `Bearer ${getAuthToken()}` })
    },
    body: JSON.stringify({
      session_id: sessionId || undefined,
      user_id: userId || 'anonymous-user',
      message: message,
      agent_id: agentId,  // ← Key change from old implementation
      metadata: {
        source: 'web',
        timestamp: new Date().toISOString()
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.statusText}`);
  }

  return await response.json();
};

// Usage in ChatWidget
const handleSendMessage = async () => {
  const agentMapping = TOPIC_TO_AGENT_MAPPING[currentTopic.id];

  const response = await sendMessage(
    input,
    agentMapping.agentId,  // ← Pass agent_id directly
    session?.id,
    userInfo.email
  );

  // Handle escalation suggestion
  if (response.escalation_suggested && response.escalation_confidence > 0.7) {
    showEscalationPrompt(response.escalation_reason);
  }

  // Add message to chat
  setMessages(prev => [...prev, {
    id: response.message_id,
    text: response.content,
    sender: 'ai',
    timestamp: response.timestamp
  }]);

  // Save session ID if new
  if (!session?.id) {
    setSession({ id: response.session_id });
  }
};
```

#### Error Handling

```typescript
const handleChatError = (error: Error) => {
  const status = error.response?.status;

  switch (status) {
    case 400:
      // Invalid agent_id or missing required field
      console.error('Invalid request:', error.response?.data);
      showError('Please select a valid topic');
      break;
    case 404:
      // Tenant or session not found
      showError('Session not found');
      break;
    case 429:
      // Rate limited
      showError('Too many requests. Please try again later.');
      break;
    default:
      showError('Chat service error. Please try again.');
  }
};
```

## 2. Sessions Endpoint

### GET `/api/{tenant_id}/sessions`

Retrieve list of chat sessions (for admin dashboard).

#### Query Parameters

```typescript
interface SessionsQuery {
  user_email?: string;          // Filter by user
  assigned_supporter_id?: string; // Filter by supporter
  escalation_status?: string;   // 'none' | 'pending' | 'assigned'
  limit?: number;               // Default 50
  offset?: number;              // Pagination
}

// Example
GET /api/test-tenant/sessions?escalation_status=pending&limit=20
```

#### Response

```typescript
interface Session {
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;

  // Escalation fields
  assigned_supporter_id?: string;
  assigned_supporter_name?: string;
  escalation_status: 'none' | 'pending' | 'assigned' | 'resolved';
  escalation_reason?: string;
  escalation_requested_at?: string;
  escalation_assigned_at?: string;
}

interface SessionsResponse {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
}

// Example
{
  "sessions": [
    {
      "session_id": "sess-123",
      "tenant_id": "test-tenant",
      "user_id": "john@example.com",
      "user_email": "john@example.com",
      "created_at": "2025-11-10T10:00:00Z",
      "updated_at": "2025-11-10T12:34:56Z",
      "last_message_at": "2025-11-10T12:34:56Z",
      "message_count": 15,
      "assigned_supporter_id": "supp-789",
      "assigned_supporter_name": "John Smith",
      "escalation_status": "assigned",
      "escalation_reason": "User requested human support",
      "escalation_requested_at": "2025-11-10T12:30:00Z",
      "escalation_assigned_at": "2025-11-10T12:32:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### Frontend Implementation

```typescript
// frontend/src/services/sessionService.ts

export const getSessions = async (
  query?: SessionsQuery
): Promise<SessionsResponse> => {
  const params = new URLSearchParams();
  if (query?.escalation_status) params.append('escalation_status', query.escalation_status);
  if (query?.assigned_supporter_id) params.append('assigned_supporter_id', query.assigned_supporter_id);
  if (query?.user_email) params.append('user_email', query.user_email);
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.offset) params.append('offset', query.offset.toString());

  const url = `${API_ENDPOINTS.SESSIONS}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Sessions API error: ${response.statusText}`);
  }

  return await response.json();
};

// Usage in AdminDashboard
const loadSessions = async () => {
  const sessions = await getSessions({
    escalation_status: 'pending',
    limit: 20
  });
  setAllSessions(sessions.sessions);
};
```

## 3. Session Messages Endpoint

### GET `/api/{tenant_id}/sessions/{session_id}/messages`

Retrieve all messages in a session.

#### Response

```typescript
interface Message {
  message_id: string;
  session_id: string;
  role: 'user' | 'ai' | 'supporter' | 'system';
  content: string;
  timestamp: string;
  sender_name?: string;  // For 'supporter' messages
  metadata?: Record<string, any>;
}

interface MessagesResponse {
  session_id: string;
  messages: Message[];
  message_count: number;
}

// Example
{
  "session_id": "sess-123",
  "messages": [
    {
      "message_id": "msg-1",
      "session_id": "sess-123",
      "role": "ai",
      "content": "Welcome! How can I help you?",
      "timestamp": "2025-11-10T10:00:00Z"
    },
    {
      "message_id": "msg-2",
      "session_id": "sess-123",
      "role": "user",
      "content": "I forgot my password",
      "timestamp": "2025-11-10T10:01:00Z"
    },
    {
      "message_id": "msg-3",
      "session_id": "sess-123",
      "role": "supporter",
      "content": "I can help with that. Let me reset it for you.",
      "sender_name": "John Smith",
      "timestamp": "2025-11-10T10:05:00Z"
    }
  ],
  "message_count": 3
}
```

#### Frontend Implementation

```typescript
export const getSessionMessages = async (
  sessionId: string
): Promise<MessagesResponse> => {
  const response = await fetch(
    API_ENDPOINTS.SESSION_MESSAGES(sessionId),
    {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Messages API error: ${response.statusText}`);
  }

  return await response.json();
};
```

## 4. Knowledge Upload Endpoint

### POST `/api/tenants/{tenant_id}/knowledge/upload-document`

Upload documents to tenant's knowledge base (admin + staff can upload).

#### Request

```typescript
interface DocumentIngestRequest {
  documents: string[];     // Document text content
  metadatas: Array<{      // Metadata for each document
    source?: string;
    topic?: string;
    category?: string;
    [key: string]: any;
  }>;
}

// Example - from file upload
const handleFileUpload = async (file: File) => {
  const content = await parseFileToText(file);  // Extract text from PDF/Word

  const response = await fetch(API_ENDPOINTS.KNOWLEDGE_UPLOAD, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAdminToken()}`
    },
    body: JSON.stringify({
      documents: [content],
      metadatas: [{
        source: file.name,
        topic: selectedTopic.id,
        uploaded_at: new Date().toISOString()
      }]
    })
  });

  return await response.json();
};
```

#### Response

```typescript
interface DocumentIngestResponse {
  success: boolean;
  document_count: number;
  message: string;
  knowledge_base_size: number;  // Total documents in KB
}

// Example
{
  "success": true,
  "document_count": 1,
  "message": "Successfully ingested 1 document",
  "knowledge_base_size": 1024
}
```

### POST `/api/tenants/{tenant_id}/knowledge/enrich-from-chat`

Add chat messages to knowledge base (enrich from session history).

**Request**:
```typescript
interface EnrichmentRequest {
  session_id: string;        // Session to enrich from
  message_ids: string[];     // Which messages to add
  topic?: string;            // Optional: which topic/RAG collection
}

// Example
const enrichFromChat = async (sessionId: string, messageIds: string[]) => {
  const response = await fetch(
    API_ENDPOINTS.KNOWLEDGE_ENRICH,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        session_id: sessionId,
        message_ids: messageIds,
        topic: 'user-support'  // Optional
      })
    }
  );

  return await response.json();
};
```

**Response**:
```typescript
interface EnrichmentResponse {
  success: boolean;
  document_count: number;     // How many messages added
  message: string;
  added_to_topic?: string;
}

// Example
{
  "success": true,
  "document_count": 2,
  "message": "Successfully added 2 messages to knowledge base",
  "added_to_topic": "user-support"
}
```

**Access Control**:
```
Admin:  Can enrich any session ✅
Staff:  Can enrich only assigned sessions ✅
Other:  403 Forbidden ❌
```

**Frontend Implementation**:
```typescript
// In ChatWidget or AdminDashboard - show "Enrich" button/menu

const handleEnrichMessages = async (selectedMessageIds: string[]) => {
  const response = await enrichFromChat(session.id, selectedMessageIds);

  if (response.success) {
    showNotification(`Added ${response.document_count} messages to knowledge base`);
    setSelectedMessages([]);  // Clear selection
  } else {
    showError('Failed to enrich knowledge base');
  }
};

// UI: Allow staff to select messages and click "Add to Knowledge Base"
<div className="message-actions">
  <button
    onClick={() => handleEnrichMessages(Object.keys(selectedMessages))}
    disabled={Object.keys(selectedMessages).length === 0}
  >
    📚 Add Selected to Knowledge Base
  </button>
</div>
```

## 5. Escalation Endpoint

### POST `/api/{tenant_id}/sessions/{session_id}/escalate`

Request human support for a session.

#### Request

```typescript
interface EscalationRequest {
  reason: string;  // Why escalating
  escalation_type: 'manual' | 'auto';
}

// Example
const escalateSession = async (sessionId: string) => {
  const response = await fetch(
    API_ENDPOINTS.ESCALATE(sessionId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: 'User requested human support',
        escalation_type: 'manual'
      })
    }
  );

  return await response.json();
};
```

#### Response

```typescript
interface EscalationResponse {
  session_id: string;
  escalation_status: 'pending' | 'assigned';
  escalation_requested_at: string;
  message: string;
  estimated_wait_time?: number;  // seconds
}
```

#### Frontend Implementation

```typescript
// Add button to ChatWidget when escalation is suggested

const showEscalationPrompt = (reason: string) => {
  return (
    <div className="escalation-prompt">
      <p>I detected {reason}. Would you like to talk to a human?</p>
      <button onClick={() => escalateSession(session.id)}>
        Yes, connect me
      </button>
      <button onClick={() => setEscalationShown(false)}>
        No, continue with AI
      </button>
    </div>
  );
};

// Or add permanent button
const EscalateButton = ({ sessionId }) => (
  <button
    onClick={() => escalateSession(sessionId)}
    className="btn-escalate"
  >
    💬 Talk to Human
  </button>
);
```

## 6. Login Endpoint (Staff Only)

### POST `/api/auth/login`

Staff login for admin dashboard access.

#### Request

```typescript
interface LoginRequest {
  email: string;
  password: string;
  tenant_id: string;
}

// Example
const staffLogin = async (email: string, password: string, tenantId: string) => {
  const response = await fetch(API_ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      tenant_id: tenantId
    })
  });

  return await response.json();
};
```

#### Response

```typescript
interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  user: {
    user_id: string;
    email: string;
    role: 'admin' | 'staff';
    display_name: string;
    tenant_id: string;
  };
  supporter?: {
    supporter_id: string;
    status: 'online' | 'offline' | 'busy';
    current_sessions_count: number;
    max_concurrent_sessions: number;
  };
}

// Example
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "user_id": "user-123",
    "email": "staff@etms.com",
    "role": "staff",
    "display_name": "John Smith",
    "tenant_id": "tenant-etms"
  },
  "supporter": {
    "supporter_id": "supp-123",
    "status": "offline",
    "current_sessions_count": 0,
    "max_concurrent_sessions": 5
  }
}
```

#### Frontend Implementation

```typescript
// frontend/src/services/authService.ts

export const staffLogin = async (
  email: string,
  password: string,
  tenantId: string
): Promise<LoginResponse> => {
  const response = await fetch(API_ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenant_id: tenantId })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Store JWT token
  localStorage.setItem('auth_token', data.access_token);
  localStorage.setItem('user_role', data.user.role);
  localStorage.setItem('supporter_id', data.supporter?.supporter_id || '');

  return data;
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const getUserRole = (): 'admin' | 'staff' | null => {
  const role = localStorage.getItem('user_role');
  return role as any;
};
```

## Error Handling Strategy

```typescript
// frontend/src/services/apiClient.ts

interface ApiError {
  status: number;
  detail: string;
  error_code?: string;
}

export const handleApiError = (error: any): ApiError => {
  if (error.response?.status === 400) {
    return {
      status: 400,
      detail: error.response.data.detail || 'Invalid request',
      error_code: 'INVALID_REQUEST'
    };
  }

  if (error.response?.status === 401) {
    return {
      status: 401,
      detail: 'Unauthorized. Please login.',
      error_code: 'UNAUTHORIZED'
    };
  }

  if (error.response?.status === 403) {
    return {
      status: 403,
      detail: 'You do not have permission to access this resource.',
      error_code: 'FORBIDDEN'
    };
  }

  if (error.response?.status === 404) {
    return {
      status: 404,
      detail: 'Resource not found',
      error_code: 'NOT_FOUND'
    };
  }

  if (error.response?.status === 429) {
    return {
      status: 429,
      detail: 'Too many requests. Please try again later.',
      error_code: 'RATE_LIMITED'
    };
  }

  if (error.response?.status >= 500) {
    return {
      status: error.response.status,
      detail: 'Server error. Please try again later.',
      error_code: 'SERVER_ERROR'
    };
  }

  return {
    status: 0,
    detail: error.message || 'Unknown error',
    error_code: 'UNKNOWN'
  };
};
```

## Testing

### Mock API for Development

```typescript
// frontend/src/services/mockApi.ts

export const createMockChatResponse = (message: string): ChatResponse => ({
  message_id: `msg-${Date.now()}`,
  session_id: 'sess-mock-123',
  content: `Mock response to: "${message}"`,
  role: 'ai',
  timestamp: new Date().toISOString(),
  escalation_suggested: false
});

// Use MSW (Mock Service Worker) in tests
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const mswServer = setupServer(
  http.post('*/api/*/chat', async ({ request }) => {
    return HttpResponse.json(createMockChatResponse('Test response'));
  })
);
```

## Deployment Checklist

- [ ] Update `.env.local` with correct API_BASE_URL
- [ ] Test auth flow with real backend
- [ ] Test chat with correct agent_id mappings
- [ ] Test escalation flow end-to-end
- [ ] Test admin dashboard session loading
- [ ] Test knowledge upload
- [ ] Verify CORS headers from backend
- [ ] Load test with realistic concurrent users
