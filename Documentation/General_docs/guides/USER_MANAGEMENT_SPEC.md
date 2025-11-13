# User Management Specification

**Status**: MVP Phase 0
**Version**: 1.0
**Date**: 2025-11-10

## Overview

This document defines the user management architecture for the ITL_chatbot system. We implement two distinct user types:
- **Tenant Users** (customers): Use the chatbot widget
- **Staff/Supporters** (internal): Handle escalated conversations, manage knowledge base

## Database Schema

### 1. Users Table

```python
class User(Base):
    """Base user table for all user types"""
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id"), nullable=False)
    email = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)  # Hashed with bcrypt
    role = Column(String(50), nullable=False)  # 'tenant_user', 'staff', 'admin'
    display_name = Column(String(255), nullable=True)
    status = Column(String(50), default='active')  # 'active', 'inactive', 'suspended'
    created_by = Column(String(36), ForeignKey("users.user_id"), nullable=True)  # Admin who created
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    supporter = relationship("Supporter", uselist=False, back_populates="user")
    sessions = relationship("ChatSession", back_populates="user")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='unique_tenant_email'),
    )
```

### 2. Supporters Table

```python
class Supporter(Base):
    """Staff members who handle escalated conversations"""
    __tablename__ = "supporters"

    supporter_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, unique=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id"), nullable=False)
    status = Column(String(50), default='offline')  # 'online', 'offline', 'busy', 'away'
    max_concurrent_sessions = Column(Integer, default=5)
    current_sessions_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="supporter")
    tenant = relationship("Tenant", back_populates="supporters")
    assigned_sessions = relationship("ChatSession", back_populates="assigned_supporter")
    messages = relationship("Message", back_populates="supporter")

    __table_args__ = (
        UniqueConstraint('user_id', name='unique_user_supporter'),
    )
```

### 3. Modify ChatSession Table

Add supporter tracking:

```python
class ChatSession(Base):
    """Existing table - add these fields"""

    # ... existing fields ...

    # New fields for escalation
    assigned_supporter_id = Column(String(36), ForeignKey("supporters.supporter_id"), nullable=True)
    escalation_status = Column(String(50), default='none')  # 'none', 'pending', 'assigned', 'resolved'
    escalation_reason = Column(String(500), nullable=True)
    escalation_requested_at = Column(DateTime, nullable=True)
    escalation_assigned_at = Column(DateTime, nullable=True)

    # Relationship
    assigned_supporter = relationship("Supporter", back_populates="assigned_sessions")
    user = relationship("User", back_populates="sessions")
```

### 4. Modify Message Table

Add supporter tracking:

```python
class Message(Base):
    """Existing table - add these fields"""

    # ... existing fields ...

    # New field to track if human-sent
    sender_user_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    sender_supporter_id = Column(String(36), ForeignKey("supporters.supporter_id"), nullable=True)
    # role field already exists: 'user' | 'ai' | 'supporter'

    # Relationships
    sender_user = relationship("User", foreign_keys=[sender_user_id])
    supporter = relationship("Supporter", back_populates="messages")
```

## API Endpoints

### Authentication

#### POST `/api/auth/login`

Login for staff/admin (not tenant users - they don't login yet in MVP)

**Request**:
```json
{
  "email": "staff@tenant.com",
  "password": "secret123",
  "tenant_id": "tenant-uuid"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "user_id": "user-uuid",
    "email": "staff@tenant.com",
    "role": "staff",
    "display_name": "Staff Name",
    "tenant_id": "tenant-uuid"
  },
  "supporter": {
    "supporter_id": "supp-uuid",
    "status": "offline",
    "current_sessions_count": 2
  }
}
```

### User Management (Admin Only)

#### POST `/api/admin/tenants/{tenant_id}/users`

Create new user (staff or tenant_user)

**Request**:
```json
{
  "email": "newstaff@tenant.com",
  "username": "newstaff",
  "display_name": "New Staff Member",
  "role": "staff",  // or 'tenant_user'
  "password": "initial-password"
}
```

**Response**:
```json
{
  "user_id": "user-uuid",
  "email": "newstaff@tenant.com",
  "role": "staff",
  "created_at": "2025-11-10T12:34:56Z"
}
```

#### GET `/api/admin/tenants/{tenant_id}/users`

List all users in tenant (admin only)

**Response**:
```json
{
  "users": [
    {
      "user_id": "user-uuid",
      "email": "staff@tenant.com",
      "role": "staff",
      "status": "active",
      "display_name": "Staff Name"
    }
  ],
  "total": 5
}
```

#### GET `/api/admin/tenants/{tenant_id}/supporters`

List all staff/supporters in tenant

**Response**:
```json
{
  "supporters": [
    {
      "supporter_id": "supp-uuid",
      "user_id": "user-uuid",
      "display_name": "Staff Name",
      "status": "online",
      "current_sessions_count": 2,
      "max_concurrent_sessions": 5
    }
  ]
}
```

#### PUT `/api/admin/tenants/{tenant_id}/supporters/{supporter_id}/status`

Update supporter status

**Request**:
```json
{
  "status": "online"  // 'online', 'offline', 'busy', 'away'
}
```

### User Profile (Self)

#### GET `/api/me`

Get current logged-in user info

**Response**:
```json
{
  "user_id": "user-uuid",
  "email": "staff@tenant.com",
  "role": "staff",
  "display_name": "Staff Name",
  "tenant_id": "tenant-uuid",
  "supporter": {
    "supporter_id": "supp-uuid",
    "status": "online",
    "current_sessions_count": 2
  }
}
```

## Role-Based Access Control (RBAC)

### Role Definitions

| Role | Can | Cannot |
|------|-----|--------|
| **admin** | Create/edit users, assign staff to sessions, manage agents/tools, upload knowledge, view ALL sessions + history, enrich knowledge from any session | - |
| **staff** | View ONLY assigned sessions, respond to messages, enrich knowledge from assigned sessions | Create/edit users, assign sessions, view other staff's sessions, manage config |
| **tenant_user** | Chat with bot, view own session history (future) | Access admin features |

### Permission Matrix

| Action | Admin | Staff | Tenant User |
|--------|-------|-------|-------------|
| View all sessions | ✅ | ❌ (assigned only) | ❌ |
| View session message history | ✅ (all) | ✅ (assigned only) | ❌ |
| Respond to messages | ✅ | ✅ (assigned only) | ✅ (own chat) |
| **Assign staff to session** | ✅ | ❌ | ❌ |
| Upload documents | ✅ | ✅ | ❌ |
| **Enrich messages to knowledge base** | ✅ (any session) | ✅ (assigned only) | ❌ |
| Create users | ✅ | ❌ | ❌ |
| Manage agents/tools | ✅ | ❌ | ❌ |

### Middleware Implementation

```python
from fastapi import Depends, HTTPException, status
from src.models.user import User

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Decode JWT and return User object"""
    # Verify JWT signature
    # Decode payload
    # Query database
    return user

def require_admin(current_user: User = Depends(get_current_user)):
    """Protect admin endpoints"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_staff_or_admin(current_user: User = Depends(get_current_user)):
    """Protect staff endpoints"""
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    return current_user
```

## Password Management

### Initial Setup

For MVP, use simple password reset flow:

```python
@router.post("/api/auth/reset-password")
def reset_password(
    request: PasswordResetRequest,  # {email, new_password}
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin reset password for user (MVP, no email flow)"""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Hash and update
    user.password_hash = hash_password(request.new_password)
    db.commit()
    return {"message": "Password reset successfully"}
```

## JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "staff@tenant.com",
  "role": "staff",
  "tenant_id": "tenant-uuid",
  "supporter_id": "supp-uuid",  // null for tenant_user
  "exp": 1699694400
}
```

## Implementation Tasks

### Backend

- [ ] Create User and Supporter models in `src/models/`
- [ ] Create migration for new tables
- [ ] Create `src/api/auth.py` with login endpoint
- [ ] Create `src/api/admin/users.py` for user management
- [ ] Implement JWT token generation (using existing JWT setup)
- [ ] Add RBAC middleware
- [ ] Update ChatSession model with escalation fields
- [ ] Add supporters endpoint to admin API

### Database

- [ ] Run migration: `alembic revision --autogenerate -m "Add user management"`
- [ ] Run: `alembic upgrade head`

### Testing

- [ ] Unit tests for password hashing
- [ ] Integration tests for login endpoint
- [ ] Tests for RBAC middleware
- [ ] API contract tests

## Security Considerations

1. **Password Storage**: Use bcrypt with salt (10+ rounds)
2. **JWT**: RS256 signature (already configured)
3. **Token Expiry**: 24 hours for staff, implement refresh tokens later
4. **Email Uniqueness**: Per-tenant unique constraint
5. **Admin-only Creation**: No self-registration in MVP

## Migration Strategy

1. **Step 1**: Create new tables (User, Supporter)
2. **Step 2**: Migrate existing tenant data (create admin user per tenant)
3. **Step 3**: Deploy auth middleware
4. **Step 4**: Update frontend to use login
