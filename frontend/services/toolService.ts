import axios from 'axios';
import { getJWTToken } from './authService';

const API_URL = 'http://localhost:8000/api/admin';

export interface BaseTool {
    base_tool_id: string;
    tool_type: string;
    description: string;
}

export interface Tool {
    tool_id: string;
    base_tool_id: string;
    name: string;
    description: string;
    config: Record<string, any>;
    input_schema: Record<string, any>;
    is_active: boolean;
    created_at: string;
    base_tool?: BaseTool;
}

export interface CreateToolRequest {
    base_tool_id: string;
    name: string;
    description: string;
    config: Record<string, any>;
    input_schema: Record<string, any>;
    is_active: boolean;
}

export interface UpdateToolRequest {
    name?: string;
    description?: string;
    config?: Record<string, any>;
    input_schema?: Record<string, any>;
    is_active?: boolean;
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

export const getTools = async (isActive?: boolean): Promise<Tool[]> => {
    try {
        const params: any = {};
        if (isActive !== undefined) {
            params.is_active = isActive;
        }
        const response = await axios.get(`${API_URL}/tools`, {
            ...getAuthHeaders(),
            params,
        });
        return response.data.tools;
    } catch (error) {
        console.error('Error fetching tools:', error);
        throw error;
    }
};

export const getBaseTools = async (): Promise<BaseTool[]> => {
    try {
        const response = await axios.get(`${API_URL}/base-tools`, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error('Error fetching base tools:', error);
        throw error;
    }
};

export const getTool = async (toolId: string): Promise<Tool> => {
    try {
        const response = await axios.get(`${API_URL}/tools/${toolId}`, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error(`Error fetching tool ${toolId}:`, error);
        throw error;
    }
};

export const createTool = async (toolData: CreateToolRequest): Promise<Tool> => {
    try {
        const response = await axios.post(`${API_URL}/tools`, toolData, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error('Error creating tool:', error);
        throw error;
    }
};

export const updateTool = async (toolId: string, toolData: UpdateToolRequest): Promise<Tool> => {
    try {
        const response = await axios.patch(`${API_URL}/tools/${toolId}`, toolData, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error(`Error updating tool ${toolId}:`, error);
        throw error;
    }
};

