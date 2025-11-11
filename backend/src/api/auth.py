"""Authentication API endpoints for user login and management."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, select
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import bcrypt
import uuid
from datetime import datetime, timedelta

from src.config import settings, get_db
from src.models.user import User
from src.models.tenant import Tenant
from src.middleware.auth import require_admin_role, get_current_user
from src.utils.logging import get_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)


# ============================================================================
# Pydantic Models (Request/Response Schemas)
# ============================================================================

class LoginRequest(BaseModel):
    """Login request with email and password."""
    email: str
    password: str
    tenant_id: str  # Required for multi-tenant login


class LoginResponse(BaseModel):
    """Login response with user info and token."""
    user_id: str
    email: str
    username: str
    display_name: Optional[str]
    role: str
    tenant_id: str
    # Note: Token generation requires private key - MVP uses mock token
    token: str = None
    status: str = "active"

    class Config:
        from_attributes = True


class CreateUserRequest(BaseModel):
    """Create new user (admin only)."""
    email: EmailStr
    username: str
    password: str
    display_name: Optional[str] = None
    role: str  # 'tenant_user', 'staff', 'admin'
    tenant_id: str


class UpdateUserRequest(BaseModel):
    """Update user details (admin only)."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    status: Optional[str] = None  # 'active', 'inactive', 'suspended'


class UserResponse(BaseModel):
    """User response schema."""
    user_id: str
    email: str
    username: str
    display_name: Optional[str]
    role: str
    status: str
    tenant_id: str
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    """Change password request."""
    old_password: str
    new_password: str


# ============================================================================
# Password Hashing Utilities
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against hash.

    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hash

    Returns:
        True if password matches hash
    """
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def generate_token(user_id: str, tenant_id: str, role: str) -> str:
    """
    Generate JWT token for user.

    Note: MVP version uses mock token.
    Production should use RS256 private key.

    Args:
        user_id: User UUID
        tenant_id: Tenant UUID
        role: User role

    Returns:
        JWT token string
    """
    # MVP: Generate simple mock token
    # TODO: Implement proper RS256 token generation with private key
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "roles": [role],
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }

    # For MVP, return a simple token that represents the payload
    # In production, this should be signed with RS256 private key
    mock_token = f"mock_jwt.{user_id}.{tenant_id}.{role}"
    logger.warning(
        "using_mock_token",
        user_id=user_id,
        reason="MVP - implement RS256 private key signing"
    )

    return mock_token


# ============================================================================
# Authentication Endpoints
# ============================================================================

@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
) -> LoginResponse:
    """
    User login endpoint.

    Validates email/password and returns user info with token.

    Args:
        request: Login credentials
        db: Database session

    Returns:
        LoginResponse with user info and token

    Raises:
        HTTPException: If credentials invalid or user not found
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == request.tenant_id).first()
        if not tenant:
            logger.warning(
                "login_failed",
                email=request.email,
                reason="tenant_not_found",
                tenant_id=request.tenant_id
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        # Find user by email (scoped to tenant)
        user = db.query(User).filter(
            and_(
                User.tenant_id == request.tenant_id,
                User.email == request.email
            )
        ).first()

        if not user:
            logger.warning(
                "login_failed",
                email=request.email,
                tenant_id=request.tenant_id,
                reason="user_not_found"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Verify password
        if not verify_password(request.password, user.password_hash):
            logger.warning(
                "login_failed",
                email=request.email,
                user_id=str(user.user_id),
                reason="invalid_password"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Check user status
        if user.status != "active":
            logger.warning(
                "login_failed",
                email=request.email,
                user_id=str(user.user_id),
                reason=f"user_status_{user.status}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {user.status}"
            )

        # Update last login
        user.last_login = datetime.utcnow()
        db.add(user)
        db.commit()

        # Generate token
        token = generate_token(str(user.user_id), request.tenant_id, user.role)

        logger.info(
            "user_login_successful",
            user_id=str(user.user_id),
            email=request.email,
            tenant_id=request.tenant_id,
            role=user.role
        )

        return LoginResponse(
            user_id=str(user.user_id),
            email=user.email,
            username=user.username,
            display_name=user.display_name,
            role=user.role,
            tenant_id=request.tenant_id,
            token=token,
            status=user.status
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "login_error",
            error=str(e),
            email=request.email,
            tenant_id=request.tenant_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


# ============================================================================
# User Management Endpoints (Admin Only)
# ============================================================================

@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_role)]
)
def create_user(
    request: CreateUserRequest,
    admin_payload: dict = Depends(require_admin_role),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Create new user (admin only).

    Admin must belong to same tenant as new user.

    Args:
        request: User creation details
        admin_payload: Verified admin JWT payload
        db: Database session

    Returns:
        Created user details

    Raises:
        HTTPException: If validation fails
    """
    try:
        # Verify admin is from same tenant
        admin_tenant_id = admin_payload.get("tenant_id")
        if admin_tenant_id != request.tenant_id:
            logger.warning(
                "create_user_denied",
                admin_tenant_id=admin_tenant_id,
                target_tenant_id=request.tenant_id,
                reason="tenant_mismatch"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only create users in your tenant"
            )

        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == request.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        # Check if user already exists
        existing_user = db.query(User).filter(
            and_(
                User.tenant_id == request.tenant_id,
                User.email == request.email
            )
        ).first()

        if existing_user:
            logger.warning(
                "create_user_failed",
                email=request.email,
                tenant_id=request.tenant_id,
                reason="user_already_exists"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )

        # Create new user
        new_user = User(
            user_id=uuid.uuid4(),
            tenant_id=request.tenant_id,
            email=request.email,
            username=request.username,
            password_hash=hash_password(request.password),
            role=request.role,
            display_name=request.display_name,
            status="active",
            created_by=uuid.UUID(admin_payload.get("sub")),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(
            "user_created",
            user_id=str(new_user.user_id),
            email=new_user.email,
            role=new_user.role,
            tenant_id=request.tenant_id,
            created_by=admin_payload.get("sub")
        )

        return UserResponse.from_orm(new_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "create_user_error",
            error=str(e),
            email=request.email,
            tenant_id=request.tenant_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_admin_role)]
)
def get_user(
    user_id: str,
    admin_payload: dict = Depends(require_admin_role),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Get user details (admin only).

    Admin can only view users in their tenant.

    Args:
        user_id: User ID to retrieve
        admin_payload: Verified admin JWT payload
        db: Database session

    Returns:
        User details

    Raises:
        HTTPException: If user not found or access denied
    """
    try:
        admin_tenant_id = admin_payload.get("tenant_id")

        user = db.query(User).filter(User.user_id == uuid.UUID(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify admin can access this user
        if str(user.tenant_id) != admin_tenant_id:
            logger.warning(
                "get_user_denied",
                admin_tenant_id=admin_tenant_id,
                user_tenant_id=str(user.tenant_id),
                reason="tenant_mismatch"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        return UserResponse.from_orm(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_user_error",
            error=str(e),
            user_id=user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_admin_role)]
)
def update_user(
    user_id: str,
    request: UpdateUserRequest,
    admin_payload: dict = Depends(require_admin_role),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Update user details (admin only).

    Admin can only update users in their tenant.

    Args:
        user_id: User ID to update
        request: Fields to update
        admin_payload: Verified admin JWT payload
        db: Database session

    Returns:
        Updated user details

    Raises:
        HTTPException: If user not found or access denied
    """
    try:
        admin_tenant_id = admin_payload.get("tenant_id")

        user = db.query(User).filter(User.user_id == uuid.UUID(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify admin can access this user
        if str(user.tenant_id) != admin_tenant_id:
            logger.warning(
                "update_user_denied",
                admin_tenant_id=admin_tenant_id,
                user_tenant_id=str(user.tenant_id),
                reason="tenant_mismatch"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Update fields
        if request.email:
            user.email = request.email
        if request.username:
            user.username = request.username
        if request.display_name:
            user.display_name = request.display_name
        if request.status:
            user.status = request.status

        user.updated_at = datetime.utcnow()

        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(
            "user_updated",
            user_id=user_id,
            updated_by=admin_payload.get("sub")
        )

        return UserResponse.from_orm(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "update_user_error",
            error=str(e),
            user_id=user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_role)]
)
def delete_user(
    user_id: str,
    admin_payload: dict = Depends(require_admin_role),
    db: Session = Depends(get_db)
):
    """
    Delete user (admin only).

    Admin can only delete users in their tenant.

    Args:
        user_id: User ID to delete
        admin_payload: Verified admin JWT payload
        db: Database session

    Raises:
        HTTPException: If user not found or access denied
    """
    try:
        admin_tenant_id = admin_payload.get("tenant_id")

        user = db.query(User).filter(User.user_id == uuid.UUID(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify admin can access this user
        if str(user.tenant_id) != admin_tenant_id:
            logger.warning(
                "delete_user_denied",
                admin_tenant_id=admin_tenant_id,
                user_tenant_id=str(user.tenant_id),
                reason="tenant_mismatch"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        db.delete(user)
        db.commit()

        logger.info(
            "user_deleted",
            user_id=user_id,
            deleted_by=admin_payload.get("sub")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "delete_user_error",
            error=str(e),
            user_id=user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )


@router.get(
    "/users",
    response_model=dict,
    dependencies=[Depends(require_admin_role)]
)
def list_users(
    tenant_id: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role)
):
    """
    List all users with optional filtering.

    Query Parameters:
        tenant_id: Filter by tenant (optional)
        role: Filter by role (tenant_user, staff, admin) (optional)
        status_filter: Filter by status (active, inactive, suspended) (optional)
        skip: Number of records to skip (default: 0)
        limit: Max records to return (default: 100)

    Returns:
        List of users with total count

    Raises:
        HTTPException: If admin not authorized
    """
    try:
        query = db.query(User)

        # Apply filters
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
        if role:
            query = query.filter(User.role == role)
        if status_filter:
            query = query.filter(User.status == status_filter)

        # Get total count
        total = query.count()

        # Apply pagination
        users = query.offset(skip).limit(limit).all()

        logger.info(
            "list_users",
            tenant_id=tenant_id,
            role=role,
            status=status_filter,
            count=len(users),
            total=total
        )

        return {
            "success": True,
            "users": [
                {
                    "user_id": str(u.user_id),
                    "email": u.email,
                    "username": u.username,
                    "display_name": u.display_name,
                    "role": u.role,
                    "status": u.status,
                    "tenant_id": str(u.tenant_id),
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                    "last_login": u.last_login.isoformat() if u.last_login else None,
                }
                for u in users
            ],
            "total": total,
            "skip": skip,
            "limit": limit
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "list_users_error",
            error=str(e),
            tenant_id=tenant_id,
            role=role
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users"
        )


@router.get(
    "/users/tenant/{tenant_id}",
    response_model=dict,
    dependencies=[Depends(require_admin_role)]
)
def list_tenant_users(
    tenant_id: str,
    role: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role)
):
    """
    List all users for a specific tenant.

    Args:
        tenant_id: Tenant UUID
        role: Optional role filter (tenant_user, staff, admin)
        skip: Number of records to skip
        limit: Max records to return

    Returns:
        List of users for the tenant
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        query = db.query(User).filter(User.tenant_id == tenant_id)

        if role:
            query = query.filter(User.role == role)

        total = query.count()
        users = query.offset(skip).limit(limit).all()

        logger.info(
            "list_tenant_users",
            tenant_id=tenant_id,
            role=role,
            count=len(users)
        )

        return {
            "success": True,
            "tenant_id": tenant_id,
            "users": [
                {
                    "user_id": str(u.user_id),
                    "email": u.email,
                    "username": u.username,
                    "display_name": u.display_name,
                    "role": u.role,
                    "status": u.status,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                    "last_login": u.last_login.isoformat() if u.last_login else None,
                }
                for u in users
            ],
            "total": total,
            "skip": skip,
            "limit": limit
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "list_tenant_users_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list tenant users"
        )


@router.post(
    "/change-password",
    response_model=dict,
    dependencies=[Depends(get_current_user)]
)
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password for logged-in user.

    Args:
        request: Old and new password
        current_user: Current user JWT payload
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If old password incorrect
    """
    try:
        user_id = uuid.UUID(current_user.get("sub"))

        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify old password
        if not verify_password(request.old_password, user.password_hash):
            logger.warning(
                "change_password_failed",
                user_id=str(user_id),
                reason="invalid_old_password"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid old password"
            )

        # Update password
        user.password_hash = hash_password(request.new_password)
        user.updated_at = datetime.utcnow()

        db.add(user)
        db.commit()

        logger.info(
            "password_changed",
            user_id=str(user_id)
        )

        return {"detail": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "change_password_error",
            error=str(e),
            user_id=current_user.get("sub")
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )
