import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { ChatSession, Message, Supporter, Tenant, SessionSummary } from '../../types';
import { getSessionsWithFallback, getSessionDetail, getSessionDetailPublic } from '../../services/sessionService';
import { getTenants as getTenantsFromBackend, getSupporters as getSupportersFromBackend, listUsers } from '../../services/adminService';
import { getApiBaseUrl, getJWTToken, getCurrentUser, LoginResponse } from '../../services/authService';
import { escalateSession, assignSupporter as assignSupporterToEscalation } from '../../services/escalationService';
import { ChatBubbleIcon, UserCircleIcon, ClockIcon } from '../../components/icons';

const ChatManagementPage: React.FC = () => {
    // Authentication state
    const [authenticatedUser, setAuthenticatedUser] = useState<LoginResponse | null>(getCurrentUser());
    const jwtToken = getJWTToken();

    // Backend data state
    const [backendTenants, setBackendTenants] = useState<Tenant[]>([]);
    const [backendSupporters, setBackendSupporters] = useState<Supporter[]>([]);
    const [loadingBackendData, setLoadingBackendData] = useState(false);

    // Session management state
    const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
    const [filterTenantId, setFilterTenantId] = useState<string>('');
    const [currentUser, setCurrentUser] = useState<Supporter | null>(null); // null means Admin view

    // Message selection for enrichment
    const [selectedMessages, setSelectedMessages] = useState<Record<string, Message>>({});
    const [showEnrichModal, setShowEnrichModal] = useState(false);
    const [enriching, setEnriching] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [sessionsPerPage] = useState(100);
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    const pickPreferredTenantId = (list: Tenant[]): string => {
        const byId = list.find(t => t.id === '3105b788-b5ff-4d56-88a9-532af4ab4ded');
        if (byId) return byId.id;
        const byName = list.find(t => (t.name || '').toLowerCase() === 'etms');
        if (byName) return byName.id;
        return list[0]?.id || '';
    };

    // Load tenants and supporters from backend on component mount
    useEffect(() => {
        const loadBackendData = async () => {
            if (!jwtToken) return;

            setLoadingBackendData(true);
            try {
                // Load tenants from backend
                const backendTenantsData = await getTenantsFromBackend(jwtToken);
                if (backendTenantsData.length > 0) {
                    setBackendTenants(backendTenantsData);

                    // Prefer eTMS as default tenant
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

    // Keep backendSupporters in sync with the selected tenant filter
    useEffect(() => {
        const loadTenantSupporters = async () => {
            if (!jwtToken || !filterTenantId) return;

            try {
                // 1) Preferred: supporters table
                const supporters = await getSupportersFromBackend(filterTenantId, jwtToken);
                if (supporters && supporters.length > 0) {
                    setBackendSupporters(supporters);
                    return;
                }

                // 2) Fallback: users table filtered to supporter OR staff for this tenant
                try {
                    const users = await listUsers(jwtToken, { tenant_id: filterTenantId, limit: 200 });
                    const fallback = (users || [])
                        .filter(u => u.role === 'supporter' || u.role === 'staff')
                        .map(u => ({ id: u.user_id, name: u.display_name || u.username || u.email, tenantId: filterTenantId }));
                    setBackendSupporters(fallback);
                } catch (userErr) {
                    console.warn('Failed to load users fallback', userErr);
                    setBackendSupporters([]);
                }
            } catch (e) {
                console.warn('Failed to load supporters for tenant', filterTenantId, e);
                setBackendSupporters([]);
            }
        };
        loadTenantSupporters();
    }, [filterTenantId, jwtToken]);

    const loadChatSessions = async () => {
        try {
            if (!isUuid(filterTenantId)) {
                setAllSessions([]);
                return;
            }
            const sessionsData = await getSessionsWithFallback(filterTenantId);

            let sessions: ChatSession[] = [];

            if (Array.isArray(sessionsData)) {
                // Backend format (SessionSummary[])
                sessions = sessionsData.map((summary: SessionSummary) => ({
                    ...summary,
                    id: summary.session_id,
                    tenantId: filterTenantId,
                    userEmail: summary.user_email || summary.user_id,
                    userName: summary.user_name,
                    messages: [], // Messages loaded on demand
                    assignedSupporterId: summary.assigned_supporter_id || undefined,
                    escalationStatus: summary.escalation_status,
                    lastActivity: summary.last_message_at || summary.created_at,
                }));
            }

            sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
            setAllSessions(sessions);
        } catch (error) {
            console.error('Failed to load chat sessions:', error);
            setAllSessions([]);
        }
    };

    useEffect(() => {
        loadChatSessions();
    }, [filterTenantId]);

    // SSE connection for real-time session list updates
    useEffect(() => {
        if (!filterTenantId) return;

        const baseUrl = getApiBaseUrl();
        const sseUrl = `${baseUrl}/api/admin/tenants/${filterTenantId}/sessions/stream`;

        console.log('🔌 SSE: Connecting to session list stream', sseUrl);
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => console.log('✅ SSE session list connected');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'session_update') {
                    // Reload sessions when there's an update
                    console.log('📥 SSE: Session update received, reloading...');
                    loadChatSessions();
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
    }, [filterTenantId]);

    // Load full session messages when a session is selected
    useEffect(() => {
        const loadSessionMessages = async () => {
            if (!selectedSession || !jwtToken) return;

            try {
                const sessionDetail = await getSessionDetail(selectedSession.tenantId, selectedSession.id);
                if (sessionDetail) {
                    setSelectedSession(prev => {
                        if (!prev) return null;

                        const pickDisplayText = (data: any): string => {
                            if (data == null) return '';
                            if (typeof data === 'string') {
                                const raw = data.trim();
                                try {
                                    const parsed = JSON.parse(raw);
                                    data = parsed;
                                } catch {
                                    const textMatches = Array.from(raw.matchAll(/"text"\s*:\s*"([\s\S]*?)"/g)).map(m => m[1]);
                                    if (textMatches.length) return textMatches.join('\n\n');
                                    return raw;
                                }
                            }

                            const extractFrom = (node: any): string | null => {
                                if (!node) return null;
                                if (typeof node === 'string') return node;
                                if (Array.isArray(node)) {
                                    const parts = node.map(extractFrom).filter(Boolean) as string[];
                                    return parts.length ? parts.join('\n\n') : null;
                                }
                                if (typeof node === 'object') {
                                    if (typeof node.text === 'string') return node.text;
                                    if (typeof node.content === 'string') return node.content;
                                    return (
                                        extractFrom(node.response) ||
                                        extractFrom(node.outputs) ||
                                        extractFrom(node.output) ||
                                        extractFrom(node.data)
                                    );
                                }
                                return null;
                            };
                            const from = extractFrom(data);
                            if (from) return from;
                            try { return JSON.stringify(data, null, 2); } catch { return String(data); }
                        };

                        return {
                            ...prev,
                            messages: sessionDetail.messages?.map(msg => ({
                                id: msg.message_id || `msg-${Math.random()}`,
                                sender: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'ai' : 'supporter',
                                text: ((): string => {
                                    if (msg.role !== 'assistant') return msg.content;
                                    if (typeof msg.content === 'string') {
                                        const raw = msg.content.trim();
                                        const singleQuoted = Array.from(raw.matchAll(/'text'\s*:\s*'([\s\S]*?)'/g)).map(m => m[1]);
                                        if (singleQuoted.length) return singleQuoted.join('\n\n');
                                    }
                                    return pickDisplayText(msg.content);
                                })(),
                                timestamp: msg.created_at,
                            })) || []
                        };
                    });
                }
            } catch (error) {
                console.error('Failed to load session messages:', error);
            }
        };

        loadSessionMessages();
    }, [selectedSession?.id, filterTenantId, jwtToken]);

    const filteredSessions = useMemo(() => {
        let sessions = allSessions.filter(s => s.tenantId === filterTenantId);
        if (currentUser) {
            return sessions.filter(s => s.assignedSupporterId === currentUser.id);
        }
        return sessions;
    }, [allSessions, filterTenantId, currentUser]);

    const handleMessageSelection = (msg: Message) => {
        setSelectedMessages(prev => {
            const newSelection = { ...prev };
            if (newSelection[msg.id]) {
                delete newSelection[msg.id];
            } else {
                newSelection[msg.id] = msg;
            }
            return newSelection;
        });
    };

    const handleEnrichment = async () => {
        if (!selectedSession || enriching) return;

        try {
            setEnriching(true);

            const messagesToEnrich = Object.values(selectedMessages);
            const conversationText = messagesToEnrich
                .map(m => {
                    const role = m.sender === 'user' ? 'User' : m.sender === 'supporter' ? 'Supporter' : 'Agent';
                    return `${role}: ${m.text}`;
                })
                .join('\n\n');

            const documentName = `Chat History - ${selectedSession.userEmail || selectedSession.userName || 'User'} - ${new Date().toLocaleString()}`;

            // Create text file blob for upload-document endpoint
            const blob = new Blob([conversationText], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', blob, `${selectedSession.id}-enrichment.txt`);
            formData.append('document_name', documentName);

            console.log('📚 Enriching knowledge base from chat history:', {
                session_id: selectedSession.id,
                messages_count: messagesToEnrich.length,
                tenant_id: selectedSession.tenantId,
            });

            const baseUrl = getApiBaseUrl();
            const response = await fetch(
                `${baseUrl}/api/admin/tenants/${selectedSession.tenantId}/knowledge/upload-document`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: jwtToken ? `Bearer ${jwtToken}` : '',
                    },
                    body: formData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: Failed to enrich knowledge base`);
            }

            const result = await response.json();
            console.log('✅ Chat history enriched successfully:', {
                document_name: result.document_name,
                chunk_count: result.chunk_count,
                document_ids: result.document_ids,
            });

            alert(`✅ Knowledge base enriched!\n\n${result.chunk_count} chunks created from ${messagesToEnrich.length} messages`);
            setSelectedMessages({});
            setShowEnrichModal(false);
        } catch (e: any) {
            console.error('❌ Enrichment failed:', e);
            alert(`Failed to enrich knowledge base: ${e.message || 'Unknown error'}`);
        } finally {
            setEnriching(false);
        }
    };

    const assignSupporter = async (sessionId: string, supporterId: string) => {
        if (!jwtToken) return;

        try {
            const tenantId = selectedSession?.tenantId || filterTenantId;

            // Step 1: Escalate session
            try {
                await escalateSession(tenantId, sessionId, 'Manual assignment by admin');
            } catch (escalateErr) {
                console.error('Failed to escalate session:', escalateErr);
                // Continue anyway as it might already be escalated
            }

            // Step 2: Assign supporter
            await assignSupporterToEscalation(tenantId, sessionId, supporterId);

            await loadChatSessions();
            setSelectedSession(prev => prev ? { ...prev, assignedSupporterId: supporterId || null } : prev);
            alert('Supporter assigned successfully!');
        } catch (e) {
            console.error('Failed to assign supporter:', e);
            alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    return (
        <AdminLayout>
            <div className="flex h-[calc(100vh-64px)]">
                {/* Session List */}
                <div className="w-1/3 border-r bg-white flex flex-col">
                    <div className="p-4 border-b bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-gray-800">Chat Sessions</h2>
                                <button
                                    onClick={loadChatSessions}
                                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                                    title="Refresh sessions"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {filteredSessions.length} Active
                            </span>
                        </div>

                        <select
                            value={filterTenantId}
                            onChange={e => {
                                setFilterTenantId(e.target.value);
                                setCurrentPage(1); // Reset to page 1 when changing tenant
                            }}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            {backendTenants.length === 0 ? (
                                <option value="" disabled>Loading tenants...</option>
                            ) : (
                                backendTenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Pagination Controls */}
                    {filteredSessions.length > sessionsPerPage && (
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between text-sm">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Previous
                            </button>
                            <span className="text-gray-600">
                                Page {currentPage} of {Math.ceil(filteredSessions.length / sessionsPerPage)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredSessions.length / sessionsPerPage), p + 1))}
                                disabled={currentPage >= Math.ceil(filteredSessions.length / sessionsPerPage)}
                                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto">
                        {filteredSessions.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <ChatBubbleIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                                <p>No active sessions found</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-200">
                                {filteredSessions
                                    .slice((currentPage - 1) * sessionsPerPage, currentPage * sessionsPerPage)
                                    .map(session => (
                                    <li
                                        key={session.id}
                                        onClick={() => setSelectedSession(session)}
                                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedSession?.id === session.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-medium text-gray-900 truncate w-2/3">
                                                {session.userName || session.userEmail || 'Unknown User'}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center">
                                                <ClockIcon className="h-3 w-3 mr-1" />
                                                {new Date(session.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        {session.userEmail && (
                                            <div className="text-xs text-gray-500 truncate mb-1">
                                                {session.userEmail}
                                            </div>
                                        )}
                                        <div className="text-sm text-gray-500 truncate mb-2">
                                            {session.messages && session.messages.length > 0
                                                ? session.messages[session.messages.length - 1].text.substring(0, 50) + '...'
                                                : 'No messages'}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${session.escalationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                session.escalationStatus === 'assigned' ? 'bg-blue-100 text-blue-800' :
                                                    session.escalationStatus === 'resolved' ? 'bg-green-100 text-green-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {session.escalationStatus || 'active'}
                                            </span>
                                            {session.assignedSupporterId && (
                                                <span className="text-xs text-gray-500 flex items-center">
                                                    <UserCircleIcon className="h-3 w-3 mr-1" />
                                                    Assigned
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Chat View */}
                <div className="flex-1 flex flex-col bg-gray-50">
                    {selectedSession ? (
                        <>
                            <div className="p-4 bg-white border-b shadow-sm flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                        {selectedSession.userEmail || 'Anonymous User'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Session ID: {selectedSession.id}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Enrich Knowledge Base Button */}
                                    {Object.keys(selectedMessages).length > 0 && (
                                        <button
                                            onClick={() => setShowEnrichModal(true)}
                                            disabled={enriching}
                                            className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            title={`Enrich knowledge base with ${Object.keys(selectedMessages).length} selected messages`}
                                        >
                                            {enriching ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Enriching...
                                                </>
                                            ) : (
                                                <>
                                                    📚 Enrich ({Object.keys(selectedMessages).length})
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <select
                                        value={selectedSession.assignedSupporterId || ''}
                                        onChange={(e) => assignSupporter(selectedSession.id, e.target.value)}
                                        className="rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Unassigned</option>
                                        {backendSupporters.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {selectedSession.messages?.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {/* Checkbox for enrichment - appears on left for AI/supporter, right for user */}
                                        {msg.sender !== 'user' && (
                                            <input
                                                type="checkbox"
                                                checked={!!selectedMessages[msg.id]}
                                                onChange={() => handleMessageSelection(msg)}
                                                className="mt-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                                title="Select for knowledge base enrichment"
                                            />
                                        )}

                                        <div
                                            className={`max-w-[70%] rounded-lg px-4 py-2 shadow-sm ${msg.sender === 'user'
                                                ? 'bg-indigo-600 text-white'
                                                : msg.sender === 'supporter'
                                                    ? 'bg-green-100 text-gray-900 border border-green-200'
                                                    : 'bg-white text-gray-900 border border-gray-200'
                                                } ${selectedMessages[msg.id] ? 'ring-2 ring-indigo-500' : ''}`}
                                        >
                                            <div className="text-xs opacity-75 mb-1 flex justify-between gap-4">
                                                <span className="capitalize font-medium">
                                                    {msg.sender === 'ai' ? 'AI Assistant' : msg.sender}
                                                </span>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
                                        </div>

                                        {/* Checkbox for user messages - appears on right */}
                                        {msg.sender === 'user' && (
                                            <input
                                                type="checkbox"
                                                checked={!!selectedMessages[msg.id]}
                                                onChange={() => handleMessageSelection(msg)}
                                                className="mt-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                                title="Select for knowledge base enrichment"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <ChatBubbleIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <p className="text-lg">Select a session to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Enrichment Confirmation Modal */}
            {showEnrichModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold mb-4 text-gray-900">
                            Enrich Knowledge Base
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            You are about to add <span className="font-semibold text-indigo-600">{Object.keys(selectedMessages).length} messages</span> to the knowledge base for tenant <span className="font-semibold">{backendTenants.find(t => t.id === filterTenantId)?.name || 'Unknown'}</span>.
                        </p>
                        <p className="text-sm text-gray-600 mb-6">
                            This will create a new document with the selected conversation history, which can be used to improve AI responses.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowEnrichModal(false)}
                                disabled={enriching}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEnrichment}
                                disabled={enriching}
                                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {enriching ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Enriching...
                                    </>
                                ) : (
                                    '📚 Enrich Knowledge Base'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default ChatManagementPage;
