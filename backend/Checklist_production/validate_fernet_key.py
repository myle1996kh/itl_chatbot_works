"""
Quick Fernet Key Validator
Tests if the provided Fernet key is valid
"""
from cryptography.fernet import Fernet

# Your Fernet key
FERNET_KEY = "kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM="

print("=" * 60)
print("FERNET KEY VALIDATION")
print("=" * 60)
print()

try:
    # Create Fernet instance
    fernet = Fernet(FERNET_KEY.encode())
    
    # Test encryption
    test_data = b"test_secret_api_key_12345"
    encrypted = fernet.encrypt(test_data)
    
    # Test decryption
    decrypted = fernet.decrypt(encrypted)
    
    # Verify
    if decrypted == test_data:
        print("✅ Fernet key is VALID!")
        print(f"   Key: {FERNET_KEY[:15]}...{FERNET_KEY[-15:]}")
        print(f"   Length: {len(FERNET_KEY)} characters")
        print()
        print("Test Results:")
        print(f"   Original:  {test_data}")
        print(f"   Encrypted: {encrypted[:50]}...")
        print(f"   Decrypted: {decrypted}")
        print()
        print("✅ Encryption/Decryption working correctly!")
        print()
        print("This key is ready for production use.")
    else:
        print("❌ Encryption/Decryption failed!")
        
except Exception as e:
    print(f"❌ Fernet key is INVALID!")
    print(f"   Error: {e}")
    print()
    print("Please generate a new key with:")
    print("   python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")

print("=" * 60)
