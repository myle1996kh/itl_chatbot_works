import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ChevronRightIcon } from '../../components/icons';
import AdminLayout from '../../components/AdminLayout';
import { getJWTToken } from '../../services/authService';
import {
    createTenantFull,
    getLLMModels,
    TenantFullCreateRequest,
    LLMConfigCreate,
} from '../../services/tenantService';
import { getAgents } from '../../services/agentService';
import { getTools } from '../../services/toolService';

const STEPS = [
    { id: 1, name: 'Basic Info', description: 'Tenant name and domain' },
    { id: 2, name: 'LLM Configuration', description: 'AI model settings' },
    { id: 3, name: 'Agents', description: 'Enable domain agents' },
    { id: 4, name: 'Tools', description: 'Enable tools' },
    { id: 5, name: 'Review & Create', description: 'Review and confirm' },
];

const TenantSetupWizard: React.FC = () => {
    const navigate = useNavigate();
    const token = getJWTToken();
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form data
    const [basicInfo, setBasicInfo] = useState({ name: '', domain: '' });
    const [llmConfig, setLLMConfig] = useState<LLMConfigCreate>({
        provider: '',
        model_name: '',
        api_key: '',
        rate_limit_rpm: 60,
        rate_limit_tpm: 10000,
    });
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [selectedTools, setSelectedTools] = useState<string[]>([]);

    // Data from backend
    const [llmModels, setLLMModels] = useState<any[]>([]);
    const [agents, setAgents] = useState<any[]>([]);
    const [tools, setTools] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Load LLM models
    useEffect(() => {
        if (currentStep === 2 && llmModels.length === 0) {
            loadLLMModels();
        }
    }, [currentStep]);

    // Load agents
    useEffect(() => {
        if (currentStep === 3 && agents.length === 0) {
            loadAgents();
        }
    }, [currentStep]);

    // Load tools
    useEffect(() => {
        if (currentStep === 4 && tools.length === 0) {
            loadTools();
        }
    }, [currentStep]);

    const loadLLMModels = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const models = await getLLMModels(token);
            console.log('LLM Models loaded from API:', models);

            if (models && models.length > 0) {
                setLLMModels(models);
            } else {
                // Use fallback only if API returns empty array
                console.warn('API returned empty models, using fallback');
                const fallbackModels = [
                    { llm_model_id: '1', provider: 'openai', model_name: 'gpt-4' },
                    { llm_model_id: '2', provider: 'openai', model_name: 'gpt-3.5-turbo' },
                    { llm_model_id: '3', provider: 'anthropic', model_name: 'claude-3-opus' },
                    { llm_model_id: '4', provider: 'anthropic', model_name: 'claude-3-sonnet' },
                ];
                setLLMModels(fallbackModels);
            }
        } catch (err) {
            console.error('Failed to load LLM models:', err);
            console.error('Error details:', err instanceof Error ? err.message : String(err));
            // Fallback to default models if API fails
            const fallbackModels = [
                { llm_model_id: '1', provider: 'openai', model_name: 'gpt-4' },
                { llm_model_id: '2', provider: 'openai', model_name: 'gpt-3.5-turbo' },
                { llm_model_id: '3', provider: 'anthropic', model_name: 'claude-3-opus' },
                { llm_model_id: '4', provider: 'anthropic', model_name: 'claude-3-sonnet' },
            ];
            setLLMModels(fallbackModels);
            console.log('Using fallback LLM models due to error');
        } finally {
            setLoading(false);
        }
    };

    const loadAgents = async () => {
        if (!token) return;
        try {
            setLoading(true);
            // getAgents takes isActive boolean parameter, not token
            // Token is handled internally via getJWTToken()
            const data = await getAgents(true);  // Get only active agents
            // getAgents already returns agents array, not wrapped object
            setAgents(data || []);
        } catch (err) {
            console.error('Failed to load agents:', err);
            setError('Failed to load agents');
        } finally {
            setLoading(false);
        }
    };

    const loadTools = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const data = await getTools(true);
            // getTools already returns tools array, not wrapped object
            setTools(data || []);
        } catch (err) {
            console.error('Failed to load tools:', err);
            setError('Failed to load tools');
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return basicInfo.name.trim() && basicInfo.domain.trim();
            case 2:
                return llmConfig.provider && llmConfig.model_name && llmConfig.api_key.trim();
            case 3:
            case 4:
                return true; // Optional steps
            case 5:
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (canProceed() && currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
            setError(null);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setError(null);
        }
    };

    const handleSubmit = async () => {
        if (!token || submitting) return;

        try {
            setSubmitting(true);
            setError(null);

            const request: TenantFullCreateRequest = {
                name: basicInfo.name,
                domain: basicInfo.domain,
                status: 'active',
                llm_config: llmConfig,
                agent_ids: selectedAgents,
                tool_ids: selectedTools,
            };

            const result = await createTenantFull(request, token);

            // Show success and navigate
            alert(`Tenant created successfully!\n\nWidget Key: ${result.widget_key}\n\nYou can copy the embed code from the tenant settings.`);
            navigate('/admin/tenants');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create tenant');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleAgent = (agentId: string) => {
        setSelectedAgents((prev) =>
            prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
        );
    };

    const toggleTool = (toolId: string) => {
        setSelectedTools((prev) =>
            prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
        );
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tenant Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={basicInfo.name}
                                onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g., Acme Corporation"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Domain <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={basicInfo.domain}
                                onChange={(e) => setBasicInfo({ ...basicInfo, domain: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g., acme.com"
                            />
                            <p className="mt-1 text-sm text-gray-500">Unique identifier for this tenant</p>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Loading LLM models...</div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Provider <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={llmConfig.provider}
                                        onChange={(e) => {
                                            setLLMConfig({ ...llmConfig, provider: e.target.value, model_name: '' });
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select Provider</option>
                                        {Array.from(new Set(llmModels.map((m) => m.provider))).map((provider) => (
                                            <option key={provider} value={provider}>
                                                {provider}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {llmConfig.provider && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Model <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={llmConfig.model_name}
                                            onChange={(e) => setLLMConfig({ ...llmConfig, model_name: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select Model</option>
                                            {llmModels
                                                .filter((m) => m.provider === llmConfig.provider)
                                                .map((model) => (
                                                    <option key={model.llm_model_id} value={model.model_name}>
                                                        {model.model_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        API Key <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={llmConfig.api_key}
                                        onChange={(e) => setLLMConfig({ ...llmConfig, api_key: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Enter API key"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rate Limit (RPM)
                                        </label>
                                        <input
                                            type="number"
                                            value={llmConfig.rate_limit_rpm}
                                            onChange={(e) =>
                                                setLLMConfig({ ...llmConfig, rate_limit_rpm: parseInt(e.target.value) || 60 })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rate Limit (TPM)
                                        </label>
                                        <input
                                            type="number"
                                            value={llmConfig.rate_limit_tpm}
                                            onChange={(e) =>
                                                setLLMConfig({ ...llmConfig, rate_limit_tpm: parseInt(e.target.value) || 10000 })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Loading agents...</div>
                        ) : agents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No agents available</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {agents.map((agent) => (
                                    <div
                                        key={agent.agent_id}
                                        onClick={() => toggleAgent(agent.agent_id)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedAgents.includes(agent.agent_id)
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">{agent.name}</h4>
                                                <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                                            </div>
                                            {selectedAgents.includes(agent.agent_id) && (
                                                <CheckIcon className="h-5 w-5 text-indigo-600 flex-shrink-0 ml-2" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-sm text-gray-500">Selected: {selectedAgents.length} agents</p>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Loading tools...</div>
                        ) : tools.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No tools available</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {tools.map((tool) => (
                                    <div
                                        key={tool.tool_id}
                                        onClick={() => toggleTool(tool.tool_id)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedTools.includes(tool.tool_id)
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">{tool.name}</h4>
                                                <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                                            </div>
                                            {selectedTools.includes(tool.tool_id) && (
                                                <CheckIcon className="h-5 w-5 text-indigo-600 flex-shrink-0 ml-2" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-sm text-gray-500">Selected: {selectedTools.length} tools</p>
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-3">Basic Information</h3>
                            <dl className="space-y-2">
                                <div>
                                    <dt className="text-sm text-gray-600">Name:</dt>
                                    <dd className="text-sm font-medium">{basicInfo.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-gray-600">Domain:</dt>
                                    <dd className="text-sm font-medium">{basicInfo.domain}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-3">LLM Configuration</h3>
                            <dl className="space-y-2">
                                <div>
                                    <dt className="text-sm text-gray-600">Provider:</dt>
                                    <dd className="text-sm font-medium">{llmConfig.provider}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-gray-600">Model:</dt>
                                    <dd className="text-sm font-medium">{llmConfig.model_name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-gray-600">API Key:</dt>
                                    <dd className="text-sm font-medium">•••••••••</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-3">Enabled Features</h3>
                            <dl className="space-y-2">
                                <div>
                                    <dt className="text-sm text-gray-600">Agents:</dt>
                                    <dd className="text-sm font-medium">{selectedAgents.length} selected</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-gray-600">Tools:</dt>
                                    <dd className="text-sm font-medium">{selectedTools.length} selected</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> After creation, you'll receive a widget key and embed code for
                                integrating the chatbot into your website.
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Create New Tenant</h1>
                    <p className="text-gray-600 mt-2">Set up a new tenant with complete configuration</p>
                </div>

                {/* Progress Steps */}
                <div className="mb-8">
                    <nav aria-label="Progress">
                        <ol className="flex items-center">
                            {STEPS.map((step, index) => (
                                <li
                                    key={step.id}
                                    className={index !== STEPS.length - 1 ? 'flex-1' : ''}
                                >
                                    <div className="flex items-center">
                                        <div
                                            className={`relative flex h-8 w-8 items-center justify-center rounded-full ${currentStep > step.id
                                                ? 'bg-indigo-600'
                                                : currentStep === step.id
                                                    ? 'border-2 border-indigo-600 bg-white'
                                                    : 'border-2 border-gray-300 bg-white'
                                                }`}
                                        >
                                            {currentStep > step.id ? (
                                                <CheckIcon className="h-5 w-5 text-white" />
                                            ) : (
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full ${currentStep === step.id ? 'bg-indigo-600' : 'bg-transparent'
                                                        }`}
                                                />
                                            )}
                                        </div>
                                        <span
                                            className={`ml-3 text-sm font-medium ${currentStep >= step.id ? 'text-indigo-600' : 'text-gray-500'
                                                }`}
                                        >
                                            {step.name}
                                        </span>
                                    </div>
                                    {index !== STEPS.length - 1 && (
                                        <div
                                            className={`absolute top-4 left-4 -ml-px h-0.5 w-full ${currentStep > step.id ? 'bg-indigo-600' : 'bg-gray-300'
                                                }`}
                                            style={{ width: 'calc(100% - 2rem)' }}
                                        />
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {/* Step Content */}
                <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">{STEPS[currentStep - 1].name}</h2>
                    <p className="text-sm text-gray-600 mb-6">{STEPS[currentStep - 1].description}</p>
                    {renderStepContent()}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRightIcon className="h-5 w-5 mr-1" />
                        Back
                    </button>

                    {currentStep < STEPS.length ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                            <ChevronRightIcon className="h-5 w-5 ml-1" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            {submitting ? 'Creating...' : 'Create Tenant'}
                        </button>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default TenantSetupWizard;
