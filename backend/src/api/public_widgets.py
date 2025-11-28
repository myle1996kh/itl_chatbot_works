"""Public API endpoints for widget consumption."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from src.config import get_db
from src.services.widget_service import widget_service
from src.schemas.widget import WidgetConfigResponse
from src.schemas.chat import ChatRequest, ChatResponse
from src.utils.logging import get_logger
import uuid

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["public-widgets"])


@router.get("/widget-config", response_model=WidgetConfigResponse)
async def get_public_widget_config(
    request: Request,
    tenant_id: str = Query(..., description="Tenant UUID"),
    widget_key: str = Query(..., description="Public widget key"),
    db: Session = Depends(get_db),
) -> WidgetConfigResponse:
    """
    Get widget configuration for public embed (No Auth required).

    Validates that the widget_key matches the tenant_id.
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        widget_config = widget_service.get_widget_config(db, tenant_uuid)

        if not widget_config:
            logger.warning("public_widget_config_not_found", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Widget configuration not found")

        # Validate widget key
        if widget_config.widget_key != widget_key:
            logger.warning(
                "invalid_widget_key",
                tenant_id=tenant_id,
                provided_key=widget_key
            )
            raise HTTPException(status_code=403, detail="Invalid widget key")

        # Optional: Validate Origin header against allowed_domains
        origin = request.headers.get("origin")
        if origin and widget_config.allowed_domains:
            # Simple check - in production use more robust domain matching
            allowed = False
            for domain in widget_config.allowed_domains:
                if domain in origin:
                    allowed = True
                    break
            
            if not allowed:
                logger.warning(
                    "widget_origin_not_allowed",
                    tenant_id=tenant_id,
                    origin=origin,
                    allowed=widget_config.allowed_domains
                )
                # We log but don't block yet to avoid breaking dev setups
                # raise HTTPException(status_code=403, detail="Domain not allowed")

        logger.info(
            "public_widget_config_served",
            tenant_id=tenant_id,
            origin=origin
        )

        return WidgetConfigResponse(
            config_id=str(widget_config.config_id),
            tenant_id=str(widget_config.tenant_id),
            widget_key=widget_config.widget_key,
            theme=widget_config.theme,
            primary_color=widget_config.primary_color,
            position=widget_config.position,
            custom_css=widget_config.custom_css,
            auto_open=widget_config.auto_open,
            welcome_message=widget_config.welcome_message,
            placeholder_text=widget_config.placeholder_text,
            allowed_domains=widget_config.allowed_domains,
            max_session_duration=widget_config.max_session_duration,
            rate_limit_per_minute=widget_config.rate_limit_per_minute,
            enable_file_upload=widget_config.enable_file_upload,
            enable_voice_input=widget_config.enable_voice_input,
            enable_conversation_history=widget_config.enable_conversation_history,
            created_at=widget_config.created_at,
            updated_at=widget_config.updated_at,
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant UUID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_public_widget_config_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


# Widget authentication dependency
async def verify_widget_auth(
    tenant_id: str = Query(..., description="Tenant UUID"),
    widget_key: str = Header(..., alias="X-Widget-Key", description="Widget key for authentication"),
    db: Session = Depends(get_db),
) -> dict:
    """
    Verify widget authentication using widget_key.
    
    This is used instead of JWT authentication for widget endpoints.
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        widget_config = widget_service.get_widget_config(db, tenant_uuid)
        
        if not widget_config:
            raise HTTPException(status_code=404, detail="Widget not found")
        
        if widget_config.widget_key != widget_key:
            logger.warning(
                "invalid_widget_key_auth",
                tenant_id=tenant_id,
                provided_key=widget_key[:10] + "..."
            )
            raise HTTPException(status_code=403, detail="Invalid widget key")
        
        return {
            "tenant_id": str(tenant_uuid),
            "widget_key": widget_key,
            "config": widget_config
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant UUID")


@router.post("/widget/chat")
async def widget_chat(
    request: ChatRequest,
    widget_auth: dict = Depends(verify_widget_auth),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Widget chat endpoint (uses widget_key authentication, not JWT).
    
    This endpoint is for widget use only and doesn't require JWT tokens.
    """
    try:
        from src.api.chat import process_chat_message
        
        # Add tenant_id from widget auth
        tenant_id = widget_auth["tenant_id"]
        
        logger.info(
            "widget_chat_request",
            tenant_id=tenant_id,
            session_id=request.session_id,
            message_length=len(request.message)
        )
        
        # Process chat using existing chat logic
        # Note: We pass a mock user context since widget doesn't have user auth
        response = await process_chat_message(
            message=request.message,
            session_id=request.session_id,
            tenant_id=tenant_id,
            user_id="widget-user",  # Widget users don't have user IDs
            db=db
        )
        
        return response
        
    except Exception as e:
        logger.error(
            "widget_chat_error",
            error=str(e),
            tenant_id=widget_auth.get("tenant_id")
        )
        raise HTTPException(status_code=500, detail="Chat processing failed")


@router.get("/widget/session/{session_id}")
async def get_widget_session(
    session_id: str,
    widget_auth: dict = Depends(verify_widget_auth),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get widget session (uses widget_key authentication, not JWT).
    
    Returns session information for the widget.
    """
    try:
        from src.models.session import Session as ChatSession
        
        tenant_id = widget_auth["tenant_id"]
        
        # Get session from database
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.tenant_id == tenant_id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "session_id": str(session.session_id),
            "tenant_id": str(session.tenant_id),
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_widget_session_error",
            error=str(e),
            session_id=session_id
        )
        raise HTTPException(status_code=500, detail="Failed to get session")


@router.get("/widget/session/{session_id}/messages")
async def get_widget_session_messages(
    session_id: str,
    widget_auth: dict = Depends(verify_widget_auth),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get widget session messages (uses widget_key authentication, not JWT).
    
    Returns chat history for the widget.
    """
    try:
        from src.models.message import Message
        from src.models.session import Session as ChatSession
        
        tenant_id = widget_auth["tenant_id"]
        
        # Verify session belongs to tenant
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.tenant_id == tenant_id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get messages
        messages = db.query(Message).filter(
            Message.session_id == session_id
        ).order_by(Message.created_at.desc()).limit(limit).all()
        
        return {
            "session_id": session_id,
            "total": len(messages),
            "messages": [
                {
                    "message_id": str(msg.message_id),
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                }
                for msg in reversed(messages)  # Reverse to get chronological order
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_widget_session_messages_error",
            error=str(e),
            session_id=session_id
        )
        raise HTTPException(status_code=500, detail="Failed to get messages")
