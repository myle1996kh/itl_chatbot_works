"""User model for authentication and tenant users."""
from datetime import datetime
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, UniqueConstraint, Index, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class User(Base):
    """User - represents supporter, admin, and tenant users."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='uq_tenant_email'),
        Index('ix_users_tenant_email', 'tenant_id', 'email'),
        Index('ix_users_role', 'role'),
    )

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    email = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)  # Hashed with bcrypt
    role = Column(String(50), nullable=False)  # 'supporter', 'admin'
    display_name = Column(String(255), nullable=True)
    status = Column(String(50), default='active')  # 'active', 'inactive', 'suspended'
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)  # Admin who created
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(TIMESTAMP, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")

    # Support profile (for escalation assignment)
    supporter_status = Column(String(50), default='offline')  # 'online', 'offline', 'busy', 'away'
    max_concurrent_sessions = Column(Integer, default=5)
    current_sessions_count = Column(Integer, default=0)

    def __repr__(self):
        return f"<User(user_id={self.user_id}, email={self.email}, role={self.role})>"
