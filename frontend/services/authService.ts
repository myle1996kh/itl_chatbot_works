/**
 * Authentication Service
 *
 * Handles communication with the ITL Backend API for user authentication,
 * login, user management, and session management.
 * Supports multiple user roles: tenant_user, staff, admin
 */

/**
 * API Configuration
 */
const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  LOGIN_ENDPOINT: '/api/auth/login',
  CREATE_USER_ENDPOINT: '/api/auth/users',
  GET_USER_ENDPOINT: '/api/auth/users/{user_id}',
  UPDATE_USER_ENDPOINT: '/api/auth/users/{user_id}',
  DELETE_USER_ENDPOINT: '/api/auth/users/{user_id}',
  CHANGE_PASSWORD_ENDPOINT: '/api/auth/change-password',
  TIMEOUT_MS: 30000,
};

/**
 * Auth Service Interfaces
 */

export interface LoginRequest {
  username: string;
  password: string;
  tenant_id: string;
}

export interface LoginResponse {
  user_id: string;
  email: string;
  username: string;
  display_name?: string;
  role: string; // 'tenant_user', 'staff', 'admin'
  tenant_id: string;
  token: string;
  status: string; // 'active', 'inactive', 'suspended'
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  display_name?: string;
  role: string; // 'tenant_user', 'staff', 'admin'
  tenant_id: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  display_name?: string;
  status?: string;
}

export interface UserResponse {
  user_id: string;
  email: string;
  username: string;
  display_name?: string;
  role: string;
  status: string;
  tenant_id: string;
  created_at: string;
  last_login?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface AuthServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Current authenticated user session
 */
export interface AuthSession {
  user: LoginResponse;
  token: string;
  expiresAt: Date;
}

/**
 * Login user with username and password
 *
 * Authenticates user against the backend and returns user info with JWT token.
 * The token is stored in localStorage for subsequent API requests.
 *
 * @param username - User username
 * @param password - User password
 * @param tenantId - Tenant ID
 * @returns Login response with user info and token
 *
 * @example
 * const response = await login(
 *   'admin',
 *   'SecurePassword123',
 *   '550e8400-e29b-41d4-a716-446655440000'
 * );
 *
 * if (response.success && response.data) {
 *   localStorage.setItem('jwtToken', response.data.token);
 *   localStorage.setItem('currentUser', JSON.stringify(response.data));
 * }
 */
export async function login(
  username: string,
  password: string,
  tenantId: string
): Promise<AuthServiceResponse<LoginResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.LOGIN_ENDPOINT}`;

    console.log('🔐 Attempting login', {
      username,
      tenantId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        tenant_id: tenantId,
      }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;

      console.error('❌ Login failed', {
        status: response.status,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        code: `HTTP_${response.status}`,
      };
    }

    const data: LoginResponse = await response.json();

    console.log('✅ Login successful', {
      userId: data.user_id,
      username: data.username,
      role: data.role,
      tenantId: data.tenant_id,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('❌ Auth service error - login', {
      error: errorMessage,
      username,
    });

    return {
      success: false,
      error: errorMessage,
      code: 'LOGIN_ERROR',
    };
  }
}

/**
 * Create a new user (admin only)
 *
 * Admin must belong to same tenant as new user.
 *
 * @param request - User creation details
 * @param adminToken - JWT token of admin user
 * @returns Created user response
 *
 * @example
 * const response = await createUser(
 *   {
 *     email: 'newstaff@company.com',
 *     username: 'newstaff',
 *     password: 'SecurePassword123',
 *     display_name: 'New Staff Member',
 *     role: 'staff',
 *     tenant_id: '550e8400-e29b-41d4-a716-446655440000',
 *   },
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function createUser(
  request: CreateUserRequest,
  adminToken: string
): Promise<AuthServiceResponse<UserResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.CREATE_USER_ENDPOINT}`;

    console.log('👤 Creating user', {
      email: request.email,
      role: request.role,
      tenantId: request.tenant_id,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;

      console.error('❌ Create user failed', {
        status: response.status,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        code: `HTTP_${response.status}`,
      };
    }

    const data: UserResponse = await response.json();

    console.log('✅ User created successfully', {
      userId: data.user_id,
      email: data.email,
      role: data.role,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('❌ Auth service error - createUser', {
      error: errorMessage,
      email: request.email,
    });

    return {
      success: false,
      error: errorMessage,
      code: 'CREATE_USER_ERROR',
    };
  }
}

/**
 * Get user details (admin only)
 *
 * @param userId - User ID to retrieve
 * @param adminToken - JWT token of admin user
 * @returns User response
 *
 * @example
 * const response = await getUser(
 *   'user-uuid-here',
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function getUser(
  userId: string,
  adminToken: string
): Promise<AuthServiceResponse<UserResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.GET_USER_ENDPOINT.replace(
      '{user_id}',
      userId
    )}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get user: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data: UserResponse = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GET_USER_ERROR',
    };
  }
}

/**
 * Update user details (admin only)
 *
 * @param userId - User ID to update
 * @param request - Update details
 * @param adminToken - JWT token of admin user
 * @returns Updated user response
 *
 * @example
 * const response = await updateUser(
 *   'user-uuid-here',
 *   { display_name: 'Updated Name', status: 'active' },
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function updateUser(
  userId: string,
  request: UpdateUserRequest,
  adminToken: string
): Promise<AuthServiceResponse<UserResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.UPDATE_USER_ENDPOINT.replace(
      '{user_id}',
      userId
    )}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to update user: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data: UserResponse = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'UPDATE_USER_ERROR',
    };
  }
}

/**
 * Delete user (admin only)
 *
 * @param userId - User ID to delete
 * @param adminToken - JWT token of admin user
 * @returns Success message
 *
 * @example
 * const response = await deleteUser(
 *   'user-uuid-here',
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function deleteUser(
  userId: string,
  adminToken: string
): Promise<AuthServiceResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.DELETE_USER_ENDPOINT.replace(
      '{user_id}',
      userId
    )}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to delete user: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    return {
      success: true,
      data: { message: 'User deleted successfully' },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'DELETE_USER_ERROR',
    };
  }
}

/**
 * Change user password
 *
 * @param oldPassword - Current password
 * @param newPassword - New password
 * @param userToken - JWT token of user
 * @returns Success message
 *
 * @example
 * const response = await changePassword(
 *   'OldPassword123',
 *   'NewPassword456',
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  userToken: string
): Promise<AuthServiceResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.CHANGE_PASSWORD_ENDPOINT}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || 'Failed to change password',
        code: `HTTP_${response.status}`,
      };
    }

    return {
      success: true,
      data: { message: 'Password changed successfully' },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'CHANGE_PASSWORD_ERROR',
    };
  }
}

/**
 * Get current logged-in user from localStorage
 *
 * @returns Current user or null if not logged in
 */
export function getCurrentUser(): LoginResponse | null {
  try {
    const userJson = localStorage.getItem('currentUser');
    if (!userJson) return null;
    return JSON.parse(userJson) as LoginResponse;
  } catch (error) {
    console.error('Failed to parse current user:', error);
    return null;
  }
}

/**
 * Get JWT token from localStorage
 *
 * @returns JWT token or null if not logged in
 */
export function getJWTToken(): string | null {
  return localStorage.getItem('jwtToken');
}

/**
 * Check if user is authenticated
 *
 * @returns True if user has valid token
 */
export function isAuthenticated(): boolean {
  return !!getJWTToken() && !!getCurrentUser();
}

/**
 * Check if current user has a specific role
 *
 * @param requiredRole - Role to check
 * @returns True if user has this role
 */
export function hasRole(requiredRole: string): boolean {
  const user = getCurrentUser();
  return user?.role === requiredRole;
}

/**
 * Decode JWT token to extract payload (without verification)
 * Note: This is for client-side use only. Always verify on the server.
 *
 * @param token - JWT token
 * @returns Decoded payload or null if invalid
 */
function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = atob(parts[1]);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Get user role from JWT token
 * Prefers JWT decoding over localStorage for security
 *
 * @returns User role or null
 */
export function getUserRole(): string | null {
  const token = getJWTToken();
  if (token) {
    const payload = decodeJWT(token);
    if (payload?.role) {
      return payload.role;
    }
  }

  // Fallback to localStorage
  const user = getCurrentUser();
  return user?.role || null;
}

/**
 * Check if current user is admin
 *
 * @returns True if user is admin
 */
export function isAdmin(): boolean {
  return getUserRole() === 'admin';
}

/**
 * Check if current user is staff
 *
 * @returns True if user is staff
 */
export function isStaff(): boolean {
  return getUserRole() === 'staff' || getUserRole() === 'supporter';
}

/**
 * Logout user
 *
 * Clears localStorage and session data.
 */
export function logout(): void {
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('currentUser');
  console.log('✅ User logged out');
}

/**
 * Set the API base URL (useful for testing or dynamic configuration)
 *
 * @param baseUrl - New base URL
 */
export function setApiBaseUrl(baseUrl: string): void {
  API_CONFIG.BASE_URL = baseUrl;
}

/**
 * Get current API base URL
 */
export function getApiBaseUrl(): string {
  return API_CONFIG.BASE_URL;
}

export default {
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
};
