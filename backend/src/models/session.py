"""Session model for tracking conversation sessions."""
from datetime import datetime
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class ChatSession(Base):
    """ChatSession - conversation sessions for tracking multi-turn interactions."""

    __tablename__ = "sessions"
    __table_args__ = (
        Index('ix_sessions_tenant_user', 'tenant_id', 'user_id', 'created_at'),
        Index('ix_sessions_escalation', 'tenant_id', 'escalation_status'),
    )

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("chat_users.user_id"), nullable=False)  # FK to chat_users table (customers)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agent_configs.agent_id"))
    thread_id = Column(String(500))  # LangGraph thread ID
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    last_message_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, index=True)
    session_metadata = Column("metadata", JSONB)  # Additional session metadata (mapped to "metadata" column)

    # Escalation fields
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    escalation_status = Column(String(50), default='none')  # 'none', 'pending', 'assigned', 'resolved'
    escalation_reason = Column(String(500), nullable=True)
    escalation_requested_at = Column(TIMESTAMP, nullable=True)
    escalation_assigned_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="sessions")
    chat_user = relationship("ChatUser", foreign_keys=[user_id], back_populates="sessions")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])  # Staff/supporter assigned for escalation
    agent = relationship("AgentConfig")
    messages = relationship("Message", back_populates="session")


    def __repr__(self):
        return f"<ChatSession(session_id={self.session_id}, tenant_id={self.tenant_id}, user_id={self.user_id})>"
