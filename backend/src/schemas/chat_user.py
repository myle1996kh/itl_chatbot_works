"""Pydantic schemas for chat user requests and responses."""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


class ChatUserCreate(BaseModel):
    """Request schema for creating a chat user."""

    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=1, max_length=255, description="User full name or username")
    department: Optional[str] = Field(None, max_length=255, description="Optional department")


class ChatUserUpdate(BaseModel):
    """Request schema for updating a chat user."""

    username: Optional[str] = Field(None, min_length=1, max_length=255, description="User full name or username")
    department: Optional[str] = Field(None, max_length=255, description="Optional department")


class ChatUserResponse(BaseModel):
    """Response schema for chat user."""

    user_id: UUID = Field(..., description="Chat user UUID")
    tenant_id: UUID = Field(..., description="Tenant UUID")
    email: str = Field(..., description="User email address")
    username: str = Field(..., description="User full name or username")
    department: Optional[str] = Field(None, description="Optional department")
    token: Optional[str] = Field(None, description="JWT token for guest authentication")
    created_at: datetime = Field(..., description="User creation timestamp")
    last_active: datetime = Field(..., description="Last active timestamp")

    class Config:
        from_attributes = True


class ChatUserSummary(BaseModel):
    """Summary schema for chat user (minimal info)."""

    user_id: UUID = Field(..., description="Chat user UUID")
    email: str = Field(..., description="User email address")
    username: str = Field(..., description="User full name or username")
    created_at: datetime = Field(..., description="User creation timestamp")

    class Config:
        from_attributes = True


class SessionPreview(BaseModel):
    """Session preview with last message."""

    session_id: UUID = Field(..., description="Session UUID")
    created_at: datetime = Field(..., description="Session creation timestamp")
    last_message_at: datetime = Field(..., description="Last message timestamp")
    message_count: int = Field(..., description="Number of messages in session")
    last_message_preview: Optional[str] = Field(
        None, description="Preview of last message (up to 100 chars)"
    )
    escalation_status: Optional[str] = Field(
        None, description="Escalation status: none, pending, assigned, resolved"
    )

    class Config:
        from_attributes = True


class ChatUserSessionsResponse(BaseModel):
    """Response schema for listing user's sessions."""

    user: ChatUserResponse = Field(..., description="Chat user information")
    sessions: list[SessionPreview] = Field(
        default_factory=list, description="List of sessions with last message preview"
    )
    total_sessions: int = Field(..., description="Total number of sessions")

    class Config:
        from_attributes = True
