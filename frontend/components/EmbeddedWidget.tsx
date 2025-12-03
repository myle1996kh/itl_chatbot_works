import React, { useState, useEffect, useRef } from 'react';
import { Tenant, UserInfo, Message, SessionSummary } from '../types';
import { sendMessage, getApiBaseUrl } from '../services/chatService';
import { escalateSessionPublic } from '../services/escalationService';
import { getUserSessions, getSessionDetailPublic } from '../services/sessionService';
import { XMarkIcon, ClockIcon } from './icons';
import MessageList from './shared/MessageList';
import MessageInput from './shared/MessageInput';
import EscalationDialog from './shared/EscalationDialog';
import { AVAILABLE_AGENTS, AgentName } from '../src/config/topic-agent-mapping';

interface EmbeddedWidgetProps {
    tenant: Tenant;
    userInfo: UserInfo;
    userId: string;
    sessionId: string;
    token: string;
    onClose: () => void;
    onMinimize: () => void;
    onEndSession: () => void;
}

const EmbeddedWidget: React.FC<EmbeddedWidgetProps> = ({
    tenant,
    userInfo,
    userId,
    sessionId: initialSessionId,
    token,
    onClose,
    onMinimize,
    onEndSession,
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [sessionId, setSessionId] = useState<string>(initialSessionId);
    const [isEscalated, setIsEscalated] = useState(false);
    const [showEscalationDialog, setShowEscalationDialog] = useState(false);
    const [escalationReason, setEscalationReason] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);

    // History Toggle State
    const [showHistory, setShowHistory] = useState(false);
    const [sessionList, setSessionList] = useState<(SessionSummary & { lastUserMessage?: string })[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const historyCacheRef = useRef<{
        sessions: (SessionSummary & { lastUserMessage?: string })[];
        fetchedAt: number;
    } | null>(null);
    const HISTORY_LIMIT = 20;
    const HISTORY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<HTMLDivElement>(null); // For click outside detection

    // Close history when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showHistory && historyRef.current && !historyRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };

        // Close history when pressing ESC key
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && showHistory) {
                setShowHistory(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscKey);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [showHistory]);

    // Fetch messages when sessionId changes (Restore history)
    useEffect(() => {
        const loadSessionMessages = async () => {
            if (!sessionId || !token) return;

            try {
                const sessionDetail = await getSessionDetailPublic(tenant.id, sessionId, token);
                if (sessionDetail && sessionDetail.messages) {
                    const formattedMessages: Message[] = sessionDetail.messages.map(msg => ({
                        id: msg.message_id,
                        text: msg.content,
                        sender: msg.role === 'supporter' ? 'supporter' : (msg.role === 'user' ? 'user' : 'ai'),
                        timestamp: msg.created_at,
                        supporterName: msg.supporter_name,
                        fileInfo: msg.attachments && msg.attachments.length > 0 ? {
                            name: msg.attachments[0].filename,
                            size: msg.attachments[0].size || 0
                        } : undefined
                    }));

                    // Load escalation status from session detail
                    if (sessionDetail.escalation_status && sessionDetail.escalation_status !== 'none' && sessionDetail.escalation_status !== 'resolved') {
                        setIsEscalated(true);
                    } else {
                        setIsEscalated(false);
                    }

                    // If no messages, show welcome message
                    if (formattedMessages.length === 0) {
                        setMessages([{
                            id: `ai-${Date.now()}`,
                            text: tenant.theme.welcomeMessage,
                            sender: 'ai',
                            timestamp: new Date().toISOString(),
                        }]);
                    } else {
                        setMessages(formattedMessages);
                    }
                }
            } catch (error) {
                console.error('Failed to load session history:', error);
            }
        };

        loadSessionMessages();
    }, [sessionId, token, tenant.id, tenant.theme.welcomeMessage]);

    // SSE connection
    useEffect(() => {
        if (!sessionId || !token) return;

        const baseUrl = getApiBaseUrl();
        const sseUrl = `${baseUrl}/api/${tenant.id}/session/${sessionId}/stream?token=${encodeURIComponent(token)}`;

        console.log('🔌 SSE:', sseUrl);
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => console.log('✅ SSE connected');
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_message') {
                    setMessages((prev) => {
                        // Avoid duplicates
                        if (prev.some(m => m.id === data.message.message_id)) return prev;

                        return [...prev, {
                            id: data.message.message_id,
                            text: data.message.content,
                            sender: data.message.role === 'supporter' ? 'supporter' : 'ai',
                            timestamp: data.message.created_at,
                            supporterName: data.message.supporter_name,
                        }];
                    });
                } else if (data.type === 'escalation_status_update') {
                    // Handle escalation status updates
                    if (data.escalation_status && data.escalation_status !== 'none' && data.escalation_status !== 'resolved') {
                        setIsEscalated(true);
                    } else if (data.escalation_status === 'resolved') {
                        setIsEscalated(false);
                        // Add a system message about resolution
                        setMessages(prev => [...prev, {
                            id: `system-${Date.now()}`,
                            text: '✅ Yêu cầu của bạn đã được giải quyết bởi nhân viên hỗ trợ. Bạn có thể yêu cầu hỗ trợ lại nếu cần.',
                            sender: 'ai',
                            timestamp: new Date().toISOString(),
                        }]);
                    }
                }
            } catch (error) {
                console.error('SSE error:', error);
            }
        };

        return () => eventSource.close();
    }, [sessionId, token, tenant.id]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if ((!input.trim() && !attachedFile) || isTyping) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            text: input,
            sender: 'user',
            timestamp: new Date().toISOString(),
            ...(attachedFile && { fileInfo: { name: attachedFile.name, size: attachedFile.size } }),
        };

        setMessages((prev) => [...prev, userMessage]);
        const messageText = input;
        setInput('');
        setIsTyping(true);
        setAttachedFile(null);

        try {
            const response = await sendMessage({
                message: messageText,
                tenantId: tenant.id,
                sessionId,
                userId,
                jwt: token,
                agentName: selectedAgent || undefined,
            });

            const aiMessage: Message = {
                id: `ai-${Date.now() + 1}`,
                text: response.success && response.data?.response?.text || 'Sorry, error occurred.',
                sender: 'ai',
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error('Send error:', error);
        } finally {
            setIsTyping(false);
        }
    };

    const handleEscalationSubmit = async () => {
        if (!escalationReason.trim()) {
            alert('Please enter a reason');
            return;
        }
        try {
            // Use public endpoint - no admin auth required
            const result = await escalateSessionPublic(tenant.id, sessionId, escalationReason);

            if (result.success) {
                setIsEscalated(true);
                setShowEscalationDialog(false);
                setMessages((prev) => [...prev, {
                    id: `system-${Date.now()}`,
                    text: result.message || '✋ Đã yêu cầu hỗ trợ. Nhân viên sẽ hỗ trợ bạn trong giây lát.',
                    sender: 'ai',
                    timestamp: new Date().toISOString(),
                }]);
                setEscalationReason('');
            } else {
                alert('Không thể gửi yêu cầu hỗ trợ');
            }
        } catch (error) {
            console.error('Escalation error:', error);
            alert(`Không thể gửi yêu cầu hỗ trợ: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
        }
    };

    const loadHistory = async (forceRefresh = false) => {
        // Reuse cached list if still fresh
        const now = Date.now();
        if (!forceRefresh && historyCacheRef.current && (now - historyCacheRef.current.fetchedAt) < HISTORY_CACHE_TTL_MS) {
            setSessionList(historyCacheRef.current.sessions);
            return;
        }

        setIsLoadingHistory(true);
        setHistoryError(null);
        try {
            const sessions = await getUserSessions(tenant.id, userId, token, { limit: HISTORY_LIMIT });
            // Filter out current session and sort by most recent
            const filteredSessions = sessions
                .filter(s => s.session_id !== sessionId)
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

            // Seed list with existing summary data
            let hydratedSessions: (SessionSummary & { lastUserMessage?: string })[] = filteredSessions.map(s => ({
                ...s,
                lastUserMessage: s.lastUserMessage || s.last_message,
            }));

            // For entries missing preview text, fetch a small subset of details to avoid a fan-out
            const sessionsNeedingPreview = hydratedSessions.filter(s => !s.lastUserMessage && !s.last_message).slice(0, 5);
            if (sessionsNeedingPreview.length) {
                await Promise.all(sessionsNeedingPreview.map(async (session) => {
                    try {
                        const detail = await getSessionDetailPublic(tenant.id, session.session_id, token);
                        if (detail && detail.messages && detail.messages.length > 0) {
                            // Get the last message from the session (regardless of sender)
                            const lastMessage = detail.messages[detail.messages.length - 1];
                            // Also specifically try to find the last user message if needed
                            const lastUserMsg = [...detail.messages].reverse().find(m => m.role === 'user');

                            hydratedSessions = hydratedSessions.map(s =>
                                s.session_id === session.session_id
                                    ? {
                                        ...s,
                                        lastUserMessage: lastUserMsg?.content || lastMessage?.content || "Chưa có tin nhắn",
                                        last_message: lastMessage?.content || s.last_message
                                    }
                                    : s
                            );
                        }
                    } catch (err) {
                        console.error(`Failed to fetch details for session ${session.session_id}`, err);
                    }
                }));
            }

            setSessionList(hydratedSessions);
            historyCacheRef.current = { sessions: hydratedSessions, fetchedAt: now };
        } catch (e) {
            console.error(e);
            setHistoryError('Không thể tải lịch sử lúc này.');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const toggleHistory = async () => {
        if (!showHistory) {
            await loadHistory();
            setShowHistory(true);
        } else {
            setShowHistory(false);
        }
    };

    const switchSession = (newSessionId: string) => {
        setSessionId(newSessionId);
        setShowHistory(false); // Auto-close when switching sessions
    };

    const deleteSession = async (sessionIdToDelete: string) => {
        // Since the backend doesn't support DELETE for sessions,
        // we'll just remove it from the local cache and refresh the list
        try {
            // Remove the session from the local list
            setSessionList(prev => prev.filter(session => session.session_id !== sessionIdToDelete));

            // Also clear the cache to force a refresh on next history view
            if (historyCacheRef.current) {
                historyCacheRef.current = null;
            }
        } catch (error) {
            console.error('Failed to delete session from local cache:', error);
            alert('Failed to delete session. Please try again.');
        }
    };

    const primaryColor = tenant.theme.primaryColor;

    return (
        <div className="bg-white flex flex-col font-sans w-full h-full overflow-hidden relative">
            <header className="p-4 text-white flex justify-between items-center shadow-md z-20" style={{ backgroundColor: primaryColor }}>
                <div>
                    <h2 className="font-bold text-lg">{tenant.theme.headerText}</h2>
                    <p className="text-xs opacity-90">
                        {userInfo.username ? `Xin chào, ${userInfo.username}!` : 'Trò chuyện với chúng tôi'}
                        {isEscalated && <span className="ml-2 inline-block px-2 py-0.5 bg-orange-400 text-white text-xs rounded-full">Đã yêu cầu hỗ trợ</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleHistory} className="hover:bg-white/20 p-1 rounded-full" title="Lịch sử">
                        <ClockIcon className="h-5 w-5" />
                    </button>
                    {!isEscalated && (
                        <button onClick={() => setShowEscalationDialog(true)} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded">Yêu cầu hỗ trợ</button>
                    )}
                    <button onClick={onEndSession} className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-2 py-1 rounded">Kết thúc</button>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><XMarkIcon className="h-6 w-6" /></button>
                </div>
            </header>

            {/* History Dropdown */}
            {showHistory && (
                <div
                    ref={historyRef}
                    className="absolute top-16 right-2 w-64 bg-white shadow-xl rounded-lg border border-gray-200 z-30 max-h-80 overflow-y-auto">
                    <div className="p-2 border-b bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                        <span className="font-semibold">Lịch sử trò chuyện</span>
                        <button
                            onClick={() => loadHistory(true)}
                            disabled={isLoadingHistory}
                            className="text-blue-600 hover:text-blue-800 disabled:text-gray-300"
                        >
                            Làm mới
                        </button>
                    </div>
                    {isLoadingHistory ? (
                        <div className="p-4 text-center text-gray-400 text-xs">Đang tải...</div>
                    ) : historyError ? (
                        <div className="p-4 text-center text-red-500 text-xs">{historyError}</div>
                    ) : sessionList.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-xs">Chưa có lịch sử</div>
                    ) : (
                        <ul>
                            {sessionList.map(session => (
                                <li key={session.session_id}>
                                    <div className="w-full flex justify-between items-start">
                                        <button
                                            onClick={() => switchSession(session.session_id)}
                                            className="flex-1 text-left p-3 hover:bg-blue-50 border-b last:border-0 transition-colors"
                                        >
                                            <div className="text-xs font-medium text-gray-700 flex justify-between">
                                                <span>{new Date(session.created_at).toLocaleString()}</span>
                                                {session.escalation_status && session.escalation_status !== 'none' && (
                                                    <span className="text-orange-500 ml-2">Đã yêu cầu hỗ trợ</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate mt-1">
                                                {(session.lastUserMessage && session.lastUserMessage !== "No user messages")
                                                    ? session.lastUserMessage
                                                    : (session.last_message || "Chưa có tin nhắn")}
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(session.session_id);
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500"
                                            title="Xóa phiên"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <MessageList messages={messages} primaryColor={primaryColor} isTyping={isTyping} messagesEndRef={messagesEndRef} />

            {/* Topic Selector - Compact */}
            <div className="px-3 py-2 border-t bg-gray-50">
                <div className="flex gap-1.5">
                    {AVAILABLE_AGENTS.map(agent => (
                        <button
                            key={agent.name}
                            onClick={() => setSelectedAgent(agent.name)}
                            className={`flex-1 px-2 py-1.5 text-xs rounded font-medium transition-all ${selectedAgent === agent.name
                                ? 'bg-blue-500 text-white shadow-sm'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                            title={agent.description}
                        >
                            <div className="flex items-center justify-center gap-1">
                                <span>{agent.icon}</span>
                                <span>
                                    {agent.name === 'GuidelineAgent' ? 'Support' :
                                        agent.name === 'SupervisorAgent' ? 'Chung' : 'Công nợ'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
                {!selectedAgent && (
                    <p className="text-[10px] text-orange-600 mt-1 text-center">
                        ⚠️ Chọn Topic trước
                    </p>
                )}
            </div>

            <MessageInput
                input={input}
                setInput={setInput}
                onSend={handleSendMessage}
                isTyping={isTyping || !selectedAgent}
                attachedFile={attachedFile}
                onFileAttach={setAttachedFile}
                primaryColor={primaryColor}
                placeholder={selectedAgent ? "Nhập tin nhắn..." : "Chọn chủ đề trước..."}
            />

            <EscalationDialog
                show={showEscalationDialog}
                reason={escalationReason}
                onReasonChange={setEscalationReason}
                onSubmit={handleEscalationSubmit}
                onCancel={() => setShowEscalationDialog(false)}
            />
        </div>
    );
};

export default EmbeddedWidget;
