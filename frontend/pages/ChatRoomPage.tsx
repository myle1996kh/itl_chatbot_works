import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/authService';
import { getSessionDetailPublic, sendSupporterMessage } from '../services/sessionService';
import { resolveEscalation } from '../services/escalationService';
import type { SessionDetail, MessageDetail } from '../types';
import SupportLayout from '../components/SupportLayout';

type Category = 'bug' | 'feature_request' | 'guideline' | 'invoice' | 'tracking' | 'other';

const categoryLabels: Record<Category, string> = {
    bug: 'Bug/Error',
    feature_request: 'Feature Request',
    guideline: 'Guideline Question',
    invoice: 'Invoice/Payment Issue',
    tracking: 'Shipment Tracking',
    other: 'Other',
};

const ChatRoomPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const user = getCurrentUser();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [showResolveDialog, setShowResolveDialog] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category>('other');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        loadSession();

        // Setup SSE connection for real-time messages
        if (!user || !sessionId) return;

        const apiBaseUrl = 'http://localhost:8000'; // TODO: Get from config
        const eventSource = new EventSource(
            `${apiBaseUrl}/api/${user.tenant_id}/session/${sessionId}/stream`
        );

        eventSource.onopen = () => {
            console.log('SSE connection established');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    console.log('SSE connected:', data.session_id);
                } else if (data.type === 'new_message') {
                    console.log('New message received via SSE:', data.message);
                    // Reload session to get the new message
                    loadSession();
                } else if (data.type === 'heartbeat') {
                    // Heartbeat to keep connection alive
                    console.debug('SSE heartbeat');
                }
            } catch (err) {
                console.error('Failed to parse SSE message:', err);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            eventSource.close();
        };

        // Cleanup: close SSE connection when component unmounts
        return () => {
            console.log('Closing SSE connection');
            eventSource.close();
        };
    }, [sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [session?.messages]);

    const loadSession = async () => {
        if (!user || !sessionId) return;

        try {
            setLoading(true);
            setError(null);

            const detail = await getSessionDetailPublic(user.tenant_id, sessionId);
            if (!detail) {
                setError('Session not found');
                return;
            }

            setSession(detail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load session');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim() || !user || !sessionId || sending) return;

        try {
            setSending(true);

            await sendSupporterMessage(user.tenant_id, sessionId, message);
            await loadSession();
            setMessage('');
        } catch (err) {
            alert('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleResolve = async () => {
        if (!user || !sessionId || resolving) return;

        try {
            setResolving(true);

            const notes = `Category: ${categoryLabels[selectedCategory]}${resolutionNotes ? `\n\n${resolutionNotes}` : ''}`;
            await resolveEscalation(user.tenant_id, sessionId, notes);
            navigate('/support');
        } catch (err) {
            alert('Failed to resolve session');
        } finally {
            setResolving(false);
        }
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading && !session) {
        return (
            <SupportLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading chat...</p>
                    </div>
                </div>
            </SupportLayout>
        );
    }

    if (error || !session) {
        return (
            <SupportLayout>
                <div className="text-center py-12">
                    <p className="text-red-600">{error || 'Session not found'}</p>
                    <button
                        onClick={() => navigate('/support')}
                        className="mt-4 text-indigo-600 hover:text-indigo-700"
                    >
                        ← Back to My Chats
                    </button>
                </div>
            </SupportLayout>
        );
    }

    return (
        <SupportLayout>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <button
                                onClick={() => navigate('/support')}
                                className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1"
                            >
                                ← Back to My Chats
                            </button>
                            <h1 className="text-xl font-bold text-gray-900">{session.user_name || session.user_email}</h1>
                            <p className="text-sm text-gray-500">Session ID: {session.session_id}</p>
                        </div>
                        <button
                            onClick={() => setShowResolveDialog(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium"
                        >
                            Mark as Resolved
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {/* Chat Area */}
                    <div className="col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col" style={{ height: '600px' }}>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {session.messages.map((msg) => (
                                <div
                                    key={msg.message_id}
                                    className={`flex ${msg.role === 'supporter' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.role === 'supporter'
                                                ? 'bg-indigo-600 text-white'
                                                : msg.role === 'user'
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : 'bg-blue-50 text-blue-900'
                                            }`}
                                    >
                                        <div className="text-xs opacity-75 mb-1">
                                            {msg.role === 'supporter' ? 'You' : msg.role === 'user' ? 'User' : 'AI'}
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <p className="text-xs opacity-75 mt-1">{formatTime(msg.created_at)}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t border-gray-200 p-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type your message..."
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={sending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={sending || !message.trim()}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* User Info Panel */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h2 className="font-semibold text-gray-900 mb-4">User Information</h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-500">Name</p>
                                <p className="font-medium text-gray-900">{session.user_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Email</p>
                                <p className="font-medium text-gray-900">{session.user_email}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Status</p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    {session.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-gray-500">Session Started</p>
                                <p className="font-medium text-gray-900">
                                    {new Date(session.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resolve Dialog */}
            {showResolveDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Mark Session as Resolved</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value as Category)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {Object.entries(categoryLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Resolution Notes (Optional)
                                </label>
                                <textarea
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    placeholder="Add any additional notes about the resolution..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end mt-6">
                            <button
                                onClick={() => setShowResolveDialog(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={resolving}
                                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md font-medium disabled:opacity-50"
                            >
                                {resolving ? 'Resolving...' : 'Resolve Session'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SupportLayout>
    );
};

export default ChatRoomPage;
