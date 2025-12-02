import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
    PlusIcon,
    PencilIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
    XCircleIcon,
    CodeBracketIcon
} from '../../components/icons';
import {
    getTools,
    getBaseTools,
    createTool,
    updateTool,
    Tool,
    BaseTool,
    CreateToolRequest
} from '../../services/toolService';

const ToolManagementPage: React.FC = () => {
    const [tools, setTools] = useState<Tool[]>([]);
    const [baseTools, setBaseTools] = useState<BaseTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<Tool | null>(null);

    // Form State
    const [formData, setFormData] = useState<CreateToolRequest>({
        base_tool_id: '',
        name: '',
        description: '',
        config: {},
        input_schema: {},
        is_active: true
    });

    const [configJson, setConfigJson] = useState('{}');
    const [schemaJson, setSchemaJson] = useState('{}');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [toolsData, baseToolsData] = await Promise.all([
                getTools(),
                getBaseTools()
            ]);
            setTools(toolsData);
            setBaseTools(baseToolsData);
            setError(null);
        } catch (err) {
            setError('Failed to load data. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (tool?: Tool) => {
        if (tool) {
            setEditingTool(tool);
            setFormData({
                base_tool_id: tool.base_tool_id,
                name: tool.name,
                description: tool.description,
                config: tool.config,
                input_schema: tool.input_schema,
                is_active: tool.is_active
            });
            setConfigJson(JSON.stringify(tool.config, null, 2));
            setSchemaJson(JSON.stringify(tool.input_schema, null, 2));
        } else {
            setEditingTool(null);
            setFormData({
                base_tool_id: baseTools.length > 0 ? baseTools[0].base_tool_id : '',
                name: '',
                description: '',
                config: {},
                input_schema: {},
                is_active: true
            });
            setConfigJson('{}');
            setSchemaJson('{}');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Parse JSON fields
            const parsedConfig = JSON.parse(configJson);
            const parsedSchema = JSON.parse(schemaJson);

            const payload = {
                ...formData,
                config: parsedConfig,
                input_schema: parsedSchema
            };

            if (editingTool) {
                await updateTool(editingTool.tool_id, payload);
            } else {
                await createTool(payload);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            alert('Failed to save tool. Please check your JSON format and inputs.');
            console.error(err);
        }
    };

    if (loading) return (
        <AdminLayout>
            <div className="p-8 text-center">Loading tools...</div>
        </AdminLayout>
    );

    return (
        <AdminLayout>
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tool Management</h1>
                    <p className="text-gray-500">Configure tools available to AI agents.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Create Tool
                </button>
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
                {tools.map((tool) => (
                    <div key={tool.tool_id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
                        <div className="px-4 py-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tool.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        <WrenchScrewdriverIcon className="h-6 w-6" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-lg font-medium text-gray-900">{tool.name}</h3>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tool.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {tool.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleOpenModal(tool)}
                                    className="text-gray-400 hover:text-gray-500"
                                >
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{tool.description}</p>

                            <div className="space-y-3">
                                <div className="flex items-center text-sm text-gray-600">
                                    <span className="font-medium mr-2">Type:</span>
                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                                        {tool.base_tool?.tool_type || 'Unknown'}
                                    </span>
                                </div>

                                <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded truncate">
                                    {JSON.stringify(tool.config)}
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
                                {editingTool ? 'Edit Tool' : 'Create New Tool'}
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                <div className="sm:col-span-4">
                                    <label className="block text-sm font-medium text-gray-700">Tool Name</label>
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
                                    <label className="block text-sm font-medium text-gray-700">Base Tool Template</label>
                                    <select
                                        required
                                        disabled={!!editingTool} // Cannot change base tool type after creation
                                        value={formData.base_tool_id}
                                        onChange={e => setFormData({ ...formData, base_tool_id: e.target.value })}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
                                    >
                                        <option value="" disabled>Select a tool type</option>
                                        {baseTools.map(tool => (
                                            <option key={tool.base_tool_id} value={tool.base_tool_id}>
                                                {tool.type} - {tool.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-6">
                                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                                        <CodeBracketIcon className="h-4 w-4 mr-1" />
                                        Configuration (JSON)
                                    </label>
                                    <p className="text-xs text-gray-500 mb-1">Specific configuration for this tool instance (e.g., API keys, URLs).</p>
                                    <textarea
                                        rows={4}
                                        value={configJson}
                                        onChange={e => setConfigJson(e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
                                    />
                                </div>

                                <div className="sm:col-span-6">
                                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                                        <CodeBracketIcon className="h-4 w-4 mr-1" />
                                        Input Schema (JSON)
                                    </label>
                                    <p className="text-xs text-gray-500 mb-1">JSON Schema defining the parameters the LLM should provide.</p>
                                    <textarea
                                        rows={4}
                                        value={schemaJson}
                                        onChange={e => setSchemaJson(e.target.value)}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
                                    />
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
                                    {editingTool ? 'Save Changes' : 'Create Tool'}
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

export default ToolManagementPage;
