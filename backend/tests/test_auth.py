"""
Authentication and Authorization Tests
Tests JWT validation, auth requirements, and security
"""
import pytest
from fastapi.testclient import TestClient

def test_auth_required_for_chat(test_client):
    """Test that chat endpoint requires authentication"""
    response = test_client.post(
        "/api/v1/chat",
        json={"message": "test"}
    )
    # Should return 401 Unauthorized without token
    assert response.status_code == 401

def test_auth_required_for_admin(test_client):
    """Test that admin endpoints require authentication"""
    response = test_client.get("/api/admin/tenants")
    # Should return 401 Unauthorized without token
    assert response.status_code == 401

def test_invalid_jwt_token(test_client):
    """Test that invalid JWT tokens are rejected"""
    response = test_client.post(
        "/api/v1/chat",
        json={"message": "test"},
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    assert response.status_code == 401

def test_valid_jwt_token(test_client, test_jwt_token):
    """Test that valid JWT tokens are accepted"""
    if not test_jwt_token:
        pytest.skip("No test JWT token available")
    
    response = test_client.post(
        "/api/v1/chat",
        json={"message": "test"},
        headers={"Authorization": f"Bearer {test_jwt_token}"}
    )
    # Should not return 401 (might return 422 if missing other fields)
    assert response.status_code != 401

def test_missing_authorization_header(test_client):
    """Test that requests without Authorization header are rejected"""
    response = test_client.post(
        "/api/v1/chat",
        json={"message": "test"}
    )
    assert response.status_code == 401
    assert "authorization" in response.json()["detail"].lower() or "authenticate" in response.json()["detail"].lower()
