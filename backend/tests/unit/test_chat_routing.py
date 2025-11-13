"""
Unit tests for Chat Routing via Agent Names (Dev Agent 1).

Tests:
1. Direct routing to specific agent by name
2. Fallback to SupervisorAgent when no agent_name provided
3. Agent not available for tenant
4. Agent name case sensitivity
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4
from src.main import app
from src.config import SessionLocal
from src.models.tenant import Tenant
from src.models.agent import AgentConfig
from src.models.permissions import TenantAgentPermission
from src.models.session import ChatSession
from src.models.message import Message


@pytest.fixture
def db():
    """Create a test database session."""
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def test_tenant(db):
    """Create a test tenant for Chat Routing tests."""
    tenant_id = "3105b788-b5ff-4d56-88a9-532af4ab4ded"  # eTMS tenant
    # Use existing tenant or create if needed
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()

    if not tenant:
        tenant = Tenant(
            tenant_id=tenant_id,
            name="eTMS_Test",
            description="Test tenant for Chat Routing",
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

    return tenant


@pytest.fixture
def test_agents(db):
    """Create test agents with proper permissions."""
    agents = {}

    # Create or retrieve test agents
    agent_names = ["DebtAgent", "GuidelineAgent", "SupervisorAgent"]
    for name in agent_names:
        agent = db.query(AgentConfig).filter(AgentConfig.name == name).first()

        if not agent:
            agent = AgentConfig(
                agent_id=str(uuid4()),
                name=name,
                description=f"Test {name}",
                is_active=True,
            )
            db.add(agent)
            db.commit()
            db.refresh(agent)

        agents[name] = agent

    return agents


@pytest.fixture
def setup_tenant_agents(db, test_tenant, test_agents):
    """Setup tenant permissions for agents."""
    # Grant permissions for eTMS tenant
    for agent_name, agent in test_agents.items():
        # Check if permission already exists
        perm = (
            db.query(TenantAgentPermission)
            .filter(
                TenantAgentPermission.tenant_id == test_tenant.tenant_id,
                TenantAgentPermission.agent_id == agent.agent_id,
            )
            .first()
        )

        if not perm:
            perm = TenantAgentPermission(
                tenant_id=test_tenant.tenant_id,
                agent_id=agent.agent_id,
                enabled=True,
            )
            db.add(perm)

    db.commit()
    return test_tenant


# ============================================================================
# Test 1: Direct routing with agent_name="DebtAgent"
# ============================================================================
def test_chat_direct_routing_debt_agent(client, db, setup_tenant_agents, test_tenant):
    """
    Test: POST /chat with agent_name="DebtAgent" routes correctly

    Success Criteria:
    - Response status is 200 OK
    - Agent used is "DebtAgent"
    - Session created and returned
    """
    response = client.post(
        f"/api/{test_tenant.tenant_id}/test/chat",
        json={
            "message": "What is the debt for MST 0123456789?",
            "agent_name": "DebtAgent",
            "user_id": "test-user",
            "session_id": None,
        },
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # Verify agent used is DebtAgent
    assert data.get("agent") == "DebtAgent", f"Expected DebtAgent, got {data.get('agent')}"

    # Verify session was created
    assert data.get("session_id") is not None, "Session ID should be returned"

    # Verify message ID is returned
    assert data.get("message_id") is not None, "Message ID should be returned"


# ============================================================================
# Test 2: Fallback to SupervisorAgent when no agent_name provided
# ============================================================================
def test_chat_supervisor_fallback(client, db, setup_tenant_agents, test_tenant):
    """
    Test: POST /chat without agent_name uses SupervisorAgent

    Success Criteria:
    - Response status is 200 OK
    - SupervisorAgent is used for routing (implicit - no agent_name provided)
    - Session created and returned
    """
    response = client.post(
        f"/api/{test_tenant.tenant_id}/test/chat",
        json={
            "message": "I need help",
            # agent_name NOT provided - should fallback to SupervisorAgent
            "user_id": "test-user",
            "session_id": None,
        },
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # Verify session was created
    assert data.get("session_id") is not None, "Session ID should be returned"

    # Verify message ID is returned
    assert data.get("message_id") is not None, "Message ID should be returned"

    # Response should contain agent info (from SupervisorAgent routing)
    assert data.get("agent") is not None, "Agent should be identified"


# ============================================================================
# Test 3: Agent not available for tenant
# ============================================================================
def test_chat_agent_not_available_for_tenant(client, db, test_tenant, test_agents):
    """
    Test: POST /chat fails when agent not available for tenant

    Scenario:
    - eTMS doesn't have DebtAgent enabled
    - Request tries to use DebtAgent
    - Should return 400 Bad Request

    Success Criteria:
    - Response status is 400
    - Error message includes "not available for tenant"
    """
    # Create another tenant without DebtAgent permissions
    other_tenant_id = "9999b788-b5ff-4d56-88a9-532af4ab4ded"
    other_tenant = db.query(Tenant).filter(Tenant.tenant_id == other_tenant_id).first()

    if not other_tenant:
        other_tenant = Tenant(
            tenant_id=other_tenant_id,
            name="OtherTenant_Test",
            description="Tenant without DebtAgent",
        )
        db.add(other_tenant)
        db.commit()

    # Give permissions for SupervisorAgent and GuidelineAgent only
    for agent_name in ["SupervisorAgent", "GuidelineAgent"]:
        agent = test_agents.get(agent_name)
        if agent:
            perm = (
                db.query(TenantAgentPermission)
                .filter(
                    TenantAgentPermission.tenant_id == other_tenant_id,
                    TenantAgentPermission.agent_id == agent.agent_id,
                )
                .first()
            )

            if not perm:
                perm = TenantAgentPermission(
                    tenant_id=other_tenant_id,
                    agent_id=agent.agent_id,
                    enabled=True,
                )
                db.add(perm)

    db.commit()

    # Try to use DebtAgent in tenant that doesn't have it
    response = client.post(
        f"/api/{other_tenant_id}/test/chat",
        json={
            "message": "What is the debt?",
            "agent_name": "DebtAgent",  # Not available in this tenant!
            "user_id": "test-user",
            "session_id": None,
        },
    )

    # Should fail with 400
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    data = response.json()

    # Error message should mention tenant availability
    detail = data.get("detail", "")
    assert (
        "not available for tenant" in detail
    ), f"Expected 'not available for tenant' in error, got: {detail}"


# ============================================================================
# Test 4: Agent name case sensitivity
# ============================================================================
def test_chat_agent_name_case_sensitive(client, db, setup_tenant_agents, test_tenant):
    """
    Test: Agent names are case-sensitive

    Scenario:
    - Correct name: "DebtAgent" (capital D)
    - Incorrect name: "debtAgent" (lowercase d)
    - Request with incorrect case should fail

    Success Criteria:
    - Response status is 400
    - Error message indicates agent not found
    """
    response = client.post(
        f"/api/{test_tenant.tenant_id}/test/chat",
        json={
            "message": "Query debt",
            "agent_name": "debtAgent",  # Wrong case! Should be "DebtAgent"
            "user_id": "test-user",
            "session_id": None,
        },
    )

    # Should fail with 400 because agent name doesn't match (case-sensitive)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    data = response.json()

    # Error message should indicate agent not found
    detail = data.get("detail", "")
    assert (
        "not found" in detail or "not available" in detail
    ), f"Expected error about agent not found, got: {detail}"


# ============================================================================
# Test 5: Verify agent lookup function for edge cases
# ============================================================================
def test_agent_id_lookup_invalid_agent(client, db, test_tenant):
    """
    Test: get_agent_id_by_name raises error for non-existent agent

    Success Criteria:
    - Response status is 400
    - Error detail mentions agent not found
    """
    response = client.post(
        f"/api/{test_tenant.tenant_id}/test/chat",
        json={
            "message": "Query",
            "agent_name": "NonExistentAgent",
            "user_id": "test-user",
            "session_id": None,
        },
    )

    assert response.status_code == 400
    detail = response.json().get("detail", "")
    assert "not found" in detail


if __name__ == "__main__":
    # Run tests with: pytest tests/unit/test_chat_routing.py -v
    pytest.main([__file__, "-v"])
