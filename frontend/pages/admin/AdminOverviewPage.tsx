import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { getTenants } from '../../services/tenantService';
import { listUsers } from '../../services/adminService';
import { getApiBaseUrl, getJWTToken } from '../../services/authService';

const AdminOverviewPage: React.FC = () => {
    const [stats, setStats] = useState({
        activeTenants: 0,
        totalUsers: 0,
        pendingEscalations: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const jwtToken = getJWTToken();

            // 1. Fetch real tenants count
            const tenants = await getTenants();

            // 2. Fetch real users count (all roles)
            let usersCount = 0;
            try {
                const users = await listUsers(jwtToken, { limit: 10000 });
                usersCount = users?.length || 0;
            } catch (err) {
                console.warn('Failed to load users count:', err);
            }

            // 3. Fetch pending escalations count across all tenants
            let pendingCount = 0;
            try {
                const baseUrl = getApiBaseUrl();
                for (const tenant of tenants) {
                    const response = await fetch(
                        `${baseUrl}/api/admin/tenants/${tenant.tenant_id}/escalations?status=pending`,
                        {
                            headers: {
                                'Authorization': `Bearer ${jwtToken}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                    if (response.ok) {
                        const data = await response.json();
                        pendingCount += data.pending_count || 0;
                    }
                }
            } catch (err) {
                console.warn('Failed to load pending escalations:', err);
            }

            setStats({
                activeTenants: tenants.length,
                totalUsers: usersCount,
                pendingEscalations: pendingCount,
            });
        } catch (error) {
            console.error('Failed to load admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Active Tenants', value: stats.activeTenants, color: 'bg-blue-500', icon: '🏢' },
        { label: 'Total Users', value: stats.totalUsers, color: 'bg-green-500', icon: '👥' },
        { label: 'Pending Escalations', value: stats.pendingEscalations, color: 'bg-orange-500', icon: '⚠️' },
    ];

    const quickLinks = [
        { to: '/admin/tenants', label: 'Manage Tenants', description: 'Create, edit, delete tenants', color: 'bg-blue-50', text: 'text-blue-700' },
        { to: '/admin/users', label: 'User Management', description: 'Admins, supporters, tenant users', color: 'bg-emerald-50', text: 'text-emerald-700' },
        { to: '/admin/agents', label: 'Agents', description: 'Create and configure AI agents', color: 'bg-purple-50', text: 'text-purple-700' },
        { to: '/admin/tools', label: 'Tools', description: 'Manage tool templates and configs', color: 'bg-orange-50', text: 'text-orange-700' },
        { to: '/admin/knowledge', label: 'Knowledge Base', description: 'Upload and monitor docs', color: 'bg-indigo-50', text: 'text-indigo-700' },
        { to: '/admin/escalations', label: 'Escalations', description: 'Assign and resolve escalations', color: 'bg-rose-50', text: 'text-rose-700' },
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Stats Grid - Now with 3 cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {statCards.map((stat, index) => (
                        <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 flex items-center">
                            <div className={`p-4 rounded-full ${stat.color} bg-opacity-10 mr-4`}>
                                <span className="text-2xl">{stat.icon}</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <p className={`text-2xl font-bold ${stat.color.replace('bg-', 'text-')}`}>
                                    {loading ? '...' : stat.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {quickLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`${link.color} rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow`}
                        >
                            <p className={`text-sm font-semibold ${link.text}`}>{link.label}</p>
                            <p className="text-sm text-gray-600 mt-1">{link.description}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminOverviewPage;
