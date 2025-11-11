"""Admin API endpoints for escalation management."""
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from src.config import get_db
from src.models.session import ChatSession
from src.models.supporter import Supporter
from src.models.tenant import Tenant
from src.models.user import User
from src.schemas.admin import (
    EscalationRequest,
    EscalationAssignRequest,
    EscalationResolveRequest,
    EscalationResponse,
    EscalationQueueResponse,
    AutoEscalationDetectionRequest,
    AutoEscalationDetectionResponse,
    MessageResponse,
)
from pydantic import BaseModel, EmailStr
from typing import Optional as OptionalType
from src.services.escalation_service import get_escalation_service
from src.middleware.auth import require_admin_role, get_current_user
from src.utils.logging import get_logger

logger = get_logger(__name__)


# ============================================================================
# SUPPORTER CRUD SCHEMAS
# ============================================================================

class CreateSupporterRequest(BaseModel):
    """Create a new supporter from an existing user."""
    user_id: str  # UUID of existing user with role='staff'
    max_concurrent_sessions: OptionalType[int] = 5


class UpdateSupporterRequest(BaseModel):
    """Update supporter settings."""
    status: OptionalType[str] = None  # 'online', 'offline', 'busy', 'away'
    max_concurrent_sessions: OptionalType[int] = None


class SupporterResponse(BaseModel):
    """Supporter response schema."""
    supporter_id: str
    user_id: str
    tenant_id: str
    email: str
    username: str
    display_name: OptionalType[str]
    status: str
    max_concurrent_sessions: int
    current_sessions_count: int
    created_at: OptionalType[str]
    updated_at: OptionalType[str]

    class Config:
        from_attributes = True


router = APIRouter(prefix="/api/admin", tags=["admin-escalations"])
escalation_service = get_escalation_service()


# ============================================================================
# AUTO-ESCALATION DETECTION ENDPOINTS
# ============================================================================


@router.post(
    "/escalations/detect",
    response_model=AutoEscalationDetectionResponse,
    status_code=200
)
async def detect_auto_escalation(
    request: AutoEscalationDetectionRequest,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> AutoEscalationDetectionResponse:
    """
    Check if a message should trigger auto-escalation.

    Analyzes the message for escalation keywords and returns detection results.
    This endpoint is useful for testing and monitoring auto-escalation logic.

    Args:
        request: AutoEscalationDetectionRequest with message and optional custom keywords
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        AutoEscalationDetectionResponse with detection results
    """
    try:
        result = escalation_service.detect_auto_escalation(
            message=request.message,
            custom_keywords=request.keywords
        )

        logger.info(
            "auto_escalation_detected",
            should_escalate=result["should_escalate"],
            confidence=result["confidence"]
        )

        return AutoEscalationDetectionResponse(
            should_escalate=result["should_escalate"],
            detected_keywords=result["detected_keywords"],
            confidence=result["confidence"],
            reason=result["reason"],
        )

    except Exception as e:
        logger.error(
            "detect_auto_escalation_failed",
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to detect auto-escalation: {str(e)}"
        )


# ============================================================================
# MANUAL ESCALATION ENDPOINTS
# ============================================================================


@router.post(
    "/tenants/{tenant_id}/escalations",
    response_model=EscalationResponse,
    status_code=201
)
async def escalate_session(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    request: EscalationRequest = None,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> EscalationResponse:
    """
    Escalate a chat session to require human support.

    Creates an escalation request for a session. Can be triggered manually
    (user requests support) or automatically (system detected keywords).

    Args:
        tenant_id: UUID of the tenant
        request: EscalationRequest with session_id, reason, auto_detected flag
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        EscalationResponse with escalation details

    Raises:
        HTTPException: If session not found or already escalated
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("escalate_session_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Escalate the session
        result = escalation_service.escalate_session(
            db=db,
            session_id=request.session_id,
            tenant_id=tenant_id,
            reason=request.reason,
            auto_detected=request.auto_detected,
            keywords=request.keywords
        )

        if not result["success"]:
            logger.warning(
                "escalate_session_failed",
                session_id=request.session_id,
                reason=result.get("error")
            )
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to escalate session")
            )

        # Fetch and return the escalation response
        session = db.query(ChatSession).filter(
            ChatSession.session_id == request.session_id
        ).first()

        return EscalationResponse(
            session_id=session.session_id,
            tenant_id=session.tenant_id,
            user_id=session.user_id,
            escalation_status=session.escalation_status,
            escalation_reason=session.escalation_reason,
            assigned_supporter_id=session.assigned_supporter_id,
            escalation_requested_at=session.escalation_requested_at,
            escalation_assigned_at=session.escalation_assigned_at,
            created_at=session.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "escalate_session_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to escalate session: {str(e)}"
        )


# ============================================================================
# SUPPORTER ASSIGNMENT ENDPOINTS
# ============================================================================


@router.post(
    "/tenants/{tenant_id}/escalations/assign",
    response_model=EscalationResponse,
    status_code=200
)
async def assign_supporter(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    request: EscalationAssignRequest = None,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> EscalationResponse:
    """
    Assign a supporter to an escalated session.

    Changes escalation status from 'pending' to 'assigned' and associates
    the session with a specific supporter.

    Args:
        tenant_id: UUID of the tenant
        request: EscalationAssignRequest with session_id and supporter_id
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        EscalationResponse with updated escalation details

    Raises:
        HTTPException: If session not found or supporter not available
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("assign_supporter_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Assign the supporter
        result = escalation_service.assign_supporter(
            db=db,
            session_id=request.session_id,
            tenant_id=tenant_id,
            supporter_id=request.supporter_id
        )

        if not result["success"]:
            logger.warning(
                "assign_supporter_failed",
                session_id=request.session_id,
                supporter_id=request.supporter_id,
                reason=result.get("error")
            )
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to assign supporter")
            )

        # Fetch and return the escalation response
        session = db.query(ChatSession).filter(
            ChatSession.session_id == request.session_id
        ).first()

        return EscalationResponse(
            session_id=session.session_id,
            tenant_id=session.tenant_id,
            user_id=session.user_id,
            escalation_status=session.escalation_status,
            escalation_reason=session.escalation_reason,
            assigned_supporter_id=session.assigned_supporter_id,
            escalation_requested_at=session.escalation_requested_at,
            escalation_assigned_at=session.escalation_assigned_at,
            created_at=session.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "assign_supporter_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to assign supporter: {str(e)}"
        )


# ============================================================================
# ESCALATION RESOLUTION ENDPOINTS
# ============================================================================


@router.post(
    "/tenants/{tenant_id}/escalations/resolve",
    response_model=EscalationResponse,
    status_code=200
)
async def resolve_escalation(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    request: EscalationResolveRequest = None,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> EscalationResponse:
    """
    Mark an escalation as resolved.

    Changes escalation status from 'pending' or 'assigned' to 'resolved'.
    Optionally records resolution notes.

    Args:
        tenant_id: UUID of the tenant
        request: EscalationResolveRequest with session_id and optional resolution_notes
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        EscalationResponse with updated escalation details

    Raises:
        HTTPException: If session not found or not escalated
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("resolve_escalation_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Resolve the escalation
        result = escalation_service.resolve_escalation(
            db=db,
            session_id=request.session_id,
            tenant_id=tenant_id,
            resolution_notes=request.resolution_notes
        )

        if not result["success"]:
            logger.warning(
                "resolve_escalation_failed",
                session_id=request.session_id,
                reason=result.get("error")
            )
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to resolve escalation")
            )

        # Fetch and return the escalation response
        session = db.query(ChatSession).filter(
            ChatSession.session_id == request.session_id
        ).first()

        return EscalationResponse(
            session_id=session.session_id,
            tenant_id=session.tenant_id,
            user_id=session.user_id,
            escalation_status=session.escalation_status,
            escalation_reason=session.escalation_reason,
            assigned_supporter_id=session.assigned_supporter_id,
            escalation_requested_at=session.escalation_requested_at,
            escalation_assigned_at=session.escalation_assigned_at,
            created_at=session.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "resolve_escalation_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resolve escalation: {str(e)}"
        )


# ============================================================================
# ESCALATION QUEUE ENDPOINTS
# ============================================================================


@router.get(
    "/tenants/{tenant_id}/escalations",
    response_model=EscalationQueueResponse,
    status_code=200
)
async def get_escalation_queue(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    status: Optional[str] = Query(
        None,
        description="Filter by escalation status (pending, assigned, resolved)"
    ),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> EscalationQueueResponse:
    """
    Get escalation queue for a tenant.

    Returns all escalated sessions with optional filtering by status.
    Admin-only endpoint for managing escalations.

    Args:
        tenant_id: UUID of the tenant
        status: Optional filter by escalation status
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        EscalationQueueResponse with escalation queue and counts

    Raises:
        HTTPException: If tenant not found
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("get_escalation_queue_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get the escalation queue
        result = escalation_service.get_escalation_queue(
            db=db,
            tenant_id=tenant_id,
            status=status
        )

        if not result["success"]:
            logger.error(
                "get_escalation_queue_failed",
                tenant_id=tenant_id,
                reason=result.get("error")
            )
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to get escalation queue")
            )

        # Convert escalations to response objects
        escalations = [
            EscalationResponse(
                session_id=esc.session_id,
                tenant_id=esc.tenant_id,
                user_id=esc.user_id,
                escalation_status=esc.escalation_status,
                escalation_reason=esc.escalation_reason,
                assigned_supporter_id=esc.assigned_supporter_id,
                escalation_requested_at=esc.escalation_requested_at,
                escalation_assigned_at=esc.escalation_assigned_at,
                created_at=esc.created_at,
            )
            for esc in result["escalations"]
        ]

        return EscalationQueueResponse(
            pending_count=result["pending_count"],
            assigned_count=result["assigned_count"],
            resolved_count=result["resolved_count"],
            escalations=escalations,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_escalation_queue_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get escalation queue: {str(e)}"
        )


# ============================================================================
# SUPPORTER MANAGEMENT ENDPOINTS
# ============================================================================


@router.get(
    "/tenants/{tenant_id}/supporters",
    status_code=200
)
async def get_supporters(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Get list of supporters for a tenant.

    Returns all supporters assigned to the tenant. Useful for UI dropdowns
    when assigning supporters to escalated sessions.

    Args:
        tenant_id: UUID of the tenant
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        List of supporter details

    Raises:
        HTTPException: If tenant not found
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("get_supporters_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get supporters
        supporters = db.query(Supporter).filter(
            Supporter.tenant_id == tenant_id
        ).all()

        logger.debug(
            "supporters_retrieved",
            tenant_id=tenant_id,
            count=len(supporters)
        )

        return {
            "success": True,
            "supporters": [
                {
                    "supporter_id": s.supporter_id,
                    "email": s.email,
                    "username": s.username,
                    "display_name": s.display_name,
                    "status": s.status,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                }
                for s in supporters
            ],
            "total": len(supporters),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_supporters_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get supporters: {str(e)}"
        )


# ============================================================================
# SUPPORTER CRUD ENDPOINTS
# ============================================================================

@router.post(
    "/tenants/{tenant_id}/supporters",
    response_model=dict,
    status_code=201
)
async def create_supporter(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    request: CreateSupporterRequest = None,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Create a new supporter for a tenant.

    Creates a Supporter record linked to an existing User with role='staff'.

    Args:
        tenant_id: Tenant UUID
        request: CreateSupporterRequest with user_id and max_concurrent_sessions
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        Created supporter data

    Raises:
        HTTPException: If user not found, user not staff, or supporter already exists
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Verify user exists and is staff role
        user = db.query(User).filter(User.user_id == request.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.role != 'staff':
            raise HTTPException(
                status_code=400,
                detail=f"User must have 'staff' role, but has '{user.role}'"
            )

        # Check if supporter already exists for this user
        existing = db.query(Supporter).filter(
            Supporter.user_id == request.user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Supporter already exists for this user"
            )

        # Create new supporter
        supporter = Supporter(
            supporter_id=str(uuid.uuid4()),
            user_id=request.user_id,
            tenant_id=tenant_id,
            status='offline',
            max_concurrent_sessions=request.max_concurrent_sessions or 5,
            current_sessions_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(supporter)
        db.commit()
        db.refresh(supporter)

        logger.info(
            "supporter_created",
            tenant_id=tenant_id,
            supporter_id=str(supporter.supporter_id),
            user_id=str(request.user_id)
        )

        return {
            "success": True,
            "supporter": {
                "supporter_id": str(supporter.supporter_id),
                "user_id": str(supporter.user_id),
                "tenant_id": str(supporter.tenant_id),
                "email": user.email,
                "username": user.username,
                "display_name": user.display_name,
                "status": supporter.status,
                "max_concurrent_sessions": supporter.max_concurrent_sessions,
                "current_sessions_count": supporter.current_sessions_count,
                "created_at": supporter.created_at.isoformat() if supporter.created_at else None,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "create_supporter_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create supporter: {str(e)}"
        )


@router.put(
    "/tenants/{tenant_id}/supporters/{supporter_id}",
    response_model=dict,
    status_code=200
)
async def update_supporter(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    supporter_id: str = Path(..., description="UUID of the supporter"),
    request: UpdateSupporterRequest = None,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Update supporter settings.

    Args:
        tenant_id: Tenant UUID
        supporter_id: Supporter UUID
        request: UpdateSupporterRequest with fields to update
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        Updated supporter data

    Raises:
        HTTPException: If supporter not found or invalid status
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get supporter
        supporter = db.query(Supporter).filter(
            Supporter.supporter_id == supporter_id,
            Supporter.tenant_id == tenant_id
        ).first()

        if not supporter:
            raise HTTPException(status_code=404, detail="Supporter not found")

        # Validate status if provided
        if request.status:
            valid_statuses = ['online', 'offline', 'busy', 'away']
            if request.status not in valid_statuses:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                )
            supporter.status = request.status

        # Update max_concurrent_sessions if provided
        if request.max_concurrent_sessions is not None:
            if request.max_concurrent_sessions < 1:
                raise HTTPException(
                    status_code=400,
                    detail="max_concurrent_sessions must be >= 1"
                )
            supporter.max_concurrent_sessions = request.max_concurrent_sessions

        supporter.updated_at = datetime.utcnow()

        db.add(supporter)
        db.commit()
        db.refresh(supporter)

        # Get user info for response
        user = db.query(User).filter(User.user_id == supporter.user_id).first()

        logger.info(
            "supporter_updated",
            tenant_id=tenant_id,
            supporter_id=supporter_id
        )

        return {
            "success": True,
            "supporter": {
                "supporter_id": str(supporter.supporter_id),
                "user_id": str(supporter.user_id),
                "tenant_id": str(supporter.tenant_id),
                "email": user.email if user else None,
                "username": user.username if user else None,
                "display_name": user.display_name if user else None,
                "status": supporter.status,
                "max_concurrent_sessions": supporter.max_concurrent_sessions,
                "current_sessions_count": supporter.current_sessions_count,
                "updated_at": supporter.updated_at.isoformat() if supporter.updated_at else None,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "update_supporter_error",
            tenant_id=tenant_id,
            supporter_id=supporter_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update supporter: {str(e)}"
        )


@router.delete(
    "/tenants/{tenant_id}/supporters/{supporter_id}",
    response_model=dict,
    status_code=200
)
async def delete_supporter(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    supporter_id: str = Path(..., description="UUID of the supporter"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Delete a supporter.

    Args:
        tenant_id: Tenant UUID
        supporter_id: Supporter UUID
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        Success message

    Raises:
        HTTPException: If supporter not found or has active sessions
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get supporter
        supporter = db.query(Supporter).filter(
            Supporter.supporter_id == supporter_id,
            Supporter.tenant_id == tenant_id
        ).first()

        if not supporter:
            raise HTTPException(status_code=404, detail="Supporter not found")

        # Check if supporter has active sessions
        if supporter.current_sessions_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete supporter with {supporter.current_sessions_count} active sessions"
            )

        # Delete supporter
        db.delete(supporter)
        db.commit()

        logger.info(
            "supporter_deleted",
            tenant_id=tenant_id,
            supporter_id=supporter_id
        )

        return {
            "success": True,
            "detail": f"Supporter {supporter_id} deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "delete_supporter_error",
            tenant_id=tenant_id,
            supporter_id=supporter_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete supporter: {str(e)}"
        )
