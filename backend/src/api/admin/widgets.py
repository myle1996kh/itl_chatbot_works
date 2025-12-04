"""Admin API endpoints for widget configuration management."""
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session
from src.config import get_db
from src.services.widget_service import widget_service
from src.schemas.widget import (
    WidgetConfigResponse,
    WidgetEmbedCodeResponse,
    WidgetConfigUpdateRequest,
)
from src.middleware.auth import require_admin_role
from src.utils.logging import get_logger
import uuid

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-widgets"])


@router.get(
    "/tenants/{tenant_id}/widget",
    response_model=WidgetConfigResponse
)
async def get_widget_config(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> WidgetConfigResponse:
    """
    Get widget configuration for a tenant.

    Requires admin role in JWT.

    Args:
        tenant_id: Tenant UUID

    Returns:
        WidgetConfigResponse with widget configuration
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        widget_config = widget_service.get_widget_config(db, tenant_uuid)

        if not widget_config:
            raise HTTPException(
                status_code=404,
                detail="Widget configuration not found for this tenant"
            )

        logger.info(
            "widget_config_retrieved",
            admin_user=admin_payload.get("sub"),
            tenant_id=tenant_id
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
            embed_script_url=widget_config.embed_script_url,
            embed_code_snippet=widget_config.embed_code_snippet,
            created_at=widget_config.created_at,
            updated_at=widget_config.updated_at,
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant UUID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_widget_config_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get widget config: {str(e)}"
        )

@router.post(
    "/tenants/{tenant_id}/widget",
    response_model=WidgetConfigResponse,
    status_code=201
)
async def create_widget_config(
    request: Request,  # Inject request
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> WidgetConfigResponse:
    """
    Create widget configuration for an existing tenant.

    This endpoint creates a widget config for tenants that were created
    without one (e.g., using the basic tenant create endpoint).

    Requires admin role in JWT.

    Args:
        request: FastAPI Request object
        tenant_id: Tenant UUID

    Returns:
        WidgetConfigResponse with newly created widget configuration

    Raises:
        404: Tenant not found
        409: Widget already exists for this tenant
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)

        # Check if widget already exists
        existing_widget = widget_service.get_widget_config(db, tenant_uuid)
        if existing_widget:
            raise HTTPException(
                status_code=409,
                detail="Widget configuration already exists for this tenant. "
                       "Use PATCH to update or POST to /widget/regenerate-keys to regenerate."
            )

        # Verify tenant exists
        from src.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_uuid).first()
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail=f"Tenant not found: {tenant_id}"
            )

        # Get dynamic base URL
        scheme = request.url.scheme
        netloc = request.url.netloc
        dynamic_base_url = f"{scheme}://{netloc}"

        # Create widget config
        widget_config = widget_service.create_widget_config(
            db=db,
            tenant_id=tenant_uuid,
            api_base_url=dynamic_base_url,
            auto_open=True   # Pass dynamic URL
        )
        db.commit()

        logger.info(
            "widget_config_created",
            admin_user=admin_payload.get("sub"),
            tenant_id=tenant_id,
            widget_key=widget_config.widget_key
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
            embed_script_url=widget_config.embed_script_url,
            embed_code_snippet=widget_config.embed_code_snippet,
            created_at=widget_config.created_at,
            updated_at=widget_config.updated_at,
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant UUID format")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "create_widget_config_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create widget config: {str(e)}"
        )

@router.get(
    "/tenants/{tenant_id}/widget/embed-code",
    response_model=WidgetEmbedCodeResponse
)
async def get_widget_embed_code(
    request: Request,  # Inject request to get dynamic base URL
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> WidgetEmbedCodeResponse:
    """
    Get widget embed code for a tenant.

    Returns ready-to-use HTML snippet that can be copied and pasted
    into the tenant's website. The URL is dynamically generated based
    on the current request host to support multiple environments.

    Requires admin role in JWT.

    Args:
        request: FastAPI Request object
        tenant_id: Tenant UUID

    Returns:
        WidgetEmbedCodeResponse with embed code snippet
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        widget_config = widget_service.get_widget_config(db, tenant_uuid)

        if not widget_config:
            raise HTTPException(
                status_code=404,
                detail="Widget configuration not found for this tenant. "
                       "Please create a tenant using the full creation endpoint."
            )

        # Dynamically generate base URL from request
        # This handles localhost vs production domains automatically
        scheme = request.url.scheme
        netloc = request.url.netloc
        dynamic_base_url = f"{scheme}://{netloc}"

        # Generate fresh embed code using the dynamic URL
        dynamic_embed_code = widget_service.generate_embed_code(
            tenant_id=tenant_id,
            widget_key=widget_config.widget_key,
            api_base_url=dynamic_base_url
        )

        logger.info(
            "widget_embed_code_retrieved",
            admin_user=admin_payload.get("sub"),
            tenant_id=tenant_id,
            widget_key=widget_config.widget_key,
            base_url=dynamic_base_url
        )

        return WidgetEmbedCodeResponse(
            tenant_id=str(widget_config.tenant_id),
            widget_key=widget_config.widget_key,
            embed_code=dynamic_embed_code,
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant UUID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_widget_embed_code_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get widget embed code: {str(e)}"
        )


@router.patch(
    "/tenants/{tenant_id}/widget",
    response_model=WidgetConfigResponse
)
async def update_widget_config(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: WidgetConfigUpdateRequest = ...,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> WidgetConfigResponse:
    """
    Update widget configuration for a tenant.

    Requires admin role in JWT.

    Args:
        tenant_id: Tenant UUID
        request: WidgetConfigUpdateRequest with fields to update

    Returns:
        WidgetConfigResponse with updated configuration
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)

        # Build update dict from request (only non-None fields)
        update_data = {
            k: v for k, v in request.dict().items()
            if v is not None
        }

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="No fields to update"
            )

        widget_config = widget_service.update_widget_config(
            db, tenant_uuid, **update_data
        )

        if not widget_config:
            raise HTTPException(
                status_code=404,
                detail="Widget configuration not found for this tenant"
            )

        logger.info(
            "widget_config_updated",
            admin_user=admin_payload.get("sub"),
            tenant_id=tenant_id,
            updated_fields=list(update_data.keys())
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
            embed_script_url=widget_config.embed_script_url,
            embed_code_snippet=widget_config.embed_code_snippet,
            created_at=widget_config.created_at,
            updated_at=widget_config.updated_at,
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant UUID format")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "update_widget_config_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update widget config: {str(e)}"
        )


@router.post(
    "/tenants/{tenant_id}/widget/regenerate-keys",
    response_model=WidgetConfigResponse
)
async def regenerate_widget_keys(
    request: Request,  # Inject request
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> WidgetConfigResponse:
    """
    Regenerate widget keys for security rotation.

    This will invalidate the old widget_key and generate new keys.
    The old embed code will stop working.

    Requires admin role in JWT.

    Args:
        request: FastAPI Request object
        tenant_id: Tenant UUID

    Returns:
        WidgetConfigResponse with new widget keys and embed code
    """
    try:
        tenant_uuid = uuid.UUID(tenant_id)

        # Get dynamic base URL
        scheme = request.url.scheme
        netloc = request.url.netloc
        dynamic_base_url = f"{scheme}://{netloc}"

        widget_config = widget_service.regenerate_widget_keys(
            db, 
            tenant_uuid,
            api_base_url=dynamic_base_url
        )

        logger.info(
            "widget_keys_regenerated",
            admin_user=admin_payload.get("sub"),
            tenant_id=tenant_id,
            new_widget_key=widget_config.widget_key
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
            embed_script_url=widget_config.embed_script_url,
            embed_code_snippet=widget_config.embed_code_snippet,
            created_at=widget_config.created_at,
            updated_at=widget_config.updated_at,
        )

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail="Invalid tenant UUID format")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "regenerate_widget_keys_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate widget keys: {str(e)}"
        )
