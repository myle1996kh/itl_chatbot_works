import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import {
    getTenants,
    createTenant,
    updateTenant,
    deleteTenant,
    getTenantPermissions,
    getLLMConfig,
    TenantResponse
} from '../../services/tenantService';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
    Cog6ToothIcon
} from '../../components/icons';
import { getJWTToken } from '../../services/authService';

interface TenantDetails {
    agents: string[];
    tools: string[];
    llm_model?: string;
    llm_provider?: string;
}

const TenantManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [tenants, setTenants] = useState<TenantResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<TenantResponse | null>(null);
    const [formData, setFormData] = useState({ name: '', domain: '' });
    const [submitting, setSubmitting] = useState(false);
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [tenantDetails, setTenantDetails] = useState<Record<string, TenantDetails>>({});
    const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
    const token = getJWTToken();

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const data = await getTenants();
            setTenants(data);
            setError(null);
        } catch (err) {
            setError('Failed to load tenants');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (tenant?: TenantResponse) => {
        if (tenant) {
            setEditingTenant(tenant);
            setFormData({ name: tenant.name, domain: tenant.domain });
        } else {
            setEditingTenant(null);
            setFormData({ name: '', domain: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTenant(null);
        setFormData({ name: '', domain: '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setSubmitting(true);
        try {
            if (editingTenant) {
                await updateTenant(editingTenant.tenant_id, formData, token);
            } else {
                await createTenant(formData, token);
            }
            await fetchTenants();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save tenant:', err);
            alert('Failed to save tenant. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (tenantId: string) => {
        if (!token || !window.confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) return;

        try {
            await deleteTenant(tenantId, token);
            await fetchTenants();
        } catch (err) {
            console.error('Failed to delete tenant:', err);
            alert('Failed to delete tenant.');
        }
    };

    const toggleTenantDetails = async (tenantId: string) => {
        if (expandedTenant === tenantId) {
            setExpandedTenant(null);
            return;
        }

        setExpandedTenant(tenantId);

        // Load details if not already loaded
        if (!tenantDetails[tenantId] && token) {
            setLoadingDetails({ ...loadingDetails, [tenantId]: true });
            try {
                const [permissions, llmConfig] = await Promise.all([
                    getTenantPermissions(tenantId, token).catch(() => null),
                    getLLMConfig(tenantId, token).catch(() => null)
                ]);

                const details: TenantDetails = {
                    agents: permissions?.enabled_agents?.map((a: any) => a.name || a.agent_name) || [],
                    tools: permissions?.enabled_tools?.map((t: any) => t.name || t.tool_name) || [],
                    llm_model: llmConfig?.model_name,
                    llm_provider: llmConfig?.provider
                };

                setTenantDetails({ ...tenantDetails, [tenantId]: details });
            } catch (err) {
                console.error('Failed to load tenant details:', err);
            } finally {
                setLoadingDetails({ ...loadingDetails, [tenantId]: false });
            }
        }
    };

    return (
        <AdminLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage your organization's tenants and domains</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Quick Add
                        </button>
                        <button
                            onClick={() => navigate('/admin/tenants/new')}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Cog6ToothIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Full Setup Wizard
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white shadow overflow-hidden overflow-x-auto sm:rounded-lg">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Loading tenants...</div>
                    ) : tenants.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No tenants found. Create one to get started.</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Domain
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created At
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tenants.map((tenant) => (
                                    <React.Fragment key={tenant.tenant_id}>
                                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleTenantDetails(tenant.tenant_id)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className="mr-2 text-gray-400">
                                                        {expandedTenant === tenant.tenant_id ? '▼' : '▶'}
                                                    </span>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                                                        <div className="text-xs text-gray-500">{tenant.tenant_id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500">{tenant.domain}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {tenant.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => navigate(`/admin/tenants/${tenant.tenant_id}/settings`)}
                                                    className="text-gray-600 hover:text-gray-900 mr-4"
                                                    title="Cấu hình tenant"
                                                >
                                                    <Cog6ToothIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(tenant.tenant_id)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Xóa tenant"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedTenant === tenant.tenant_id && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-4 bg-gray-50">
                                                    {loadingDetails[tenant.tenant_id] ? (
                                                        <div className="text-sm text-gray-500">Loading configuration...</div>
                                                    ) : tenantDetails[tenant.tenant_id] ? (
                                                        <div className="grid grid-cols-3 gap-4">
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-gray-700 mb-2">🤖 Agents ({tenantDetails[tenant.tenant_id].agents.length})</h4>
                                                                {tenantDetails[tenant.tenant_id].agents.length > 0 ? (
                                                                    <ul className="text-xs text-gray-600 space-y-1">
                                                                        {tenantDetails[tenant.tenant_id].agents.map((agent, idx) => (
                                                                            <li key={idx}>• {agent}</li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-xs text-gray-400 italic">No agents configured</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-gray-700 mb-2">🔧 Tools ({tenantDetails[tenant.tenant_id].tools.length})</h4>
                                                                {tenantDetails[tenant.tenant_id].tools.length > 0 ? (
                                                                    <ul className="text-xs text-gray-600 space-y-1">
                                                                        {tenantDetails[tenant.tenant_id].tools.map((tool, idx) => (
                                                                            <li key={idx}>• {tool}</li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-xs text-gray-400 italic">No tools configured</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-gray-700 mb-2">🧠 LLM Model</h4>
                                                                {tenantDetails[tenant.tenant_id].llm_provider && tenantDetails[tenant.tenant_id].llm_model ? (
                                                                    <div className="text-xs text-gray-600">
                                                                        <p><span className="font-medium">Provider:</span> {tenantDetails[tenant.tenant_id].llm_provider}</p>
                                                                        <p className="mt-1"><span className="font-medium">Model:</span> {tenantDetails[tenant.tenant_id].llm_model}</p>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-gray-400 italic">No LLM configured</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-500">No configuration data available</div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleCloseModal}></div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                            {editingTenant ? 'Edit Tenant' : 'Create New Tenant'}
                                        </h3>
                                        <div className="mt-4">
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        id="name"
                                                        required
                                                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="domain" className="block text-sm font-medium text-gray-700">Domain</label>
                                                    <input
                                                        type="text"
                                                        name="domain"
                                                        id="domain"
                                                        required
                                                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                                        value={formData.domain}
                                                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                                    />
                                                </div>
                                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                                    <button
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                                                    >
                                                        {submitting ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                                        onClick={handleCloseModal}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default TenantManagementPage;
