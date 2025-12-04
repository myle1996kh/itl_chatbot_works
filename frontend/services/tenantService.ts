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
export async function getTenant(tenantId: string, token?: string): Promise<TenantResponse | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}`,
      {
        method: 'GET',
        headers,
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

// ============================================================================
// WIDGET CONFIGURATION
// ============================================================================

export interface WidgetConfig {
  config_id: string;
  tenant_id: string;
  widget_key: string;
  theme: string;
  primary_color: string;
  position: string;
  custom_css?: string;
  auto_open: boolean;
  welcome_message: string;
  placeholder_text: string;
  allowed_domains: string[];
  max_session_duration?: number;
  rate_limit_per_minute?: number;
  enable_file_upload: boolean;
  enable_voice_input: boolean;
  enable_conversation_history: boolean;
  embed_script_url?: string;
  embed_code_snippet?: string;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfigUpdate {
  theme?: string;
  primary_color?: string;
  position?: string;
  custom_css?: string;
  auto_open?: boolean;
  welcome_message?: string;
  placeholder_text?: string;
  allowed_domains?: string[];
  max_session_duration?: number;
  rate_limit_per_minute?: number;
  enable_file_upload?: boolean;
  enable_voice_input?: boolean;
  enable_conversation_history?: boolean;
}

/**
 * Get widget configuration for a tenant
 */
export async function getWidgetConfig(tenantId: string, token: string): Promise<WidgetConfig> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/widget`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Widget configuration not found');
    }
    throw new Error(`Failed to fetch widget config: ${response.status}`);
  }

  return await response.json();
}

/**
 * Update widget configuration for a tenant
 */
export async function updateWidgetConfig(
  tenantId: string,
  data: WidgetConfigUpdate,
  token: string
): Promise<WidgetConfig> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/widget`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to update widget config: ${response.status}`);
  }

  return await response.json();
}

/**
 * Create widget configuration for a tenant (if not exists)
 */
export async function createWidgetConfig(tenantId: string, token: string): Promise<WidgetConfig> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/widget`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create widget config: ${response.status}`);
  }

  return await response.json();
}

/**
 * Regenerate widget keys for security rotation
 */
export async function regenerateWidgetKeys(tenantId: string, token: string): Promise<WidgetConfig> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/widget/regenerate-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to regenerate widget keys: ${response.status}`);
  }

  return await response.json();
}

// ============================================================================
// LLM CONFIGURATION
// ============================================================================

export interface LLMConfig {
  config_id: string;
  tenant_id: string;
  llm_model_id: string;
  provider: string;
  model_name: string;
  rate_limit_rpm: number;
  rate_limit_tpm: number;
  created_at: string;
  updated_at: string;
}

export interface LLMConfigUpdate {
  api_key?: string;
  rate_limit_rpm?: number;
  rate_limit_tpm?: number;
}

/**
 * Get LLM configuration for a tenant
 */
export async function getLLMConfig(tenantId: string, token: string): Promise<LLMConfig> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/llm-config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('LLM configuration not found');
    }
    throw new Error(`Failed to fetch LLM config: ${response.status}`);
  }

  return await response.json();
}

/**
 * Update LLM configuration for a tenant
 */
export async function updateLLMConfig(
  tenantId: string,
  data: LLMConfigUpdate,
  token: string
): Promise<LLMConfig> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenants/${tenantId}/llm-config`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to update LLM config: ${response.status}`);
  }

  return await response.json();
}
