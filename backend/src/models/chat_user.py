"""ChatUser model for customer/end-user chat accounts."""
from datetime import datetime
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class ChatUser(Base):
    """ChatUser - represents customers/end-users who chat with the system."""

    __tablename__ = "chat_users"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='uq_chat_users_tenant_email'),
        Index('ix_chat_users_tenant_email', 'tenant_id', 'email'),
        Index('ix_chat_users_tenant_id', 'tenant_id'),
    )

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    email = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)  # Optional department
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    last_active = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="chat_users")
    sessions = relationship("ChatSession", back_populates="chat_user", foreign_keys="ChatSession.user_id")

    def __repr__(self):
        return f"<ChatUser(user_id={self.user_id}, email={self.email}, tenant_id={self.tenant_id})>"
