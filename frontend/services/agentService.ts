import axios from 'axios';
import { getJWTToken } from './authService';

const API_URL = 'http://localhost:8000/api/admin';

export interface AgentTool {
    tool_id: string;
    name: string;
    description: string;
}

export interface Agent {
    agent_id: string;
    name: string;
    description: string;
    prompt_template: string;
    llm_model_id: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
    tools: AgentTool[];
}

export interface CreateAgentRequest {
    name: string;
    description: string;
    prompt_template: string;
    llm_model_id: string;
    is_active: boolean;
    tool_ids: string[];
}

export interface UpdateAgentRequest {
    name?: string;
    description?: string;
    prompt_template?: string;
    llm_model_id?: string;
    is_active?: boolean;
    tool_ids?: string[];
}

export interface LLMModel {
    llm_model_id: string;
    provider: string;
    model_name: string;
    context_window: number;
    is_active: boolean;
    created_at: string;
}

const getAuthHeaders = () => {
    const token = getJWTToken();
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
};

export const getAgents = async (isActive?: boolean): Promise<Agent[]> => {
    try {
        const params: any = {};
        if (isActive !== undefined) {
            params.is_active = isActive;
        }
        const response = await axios.get(`${API_URL}/agents`, {
            ...getAuthHeaders(),
            params,
        });
        return response.data.agents;
    } catch (error) {
        console.error('Error fetching agents:', error);
        throw error;
    }
};

export const getAgent = async (agentId: string): Promise<Agent> => {
    try {
        const response = await axios.get(`${API_URL}/agents/${agentId}`, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error(`Error fetching agent ${agentId}:`, error);
        throw error;
    }
};

export const createAgent = async (agentData: CreateAgentRequest): Promise<Agent> => {
    try {
        const response = await axios.post(`${API_URL}/agents`, agentData, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error('Error creating agent:', error);
        throw error;
    }
};

export const updateAgent = async (agentId: string, agentData: UpdateAgentRequest): Promise<Agent> => {
    try {
        const response = await axios.patch(`${API_URL}/agents/${agentId}`, agentData, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error(`Error updating agent ${agentId}:`, error);
        throw error;
    }
};

export const reloadAgentsCache = async (tenantId?: string): Promise<void> => {
    try {
        const params: any = {};
        if (tenantId) {
            params.tenant_id = tenantId;
        }
        await axios.post(`${API_URL}/agents/reload`, {}, {
            ...getAuthHeaders(),
            params,
        });
    } catch (error) {
        console.error('Error reloading agent cache:', error);
        throw error;
    }
};

export const getLLMModels = async (): Promise<LLMModel[]> => {
    try {
        const response = await axios.get(`${API_URL}/llm-models`, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error('Error fetching LLM models:', error);
        throw error;
    }
};
