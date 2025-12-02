/**
 * User Service - Manage system users (admin, supporter, tenant_user)
 *
 * Handles:
 * - Listing users
 * - Creating new users
 * - Updating user details
 * - Deleting users
 */

import { getJWTToken, getApiBaseUrl } from './authService';

export interface User {
  user_id: string;
  email: string;
  username: string;
  display_name?: string;
  role: 'admin' | 'supporter' | 'tenant_user' | 'staff';
  status: 'active' | 'inactive' | 'suspended';
  tenant_id: string;
  created_at: string;
  last_login?: string;
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  display_name?: string;
  role: string;
  tenant_id: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  display_name?: string;
  status?: string;
}

const API_BASE_URL = getApiBaseUrl() || 'http://localhost:8000';

/**
 * Get list of all users with optional filtering
 */
export async function listUsers(params?: {
  tenant_id?: string;
  role?: string;
  status_filter?: string;
  skip?: number;
  limit?: number;
}): Promise<{ success: boolean; users: User[]; total: number }> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const queryParams = new URLSearchParams();
    if (params?.tenant_id) queryParams.set('tenant_id', params.tenant_id);
    if (params?.role) queryParams.set('role', params.role);
    if (params?.status_filter) queryParams.set('status_filter', params.status_filter);
    if (params?.skip !== undefined) queryParams.set('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());

    const url = `${API_BASE_URL}/api/auth/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to list users: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('listUsers error:', error);
    throw error;
  }
}

/**
 * Get list of users for a specific tenant
 */
export async function listTenantUsers(
  tenantId: string,
  params?: { role?: string; status_filter?: string; skip?: number; limit?: number }
): Promise<{ success: boolean; users: User[]; total: number }> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const queryParams = new URLSearchParams();
    if (params?.role) queryParams.set('role', params.role);
    if (params?.status_filter) queryParams.set('status_filter', params.status_filter);
    if (params?.skip !== undefined) queryParams.set('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());

    const url = `${API_BASE_URL}/api/auth/users/tenant/${tenantId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to list tenant users: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('listTenantUsers error:', error);
    throw error;
  }
}

/**
 * Get user details by ID
 */
export async function getUser(userId: string): Promise<User> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to get user: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('getUser error:', error);
    throw error;
  }
}

/**
 * Create a new user
 */
export async function createUser(request: CreateUserRequest): Promise<User> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create user: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('createUser error:', error);
    throw error;
  }
}

/**
 * Update user details
 */
export async function updateUser(userId: string, request: UpdateUserRequest): Promise<User> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update user: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('updateUser error:', error);
    throw error;
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to delete user: ${response.status}`);
    }
  } catch (error) {
    console.error('deleteUser error:', error);
    throw error;
  }
}
