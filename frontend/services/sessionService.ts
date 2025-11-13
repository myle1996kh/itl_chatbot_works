/**
 * Session Service - Fetch chat sessions from backend API
 *
 * Handles:
 * - Loading chat sessions for a tenant
 * - Loading session messages
 * - Session persistence
 */

import { getJWTToken, setApiBaseUrl, getApiBaseUrl } from './authService';

export interface Message {
  message_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SessionSummary {
  session_id: string;
  user_id: string;
  created_at: string;
  last_message_at?: string;
  message_count: number;
  last_message_preview: string;
  metadata?: Record<string, any>;
}

export interface SessionDetail {
  session_id: string;
  tenant_id: string;
  user_id: string;
  created_at: string;
  last_message_at?: string;
  escalation_status: string;
  escalation_reason?: string;
  escalation_requested_at?: string;
  assigned_supporter_id?: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

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
  userId: string
): Promise<SessionSummary[]> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = getJWTToken();
    if (!token) {
      console.warn('No JWT token available, cannot fetch sessions');
      return [];
    }

    const params = new URLSearchParams({
      user_id: userId,
      limit: '100',
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
 * Get session details with all messages
 *
 * @param tenantId - UUID of the tenant
 * @param sessionId - UUID of the session
 * @returns SessionDetail
 */
export async function getSessionDetail(
  tenantId: string,
  sessionId: string
): Promise<SessionDetail | null> {
  try {
    const base = resolveBaseUrl(API_BASE_URL);
    const token = getJWTToken();
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
 * Get sessions from backend database
 *
 * This function fetches sessions directly from the backend database.
 * No fallback to localStorage - database persistence is required.
 *
 * @param tenantId - UUID of the tenant
 * @param userId - Optional user ID to filter sessions
 * @returns Sessions from backend database
 */
export async function getSessionsWithFallback(
  tenantId: string,
  userId?: string
): Promise<SessionSummary[]> {
  // Fetch from backend database only
  if (userId) {
    const sessions = await getUserSessions(tenantId, userId);
    if (sessions.length > 0) {
      console.log('✅ Loaded sessions from backend database');
      return sessions;
    }
  } else {
    const sessions = await getTenantSessions(tenantId);
    if (sessions.length > 0) {
      console.log('✅ Loaded sessions from backend database');
      return sessions;
    }
  }

  console.log('ℹ️ No sessions found in backend database');
  return [];
}
