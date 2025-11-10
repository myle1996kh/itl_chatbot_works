"""Test agent with RAG tool after update."""
import requests
import json

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"
API_URL = f"http://localhost:8000/api/{TENANT_ID}/chat"

# Test query (same as user's original test)
test_query = "Hướng dẫn tạo mới bảng báo giá bán LCL?"

print("=" * 80)
print("TESTING AGENT WITH UPDATED PROMPT AND TOOL")
print("=" * 80)
print(f"Query: {test_query}")
print()

payload = {
    "message": test_query,
    "user_id": "test_user_001",
}

print("Sending request to API...")
print(f"POST {API_URL}")
print(f"Payload: {json.dumps(payload, ensure_ascii=False)}")
print()

try:
    response = requests.post(API_URL, json=payload, headers={"Content-Type": "application/json"})
    response.raise_for_status()

    result = response.json()

    print("=" * 80)
    print("RESPONSE")
    print("=" * 80)

    # Print full response for debugging
    print("\nFull Response JSON:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    print("\n" + "=" * 80)
    print("ANALYSIS")
    print("=" * 80)

    # Extract key information
    if "response" in result:
        print(f"\nAgent Response (first 500 chars):")
        print(result["response"][:500])
        print("...")

    if "tool_calls" in result:
        print(f"\nTool Calls: {len(result['tool_calls'])}")
        for i, tool_call in enumerate(result["tool_calls"], 1):
            print(f"\n  Tool Call {i}:")
            print(f"    Name: {tool_call.get('name')}")
            print(f"    Input: {json.dumps(tool_call.get('input'), ensure_ascii=False)}")
            if 'output' in tool_call:
                output = tool_call['output']
                if isinstance(output, str) and len(output) > 200:
                    print(f"    Output (first 200 chars): {output[:200]}...")
                else:
                    print(f"    Output: {output}")

    print("\n" + "=" * 80)

    # Check if tool was called
    if result.get("tool_calls") and len(result["tool_calls"]) > 0:
        print("✅ SUCCESS: Agent called RAG tool!")
        print(f"   Tool calls: {len(result['tool_calls'])}")
    else:
        print("❌ FAILURE: Agent did NOT call RAG tool")
        print("   This means the prompt update didn't work as expected")

    print("=" * 80)

except requests.exceptions.RequestException as e:
    print(f"❌ Request Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"\nResponse Status: {e.response.status_code}")
        print(f"Response Body: {e.response.text}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
