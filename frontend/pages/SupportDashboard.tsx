import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getApiBaseUrl } from '../services/authService';
import { getSupporterSessions } from '../services/sessionService';
import SupportLayout from '../components/SupportLayout';

interface Session {
    session_id: string;
    user_email: string;
    user_name?: string;
    status: 'pending' | 'assigned' | 'resolved' | 'active' | 'waiting';
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
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'assigned' | 'resolved' | 'active' | 'waiting'>('all');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [sessionsPerPage] = useState(100);

    useEffect(() => {
        loadSessions();
    }, []);

    // SSE connection for real-time session list updates
    useEffect(() => {
        if (!user) return;

        const baseUrl = getApiBaseUrl();
        const sseUrl = `${baseUrl}/api/admin/tenants/${user.tenant_id}/sessions/stream`;

        console.log('🔌 SSE: Connecting to session list stream', sseUrl);
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => console.log('✅ SSE session list connected');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'session_update') {
                    // Reload sessions when there's an update
                    console.log('📥 SSE: Session update received, reloading...');
                    loadSessions();
                } else if (data.type === 'heartbeat') {
                    console.log('💓 SSE: Heartbeat');
                }
            } catch (error) {
                console.error('SSE parse error:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('❌ SSE error:', error);
            eventSource.close();
        };

        return () => {
            console.log('🔌 SSE: Disconnecting session list stream');
            eventSource.close();
        };
    }, [user]);

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
            console.log('Debug: Raw backend sessions', backendSessions); // Debug log
            const mapped: Session[] = backendSessions.map((s) => {
                console.log('Debug: Single session data', s); // Debug log
                return {
                    session_id: s.session_id,
                    user_email: s.user_email || '',  // ✅ Don't fall back to user_id
                    user_name: s.user_name || 'Unknown User',
                    status: s.escalation_status || (s.is_active ? (s.assigned_supporter_id ? 'active' : 'waiting') : 'resolved'),
                    last_message: s.last_message,
                    last_message_time: s.last_message_at,
                    unread_count: 0,
                    created_at: s.created_at,
                };
            });
            console.log('Debug: Mapped sessions', mapped); // Debug log

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
            case 'assigned':
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'pending':
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
        // Show exact time like admin dashboard (e.g., "2:30 PM")
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SupportLayout>
            <div className="max-w-6xl">
                <div className="mb-6 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Chats</h1>
                        <p className="text-gray-600 mt-1">Manage your assigned chat sessions</p>
                    </div>
                    <button
                        onClick={loadSessions}
                        className="mt-1 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Refresh sessions"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                            {(['all', 'pending', 'assigned', 'resolved'] as const).map((filter) => (
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
                    {/* Pagination Controls */}
                    {filteredSessions.length > sessionsPerPage && (
                        <div className="px-6 py-3 flex items-center justify-between text-sm border-t">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Previous
                            </button>
                            <span className="text-gray-600">
                                Page {currentPage} of {Math.ceil(filteredSessions.length / sessionsPerPage)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredSessions.length / sessionsPerPage), p + 1))}
                                disabled={currentPage >= Math.ceil(filteredSessions.length / sessionsPerPage)}
                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>
                    )}

                    {/* Session List */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="divide-y divide-gray-200">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">Loading sessions...</div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-600">{error}</div>
                            ) : filteredSessions.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No sessions found</div>
                            ) : (
                                filteredSessions
                                    .slice((currentPage - 1) * sessionsPerPage, currentPage * sessionsPerPage)
                                    .map((session) => {
                                        return (
                                            <div
                                                className="p-4 hover:bg-indigo-50 cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:border-indigo-500 hover:shadow-sm"
                                                key={session.session_id}
                                                onClick={() => {
                                                    console.log('Navigating to session:', session);
                                                    navigate(`/support/chat/${session.session_id}`, {
                                                        state: {
                                                            user_name: session.user_name,
                                                            user_email: session.user_email
                                                        }
                                                    });
                                                }}
                                            >
                                                {/* User name and time */}
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-medium text-gray-900 truncate w-2/3">
                                                        {session.user_name || session.user_email || 'Unknown User'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center">
                                                        <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {session.last_message_time ? formatTime(session.last_message_time) : formatTime(session.created_at)}
                                                    </div>
                                                </div>

                                                {/* Email */}
                                                {session.user_email && (
                                                    <div className="text-xs text-gray-500 truncate mb-1">
                                                        {session.user_email}
                                                    </div>
                                                )}

                                                {/* Last message preview */}
                                                <div className="text-sm text-gray-500 truncate mb-2">
                                                    {session.last_message
                                                        ? session.last_message.substring(0, 50) + (session.last_message.length > 50 ? '...' : '')
                                                        : 'No messages yet'}
                                                </div>

                                                {/* Status badges */}
                                                <div className="flex justify-between items-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(session.status)}`}>
                                                        {session.status}
                                                    </span>
                                                    {session.unread_count && session.unread_count > 0 && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            {session.unread_count} new
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </SupportLayout>
    );
};

export default SupportDashboard;
