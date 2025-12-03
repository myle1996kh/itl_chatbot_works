"""Chat API endpoints for conversational interface."""

import time
import uuid
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Path, Body, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_
from src.config import get_db, settings
from typing import Optional
from src.models.session import ChatSession
from src.models.message import Message
from src.models.tenant import Tenant
from src.models.chat_user import ChatUser
from src.models.agent import AgentConfig
from src.models.permissions import TenantAgentPermission
from src.schemas.chat import ChatRequest, ChatResponse
from src.services.supervisor_agent import SupervisorAgent
from src.services.domain_agents import DomainAgent
from src.middleware.auth import get_current_tenant, verify_tenant_access
from src.utils.logging import get_logger
from src.services.llm_manager import llm_manager
from src.models.tenant_llm_config import TenantLLMConfig
from src.services.escalation_service import get_escalation_service
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

# ============================================================================
# ESCALATION SCHEMAS
# ============================================================================

class PublicEscalationRequest(BaseModel):
    """Public escalation request for widget users."""
    session_id: str
    reason: str

class PublicEscalationResponse(BaseModel):
    """Public escalation response."""
    success: bool
    session_id: str
    escalation_status: str
    message: str


def _extract_display_text(agent_response: Dict[str, Any]) -> str:
    """Extract human-readable text from an agent_response payload.

    Handles several shapes produced by different agents:
    - agent_response["data"] is a string => return directly
    - agent_response["data"]["response"] is a list of segments with {text|content}
    - agent_response["data"] has text/content/message/answer fields
    - fallback to str(data)
    """
    try:
        data = agent_response.get("data")
        if data is None:
            return ""
        if isinstance(data, str):
            return data

        def extract_from_node(node):
            if node is None:
                return None
            if isinstance(node, str):
                return node
            if isinstance(node, list):
                parts = []
                for item in node:
                    t = extract_from_node(item)
                    if t and isinstance(t, str):
                        parts.append(t)
                return "\n\n".join(parts) if parts else None
            if isinstance(node, dict):
                for key in ("text", "content", "message", "answer"):
                    v = node.get(key)
                    if isinstance(v, str) and v.strip():
                        return v
                # Look into common containers
                for key in ("response", "outputs", "output", "data"):
                    v = node.get(key)
                    t = extract_from_node(v)
                    if t:
                        return t
            return None

        # Try nested paths first
        text = extract_from_node(data)
        if text:
            return text

        # Fallback: stringified data
        return str(data)
    except Exception as _:
        # Last resort
        try:
            return str(agent_response.get("data", ""))
        except Exception:
            return ""


@router.post("/{tenant_id}/chat", response_model=ChatResponse)
async def chat_endpoint(
    response: Response,
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: ChatRequest = Body(...),
    db: Session = Depends(get_db),
    # Always depend on get_current_tenant so the dependency can decide
    # at runtime whether to bypass auth (based on settings.DISABLE_AUTH).
    # Avoid evaluating settings.DISABLE_AUTH at import time which can
    # cause unexpected behavior if env vars are loaded later.
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> ChatResponse:
    """
    Process user message and return agent response.

    Flow:
    1. Validate tenant access
    2. Create or retrieve session
    3. Save user message
    4. Route to SupervisorAgent
    5. Save assistant response
    6. Track performance metrics
    """
    start_time = time.time()

    try:
        # Validate tenant exists and user has access
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        logger.info(f"DISABLE_AUTH: {settings.DISABLE_AUTH}")
        logger.info(f"current_tenant: {current_tenant}")

        if not settings.DISABLE_AUTH and current_tenant != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

        # Create or retrieve session
        session = await _get_or_create_session(db, tenant_id, request.session_id, request.user_id)

        # Save user message
        user_message = Message(
            message_id=str(uuid.uuid4()),
            session_id=session.session_id,
            role="user",
            content=request.message,
            metadata=request.metadata or {},
        )
        db.add(user_message)
        db.commit()

        logger.info(
            "user_message_received",
            tenant_id=tenant_id,
            session_id=session.session_id,
            user_id=session.user_id,
            message_length=len(request.message),
        )

        # Extract JWT token from current_tenant context (passed via middleware)
        # In production, middleware would inject full JWT token into request state
        jwt_token = request.metadata.get("jwt_token", "") if request.metadata else ""

        # Route message through SupervisorAgent OR direct to agent if agent_name provided
        if request.agent_name:
            # Direct routing: Skip SupervisorAgent and route directly to the specified agent
            logger.info(
                "direct_agent_routing",
                tenant_id=tenant_id,
                agent_name=request.agent_name,
                session_id=session.session_id,
            )
            agent_response = await _route_to_agent(
                db=db,
                tenant_id=tenant_id,
                agent_name=request.agent_name,
                message=request.message,
                session_id=str(session.session_id),
                jwt_token=jwt_token,
            )
        else:
            # SupervisorAgent routing: Use intent detection and routing
            logger.info(
                "supervisor_agent_routing",
                tenant_id=tenant_id,
                session_id=session.session_id,
            )
            supervisor = SupervisorAgent(
                db=db,
                tenant_id=tenant_id,
                jwt_token=jwt_token,
                session_id=str(session.session_id),  # Pass session_id for conversation memory
            )

            agent_response = await supervisor.route_message(request.message)

        # Save assistant response with text-only content and full metadata
        assistant_message = Message(
            message_id=str(uuid.uuid4()),
            session_id=session.session_id,
            role="assistant",
            content=_extract_display_text(agent_response),
            message_metadata={
                "agent": agent_response.get("agent"),
                "intent": agent_response.get("intent"),
                "format": agent_response.get("format"),
                "renderer_hint": agent_response.get("renderer_hint"),
                # Add full metadata from agent response
                "llm_model": agent_response.get("metadata", {}).get("llm_model"),
                "tool_calls": agent_response.get("metadata", {}).get("tool_calls"),
                "extracted_entities": agent_response.get("metadata", {}).get("extracted_entities"),
                "agent_id": agent_response.get("metadata", {}).get("agent_id"),
                "tenant_id": agent_response.get("metadata", {}).get("tenant_id"),
                "status": agent_response.get("status"),
            },
        )
        db.add(assistant_message)

        # Update session metadata - track last message time
        from datetime import datetime, timezone

        session.last_message_at = datetime.now(timezone.utc)

        db.commit()

        # Calculate response time
        duration_ms = (time.time() - start_time) * 1000

        logger.info(
            "chat_response_completed",
            tenant_id=tenant_id,
            session_id=session.session_id,
            agent=agent_response.get("agent"),
            intent=agent_response.get("intent"),
            duration_ms=duration_ms,
            status="success",
        )

        # Check performance requirement (<2.5s)
        if duration_ms > 2500:
            logger.warning(
                "chat_response_slow",
                tenant_id=tenant_id,
                session_id=session.session_id,
                duration_ms=duration_ms,
                threshold_ms=2500,
            )

        # Build response metadata from agent response
        agent_metadata = agent_response.get("metadata", {})
        response_metadata = {
            "agent_id": agent_metadata.get("agent_id", "unknown"),
            "tenant_id": tenant_id,
            "duration_ms": duration_ms,
            "status": agent_response.get("status", "success"),
            "llm_model": agent_metadata.get("llm_model"),
            "tool_calls": agent_metadata.get("tool_calls", []),
            "extracted_entities": agent_metadata.get("extracted_entities", {}),
        }

        # Add rate limit headers if rate limiter is available
        if llm_manager.rate_limiter:
            try:
                # Get the tenant's actual limits
                tenant_config = (
                    db.query(TenantLLMConfig).filter(TenantLLMConfig.tenant_id == tenant_id).first()
                )

                if tenant_config:
                    actual_limits = llm_manager.rate_limiter.get_remaining_limits(
                        str(tenant_id), tenant_config.rate_limit_rpm, tenant_config.rate_limit_tpm
                    )

                    # Add rate limit headers
                    response.headers["X-RateLimit-Limit-RPM"] = str(actual_limits["rpm_limit"])
                    response.headers["X-RateLimit-Limit-TPM"] = str(actual_limits["tpm_limit"])
                    response.headers["X-RateLimit-Remaining-RPM"] = str(
                        actual_limits["rpm_remaining"]
                    )
                    response.headers["X-RateLimit-Remaining-TPM"] = str(
                        actual_limits["tpm_remaining"]
                    )
            except Exception as e:
                # If rate limit check fails, continue without headers
                logger.warning("rate_limit_headers_failed", tenant_id=tenant_id, error=str(e))

        return ChatResponse(
            session_id=str(session.session_id),
            message_id=str(assistant_message.message_id),
            response={"text": _extract_display_text(agent_response)},
            agent=agent_response.get("agent", "unknown"),
            intent=agent_response.get("intent", "unknown"),
            format="text",
            renderer_hint=agent_response.get("renderer_hint", {}),
            metadata=response_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        import traceback

        error_traceback = traceback.format_exc()
        logger.error(
            "chat_endpoint_error",
            tenant_id=tenant_id,
            error=str(e),
            traceback=error_traceback,
            duration_ms=duration_ms,
        )
        print(f"\n{'='*80}\nCHAT ENDPOINT ERROR:\n{'='*80}\n{error_traceback}\n{'='*80}\n")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


async def _get_or_create_session(
    db: Session, tenant_id: str, session_id: str | None, user_id: str
) -> ChatSession:
    """
    Get existing session or create new one.

    Args:
        db: Database session
        tenant_id: Tenant UUID
        session_id: Optional existing session ID
        user_id: User identifier (UUID string from JWT or chat_users.user_id)

    Returns:
        ChatSession instance
    """
    # Validate user_id is a valid UUID
    try:
        user_id_uuid = uuid.UUID(user_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user_id format: {user_id}. Must be valid UUID."
        )

    # Validate that ChatUser exists (new requirement)
    chat_user = (
        db.query(ChatUser).filter(
            and_(
                ChatUser.tenant_id == tenant_id,
                ChatUser.user_id == user_id_uuid,
            )
        ).first()
    )

    if not chat_user:
        raise HTTPException(
            status_code=404,
            detail=f"Chat user not found. Please create a chat user account first via /api/{tenant_id}/chat_users"
        )

    if session_id:
        # Validate session_id UUID format
        try:
            session_id_uuid = uuid.UUID(session_id)
        except (ValueError, AttributeError):
            logger.warning(
                "invalid_session_id_format",
                session_id=session_id,
                action="creating_new_session_instead",
            )
            session_id = None  # Treat invalid UUID as None

        if session_id:
            # Retrieve existing session
            session = (
                db.query(ChatSession)
                .filter(
                    ChatSession.session_id == session_id_uuid,
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.user_id == user_id_uuid,
                )
                .first()
            )

            if session:
                return session

            logger.warning(
                "session_not_found",
                tenant_id=tenant_id,
                session_id=session_id,
                user_id=user_id,
                action="creating_new_session",
            )

    # Create new session
    new_session_id = str(uuid.uuid4())
    thread_id = f"tenant_{tenant_id}__user_{user_id}__session_{new_session_id}"

    session = ChatSession(
        session_id=new_session_id,
        tenant_id=tenant_id,
        user_id=user_id_uuid,
        thread_id=thread_id,
        session_metadata={},
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


def get_agent_id_by_name(tenant_id: str, agent_name: str, db: Session) -> str:
    """
    Lookup agent_id by agent name for a specific tenant.

    Validates that:
    1. Agent exists in database
    2. Agent is enabled for the specified tenant

    Args:
        tenant_id: Tenant UUID context
        agent_name: Agent name (e.g., "DebtAgent", "GuidelineAgent")
        db: Database session

    Returns:
        agent_id if found and enabled for tenant

    Raises:
        HTTPException: If agent not found or not enabled for tenant
    """
    # Query agent by name
    agent = db.query(AgentConfig).filter(AgentConfig.name == agent_name).first()

    if not agent:
        raise HTTPException(status_code=400, detail=f"Agent '{agent_name}' not found")

    # Check if agent is active
    if not agent.is_active:
        raise HTTPException(status_code=400, detail=f"Agent '{agent_name}' is not active")

    # Check if enabled for this tenant
    permission = (
        db.query(TenantAgentPermission)
        .filter(
            TenantAgentPermission.tenant_id == tenant_id,
            TenantAgentPermission.agent_id == agent.agent_id,
            TenantAgentPermission.enabled == True,
        )
        .first()
    )

    if not permission:
        raise HTTPException(
            status_code=400, detail=f"Agent '{agent_name}' not available for tenant"
        )

    return str(agent.agent_id)


async def _route_to_agent(
    db: Session,
    tenant_id: str,
    agent_name: str,
    message: str,
    session_id: str,
    jwt_token: str,
) -> Dict[str, Any]:
    """
    Route a message directly to a specific agent by name.

    This bypasses the SupervisorAgent and routes directly to the specified agent.
    Validates that the agent is enabled for the tenant.

    Args:
        db: Database session
        tenant_id: Tenant UUID
        agent_name: Agent name to route to (e.g., 'GuidelineAgent')
        message: User message
        session_id: Session ID for conversation memory
        jwt_token: JWT token for external API calls

    Returns:
        Agent response dictionary

    Raises:
        HTTPException: If agent not found or not available for tenant
    """
    try:
        # Lookup agent by name and validate tenant permissions
        agent_id = get_agent_id_by_name(tenant_id, agent_name, db)

        logger.info(
            "routing_to_agent",
            tenant_id=tenant_id,
            agent_name=agent_name,
            agent_id=agent_id,
        )

        # Initialize DomainAgent with the specific agent config
        domain_agent = DomainAgent(
            db=db,
            agent_id=agent_id,
            tenant_id=tenant_id,
            jwt_token=jwt_token,
            session_id=session_id,
        )

        # Route message through DomainAgent
        agent_response = await domain_agent.invoke(message)

        logger.info(
            "agent_response_received",
            tenant_id=tenant_id,
            agent_name=agent_name,
            agent_id=agent_id,
        )

        return agent_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "agent_routing_error",
            tenant_id=tenant_id,
            agent_name=agent_name,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to route to agent '{agent_name}': {str(e)}",
        )


@router.post("/{tenant_id}/test/chat", response_model=ChatResponse)
async def test_chat_endpoint(
    response: Response,
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: ChatRequest = Body(...),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Process user message and return agent response for testing.
    This endpoint bypasses authentication.
    """
    start_time = time.time()

    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Create or retrieve session
        session = await _get_or_create_session(db, tenant_id, request.session_id, request.user_id)

        # Save user message
        user_message = Message(
            message_id=str(uuid.uuid4()),
            session_id=session.session_id,
            role="user",
            content=request.message,
            metadata=request.metadata or {},
        )
        db.add(user_message)
        db.commit()

        logger.info(
            "user_message_received_test",
            tenant_id=tenant_id,
            session_id=session.session_id,
            user_id=session.user_id,
            message_length=len(request.message),
        )

        # Extract JWT token from current_tenant context (passed via middleware)
        # In production, middleware would inject full JWT token into request state
        jwt_token = request.metadata.get("jwt_token", "") if request.metadata else ""

        # Route message through SupervisorAgent OR direct to agent if agent_name provided
        if request.agent_name:
            # Direct routing: Skip SupervisorAgent and route directly to the specified agent
            logger.info(
                "test_direct_agent_routing",
                tenant_id=tenant_id,
                agent_name=request.agent_name,
                session_id=session.session_id,
            )
            agent_response = await _route_to_agent(
                db=db,
                tenant_id=tenant_id,
                agent_name=request.agent_name,
                message=request.message,
                session_id=str(session.session_id),
                jwt_token=jwt_token,
            )
        else:
            # SupervisorAgent routing: Use intent detection and routing
            logger.info(
                "test_supervisor_agent_routing",
                tenant_id=tenant_id,
                session_id=session.session_id,
            )
            supervisor = SupervisorAgent(
                db=db,
                tenant_id=tenant_id,
                jwt_token=jwt_token,
                session_id=str(session.session_id),  # Pass session_id for conversation memory
            )

            agent_response = await supervisor.route_message(request.message)

        # Save assistant response with text-only content and full metadata
        assistant_message = Message(
            message_id=str(uuid.uuid4()),
            session_id=session.session_id,
            role="assistant",
            content=_extract_display_text(agent_response),
            message_metadata={
                "agent": agent_response.get("agent"),
                "intent": agent_response.get("intent"),
                "format": agent_response.get("format"),
                "renderer_hint": agent_response.get("renderer_hint"),
                # Add full metadata from agent response
                "llm_model": agent_response.get("metadata", {}).get("llm_model"),
                "tool_calls": agent_response.get("metadata", {}).get("tool_calls"),
                "extracted_entities": agent_response.get("metadata", {}).get("extracted_entities"),
                "agent_id": agent_response.get("metadata", {}).get("agent_id"),
                "tenant_id": agent_response.get("metadata", {}).get("tenant_id"),
                "status": agent_response.get("status"),
            },
        )
        db.add(assistant_message)

        # Update session metadata - track last message time
        from datetime import datetime, timezone

        session.last_message_at = datetime.now(timezone.utc)

        db.commit()

        # Calculate response time
        duration_ms = (time.time() - start_time) * 1000

        logger.info(
            "test_chat_response_completed",
            tenant_id=tenant_id,
            session_id=session.session_id,
            agent=agent_response.get("agent"),
            intent=agent_response.get("intent"),
            duration_ms=duration_ms,
            status="success",
        )

        # Build response metadata from agent response
        agent_metadata = agent_response.get("metadata", {})
        response_metadata = {
            "agent_id": agent_metadata.get("agent_id", "unknown"),
            "tenant_id": tenant_id,
            "duration_ms": duration_ms,
            "status": agent_response.get("status", "success"),
            "llm_model": agent_metadata.get("llm_model"),
            "tool_calls": agent_metadata.get("tool_calls", []),
            "extracted_entities": agent_metadata.get("extracted_entities", {}),
        }

        # Add rate limit headers if rate limiter is available
        if llm_manager.rate_limiter:
            try:
                # Get the tenant's actual limits
                tenant_config = (
                    db.query(TenantLLMConfig).filter(TenantLLMConfig.tenant_id == tenant_id).first()
                )

                if tenant_config:
                    actual_limits = llm_manager.rate_limiter.get_remaining_limits(
                        str(tenant_id), tenant_config.rate_limit_rpm, tenant_config.rate_limit_tpm
                    )

                    # Add rate limit headers
                    response.headers["X-RateLimit-Limit-RPM"] = str(actual_limits["rpm_limit"])
                    response.headers["X-RateLimit-Limit-TPM"] = str(actual_limits["tpm_limit"])
                    response.headers["X-RateLimit-Remaining-RPM"] = str(
                        actual_limits["rpm_remaining"]
                    )
                    response.headers["X-RateLimit-Remaining-TPM"] = str(
                        actual_limits["tpm_remaining"]
                    )
            except Exception as e:
                # If rate limit check fails, continue without headers
                logger.warning("rate_limit_headers_failed", tenant_id=tenant_id, error=str(e))

        return ChatResponse(
            session_id=str(session.session_id),
            message_id=str(assistant_message.message_id),
            response={"text": _extract_display_text(agent_response)},
            agent=agent_response.get("agent", "unknown"),
            intent=agent_response.get("intent", "unknown"),
            format="text",
            renderer_hint=agent_response.get("renderer_hint", {}),
            metadata=response_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        import traceback

        error_traceback = traceback.format_exc()
        logger.error(
            "test_chat_endpoint_error",
            tenant_id=tenant_id,
            error=str(e),
            traceback=error_traceback,
            duration_ms=duration_ms,
        )
        print(f"\n{'='*80}\nTEST CHAT ENDPOINT ERROR:\n{'='*80}\n{error_traceback}\n{'='*80}\n")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============================================================================
# PUBLIC ESCALATION ENDPOINT (for widget users)
# ============================================================================

@router.post(
    "/{tenant_id}/session/{session_id}/escalate",
    response_model=PublicEscalationResponse,
    status_code=200
)
async def public_escalate_session(
    tenant_id: str = Path(..., description="Tenant UUID"),
    session_id: str = Path(..., description="Session UUID"),
    request: PublicEscalationRequest = Body(...),
    db: Session = Depends(get_db),
) -> PublicEscalationResponse:
    """
    Public endpoint for widget users to escalate their chat session.

    This endpoint does NOT require admin authentication - it's for end users
    to request human support through the chat widget.

    Args:
        tenant_id: Tenant UUID
        session_id: Session UUID (must match request body)
        request: PublicEscalationRequest with session_id and reason
        db: Database session

    Returns:
        PublicEscalationResponse with escalation status

    Raises:
        HTTPException: If session not found or validation fails
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate session_id matches path and body
        if request.session_id != session_id:
            raise HTTPException(
                status_code=400,
                detail="Session ID in path must match session ID in request body"
            )

        # Validate session exists and belongs to tenant
        session = db.query(ChatSession).filter(
            and_(
                ChatSession.session_id == session_id,
                ChatSession.tenant_id == tenant_id
            )
        ).first()

        if not session:
            raise HTTPException(
                status_code=404,
                detail="Session not found or does not belong to this tenant"
            )

        # Escalate the session using escalation service
        escalation_service = get_escalation_service()
        result = escalation_service.escalate_session(
            db=db,
            session_id=session_id,
            tenant_id=tenant_id,
            reason=request.reason,
            auto_detected=False,  # Manual escalation from user
            keywords=None
        )

        if not result["success"]:
            # If already escalated, return current status instead of error
            if "already escalated" in result.get("error", "").lower():
                # Vietnamese message based on current status
                status_messages = {
                    "pending": "Yêu cầu hỗ trợ đang chờ xử lý",
                    "assigned": "Đã có nhân viên được phân công hỗ trợ",
                    "resolved": "Yêu cầu hỗ trợ đã được giải quyết"
                }
                status_msg = status_messages.get(session.escalation_status, "Yêu cầu hỗ trợ đang được xử lý")

                return PublicEscalationResponse(
                    success=True,
                    session_id=session_id,
                    escalation_status=session.escalation_status,
                    message=status_msg
                )

            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to escalate session")
            )

        # Determine message based on auto-assign result
        auto_assigned = result.get("auto_assigned", False)
        assigned_user_name = result.get("assigned_user_name")
        escalation_status = result.get("escalation_status", "pending")

        if auto_assigned and assigned_user_name:
            message = f"Đã kết nối với nhân viên hỗ trợ {assigned_user_name}"
        else:
            message = "Yêu cầu đã được gửi, nhân viên sẽ hỗ trợ sớm nhất"

        logger.info(
            "public_escalation_created",
            tenant_id=tenant_id,
            session_id=session_id,
            user_id=str(session.user_id) if session.user_id else None,
            reason=request.reason,
            auto_assigned=auto_assigned,
            assigned_user_id=result.get("assigned_user_id"),
            escalation_status=escalation_status
        )

        return PublicEscalationResponse(
            success=True,
            session_id=session_id,
            escalation_status=escalation_status,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "public_escalate_session_error",
            tenant_id=tenant_id,
            session_id=session_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to escalate session: {str(e)}"
        )
