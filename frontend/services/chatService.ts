/**
 * Chat Service
 *
 * Handles communication with the ITL Backend API for chat messages.
 * Supports direct agent routing via agent_name parameter (Phase 1).
 */

import { ChatRequest, ChatResponse } from '../types';
import { getAgentNameFromMessage } from '../src/config/topic-agent-mapping';

/**
 * API Configuration
 */
const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  CHAT_ENDPOINT: '/api/{tenant_id}/chat',
  TEST_CHAT_ENDPOINT: '/api/{tenant_id}/test/chat',
  LOGIN_ENDPOINT: '/api/auth/login',
  TIMEOUT_MS: 60000, // Increased from 30s to 60s for tool execution
};

/**
 * Chat Service Interface
 */
interface SendMessageParams {
  message: string;
  tenantId: string;
  sessionId?: string;
  userId?: string;
  agentName?: string; // Optional: if provided, routes directly to this agent
  jwt?: string; // Optional: JWT token for authentication
  useTestEndpoint?: boolean; // Optional: use /test/chat endpoint for testing
}

interface ChatServiceResponse {
  success: boolean;
  data?: ChatResponse;
  error?: string;
  code?: string;
}

/**
 * Send a chat message to the backend
 *
 * This function sends a message to the ITL Backend, optionally specifying
 * an agent to route to directly. If no agent is specified, the backend's
 * SupervisorAgent will perform intent detection and routing.
 *
 * @param params - Send message parameters
 * @returns Chat response from backend
 *
 * @example
 * // Send message with automatic agent detection (SupervisorAgent)
 * const response = await sendMessage({
 *   message: 'Where is my order?',
 *   tenantId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 *
 * @example
 * // Send message directly to ShipmentAgent
 * const response = await sendMessage({
 *   message: 'Where is my order?',
 *   tenantId: '550e8400-e29b-41d4-a716-446655440000',
 *   agentName: 'ShipmentAgent',
 * });
 */
export async function sendMessage(params: SendMessageParams): Promise<ChatServiceResponse> {
  try {
    // Auto-detect agent name if not provided
    const agentName = params.agentName || getAgentNameFromMessage(params.message);

    // Build the request payload
    const requestBody = {
      message: params.message,
      user_id: params.userId || 'default_user',
      session_id: params.sessionId || null,
      agent_name: agentName, // Phase 1: Direct routing parameter
      metadata: params.jwt
        ? {
          jwt_token: params.jwt,
        }
        : {},
    };

    // Determine endpoint
    const endpoint = params.useTestEndpoint
      ? API_CONFIG.TEST_CHAT_ENDPOINT
      : API_CONFIG.CHAT_ENDPOINT;

    const url = `${API_CONFIG.BASE_URL}${endpoint.replace('{tenant_id}', params.tenantId)}`;

    console.log('🚀 Sending chat message', {
      url,
      agentName,
      message: params.message.substring(0, 50) + '...',
    });

    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.jwt && { Authorization: `Bearer ${params.jwt}` }),
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;

      console.error('❌ Chat API error', {
        status: response.status,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        code: `HTTP_${response.status}`,
      };
    }

    const data: ChatResponse = await response.json();

    console.log('✅ Chat response received', {
      agentName: data.agent,
      sessionId: data.session_id,
      intent: data.intent,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('❌ Chat service error', {
      error: errorMessage,
      params: {
        message: params.message.substring(0, 50),
        tenantId: params.tenantId,
        agentName: params.agentName,
      },
    });

    return {
      success: false,
      error: errorMessage,
      code: 'CHAT_SERVICE_ERROR',
    };
  }
}

/**
 * Login to the system
 *
 * @param email - User email
 * @param password - User password
 * @param tenantId - Tenant ID
 * @returns Login response with JWT token
 */
export async function login(
  email: string,
  password: string,
  tenantId: string
): Promise<ChatServiceResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.LOGIN_ENDPOINT}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        tenant_id: tenantId,
      }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || 'Login failed',
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
      code: 'LOGIN_ERROR',
    };
  }
}

/**
 * Get chat history for a session
 *
 * @param tenantId - Tenant ID
 * @param sessionId - Session ID
 * @param jwt - JWT token for authentication
 * @returns Session details with message history
 */
export async function getSessionHistory(
  tenantId: string,
  sessionId: string,
  jwt?: string
): Promise<ChatServiceResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/${tenantId}/session?user_id=default_user`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get session history: HTTP ${response.status}`,
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
      code: 'GET_SESSION_ERROR',
    };
  }
}

/**
 * Health check - verify backend is accessible
 *
 * @returns Health status
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const url = `${API_CONFIG.BASE_URL}/health`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Set the API base URL (useful for testing or dynamic configuration)
 *
 * @param baseUrl - New base URL
 */
export function setApiBaseUrl(baseUrl: string): void {
  API_CONFIG.BASE_URL = baseUrl;
}

/**
 * Get current API base URL
 */
export function getApiBaseUrl(): string {
  return API_CONFIG.BASE_URL;
}

export default {
  sendMessage,
  login,
  getSessionHistory,
  healthCheck,
  setApiBaseUrl,
  getApiBaseUrl,
};
