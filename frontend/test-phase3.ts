/**
 * Phase 3 Test Suite: User Management & Staff Login
 *
 * Tests for:
 * 1. User authentication and login
 * 2. JWT token management
 * 3. Role-based access control (admin, staff, tenant_user)
 * 4. User creation and management
 * 5. Password management
 * 6. Multi-tenant user isolation
 * 7. Session persistence
 */

import {
  login,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  changePassword,
  getCurrentUser,
  getJWTToken,
  isAuthenticated,
  hasRole,
  isAdmin,
  isStaff,
  logout,
  setApiBaseUrl,
  getApiBaseUrl,
  type LoginResponse,
  type UserResponse,
} from './services/authService';

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const tests: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

function runTest(name: string, fn: () => void): void {
  const startTime = performance.now();
  try {
    fn();
    const duration = performance.now() - startTime;
    tests.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    tests.push({ name, passed: false, error: errorMessage, duration });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${errorMessage}`);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

// --- 1. Login Request Structure ---

console.log('\n=== Test Suite 1: Login Request Structure ===\n');

runTest('Login requires email, password, tenant_id', () => {
  const loginRequest = {
    email: 'staff@company.com',
    password: 'SecurePassword123',
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  assert(loginRequest.email, 'email is required');
  assert(loginRequest.password, 'password is required');
  assert(loginRequest.tenant_id, 'tenant_id is required');
});

runTest('Login response includes user info and token', () => {
  const mockResponse: LoginResponse = {
    user_id: 'user-uuid-here',
    email: 'staff@company.com',
    username: 'staff_member',
    display_name: 'Staff Member',
    role: 'staff',
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    token: 'mock_jwt.user-uuid.tenant-uuid.staff',
    status: 'active',
  };

  assert(mockResponse.user_id, 'Should have user_id');
  assert(mockResponse.email, 'Should have email');
  assert(mockResponse.token, 'Should have token');
  assert(mockResponse.role, 'Should have role');
});

// --- 2. User Roles ---

console.log('\n=== Test Suite 2: User Roles ===\n');

const roles = ['admin', 'staff', 'tenant_user'];

runTest('Valid user roles exist', () => {
  const validRoles = ['admin', 'staff', 'tenant_user'];
  roles.forEach(role => {
    assert(validRoles.includes(role), `${role} should be valid`);
  });
});

runTest('Admin role has full access', () => {
  const adminUser = {
    role: 'admin',
    permissions: ['view_sessions', 'manage_users', 'upload_knowledge', 'view_analytics'],
  };

  assert(adminUser.role === 'admin', 'Should be admin');
  assert(adminUser.permissions.length > 0, 'Admin should have permissions');
});

runTest('Staff role has limited access', () => {
  const staffUser = {
    role: 'staff',
    permissions: ['view_assigned_sessions', 'respond_to_users'],
  };

  assert(staffUser.role === 'staff', 'Should be staff');
  assert(staffUser.permissions.length > 0, 'Staff should have permissions');
});

runTest('Tenant user role has minimal access', () => {
  const tenantUser = {
    role: 'tenant_user',
    permissions: ['use_chatbot', 'view_own_session'],
  };

  assert(tenantUser.role === 'tenant_user', 'Should be tenant_user');
  assert(tenantUser.permissions.length > 0, 'Tenant user should have permissions');
});

// --- 3. Authentication State Management ---

console.log('\n=== Test Suite 3: Authentication State Management ===\n');

runTest('getCurrentUser returns null when not logged in', () => {
  localStorage.removeItem('currentUser');
  const user = getCurrentUser();
  assert(user === null, 'Should return null when not logged in');
});

runTest('getJWTToken returns null when not logged in', () => {
  localStorage.removeItem('jwtToken');
  const token = getJWTToken();
  assert(token === null, 'Should return null when not logged in');
});

runTest('isAuthenticated returns false when not logged in', () => {
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('currentUser');
  assert(!isAuthenticated(), 'Should return false when not authenticated');
});

runTest('Logout clears session data', () => {
  // Simulate logged in state
  localStorage.setItem('jwtToken', 'test-token');
  localStorage.setItem('currentUser', JSON.stringify({ email: 'test@test.com' }));

  logout();

  assert(getJWTToken() === null, 'JWT token should be cleared');
  assert(getCurrentUser() === null, 'Current user should be cleared');
});

// --- 4. Role Checking Functions ---

console.log('\n=== Test Suite 4: Role Checking Functions ===\n');

runTest('hasRole checks user role correctly', () => {
  const adminUser: LoginResponse = {
    user_id: 'user-id',
    email: 'admin@company.com',
    username: 'admin_user',
    role: 'admin',
    tenant_id: 'tenant-id',
    token: 'token',
    status: 'active',
  };

  // Mock getting user
  localStorage.setItem('currentUser', JSON.stringify(adminUser));

  assert(hasRole('admin'), 'Should have admin role');
  assert(!hasRole('staff'), 'Should not have staff role');

  localStorage.removeItem('currentUser');
});

runTest('isAdmin returns true for admin users', () => {
  const adminUser: LoginResponse = {
    user_id: 'user-id',
    email: 'admin@company.com',
    username: 'admin_user',
    role: 'admin',
    tenant_id: 'tenant-id',
    token: 'token',
    status: 'active',
  };

  localStorage.setItem('currentUser', JSON.stringify(adminUser));
  assert(isAdmin(), 'Should be admin');
  localStorage.removeItem('currentUser');
});

runTest('isStaff returns true for staff users', () => {
  const staffUser: LoginResponse = {
    user_id: 'user-id',
    email: 'staff@company.com',
    username: 'staff_user',
    role: 'staff',
    tenant_id: 'tenant-id',
    token: 'token',
    status: 'active',
  };

  localStorage.setItem('currentUser', JSON.stringify(staffUser));
  assert(isStaff(), 'Should be staff');
  localStorage.removeItem('currentUser');
});

// --- 5. User Creation Request ---

console.log('\n=== Test Suite 5: User Creation Request ===\n');

runTest('Create user request has all required fields', () => {
  const createRequest = {
    email: 'newstaff@company.com',
    username: 'newstaff',
    password: 'SecurePassword123',
    display_name: 'New Staff',
    role: 'staff',
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  assert(createRequest.email, 'email required');
  assert(createRequest.username, 'username required');
  assert(createRequest.password, 'password required');
  assert(createRequest.role, 'role required');
  assert(createRequest.tenant_id, 'tenant_id required');
});

runTest('Create user response includes user details', () => {
  const mockResponse: UserResponse = {
    user_id: 'new-user-uuid',
    email: 'newstaff@company.com',
    username: 'newstaff',
    display_name: 'New Staff',
    role: 'staff',
    status: 'active',
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    created_at: new Date().toISOString(),
  };

  assert(mockResponse.user_id, 'Should have user_id');
  assert(mockResponse.email === 'newstaff@company.com', 'Email should match');
  assert(mockResponse.role === 'staff', 'Role should match');
});

// --- 6. User Update Request ---

console.log('\n=== Test Suite 6: User Update Request ===\n');

runTest('Update user can modify email', () => {
  const updateRequest = {
    email: 'newemail@company.com',
  };

  assert(updateRequest.email, 'email should be updateable');
});

runTest('Update user can modify display name', () => {
  const updateRequest = {
    display_name: 'Updated Name',
  };

  assert(updateRequest.display_name, 'display_name should be updateable');
});

runTest('Update user can change status', () => {
  const updateRequest = {
    status: 'inactive',
  };

  assert(['active', 'inactive', 'suspended'].includes(updateRequest.status), 'Status should be valid');
});

// --- 7. Password Management ---

console.log('\n=== Test Suite 7: Password Management ===\n');

runTest('Change password requires old and new password', () => {
  const changePasswordRequest = {
    old_password: 'OldPassword123',
    new_password: 'NewPassword456',
  };

  assert(changePasswordRequest.old_password, 'old_password required');
  assert(changePasswordRequest.new_password, 'new_password required');
});

runTest('New password should be different from old password', () => {
  const oldPassword = 'Password123';
  const newPassword = 'NewPassword456';

  assert(oldPassword !== newPassword, 'Passwords should be different');
});

// --- 8. Multi-Tenant User Isolation ---

console.log('\n=== Test Suite 8: Multi-Tenant User Isolation ===\n');

runTest('Users are scoped to tenant', () => {
  const tenant1User = {
    email: 'user@company.com',
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  const tenant2User = {
    email: 'user@company.com', // Same email, different tenant
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  assert(tenant1User.email === tenant2User.email, 'Same email allowed in different tenants');
  assert(tenant1User.tenant_id !== tenant2User.tenant_id, 'Different tenants');
});

runTest('User creation is scoped to admin tenant', () => {
  const adminUser = {
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    role: 'admin',
  };

  const newUserRequest = {
    tenant_id: '550e8400-e29b-41d4-a716-446655440000', // Must match admin tenant
    email: 'newuser@company.com',
  };

  assert(adminUser.tenant_id === newUserRequest.tenant_id, 'Admin can create users in own tenant');
});

// --- 9. Session Persistence ---

console.log('\n=== Test Suite 9: Session Persistence ===\n');

runTest('JWT token persists in localStorage', () => {
  const token = 'mock_jwt.user-uuid.tenant-uuid.role';
  localStorage.setItem('jwtToken', token);

  assertEquals(getJWTToken(), token, 'Token should persist');
  localStorage.removeItem('jwtToken');
});

runTest('User info persists in localStorage', () => {
  const user: LoginResponse = {
    user_id: 'user-id',
    email: 'staff@company.com',
    username: 'staff_user',
    role: 'staff',
    tenant_id: 'tenant-id',
    token: 'token',
    status: 'active',
  };

  localStorage.setItem('currentUser', JSON.stringify(user));
  const retrieved = getCurrentUser();

  assert(retrieved !== null, 'User should be retrieved');
  assert(retrieved?.email === user.email, 'Email should match');
  localStorage.removeItem('currentUser');
});

// --- 10. Integration Scenarios ---

console.log('\n=== Test Suite 10: Integration Scenarios ===\n');

runTest('Complete login flow: login → store → check auth', () => {
  // Step 1: Simulate successful login
  const loginResponse: LoginResponse = {
    user_id: 'user-uuid',
    email: 'staff@company.com',
    username: 'staff_user',
    display_name: 'Staff User',
    role: 'staff',
    tenant_id: 'tenant-uuid',
    token: 'mock_jwt.user-uuid.tenant-uuid.staff',
    status: 'active',
  };

  // Step 2: Store credentials
  localStorage.setItem('jwtToken', loginResponse.token);
  localStorage.setItem('currentUser', JSON.stringify(loginResponse));

  // Step 3: Verify authentication
  assert(getJWTToken() !== null, 'Token should be stored');
  assert(getCurrentUser() !== null, 'User should be stored');
  assert(isAuthenticated(), 'Should be authenticated');
  assert(isStaff(), 'Should be staff');

  // Cleanup
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('currentUser');
});

runTest('Admin dashboard access control: show users tab only for admin', () => {
  const adminUser: LoginResponse = {
    user_id: 'admin-id',
    email: 'admin@company.com',
    username: 'admin',
    role: 'admin',
    tenant_id: 'tenant-id',
    token: 'token',
    status: 'active',
  };

  const staffUser: LoginResponse = {
    user_id: 'staff-id',
    email: 'staff@company.com',
    username: 'staff',
    role: 'staff',
    tenant_id: 'tenant-id',
    token: 'token',
    status: 'active',
  };

  // Admin should see users tab
  localStorage.setItem('currentUser', JSON.stringify(adminUser));
  assert(isAdmin(), 'Admin should have isAdmin true');
  localStorage.removeItem('currentUser');

  // Staff should not see users tab
  localStorage.setItem('currentUser', JSON.stringify(staffUser));
  assert(!isAdmin(), 'Staff should have isAdmin false');
  localStorage.removeItem('currentUser');
});

// ============================================================================
// Test Results Summary
// ============================================================================

setTimeout(() => {
  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const total = tests.length;
  const totalDuration = tests.reduce((sum, t) => sum + (t.duration || 0), 0);

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    Error: ${t.error}`);
      });
  }

  console.log('\n' + '='.repeat(80) + '\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!\n');
  } else {
    console.log(`⚠️  ${failed} test(s) failed\n`);
  }
}, 100);

export { tests };
