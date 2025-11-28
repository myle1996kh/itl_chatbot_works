"""
Quick JWT Key Generator
Generates a test JWT key pair for development/testing
"""
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import jwt
from datetime import datetime, timedelta

print("=" * 70)
print("JWT KEY PAIR GENERATOR")
print("=" * 70)
print()
print("This will generate a test RS256 key pair for JWT authentication.")
print()

# Generate private key
print("Generating private key...")
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=4096,
    backend=default_backend()
)

# Get private key in PEM format
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Get public key in PEM format
public_key = private_key.public_key()
public_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

print("✅ Keys generated successfully!")
print()

# Save to files
with open("jwt_private.pem", "wb") as f:
    f.write(private_pem)
print("✅ Private key saved to: jwt_private.pem")

with open("jwt_public.pem", "wb") as f:
    f.write(public_pem)
print("✅ Public key saved to: jwt_public.pem")

print()
print("=" * 70)
print("PUBLIC KEY (for .env file)")
print("=" * 70)
print()
print("Copy this to your .env file as JWT_PUBLIC_KEY:")
print()
print(public_pem.decode('utf-8'))

# Generate a test token
print()
print("=" * 70)
print("TEST JWT TOKEN")
print("=" * 70)
print()

payload = {
    'sub': 'test_user_123',
    'tenant_id': '3105b788-b5ff-4d56-88a9-532af4ab4ded',
    'email': 'test@example.com',
    'exp': datetime.utcnow() + timedelta(days=30)
}

token = jwt.encode(payload, private_pem, algorithm='RS256')
print("Test token (valid for 30 days):")
print()
print(token)
print()

# Verify the token works
try:
    decoded = jwt.decode(token, public_pem, algorithms=['RS256'])
    print("✅ Token verification successful!")
    print(f"   Tenant ID: {decoded['tenant_id']}")
    print(f"   User ID: {decoded['sub']}")
except Exception as e:
    print(f"❌ Token verification failed: {e}")

print()
print("=" * 70)
print("NEXT STEPS")
print("=" * 70)
print()
print("1. Copy the public key above to your .env file:")
print('   JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"')
print()
print("2. Set DISABLE_AUTH=false in .env")
print()
print("3. Use the test token above for API requests:")
print('   curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/chat')
print()
print("⚠️  SECURITY NOTE:")
print("   These keys are for DEVELOPMENT/TESTING only!")
print("   For production, use a proper auth service (Auth0, Keycloak, etc.)")
print()
