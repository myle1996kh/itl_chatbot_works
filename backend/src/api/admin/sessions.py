"""Admin API endpoints for session management."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from src.config import get_db
from src.models.session import ChatSession
from src.models.message import Message
from src.models.tenant import Tenant
from src.schemas.chat import SessionSummary, SessionDetail
from src.middleware.auth import require_admin_role
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-sessions"])


@router.get("/tenants/{tenant_id}/sessions", response_model=dict)
async def list_tenant_sessions(
    tenant_id: str = Path(..., description="Tenant UUID"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> dict:
    """
    List all chat sessions for a tenant (admin only).

    Returns sessions ordered by most recent first.
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Verify admin is from same tenant
        admin_tenant_id = admin_payload.get("tenant_id")
        if admin_tenant_id != tenant_id:
            logger.warning(
                "list_sessions_denied",
                admin_tenant_id=admin_tenant_id,
                target_tenant_id=tenant_id,
                reason="tenant_mismatch"
            )
            raise HTTPException(
                status_code=403,
                detail="Can only view sessions in your tenant"
            )

        # Get total count
        total = db.query(ChatSession).filter(
            ChatSession.tenant_id == tenant_id
        ).count()

        # Get sessions with pagination
        sessions = db.query(ChatSession).filter(
            ChatSession.tenant_id == tenant_id
        ).order_by(
            desc(ChatSession.last_message_at)
        ).limit(limit).offset(offset).all()

        # Convert to SessionSummary format
        session_summaries = [
            SessionSummary(
                session_id=str(session.session_id),
                tenant_id=session.tenant_id,
                user_id=session.user_id,
                agent_id=session.agent_id,
                thread_id=session.thread_id,
                created_at=session.created_at.isoformat(),
                last_message_at=session.last_message_at.isoformat() if session.last_message_at else None,
                message_count=len(session.messages) if session.messages else 0,
            )
            for session in sessions
        ]

        logger.info(
            "list_tenant_sessions",
            tenant_id=tenant_id,
            count=len(session_summaries),
            total=total,
            admin_id=admin_payload.get("sub")
        )

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "sessions": session_summaries
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "list_sessions_error",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/tenants/{tenant_id}/sessions/{session_id}", response_model=SessionDetail)
async def get_session_details(
    tenant_id: str = Path(..., description="Tenant UUID"),
    session_id: str = Path(..., description="Session UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> SessionDetail:
    """
    Get full session details with all messages (admin only).

    Returns complete session information including message history.
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Verify admin is from same tenant
        admin_tenant_id = admin_payload.get("tenant_id")
        if admin_tenant_id != tenant_id:
            logger.warning(
                "get_session_denied",
                admin_tenant_id=admin_tenant_id,
                target_tenant_id=tenant_id,
                reason="tenant_mismatch"
            )
            raise HTTPException(
                status_code=403,
                detail="Can only view sessions in your tenant"
            )

        # Get session
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.tenant_id == tenant_id
        ).first()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get messages for this session ordered by timestamp
        messages = db.query(Message).filter(
            Message.session_id == session_id
        ).order_by(Message.created_at).all()

        # Convert messages to dict format
        message_list = [
            {
                "message_id": str(msg.message_id),
                "session_id": str(msg.session_id),
                "sender_id": msg.sender_user_id,
                "sender_type": msg.role,
                "content": msg.content,
                "timestamp": msg.created_at.isoformat(),
                "metadata": msg.message_metadata or {},
            }
            for msg in messages
        ]

        logger.info(
            "get_session_details",
            tenant_id=tenant_id,
            session_id=session_id,
            message_count=len(message_list),
            admin_id=admin_payload.get("sub")
        )

        return SessionDetail(
            session_id=str(session.session_id),
            tenant_id=session.tenant_id,
            user_id=session.user_id,
            agent_id=session.agent_id,
            thread_id=session.thread_id,
            created_at=session.created_at,
            last_message_at=session.last_message_at,
            messages=message_list,
            metadata=session.session_metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_session_details_error",
            tenant_id=tenant_id,
            session_id=session_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
