"""Pydantic schemas for widget configuration."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class WidgetConfigResponse(BaseModel):
    """Widget configuration response schema."""
    config_id: str
    tenant_id: str
    widget_key: str

    # Appearance Settings
    theme: str = "light"
    primary_color: str = "#3B82F6"
    position: str = "bottom-right"
    custom_css: Optional[str] = None

    # Behavior Settings
    auto_open: bool = False
    welcome_message: Optional[str] = None
    placeholder_text: str = "Type your message..."

    # Security Settings
    allowed_domains: List[str] = []
    max_session_duration: int = 3600
    rate_limit_per_minute: int = 20

    # Feature Flags
    enable_file_upload: bool = False
    enable_voice_input: bool = False
    enable_conversation_history: bool = True

    # Embed Code
    embed_script_url: Optional[str] = None
    embed_code_snippet: Optional[str] = None

    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WidgetEmbedCodeResponse(BaseModel):
    """Widget embed code response schema."""
    tenant_id: str
    widget_key: str
    embed_code: str
    instructions: str = Field(
        default="Copy and paste this code snippet into your website's <head> or before closing </body> tag."
    )

    class Config:
        from_attributes = True


class WidgetConfigUpdateRequest(BaseModel):
    """Request to update widget configuration."""
    theme: Optional[str] = None
    primary_color: Optional[str] = None
    position: Optional[str] = None
    custom_css: Optional[str] = None
    auto_open: Optional[bool] = None
    welcome_message: Optional[str] = None
    placeholder_text: Optional[str] = None
    allowed_domains: Optional[List[str]] = None
    max_session_duration: Optional[int] = None
    rate_limit_per_minute: Optional[int] = None
    enable_file_upload: Optional[bool] = None
    enable_voice_input: Optional[bool] = None
    enable_conversation_history: Optional[bool] = None
