"""Public API endpoints for widget consumption."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from src.config import get_db
from src.services.widget_service import widget_service
from src.schemas.widget import WidgetConfigResponse
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
