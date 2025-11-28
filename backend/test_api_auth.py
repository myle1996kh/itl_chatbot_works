"""
API Authentication Testing Script

This script helps you test API endpoints with proper JWT authentication.
"""
import requests
import jwt
import json
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Configuration
BASE_URL = "http://localhost:8000"
TENANT_ID = "3105b788-b5ff-4d56-88a9-532af4ab4ded"

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

def print_section(title):
    print(f"\n{'='*60}")
    print(f"{Colors.BLUE}{title}{Colors.END}")
    print('='*60)

def generate_test_token():
    """Generate a test JWT token using the private key"""
    print_section("Generating Test JWT Token")
    
    private_key_path = Path("jwt_private.pem")
    
    if not private_key_path.exists():
        print_error("jwt_private.pem not found!")
        print_info("Run: python generate_jwt_keys.py")
        return None
    
    try:
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        # Create payload
        payload = {
            "sub": "test-user-id",
            "tenant_id": TENANT_ID,
            "roles": ["admin"],
            "email": "test@example.com",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        
        # Generate token
        token = jwt.encode(payload, private_key, algorithm='RS256')
        
        print_success("Token generated successfully!")
        print_info(f"Token (first 50 chars): {token[:50]}...")
        print_info(f"Expires: {payload['exp'].isoformat()}")
        
        # Save to file
        with open("test_token.txt", "w") as f:
            f.write(token)
        print_success("Token saved to: test_token.txt")
        
        return token
        
    except Exception as e:
        print_error(f"Failed to generate token: {e}")
        return None

def test_health():
    """Test health endpoint (no auth required)"""
    print_section("Testing Health Endpoint (No Auth)")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        
        if response.status_code == 200:
            print_success("Health check passed!")
            print_info(f"Response: {response.json()}")
            return True
        else:
            print_error(f"Health check failed: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to server!")
        print_info("Make sure the server is running: uvicorn src.main:app --reload")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_auth_required():
    """Test that protected endpoints require authentication"""
    print_section("Testing Auth Requirement")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/chat",
            json={"message": "test"},
            timeout=5
        )
        
        if response.status_code == 401:
            print_success("Auth requirement working! (Got 401 as expected)")
            return True
        else:
            print_warning(f"Expected 401, got {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_with_token(token):
    """Test protected endpoint with valid token"""
    print_section("Testing With Valid Token")
    
    if not token:
        print_error("No token provided!")
        return False
    
    try:
        # Test chat endpoint
        response = requests.post(
            f"{BASE_URL}/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "message": "Hello, this is a test message",
                "session_id": "test-session-123"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print_success("Chat endpoint working with auth!")
            result = response.json()
            print_info(f"Response preview: {str(result)[:200]}...")
            return True
        elif response.status_code == 401:
            print_error("Token was rejected (401)")
            print_info("Token might be invalid or expired")
            return False
        else:
            print_warning(f"Unexpected status: {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_admin_endpoint(token):
    """Test admin endpoint"""
    print_section("Testing Admin Endpoint")
    
    if not token:
        print_error("No token provided!")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/tenants",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            print_success("Admin endpoint accessible!")
            result = response.json()
            print_info(f"Tenants: {result.get('total', 0)}")
            return True
        elif response.status_code == 401:
            print_error("Not authenticated")
            return False
        elif response.status_code == 403:
            print_warning("Forbidden - need admin role")
            return False
        else:
            print_warning(f"Status: {response.status_code}")
            print_info(f"Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def decode_token(token):
    """Decode and display token contents"""
    print_section("Token Information")
    
    if not token:
        print_error("No token provided!")
        return
    
    try:
        # Decode without verification (just to see contents)
        payload = jwt.decode(token, options={"verify_signature": False})
        
        print_info("Token Payload:")
        print(json.dumps(payload, indent=2, default=str))
        
        # Check expiration
        if "exp" in payload:
            exp_time = datetime.fromtimestamp(payload["exp"])
            now = datetime.utcnow()
            
            if exp_time > now:
                time_left = exp_time - now
                print_success(f"Token valid for: {time_left}")
            else:
                print_error("Token expired!")
                
    except Exception as e:
        print_error(f"Failed to decode token: {e}")

def main():
    """Main test flow"""
    print(f"\n{Colors.BLUE}{'='*60}")
    print("🧪 API Authentication Testing Tool")
    print(f"{'='*60}{Colors.END}\n")
    
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"Tenant ID: {TENANT_ID}")
    print()
    
    # Check if server is running
    if not test_health():
        print_error("\nServer is not running or not accessible!")
        print_info("Start server with: uvicorn src.main:app --reload")
        sys.exit(1)
    
    # Test auth requirement
    test_auth_required()
    
    # Generate or load token
    token = None
    token_file = Path("test_token.txt")
    
    if token_file.exists():
        print_section("Loading Existing Token")
        with open(token_file, 'r') as f:
            token = f.read().strip()
        print_success("Loaded token from test_token.txt")
        
        # Decode to check expiration
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            exp_time = datetime.fromtimestamp(payload["exp"])
            if exp_time < datetime.utcnow():
                print_warning("Token expired! Generating new one...")
                token = generate_test_token()
        except:
            print_warning("Invalid token! Generating new one...")
            token = generate_test_token()
    else:
        token = generate_test_token()
    
    if not token:
        print_error("\nFailed to get token!")
        sys.exit(1)
    
    # Decode token
    decode_token(token)
    
    # Test with token
    test_with_token(token)
    
    # Test admin endpoint
    test_admin_endpoint(token)
    
    # Summary
    print_section("Summary")
    print_success("Testing complete!")
    print_info(f"Token saved in: test_token.txt")
    print_info("Use this token for manual testing:")
    print(f"\n{Colors.YELLOW}export TOKEN=\"{token[:50]}...\"{Colors.END}")
    print(f"\n{Colors.YELLOW}curl -X POST {BASE_URL}/api/v1/chat \\")
    print(f"  -H \"Authorization: Bearer $TOKEN\" \\")
    print(f"  -H \"Content-Type: application/json\" \\")
    print(f"  -d '{{\"message\":\"Hello\",\"session_id\":\"test\"}}'{Colors.END}\n")

if __name__ == "__main__":
    main()
