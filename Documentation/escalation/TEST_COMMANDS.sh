#!/bin/bash
# Escalation & Supporter Chat API - Test Commands
# Tested with: DISABLE_AUTH=true in development mode
# Last updated: 2025-11-13

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

TENANT_ID="3105b788-b5ff-4d56-88a9-532af4ab4ded"
USER_ID="2bbbaa5-eade-4572-b7ea-574638886a70f"  # From database
SUPPORTER1_ID="05506612-3018-49e9-84b8-8b9f2d648e31"
SUPPORTER2_ID="e5daf131-91f2-4bd4-a4b3-d64aeb3a2cf6"
API_URL="http://localhost:8000"

# ============================================================================
# ADMIN ESCALATION ENDPOINTS
# ============================================================================

# 1. GET AVAILABLE STAFF (sorted by capacity - least busy first)
echo "1. GET Available Staff"
curl -s -X GET "$API_URL/api/admin/tenants/$TENANT_ID/staff/available" | python3 -m json.tool

# 2. GET ALL STAFF (includes offline)
echo -e "\n2. GET All Staff"
curl -s -X GET "$API_URL/api/admin/tenants/$TENANT_ID/staff" | python3 -m json.tool

# 3. GET ESCALATION QUEUE (all statuses)
echo -e "\n3. GET Escalation Queue"
curl -s -X GET "$API_URL/api/admin/tenants/$TENANT_ID/escalations" | python3 -m json.tool

# 4. GET PENDING ESCALATIONS ONLY
echo -e "\n4. GET Pending Escalations Only"
curl -s -X GET "$API_URL/api/admin/tenants/$TENANT_ID/escalations?status=pending" | python3 -m json.tool

# 5. AUTO-ESCALATION DETECTION
echo -e "\n5. TEST Auto-Escalation Detection"
curl -s -X POST "$API_URL/api/admin/escalations/detect" \
  -H "Content-Type: application/json" \
  -d '{"message": "I need urgent help immediately! This is critical!"}' | python3 -m json.tool

# ============================================================================
# SUPPORTER CHAT ENDPOINTS
# ============================================================================

# 6. GET SUPPORTER'S SESSIONS (requires JWT token with user_id)
echo -e "\n6. GET Supporter's Assigned Sessions"
# Note: This endpoint requires JWT authentication with tenant_id and sub (user_id)
# Need to create a valid JWT token first
# For now, using curl to show the endpoint structure:
echo "Endpoint: GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions"
echo "Example: curl -H 'Authorization: Bearer <JWT_TOKEN>' http://localhost:8000/api/tenants/$TENANT_ID/supporters/$SUPPORTER1_ID/sessions"

# 7. SUPPORTER SEND MESSAGE (requires JWT token)
echo -e "\n7. SUPPORTER SEND MESSAGE to Tenant"
echo "Endpoint: POST /api/tenants/{tenant_id}/supporter-chat"
echo "Example curl:"
echo "curl -X POST http://localhost:8000/api/tenants/$TENANT_ID/supporter-chat \\"
echo "  -H 'Authorization: Bearer <JWT_TOKEN>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"session_id\": \"<SESSION_ID>\", \"message\": \"How can I help?\"}'"

# ============================================================================
# COMPLETE ESCALATION FLOW
# ============================================================================

echo -e "\n=========================================="
echo "COMPLETE ESCALATION FLOW TEST"
echo "=========================================="

# Step 1: Create a chat session
echo -e "\nSTEP 1: Create user chat session (requires JWT)"
echo "curl -X POST http://localhost:8000/api/$TENANT_ID/chat \\"
echo "  -H 'Authorization: Bearer <JWT_TOKEN>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"message\": \"Need help\", \"user_id\": \"$USER_ID\"}'"

# Step 2: Request escalation
echo -e "\nSTEP 2: Request escalation"
echo "curl -X POST http://localhost:8000/api/admin/tenants/$TENANT_ID/escalations \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"session_id\": \"<SESSION_ID>\", \"reason\": \"User frustrated\", \"auto_detected\": false}'"

# Step 3: Get available staff
echo -e "\nSTEP 3: Get available staff"
echo "curl -s -X GET http://localhost:8000/api/admin/tenants/$TENANT_ID/staff/available"

# Step 4: Assign to supporter
echo -e "\nSTEP 4: Assign to supporter"
echo "curl -X POST http://localhost:8000/api/admin/tenants/$TENANT_ID/escalations/assign \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"session_id\": \"<SESSION_ID>\", \"user_id\": \"$SUPPORTER1_ID\"}'"

# Step 5: Supporter views assigned sessions
echo -e "\nSTEP 5: Supporter views sessions (requires JWT)"
echo "curl -X GET http://localhost:8000/api/tenants/$TENANT_ID/supporters/$SUPPORTER1_ID/sessions \\"
echo "  -H 'Authorization: Bearer <JWT_TOKEN>'"

# Step 6: Supporter sends message
echo -e "\nSTEP 6: Supporter sends message (requires JWT)"
echo "curl -X POST http://localhost:8000/api/tenants/$TENANT_ID/supporter-chat \\"
echo "  -H 'Authorization: Bearer <JWT_TOKEN>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"session_id\": \"<SESSION_ID>\", \"message\": \"I'm here to help!\"}'"

# Step 7: Resolve escalation
echo -e "\nSTEP 7: Resolve escalation"
echo "curl -X POST http://localhost:8000/api/admin/tenants/$TENANT_ID/escalations/resolve \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"session_id\": \"<SESSION_ID>\", \"resolution_notes\": \"Issue resolved\"}'"

# ============================================================================
# NOTES
# ============================================================================

echo -e "\n=========================================="
echo "NOTES & REQUIREMENTS"
echo "=========================================="
echo ""
echo "1. API must be running: uvicorn src.main:app --reload"
echo "2. Environment: DISABLE_AUTH=true (allows testing without signatures)"
echo "3. Admin endpoints work without JWT (they return mock admin user)"
echo "4. Supporter endpoints need JWT with:"
echo "   - 'sub': user_id (supporter's UUID)"
echo "   - 'tenant_id': tenant_id"
echo "5. Chat endpoint needs JWT with same structure"
echo ""
echo "Variables to replace:"
echo "  <JWT_TOKEN> - Valid JWT token from frontend login"
echo "  <SESSION_ID> - UUID from chat response"
echo "  <TENANT_ID> - $TENANT_ID"
echo "  <SUPPORTER_ID> - $SUPPORTER1_ID"
echo ""
