"""
Quick script to generate a new JWT token for testing.

Usage:
    python backend/generate_token.py

This will generate a token valid for 24 hours.
"""
import jwt
from datetime import datetime, timedelta
from pathlib import Path
import sys

def generate_token(user_id: str, tenant_id: str, role: str = "admin", hours: int = 24) -> str:
    """
    Generate JWT token using RS256 algorithm.
    
    Args:
        user_id: User UUID
        tenant_id: Tenant UUID
        role: User role (default: admin)
        hours: Token validity in hours (default: 24)
    
    Returns:
        JWT token string
    """
    # Find private key
    backend_dir = Path(__file__).parent
    private_key_path = backend_dir / "jwt_private.pem"
    
    if not private_key_path.exists():
        print(f"❌ Error: jwt_private.pem not found at {private_key_path}")
        print(f"   Generating mock token instead...")
        mock_token = f"mock_jwt.{user_id}.{tenant_id}.{role}"
        return mock_token
    
    try:
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        payload = {
            "sub": user_id,
            "tenant_id": tenant_id,
            "roles": [role],
            "email": "",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=hours)
        }
        
        token = jwt.encode(payload, private_key, algorithm='RS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        print(f"✅ JWT Token generated successfully!")
        print(f"   Algorithm: RS256")
        print(f"   Valid for: {hours} hours")
        print(f"   Expires: {payload['exp'].isoformat()}Z")
        
        return token
        
    except Exception as e:
        print(f"❌ Error generating token: {e}")
        print(f"   Generating mock token instead...")
        mock_token = f"mock_jwt.{user_id}.{tenant_id}.{role}"
        return mock_token


if __name__ == "__main__":
    print("=" * 70)
    print("JWT Token Generator")
    print("=" * 70)
    
    # Get user input
    print("\nEnter token details (or press Enter for defaults):")
    
    user_id = input("User ID (default: dev_user_123): ").strip()
    if not user_id:
        user_id = "dev_user_123"
    
    tenant_id = input("Tenant ID (default: tenant_123): ").strip()
    if not tenant_id:
        tenant_id = "tenant_123"
    
    role = input("Role [admin/staff/tenant_user] (default: admin): ").strip()
    if not role:
        role = "admin"
    
    hours_input = input("Valid for hours (default: 24): ").strip()
    hours = int(hours_input) if hours_input else 24
    
    print("\n" + "-" * 70)
    print(f"Generating token for:")
    print(f"  User ID:   {user_id}")
    print(f"  Tenant ID: {tenant_id}")
    print(f"  Role:      {role}")
    print(f"  Duration:  {hours} hours")
    print("-" * 70 + "\n")
    
    # Generate token
    token = generate_token(user_id, tenant_id, role, hours)
    
    print("\n" + "=" * 70)
    print("YOUR TOKEN:")
    print("=" * 70)
    print(token)
    print("=" * 70)
    
    print("\n💡 Copy this token and use it in your Authorization header:")
    print(f'   Authorization: Bearer {token}')
    print("\n")
