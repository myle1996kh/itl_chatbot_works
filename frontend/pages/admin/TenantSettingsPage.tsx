import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { getJWTToken } from '../../services/authService';
import {
    getTenant,
    updateTenant,
    getTenantPermissions,
    updateTenantPermissions,
    getLLMModels,
    getWidgetConfig,
    updateWidgetConfig,
    createWidgetConfig,
    regenerateWidgetKeys,
    getLLMConfig,
    updateLLMConfig,
    TenantResponse,
    WidgetConfig,
    LLMConfig,
} from '../../services/tenantService';
import { getAgents } from '../../services/agentService';
import { getTools } from '../../services/toolService';
import { CheckIcon, XMarkIcon } from '../../components/icons';

type TabType = 'basic' | 'agents' | 'tools' | 'llm' | 'widget';

interface Agent {
    agent_id: string;
    name: string;
    description: string;
    is_active: boolean;
}

interface Tool {
    tool_id: string;
    name: string;
    description: string;
    category: string;
}

interface LLMModel {
    llm_model_id: string;
    provider: string;
    model_name: string;
}

const TenantSettingsPage: React.FC = () => {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const token = getJWTToken();

    const [activeTab, setActiveTab] = useState<TabType>('basic');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Data states
    const [tenant, setTenant] = useState<TenantResponse | null>(null);
    const [basicInfo, setBasicInfo] = useState({ name: '', domain: '', status: 'active' });

    // Agents & Tools
    const [allAgents, setAllAgents] = useState<Agent[]>([]);
    const [allTools, setAllTools] = useState<Tool[]>([]);
    const [enabledAgentIds, setEnabledAgentIds] = useState<string[]>([]);
    const [enabledToolIds, setEnabledToolIds] = useState<string[]>([]);

    // LLM Config
    const [llmModels, setLLMModels] = useState<LLMModel[]>([]);
    const [llmConfigData, setLLMConfigData] = useState<LLMConfig | null>(null);
    const [llmConfigUpdate, setLLMConfigUpdate] = useState({
        api_key: '',
        rate_limit_rpm: 60,
        rate_limit_tpm: 10000,
    });

    // Widget Config
    const [widgetData, setWidgetData] = useState<WidgetConfig | null>(null);
    const [widgetConfigUpdate, setWidgetConfigUpdate] = useState({
        primary_color: '#4F46E5',
        position: 'bottom-right',
        welcome_message: 'Xin chào! Tôi có thể giúp gì cho bạn?',
        auto_open: false,
        theme: 'light',
    });

    useEffect(() => {
        if (tenantId && token) {
            loadTenantData();
        }
    }, [tenantId, token]);

    const loadTenantData = async () => {
        if (!tenantId || !token) return;

        try {
            setLoading(true);
            setError(null);

            // Load tenant basic info
            const tenantData = await getTenant(tenantId, token);
            if (!tenantData) {
                setError('Tenant not found');
                return;
            }
            setTenant(tenantData);
            setBasicInfo({
                name: tenantData.name,
                domain: tenantData.domain,
                status: tenantData.status,
            });

            // Load permissions
            const permissions = await getTenantPermissions(tenantId, token);
            setEnabledAgentIds(permissions.enabled_agent_ids || []);
            setEnabledToolIds(permissions.enabled_tool_ids || []);

            // Load all agents
            const agents = await getAgents(true);
            setAllAgents(agents || []);

            // Load all tools
            const tools = await getTools(true);
            setAllTools(tools || []);

            // Load LLM models
            const models = await getLLMModels(token);
            setLLMModels(models || []);

            // Load LLM config
            try {
                const llmCfg = await getLLMConfig(tenantId, token);
                setLLMConfigData(llmCfg);
                setLLMConfigUpdate({
                    api_key: '', // Never populate API key
                    rate_limit_rpm: llmCfg.rate_limit_rpm,
                    rate_limit_tpm: llmCfg.rate_limit_tpm,
                });
            } catch (llmErr) {
                console.warn('LLM config not found:', llmErr);
                setLLMConfigData(null);
            }

            // Load widget config
            try {
                const widget = await getWidgetConfig(tenantId, token);
                setWidgetData(widget);
                setWidgetConfigUpdate({
                    primary_color: widget.primary_color,
                    position: widget.position,
                    welcome_message: widget.welcome_message,
                    auto_open: widget.auto_open,
                    theme: widget.theme,
                });
            } catch (widgetErr) {
                console.warn('Widget config not found, will show create option:', widgetErr);
                setWidgetData(null);
            }

        } catch (err) {
            console.error('Failed to load tenant data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load tenant data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBasicInfo = async () => {
        if (!tenantId || !token) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            await updateTenant(tenantId, basicInfo, token);
            setSuccess('Basic information updated successfully');

            // Reload tenant data
            const updated = await getTenant(tenantId, token);
            if (updated) setTenant(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update tenant');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAgents = async () => {
        if (!tenantId || !token) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            await updateTenantPermissions(
                tenantId,
                { agent_permissions: enabledAgentIds.map(id => ({ agent_id: id, enabled: true })) },
                token
            );
            setSuccess('Agent permissions updated successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update agent permissions');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTools = async () => {
        if (!tenantId || !token) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            await updateTenantPermissions(
                tenantId,
                { tool_permissions: enabledToolIds.map(id => ({ tool_id: id, enabled: true })) },
                token
            );
            setSuccess('Tool permissions updated successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update tool permissions');
        } finally {
            setSaving(false);
        }
    };

    const toggleAgent = (agentId: string) => {
        setEnabledAgentIds(prev =>
            prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
        );
    };

    const toggleTool = (toolId: string) => {
        setEnabledToolIds(prev =>
            prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
        );
    };

    const handleSaveLLM = async () => {
        if (!tenantId || !token) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            // Build update object (only non-empty fields)
            const updateData: any = {};
            if (llmConfigUpdate.api_key) {
                updateData.api_key = llmConfigUpdate.api_key;
            }
            if (llmConfigUpdate.rate_limit_rpm !== llmConfigData?.rate_limit_rpm) {
                updateData.rate_limit_rpm = llmConfigUpdate.rate_limit_rpm;
            }
            if (llmConfigUpdate.rate_limit_tpm !== llmConfigData?.rate_limit_tpm) {
                updateData.rate_limit_tpm = llmConfigUpdate.rate_limit_tpm;
            }

            if (Object.keys(updateData).length === 0) {
                setError('No changes to save');
                return;
            }

            // Update LLM config
            const updated = await updateLLMConfig(tenantId, updateData, token);
            setLLMConfigData(updated);

            // Clear API key field after successful update
            setLLMConfigUpdate({
                ...llmConfigUpdate,
                api_key: '',
            });

            setSuccess('LLM config updated successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update LLM config');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveWidget = async () => {
        if (!tenantId || !token) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            // If widget doesn't exist, create it first
            if (!widgetData) {
                const newWidget = await createWidgetConfig(tenantId, token);
                setWidgetData(newWidget);
                setSuccess('Widget config created successfully');
                return;
            }

            // Update existing widget
            await updateWidgetConfig(tenantId, widgetConfigUpdate, token);

            // Reload widget config
            const updated = await getWidgetConfig(tenantId, token);
            setWidgetData(updated);
            setSuccess('Widget config updated successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update widget config');
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateKeys = async () => {
        if (!tenantId || !token) return;

        const confirmed = window.confirm(
            '⚠️ Regenerating widget keys will invalidate the old embed code. ' +
            'Websites using the old code will stop working. Continue?'
        );

        if (!confirmed) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const updated = await regenerateWidgetKeys(tenantId, token);
            setWidgetData(updated);
            setSuccess('Widget keys regenerated successfully! Update your embed code on all websites.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to regenerate widget keys');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Thông tin cơ bản', icon: '📋' },
        { id: 'agents', label: 'Agents', icon: '🤖' },
        { id: 'tools', label: 'Tools', icon: '🔧' },
        { id: 'llm', label: 'LLM Config', icon: '🧠' },
        { id: 'widget', label: 'Widget', icon: '💬' },
    ] as const;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'basic':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tên Tenant
                            </label>
                            <input
                                type="text"
                                value={basicInfo.name}
                                onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Domain
                            </label>
                            <input
                                type="text"
                                value={basicInfo.domain}
                                onChange={(e) => setBasicInfo({ ...basicInfo, domain: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Trạng thái
                            </label>
                            <select
                                value={basicInfo.status}
                                onChange={(e) => setBasicInfo({ ...basicInfo, status: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleSaveBasicInfo}
                                disabled={saving}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                );

            case 'agents':
                return (
                    <div className="space-y-6">
                        <p className="text-sm text-gray-600">
                            Chọn các agents mà tenant này có thể sử dụng
                        </p>

                        {allAgents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Không có agents nào</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {allAgents.map((agent) => (
                                    <div
                                        key={agent.agent_id}
                                        onClick={() => toggleAgent(agent.agent_id)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                            enabledAgentIds.includes(agent.agent_id)
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">{agent.name}</h4>
                                                <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                                            </div>
                                            {enabledAgentIds.includes(agent.agent_id) && (
                                                <CheckIcon className="h-5 w-5 text-indigo-600 flex-shrink-0 ml-2" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t">
                            <p className="text-sm text-gray-600">
                                Đã chọn: {enabledAgentIds.length} / {allAgents.length} agents
                            </p>
                            <button
                                onClick={handleSaveAgents}
                                disabled={saving}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                );

            case 'tools':
                return (
                    <div className="space-y-6">
                        <p className="text-sm text-gray-600">
                            Chọn các tools mà tenant này có thể sử dụng
                        </p>

                        {allTools.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Không có tools nào</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {allTools.map((tool) => (
                                    <div
                                        key={tool.tool_id}
                                        onClick={() => toggleTool(tool.tool_id)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                            enabledToolIds.includes(tool.tool_id)
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-gray-900">{tool.name}</h4>
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                        {tool.category}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                                            </div>
                                            {enabledToolIds.includes(tool.tool_id) && (
                                                <CheckIcon className="h-5 w-5 text-indigo-600 flex-shrink-0 ml-2" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t">
                            <p className="text-sm text-gray-600">
                                Đã chọn: {enabledToolIds.length} / {allTools.length} tools
                            </p>
                            <button
                                onClick={handleSaveTools}
                                disabled={saving}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                );

            case 'llm':
                return (
                    <div className="space-y-6">
                        {!llmConfigData ? (
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ LLM config chưa được tạo cho tenant này. Vui lòng tạo tenant mới qua Setup Wizard để cấu hình LLM.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                                    <p className="text-sm text-gray-700 mb-1">
                                        <span className="font-semibold">Provider:</span> {llmConfigData.provider}
                                    </p>
                                    <p className="text-sm text-gray-700 mb-1">
                                        <span className="font-semibold">Model:</span> {llmConfigData.model_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Created: {new Date(llmConfigData.created_at).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-yellow-600 mt-2">
                                        ⚠️ Provider và Model không thể thay đổi. Để đổi model, tạo tenant mới.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        API Key (Tùy chọn - chỉ nhập nếu muốn đổi)
                                    </label>
                                    <input
                                        type="password"
                                        value={llmConfigUpdate.api_key}
                                        onChange={(e) => setLLMConfigUpdate({ ...llmConfigUpdate, api_key: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Nhập API key mới nếu muốn thay đổi"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        API key được mã hóa và không hiển thị. Để giữ nguyên, bỏ trống trường này.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rate Limit (RPM)
                                        </label>
                                        <input
                                            type="number"
                                            value={llmConfigUpdate.rate_limit_rpm}
                                            onChange={(e) => setLLMConfigUpdate({ ...llmConfigUpdate, rate_limit_rpm: parseInt(e.target.value) || 60 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            min="1"
                                            max="10000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rate Limit (TPM)
                                        </label>
                                        <input
                                            type="number"
                                            value={llmConfigUpdate.rate_limit_tpm}
                                            onChange={(e) => setLLMConfigUpdate({ ...llmConfigUpdate, rate_limit_tpm: parseInt(e.target.value) || 10000 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            min="1"
                                            max="1000000"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t">
                                    <button
                                        onClick={handleSaveLLM}
                                        disabled={saving}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                );

            case 'widget':
                return (
                    <div className="space-y-6">
                        {!widgetData && (
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                <p className="text-sm text-blue-800 mb-2">
                                    ℹ️ Widget chưa được tạo cho tenant này.
                                </p>
                                <button
                                    onClick={handleSaveWidget}
                                    disabled={saving}
                                    className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Đang tạo...' : 'Tạo Widget Config'}
                                </button>
                            </div>
                        )}

                        {widgetData && (
                            <>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-700 mb-1">
                                                <span className="font-semibold">Widget Key:</span> {widgetData.widget_key}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Created: {new Date(widgetData.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleRegenerateKeys}
                                            disabled={saving}
                                            className="ml-4 text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                        >
                                            🔄 Regenerate Keys
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Embed Code:</p>
                                    {widgetData.embed_code_snippet ? (
                                        <>
                                            <pre className="text-xs text-gray-800 bg-white p-3 rounded border border-gray-300 overflow-x-auto whitespace-pre-wrap">
{widgetData.embed_code_snippet}
                                            </pre>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(widgetData.embed_code_snippet);
                                                    setSuccess('Đã copy embed code vào clipboard!');
                                                    setTimeout(() => setSuccess(null), 2000);
                                                }}
                                                className="mt-2 text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700"
                                            >
                                                📋 Copy to Clipboard
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">Embed code chưa được tạo</p>
                                    )}
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Theme
                            </label>
                            <select
                                value={widgetConfigUpdate.theme}
                                onChange={(e) => setWidgetConfigUpdate({ ...widgetConfigUpdate, theme: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                disabled={!widgetData}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Màu chủ đạo
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={widgetConfigUpdate.primary_color}
                                    onChange={(e) => setWidgetConfigUpdate({ ...widgetConfigUpdate, primary_color: e.target.value })}
                                    className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                                    disabled={!widgetData}
                                />
                                <input
                                    type="text"
                                    value={widgetConfigUpdate.primary_color}
                                    onChange={(e) => setWidgetConfigUpdate({ ...widgetConfigUpdate, primary_color: e.target.value })}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    disabled={!widgetData}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Vị trí
                            </label>
                            <select
                                value={widgetConfigUpdate.position}
                                onChange={(e) => setWidgetConfigUpdate({ ...widgetConfigUpdate, position: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                disabled={!widgetData}
                            >
                                <option value="bottom-right">Dưới phải (Bottom Right)</option>
                                <option value="bottom-left">Dưới trái (Bottom Left)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tin nhắn chào mừng
                            </label>
                            <textarea
                                value={widgetConfigUpdate.welcome_message}
                                onChange={(e) => setWidgetConfigUpdate({ ...widgetConfigUpdate, welcome_message: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                rows={3}
                                disabled={!widgetData}
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="auto-open"
                                checked={widgetConfigUpdate.auto_open}
                                onChange={(e) => setWidgetConfigUpdate({ ...widgetConfigUpdate, auto_open: e.target.checked })}
                                className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                disabled={!widgetData}
                            />
                            <label htmlFor="auto-open" className="ml-2 text-sm text-gray-700">
                                Tự động mở widget khi load trang
                            </label>
                        </div>

                        {widgetData && (
                            <div className="flex justify-end pt-4 border-t">
                                <button
                                    onClick={handleSaveWidget}
                                    disabled={saving}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Đang tải cấu hình tenant...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (error && !tenant) {
        return (
            <AdminLayout>
                <div className="max-w-4xl mx-auto py-8">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                    <button
                        onClick={() => navigate('/admin/tenants')}
                        className="mt-4 text-indigo-600 hover:text-indigo-800"
                    >
                        ← Quay lại danh sách tenants
                    </button>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <button
                            onClick={() => navigate('/admin/tenants')}
                            className="text-indigo-600 hover:text-indigo-800 mb-2 flex items-center gap-1 text-sm"
                        >
                            ← Quay lại
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Cấu hình Tenant: {tenant?.name}
                        </h1>
                        <p className="text-gray-600 mt-1">Tenant ID: {tenantId}</p>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex justify-between items-center">
                        <span>{success}</span>
                        <button onClick={() => setSuccess(null)}>
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white shadow-sm rounded-lg">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 ${
                                        activeTab === tab.id
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default TenantSettingsPage;
