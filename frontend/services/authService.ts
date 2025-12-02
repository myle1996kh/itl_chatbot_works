/**
 * Authentication Service
 *
 * Handles communication with the ITL Backend API for user authentication,
 * login, user management, and session management.
 * Supports multiple user roles: tenant_user, supporter, admin
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
  tenant_id?: string;
}

export interface LoginResponse {
  user_id: string;
  email: string;
  username: string;
  display_name?: string;
  role: string; // 'tenant_user', 'supporter', 'admin'
  tenant_id: string;
  token: string;
  status: string; // 'active', 'inactive', 'suspended'
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
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

export interface UserResponse {
  user_id: string;
  email: string;
  username: string;
  display_name?: string;
  role: string; // 'tenant_user', 'supporter', 'admin'
  tenant_id: string;
  status: string; // 'active', 'inactive', 'suspended'
  created_at?: string;
  last_login?: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  display_name?: string;
  role?: string;
  status?: string;
  tenant_id?: string;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
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
 */
export async function login(
  username: string,
  password: string,
  tenantId?: string
): Promise<AuthServiceResponse<LoginResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.LOGIN_ENDPOINT}`;

    const payload: LoginRequest = { username, password };
    if (tenantId) {
      payload.tenant_id = tenantId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as any).detail || (errorData as any).message || `HTTP ${response.status}: ${response.statusText}`;

      return {
        success: false,
        error: errorMessage,
        code: `HTTP_${response.status}`,
      };
    }

    const data: LoginResponse = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      code: 'LOGIN_ERROR',
    };
  }
}

export async function createUser(
  request: CreateUserRequest,
  adminToken: string
): Promise<AuthServiceResponse<UserResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.CREATE_USER_ENDPOINT}`;

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
        (errorData as any).detail || (errorData as any).message || `HTTP ${response.status}: ${response.statusText}`;

      return {
        success: false,
        error: errorMessage,
        code: `HTTP_${response.status}`,
      };
    }

    const data: UserResponse = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: errorMessage,
      code: 'CREATE_USER_ERROR',
    };
  }
}

export async function getUser(
  userId: string,
  adminToken: string
): Promise<AuthServiceResponse<UserResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.GET_USER_ENDPOINT.replace('{user_id}', userId)}`;

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

export async function getUsers(
  adminToken: string
): Promise<AuthServiceResponse<UserListResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/auth/users`;

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
        error: `Failed to get users: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GET_USERS_ERROR',
    };
  }
}

export async function updateUser(
  userId: string,
  request: UpdateUserRequest,
  adminToken: string
): Promise<AuthServiceResponse<UserResponse>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.UPDATE_USER_ENDPOINT.replace('{user_id}', userId)}`;

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

export async function deleteUser(
  userId: string,
  adminToken: string
): Promise<AuthServiceResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.DELETE_USER_ENDPOINT.replace('{user_id}', userId)}`;

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
        error: (errorData as any).detail || 'Failed to change password',
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

export function getJWTToken(): string | null {
  return localStorage.getItem('jwtToken');
}

export function isAuthenticated(): boolean {
  return !!getJWTToken() && !!getCurrentUser();
}

export function hasRole(requiredRole: string): boolean {
  const user = getCurrentUser();
  return user?.role === requiredRole;
}

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

export function getUserRole(): string | null {
  const token = getJWTToken();
  if (token) {
    const payload = decodeJWT(token);
    if (payload?.role) {
      return payload.role;
    }
  }

  const user = getCurrentUser();
  return user?.role || null;
}

export function isAdmin(): boolean {
  return getUserRole() === 'admin';
}

export function isSupporter(): boolean {
  return getUserRole() === 'supporter';
}

export function logout(): void {
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('currentUser');
  console.log('User logged out');
}

export function setApiBaseUrl(baseUrl: string): void {
  API_CONFIG.BASE_URL = baseUrl;
}

export function getApiBaseUrl(): string {
  return API_CONFIG.BASE_URL;
}

export default {
  login,
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  changePassword,
  getCurrentUser,
  getJWTToken,
  isAuthenticated,
  hasRole,
  isAdmin,
  isSupporter,
  logout,
  setApiBaseUrl,
  getApiBaseUrl,
};
