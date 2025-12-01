import React, { useState, useEffect, useRef } from 'react';
import { Tenant, UserInfo, Message, SessionSummary } from '../types';
import { sendMessage, getApiBaseUrl } from '../services/chatService';
import { escalateSession, detectAutoEscalation } from '../services/escalationService';
import { getUserSessions, getSessionDetailPublic } from '../services/sessionService';
import { XMarkIcon, ClockIcon } from './icons';
import MessageList from './shared/MessageList';
import MessageInput from './shared/MessageInput';
import EscalationDialog from './shared/EscalationDialog';

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

    // History Toggle State
    const [showHistory, setShowHistory] = useState(false);
    const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            const autoDetection = await detectAutoEscalation(escalationReason, undefined, token);
            await escalateSession(tenant.id, sessionId, escalationReason, autoDetection.should_escalate, autoDetection.detected_keywords, token);
            setIsEscalated(true);
            setShowEscalationDialog(false);
            setMessages((prev) => [...prev, {
                id: `system-${Date.now()}`,
                text: `✋ Escalated. A supporter will help you shortly.`,
                sender: 'ai',
                timestamp: new Date().toISOString(),
            }]);
            setEscalationReason('');
        } catch (error) {
            console.error('Escalation error:', error);
            alert('Failed to escalate');
        }
    };

    const toggleHistory = async () => {
        if (!showHistory) {
            setIsLoadingHistory(true);
            try {
                const sessions = await getUserSessions(tenant.id, userId, token);
                // Filter out current session and empty sessions if needed
                setSessionList(sessions.filter(s => s.session_id !== sessionId));
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingHistory(false);
            }
        }
        setShowHistory(!showHistory);
    };

    const switchSession = (newSessionId: string) => {
        setSessionId(newSessionId);
        setShowHistory(false);
    };

    const primaryColor = tenant.theme.primaryColor;

    return (
        <div className="bg-white flex flex-col font-sans w-full h-full overflow-hidden relative">
            <header className="p-4 text-white flex justify-between items-center shadow-md z-20" style={{ backgroundColor: primaryColor }}>
                <div>
                    <h2 className="font-bold text-lg">{tenant.theme.headerText}</h2>
                    <p className="text-xs opacity-90">
                        {userInfo.username ? `Hi, ${userInfo.username}!` : 'Chat with us'}
                        {isEscalated && <span className="ml-2 inline-block px-2 py-0.5 bg-orange-400 text-white text-xs rounded-full">Escalated</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleHistory} className="hover:bg-white/20 p-1 rounded-full" title="History">
                        <ClockIcon className="h-5 w-5" />
                    </button>
                    {!isEscalated && (
                        <button onClick={() => setShowEscalationDialog(true)} className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded">Escalate</button>
                    )}
                    <button onClick={onEndSession} className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-2 py-1 rounded">End</button>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><XMarkIcon className="h-6 w-6" /></button>
                </div>
            </header>

            {/* History Dropdown */}
            {showHistory && (
                <div className="absolute top-16 right-2 w-64 bg-white shadow-xl rounded-lg border border-gray-200 z-30 max-h-80 overflow-y-auto">
                    <div className="p-2 border-b bg-gray-50 font-semibold text-xs text-gray-500">Previous Sessions</div>
                    {isLoadingHistory ? (
                        <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
                    ) : sessionList.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-xs">No previous sessions</div>
                    ) : (
                        <ul>
                            {sessionList.map(session => (
                                <li key={session.session_id}>
                                    <button
                                        onClick={() => switchSession(session.session_id)}
                                        className="w-full text-left p-3 hover:bg-blue-50 border-b last:border-0 transition-colors"
                                    >
                                        <div className="text-xs font-medium text-gray-700">
                                            {new Date(session.created_at).toLocaleString()}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate mt-1">
                                            {session.last_message || "No messages"}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <MessageList messages={messages} primaryColor={primaryColor} isTyping={isTyping} messagesEndRef={messagesEndRef} />
            <MessageInput input={input} setInput={setInput} onSend={handleSendMessage} isTyping={isTyping} attachedFile={attachedFile} onFileAttach={setAttachedFile} primaryColor={primaryColor} placeholder="Type your message..." />

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
