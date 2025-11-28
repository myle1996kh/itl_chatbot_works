"""
Test Widget Endpoints

Quick script to test the new widget-authenticated endpoints.
"""
import requests

# Configuration
BASE_URL = "http://localhost:8000"
TENANT_ID = "3105b788-b5ff-4d56-88a9-532af4ab4ded"
WIDGET_KEY = "wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
SESSION_ID = "test-session-widget"

# Headers for widget authentication
headers = {
    "X-Widget-Key": WIDGET_KEY,
    "Content-Type": "application/json"
}

print("=" * 60)
print("Testing Widget Endpoints")
print("=" * 60)
print()

# Test 1: Send chat message
print("1. Testing Chat Endpoint...")
try:
    response = requests.post(
        f"{BASE_URL}/api/widget/chat?tenant_id={TENANT_ID}",
        headers=headers,
        json={
            "message": "Hello, this is a test from widget!",
            "session_id": SESSION_ID
        },
        timeout=10
    )
    
    if response.status_code == 200:
        print("✅ Chat endpoint working!")
        print(f"   Response: {response.json()}")
    else:
        print(f"❌ Chat failed: {response.status_code}")
        print(f"   Error: {response.text}")
except Exception as e:
    print(f"❌ Error: {e}")

print()

# Test 2: Get session info
print("2. Testing Session Endpoint...")
try:
    response = requests.get(
        f"{BASE_URL}/api/widget/session/{SESSION_ID}?tenant_id={TENANT_ID}",
        headers={"X-Widget-Key": WIDGET_KEY},
        timeout=5
    )
    
    if response.status_code == 200:
        print("✅ Session endpoint working!")
        print(f"   Session: {response.json()}")
    elif response.status_code == 404:
        print("⚠️  Session not found (expected if no messages sent yet)")
    else:
        print(f"❌ Session failed: {response.status_code}")
        print(f"   Error: {response.text}")
except Exception as e:
    print(f"❌ Error: {e}")

print()

# Test 3: Get chat history
print("3. Testing Messages Endpoint...")
try:
    response = requests.get(
        f"{BASE_URL}/api/widget/session/{SESSION_ID}/messages?tenant_id={TENANT_ID}",
        headers={"X-Widget-Key": WIDGET_KEY},
        timeout=5
    )
    
    if response.status_code == 200:
        print("✅ Messages endpoint working!")
        data = response.json()
        print(f"   Total messages: {data.get('total', 0)}")
    elif response.status_code == 404:
        print("⚠️  Session not found (expected if no messages sent yet)")
    else:
        print(f"❌ Messages failed: {response.status_code}")
        print(f"   Error: {response.text}")
except Exception as e:
    print(f"❌ Error: {e}")

print()
print("=" * 60)
print("Testing Complete!")
print("=" * 60)
print()
print("Next steps:")
print("1. Update widget frontend to use these endpoints")
print("2. Add X-Widget-Key header to all requests")
print("3. Test with DISABLE_AUTH=false")
