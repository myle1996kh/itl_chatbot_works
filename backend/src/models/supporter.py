"""Supporter model for staff handling escalated conversations."""
from datetime import datetime
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class Supporter(Base):
    """Supporter - staff members who handle escalated conversations."""

    __tablename__ = "supporters"
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_user_supporter'),
        Index('ix_supporters_tenant_status', 'tenant_id', 'status'),
    )

    supporter_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, unique=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    status = Column(String(50), default='offline')  # 'online', 'offline', 'busy', 'away'
    max_concurrent_sessions = Column(Integer, default=5)
    current_sessions_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="supporter")
    tenant = relationship("Tenant", back_populates="supporters")
    assigned_sessions = relationship("ChatSession", back_populates="assigned_supporter")
    messages = relationship("Message", back_populates="supporter")

    def __repr__(self):
        return f"<Supporter(supporter_id={self.supporter_id}, user_id={self.user_id}, status={self.status})>"
