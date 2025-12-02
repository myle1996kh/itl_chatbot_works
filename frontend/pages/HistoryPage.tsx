import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';
import { getSupporterSessions } from '../services/sessionService';
import SupportLayout from '../components/SupportLayout';

interface ResolvedSession {
    session_id: string;
    user_email: string;
    user_name?: string;
    category?: string;
    resolution_notes?: string;
    resolved_at: string;
    created_at: string;
    last_message?: string;
    last_message_at?: string;
    message_count: number;
}

const HistoryPage: React.FC = () => {
    const user = getCurrentUser();
    const [sessions, setSessions] = useState<ResolvedSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedSession, setSelectedSession] = useState<ResolvedSession | null>(null);

    useEffect(() => {
        loadResolvedSessions();
    }, []);

    const loadResolvedSessions = async () => {
        if (!user) return;

        try {
            setLoading(true);

            const resolved = await getSupporterSessions(user.tenant_id, user.user_id, 'resolved');
            const mapped: ResolvedSession[] = resolved.map((s) => ({
                session_id: s.session_id,
                user_email: s.user_email || s.user_id,
                user_name: s.user_name,
                category: s.escalation_status,
                resolution_notes: s.last_message || '',
                resolved_at: s.updated_at || s.last_message_at || s.created_at,
                created_at: s.created_at,
                last_message: s.last_message,
                last_message_at: s.last_message_at,
                message_count: s.last_message ? 1 : 0,
            }));

            setSessions(mapped);
        } catch (err) {
            console.error('Failed to load resolved sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredSessions = sessions.filter((session) => {
        const matchesSearch =
            searchQuery === '' ||
            session.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            session.user_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = categoryFilter === 'all' || session.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    const categories = Array.from(new Set(sessions.map((s) => s.category).filter(Boolean)));

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <SupportLayout>
            <div className="max-w-6xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">History</h1>
                    <p className="text-gray-600 mt-1">View your resolved chat sessions</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500">Total Resolved</h3>
                        <p className="text-2xl font-bold text-green-600 mt-1">{sessions.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500">This Week</h3>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">
                            {sessions.filter((s) => new Date(s.resolved_at) > new Date(Date.now() - 7 * 86400000)).length}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500">Avg Messages</h3>
                        <p className="text-2xl font-bold text-purple-600 mt-1">
                            {sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.message_count, 0) / sessions.length) : 0}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by email or name..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Sessions List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Last Message
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Messages
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Resolved
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : filteredSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                            No sessions found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSessions.map((session) => (
                                        <tr key={session.session_id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{session.user_name || session.user_email}</div>
                                                <div className="text-sm text-gray-500">{session.user_email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {session.category || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                                                {session.last_message || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.message_count}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(session.resolved_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => setSelectedSession(session)}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Details Modal */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Session Details</h3>
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500">User</p>
                                <p className="text-sm text-gray-900">{selectedSession.user_name || selectedSession.user_email}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Email</p>
                                <p className="text-sm text-gray-900">{selectedSession.user_email}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Category</p>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {selectedSession.category || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Resolution Notes</p>
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                    {selectedSession.resolution_notes || 'No notes provided'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Created</p>
                                    <p className="text-sm text-gray-900">{formatDate(selectedSession.created_at)}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Resolved</p>
                                    <p className="text-sm text-gray-900">{formatDate(selectedSession.resolved_at)}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Messages</p>
                                <p className="text-sm text-gray-900">{selectedSession.message_count}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SupportLayout>
    );
};

export default HistoryPage;
