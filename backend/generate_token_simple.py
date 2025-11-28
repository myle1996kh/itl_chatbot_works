"""
Quick script to generate a new JWT token for testing.

Usage:
    python backend/generate_token_simple.py [user_id] [tenant_id] [role] [hours]
    
Example:
    python backend/generate_token_simple.py dev_user_123 tenant_123 admin 24
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
        print(f"\n✅ Mock Token: {mock_token}\n")
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
        print(f"\n{token}\n")
        
        return token
        
    except Exception as e:
        print(f"❌ Error generating token: {e}")
        print(f"   Generating mock token instead...")
        mock_token = f"mock_jwt.{user_id}.{tenant_id}.{role}"
        print(f"\n✅ Mock Token: {mock_token}\n")
        return mock_token


if __name__ == "__main__":
    # Parse command line arguments
    user_id = sys.argv[1] if len(sys.argv) > 1 else "dev_user_123"
    tenant_id = sys.argv[2] if len(sys.argv) > 2 else "tenant_123"
    role = sys.argv[3] if len(sys.argv) > 3 else "admin"
    hours = int(sys.argv[4]) if len(sys.argv) > 4 else 24
    
    print("=" * 70)
    print("JWT Token Generator")
    print("=" * 70)
    print(f"User ID:   {user_id}")
    print(f"Tenant ID: {tenant_id}")
    print(f"Role:      {role}")
    print(f"Duration:  {hours} hours")
    print("=" * 70)
    print()
    
    # Generate token
    token = generate_token(user_id, tenant_id, role, hours)
    
    print("=" * 70)
    print("💡 Use this token in your Authorization header:")
    print(f"   Authorization: Bearer {token[:50]}...")
    print("=" * 70)
