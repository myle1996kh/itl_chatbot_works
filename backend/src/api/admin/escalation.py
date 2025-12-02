"""Admin API endpoints for escalation management."""
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body
from sqlalchemy.orm import Session
from src.config import get_db
from src.models.session import ChatSession
## Supporter model removed; using User for assignment
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
from src.middleware.auth import require_admin_role, require_staff_role, get_current_user
from src.utils.logging import get_logger

logger = get_logger(__name__)


# ============================================================================
# SUPPORTER CRUD SCHEMAS
# ============================================================================

class CreateSupporterRequest(BaseModel):
    """Create a new supporter from an existing user."""
    user_id: str  # UUID of existing user with role='supporter'
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
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
    request: EscalationRequest = Body(...),
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
            session_id=str(session.session_id),
            tenant_id=str(session.tenant_id),
            user_id=str(session.user_id) if session.user_id else None,
            escalation_status=session.escalation_status,
            escalation_reason=session.escalation_reason,
            assigned_user_id=str(session.assigned_user_id) if session.assigned_user_id else None,
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
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
    request: EscalationAssignRequest = Body(...),
) -> EscalationResponse:
    """
    Assign a staff user to an escalated session.

    Changes escalation status from 'pending' to 'assigned' and associates
    the session with a specific supporter.

    Args:
        tenant_id: UUID of the tenant
        request: EscalationAssignRequest with session_id and user_id
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

        # Assign the user
        result = escalation_service.assign_user(
            db=db,
            session_id=request.session_id,
            tenant_id=tenant_id,
            user_id=request.user_id
        )

        if not result["success"]:
            logger.warning(
                "assign_user_failed",
                session_id=request.session_id,
                user_id=request.user_id,
                reason=result.get("error")
            )
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to assign user")
            )

        # Fetch and return the escalation response
        session = db.query(ChatSession).filter(
            ChatSession.session_id == request.session_id
        ).first()

        return EscalationResponse(
            session_id=str(session.session_id),
            tenant_id=str(session.tenant_id),
            user_id=str(session.user_id) if session.user_id else None,
            escalation_status=session.escalation_status,
            escalation_reason=session.escalation_reason,
            assigned_user_id=str(session.assigned_user_id) if session.assigned_user_id else None,
            escalation_requested_at=session.escalation_requested_at,
            escalation_assigned_at=session.escalation_assigned_at,
            created_at=session.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "assign_user_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to assign user: {str(e)}"
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
    db: Session = Depends(get_db),
    staff_payload: dict = Depends(require_staff_role),
    request: EscalationResolveRequest = Body(...),
) -> EscalationResponse:
    """
    Mark an escalation as resolved.

    Changes escalation status from 'pending' or 'assigned' to 'resolved'.
    Optionally records resolution notes.

    Available to both admin and supporter roles. Supporters can only resolve
    sessions that are assigned to them.

    Args:
        tenant_id: UUID of the tenant
        request: EscalationResolveRequest with session_id and optional resolution_notes
        db: Database session
        staff_payload: JWT payload with admin or supporter role

    Returns:
        EscalationResponse with updated escalation details

    Raises:
        HTTPException: If session not found, not escalated, or supporter lacks permission
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("resolve_escalation_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Fetch session to check ownership for supporters
        session = db.query(ChatSession).filter(
            ChatSession.session_id == request.session_id
        ).first()

        if not session:
            logger.warning("resolve_escalation_session_not_found", session_id=request.session_id)
            raise HTTPException(status_code=404, detail="Session not found")

        # Ownership validation: supporters can only resolve their own assigned sessions
        user_roles = staff_payload.get("roles", [])
        user_id = staff_payload.get("sub")

        if "supporter" in user_roles and "admin" not in user_roles:
            # This is a supporter (not admin)
            if str(session.assigned_user_id) != user_id:
                logger.warning(
                    "resolve_escalation_ownership_denied",
                    supporter_id=user_id,
                    assigned_user_id=str(session.assigned_user_id) if session.assigned_user_id else None,
                    session_id=request.session_id
                )
                raise HTTPException(
                    status_code=403,
                    detail="Supporters can only resolve sessions assigned to them"
                )

            logger.debug(
                "resolve_escalation_supporter_ownership_verified",
                supporter_id=user_id,
                session_id=request.session_id
            )

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

        # Refresh session from DB to get updated escalation status
        db.refresh(session)

        logger.info(
            "escalation_resolved_by_staff",
            session_id=request.session_id,
            staff_id=user_id,
            staff_roles=user_roles,
            tenant_id=tenant_id
        )

        return EscalationResponse(
            session_id=str(session.session_id),
            tenant_id=str(session.tenant_id),
            user_id=str(session.user_id) if session.user_id else None,
            escalation_status=session.escalation_status,
            escalation_reason=session.escalation_reason,
            assigned_user_id=str(session.assigned_user_id) if session.assigned_user_id else None,
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
                session_id=str(esc.session_id),
                tenant_id=str(esc.tenant_id),
                user_id=str(esc.user_id) if esc.user_id else None,
                escalation_status=esc.escalation_status,
                escalation_reason=esc.escalation_reason,
                assigned_user_id=str(esc.assigned_user_id) if esc.assigned_user_id else None,
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
    "/tenants/{tenant_id}/staff",
    status_code=200
)
async def get_staff(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Get list of supporters for a tenant.
    Returns all supporters eligible for escalation assignment.

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
            logger.warning("get_staff_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        staff = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role == 'supporter'
        ).all()

        logger.debug("staff_retrieved", tenant_id=tenant_id, count=len(staff))

        return {
            "success": True,
            "staff": [
                {
                    "user_id": str(u.user_id),
                    "email": u.email,
                    "username": u.username,
                    "display_name": u.display_name,
                    "supporter_status": u.supporter_status,
                    "max_concurrent_sessions": u.max_concurrent_sessions,
                    "current_sessions_count": u.current_sessions_count,
                    "available": u.supporter_status in ['online', 'available'] and u.current_sessions_count < u.max_concurrent_sessions,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in staff
            ],
            "total": len(staff),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_staff_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get staff: {str(e)}"
        )


@router.get(
    "/tenants/{tenant_id}/staff/available",
    status_code=200
)
async def get_available_staff(
    tenant_id: str = Path(..., description="UUID of the tenant"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Get list of available supporters for a tenant.

    Returns only supporters who are:
    - Online or available
    - Not at capacity (current_sessions_count < max_concurrent_sessions)

    Args:
        tenant_id: UUID of the tenant
        db: Database session
        admin_payload: JWT payload with admin role

    Returns:
        List of available staff, sorted by current session count (ascending)

    Raises:
        HTTPException: If tenant not found
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            logger.warning("get_available_staff_invalid_tenant", tenant_id=tenant_id)
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get available staff using service
        available_staff = escalation_service.find_available_staff(db, tenant_id)

        logger.debug("available_staff_retrieved", tenant_id=tenant_id, count=len(available_staff))

        return {
            "success": True,
            "available_staff": [
                {
                    "user_id": str(u.user_id),
                    "email": u.email,
                    "username": u.username,
                    "display_name": u.display_name,
                    "supporter_status": u.supporter_status,
                    "max_concurrent_sessions": u.max_concurrent_sessions,
                    "current_sessions_count": u.current_sessions_count,
                    "capacity_percentage": int((u.current_sessions_count / u.max_concurrent_sessions) * 100),
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in available_staff
            ],
            "total": len(available_staff),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_available_staff_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get available staff: {str(e)}"
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
    """Deprecated: supporters removed. Use staff user management."""
    raise HTTPException(status_code=410, detail="Supporter API deprecated. Use staff users.")


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
    """Deprecated: supporters removed. Use staff user management."""
    raise HTTPException(status_code=410, detail="Supporter API deprecated. Use staff users.")


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
    """Deprecated: supporters removed. Use staff user management."""
    raise HTTPException(status_code=410, detail="Supporter API deprecated. Use staff users.")
