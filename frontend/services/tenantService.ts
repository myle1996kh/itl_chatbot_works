/**
 * Tenant Service - Fetch tenant data from backend API
 *
 * Handles:
 * - Loading list of active tenants from database
 * - Fetching tenant configuration
 * - Caching tenant data in localStorage
 */

import { setApiBaseUrl, getApiBaseUrl } from './authService';

export interface TenantResponse {
  tenant_id: string;
  name: string;
  domain: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface TenantsListResponse {
  total: number;
  tenants: TenantResponse[];
}

// API Base URL
let API_BASE_URL = getApiBaseUrl() || 'http://localhost:8000';

export function setTenantApiBaseUrl(url: string): void {
  API_BASE_URL = url;
  setApiBaseUrl(url);
}

export function getTenantApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Get list of all active tenants from backend
 *
 * @returns TenantsListResponse with list of tenants
 */
export async function getTenants(): Promise<TenantResponse[]> {
  try {
    // Check cache first
    const cached = localStorage.getItem('tenants_cache');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Use cache if less than 5 minutes old
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        console.log('Using cached tenants');
        return data;
      }
    }

    // Fetch from backend - public endpoint (no auth required)
    const response = await fetch(
      `${API_BASE_URL}/api/auth/tenants`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tenants: ${response.status}`);
    }

    const result = await response.json() as TenantsListResponse;
    const tenants = result.tenants || [];

    // Cache tenants
    localStorage.setItem(
      'tenants_cache',
      JSON.stringify({
        data: tenants,
        timestamp: Date.now(),
      })
    );

    console.log(`Loaded ${tenants.length} tenants from backend`);
    return tenants;
  } catch (error) {
    console.error('Failed to get tenants:', error);
    // Return fallback to empty array
    return [];
  }
}

/**
 * Get a single tenant by ID
 *
 * @param tenantId - UUID of the tenant
 * @returns TenantResponse
 */
export async function getTenant(tenantId: string): Promise<TenantResponse | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch tenant: ${response.status}`);
    }

    const data = await response.json() as TenantResponse;
    return data;
  } catch (error) {
    console.error(`Failed to get tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Create a new tenant
 */
export async function createTenant(data: { name: string; domain?: string }, token: string): Promise<TenantResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to create tenant: ${response.status}`);
  }

  clearTenantCache();
  return await response.json();
}

/**
 * Update an existing tenant
 */
export async function updateTenant(tenantId: string, data: { name?: string; domain?: string; status?: string }, token: string): Promise<TenantResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to update tenant: ${response.status}`);
  }

  clearTenantCache();
  return await response.json();
}

/**
 * Delete a tenant
 */
export async function deleteTenant(tenantId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete tenant: ${response.status}`);
  }

  clearTenantCache();
}

/**
 * Clear tenant cache (useful after tenant updates)
 */
export function clearTenantCache(): void {
  localStorage.removeItem('tenants_cache');
  console.log('Tenant cache cleared');
}

// ============================================================================
// FULL TENANT SETUP
// ============================================================================

export interface LLMConfigCreate {
  provider: string;
  model_name: string;
  api_key: string;
  rate_limit_rpm?: number;
  rate_limit_tpm?: number;
}

export interface TenantFullCreateRequest {
  name: string;
  domain: string;
  status?: string;
  llm_config: LLMConfigCreate;
  agent_ids?: string[];
  tool_ids?: string[];
}

export interface TenantFullResponse {
  tenant_id: string;
  name: string;
  domain: string;
  status: string;
  llm_config_id: string;
  enabled_agents: number;
  enabled_tools: number;
  widget_key: string;
  embed_code: string;
  created_at: string;
}

/**
 * Create a full tenant with LLM config and permissions
 */
export async function createTenantFull(data: TenantFullCreateRequest, token: string): Promise<TenantFullResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/create-new`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create tenant: ${response.status}`);
  }

  clearTenantCache();
  return await response.json();
}

/**
 * Get list of available LLM models
 */
export async function getLLMModels(token: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/llm-models`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch LLM models: ${response.status}`);
  }

  const data = await response.json();
  // Backend returns array directly, not wrapped in {models: []}
  return Array.isArray(data) ? data : (data.models || []);
}

/**
 * Get tenant permissions (enabled agents/tools)
 */
export async function getTenantPermissions(tenantId: string, token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/permissions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tenant permissions: ${response.status}`);
  }

  return await response.json();
}

/**
 * Update tenant permissions
 */
export async function updateTenantPermissions(
  tenantId: string,
  data: { agent_permissions?: any[]; tool_permissions?: any[] },
  token: string
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/permissions`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to update tenant permissions: ${response.status}`);
  }

  return await response.json();
}
