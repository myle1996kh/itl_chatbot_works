"""Chat users API endpoints for managing customer accounts."""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import uuid

from src.config import get_db
from src.models.chat_user import ChatUser
from src.models.tenant import Tenant
from src.models.session import ChatSession
from src.models.message import Message
from src.schemas.chat_user import (
    ChatUserCreate,
    ChatUserUpdate,
    ChatUserResponse,
    ChatUserSessionsResponse,
    SessionPreview,
)
from src.middleware.auth import get_current_tenant, verify_tenant_access
from src.utils.logging import get_logger

logger = get_logger(__name__)

from src.api.auth import generate_token

router = APIRouter(prefix="/api", tags=["chat-users"])


@router.post("/{tenant_id}/chat_users", response_model=ChatUserResponse)
async def create_chat_user(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: ChatUserCreate = Body(...),
    db: Session = Depends(get_db),
) -> ChatUserResponse:
    """
    Create a new chat user from UserInfoForm data.

    This endpoint is called when a user first visits and fills in their info.
    Returns existing user if email already exists for this tenant.

    **PUBLIC ENDPOINT** - No authentication required (widget uses this).
    Tenant isolation is enforced by path parameter validation.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Check for existing user with same email
        existing_user = (
            db.query(ChatUser).filter(
                and_(
                    ChatUser.tenant_id == tenant_id,
                    ChatUser.email == request.email.lower(),
                )
            ).first()
        )

        if existing_user:
            logger.info(
                "chat_user_already_exists",
                tenant_id=tenant_id,
                user_id=existing_user.user_id,
                email=request.email,
            )
            
            # Generate token for existing user
            token = generate_token(
                user_id=str(existing_user.user_id),
                tenant_id=tenant_id,
                role="chat_user"
            )
            
            response = ChatUserResponse.from_orm(existing_user)
            response.token = token
            return response

        # Create new chat user
        new_user = ChatUser(
            user_id=uuid.uuid4(),
            tenant_id=tenant_id,
            email=request.email.lower(),
            username=request.username,
            department=request.department,
            created_at=datetime.utcnow(),
            last_active=datetime.utcnow(),
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(
            "chat_user_created",
            tenant_id=tenant_id,
            user_id=new_user.user_id,
            email=request.email,
        )
        
        # Generate token for new user
        token = generate_token(
            user_id=str(new_user.user_id),
            tenant_id=tenant_id,
            role="chat_user"
        )

        response = ChatUserResponse.from_orm(new_user)
        response.token = token
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "create_chat_user_error",
            tenant_id=tenant_id,
            email=request.email,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{tenant_id}/chat_users/{email}", response_model=ChatUserResponse)
async def get_chat_user_by_email(
    tenant_id: str = Path(..., description="Tenant UUID"),
    email: str = Path(..., description="User email address"),
    db: Session = Depends(get_db),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> ChatUserResponse:
    """
    Get chat user by email address.

    Returns the chat user if exists, 404 if not found.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Query user by email
        user = (
            db.query(ChatUser).filter(
                and_(
                    ChatUser.tenant_id == tenant_id,
                    ChatUser.email == email.lower(),
                )
            ).first()
        )

        if not user:
            logger.info(
                "chat_user_not_found",
                tenant_id=tenant_id,
                email=email,
            )
            raise HTTPException(status_code=404, detail="Chat user not found")

        # Update last_active
        user.last_active = datetime.utcnow()
        db.commit()

        logger.info(
            "chat_user_retrieved",
            tenant_id=tenant_id,
            user_id=user.user_id,
            email=email,
        )

        return ChatUserResponse.from_orm(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_chat_user_error",
            tenant_id=tenant_id,
            email=email,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{tenant_id}/chat_users/{user_id}/sessions", response_model=ChatUserSessionsResponse)
async def list_user_sessions(
    tenant_id: str = Path(..., description="Tenant UUID"),
    user_id: str = Path(..., description="Chat user UUID"),
    limit: int = Query(50, ge=1, le=100, description="Maximum sessions to return"),
    offset: int = Query(0, ge=0, description="Number of sessions to skip"),
    db: Session = Depends(get_db),
    current_tenant: Optional[str] = Depends(get_current_tenant),
) -> ChatUserSessionsResponse:
    """
    List all sessions for a chat user with preview of last message.

    Returns user info plus paginated list of sessions with last message preview.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Query chat user
        user = (
            db.query(ChatUser).filter(
                and_(
                    ChatUser.tenant_id == tenant_id,
                    ChatUser.user_id == user_id,
                )
            ).first()
        )

        if not user:
            logger.info(
                "chat_user_not_found_for_sessions",
                tenant_id=tenant_id,
                user_id=user_id,
            )
            raise HTTPException(status_code=404, detail="Chat user not found")

        # Query sessions
        sessions = (
            db.query(ChatSession)
            .filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.user_id == user_id,
                )
            )
            .order_by(desc(ChatSession.created_at))
            .limit(limit)
            .offset(offset)
            .all()
        )

        # Get total count
        total_sessions = (
            db.query(ChatSession).filter(
                and_(
                    ChatSession.tenant_id == tenant_id,
                    ChatSession.user_id == user_id,
                )
            ).count()
        )

        # Build session previews with last message
        session_previews = []
        for session in sessions:
            # Get last message preview
            last_message = (
                db.query(Message)
                .filter(Message.session_id == session.session_id)
                .order_by(desc(Message.created_at))
                .first()
            )

            last_message_preview = None
            if last_message:
                preview = last_message.content[:100]
                last_message_preview = (
                    preview + "..." if len(last_message.content) > 100 else preview
                )

            session_previews.append(
                SessionPreview(
                    session_id=session.session_id,
                    created_at=session.created_at,
                    last_message_at=session.last_message_at,
                    message_count=db.query(Message)
                    .filter(Message.session_id == session.session_id)
                    .count(),
                    last_message_preview=last_message_preview,
                    escalation_status=session.escalation_status,
                )
            )

        logger.info(
            "user_sessions_listed",
            tenant_id=tenant_id,
            user_id=user_id,
            total=total_sessions,
            limit=limit,
            offset=offset,
        )

        return ChatUserSessionsResponse(
            user=ChatUserResponse.from_orm(user),
            sessions=session_previews,
            total_sessions=total_sessions,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "list_user_sessions_error",
            tenant_id=tenant_id,
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
