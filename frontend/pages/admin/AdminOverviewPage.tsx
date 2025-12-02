import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { getTenants } from '../../services/tenantService';

const AdminOverviewPage: React.FC = () => {
    const [stats, setStats] = useState({
        activeTenants: 0,
        totalUsers: 0,
        activeSessions: 0,
        pendingEscalations: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            // Fetch real tenants count
            const tenants = await getTenants();

            // Mock other stats for now (would need specific admin stats endpoints)
            setStats({
                activeTenants: tenants.length,
                totalUsers: 156, // Mock
                activeSessions: 42, // Mock
                pendingEscalations: 5, // Mock
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
        { label: 'Active Sessions', value: stats.activeSessions, color: 'bg-indigo-500', icon: '💬' },
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
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                {/* Recent Activity & System Health */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Activity */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                        </div>
                        <div className="p-6">
                            <ul className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <li key={i} className="flex items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                        <div className="flex-shrink-0 h-2 w-2 mt-2 rounded-full bg-indigo-500"></div>
                                        <div className="ml-4">
                                            <p className="text-sm font-medium text-gray-900">New tenant "Logistics Corp" registered</p>
                                            <p className="text-xs text-gray-500">2 hours ago</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* System Health */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">API Latency</span>
                                    <span className="text-sm font-medium text-green-600">45ms</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">Database Load</span>
                                    <span className="text-sm font-medium text-yellow-600">62%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '62%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">Storage Usage</span>
                                    <span className="text-sm font-medium text-blue-600">28%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '28%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminOverviewPage;
