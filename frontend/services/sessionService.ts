/**
 * Session Service - Fetch chat sessions from backend API
 *
 * Handles:
 * - Loading chat sessions for a tenant
 * - Loading session messages
 * - Session persistence
 */

import { getJWTToken, setApiBaseUrl, getApiBaseUrl, getCurrentUser } from './authService';
import { SessionSummary, SessionDetail } from '../types';

export interface SessionsListResponse {
  total: number;
  sessions: SessionSummary[];
}

// API Base URL
let API_BASE_URL = getApiBaseUrl() || 'http://localhost:8000';

function resolveBaseUrl(raw: string | null | undefined): string {
  try {
    const base = (raw && raw.trim()) ? raw : 'http://localhost:8000';
    const u = new URL(base);
    if (!u.port) u.port = '8000';
    return u.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:8000';
  }
}

export function setSessionApiBaseUrl(url: string): void {
  API_BASE_URL = url;
  setApiBaseUrl(url);
}

export function getSessionApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Get list of sessions for a user (requires auth)
 *
 * @param tenantId - UUID of the tenant
 * @param userId - User ID to filter sessions
 * @returns SessionSummary[]
 */
export async function getUserSessions(
  tenantId: string,
  userId: string,
  jwt?: string,
  options?: { limit?: number; offset?: number }
): Promise<SessionSummary[]> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = jwt || getJWTToken();
    if (!token) {
      console.warn('No JWT token available, cannot fetch sessions');
      return [];
    }

    const params = new URLSearchParams({
      user_id: userId,
      limit: String(options?.limit ?? 100),
      offset: String(options?.offset ?? 0),
    });

    const response = await fetch(
      `${base}/api/${tenantId}/session?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Unauthorized: JWT token may be expired');
        return [];
      }
      throw new Error(`Failed to fetch sessions: ${response.status}`);
    }

    const sessions = await response.json() as SessionSummary[];
    console.log(`Loaded ${sessions.length} sessions for user ${userId}`);
    return sessions;
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    return [];
  }
}

/**
 * Get list of all sessions for a tenant (admin only)
 *
 * Note: This requires an admin endpoint. Currently uses getUserSessions as fallback.
 *
 * @param tenantId - UUID of the tenant
 * @returns SessionSummary[]
 */
export async function getTenantSessions(tenantId: string): Promise<SessionSummary[]> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = getJWTToken();
    if (!token) {
      console.warn('No JWT token available, cannot fetch tenant sessions');
      return [];
    }

    const response = await fetch(
      `${base}/api/admin/tenants/${tenantId}/sessions`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch tenant sessions: HTTP ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
      console.error('Error details:', errorData);
      return [];
    }

    const data = await response.json() as { total: number; sessions: SessionSummary[] };
    console.log(`✅ Loaded ${data.sessions.length} sessions for tenant (total: ${data.total})`);
    return data.sessions;
  } catch (error) {
    console.error('Failed to get tenant sessions:', error);
    return [];
  }
}

/**
 * Get session details with all messages (ADMIN ONLY - use getSessionDetailPublic for supporters)
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @returns SessionDetail
 */
export async function getSessionDetail(
  tenantId: string,
  sessionId: string,
  jwt?: string
): Promise<SessionDetail | null> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = jwt || getJWTToken();
    if (!token) {
      console.warn('No JWT token available, cannot fetch session detail');
      return null;
    }

    const response = await fetch(
      `${base}/api/admin/tenants/${tenantId}/sessions/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Session ${sessionId} not found`);
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch session: HTTP ${response.status} - ${errorData.detail}`);
    }

    const session = await response.json() as SessionDetail;
    console.log(`✅ Loaded session ${sessionId} with ${session.messages?.length || 0} messages`);
    return session;
  } catch (error) {
    console.error(`Failed to get session detail for ${sessionId}:`, error);
    return null;
  }
}

/**
 * Get session details with all messages (PUBLIC - works for all authenticated users including supporters)
 *
 * Uses the non-admin endpoint so supporters and users can fetch their messages.
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @returns SessionDetail
 */
export async function getSessionDetailPublic(
  tenantId: string,
  sessionId: string,
  jwt?: string
): Promise<SessionDetail | null> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = jwt || getJWTToken();
    if (!token) {
      console.warn('No JWT token available, cannot fetch session detail');
      return null;
    }

    const response = await fetch(
      `${base}/api/${tenantId}/session/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Session ${sessionId} not found`);
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch session: HTTP ${response.status} - ${errorData.detail}`);
    }

    const session = await response.json() as SessionDetail;
    console.log(`✅ Loaded session ${sessionId} with ${session.messages?.length || 0} messages`);
    return session;
  } catch (error) {
    console.error(`Failed to get session detail for ${sessionId}:`, error);
    return null;
  }
}


/**
 * Get sessions assigned to a supporter
 *
 * This endpoint allows supporters to view their own assigned sessions.
 *
 * @param tenantId - UUID of the tenant
 * @param supporterId - UUID of the supporter
 * @returns Sessions assigned to the supporter
 */
export async function getSupporterSessions(
  tenantId: string,
  supporterId: string,
  status?: 'active' | 'waiting' | 'resolved',
  jwt?: string
): Promise<SessionSummary[]> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = jwt || getJWTToken();
    if (!token) {
      console.warn('❌ No JWT token available, cannot fetch supporter sessions');
      console.warn('🔍 Debug info:', {
        jwtToken: localStorage.getItem('jwtToken') ? '(exists)' : '(missing)',
        currentUser: localStorage.getItem('currentUser') ? '(exists)' : '(missing)',
      });
      return [];
    }
    console.log('✅ JWT token found, fetching supporter sessions...');

    const params = new URLSearchParams();
    if (status) {
      params.set('status', status);
    }

    const response = await fetch(
      `${base}/api/tenants/${tenantId}/supporters/${supporterId}/sessions${params.toString() ? `?${params.toString()}` : ''}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch supporter sessions: HTTP ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
      console.error('Error details:', errorData);
      return [];
    }

    const data = await response.json() as { total: number; sessions: SessionSummary[] };
    console.log(`✅ Loaded ${data.sessions.length} sessions for supporter (total: ${data.total})`);
    return data.sessions;
  } catch (error) {
    console.error('Failed to get supporter sessions:', error);
    return [];
  }
}

/**
 * Get sessions from backend database
 *
 * This function fetches sessions directly from the backend database.
 * It automatically selects the correct endpoint based on user role:
 * - If supporter: uses supporter endpoint to get assigned sessions
 * - If admin: uses admin endpoint to get all tenant sessions
 *
 * @param tenantId - UUID of the tenant
 * @param userId - Optional user ID to filter sessions (for non-admin users)
 * @returns Sessions from backend database
 */
export async function getSessionsWithFallback(
  tenantId: string,
  userId?: string
): Promise<SessionSummary[]> {
  // Get current user to check role
  const currentUser = getCurrentUser();

  if (!currentUser) {
    console.warn('No current user found, cannot fetch sessions');
    return [];
  }

  // If user is a supporter, use the supporter endpoint
  if (currentUser.role === 'supporter' || currentUser.role === 'staff') {
    console.log('📌 User is a supporter/staff, using supporter endpoint');
    const sessions = await getSupporterSessions(tenantId, currentUser.user_id);
    if (sessions.length > 0) {
      console.log('✅ Loaded sessions from backend database (supporter endpoint)');
      return sessions;
    }
  } else if (currentUser.role === 'admin') {
    // If user is an admin, use the admin endpoint
    console.log('👨‍💼 User is admin, using admin endpoint');
    const sessions = await getTenantSessions(tenantId);
    if (sessions.length > 0) {
      console.log('✅ Loaded sessions from backend database (admin endpoint)');
      return sessions;
    }
  } else if (userId) {
    // Fallback: if specific userId provided, use that
    const sessions = await getUserSessions(tenantId, userId);
    if (sessions.length > 0) {
      console.log('✅ Loaded sessions from backend database');
      return sessions;
    }
  }

  console.log('ℹ️ No sessions found in backend database');
  return [];
}

/**
 * Send a supporter message to a session
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @param message - Message text from supporter
 * @returns Message response
 */
export async function sendSupporterMessage(
  tenantId: string,
  sessionId: string,
  message: string
): Promise<any> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = getJWTToken();
    if (!token) {
      throw new Error('No JWT token available');
    }

    const response = await fetch(
      `${base}/api/tenants/${tenantId}/supporter-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to send message: ${errorData.detail || response.status}`);
    }

    const data = await response.json();
    console.log('✅ Supporter message sent');
    return data;
  } catch (error) {
    console.error('Failed to send supporter message:', error);
    throw error;
  }
}
