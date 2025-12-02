/**
 * Admin Service - Fetches real tenant and session data from backend APIs
 */

import { Tenant, Supporter, ChatSession } from '../types';

const API_BASE_URL = 'http://localhost:8000';

// ============================================================================
// Types
// ============================================================================

export interface TenantListResponse {
  total: number;
  tenants: Array<{
    tenant_id: string;
    name: string;
    domain: string;
    status: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

export interface SupporterListResponse {
  success: boolean;
  supporters: Array<{
    supporter_id: string;
    display_name: string;
    email: string;
    tenant_id: string;
  }>;
}

export interface SessionListResponse {
  sessions: Array<{
    session_id: string;
    user_id: string;
    tenant_id: string;
    created_at: string;
    last_message_at: string;
  }>;
}

export interface UserListResponse {
  success: boolean;
  users: Array<{
    user_id: string;
    email: string;
    username: string;
    display_name?: string;
    role: string;
    status: string;
    tenant_id: string;
    created_at?: string;
    last_login?: string;
  }>;
  total: number;
  skip: number;
  limit: number;
}

export interface SupporterCreateResponse {
  success: boolean;
  supporter: {
    supporter_id: string;
    user_id: string;
    tenant_id: string;
    email: string;
    username: string;
    display_name?: string;
    status: string;
    max_concurrent_sessions: number;
    current_sessions_count: number;
    created_at?: string;
  };
}

export interface SupporterUpdateResponse {
  success: boolean;
  supporter: {
    supporter_id: string;
    user_id: string;
    tenant_id: string;
    email: string;
    username: string;
    display_name?: string;
    status: string;
    max_concurrent_sessions: number;
    current_sessions_count: number;
    updated_at?: string;
  };
}

export interface User {
  user_id: string;
  email: string;
  username: string;
  display_name?: string;
  role: string;
  status: string;
  tenant_id: string;
  created_at?: string;
  last_login?: string;
}

// ============================================================================
// Admin Service Functions
// ============================================================================

/**
 * Get all tenants from backend
 */
export async function getTenants(jwt: string): Promise<Tenant[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/tenants`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch tenants: ${response.status}`);
      return [];
    }

    const data: TenantListResponse = await response.json();

    // Convert backend response to frontend Tenant format
    return data.tenants.map(t => ({
      id: t.tenant_id,
      name: t.name,
      config: {
        apiUrl: `${API_BASE_URL}/api/${t.tenant_id}`,
        apiKey: '', // API key not exposed in response for security
      },
      theme: {
        primaryColor: 'indigo-600',
        headerText: `${t.name} Support`,
        welcomeMessage: `Chào mừng bạn đến với hệ thống hỗ trợ của ${t.name}`,
      },
      topics: [],  // Topics loaded separately if needed
    }));
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return [];
  }
}

/**
 * Get supporters for a specific tenant
 */
export async function getSupporters(
  tenantId: string,
  jwt: string
): Promise<Supporter[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/staff`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch supporters for tenant ${tenantId}: ${response.status}`);
      return [];
    }

    const data: any = await response.json();

    if (!data.success) {
      return [];
    }

    // Convert backend response to frontend Supporter format
    // Backend returns staff users with role='supporter'
    return data.staff.map((s: any) => ({
      id: s.user_id,
      name: s.display_name || s.username,
      tenantId: tenantId,
    }));
  } catch (error) {
    console.error(`Error fetching supporters for tenant ${tenantId}:`, error);
    return [];
  }
}

/**
 * Get chat sessions for a specific tenant
 */
export async function getSessions(
  tenantId: string,
  jwt: string
): Promise<ChatSession[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/${tenantId}/sessions`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch sessions for tenant ${tenantId}: ${response.status}`);
      return [];
    }

    const data: SessionListResponse = await response.json();

    // Convert backend response to frontend ChatSession format
    return data.sessions.map(s => ({
      id: s.session_id,
      tenantId: s.tenant_id,
      userEmail: s.user_id,
      messages: [],  // Messages loaded on demand
      assignedSupporterId: null,
      lastActivity: s.last_message_at || s.created_at,
    }));
  } catch (error) {
    console.error(`Error fetching sessions for tenant ${tenantId}:`, error);
    return [];
  }
}

/**
 * Get messages for a specific session
 */
export async function getSessionMessages(
  tenantId: string,
  sessionId: string,
  jwt: string
): Promise<any[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/${tenantId}/sessions/${sessionId}/supporter-chat`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch messages for session ${sessionId}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error(`Error fetching messages for session ${sessionId}:`, error);
    return [];
  }
}

/**
 * Get all users with optional filtering
 */
export async function listUsers(
  jwt: string,
  filters?: {
    tenant_id?: string;
    role?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }
): Promise<User[]> {
  try {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.tenant_id) params.append('tenant_id', filters.tenant_id);
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status_filter', filters.status);
      if (filters.skip) params.append('skip', filters.skip.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const url = `${API_BASE_URL}/api/auth/users${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch users: ${response.status}`);
      return [];
    }

    const data: UserListResponse = await response.json();

    if (!data.success) {
      return [];
    }

    return data.users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Get users for a specific tenant
 */
export async function listTenantUsers(
  tenantId: string,
  jwt: string,
  filters?: {
    role?: string;
    skip?: number;
    limit?: number;
  }
): Promise<User[]> {
  try {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.role) params.append('role', filters.role);
      if (filters.skip) params.append('skip', filters.skip.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const url = `${API_BASE_URL}/api/auth/users/tenant/${tenantId}${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch tenant users: ${response.status}`);
      return [];
    }

    const data: UserListResponse = await response.json();

    if (!data.success) {
      return [];
    }

    return data.users;
  } catch (error) {
    console.error(`Error fetching users for tenant ${tenantId}:`, error);
    return [];
  }
}

/**
 * Create a new supporter
 */
export async function createSupporter(
  tenantId: string,
  userId: string,
  maxConcurrentSessions: number = 5,
  jwt: string
): Promise<any> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/supporters`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          max_concurrent_sessions: maxConcurrentSessions,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create supporter:', error);
      throw new Error(error.detail || 'Failed to create supporter');
    }

    const data: SupporterCreateResponse = await response.json();
    return data.supporter;
  } catch (error) {
    console.error('Error creating supporter:', error);
    throw error;
  }
}

/**
 * Update supporter settings
 */
export async function updateSupporter(
  tenantId: string,
  supporterId: string,
  updates: {
    status?: string;
    max_concurrent_sessions?: number;
  },
  jwt: string
): Promise<any> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/supporters/${supporterId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to update supporter:', error);
      throw new Error(error.detail || 'Failed to update supporter');
    }

    const data: SupporterUpdateResponse = await response.json();
    return data.supporter;
  } catch (error) {
    console.error('Error updating supporter:', error);
    throw error;
  }
}

/**
 * Delete a supporter
 */
export async function deleteSupporter(
  tenantId: string,
  supporterId: string,
  jwt: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/supporters/${supporterId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to delete supporter:', error);
      throw new Error(error.detail || 'Failed to delete supporter');
    }

    return true;
  } catch (error) {
    console.error('Error deleting supporter:', error);
    throw error;
  }
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend health check failed:', error);
    return false;
  }
}

export default {
  getTenants,
  getSupporters,
  getSessions,
  getSessionMessages,
  listUsers,
  listTenantUsers,
  createSupporter,
  updateSupporter,
  deleteSupporter,
  checkBackendHealth,
};
