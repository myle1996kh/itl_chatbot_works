/**
 * Escalation Service - Thin wrapper around escalation API endpoints
 *
 * Handles:
 * - Auto-escalation keyword detection
 * - Manual escalation requests
 * - Supporter assignment
 * - Escalation resolution
 * - Escalation queue management
 */

import { getJWTToken, setApiBaseUrl, getApiBaseUrl } from './authService';

// Type definitions
export interface AutoEscalationDetectionResponse {
  should_escalate: boolean;
  detected_keywords: string[];
  confidence: number;
  reason?: string;
}

export interface EscalationResponse {
  session_id: string;
  tenant_id: string;
  user_id: string;
  escalation_status: string;
  escalation_reason: string;
  assigned_user_id?: string;
  escalation_requested_at: string;
  escalation_assigned_at?: string;
  created_at: string;
}

export interface EscalationQueueResponse {
  pending_count: number;
  assigned_count: number;
  resolved_count: number;
  escalations: EscalationResponse[];
}

export interface Supporter {
  supporter_id: string;
  email: string;
  username: string;
  display_name: string;
  status: string;
  created_at?: string;
}

export interface SupportersResponse {
  success: boolean;
  supporters: Supporter[];
  total: number;
}

// API Base URL
let API_BASE_URL = getApiBaseUrl() || 'http://localhost:8000';

export function setEscalationApiBaseUrl(url: string): void {
  API_BASE_URL = url;
  setApiBaseUrl(url);
}

export function getEscalationApiBaseUrl(): string {
  return API_BASE_URL;
}

// ============================================================================
// AUTO-ESCALATION DETECTION
// ============================================================================

/**
 * Detect if a message should trigger auto-escalation
 *
 * @param message - User message to analyze
 * @param keywords - Optional custom keywords to check
 * @returns AutoEscalationDetectionResponse
 */
export async function detectAutoEscalation(
  message: string,
  keywords?: string[],
  jwt?: string
): Promise<AutoEscalationDetectionResponse> {
  try {
    const token = jwt || getJWTToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/escalations/detect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          keywords,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to detect auto-escalation: ${response.status}`
      );
    }

    const data = await response.json();
    return data as AutoEscalationDetectionResponse;
  } catch (error) {
    console.error('detectAutoEscalation error:', error);
    throw error;
  }
}

// ============================================================================
// MANUAL ESCALATION
// ============================================================================

/**
 * PUBLIC: Escalate a chat session (for widget users - no admin auth required)
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @param reason - Reason for escalation
 * @returns Public escalation response
 */
export async function escalateSessionPublic(
  tenantId: string,
  sessionId: string,
  reason: string
): Promise<{success: boolean; session_id: string; escalation_status: string; message: string}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/${tenantId}/session/${sessionId}/escalate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          reason,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to escalate session: ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('escalateSessionPublic error:', error);
    throw error;
  }
}

/**
 * ADMIN: Escalate a chat session to require human support (requires admin auth)
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @param reason - Reason for escalation
 * @param autoDetected - Whether escalation was auto-detected
 * @param keywords - Keywords that triggered auto-escalation
 * @returns EscalationResponse
 */
export async function escalateSession(
  tenantId: string,
  sessionId: string,
  reason: string,
  autoDetected: boolean = false,
  keywords?: string[],
  jwt?: string
): Promise<EscalationResponse> {
  try {
    const token = jwt || getJWTToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/escalations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          reason,
          auto_detected: autoDetected,
          keywords,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to escalate session: ${response.status}`
      );
    }

    const data = await response.json();
    return data as EscalationResponse;
  } catch (error) {
    console.error('escalateSession error:', error);
    throw error;
  }
}

// ============================================================================
// SUPPORTER ASSIGNMENT
// ============================================================================

/**
 * Assign a supporter to an escalated session
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @param supporterId - UUID of the supporter to assign
 * @returns EscalationResponse
 */
export async function assignSupporter(
  tenantId: string,
  sessionId: string,
  supporterId: string
): Promise<EscalationResponse> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/escalations/assign`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: supporterId,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to assign supporter: ${response.status}`
      );
    }

    const data = await response.json();
    return data as EscalationResponse;
  } catch (error) {
    console.error('assignSupporter error:', error);
    throw error;
  }
}

// ============================================================================
// ESCALATION RESOLUTION
// ============================================================================

/**
 * Mark an escalation as resolved
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @param resolutionNotes - Optional notes on resolution
 * @returns EscalationResponse
 */
export async function resolveEscalation(
  tenantId: string,
  sessionId: string,
  resolutionNotes?: string
): Promise<EscalationResponse> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/escalations/resolve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          resolution_notes: resolutionNotes,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to resolve escalation: ${response.status}`
      );
    }

    const data = await response.json();
    return data as EscalationResponse;
  } catch (error) {
    console.error('resolveEscalation error:', error);
    throw error;
  }
}

// ============================================================================
// ESCALATION QUEUE
// ============================================================================

/**
 * Get escalation queue for a tenant
 *
 * @param tenantId - UUID of the tenant
 * @param status - Optional filter by status (pending, assigned, resolved)
 * @returns EscalationQueueResponse
 */
export async function getEscalationQueue(
  tenantId: string,
  status?: string
): Promise<EscalationQueueResponse> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = new URL(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/escalations`
    );
    if (status) {
      url.searchParams.append('status', status);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to get escalation queue: ${response.status}`
      );
    }

    const data = await response.json();
    return data as EscalationQueueResponse;
  } catch (error) {
    console.error('getEscalationQueue error:', error);
    throw error;
  }
}

/**
 * Get pending escalations
 *
 * @param tenantId - UUID of the tenant
 * @returns EscalationQueueResponse
 */
export async function getPendingEscalations(
  tenantId: string
): Promise<EscalationQueueResponse> {
  return getEscalationQueue(tenantId, 'pending');
}

/**
 * Get assigned escalations
 *
 * @param tenantId - UUID of the tenant
 * @returns EscalationQueueResponse
 */
export async function getAssignedEscalations(
  tenantId: string
): Promise<EscalationQueueResponse> {
  return getEscalationQueue(tenantId, 'assigned');
}

/**
 * Get resolved escalations
 *
 * @param tenantId - UUID of the tenant
 * @returns EscalationQueueResponse
 */
export async function getResolvedEscalations(
  tenantId: string
): Promise<EscalationQueueResponse> {
  return getEscalationQueue(tenantId, 'resolved');
}

// ============================================================================
// SUPPORTER MANAGEMENT
// ============================================================================

/**
 * Get list of supporters for a tenant
 *
 * @param tenantId - UUID of the tenant
 * @returns SupportersResponse
 */
export async function getSupporters(
  tenantId: string
): Promise<SupportersResponse> {
  try {
    const token = getJWTToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/tenants/${tenantId}/staff`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `Failed to get supporters: ${response.status}`
      );
    }

    const data = await response.json();
    // Map staff response to Supporter format (user_id -> supporter_id)
    const supporters: Supporter[] = (data.staff || []).map((staff: any) => ({
      supporter_id: staff.user_id,
      email: staff.email,
      username: staff.username,
      display_name: staff.display_name,
      status: staff.supporter_status,
      created_at: staff.created_at,
    }));

    return {
      success: true,
      supporters: supporters,
      total: data.total,
    };
  } catch (error) {
    console.error('getSupporters error:', error);
    throw error;
  }
}
