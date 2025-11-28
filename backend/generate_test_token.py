"""
Generate a test JWT token for development/testing.

Usage:
    python generate_test_token.py --role admin --tenant-id <tenant_id> --user-id <user_id>
    python generate_test_token.py --role supporter --tenant-id <tenant_id> --user-id <user_id>
    python generate_test_token.py --role chat_user --tenant-id <tenant_id> --user-id <user_id>
"""

import jwt
import argparse
from datetime import datetime, timedelta
from pathlib import Path

def generate_token(user_id: str, tenant_id: str, role: str, expires_hours: int = 24):
    """
    Generate a JWT token for testing.
    
    Args:
        user_id: User UUID
        tenant_id: Tenant UUID
        role: User role (admin, supporter, chat_user)
        expires_hours: Token expiration in hours (default 24)
    
    Returns:
        JWT token string
    """
    # Load private key
    private_key_path = Path(__file__).parent / "jwt_private.pem"
    
    if not private_key_path.exists():
        print(f"❌ Error: Private key not found at {private_key_path}")
        print("Please ensure jwt_private.pem exists in the backend directory")
        return None
    
    with open(private_key_path, "r") as f:
        private_key = f.read()
    
    # Create payload
    now = datetime.utcnow()
    payload = {
        "sub": user_id,  # User ID
        "tenant_id": tenant_id,
        "role": role,
        "iat": now,  # Issued at
        "exp": now + timedelta(hours=expires_hours),  # Expiration
    }
    
    # Generate token
    token = jwt.encode(payload, private_key, algorithm="RS256")
    
    return token


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate test JWT token")
    parser.add_argument("--user-id", required=True, help="User UUID")
    parser.add_argument("--tenant-id", required=True, help="Tenant UUID")
    parser.add_argument("--role", required=True, choices=["admin", "supporter", "chat_user"], help="User role")
    parser.add_argument("--expires", type=int, default=24, help="Token expiration in hours (default 24)")
    
    args = parser.parse_args()
    
    token = generate_token(args.user_id, args.tenant_id, args.role, args.expires)
    
    if token:
        print("\n" + "="*80)
        print("✅ JWT Token Generated Successfully")
        print("="*80)
        print(f"\nUser ID:    {args.user_id}")
        print(f"Tenant ID:  {args.tenant_id}")
        print(f"Role:       {args.role}")
        print(f"Expires:    {args.expires} hours")
        print("\n" + "-"*80)
        print("Bearer Token:")
        print("-"*80)
        print(token)
        print("-"*80)
        print("\nUsage in curl:")
        print(f'curl -H "Authorization: Bearer {token}" http://localhost:8000/api/...')
        print("\nUsage in Postman:")
        print("1. Go to Authorization tab")
        print("2. Select 'Bearer Token'")
        print(f"3. Paste: {token}")
        print("="*80 + "\n")
