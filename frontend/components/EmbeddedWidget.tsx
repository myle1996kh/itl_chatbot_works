import React, { useState, useEffect, useRef } from 'react';
import { Tenant, UserInfo, Message, SessionSummary } from '../types';
import { sendMessage, getApiBaseUrl } from '../services/chatService';
import { escalateSessionPublic } from '../services/escalationService';
import { getUserSessions, getSessionDetailPublic } from '../services/sessionService';
import { XMarkIcon, ClockIcon, SparklesIcon, UserCircleIcon } from './icons';
import MessageInput from './shared/MessageInput';
import EscalationDialog from './shared/EscalationDialog';
import { AVAILABLE_AGENTS, AgentName } from '../src/config/topic-agent-mapping';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

    // ============================================================================
    // DEBT RENDERING HELPERS
    // ============================================================================

    // Format currency for Vietnamese locale
    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('vi-VN').format(value || 0);
    };

    // Detect if message contains debt JSON response
    const isDebtResponse = (text: string): boolean => {
        // Check for debt-specific fields in the text
        const hasDebtFields = text.includes('customerName') ||
            text.includes('salesmanName') ||
            text.includes('debitAmount') ||
            text.includes('creditLimit');

        // If we have debt-specific fields, it's a debt response
        if (hasDebtFields) {
            // Additional check: make sure it also appears to contain JSON structure
            const hasJsonArray = text.includes('[') && text.includes(']');
            const hasJsonObject = text.includes('{') && text.includes('}');

            return (hasJsonArray || hasJsonObject) && hasDebtFields;
        }

        // Fallback: check if it has the old format with "Entity đã nhận diện"
        if (text.includes('Entity đã nhận diện')) {
            const hasJsonArray = text.includes('[') && text.includes(']');
            const hasJsonObject = text.includes('{') && text.includes('}');
            return (hasJsonArray || hasJsonObject) && hasDebtFields;
        }

        return false;
    };

    // Parse debt data from message text
    const parseDebtData = (text: string): any => {
        try {
            // First check if the message starts with "Entity đã nhận diện: " and extract just the JSON part
            if (text.includes('Entity đã nhận diện:')) {
                // Extract content after the "Entity đã nhận diện: MST" line
                const jsonStartIndex = text.indexOf('\n');
                if (jsonStartIndex !== -1) {
                    const jsonPart = text.substring(jsonStartIndex + 1).trim();
                    // Parse the JSON part that contains the actual data
                    const parsed = JSON.parse(jsonPart);

                    // Check if it's wrapped in {"output": "..."} format
                    if (parsed.output) {
                        // The output field contains a stringified JSON, need to parse again
                        if (typeof parsed.output === 'string') {
                            // Replace Python-style single quotes with double quotes
                            const fixedJson = parsed.output.replace(/'/g, '"');
                            return JSON.parse(fixedJson);
                        }
                        return parsed.output;
                    }
                    return parsed;
                }
            } else {
                // If no "Entity đã nhận diện" prefix, try to parse the entire text
                const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);

                    // Check if it's wrapped in {"output": "..."} format
                    if (parsed.output) {
                        // The output field contains a stringified JSON, need to parse again
                        if (typeof parsed.output === 'string') {
                            // Replace Python-style single quotes with double quotes
                            const fixedJson = parsed.output.replace(/'/g, '"');
                            return JSON.parse(fixedJson);
                        }
                        return parsed.output;
                    }
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Failed to parse debt data:', e);
        }
        return null;
    };

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

            // Prefer showing only the textual content from the agent response
            const pickDisplayText = (data: any): string => {
                if (!data) return '';
                if (typeof data === 'string') {
                    let raw = data.trim();

                    // Check if string contains "Entity đã nhận diện: " prefix followed by JSON
                    if (raw.includes('Entity đã nhận diện:')) {
                        // Extract content after the prefix line
                        const jsonStartIndex = raw.indexOf('\n');
                        if (jsonStartIndex !== -1) {
                            // Get the JSON part after the newline
                            const jsonPart = raw.substring(jsonStartIndex + 1).trim();

                            // If jsonPart is a JSON string with output field, process it
                            if (jsonPart.startsWith('{') && jsonPart.endsWith('}')) {
                                try {
                                    const parsed = JSON.parse(jsonPart);
                                    if (parsed.output) {
                                        if (typeof parsed.output === 'string') {
                                            // Replace Python-style single quotes with double quotes
                                            const fixedJson = parsed.output.replace(/'/g, '"');
                                            return fixedJson;
                                        }
                                        // If output is an object/array, stringify it for further processing
                                        return JSON.stringify(parsed.output);
                                    }
                                    return JSON.stringify(parsed);
                                } catch {
                                    // If JSON parsing fails, return the JSON part
                                    return jsonPart;
                                }
                            }
                            // If it's not a JSON object, but just the JSON part after the prefix
                            return jsonPart;
                        }
                        // If no newline found, return the original string without the prefix
                        return raw.replace(/Entity đã nhận diện:.*$/, '').trim();
                    }

                    // Original logic for other formats
                    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
                        try {
                            const parsed = JSON.parse(raw);
                            data = parsed;
                        } catch {
                            // Extract text from JSON-like strings as last resort
                            const dq = Array.from(raw.matchAll(/\"text\"\s*:\s*\"([\s\S]*?)\"/g)).map(m => m[1]);
                            if (dq.length) return dq.join('\n\n');
                            const sq = Array.from(raw.matchAll(/'text'\s*:\s*'([\s\S]*?)'/g)).map(m => m[1]);
                            if (sq.length) return sq.join('\n\n');
                        }
                    } else {
                        return raw;
                    }
                }
                // If the payload itself is an array of segments, extract text parts
                if (Array.isArray(data)) {
                    const texts = data
                        .map((item: any) => {
                            if (!item) return null;
                            if (typeof item === 'string') return item;
                            if (typeof item.text === 'string') return item.text;
                            if (typeof item.content === 'string') return item.content;
                            return null;
                        })
                        .filter(Boolean) as string[];
                    if (texts.length) return texts.join('\n\n');
                }

                // Helper to extract text from common nested response shapes
                const extractFromResponse = (resp: any): string | null => {
                    if (!resp) return null;
                    if (Array.isArray(resp)) {
                        const texts = resp
                            .map((item: any) => {
                                if (!item) return null;
                                if (typeof item === 'string') return item;
                                if (typeof item.text === 'string') return item.text;
                                if (typeof item.content === 'string') return item.content;
                                return null;
                            })
                            .filter(Boolean) as string[];
                        if (texts.length) return texts.join('\n\n');
                        return null;
                    }
                    if (typeof resp === 'object') {
                        if (typeof resp.text === 'string') return resp.text;
                        if (typeof resp.content === 'string') return resp.content;
                    }
                    return null;
                };

                // Handle structures like { response: [ { type: 'text', text: '...' } ] }
                const nestedFromResponse = extractFromResponse((data as any).response);
                if (nestedFromResponse) return nestedFromResponse;

                // Handle { outputs: [...] } or { output: { text: ... } }
                const fromOutputs =
                    extractFromResponse((data as any).outputs) ||
                    extractFromResponse((data as any).output);
                if (fromOutputs) return fromOutputs;

                // Flat candidates
                const candidates = [
                    (data as any).text,
                    (data as any).content,
                    (data as any).message,
                    (data as any).answer,
                    (data as any)?.output?.text,
                    (data as any)?.output?.content,
                ];
                for (const c of candidates) {
                    if (typeof c === 'string' && c.trim()) return c;
                }
                // Fallback: stringify (kept for debugging; can be replaced with empty string)
                return JSON.stringify(data, null, 2);
            };

            // Some agents return response as an array under data.response, others
            // wrap it directly on data. Pass the whole payload and let the picker
            // extract from either shape (including arrays).
            const aiResponseText = pickDisplayText(response.data);

            const aiMessage: Message = {
                id: `ai-${Date.now() + 1}`,
                text: response.success ? aiResponseText : (response.error || 'Sorry, I encountered an error. Please try again.'),
                sender: 'ai',
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error('Send error:', error);
            const errorMessage: Message = {
                id: `ai-${Date.now() + 1}`,
                text: "Sorry, I encountered an error. Please try again.",
                sender: 'ai',
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
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

    // ============================================================================
    // DEBT CARD COMPONENTS
    // ============================================================================

    // Customer Debt Card Component
    const CustomerDebtCard = ({ data }: { data: any }) => (
        <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            maxWidth: '400px',
            fontSize: '13px'
        }}>
            {/* Header */}
            <div style={{ borderBottom: `2px solid ${primaryColor}`, paddingBottom: '8px', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>📊 Thông tin công nợ khách hàng</h4>
            </div>

            {/* Customer Info */}
            <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '4px 0' }}><strong>Khách hàng:</strong> {data.customerName || 'N/A'}</p>
                <p style={{ margin: '4px 0' }}><strong>MST:</strong> {data.taxCode || data.customerTaxCode || 'N/A'}</p>
                <p style={{ margin: '4px 0' }}><strong>Nhân viên Sales:</strong> {data.salesmanName || 'N/A'}</p>
                <p style={{ margin: '4px 0' }}><strong>Loại hợp đồng:</strong> {data.contractType || 'N/A'}</p>
            </div>

            {/* Financial Info */}
            <div style={{ marginBottom: '12px' }}>
                <h5 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>💰 Thông tin tài chính</h5>
                <table style={{ width: '100%', fontSize: '13px' }}>
                    <tbody>
                        <tr><td style={{ padding: '4px 0' }}>Hạn mức tín dụng</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.creditLimit)} VND</td></tr>
                        <tr><td style={{ padding: '4px 0' }}>Số dư nợ hiện tại</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.debitAmount)} VND</td></tr>
                        <tr><td style={{ padding: '4px 0' }}>Đã thanh toán</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.paidAmount || data.paid)} VND</td></tr>
                        <tr><td style={{ padding: '4px 0' }}>Dư nợ</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.billingUnpaid || data.outstanding)} VND</td></tr>
                    </tbody>
                </table>
            </div>

            {/* Overdue Analysis */}
            <div>
                <h5 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>⚠️ Phân tích quá hạn</h5>
                <table style={{ width: '100%', fontSize: '13px' }}>
                    <tbody>
                        <tr><td style={{ padding: '4px 0' }}>Tổng nợ quá hạn</td><td style={{ textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>{formatCurrency(data.overAmount)} VND</td></tr>
                        <tr><td style={{ padding: '4px 0' }}>1-15 ngày</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.over1To15Day || data.over1to15)} VND</td></tr>
                        <tr><td style={{ padding: '4px 0' }}>16-30 ngày</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.over16To30Day || data.over16to30)} VND</td></tr>
                        <tr><td style={{ padding: '4px 0' }}>Trên 30 ngày</td><td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(data.over30Day || data.over30)} VND</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Salesman Debt Card Component
    const SalesmanDebtCard = ({ data }: { data: any[] }) => {
        const salesmanName = data[0]?.salesmanName || 'Unknown';
        const totalCustomers = data.length;
        const totalDebt = data.reduce((sum, item) => sum + (item.debitAmount || 0), 0);

        return (
            <div style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                maxWidth: '400px',
                fontSize: '13px'
            }}>
                {/* Summary Header */}
                <div style={{
                    background: '#f8f9fa',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '12px'
                }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>👤 Sales: {salesmanName}</h4>
                    <p style={{ margin: '4px 0' }}><strong>Số khách hàng:</strong> {totalCustomers}</p>
                    <p style={{ margin: '4px 0' }}>
                        <strong>Tổng công nợ:</strong>{' '}
                        <span style={{ color: totalDebt > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                            {formatCurrency(totalDebt)} VND
                        </span>
                    </p>
                </div>

                {/* Customer List */}
                {data.map((item, idx) => (
                    <div key={idx}>
                        {idx > 0 && <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '10px 0' }} />}
                        <div style={{ margin: '8px 0' }}>
                            <strong>{item.customerName} - {item.salesmanName} - {item.contractType}</strong>
                            <ul style={{ margin: '6px 0 0 18px', fontSize: '13px' }}>
                                <li>Công nợ: {formatCurrency(item.debitAmount)} VND</li>
                                <li>Hạn mức: {formatCurrency(item.creditLimit)} VND</li>
                                <li>Tỷ lệ vượt hạn mức: {(item.debitRate || 0).toFixed(2)}</li>
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        );
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

            {/* Custom Message List with Debt Card Support */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                {messages.map((msg) => {
                    // Check if this is a debt response from AI
                    const isDebt = msg.sender === 'ai' && isDebtResponse(msg.text);
                    const debtData = isDebt ? parseDebtData(msg.text) : null;

                    // Determine if customer or salesman debt
                    const isCustomerDebt = debtData && !Array.isArray(debtData);
                    const isSalesmanDebt = debtData && Array.isArray(debtData);

                    return (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender !== 'user' && (
                                <div
                                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: msg.sender === 'ai' ? primaryColor : '#9CA3AF' }}
                                >
                                    <SparklesIcon className="h-5 w-5 text-white" />
                                </div>
                            )}

                            {/* Render custom debt card if detected, otherwise normal message */}
                            {isCustomerDebt ? (
                                <CustomerDebtCard data={debtData} />
                            ) : isSalesmanDebt ? (
                                <SalesmanDebtCard data={debtData} />
                            ) : (
                                <div
                                    className={`rounded-lg px-3 py-2 max-w-xs shadow-sm ${msg.sender === 'user' ? 'text-white' : 'bg-white text-gray-800'}`}
                                    style={msg.sender === 'user' ? { backgroundColor: primaryColor, color: 'white' } : {}}
                                >
                                    {msg.sender === 'supporter' && <div className="font-bold text-xs mb-1 text-green-600">{msg.supporterName}</div>}
                                    {msg.fileInfo && (
                                        <div className="text-xs font-mono p-2 bg-black/10 rounded-md mb-2">
                                            Attached: {msg.fileInfo.name}
                                        </div>
                                    )}
                                    <div
                                        className="prose prose-sm max-w-none markdown-content"
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        <style>{`
                                        .markdown-content p { margin: 0.3em 0; }
                                        .markdown-content p.nguon { font-style: italic; }
                                        .markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4 { margin: 0.2em 0; font-weight: bold; }
                                        .markdown-content h1 { font-size: 1.8em; }
                                        .markdown-content h2 { font-size: 1.4em; }
                                        .markdown-content h3 { font-size: 1.15em; }
                                        .markdown-content ul, .markdown-content ol { margin: 0.3em 0; padding-left: 1.5em; }
                                        .markdown-content ul { list-style-type: disc; }
                                        .markdown-content ol { list-style-type: decimal; }
                                        .markdown-content li { margin: 0.1em 0; }
                                        .markdown-content code { background-color: rgba(0,0,0,0.05); padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
                                        .markdown-content pre { background-color: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; font-family: monospace; }
                                        .markdown-content blockquote { margin: 1em 0; padding-left: 1em; border-left: 4px solid ${primaryColor}; color: #666; font-style: italic; }
                                        .markdown-content a { color: ${primaryColor}; text-decoration: underline; }
                                    `}</style>
                                        <Markdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: (props) => {
                                                    const content = Array.isArray(props.children) ? props.children.join('') : String(props.children || '');
                                                    return content.includes('Nguồn:')
                                                        ? <p className="nguon" {...props} />
                                                        : <p {...props} />;
                                                }
                                            }}
                                        >
                                            {msg.text}
                                        </Markdown>
                                    </div>
                                </div>
                            )}
                            {msg.sender === 'user' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center"><UserCircleIcon className="h-6 w-6 text-gray-600" /></div>}
                        </div>
                    );
                })}
                {isTyping && (
                    <div className="flex items-end gap-2 justify-start">
                        <div
                            className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <SparklesIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="rounded-lg px-3 py-2 max-w-xs shadow-sm bg-white text-gray-800">
                            <div className="flex items-center gap-1">
                                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

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
