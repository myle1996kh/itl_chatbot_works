"""Pydantic schemas for supporter chat endpoints."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime


class SupporterChatRequest(BaseModel):
    """Request schema for supporter sending message to tenant."""

    session_id: UUID = Field(..., description="UUID of escalated session")
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Message content from supporter",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional metadata (sender_type, etc)"
    )
    sender_user_id: Optional[str] = Field(
        default=None, description="(Dev only) Supporter user ID - used when DISABLE_AUTH=true and no JWT provided"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "message": "I understand the issue. Let me help you.",
                "metadata": {"sender_type": "supporter"},
            }
        }


class SupporterChatResponse(BaseModel):
    """Response schema for supporter message."""

    success: bool = Field(default=True, description="Operation success status")
    message_id: str = Field(..., description="Created message UUID")
    session_id: str = Field(..., description="Session UUID")
    role: str = Field(default="supporter", description="Message role")
    sender_user_id: str = Field(..., description="Supporter user UUID")
    content: str = Field(..., description="Message content")
    created_at: datetime = Field(..., description="Message creation timestamp")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Message metadata"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "success": True,
                "message_id": "550e8400-e29b-41d4-a716-446655440222",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "role": "supporter",
                "sender_user_id": "550e8400-e29b-41d4-a716-446655440111",
                "content": "I understand the issue. Let me help you.",
                "created_at": "2025-11-13T10:46:00Z",
                "metadata": {"sender_type": "supporter"},
            }
        }


class SupporterSessionInfo(BaseModel):
    """Information about a session assigned to supporter."""

    session_id: str = Field(..., description="Session UUID")
    tenant_id: str = Field(..., description="Tenant UUID")
    user_id: str = Field(..., description="Tenant user UUID")
    user_email: Optional[str] = Field(None, description="User email")
    user_name: Optional[str] = Field(None, description="User name")
    escalation_status: str = Field(..., description="Escalation status")
    escalation_reason: Optional[str] = Field(
        None, description="Reason for escalation"
    )
    assigned_user_id: str = Field(..., description="Assigned supporter UUID")
    escalation_requested_at: datetime = Field(..., description="Escalation request time")
    escalation_assigned_at: datetime = Field(..., description="Assignment time")
    message_count: int = Field(..., description="Total messages in session")
    last_message_at: datetime = Field(..., description="Last message timestamp")
    created_at: datetime = Field(..., description="Session creation time")

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "user_id": "user-uuid-123",
                "user_email": "user@example.com",
                "user_name": "John Doe",
                "escalation_status": "assigned",
                "escalation_reason": "User frustrated with bot",
                "assigned_user_id": "550e8400-e29b-41d4-a716-446655440111",
                "escalation_requested_at": "2025-11-13T10:30:00Z",
                "escalation_assigned_at": "2025-11-13T10:35:00Z",
                "message_count": 5,
                "last_message_at": "2025-11-13T10:45:00Z",
                "created_at": "2025-11-13T10:29:00Z",
            }
        }


class SupporterSessionsResponse(BaseModel):
    """Response schema for get supporter sessions endpoint."""

    success: bool = Field(default=True, description="Operation success status")
    total_sessions: int = Field(..., description="Total sessions count")
    active_sessions: int = Field(
        ..., description="Active sessions (assigned status)"
    )
    sessions: List[SupporterSessionInfo] = Field(
        default_factory=list, description="List of assigned sessions"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "success": True,
                "total_sessions": 3,
                "active_sessions": 2,
                "sessions": [
                    {
                        "session_id": "550e8400-e29b-41d4-a716-446655440000",
                        "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                        "user_id": "user-uuid-123",
                        "user_email": "user@example.com",
                        "user_name": "John Doe",
                        "escalation_status": "assigned",
                        "escalation_reason": "User frustrated",
                        "assigned_user_id": "550e8400-e29b-41d4-a716-446655440111",
                        "escalation_requested_at": "2025-11-13T10:30:00Z",
                        "escalation_assigned_at": "2025-11-13T10:35:00Z",
                        "message_count": 5,
                        "last_message_at": "2025-11-13T10:45:00Z",
                        "created_at": "2025-11-13T10:29:00Z",
                    }
                ],
            }
        }
