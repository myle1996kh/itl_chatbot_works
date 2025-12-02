import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Tenant } from '../../types';
import { getTenants as getTenantsFromBackend } from '../../services/adminService';
import { getJWTToken, getCurrentUser, LoginResponse } from '../../services/authService';
import {
    getEscalationQueue,
    getSupporters,
    assignSupporter as assignSupporterToEscalation,
    resolveEscalation,
    EscalationResponse,
    Supporter as EscalationSupporter
} from '../../services/escalationService';
import {
    UserGroupIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    ArrowPathIcon
} from '../../components/icons';

const EscalationQueuePage: React.FC = () => {
    // Authentication state
    const [authenticatedUser] = useState<LoginResponse | null>(getCurrentUser());
    const jwtToken = getJWTToken();

    // Backend data state
    const [backendTenants, setBackendTenants] = useState<Tenant[]>([]);
    const [loadingBackendData, setLoadingBackendData] = useState(false);

    // Escalation state
    const [filterTenantId, setFilterTenantId] = useState<string>('');
    const [escalations, setEscalations] = useState<EscalationResponse[]>([]);
    const [escalationStats, setEscalationStats] = useState({ pending: 0, assigned: 0, resolved: 0 });
    const [selectedEscalation, setSelectedEscalation] = useState<EscalationResponse | null>(null);
    const [escalationSupporters, setEscalationSupporters] = useState<EscalationSupporter[]>([]);
    const [escalationFilter, setEscalationFilter] = useState<'all' | 'pending' | 'assigned' | 'resolved'>('pending');
    const [loadingEscalations, setLoadingEscalations] = useState(false);

    // Helpers
    const pickPreferredTenantId = (list: Tenant[]): string => {
        const byId = list.find(t => t.id === '3105b788-b5ff-4d56-88a9-532af4ab4ded');
        if (byId) return byId.id;
        const byName = list.find(t => (t.name || '').toLowerCase() === 'etms');
        if (byName) return byName.id;
        return list[0]?.id || '';
    };

    // Load tenants from backend on component mount
    useEffect(() => {
        const loadBackendData = async () => {
            if (!jwtToken) return;

            setLoadingBackendData(true);
            try {
                const backendTenantsData = await getTenantsFromBackend(jwtToken);
                if (backendTenantsData.length > 0) {
                    setBackendTenants(backendTenantsData);
                    const preferredId = pickPreferredTenantId(backendTenantsData);
                    setFilterTenantId(preferredId);
                }
            } catch (error) {
                console.warn('Failed to load backend data:', error);
            } finally {
                setLoadingBackendData(false);
            }
        };

        loadBackendData();
    }, [jwtToken]);

    const loadEscalations = async () => {
        if (!filterTenantId || !jwtToken) return;

        setLoadingEscalations(true);
        try {
            const response = await getEscalationQueue(filterTenantId, escalationFilter === 'all' ? undefined : escalationFilter);
            setEscalations(response.escalations);
            setEscalationStats({
                pending: response.pending_count,
                assigned: response.assigned_count,
                resolved: response.resolved_count,
            });
        } catch (error) {
            console.error('Failed to load escalations:', error);
        } finally {
            setLoadingEscalations(false);
        }
    };

    const loadSupporters = async () => {
        if (!filterTenantId || !jwtToken) return;
        try {
            const response = await getSupporters(filterTenantId);
            if (response.success) {
                setEscalationSupporters(response.supporters);
            }
        } catch (error) {
            console.error('Failed to load supporters:', error);
        }
    };

    useEffect(() => {
        loadEscalations();
        loadSupporters();
    }, [filterTenantId, escalationFilter, jwtToken]);

    const handleAssignSupporter = async (escalationId: string, supporterId: string) => {
        if (!filterTenantId) return;
        try {
            await assignSupporterToEscalation(filterTenantId, escalationId, supporterId);
            loadEscalations();
            alert('Supporter assigned successfully!');
        } catch (error) {
            console.error('Failed to assign supporter:', error);
            alert(`Failed to assign supporter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleResolveEscalation = async (escalationId: string) => {
        if (!filterTenantId) return;
        const notes = prompt('Enter resolution notes (optional):');
        try {
            await resolveEscalation(filterTenantId, escalationId, notes || undefined);
            loadEscalations();
            alert('Escalation resolved successfully!');
        } catch (error) {
            console.error('Failed to resolve escalation:', error);
            alert(`Failed to resolve escalation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    return (
        <AdminLayout>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Escalation Queue</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage and assign escalated chat sessions
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select
                            value={filterTenantId}
                            onChange={e => setFilterTenantId(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            {backendTenants.length === 0 ? (
                                <option value="" disabled>Loading tenants...</option>
                            ) : (
                                backendTenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))
                            )}
                        </select>
                        <button
                            onClick={loadEscalations}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            title="Refresh"
                        >
                            <ArrowPathIcon className={`h-5 w-5 ${loadingEscalations ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div
                        className={`bg-white overflow-hidden shadow rounded-lg cursor-pointer border-l-4 ${escalationFilter === 'pending' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-500'}`}
                        onClick={() => setEscalationFilter('pending')}
                    >
                        <div className="px-4 py-5 sm:p-6 flex items-center">
                            <div className="p-3 rounded-full bg-orange-100 text-orange-600 mr-4">
                                <ExclamationCircleIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 truncate">Pending Escalations</dt>
                                <dd className="mt-1 text-3xl font-semibold text-gray-900">{escalationStats.pending}</dd>
                            </div>
                        </div>
                    </div>
                    <div
                        className={`bg-white overflow-hidden shadow rounded-lg cursor-pointer border-l-4 ${escalationFilter === 'assigned' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-500'}`}
                        onClick={() => setEscalationFilter('assigned')}
                    >
                        <div className="px-4 py-5 sm:p-6 flex items-center">
                            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                                <ClockIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 truncate">Assigned / In Progress</dt>
                                <dd className="mt-1 text-3xl font-semibold text-gray-900">{escalationStats.assigned}</dd>
                            </div>
                        </div>
                    </div>
                    <div
                        className={`bg-white overflow-hidden shadow rounded-lg cursor-pointer border-l-4 ${escalationFilter === 'resolved' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-500'}`}
                        onClick={() => setEscalationFilter('resolved')}
                    >
                        <div className="px-4 py-5 sm:p-6 flex items-center">
                            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                                <CheckCircleIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 truncate">Resolved</dt>
                                <dd className="mt-1 text-3xl font-semibold text-gray-900">{escalationStats.resolved}</dd>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {['all', 'pending', 'assigned', 'resolved'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setEscalationFilter(status as any)}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                                    ${escalationFilter === status
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                `}
                            >
                                {status}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Escalations List */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                        {escalations.length === 0 ? (
                            <li className="px-4 py-8 text-center text-gray-500">
                                No escalations found for this filter.
                            </li>
                        ) : (
                            escalations.map((escalation) => (
                                <li key={escalation.session_id} className="hover:bg-gray-50">
                                    <div className="px-4 py-4 sm:px-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center truncate">
                                                <p className="text-sm font-medium text-indigo-600 truncate">
                                                    Session: {escalation.session_id.substring(0, 8)}...
                                                </p>
                                                <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${escalation.escalation_status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                        escalation.escalation_status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-green-100 text-green-800'}`}>
                                                    {escalation.escalation_status}
                                                </span>
                                            </div>
                                            <div className="ml-2 flex-shrink-0 flex">
                                                <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    {new Date(escalation.escalation_requested_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 sm:flex sm:justify-between">
                                            <div className="sm:flex">
                                                <p className="flex items-center text-sm text-gray-500">
                                                    Reason: {escalation.escalation_reason}
                                                </p>
                                            </div>
                                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                                {escalation.escalation_status === 'pending' && (
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    handleAssignSupporter(escalation.session_id, e.target.value);
                                                                    e.target.value = ''; // Reset
                                                                }
                                                            }}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Assign Supporter...</option>
                                                            {escalationSupporters.map(s => (
                                                                <option key={s.supporter_id} value={s.supporter_id}>
                                                                    {s.display_name || s.username || s.email}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                {escalation.escalation_status === 'assigned' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="mr-2">Assigned to: {
                                                            escalationSupporters.find(s => s.supporter_id === escalation.assigned_user_id)?.display_name || 'Unknown'
                                                        }</span>
                                                        <button
                                                            onClick={() => handleResolveEscalation(escalation.session_id)}
                                                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                                                        >
                                                            Resolve
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>
        </AdminLayout>
    );
};

export default EscalationQueuePage;
