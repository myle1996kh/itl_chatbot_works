"""
Test Phase 0: User Management and Authentication.

Tests:
1. User registration/creation (admin only)
2. User login
3. Password change
4. User CRUD operations (admin only)
"""
import requests
import json
import uuid
from src.config import SessionLocal, settings
from src.models.tenant import Tenant
from src.models.user import User
from src.api.auth import hash_password

# Test configuration
API_BASE_URL = f"http://localhost:{settings.API_PORT}"
TEST_TENANT_NAME = "Test Tenant"
TEST_ADMIN_EMAIL = "admin@test.com"
TEST_ADMIN_PASSWORD = "TestPassword123!"
TEST_USER_EMAIL = "user@test.com"
TEST_USER_PASSWORD = "UserPassword123!"


def setup_test_data():
    """Create test tenant and admin user in database."""
    db = SessionLocal()
    try:
        # Check if test tenant already exists
        tenant = db.query(Tenant).filter(Tenant.name == TEST_TENANT_NAME).first()
        if not tenant:
            tenant = Tenant(
                tenant_id=uuid.uuid4(),
                name=TEST_TENANT_NAME,
                domain="test.local",
                status="active",
            )
            db.add(tenant)
            db.flush()
            print(f"Created test tenant: {TEST_TENANT_NAME} (ID: {tenant.tenant_id})")
        else:
            print(f"Test tenant already exists: {TEST_TENANT_NAME} (ID: {tenant.tenant_id})")

        # Check if admin user already exists
        admin_user = db.query(User).filter(
            User.email == TEST_ADMIN_EMAIL,
            User.tenant_id == tenant.tenant_id
        ).first()

        if not admin_user:
            admin_user = User(
                user_id=uuid.uuid4(),
                tenant_id=tenant.tenant_id,
                email=TEST_ADMIN_EMAIL,
                username="admin",
                password_hash=hash_password(TEST_ADMIN_PASSWORD),
                role="admin",
                display_name="Admin User",
                status="active",
                created_by=None,
            )
            db.add(admin_user)
            db.commit()
            print(f"Created admin user: {TEST_ADMIN_EMAIL}")
        else:
            print(f"Admin user already exists: {TEST_ADMIN_EMAIL}")

        return tenant.tenant_id, admin_user.user_id

    except Exception as e:
        print(f"Error setting up test data: {str(e)}")
        db.rollback()
        return None, None
    finally:
        db.close()


def test_login(tenant_id: str, email: str, password: str) -> dict:
    """Test login endpoint."""
    print(f"\n--- Testing Login ---")
    print(f"Email: {email}")

    url = f"{API_BASE_URL}/api/auth/login"
    payload = {
        "email": email,
        "password": password,
        "tenant_id": tenant_id,
    }

    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Login successful!")
            print(f"  User ID: {data.get('user_id')}")
            print(f"  Email: {data.get('email')}")
            print(f"  Role: {data.get('role')}")
            print(f"  Token: {data.get('token')[:50]}..." if data.get('token') else "  Token: None")
            return data
        else:
            print(f"Login failed: {response.text}")
            return None

    except Exception as e:
        print(f"Error during login: {str(e)}")
        return None


def test_create_user(tenant_id: str, admin_token: str) -> dict:
    """Test user creation endpoint (admin only)."""
    print(f"\n--- Testing Create User ---")

    url = f"{API_BASE_URL}/api/auth/users"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": TEST_USER_EMAIL,
        "username": "testuser",
        "password": TEST_USER_PASSWORD,
        "display_name": "Test User",
        "role": "tenant_user",
        "tenant_id": tenant_id,
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")

        if response.status_code == 201:
            data = response.json()
            print(f"User created successfully!")
            print(f"  User ID: {data.get('user_id')}")
            print(f"  Email: {data.get('email')}")
            print(f"  Role: {data.get('role')}")
            return data
        else:
            print(f"User creation failed: {response.text}")
            return None

    except Exception as e:
        print(f"Error during user creation: {str(e)}")
        return None


def test_get_user(user_id: str, admin_token: str) -> dict:
    """Test get user endpoint (admin only)."""
    print(f"\n--- Testing Get User ---")

    url = f"{API_BASE_URL}/api/auth/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"User retrieved successfully!")
            print(f"  User ID: {data.get('user_id')}")
            print(f"  Email: {data.get('email')}")
            print(f"  Status: {data.get('status')}")
            return data
        else:
            print(f"Get user failed: {response.text}")
            return None

    except Exception as e:
        print(f"Error getting user: {str(e)}")
        return None


def test_update_user(user_id: str, admin_token: str) -> dict:
    """Test user update endpoint (admin only)."""
    print(f"\n--- Testing Update User ---")

    url = f"{API_BASE_URL}/api/auth/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "display_name": "Updated Test User",
        "status": "active",
    }

    try:
        response = requests.put(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"User updated successfully!")
            print(f"  Display Name: {data.get('display_name')}")
            return data
        else:
            print(f"Update user failed: {response.text}")
            return None

    except Exception as e:
        print(f"Error updating user: {str(e)}")
        return None


def test_change_password(user_token: str, old_password: str, new_password: str) -> bool:
    """Test change password endpoint."""
    print(f"\n--- Testing Change Password ---")

    url = f"{API_BASE_URL}/api/auth/change-password"
    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "old_password": old_password,
        "new_password": new_password,
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")

        if response.status_code == 200:
            print(f"Password changed successfully!")
            return True
        else:
            print(f"Change password failed: {response.text}")
            return False

    except Exception as e:
        print(f"Error changing password: {str(e)}")
        return False


def test_delete_user(user_id: str, admin_token: str) -> bool:
    """Test user deletion endpoint (admin only)."""
    print(f"\n--- Testing Delete User ---")

    url = f"{API_BASE_URL}/api/auth/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.delete(url, headers=headers)
        print(f"Status: {response.status_code}")

        if response.status_code == 204:
            print(f"User deleted successfully!")
            return True
        else:
            print(f"Delete user failed: {response.text}")
            return False

    except Exception as e:
        print(f"Error deleting user: {str(e)}")
        return False


def main():
    """Run all Phase 0 tests."""
    print("=" * 80)
    print("PHASE 0 TEST: User Management and Authentication")
    print("=" * 80)

    # Setup test data
    print("\nSetting up test data...")
    tenant_id, admin_user_id = setup_test_data()

    if not tenant_id:
        print("Failed to setup test data. Exiting.")
        return False

    # Test 1: Admin Login
    print("\n" + "=" * 80)
    print("TEST 1: Admin Login")
    print("=" * 80)
    admin_login = test_login(str(tenant_id), TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    if not admin_login:
        print("FAILED: Admin login failed")
        return False
    admin_token = admin_login.get("token")

    # Test 2: Create User
    print("\n" + "=" * 80)
    print("TEST 2: Create User (Admin Only)")
    print("=" * 80)
    new_user = test_create_user(str(tenant_id), admin_token)
    if not new_user:
        print("FAILED: User creation failed")
        return False
    new_user_id = new_user.get("user_id")

    # Test 3: Get User
    print("\n" + "=" * 80)
    print("TEST 3: Get User (Admin Only)")
    print("=" * 80)
    if not test_get_user(new_user_id, admin_token):
        print("FAILED: Get user failed")
        return False

    # Test 4: Update User
    print("\n" + "=" * 80)
    print("TEST 4: Update User (Admin Only)")
    print("=" * 80)
    if not test_update_user(new_user_id, admin_token):
        print("FAILED: Update user failed")
        return False

    # Test 5: User Login
    print("\n" + "=" * 80)
    print("TEST 5: User Login")
    print("=" * 80)
    user_login = test_login(str(tenant_id), TEST_USER_EMAIL, TEST_USER_PASSWORD)
    if not user_login:
        print("FAILED: User login failed")
        return False
    user_token = user_login.get("token")

    # Test 6: Change Password (as user)
    print("\n" + "=" * 80)
    print("TEST 6: Change Password (User)")
    print("=" * 80)
    new_password = "NewPassword123!"
    if not test_change_password(user_token, TEST_USER_PASSWORD, new_password):
        print("FAILED: Change password failed")
        return False

    # Test 7: Login with new password
    print("\n" + "=" * 80)
    print("TEST 7: Login with New Password")
    print("=" * 80)
    if not test_login(str(tenant_id), TEST_USER_EMAIL, new_password):
        print("FAILED: Login with new password failed")
        return False

    # Test 8: Delete User (Admin)
    print("\n" + "=" * 80)
    print("TEST 8: Delete User (Admin Only)")
    print("=" * 80)
    if not test_delete_user(new_user_id, admin_token):
        print("FAILED: Delete user failed")
        return False

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED!")
    print("=" * 80)
    return True


if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {str(e)}")
        exit(1)
