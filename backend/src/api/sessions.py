"""Session management API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
import uuid

from src.config import get_db
from src.models.session import ChatSession
from src.models.message import Message
from src.models.tenant import Tenant
from src.models.chat_user import ChatUser
from src.schemas.chat import (
    SessionSummary,
    SessionDetail,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionEndRequest,
    SessionEndResponse,
)
from src.middleware.auth import get_current_tenant
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["sessions"])


@router.get("/{tenant_id}/session", response_model=List[SessionSummary])
async def list_sessions(
    tenant_id: str = Path(..., description="Tenant UUID"),
    user_id: str = Query(..., description="User ID to filter sessions"),
    start_date: Optional[datetime] = Query(None, description="Filter sessions created after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter sessions created before this date"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    db: Session = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant),
) -> List[SessionSummary]:
    """
    List user's chat sessions with pagination and optional date filtering.

    Returns sessions ordered by most recent first.
    """
    try:
        # Validate tenant exists and user has access
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        if current_tenant != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

        # Build query with filters
        query_filters = [
            ChatSession.tenant_id == tenant_id,
            ChatSession.user_id == user_id,
        ]

        # Add date range filters if provided
        if start_date:
            query_filters.append(ChatSession.created_at >= start_date)
        if end_date:
            query_filters.append(ChatSession.created_at <= end_date)

        # Query sessions for user
        sessions = (
            db.query(ChatSession)
            .filter(and_(*query_filters))
            .order_by(desc(ChatSession.created_at))
            .limit(limit)
            .offset(offset)
            .all()
        )

        # Build session summaries with message count
        summaries = []
        for session in sessions:
            message_count = (
                db.query(Message)
                .filter(Message.session_id == session.session_id)
                .count()
            )

            # Get last message preview
            last_message = (
                db.query(Message)
                .filter(Message.session_id == session.session_id)
                .order_by(desc(Message.created_at))
                .first()
            )

            last_message_preview = ""
            if last_message:
                last_message_preview = (
                    last_message.content[:100] + "..."
                    if len(last_message.content) > 100
                    else last_message.content
                )

            # Ensure metadata is a plain dict (not SQLAlchemy object)
            metadata_dict = {}
            if session.session_metadata:
                if isinstance(session.session_metadata, dict):
                    metadata_dict = session.session_metadata
                else:
                    try:
                        metadata_dict = dict(session.session_metadata)
                    except (TypeError, ValueError):
                        metadata_dict = {}

            summaries.append(
                SessionSummary(
                    session_id=str(session.session_id),
                    user_id=str(session.user_id),
                    created_at=session.created_at,
                    last_message_at=session.last_message_at,
                    message_count=message_count,
                    last_message_preview=last_message_preview,
                    escalation_status=session.escalation_status,
                    assigned_supporter_id=str(session.assigned_user_id) if session.assigned_user_id else None,
                    metadata=metadata_dict,
                )
            )

        logger.info(
            "sessions_listed",
            tenant_id=tenant_id,
            user_id=user_id,
            count=len(summaries),
            limit=limit,
            offset=offset,
        )

        return summaries

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "list_sessions_error",
            tenant_id=tenant_id,
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{tenant_id}/session/{session_id}", response_model=SessionDetail)
async def get_session(
    tenant_id: str = Path(..., description="Tenant UUID"),
    session_id: str = Path(..., description="Session UUID"),
    db: Session = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant),
) -> SessionDetail:
    """
    Get session details with full message history.

    Returns all messages in chronological order.
    """
    try:
        # Validate tenant exists and user has access
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        if current_tenant != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

        # Query session
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.session_id == session_id,
                ChatSession.tenant_id == tenant_id,
            )
            .first()
        )

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Query all messages in chronological order
        messages = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.created_at)
            .all()
        )

        # Build message list
        message_list = []
        for msg in messages:
            # Ensure message metadata is a plain dict (not SQLAlchemy object)
            msg_metadata_dict = {}
            if msg.metadata:
                if isinstance(msg.metadata, dict):
                    msg_metadata_dict = msg.metadata
                else:
                    try:
                        msg_metadata_dict = dict(msg.metadata)
                    except (TypeError, ValueError):
                        msg_metadata_dict = {}

            message_list.append({
                "message_id": str(msg.message_id),
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
                "metadata": msg_metadata_dict,
            })

        logger.info(
            "session_retrieved",
            tenant_id=tenant_id,
            session_id=session_id,
            message_count=len(message_list),
        )

        # Ensure metadata is a plain dict (not SQLAlchemy object)
        metadata_dict = {}
        if session.session_metadata:
            if isinstance(session.session_metadata, dict):
                metadata_dict = session.session_metadata
            else:
                try:
                    metadata_dict = dict(session.session_metadata)
                except (TypeError, ValueError):
                    metadata_dict = {}

        return SessionDetail(
            session_id=str(session.session_id),
            tenant_id=str(session.tenant_id),
            user_id=str(session.user_id),
            agent_id=str(session.agent_id) if session.agent_id else None,
            thread_id=session.thread_id,
            created_at=session.created_at,
            last_message_at=session.last_message_at,
            messages=message_list,
            metadata=metadata_dict,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_session_error",
            tenant_id=tenant_id,
            session_id=session_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{tenant_id}/sessions", response_model=SessionCreateResponse)
async def create_session(
    tenant_id: str = Path(..., description="Tenant UUID"),
    user_id: str = Query(..., description="Chat user UUID"),
    request: Optional[SessionCreateRequest] = Body(None),
    db: Session = Depends(get_db),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> SessionCreateResponse:
    """
    Create a new chat session for a chat user.

    Called before first message to initialize a session.
    Returns the new session_id to use for subsequent messages.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate chat user exists
        chat_user = (
            db.query(ChatUser).filter(
                and_(
                    ChatUser.tenant_id == tenant_id,
                    ChatUser.user_id == user_id,
                )
            ).first()
        )

        if not chat_user:
            raise HTTPException(status_code=404, detail="Chat user not found")

        # Create new session
        new_session_id = str(uuid.uuid4())
        thread_id = f"tenant_{tenant_id}__user_{user_id}__session_{new_session_id}"

        metadata = {}
        if request and request.topic:
            metadata["topic"] = request.topic
        if request and request.metadata:
            metadata.update(request.metadata)

        session = ChatSession(
            session_id=new_session_id,
            tenant_id=tenant_id,
            user_id=user_id,
            thread_id=thread_id,
            session_metadata=metadata,
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        logger.info(
            "session_created",
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=new_session_id,
        )

        return SessionCreateResponse(
            session_id=str(session.session_id),
            user_id=str(session.user_id),
            tenant_id=str(session.tenant_id),
            created_at=session.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "create_session_error",
            tenant_id=tenant_id,
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/{tenant_id}/sessions/{session_id}", response_model=SessionEndResponse)
async def end_session(
    tenant_id: str = Path(..., description="Tenant UUID"),
    session_id: str = Path(..., description="Session UUID"),
    request: Optional[SessionEndRequest] = Body(None),
    db: Session = Depends(get_db),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> SessionEndResponse:
    """
    End a chat session and mark it as resolved.

    Saves all conversation memory and marks escalation_status as 'resolved'.
    Next chat will require a new session_id.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Query session
        session = (
            db.query(ChatSession).filter(
                and_(
                    ChatSession.session_id == session_id,
                    ChatSession.tenant_id == tenant_id,
                )
            ).first()
        )

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Mark session as resolved/closed
        session.escalation_status = "resolved"
        if request and request.feedback:
            # Store feedback in metadata
            if session.session_metadata is None:
                session.session_metadata = {}
            session.session_metadata["feedback"] = request.feedback
            session.session_metadata["feedback_at"] = datetime.utcnow().isoformat()

        db.commit()

        logger.info(
            "session_ended",
            tenant_id=tenant_id,
            session_id=session_id,
            user_id=session.user_id,
        )

        return SessionEndResponse(
            session_id=str(session.session_id),
            escalation_status=session.escalation_status,
            message="Session ended successfully. All messages saved.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "end_session_error",
            tenant_id=tenant_id,
            session_id=session_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
