"""Tenant Widget Configuration model for iframe embedding."""
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class TenantWidgetConfig(Base):
    """Configuration for embeddable chat widget per tenant."""

    __tablename__ = "tenant_widget_configs"

    config_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False, unique=True)

    # Widget Identification
    widget_key = Column(String(64), unique=True, nullable=False, index=True)  # Public identifier
    widget_secret = Column(String(255), nullable=False)  # Encrypted secret for verification

    # Appearance Settings
    theme = Column(String(20), default="light")  # light, dark, auto
    primary_color = Column(String(7), default="#3B82F6")  # Hex color
    position = Column(String(20), default="bottom-right")  # bottom-right, bottom-left, etc.
    custom_css = Column(Text, nullable=True)  # Custom CSS overrides

    # Behavior Settings
    auto_open = Column(Boolean, default=True)  # Auto-open on page load
    welcome_message = Column(Text, nullable=True)  # Initial greeting
    placeholder_text = Column(String(255), default="Type your message...")

    # Security Settings
    allowed_domains = Column(JSONB, default=list)  # Whitelist of parent domains
    max_session_duration = Column(Integer, default=3600)  # Seconds
    rate_limit_per_minute = Column(Integer, default=20)  # Messages per minute

    # Feature Flags
    enable_file_upload = Column(Boolean, default=False)
    enable_voice_input = Column(Boolean, default=False)
    enable_conversation_history = Column(Boolean, default=True)

    # Embed Code (auto-generated)
    embed_script_url = Column(String(500), nullable=True)  # CDN URL for widget.js
    embed_code_snippet = Column(Text, nullable=True)  # Ready-to-copy HTML snippet

    # Metadata
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_regenerated_at = Column(TIMESTAMP, nullable=True)  # When widget_key was last rotated

    # Relationships
    tenant = relationship("Tenant", back_populates="widget_config")

    def __repr__(self):
        return f"<TenantWidgetConfig(tenant_id={self.tenant_id}, widget_key={self.widget_key})>"
