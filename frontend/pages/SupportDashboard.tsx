import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/authService';
import { getSupporterSessions } from '../services/sessionService';
import SupportLayout from '../components/SupportLayout';

interface Session {
    session_id: string;
    user_email: string;
    user_name?: string;
    status: 'active' | 'waiting' | 'resolved';
    last_message?: string;
    last_message_time?: string;
    unread_count?: number;
    created_at: string;
}

const SupportDashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = getCurrentUser();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'waiting' | 'resolved'>('all');

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        if (!user) {
            setError('Not authenticated. Please log in again.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const backendSessions = await getSupporterSessions(user.tenant_id, user.user_id);
            const mapped: Session[] = backendSessions.map((s) => ({
                session_id: s.session_id,
                user_email: s.user_email || s.user_id,
                user_name: s.user_name,
                status: s.is_active ? (s.assigned_supporter_id ? 'active' : 'waiting') : 'resolved',
                last_message: s.last_message,
                last_message_time: s.last_message_at,
                unread_count: 0,
                created_at: s.created_at,
            }));

            setSessions(mapped);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    const filteredSessions = sessions.filter((session) => {
        if (statusFilter === 'all') return true;
        return session.status === statusFilter;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'waiting':
                return 'bg-yellow-100 text-yellow-800';
            case 'resolved':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <SupportLayout>
            <div className="max-w-6xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">My Chats</h1>
                    <p className="text-gray-600 mt-1">Manage your assigned chat sessions</p>
                </div>

                {/* Filter Tabs */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                            {(['all', 'active', 'waiting'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setStatusFilter(filter)}
                                    className={`
                    py-4 px-1 border-b-2 font-medium text-sm capitalize
                    ${statusFilter === filter
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }
                  `}
                                >
                                    {filter} ({sessions.filter((s) => filter === 'all' || s.status === filter).length})
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Session List */}
                    <div className="divide-y divide-gray-200">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Loading sessions...</div>
                        ) : error ? (
                            <div className="p-8 text-center text-red-600">{error}</div>
                        ) : filteredSessions.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No sessions found</div>
                        ) : (
                            filteredSessions.map((session) => {
                                return (
                                    <div
                                        key={session.session_id}
                                        onClick={() => navigate(`/support/chat/${session.session_id}`)}
                                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors bg-indigo-50 border-l-4 border-indigo-500"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                {/* Header with Name and Status */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                                                        {session.user_name || 'Unknown User'}
                                                    </h3>
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                                            session.status
                                                        )}`}
                                                    >
                                                        {session.status}
                                                    </span>
                                                    {session.unread_count && session.unread_count > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            {session.unread_count} new
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {/* Email */}
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <span className="text-xs font-medium text-gray-500">Email:</span>
                                                    <p className="text-xs text-gray-700 truncate">{session.user_email || 'No email provided'}</p>
                                                </div>

                                                {/* Last Message */}
                                                <div className="mb-2">
                                                    <span className="text-xs font-medium text-gray-500">Last message:</span>
                                                    <p className="text-sm text-gray-600 truncate mt-0.5">{session.last_message || 'No messages yet'}</p>
                                                </div>

                                                {/* Timestamp */}
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium text-gray-500">Time:</span>
                                                    <p className="text-xs text-gray-500">
                                                        {session.last_message_time ? formatTime(session.last_message_time) : formatTime(session.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="ml-4 flex-shrink-0">
                                                <svg
                                                    className="h-5 w-5 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </SupportLayout>
    );
};

export default SupportDashboard;
