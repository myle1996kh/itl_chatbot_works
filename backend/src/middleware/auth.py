"""JWT authentication middleware."""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any, Optional
from src.utils.jwt import decode_jwt, extract_tenant_id, extract_user_id
from src.utils.logging import get_logger
from src.config import settings

logger = get_logger(__name__)
security = HTTPBearer(auto_error=False)  # auto_error=False allows optional auth


def skip_auth_for_cors(request: Request) -> bool:
    """
    Check if request is a CORS preflight (OPTIONS) request.
    These should be handled by CORS middleware before auth checks.
    """
    return request.method == "OPTIONS"

# ⚠️ IMPORTANT: TEMPORARY AUTH BYPASS FOR TESTING ONLY
# TODO: REMOVE DISABLE_AUTH BEFORE PUSHING TO GITLAB/PRODUCTION
# When DISABLE_AUTH=True (testing mode):
#   - JWT authentication is bypassed
#   - Returns mock user data for dependencies
# When DISABLE_AUTH=False (production mode):
#   - Full JWT authentication is enforced
#   - Requires valid Bearer token


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Dependency to get current user from JWT token.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        JWT payload with user information

    Raises:
        HTTPException: If token is invalid or expired
    """
    # TESTING MODE: Bypass JWT authentication
    if settings.DISABLE_AUTH:
        # Only allow in development
        if settings.ENVIRONMENT == "production":
            logger.critical(
                "DISABLE_AUTH is true in production - REJECTING REQUEST",
                extra={"environment": settings.ENVIRONMENT}
            )
            raise HTTPException(
                status_code=500,
                detail="Authentication bypass not allowed in production"
            )

        logger.warning(
            "auth_bypassed",
            reason="DISABLE_AUTH=True (development only)",
            environment=settings.ENVIRONMENT
        )
        return {
            "sub": "test_user_001",
            # Align dev-bypass tenant with eTMS UUID used elsewhere
            "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded",
            "roles": ["admin"],
            "test_mode": True
        }

    # PRODUCTION MODE: Enforce JWT authentication
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = decode_jwt(token)

    # Log authentication
    logger.info(
        "user_authenticated",
        user_id=payload.get("sub"),
        tenant_id=payload.get("tenant_id")
    )

    return payload


async def get_current_tenant(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    Dependency to extract tenant_id from JWT token or request path.

    Args:
        request: FastAPI request object
        credentials: HTTP Bearer credentials

    Returns:
        Tenant ID string

    Raises:
        HTTPException: If token is invalid or tenant_id not found
    """
    # TESTING MODE: Extract tenant_id from request path
    if settings.DISABLE_AUTH:
        # Only allow in development
        if settings.ENVIRONMENT == "production":
            logger.critical(
                "DISABLE_AUTH is true in production - REJECTING REQUEST",
                extra={"environment": settings.ENVIRONMENT}
            )
            raise HTTPException(
                status_code=500,
                detail="Authentication bypass not allowed in production"
            )

        # Extract tenant_id from URL path: /api/{tenant_id}/...
        path_parts = request.url.path.split('/')
        if len(path_parts) > 2 and path_parts[1] == 'api':
            tenant_id = path_parts[2]
            # Validate UUID format
            try:
                from uuid import UUID
                UUID(tenant_id)  # Raises ValueError if invalid UUID
                logger.debug("auth_bypassed_using_path_tenant", tenant_id=tenant_id)
                return tenant_id
            except ValueError:
                pass

        # Fallback to eTMS tenant for testing if not valid UUID
        logger.warning(
            "tenant_auth_bypassed",
            reason="DISABLE_AUTH=True (development only)",
            environment=settings.ENVIRONMENT,
            fallback="eTMS"
        )
        return "3105b788-b5ff-4d56-88a9-532af4ab4ded"

    # PRODUCTION MODE: Extract from JWT
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = decode_jwt(token)
    tenant_id = extract_tenant_id(payload)

    return tenant_id


async def verify_tenant_access(
    tenant_id_path: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> bool:
    """
    Verify that JWT tenant_id matches path parameter tenant_id.

    Args:
        tenant_id_path: Tenant ID from path parameter
        credentials: HTTP Bearer credentials

    Returns:
        True if tenant_id matches

    Raises:
        HTTPException: If tenant_id mismatch (403 Forbidden)
    """
    # TESTING MODE: Allow all tenant access
    if settings.DISABLE_AUTH:
        # Only allow in development
        if settings.ENVIRONMENT == "production":
            logger.critical(
                "DISABLE_AUTH is true in production - REJECTING REQUEST",
                extra={"environment": settings.ENVIRONMENT}
            )
            raise HTTPException(
                status_code=500,
                detail="Authentication bypass not allowed in production"
            )

        logger.warning(
            "tenant_access_bypassed",
            reason="DISABLE_AUTH=True (development only)",
            environment=settings.ENVIRONMENT
        )
        return True

    # PRODUCTION MODE: Verify tenant access
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials

    # Handle mock JWT tokens (format: mock_jwt.{user_id}.{tenant_id}.{role})
    if token.startswith("mock_jwt."):
        parts = token.split(".")
        if len(parts) >= 3:
            tenant_id_jwt = parts[2]
            if tenant_id_path == tenant_id_jwt:
                logger.debug("tenant_access_verified_mock_token", tenant_id=tenant_id_path)
                return True
            else:
                logger.warning(
                    "tenant_access_denied_mock_token",
                    tenant_id_path=tenant_id_path,
                    tenant_id_jwt=tenant_id_jwt
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: tenant_id mismatch"
                )

    # Real RS256 JWT token
    payload = decode_jwt(token)
    tenant_id_jwt = extract_tenant_id(payload)

    if tenant_id_path != tenant_id_jwt:
        logger.warning(
            "tenant_access_denied",
            tenant_id_path=tenant_id_path,
            tenant_id_jwt=tenant_id_jwt,
            user_id=payload.get("sub")
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: tenant_id mismatch"
        )

    return True


async def require_admin_role(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Dependency to require admin role in JWT token.

    Skips auth checks for CORS preflight (OPTIONS) requests - these are handled
    by the CORS middleware which runs before auth dependencies.

    Args:
        request: FastAPI request object
        credentials: HTTP Bearer credentials

    Returns:
        JWT payload if user has admin role (or mock data for OPTIONS requests)

    Raises:
        HTTPException: If user doesn't have admin role (403 Forbidden)
    """
    # CORS PREFLIGHT: OPTIONS requests don't need auth
    # The CORS middleware handles these, so we just return mock data
    if request.method == "OPTIONS":
        logger.debug("Skipping auth for CORS preflight OPTIONS request")
        return {
            "sub": "cors_preflight",
            "roles": ["admin"],
            "cors_preflight": True
        }

    # TESTING MODE: Return mock admin user
    if settings.DISABLE_AUTH:
        # Only allow in development
        if settings.ENVIRONMENT == "production":
            logger.critical(
                "DISABLE_AUTH is true in production - REJECTING REQUEST",
                extra={"environment": settings.ENVIRONMENT}
            )
            raise HTTPException(
                status_code=500,
                detail="Authentication bypass not allowed in production"
            )

        logger.warning(
            "admin_auth_bypassed",
            reason="DISABLE_AUTH=True (development only)",
            environment=settings.ENVIRONMENT
        )
        return {
            "sub": "test_admin_001",
            # Align dev-bypass tenant with eTMS UUID used elsewhere
            "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded",
            "roles": ["admin"],
            "test_mode": True
        }

    # PRODUCTION MODE: Verify admin role
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials

    # Handle mock JWT tokens (format: mock_jwt.{user_id}.{tenant_id}.{role})
    if token.startswith("mock_jwt."):
        parts = token.split(".")
        logger.info(
            "mock_jwt_token_parsing",
            token_length=len(token),
            parts_count=len(parts),
            parts=parts[:4] if len(parts) >= 4 else parts
        )
        if len(parts) >= 4:
            user_id = parts[1]
            tenant_id = parts[2]
            role = parts[3]

            logger.info(
                "mock_token_parsed",
                user_id=user_id,
                tenant_id=tenant_id,
                role=role
            )

            if role == "admin":
                logger.debug(
                    "admin_authenticated_mock_token",
                    user_id=user_id,
                    tenant_id=tenant_id
                )
                return {
                    "sub": user_id,
                    "tenant_id": tenant_id,
                    "roles": ["admin"],
                    "mock_token": True
                }
            else:
                logger.warning(
                    "admin_access_denied_mock_token",
                    user_id=user_id,
                    tenant_id=tenant_id,
                    role=role
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin role required"
                )

    # Real RS256 JWT token
    payload = decode_jwt(token)

    roles = payload.get("roles", [])
    if "admin" not in roles:
        logger.warning(
            "admin_access_denied",
            user_id=payload.get("sub"),
            tenant_id=payload.get("tenant_id"),
            roles=roles
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required"
        )

    logger.info(
        "admin_authenticated",
        user_id=payload.get("sub"),
        tenant_id=payload.get("tenant_id")
    )

    return payload
