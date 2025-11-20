"""Admin API endpoints for tenant management and permissions."""
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from src.config import get_db, get_redis
from src.models.tenant import Tenant
from src.models.agent import AgentConfig
from src.models.tool import ToolConfig
from src.models.permissions import TenantAgentPermission, TenantToolPermission
from src.models.tenant_llm_config import TenantLLMConfig
from src.models.llm_model import LLMModel
from src.utils.encryption import encrypt_api_key
from src.schemas.admin import (
    TenantPermissionsResponse,
    PermissionUpdateRequest,
    MessageResponse,
)
from src.middleware.auth import require_admin_role
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-tenants"])


# Request/Response schemas for Tenant CRUD
class TenantCreateRequest(BaseModel):
    """Create tenant request."""
    name: str = Field(..., min_length=1, max_length=255, description="Tenant name")
    domain: str = Field(..., min_length=1, max_length=255, description="Unique domain")
    status: str = Field(default="active", description="Tenant status (active/inactive)")


class TenantUpdateRequest(BaseModel):
    """Update tenant request."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    domain: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[str] = Field(None, description="Tenant status (active/inactive)")


class TenantResponse(BaseModel):
    """Tenant response."""
    tenant_id: str
    name: str
    domain: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    """List tenants response."""
    total: int
    tenants: List[TenantResponse]

# FULL TENANT CREATION SCHEMAS
class LLMConfigCreate(BaseModel):
    """LLM configuration for tenant creation."""
    provider: str = Field(..., description="LLM provider (openrouter, google, openai)")
    model_name: str = Field(..., description="Model name")
    api_key: str = Field(..., description="API key - will be encrypted")
    rate_limit_rpm: int = Field(default=60)
    rate_limit_tpm: int = Field(default=10000)


class TenantFullCreateRequest(BaseModel):
    """Create tenant with all configurations."""
    name: str = Field(..., min_length=1, max_length=255)
    domain: str = Field(..., min_length=1, max_length=255)
    status: str = Field(default="active")
    llm_config: LLMConfigCreate
    agent_ids: List[str] = Field(default=[], description="Agent IDs to enable")
    tool_ids: List[str] = Field(default=[], description="Tool IDs to enable")


class TenantFullResponse(BaseModel):
    """Response for full tenant creation."""
    tenant_id: str
    name: str
    domain: str
    status: str
    llm_config_id: str
    enabled_agents: int
    enabled_tools: int
    created_at: Optional[datetime] = None

# ============================================================================
# TENANT CRUD ENDPOINTS
# ============================================================================


@router.post("/tenants", response_model=TenantResponse, status_code=201)
async def create_tenant(
    request: TenantCreateRequest,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> TenantResponse:
    """
    Create a new tenant.

    Requires admin role in JWT.

    Args:
        request: TenantCreateRequest with name, domain, status

    Returns:
        TenantResponse with newly created tenant details
    """
    try:
        # Check if domain already exists
        existing = db.query(Tenant).filter(Tenant.domain == request.domain).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Domain '{request.domain}' already exists"
            )

        # Create new tenant
        tenant_id = str(uuid.uuid4())
        tenant = Tenant(
            tenant_id=tenant_id,
            name=request.name,
            domain=request.domain,
            status=request.status,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        logger.info(
            "tenant_created",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            domain=request.domain,
        )

        return TenantResponse(
            tenant_id=str(tenant.tenant_id),
            name=tenant.name,
            domain=tenant.domain,
            status=tenant.status,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "create_tenant_error",
            admin_user=admin_payload.get("user_id"),
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create tenant: {str(e)}"
        )


@router.get("/tenants", response_model=TenantListResponse)
async def list_tenants(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> TenantListResponse:
    """
    List all tenants with pagination.

    Requires admin role in JWT.

    Args:
        limit: Maximum number of results (default: 100)
        offset: Number of results to skip (default: 0)

    Returns:
        TenantListResponse with tenant list and total count
    """
    try:
        # Get total count
        total = db.query(Tenant).count()

        # Get paginated results
        tenants_data = db.query(Tenant).offset(offset).limit(limit).all()

        tenants = [
            TenantResponse(
                tenant_id=str(t.tenant_id),
                name=t.name,
                domain=t.domain,
                status=t.status,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in tenants_data
        ]

        logger.info(
            "tenants_listed",
            admin_user=admin_payload.get("user_id"),
            total=total,
            returned=len(tenants),
        )

        return TenantListResponse(total=total, tenants=tenants)

    except Exception as e:
        logger.error(
            "list_tenants_error",
            admin_user=admin_payload.get("user_id"),
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list tenants: {str(e)}"
        )


@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> TenantResponse:
    """
    Get tenant details.

    Requires admin role in JWT.

    Args:
        tenant_id: Tenant UUID

    Returns:
        TenantResponse with tenant details
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        logger.info(
            "tenant_retrieved",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
        )

        return TenantResponse(
            tenant_id=str(tenant.tenant_id),
            name=tenant.name,
            domain=tenant.domain,
            status=tenant.status,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_tenant_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get tenant: {str(e)}"
        )


@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: TenantUpdateRequest = ...,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> TenantResponse:
    """
    Update tenant details.

    Requires admin role in JWT.

    Args:
        tenant_id: Tenant UUID
        request: TenantUpdateRequest with fields to update

    Returns:
        TenantResponse with updated tenant details
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Check if new domain is unique (if changed)
        if request.domain and request.domain != tenant.domain:
            existing = db.query(Tenant).filter(
                Tenant.domain == request.domain,
                Tenant.tenant_id != tenant_id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Domain '{request.domain}' already exists"
                )

        # Update fields
        if request.name is not None:
            tenant.name = request.name
        if request.domain is not None:
            tenant.domain = request.domain
        if request.status is not None:
            tenant.status = request.status

        tenant.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(tenant)

        logger.info(
            "tenant_updated",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
        )

        return TenantResponse(
            tenant_id=str(tenant.tenant_id),
            name=tenant.name,
            domain=tenant.domain,
            status=tenant.status,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "update_tenant_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update tenant: {str(e)}"
        )


@router.delete("/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Delete (soft delete - set status to inactive) a tenant.

    Requires admin role in JWT.

    Args:
        tenant_id: Tenant UUID
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Soft delete: set status to inactive
        tenant.status = "inactive"
        tenant.updated_at = datetime.utcnow()
        db.commit()

        logger.info(
            "tenant_deleted",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "delete_tenant_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete tenant: {str(e)}"
        )


# ============================================================================
# TENANT PERMISSIONS ENDPOINTS
# ============================================================================


@router.get("/tenants/{tenant_id}/permissions", response_model=TenantPermissionsResponse)
async def get_tenant_permissions(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> TenantPermissionsResponse:
    """
    Get all permissions (enabled agents and tools) for a tenant.

    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get enabled agent permissions
        agent_perms = (
            db.query(TenantAgentPermission, AgentConfig)
            .join(AgentConfig, TenantAgentPermission.agent_id == AgentConfig.agent_id)
            .filter(
                TenantAgentPermission.tenant_id == tenant_id,
                TenantAgentPermission.enabled == True
            )
            .all()
        )

        enabled_agents = [
            {
                "agent_id": str(perm.agent_id),
                "agent_name": agent.name,
                "enabled": perm.enabled,
            }
            for perm, agent in agent_perms
        ]

        # Get enabled tool permissions
        tool_perms = (
            db.query(TenantToolPermission, ToolConfig)
            .join(ToolConfig, TenantToolPermission.tool_id == ToolConfig.tool_id)
            .filter(
                TenantToolPermission.tenant_id == tenant_id,
                TenantToolPermission.enabled == True
            )
            .all()
        )

        enabled_tools = [
            {
                "tool_id": str(perm.tool_id),
                "tool_name": tool.name,
                "enabled": perm.enabled,
            }
            for perm, tool in tool_perms
        ]

        logger.info(
            "tenant_permissions_retrieved",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            enabled_agents_count=len(enabled_agents),
            enabled_tools_count=len(enabled_tools),
        )

        return TenantPermissionsResponse(
            tenant_id=tenant_id,
            enabled_agents=enabled_agents,
            enabled_tools=enabled_tools,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_tenant_permissions_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get tenant permissions: {str(e)}"
        )


@router.patch("/tenants/{tenant_id}/permissions", response_model=MessageResponse)
async def update_tenant_permissions(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: PermissionUpdateRequest = ...,
    db: Session = Depends(get_db),
    redis = Depends(get_redis),
    admin_payload: dict = Depends(require_admin_role),
) -> MessageResponse:
    """
    Update tenant permissions (enable/disable agents and tools for a tenant).

    This will create permission records if they don't exist, or update if they do.
    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        updated_agents = 0
        updated_tools = 0

        # Update agent permissions
        if request.agent_permissions:
            for perm_update in request.agent_permissions:
                agent_id = perm_update.get("agent_id")
                enabled = perm_update.get("enabled", True)

                if not agent_id:
                    continue

                # Validate agent exists
                agent = db.query(AgentConfig).filter(
                    AgentConfig.agent_id == agent_id
                ).first()
                if not agent:
                    logger.warning(
                        "agent_not_found_skipping",
                        agent_id=agent_id,
                        tenant_id=tenant_id
                    )
                    continue

                # Check if permission exists
                existing_perm = db.query(TenantAgentPermission).filter(
                    TenantAgentPermission.tenant_id == tenant_id,
                    TenantAgentPermission.agent_id == agent_id
                ).first()

                if existing_perm:
                    # Update existing permission
                    existing_perm.enabled = enabled
                else:
                    # Create new permission
                    new_perm = TenantAgentPermission(
                        tenant_id=uuid.UUID(tenant_id),
                        agent_id=uuid.UUID(agent_id),
                        enabled=enabled,
                    )
                    db.add(new_perm)

                updated_agents += 1

        # Update tool permissions
        if request.tool_permissions:
            for perm_update in request.tool_permissions:
                tool_id = perm_update.get("tool_id")
                enabled = perm_update.get("enabled", True)

                if not tool_id:
                    continue

                # Validate tool exists
                tool = db.query(ToolConfig).filter(
                    ToolConfig.tool_id == tool_id
                ).first()
                if not tool:
                    logger.warning(
                        "tool_not_found_skipping",
                        tool_id=tool_id,
                        tenant_id=tenant_id
                    )
                    continue

                # Check if permission exists
                existing_perm = db.query(TenantToolPermission).filter(
                    TenantToolPermission.tenant_id == tenant_id,
                    TenantToolPermission.tool_id == tool_id
                ).first()

                if existing_perm:
                    # Update existing permission
                    existing_perm.enabled = enabled
                else:
                    # Create new permission
                    new_perm = TenantToolPermission(
                        tenant_id=uuid.UUID(tenant_id),
                        tool_id=uuid.UUID(tool_id),
                        enabled=enabled,
                    )
                    db.add(new_perm)

                updated_tools += 1

        db.commit()

        # Invalidate cache for this tenant
        async for redis_client in redis:
            pattern = f"agenthub:{tenant_id}:cache:*"
            cursor = 0
            deleted_count = 0

            while True:
                cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
                if keys:
                    deleted_count += await redis_client.delete(*keys)
                if cursor == 0:
                    break

            logger.info(
                "tenant_permissions_updated",
                admin_user=admin_payload.get("user_id"),
                tenant_id=tenant_id,
                updated_agents=updated_agents,
                updated_tools=updated_tools,
                cache_keys_deleted=deleted_count,
            )

        return MessageResponse(
            message="Successfully updated tenant permissions",
            details={
                "tenant_id": tenant_id,
                "updated_agents": updated_agents,
                "updated_tools": updated_tools,
                "cache_invalidated": True,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "update_tenant_permissions_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update tenant permissions: {str(e)}"
        )

# ============================================================================
# FULL TENANT CREATION ENDPOINT
# ============================================================================

@router.post("/tenants/create-new", response_model=TenantFullResponse, status_code=201)
async def create_tenant_full(
    request: TenantFullCreateRequest,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> TenantFullResponse:
    """
    Create a new tenant with LLM config and permissions in one request.
    
    Requires admin role in JWT.
    """
    try:
        # 1. Validate domain doesn't exist
        existing = db.query(Tenant).filter(Tenant.domain == request.domain).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Domain '{request.domain}' already exists")
        
        # 2. Validate LLM model exists
        llm_model = db.query(LLMModel).filter(
            LLMModel.provider == request.llm_config.provider,
            LLMModel.model_name == request.llm_config.model_name
        ).first()
        
        if not llm_model:
            raise HTTPException(
                status_code=404,
                detail=f"LLM model not found: {request.llm_config.provider}/{request.llm_config.model_name}"
            )
        
        # 3. Create tenant
        tenant_id = uuid.uuid4()
        tenant = Tenant(
            tenant_id=tenant_id,
            name=request.name,
            domain=request.domain,
            status=request.status,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(tenant)
        
        # 4. Create LLM config with encrypted API key
        encrypted_key = encrypt_api_key(request.llm_config.api_key)
        llm_config = TenantLLMConfig(
            tenant_id=tenant_id,
            llm_model_id=llm_model.llm_model_id,
            encrypted_api_key=encrypted_key,
            rate_limit_rpm=request.llm_config.rate_limit_rpm,
            rate_limit_tpm=request.llm_config.rate_limit_tpm,
        )
        db.add(llm_config)
        
        # 5. Create agent permissions
        enabled_agents = 0
        for agent_id in request.agent_ids:
            if db.query(AgentConfig).filter(AgentConfig.agent_id == agent_id).first():
                db.add(TenantAgentPermission(
                    tenant_id=tenant_id,
                    agent_id=uuid.UUID(agent_id),
                    enabled=True
                ))
                enabled_agents += 1
        
        # 6. Create tool permissions
        enabled_tools = 0
        for tool_id in request.tool_ids:
            if db.query(ToolConfig).filter(ToolConfig.tool_id == tool_id).first():
                db.add(TenantToolPermission(
                    tenant_id=tenant_id,
                    tool_id=uuid.UUID(tool_id),
                    enabled=True
                ))
                enabled_tools += 1
        
        db.commit()
        
        logger.info(
            "tenant_full_created",
            admin_user=admin_payload.get("user_id"),
            tenant_id=str(tenant_id),
            domain=request.domain,
            enabled_agents=enabled_agents,
            enabled_tools=enabled_tools,
        )
        
        return TenantFullResponse(
            tenant_id=str(tenant_id),
            name=request.name,
            domain=request.domain,
            status=request.status,
            llm_config_id=str(llm_config.config_id),
            enabled_agents=enabled_agents,
            enabled_tools=enabled_tools,
            created_at=tenant.created_at,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("create_tenant_full_error", admin_user=admin_payload.get("user_id"), error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create tenant: {str(e)}")