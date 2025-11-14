"""Pydantic schemas for chat requests and responses."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""

    message: str = Field(..., min_length=1, max_length=2000, description="User message content")
    user_id: str = Field(default="default_user", description="User identifier (external user ID from auth system)")
    session_id: Optional[str] = Field(default=None, description="Optional: Existing session UUID for follow-up messages. If not provided, a new session will be created automatically.")
    agent_name: Optional[str] = Field(default=None, description="Optional: Agent name to route to directly (e.g., 'GuidelineAgent'). If provided, skips SupervisorAgent and routes directly to this agent. If not provided, uses SupervisorAgent for intent detection.")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata (e.g., jwt_token for external API calls)")


class LLMModelInfo(BaseModel):
    """LLM model information."""

    llm_model_id: str = Field(..., description="LLM model UUID")
    model_class: str = Field(..., description="LLM class name (e.g., ChatOpenAI, ChatOpenRouter)")
    model_name: str = Field(..., description="Model name (e.g., openai/gpt-4o-mini)")


class ToolCallInfo(BaseModel):
    """Tool call information."""

    tool_name: str = Field(..., description="Name of the tool that was called")
    tool_args: Dict[str, Any] = Field(..., description="Arguments passed to the tool")
    tool_id: str = Field(..., description="Unique identifier for this tool call")


class ResponseMetadata(BaseModel):
    """Extended metadata for chat responses."""

    agent_id: str = Field(..., description="Agent UUID that processed the request")
    tenant_id: str = Field(..., description="Tenant UUID")
    duration_ms: Optional[float] = Field(None, description="Request processing duration in milliseconds")
    status: Optional[str] = Field(None, description="Processing status")
    llm_model: Optional[LLMModelInfo] = Field(None, description="LLM model information")
    tool_calls: Optional[List[ToolCallInfo]] = Field(default_factory=list, description="Tools called during processing")
    extracted_entities: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Entities extracted from user message (e.g., tax_code, salesman)")


class ChatResponse(BaseModel):
    """Response schema for chat endpoint."""

    session_id: str = Field(..., description="Session UUID")
    message_id: str = Field(..., description="Message UUID")
    response: Dict[str, Any] = Field(..., description="Agent response data (structure varies by agent)")
    agent: str = Field(..., description="Agent that processed the request")
    intent: str = Field(..., description="Detected user intent")
    format: str = Field(..., description="Output format type (text/json/table)")
    renderer_hint: Dict[str, Any] = Field(default_factory=dict, description="UI rendering hints")
    metadata: ResponseMetadata = Field(..., description="Response metadata with LLM model info, tool calls, and extracted entities")


class ErrorResponse(BaseModel):
    """Error response schema."""

    status: str = Field(default="error")
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    code: Optional[str] = Field(None, description="Error code")


class SessionSummary(BaseModel):
    """Session summary schema."""

    session_id: str
    user_id: str = Field(..., description="User identifier (UUID)")
    user_email: Optional[str] = Field(None, description="User email address")
    user_name: Optional[str] = Field(None, description="User name")
    created_at: datetime
    last_message_at: datetime
    message_count: int
    last_message_preview: Optional[str] = Field(None, description="Preview of the last message")
    escalation_status: Optional[str] = Field(None, description="Escalation status (none, pending, assigned, resolved)")
    assigned_supporter_id: Optional[str] = Field(None, description="UUID of assigned supporter/staff member")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Session metadata")


class Message(BaseModel):
    """Message schema."""

    message_id: UUID
    role: str = Field(..., description="Message role: user/assistant/system")
    content: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


class SessionDetail(BaseModel):
    """Detailed session information schema."""

    session_id: str
    tenant_id: str
    user_id: str
    agent_id: Optional[str] = None
    thread_id: Optional[str] = Field(None, description="LangGraph thread ID")
    created_at: datetime
    last_message_at: datetime
    messages: List[Dict[str, Any]] = Field(..., description="List of messages in the session")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Session metadata")


class SessionListResponse(BaseModel):
    """Response schema for session list endpoint."""

    sessions: List[SessionSummary]
    total: int
    limit: int
    offset: int


class SessionCreateRequest(BaseModel):
    """Request schema for creating a new session."""

    topic: Optional[str] = Field(None, description="Starting topic/intent for the session")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional session metadata")


class SessionCreateResponse(BaseModel):
    """Response schema for session creation."""

    session_id: str = Field(..., description="New session UUID")
    user_id: str = Field(..., description="Chat user UUID")
    tenant_id: str = Field(..., description="Tenant UUID")
    created_at: datetime = Field(..., description="Session creation timestamp")


class SessionEndRequest(BaseModel):
    """Request schema for ending a session."""

    feedback: Optional[str] = Field(None, max_length=500, description="Optional session feedback")


class SessionEndResponse(BaseModel):
    """Response schema for ending a session."""

    session_id: str = Field(..., description="Session UUID")
    escalation_status: str = Field(..., description="Updated escalation status")
    message: str = Field(..., description="Status message")
