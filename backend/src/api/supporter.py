"""Supporter chat API endpoints for escalation handling."""

import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from src.config import get_db, settings
from src.middleware.auth import get_current_tenant, get_current_user
from src.models.message import Message
from src.models.session import ChatSession
from src.models.tenant import Tenant
from src.models.user import User
from src.models.chat_user import ChatUser
from src.schemas.supporter_chat import (
    SupporterChatRequest,
    SupporterChatResponse,
    SupporterSessionsResponse,
)
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["supporter"])


@router.get(
    "/tenants/{tenant_id}/supporters/{supporter_id}/sessions",
    response_model=SupporterSessionsResponse,
)
async def get_supporter_sessions(
    tenant_id: UUID = Path(..., description="Tenant UUID"),
    supporter_id: UUID = Path(..., description="Supporter user UUID"),
    status: Optional[str] = Query(
        None,
        description="Filter by escalation status: pending, assigned, resolved",
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> SupporterSessionsResponse:
    """
    Get all sessions assigned to a supporter.

    Only returns sessions where assigned_user_id == supporter_id and escalation_status != 'none'.
    Supporters can only view their own sessions. Admins can view any supporter's sessions.

    Args:
        tenant_id: Tenant UUID
        supporter_id: Supporter user UUID
        status: Optional filter by escalation status
        skip: Pagination offset (default 0)
        limit: Pagination limit (default 20, max 100)
        db: Database session
        current_user: Current user from JWT (tenant context)

    Returns:
        SupporterSessionsResponse with list of assigned sessions and metadata

    Raises:
        HTTPException: 403 if not authorized, 404 if tenant/supporter not found
    """
    try:
        # Extract user_id from JWT payload
        current_user_id = current_user.get("sub")
        if not current_user_id:
            logger.error("current_user_no_sub", current_user=current_user)
            raise HTTPException(status_code=401, detail="Invalid JWT token - missing 'sub'")

        # Convert to UUID
        try:
            current_user_uuid = UUID(current_user_id)
        except ValueError:
            logger.error(
                "invalid_user_id_format",
                current_user_id=current_user_id,
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID format in JWT token"
            )

        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.error(
                "tenant_not_found",
                tenant_id=tenant_id,
            )
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate tenant access
        if not settings.DISABLE_AUTH and current_tenant != str(tenant_id):
            logger.error(
                "access_denied",
                tenant_id=tenant_id,
                current_tenant=current_tenant,
            )
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

        # Validate supporter exists and has role='supporter'
        supporter = (
            db.query(User)
            .filter(
                and_(
                    User.user_id == supporter_id,
                    User.tenant_id == tenant_id,
                    User.role == "supporter",
                )
            )
            .first()
        )
        if not supporter:
            logger.error(
                "supporter_not_found",
                tenant_id=tenant_id,
                supporter_id=supporter_id,
            )
            raise HTTPException(status_code=404, detail="Supporter not found")

        # Build query for sessions assigned to supporter
        # Subquery to get the last message content
        last_message_subq = (
            db.query(
                Message.session_id,
                Message.content.label("last_message_content")
            )
            .distinct(Message.session_id)
            .order_by(Message.session_id, Message.created_at.desc())
            .subquery()
        )

        query = db.query(
            ChatSession.session_id,
            ChatSession.tenant_id,
            ChatSession.user_id,
            ChatSession.escalation_status,
            ChatSession.escalation_reason,
            ChatSession.assigned_user_id,
            ChatSession.escalation_requested_at,
            ChatSession.escalation_assigned_at,
            ChatSession.created_at,
            func.count(Message.message_id).label("message_count"),
            func.max(Message.created_at).label("last_message_at"),
            ChatUser.email.label("user_email"),
            ChatUser.username.label("user_name"),
            last_message_subq.c.last_message_content.label("last_message"),
        ).outerjoin(
            Message, ChatSession.session_id == Message.session_id
        ).outerjoin(
            ChatUser,
            and_(
                ChatSession.user_id == ChatUser.user_id,
                ChatSession.tenant_id == ChatUser.tenant_id
            )
        ).outerjoin(
            last_message_subq, ChatSession.session_id == last_message_subq.c.session_id
        )

        # Filter: this tenant, assigned to supporter, not 'none' status
        query = query.filter(
            and_(
                ChatSession.tenant_id == tenant_id,
                ChatSession.assigned_user_id == supporter_id,
                ChatSession.escalation_status != "none",
            )
        )

        # Optional: filter by status
        if status:
            query = query.filter(ChatSession.escalation_status == status)

        # Group and order
        query = query.group_by(
            ChatSession.session_id,
            ChatUser.email,
            ChatUser.username,
            last_message_subq.c.last_message_content
        ).order_by(
            ChatSession.escalation_assigned_at.desc()
        )

        # Get total count before pagination
        total_sessions = query.count()

        # Pagination
        sessions = query.offset(skip).limit(limit).all()

        # Count active (assigned) sessions
        active_count = (
            db.query(func.count(ChatSession.session_id))
            .filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.assigned_user_id == supporter_id,
                    ChatSession.escalation_status == "assigned",
                )
            )
            .scalar()
        )

        # Build response
        sessions_info = []
        for session in sessions:
            sessions_info.append(
                {
                    "session_id": str(session.session_id),
                    "tenant_id": str(session.tenant_id),
                    "user_id": str(session.user_id),
                    "user_email": session.user_email if session.user_email else None,
                    "user_name": session.user_name if session.user_name else None,
                    "escalation_status": session.escalation_status,
                    "escalation_reason": session.escalation_reason,
                    "assigned_user_id": str(session.assigned_user_id),
                    "escalation_requested_at": session.escalation_requested_at,
                    "escalation_assigned_at": session.escalation_assigned_at,
                    "message_count": session.message_count or 0,
                    "last_message": session.last_message if hasattr(session, 'last_message') and session.last_message else None,
                    "last_message_at": session.last_message_at or session.created_at,
                    "created_at": session.created_at,
                }
            )

        logger.info(
            "supporter_sessions_retrieved",
            tenant_id=tenant_id,
            supporter_id=supporter_id,
            session_count=len(sessions_info),
            total_sessions=total_sessions,
            status_filter=status,
        )

        return SupporterSessionsResponse(
            success=True,
            total_sessions=total_sessions,
            active_sessions=active_count or 0,
            sessions=sessions_info,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_supporter_sessions_error",
            tenant_id=tenant_id,
            supporter_id=supporter_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/tenants/{tenant_id}/supporter-chat",
    response_model=SupporterChatResponse,
)
async def supporter_send_message(
    tenant_id: UUID = Path(..., description="Tenant UUID"),
    request: SupporterChatRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> SupporterChatResponse:
    """
    Supporter sends message to tenant user in assigned session.

    Creates a message with role='supporter' and sender_user_id=current_user (from JWT).
    No bot/agent processing - direct message to conversation.
    Updates session's last_message_at timestamp.

    Args:
        tenant_id: Tenant UUID
        request: SupporterChatRequest with session_id and message
        db: Database session
        current_user: Current user UUID from JWT (supporter)
        current_tenant: Current tenant UUID from JWT (must match tenant_id)

    Returns:
        SupporterChatResponse with created message details

    Raises:
        HTTPException: 400 if validation fails, 403 if not authorized, 404 if not found
    """
    try:
        # Extract user_id from JWT payload or request body (dev mode)
        current_user_id = current_user.get("sub")

        # In development mode with DISABLE_AUTH, allow sender_user_id from request body
        if settings.DISABLE_AUTH and request.sender_user_id:
            current_user_id = request.sender_user_id
            logger.debug(
                "supporter_chat_dev_mode",
                sender_user_id=current_user_id,
                reason="DISABLE_AUTH=true and sender_user_id provided in request"
            )

        if not current_user_id:
            logger.error("current_user_no_sub", current_user=current_user)
            raise HTTPException(status_code=401, detail="Invalid JWT token - missing 'sub'")

        # Convert to UUID
        try:
            current_user_uuid = UUID(current_user_id)
        except ValueError:
            logger.error(
                "invalid_user_id_format",
                current_user_id=current_user_id,
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid user ID format in JWT token"
            )

        # Validate tenant access
        if not settings.DISABLE_AUTH and current_tenant != str(tenant_id):
            logger.error(
                "tenant_access_denied",
                tenant_id=tenant_id,
                current_tenant=current_tenant,
            )
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

        # Get session
        session = (
            db.query(ChatSession)
            .filter(
                and_(
                    ChatSession.session_id == request.session_id,
                    ChatSession.tenant_id == tenant_id,
                )
            )
            .first()
        )
        if not session:
            logger.error(
                "session_not_found",
                tenant_id=tenant_id,
                session_id=request.session_id,
            )
            raise HTTPException(status_code=400, detail="Session not found")

        # Validate escalation status is 'assigned'
        if session.escalation_status != "assigned":
            logger.error(
                "session_not_assigned",
                tenant_id=tenant_id,
                session_id=request.session_id,
                status=session.escalation_status,
            )
            raise HTTPException(
                status_code=400,
                detail=f"Session escalation is not in 'assigned' status (current: {session.escalation_status})",
            )

        # Validate current user is assigned to this session
        if session.assigned_user_id != current_user_uuid:
            logger.error(
                "not_assigned_to_session",
                tenant_id=tenant_id,
                session_id=request.session_id,
                current_user=current_user,
                assigned_user=session.assigned_user_id,
            )
            raise HTTPException(
                status_code=400,
                detail="Session is not assigned to you",
            )

        # Validate current user is a supporter
        supporter = (
            db.query(User)
            .filter(
                and_(
                    User.user_id == current_user_uuid,
                    User.tenant_id == tenant_id,
                    User.role == "supporter",
                )
            )
            .first()
        )
        if not supporter:
            logger.error(
                "not_a_supporter",
                tenant_id=tenant_id,
                user_id=current_user,
            )
            raise HTTPException(
                status_code=403,
                detail="Your user role is not 'supporter'",
            )

        # Validate message content
        if not request.message or not request.message.strip():
            logger.error(
                "empty_message",
                tenant_id=tenant_id,
                session_id=request.session_id,
            )
            raise HTTPException(
                status_code=400,
                detail="Message content cannot be empty",
            )

        # Create message record
        message = Message(
            message_id=uuid.uuid4(),
            session_id=request.session_id,
            role="supporter",
            content=request.message,
            sender_user_id=current_user_uuid,
            message_metadata=request.metadata or {},
        )
        db.add(message)

        # Update session's last_message_at timestamp
        session.last_message_at = datetime.now(timezone.utc)

        # Commit
        db.commit()
        db.refresh(message)

        # NEW: Broadcast message via SSE for real-time delivery
        from src.services.sse_manager import sse_manager
        import asyncio
        
        try:
            await sse_manager.broadcast_message(
                str(request.session_id),
                {
                    "type": "new_message",
                    "message": {
                        "message_id": str(message.message_id),
                        "session_id": str(message.session_id),
                        "role": message.role,
                        "content": message.content,
                        "sender_user_id": str(message.sender_user_id),
                        "supporter_name": supporter.display_name or supporter.username,
                        "created_at": message.created_at.isoformat(),
                    }
                }
            )
            logger.debug(f"SSE broadcast sent for message {message.message_id}")
        except Exception as e:
            # Don't fail the request if SSE broadcast fails
            logger.warning(f"SSE broadcast failed: {e}")

        logger.info(
            "supporter_message_sent",
            tenant_id=tenant_id,
            session_id=request.session_id,
            supporter_id=current_user,
            message_id=message.message_id,
            message_length=len(request.message),
        )

        return SupporterChatResponse(
            success=True,
            message_id=str(message.message_id),
            session_id=str(message.session_id),
            role=message.role,
            sender_user_id=str(message.sender_user_id),
            content=message.content,
            created_at=message.created_at,
            metadata=message.message_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "supporter_chat_error",
            tenant_id=str(tenant_id),
            session_id=str(request.session_id),
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post(
    "/admin/tenants/{tenant_id}/sessions/{session_id}/messages",
    response_model=SupporterChatResponse,
    tags=["admin"],
)
async def admin_send_message(
    tenant_id: UUID = Path(..., description="Tenant UUID"),
    session_id: str = Path(..., description="Session UUID"),
    request: SupporterChatRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> SupporterChatResponse:
    """
    Admin sends message to a session (bypasses escalation requirement).

    Creates a message with role='supporter' and sender_user_id=current_user.
    Admin can send messages to ANY session regardless of escalation status.
    Updates session's last_message_at timestamp.

    Args:
        tenant_id: Tenant UUID
        session_id: Session UUID
        request: SupporterChatRequest with message
        db: Database session
        current_user: Current user UUID from JWT (admin/staff)
        current_tenant: Current tenant UUID from JWT (must match tenant_id)

    Returns:
        SupporterChatResponse with created message details
    """
    try:
        # Extract user_id from JWT
        current_user_id = current_user.get("sub")

        # Dev mode: allow sender_user_id from request
        if settings.DISABLE_AUTH and request.sender_user_id:
            current_user_id = request.sender_user_id

        if not current_user_id:
            raise HTTPException(status_code=401, detail="Invalid JWT token - missing 'sub'")

        try:
            current_user_uuid = UUID(current_user_id)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid user ID format")

        # Validate tenant access
        if not settings.DISABLE_AUTH and current_tenant != str(tenant_id):
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

        # Get session
        session = (
            db.query(ChatSession)
            .filter(
                and_(
                    ChatSession.session_id == session_id,
                    ChatSession.tenant_id == tenant_id,
                )
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Validate message content
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message content cannot be empty")

        # Create message
        message = Message(
            message_id=str(uuid.uuid4()),
            session_id=session_id,
            tenant_id=tenant_id,
            sender_user_id=current_user_uuid,
            role="supporter",
            content=request.message.strip(),
            created_at=datetime.now(timezone.utc),
        )

        db.add(message)

        # Update session's last_message_at
        session.last_message_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(message)

        logger.info(
            "admin_message_sent",
            tenant_id=str(tenant_id),
            session_id=session_id,
            sender_user_id=str(current_user_id),
            message_length=len(request.message),
        )

        return SupporterChatResponse(
            success=True,
            message_id=str(message.message_id),
            session_id=str(message.session_id),
            role=message.role,
            sender_user_id=str(message.sender_user_id),
            content=message.content,
            created_at=message.created_at,
            metadata=message.message_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "admin_message_error",
            tenant_id=str(tenant_id),
            session_id=session_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
