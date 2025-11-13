"""Message model for individual chat messages within sessions."""
from datetime import datetime
from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class Message(Base):
    """Message - individual chat messages within sessions."""

    __tablename__ = "messages"
    __table_args__ = (
        Index('ix_messages_session_timestamp', 'session_id', 'timestamp'),
    )

    message_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False)
    role = Column(String(50), nullable=False)  # user/assistant/system/supporter
    content = Column(Text, nullable=False)  # Message content
    created_at = Column("timestamp", TIMESTAMP, nullable=False, default=datetime.utcnow)  # Mapped to "timestamp" column
    message_metadata = Column("metadata", JSONB)  # Additional metadata (intent, tool_calls, tokens)

    # Sender tracking for human-sent messages
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    sender_user = relationship("User", foreign_keys=[sender_user_id])

    def __repr__(self):
        return f"<Message(message_id={self.message_id}, session_id={self.session_id}, role={self.role})>"
