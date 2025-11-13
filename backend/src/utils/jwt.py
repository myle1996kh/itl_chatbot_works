"""JWT validation utilities for RS256 tokens."""
import jwt
from typing import Dict, Any
from fastapi import HTTPException, status
from src.config import settings


def decode_jwt(token: str, verify_signature: bool = True) -> Dict[str, Any]:
    """
    Decode and validate JWT token using RS256 algorithm.

    Args:
        token: JWT token string
        verify_signature: If False, skip signature verification (dev mode only)

    Returns:
        Decoded JWT payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # In development with DISABLE_AUTH, handle mock tokens
        if not verify_signature:
            # Handle mock tokens (format: mock_jwt.{user_id}.{tenant_id}.{role})
            if token.startswith("mock_jwt."):
                parts = token.split(".")
                if len(parts) >= 4:
                    return {
                        "sub": parts[1],
                        "tenant_id": parts[2],
                        "roles": [parts[3]],
                    }

            # Try to decode as regular JWT without signature verification
            try:
                payload = jwt.decode(
                    token,
                    options={"verify_signature": False}
                )
                return payload
            except jwt.DecodeError:
                # If still can't decode, raise error
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token format",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        if not settings.JWT_PUBLIC_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT_PUBLIC_KEY not configured"
            )

        payload = jwt.decode(
            token,
            settings.JWT_PUBLIC_KEY,
            algorithms=["RS256"],
            options={"verify_exp": True}
        )
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid JWT token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def validate_rs256(token: str) -> bool:
    """
    Validate JWT token signature.

    Args:
        token: JWT token string

    Returns:
        True if valid, False otherwise
    """
    try:
        decode_jwt(token)
        return True
    except HTTPException:
        return False


def extract_tenant_id(payload: Dict[str, Any]) -> str:
    """
    Extract tenant_id from JWT payload.

    Args:
        payload: Decoded JWT payload

    Returns:
        Tenant ID string

    Raises:
        HTTPException: If tenant_id not found in payload
    """
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_id not found in JWT token"
        )
    return tenant_id


def extract_user_id(payload: Dict[str, Any]) -> str:
    """
    Extract user_id from JWT payload.

    Args:
        payload: Decoded JWT payload

    Returns:
        User ID string

    Raises:
        HTTPException: If user_id (sub) not found in payload
    """
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="sub (user_id) not found in JWT token"
        )
    return user_id
