import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
    PlusIcon,
    PencilIcon,
    ArrowPathIcon,
    CpuChipIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
    XCircleIcon
} from '../../components/icons';
import {
    getAgents,
    createAgent,
    updateAgent,
    reloadAgentsCache,
    getLLMModels,
    Agent,
    LLMModel,
    CreateAgentRequest
} from '../../services/agentService';
import { getTools, Tool } from '../../services/toolService';

const AgentManagementPage: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
    const [availableTools, setAvailableTools] = useState<Tool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

    // Form State
    const [formData, setFormData] = useState<CreateAgentRequest>({
        name: '',
        description: '',
        prompt_template: '',
        llm_model_id: '',
        is_active: true,
        tool_ids: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [agentsData, modelsData, toolsData] = await Promise.all([
                getAgents(),
                getLLMModels(),
                getTools(true) // Only active tools
            ]);
            setAgents(agentsData);
            setLlmModels(modelsData);
            setAvailableTools(toolsData);
            setError(null);
        } catch (err) {
            setError('Failed to load data. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleReloadCache = async () => {
        try {
            await reloadAgentsCache();
            alert('Agent cache reloaded successfully!');
        } catch (err) {
            alert('Failed to reload cache.');
        }
    };

    const handleOpenModal = (agent?: Agent) => {
        if (agent) {
            setEditingAgent(agent);
            setFormData({
                name: agent.name,
                description: agent.description,
                prompt_template: agent.prompt_template,
                llm_model_id: agent.llm_model_id,
                is_active: agent.is_active,
                tool_ids: agent.tools.map(t => t.tool_id)
            });
        } else {
            setEditingAgent(null);
            setFormData({
                name: '',
                description: '',
                prompt_template: '',
                llm_model_id: llmModels.length > 0 ? llmModels[0].llm_model_id : '',
                is_active: true,
                tool_ids: []
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAgent) {
                await updateAgent(editingAgent.agent_id, formData);
            } else {
                await createAgent(formData);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            alert('Failed to save agent. Please check your inputs.');
        }
    };

    const toggleTool = (toolId: string) => {
        setFormData(prev => {
            const newToolIds = prev.tool_ids.includes(toolId)
                ? prev.tool_ids.filter(id => id !== toolId)
                : [...prev.tool_ids, toolId];
            return { ...prev, tool_ids: newToolIds };
        });
    };

    if (loading) return (
        <AdminLayout>
            <div className="p-8 text-center">Loading agents...</div>
        </AdminLayout>
    );

    return (
        <AdminLayout>
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Agent Management</h1>
                    <p className="text-gray-500">Configure AI agents, their models, and tools.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleReloadCache}
                        className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <ArrowPathIcon className="h-5 w-5 mr-2 text-gray-500" />
                        Reload Cache
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Create Agent
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                    <div key={agent.agent_id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
                        <div className="px-4 py-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${agent.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                        <CpuChipIcon className="h-6 w-6" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-lg font-medium text-gray-900">{agent.name}</h3>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${agent.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {agent.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleOpenModal(agent)}
                                    className="text-gray-400 hover:text-gray-500"
                                >
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{agent.description}</p>

                            <div className="space-y-3">
                                <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-medium mr-2">Model:</span>
                                    {llmModels.find(m => m.llm_model_id === agent.llm_model_id)?.model_name || 'Unknown'}
                                </div>

                                <div>
                                    <div className="flex items-center text-sm text-gray-600 mb-1">
                                        <WrenchScrewdriverIcon className="h-4 w-4 mr-1" />
                                        <span className="font-medium">Tools ({agent.tools.length})</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {agent.tools.map(tool => (
                                            <span key={tool.tool_id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                                {tool.name}
                                            </span>
                                        ))}
                                        {agent.tools.length === 0 && <span className="text-xs text-gray-400">No tools assigned</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">
                                {editingAgent ? 'Edit Agent' : 'Create New Agent'}
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                <div className="sm:col-span-4">
                                    <label className="block text-sm font-medium text-gray-700">Agent Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Status</label>
                                    <div className="mt-2 flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                            className={`${formData.is_active ? 'bg-indigo-600' : 'bg-gray-200'
                                                } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                                        >
                                            <span
                                                className={`${formData.is_active ? 'translate-x-5' : 'translate-x-0'
                                                    } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                                            />
                                        </button>
                                        <span className="ml-3 text-sm text-gray-500">
                                            {formData.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                <div className="sm:col-span-6">
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        rows={2}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    />
                                </div>

                                <div className="sm:col-span-6">
                                    <label className="block text-sm font-medium text-gray-700">LLM Model</label>
                                    <select
                                        required
                                        value={formData.llm_model_id}
                                        onChange={e => setFormData({ ...formData, llm_model_id: e.target.value })}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    >
                                        <option value="" disabled>Select a model</option>
                                        {llmModels.map(model => (
                                            <option key={model.llm_model_id} value={model.llm_model_id}>
                                                {model.provider} - {model.model_name} ({model.context_window} tokens)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-6">
                                    <label className="block text-sm font-medium text-gray-700">System Prompt Template</label>
                                    <p className="text-xs text-gray-500 mb-1">Define the agent's personality and core instructions.</p>
                                    <textarea
                                        rows={6}
                                        required
                                        value={formData.prompt_template}
                                        onChange={e => setFormData({ ...formData, prompt_template: e.target.value })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                                    />
                                </div>

                                <div className="sm:col-span-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Tools</label>
                                    <div className="bg-gray-50 rounded-md border border-gray-200 p-4 max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {availableTools.map(tool => (
                                            <div
                                                key={tool.tool_id}
                                                onClick={() => toggleTool(tool.tool_id)}
                                                className={`flex items-center p-3 rounded-md border cursor-pointer transition-colors ${formData.tool_ids.includes(tool.tool_id)
                                                        ? 'bg-indigo-50 border-indigo-200'
                                                        : 'bg-white border-gray-200 hover:border-indigo-300'
                                                    }`}
                                            >
                                                <div className={`flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center mr-3 ${formData.tool_ids.includes(tool.tool_id)
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : 'border-gray-300'
                                                    }`}>
                                                    {formData.tool_ids.includes(tool.tool_id) && (
                                                        <CheckCircleIcon className="h-3 w-3 text-white" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{tool.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {availableTools.length === 0 && (
                                            <p className="text-sm text-gray-500 col-span-2 text-center py-4">No active tools available.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                                >
                                    {editingAgent ? 'Save Changes' : 'Create Agent'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </AdminLayout>
    );
};

export default AgentManagementPage;
