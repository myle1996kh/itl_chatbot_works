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
 * Clear tenant cache (useful after tenant updates)
 */
export function clearTenantCache(): void {
  localStorage.removeItem('tenants_cache');
  console.log('Tenant cache cleared');
}
