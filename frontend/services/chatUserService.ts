/**
 * Chat User Service
 *
 * Handles customer/end-user account management.
 * Creates or retrieves chat users, creates sessions, and ends sessions.
 */

const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  TIMEOUT_MS: 30000,
};

export interface ChatUser {
  user_id: string;
  tenant_id: string;
  email: string;
  username: string;
  department?: string;
  created_at: string;
  last_active: string;
}

export interface SessionInfo {
  session_id: string;
  user_id: string;
  tenant_id: string;
  created_at: string;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Create or get existing chat user from UserInfoForm data
 */
export async function createOrGetChatUser(
  tenantId: string,
  email: string,
  username: string,
  department?: string
): Promise<ServiceResponse<ChatUser>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/${tenantId}/chat_users`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        username,
        department: department || null,
      }),
      timeout: API_CONFIG.TIMEOUT_MS,
    } as RequestInit);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || `Failed to create user: ${response.statusText}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    console.log('✅ Chat user created/retrieved:', {
      user_id: data.user_id,
      email: data.email,
      username: data.username,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Create chat user error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get chat user by email (for returning visitors)
 */
export async function getChatUserByEmail(
  tenantId: string,
  email: string
): Promise<ServiceResponse<ChatUser>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/${tenantId}/chat_users/${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: API_CONFIG.TIMEOUT_MS,
    } as RequestInit);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || `Chat user not found`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    console.log('✅ Chat user retrieved:', {
      user_id: data.user_id,
      email: data.email,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Get chat user error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new chat session for a user
 */
export async function createSession(
  tenantId: string,
  userId: string,
  topic?: string
): Promise<ServiceResponse<SessionInfo>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/${tenantId}/sessions?user_id=${encodeURIComponent(userId)}`;

    const body: any = {};
    if (topic) {
      body.topic = topic;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      timeout: API_CONFIG.TIMEOUT_MS,
    } as RequestInit);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || `Failed to create session: ${response.statusText}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    console.log('✅ Chat session created:', {
      session_id: data.session_id,
      user_id: data.user_id,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Create session error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * End a chat session (mark as resolved)
 */
export async function endSession(
  tenantId: string,
  sessionId: string,
  feedback?: string
): Promise<ServiceResponse<any>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/${tenantId}/sessions/${sessionId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        feedback: feedback || null,
      }),
      timeout: API_CONFIG.TIMEOUT_MS,
    } as RequestInit);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || `Failed to end session: ${response.statusText}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    console.log('✅ Chat session ended:', {
      session_id: data.session_id,
      escalation_status: data.escalation_status,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ End session error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's session history with previews
 */
export async function getUserSessions(
  tenantId: string,
  userId: string
): Promise<ServiceResponse<any>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/${tenantId}/chat_users/${userId}/sessions`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: API_CONFIG.TIMEOUT_MS,
    } as RequestInit);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.detail || `Failed to get sessions: ${response.statusText}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    console.log('✅ User sessions retrieved:', {
      total: data.total_sessions,
      sessions: data.sessions.length,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Get sessions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
