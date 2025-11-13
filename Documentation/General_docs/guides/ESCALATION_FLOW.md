# Escalation Flow: AI to Human Handoff

**Status**: MVP Feature - Phase 1
**Version**: 1.0
**Date**: 2025-11-10

## Overview

Implements manual + automatic escalation from AI chatbot to human support staff, with both AI and supporter able to respond in the same session.

## Escalation Modes

### Mode 1: Manual Escalation

User clicks **"Talk to Human"** button in chat widget.

```
User Message
    ↓
AI Response (provided)
    ↓
User clicks "Talk to Human" button
    ↓
Frontend sends escalation request
    ↓
Backend marks session as escalated
    ↓
Admin notifies next available supporter
    ↓
Supporter responds (now both AI & human can respond)
```

### Mode 2: Auto-Escalation

Backend detects keywords indicating complex/sensitive issues and flags for escalation.

```
User Message
    ↓
Backend keyword detection:
  - "complaint", "angry", "urgent", "error", "bug"
  - "help me", "something is wrong"
  - "human", "talk to someone"
    ↓
If detected:
  - Mark message with escalation_flag=true
  - Propose escalation to user
  - Wait for confirmation
    ↓
Otherwise:
  - Continue with AI response
```

## Data Model

### ChatSession Escalation Fields

```python
# In ChatSession model:

assigned_supporter_id: Optional[str] = None
escalation_status: str = 'none'  # 'none' | 'pending' | 'assigned' | 'resolved'
escalation_reason: Optional[str] = None
escalation_requested_at: Optional[datetime] = None
escalation_assigned_at: Optional[datetime] = None
escalation_keywords_detected: Optional[List[str]] = None
```

### Message Escalation Context

```python
# In Message model:

sender_supporter_id: Optional[str] = None  # If sent by human staff
escalation_flag: bool = False  # Marked for escalation
escalation_reason: Optional[str] = None
```

## API Endpoints

### 1. Request Escalation (Frontend → Backend)

#### POST `/api/{tenant_id}/sessions/{session_id}/escalate`

Request human assistance for a session.

**Request**:
```json
{
  "reason": "User wants to talk to human",
  "escalation_type": "manual"  // or "auto"
}
```

**Response**:
```json
{
  "session_id": "sess-123",
  "escalation_status": "pending",
  "escalation_requested_at": "2025-11-10T12:34:56Z",
  "message": "Your request has been received. A supporter will be with you shortly.",
  "estimated_wait_time": 120  // seconds
}
```

**Backend Logic**:
```python
@router.post("/{tenant_id}/sessions/{session_id}/escalate")
async def escalate_session(
    tenant_id: str,
    session_id: str,
    request: EscalationRequest,
    db: Session = Depends(get_db)
):
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.tenant_id == tenant_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.escalation_status != 'none':
        raise HTTPException(status_code=400, detail="Already escalated")

    # Update session
    session.escalation_status = 'pending'
    session.escalation_reason = request.reason
    session.escalation_requested_at = datetime.utcnow()

    # Save message indicating escalation request
    msg = Message(
        message_id=str(uuid.uuid4()),
        session_id=session_id,
        role='system',
        content=f"Escalation requested: {request.reason}",
        metadata={'escalation_request': True, 'type': request.escalation_type}
    )
    db.add(msg)
    db.commit()

    return {
        'session_id': session_id,
        'escalation_status': 'pending',
        'escalation_requested_at': session.escalation_requested_at
    }
```

### 2. Assign Supporter (Admin → Backend)

#### PUT `/api/admin/tenants/{tenant_id}/sessions/{session_id}/assign-supporter`

Admin assigns a supporter to a pending escalation.

**Request**:
```json
{
  "supporter_id": "supp-uuid"
}
```

**Response**:
```json
{
  "session_id": "sess-123",
  "assigned_supporter_id": "supp-uuid",
  "escalation_status": "assigned",
  "escalation_assigned_at": "2025-11-10T12:35:00Z"
}
```

**Backend Logic**:
```python
@router.put("/{tenant_id}/sessions/{session_id}/assign-supporter")
async def assign_supporter(
    tenant_id: str,
    session_id: str,
    request: AssignSupporterRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    supporter = db.query(Supporter).filter(
        Supporter.supporter_id == request.supporter_id,
        Supporter.tenant_id == tenant_id
    ).first()

    if not supporter:
        raise HTTPException(status_code=404, detail="Supporter not found")

    if supporter.current_sessions_count >= supporter.max_concurrent_sessions:
        raise HTTPException(
            status_code=409,
            detail=f"Supporter at capacity ({supporter.max_concurrent_sessions} sessions)"
        )

    # Update session
    session.assigned_supporter_id = request.supporter_id
    session.escalation_status = 'assigned'
    session.escalation_assigned_at = datetime.utcnow()

    # Update supporter load
    supporter.current_sessions_count += 1

    # Add system message
    msg = Message(
        message_id=str(uuid.uuid4()),
        session_id=session_id,
        role='system',
        content=f"Assigned to {supporter.user.display_name}",
        metadata={'supporter_assigned': True, 'supporter_id': request.supporter_id}
    )

    db.add(msg)
    db.commit()

    return {
        'session_id': session_id,
        'assigned_supporter_id': request.supporter_id,
        'escalation_status': 'assigned'
    }
```

### 3. Send Supporter Message (Staff → Backend)

#### POST `/api/{tenant_id}/sessions/{session_id}/messages`

Supporter sends message to user (same endpoint, different sender).

**Request**:
```json
{
  "content": "Hello, I'm John from support. How can I help?",
  "sender_type": "supporter"  // "user" | "ai" | "supporter"
}
```

**Response**:
```json
{
  "message_id": "msg-uuid",
  "session_id": "sess-123",
  "role": "supporter",
  "content": "Hello, I'm John from support. How can I help?",
  "supporter_name": "John",
  "timestamp": "2025-11-10T12:35:30Z"
}
```

**Backend Logic** (in existing message endpoint, add handler):
```python
@router.post("/{tenant_id}/sessions/{session_id}/messages")
async def send_message(
    tenant_id: str,
    session_id: str,
    request: MessageRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.tenant_id == tenant_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Determine sender
    if request.sender_type == 'supporter':
        # Verify supporter is assigned to this session
        if session.assigned_supporter_id != current_user.supporter.supporter_id:
            raise HTTPException(
                status_code=403,
                detail="Supporter not assigned to this session"
            )
        sender_id = 'supporter'
        sender_supporter_id = current_user.supporter.supporter_id
        sender_user_id = None
    else:
        # User sending message
        sender_id = 'user'
        sender_user_id = current_user.user_id
        sender_supporter_id = None

    # Create message
    msg = Message(
        message_id=str(uuid.uuid4()),
        session_id=session_id,
        role=sender_id,
        content=request.content,
        sender_user_id=sender_user_id,
        sender_supporter_id=sender_supporter_id
    )

    db.add(msg)
    db.commit()

    return {
        'message_id': msg.message_id,
        'role': msg.role,
        'content': msg.content,
        'timestamp': msg.created_at
    }
```

## Auto-Escalation Detection

### Keyword-Based Detection

```python
# backend/src/services/escalation_service.py

ESCALATION_KEYWORDS = {
    'complaint': ['complain', 'unsatisfied', 'angry', 'frustrated'],
    'urgent': ['urgent', 'emergency', 'asap', 'immediately', 'critical'],
    'error': ['error', 'bug', 'broken', 'not working', 'failed', 'crash'],
    'help': ['help me', 'support', 'assist', 'can someone help', 'need help'],
    'request_human': ['talk to human', 'speak with', 'agent', 'representative'],
}

class EscalationService:
    @staticmethod
    def detect_escalation_needed(message: str) -> tuple[bool, Optional[str]]:
        """
        Detect if message should be escalated.

        Returns:
            (should_escalate: bool, keyword_category: str or None)
        """
        message_lower = message.lower()

        for category, keywords in ESCALATION_KEYWORDS.items():
            for keyword in keywords:
                if keyword in message_lower:
                    return True, category

        return False, None

    @staticmethod
    def suggest_escalation(
        message: str,
        db: Session
    ) -> dict:
        """
        Analyze message and suggest escalation with confidence.

        Returns:
            {
                'should_escalate': bool,
                'confidence': 0.0-1.0,
                'reason': str,
                'keywords_detected': [str]
            }
        """
        should_escalate, keyword_category = EscalationService.detect_escalation_needed(message)

        return {
            'should_escalate': should_escalate,
            'confidence': 0.9 if should_escalate else 0.0,
            'reason': keyword_category or 'No escalation needed',
            'keywords_detected': [kw for kw in ESCALATION_KEYWORDS.get(keyword_category or '', [])]
        }
```

### Integration in Chat Flow

```python
# In chat endpoint:

from src.services.escalation_service import EscalationService

@router.post("/{tenant_id}/chat")
async def chat_endpoint(
    tenant_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    # ... existing chat logic ...

    # After getting AI response, check for escalation
    escalation_info = EscalationService.suggest_escalation(request.message, db)

    response = ChatResponse(
        message_id=response_msg.message_id,
        content=ai_response_text,
        session_id=session.session_id,
        # NEW FIELDS:
        escalation_suggested=escalation_info['should_escalate'],
        escalation_reason=escalation_info['reason'],
        escalation_confidence=escalation_info['confidence']
    )

    return response
```

## Frontend Implementation

### 1. Chat Widget UI Changes

```typescript
// components/ChatWidget.tsx

interface ChatMessage extends Message {
  escalation_suggested?: boolean;
  escalation_reason?: string;
  escalation_confidence?: number;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ ... }) => {
  const [escalationPending, setEscalationPending] = useState(false);
  const [assignedSupporterName, setAssignedSupporterName] = useState<string | null>(null);

  // Handle escalation suggestion from AI response
  const handleAIResponse = (response: ChatMessage) => {
    setMessages(prev => [...prev, response]);

    // Check if escalation is suggested
    if (response.escalation_suggested && response.escalation_confidence > 0.7) {
      showEscalationBanner(response.escalation_reason);
    }
  };

  // User clicks "Talk to Human"
  const handleEscalate = async () => {
    const res = await fetch(
      `/api/${tenant.id}/sessions/${session.id}/escalate`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'User requested human support',
          escalation_type: 'manual'
        })
      }
    );

    const data = await res.json();
    setEscalationPending(true);
    showNotification('Your request has been sent. A supporter will be with you shortly.');
  };

  // Render escalation UI
  return (
    <div className="chat-widget">
      {/* Messages... */}

      {escalationPending && (
        <div className="escalation-banner">
          <p>Waiting for a supporter...</p>
          {assignedSupporterName && (
            <p className="success">{assignedSupporterName} is helping you now!</p>
          )}
        </div>
      )}

      {/* Show escalation button if not escalated */}
      {!escalationPending && (
        <button
          onClick={handleEscalate}
          className="btn-escalate"
        >
          💬 Talk to Human
        </button>
      )}

      {/* Chat input ... */}
    </div>
  );
};
```

### 2. Auto-Escalation Suggestion UI

```typescript
// Show suggestion banner when AI detects escalation-worthy message

interface EscalationSuggestion {
  message: string;
  action: 'escalate' | 'continue' | 'dismiss';
}

const EscalationSuggestionBanner = ({
  reason,
  onEscalate,
  onDismiss
}: {
  reason: string;
  onEscalate: () => void;
  onDismiss: () => void;
}) => (
  <div className="banner escalation-suggestion">
    <p>🤖 I detected something that might need a human touch ({reason})</p>
    <div className="actions">
      <button onClick={onEscalate} className="btn-primary">
        Yes, connect me to support
      </button>
      <button onClick={onDismiss} className="btn-secondary">
        No, I'm fine
      </button>
    </div>
  </div>
);
```

## Admin Dashboard Integration

### Escalation Queue View

```typescript
// components/AdminDashboard.tsx - add new view

interface EscalationQueue {
  pendingCount: number;
  sessions: Array<{
    session_id: string;
    user_email: string;
    escalation_requested_at: string;
    escalation_reason: string;
    assigned_supporter?: string;
  }>;
}

const EscalationQueuePanel = () => {
  const [queue, setQueue] = useState<EscalationQueue | null>(null);

  useEffect(() => {
    // Poll for escalations
    const interval = setInterval(async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/escalations/pending`);
      const data = await res.json();
      setQueue(data);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const assignSupporter = async (sessionId: string, supporterId: string) => {
    await fetch(
      `/api/admin/tenants/${tenantId}/sessions/${sessionId}/assign-supporter`,
      {
        method: 'PUT',
        body: JSON.stringify({ supporter_id: supporterId })
      }
    );
    // Refresh queue
  };

  return (
    <div className="escalation-queue">
      <h2>Escalations Waiting ({queue?.pendingCount})</h2>
      {queue?.sessions.map(session => (
        <div key={session.session_id} className="escalation-item">
          <p>{session.user_email}</p>
          <p className="reason">{session.escalation_reason}</p>
          <select
            onChange={(e) => assignSupporter(session.session_id, e.target.value)}
          >
            <option value="">Assign to...</option>
            {supporters.map(s => (
              <option key={s.id} value={s.id}>
                {s.display_name} ({s.current_sessions_count}/{s.max_concurrent_sessions})
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};
```

## Session Resolution

When escalation is resolved:

```python
# Mark session as resolved (supporter or admin)

@router.put("/{tenant_id}/sessions/{session_id}/resolve")
async def resolve_escalation(
    tenant_id: str,
    session_id: str,
    request: ResolutionRequest,  # {resolution_notes: str}
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff_or_admin)
):
    session = db.query(ChatSession).filter(
        ChatSession.session_id == session_id
    ).first()

    session.escalation_status = 'resolved'
    session.escalation_resolved_at = datetime.utcnow()

    # Update supporter load
    if session.assigned_supporter_id:
        supporter = db.query(Supporter).filter(
            Supporter.supporter_id == session.assigned_supporter_id
        ).first()
        supporter.current_sessions_count = max(0, supporter.current_sessions_count - 1)

    # Save resolution notes
    msg = Message(
        message_id=str(uuid.uuid4()),
        session_id=session_id,
        role='system',
        content=f"Escalation resolved: {request.resolution_notes}",
        metadata={'resolution': True}
    )

    db.add(msg)
    db.commit()

    return {'escalation_status': 'resolved'}
```

## Escalation Metrics

Track escalation effectiveness:

```python
# backend/src/services/escalation_metrics.py

class EscalationMetrics:
    @staticmethod
    def get_escalation_stats(
        tenant_id: str,
        db: Session,
        days: int = 7
    ) -> dict:
        """
        Returns escalation statistics for dashboard.
        """
        since = datetime.utcnow() - timedelta(days=days)

        total_escalations = db.query(ChatSession).filter(
            ChatSession.tenant_id == tenant_id,
            ChatSession.escalation_requested_at >= since
        ).count()

        manual_escalations = db.query(ChatSession).filter(
            ChatSession.tenant_id == tenant_id,
            ChatSession.escalation_requested_at >= since,
            ChatSession.escalation_reason.like('%manual%')
        ).count()

        avg_resolution_time = db.query(
            func.avg(
                ChatSession.escalation_resolved_at - ChatSession.escalation_assigned_at
            )
        ).filter(
            ChatSession.tenant_id == tenant_id,
            ChatSession.escalation_resolved_at.isnot(None)
        ).scalar()

        return {
            'total_escalations': total_escalations,
            'manual_escalations': manual_escalations,
            'auto_escalations': total_escalations - manual_escalations,
            'avg_resolution_minutes': (
                avg_resolution_time.total_seconds() / 60
                if avg_resolution_time else None
            )
        }
```

## Enrich from Chat: Knowledge Base Enrichment

**Feature**: During escalation (or any session), staff/admin can select useful messages and add them directly to the knowledge base.

### Use Case

```
Staff handling escalated session:
  ├─ User asked: "How do I reset my password?"
  ├─ AI provided answer
  ├─ Staff reviewed & approved answer
  └─ Staff selects message → Clicks "Add to Knowledge Base"
     └─ Message added to knowledge base for future RAG retrieval
```

### Implementation

#### Backend Endpoint

```python
@router.post("/api/tenants/{tenant_id}/knowledge/enrich-from-chat")
async def enrich_from_chat(
    tenant_id: str,
    request: EnrichmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin)
):
    """
    Add messages from chat session to knowledge base.

    Access Control:
    - Admin: Can enrich any session
    - Staff: Can enrich only assigned sessions

    Request:
    {
        "session_id": "sess-123",
        "message_ids": ["msg-1", "msg-2"],
        "topic": "user-support"  # Optional: which RAG collection
    }

    Process:
    1. Verify user owns session (staff) or is admin
    2. Load messages by ID
    3. Extract text content
    4. Create document chunks
    5. Generate embeddings
    6. Store in pgvector
    7. Return success
    """
    # Verify ownership
    session = db.query(ChatSession).filter(
        ChatSession.session_id == request.session_id,
        ChatSession.tenant_id == tenant_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check access control
    if current_user.role == "staff":
        if session.assigned_supporter_id != current_user.supporter.supporter_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot enrich unassigned session"
            )

    # Fetch messages
    messages = db.query(Message).filter(
        Message.message_id.in_(request.message_ids),
        Message.session_id == request.session_id
    ).all()

    # Create documents from messages
    documents = [msg.content for msg in messages]
    metadatas = [{
        'source': 'enriched_from_chat',
        'session_id': request.session_id,
        'topic': request.topic or 'general',
        'original_message_id': msg.message_id,
        'enriched_at': datetime.utcnow().isoformat()
    } for msg in messages]

    # Store in knowledge base (pgvector)
    rag_service = get_rag_service()
    result = rag_service.ingest_documents(
        tenant_id=tenant_id,
        documents=documents,
        metadatas=metadatas
    )

    return {
        'success': True,
        'document_count': len(documents),
        'message': f'Added {len(documents)} messages to knowledge base'
    }
```

#### Frontend Implementation

```typescript
// In ChatWidget or AdminDashboard session view

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'supporter';
  // ... other fields
}

const SessionView = ({ session }) => {
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  };

  const handleEnrichMessages = async () => {
    const response = await fetch(
      API_ENDPOINTS.KNOWLEDGE_ENRICH,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          session_id: session.id,
          message_ids: selectedMessageIds,
          topic: selectedTopic?.id
        })
      }
    );

    if (response.ok) {
      showNotification(
        `Added ${selectedMessageIds.length} messages to knowledge base`
      );
      setSelectedMessageIds([]);  // Clear selection
    } else {
      showError('Failed to add messages to knowledge base');
    }
  };

  return (
    <div className="session-view">
      {/* Messages list */}
      <div className="messages">
        {session.messages.map(msg => (
          <div
            key={msg.id}
            className={`message ${selectedMessageIds.includes(msg.id) ? 'selected' : ''}`}
            onClick={() => toggleMessageSelection(msg.id)}
          >
            <div className="message-content">{msg.content}</div>
            <div className="message-meta">
              {msg.sender} • {msg.timestamp}
            </div>
          </div>
        ))}
      </div>

      {/* Enrich button */}
      <div className="message-actions">
        <button
          onClick={handleEnrichMessages}
          disabled={selectedMessageIds.length === 0}
          className="btn-enrich"
        >
          📚 Add {selectedMessageIds.length} to Knowledge Base
        </button>
      </div>
    </div>
  );
};
```

### Access Control for Enrichment

| User Type | Can Enrich | Scope |
|-----------|-----------|-------|
| **Admin** | ✅ Yes | Any session in tenant |
| **Staff** | ✅ Yes (restricted) | Only assigned sessions |
| **Tenant User** | ❌ No | - |

### Testing Enrichment

```python
# backend/tests/integration/test_enrich_from_chat.py

def test_admin_can_enrich_any_session():
    """Admin can add messages from any session to knowledge base"""
    # Admin enriches session with staff
    result = enrich_from_chat(admin_user, session_id, message_ids)
    assert result['success'] is True

def test_staff_can_enrich_assigned_session():
    """Staff can enrich only sessions assigned to them"""
    # Staff enriches own session
    result = enrich_from_chat(staff_user, assigned_session_id, message_ids)
    assert result['success'] is True

def test_staff_cannot_enrich_other_staff_session():
    """Staff cannot enrich sessions assigned to other staff"""
    # Staff tries to enrich other staff's session
    with pytest.raises(HTTPException) as exc:
        enrich_from_chat(staff_a, staff_b_session_id, message_ids)
    assert exc.value.status_code == 403

def test_enriched_messages_appear_in_rag():
    """Enriched messages are retrievable via RAG"""
    # Enrich messages
    enrich_from_chat(admin_user, session_id, message_ids)

    # Query knowledge base
    results = rag_service.search("password reset", tenant_id)
    assert len(results) > 0
```

## Testing

### Unit Tests

```python
# backend/tests/unit/test_escalation_detection.py

def test_detect_complaint_keyword():
    result = EscalationService.detect_escalation_needed("I'm very angry with this")
    assert result[0] is True
    assert 'complaint' in result[1]

def test_detect_urgent_keyword():
    result = EscalationService.detect_escalation_needed("This is urgent!")
    assert result[0] is True
    assert 'urgent' in result[1]

def test_no_escalation_needed():
    result = EscalationService.detect_escalation_needed("What's the status of my order?")
    assert result[0] is False
```

### Integration Tests

```python
# backend/tests/integration/test_escalation_flow.py

async def test_manual_escalation_flow():
    # 1. User sends message requesting human
    # 2. Backend detects escalation keyword
    # 3. User confirms escalation
    # 4. Admin assigns supporter
    # 5. Supporter sends message
    # 6. Session marked as resolved
    pass
```
