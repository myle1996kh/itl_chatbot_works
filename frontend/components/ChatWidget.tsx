
import React, { useState, useEffect, useRef } from 'react';
import { Tenant, UserInfo, Message, Topic } from '../types';
import { sendMessage, getApiBaseUrl } from '../services/chatService';
import { escalateSession, detectAutoEscalation } from '../services/escalationService';
import { getAgentNameFromMessage } from '../src/config/topic-agent-mapping';
import { SendIcon, PaperclipIcon, XMarkIcon, SparklesIcon, UserCircleIcon } from './icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatWidgetProps {
  tenant: Tenant;
  userInfo: UserInfo;
  initialTopicId: string;
  userId: string;  // Chat user UUID (not email!)
  sessionId: string;  // Initial session ID
  onClose: () => void;
  onEndSession: () => void;
  mode?: 'admin' | 'widget';  // 'admin' = fixed size (App.tsx), 'widget' = full size (widget.tsx)
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ tenant, userInfo, initialTopicId, userId, sessionId: initialSessionId, onClose, onEndSession, mode = 'admin' }) => {
  // ============================================================================
  // DEBT RENDERING HELPERS
  // ============================================================================

  // Format currency for Vietnamese locale
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('vi-VN').format(value || 0);
  };

  // Detect if message contains debt JSON response
  const isDebtResponse = (text: string): boolean => {
    // Check if message has "Entity đã nhận diện" and contains JSON array or object
    if (!text.includes('Entity đã nhận diện')) return false;

    // Check if it contains JSON structure (array or object)
    const hasJsonArray = text.includes('[') && text.includes(']');
    const hasJsonObject = text.includes('{') && text.includes('}');

    // Check for debt-specific fields in the text
    const hasDebtFields = text.includes('customerName') ||
      text.includes('salesmanName') ||
      text.includes('debitAmount') ||
      text.includes('creditLimit');

    return (hasJsonArray || hasJsonObject) && hasDebtFields;
  };

  // Parse debt data from message text
  const parseDebtData = (text: string): any => {
    try {
      // Strip "Entity đã nhận diện: xxx" line
      const cleaned = text.replace(/Entity đã nhận diện:.*?\n/g, '');

      // Extract JSON (handle both array and object)
      const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
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
    } catch (e) {
      console.error('Failed to parse debt data:', e);
    }
    return null;
  };

  // ============================================================================
  // STATE & REFS
  // ============================================================================

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string>(initialSessionId);
  const [isEscalated, setIsEscalated] = useState(false);
  const [escalationStatus, setEscalationStatus] = useState<'none' | 'pending' | 'assigned' | 'resolved'>('none');
  const [showEscalationDialog, setShowEscalationDialog] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getHistoryKey = () => `chatHistory_${tenant.id}_${userInfo.email}`;
  const getActiveSessionKey = () => `activeSession_${tenant.id}_${userInfo.email}`;

  useEffect(() => {
    // Load chat history from localStorage and fetch session details
    const loadSessionData = async () => {
      try {
        const savedHistory = localStorage.getItem(getHistoryKey());
        const topic = tenant.topics.find(t => t.id === initialTopicId);
        setCurrentTopic(topic || null);

        if (savedHistory) {
          setMessages(JSON.parse(savedHistory).messages);
        } else if (topic) {
          // Find the initial topic and add a welcome message
          const welcomeMessage: Message = {
            id: `ai-${Date.now()}`,
            text: tenant.theme.welcomeMessage,
            sender: 'ai',
            timestamp: new Date().toISOString(),
          };
          setMessages([welcomeMessage]);
        }

        // Restore active session id so follow-up messages go to the same session
        const savedSessionId = localStorage.getItem(getActiveSessionKey()!);
        if (savedSessionId) {
          setSessionId(savedSessionId);
        }

        // Load escalation status from backend
        if (sessionId) {
          try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(
              `${baseUrl}/api/${tenant.id}/session/${sessionId}`,
              {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
              }
            );

            if (response.ok) {
              const data = await response.json();
              // Load escalation status
              if (data.escalation_status && data.escalation_status !== 'none' && data.escalation_status !== 'resolved') {
                setIsEscalated(true);
                setEscalationStatus(data.escalation_status);
              } else {
                setIsEscalated(false);
                setEscalationStatus(data.escalation_status || 'none');
              }
            }
          } catch (error) {
            console.error('Failed to load escalation status:', error);
          }
        }
      } catch (error) {
        console.error("Failed to load or parse chat history", error);
      }
    };

    loadSessionData();
  }, [tenant, userInfo, initialTopicId, sessionId]);

  // Sync prop to state when initialSessionId changes (parent updated the session)
  useEffect(() => {
    if (initialSessionId !== sessionId) {
      console.log(`📝 Session changed: ${sessionId} → ${initialSessionId}. Clearing messages for fresh start.`);
      setSessionId(initialSessionId);
      setMessages([]);
      localStorage.removeItem(getHistoryKey());
      localStorage.removeItem(getActiveSessionKey());
    }
  }, [initialSessionId]);

  // SSE connection for real-time updates (replaces polling)
  useEffect(() => {
    if (!sessionId) return;

    const baseUrl = getApiBaseUrl();
    const sseUrl = `${baseUrl}/api/${tenant.id}/session/${sessionId}/stream`;

    console.log('🔌 SSE: Connecting to', sseUrl);
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => console.log('✅ SSE connected');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new_message') {
          // Add new message from supporter
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
          const previousStatus = escalationStatus;

          if (data.escalation_status && data.escalation_status !== 'none' && data.escalation_status !== 'resolved') {
            setIsEscalated(true);
            setEscalationStatus(data.escalation_status);
          } else if (data.escalation_status === 'resolved') {
            setIsEscalated(false);
            setEscalationStatus('resolved');

            // Add resolution message if status changed
            if (previousStatus !== 'resolved' && previousStatus !== 'none') {
              setMessages(prev => {
                const hasResolutionMessage = prev.some(m =>
                  m.text.includes('✅ Yêu cầu của bạn đã được giải quyết')
                );
                if (!hasResolutionMessage) {
                  return [...prev, {
                    id: `system-resolved-${Date.now()}`,
                    text: '✅ Yêu cầu của bạn đã được giải quyết bởi nhân viên hỗ trợ. Bạn có thể yêu cầu hỗ trợ lại nếu cần.',
                    sender: 'ai',
                    timestamp: new Date().toISOString(),
                  }];
                }
                return prev;
              });
            }
          }
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
      console.log('🔌 SSE: Disconnecting');
      eventSource.close();
    };
  }, [sessionId, tenant.id, escalationStatus]);

  useEffect(() => {
    // Save chat history whenever it changes
    if (messages.length > 0) {
      try {
        const sessionData = { messages };
        localStorage.setItem(getHistoryKey(), JSON.stringify(sessionData));
      } catch (error) {
        console.error("Failed to save chat history", error);
      }
    }
    // Scroll to the bottom
    // messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsTyping(true);

    const fileToSend = attachedFile;
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    let aiResponseText = '';
    let newSessionId = sessionId;

    try {
      // Phase 1: Direct agent routing via agent_name parameter
      // Automatically detect agent from message keywords or use topic's agent
      const agentName = getAgentNameFromMessage(messageText);

      const response = await sendMessage({
        message: messageText,
        tenantId: tenant.id,
        sessionId: newSessionId,
        userId: userId,  // Use UUID, not email!
        agentName: agentName, // Phase 1: Direct routing
      });

      if (response.success && response.data) {
        // Prefer showing only the textual content from the agent response
        const pickDisplayText = (data: any): string => {
          if (!data) return '';
          if (typeof data === 'string') {
            const raw = data.trim();
            // Try JSON parse if it looks like JSON
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
        aiResponseText = pickDisplayText(response.data);

        // Store session ID for follow-up messages
        if (response.data.session_id) {
          newSessionId = response.data.session_id;
          setSessionId(newSessionId);
          try {
            localStorage.setItem(getActiveSessionKey(), newSessionId);
          } catch { }
        }

        console.log(`✅ Agent response from ${response.data.agent}:`, {
          intent: response.data.intent,
          sessionId: newSessionId,
        });
      } else {
        aiResponseText = response.error || 'Sorry, I encountered an error. Please try again.';
        console.error('❌ Chat error:', response.error, response.code);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      aiResponseText = "Sorry, I encountered an error. Please try again.";
    }

    const aiMessage: Message = {
      id: `ai-${Date.now() + 1}`,
      text: aiResponseText,
      sender: 'ai',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const handleEscalationSubmit = async () => {
    if (!escalationReason.trim() || !sessionId) {
      alert('Please enter a reason for escalation');
      return;
    }

    try {
      // Check for auto-escalation keywords
      const autoDetectionResult = await detectAutoEscalation(escalationReason);

      // Escalate the session
      const response = await escalateSession(
        tenant.id,
        sessionId,
        escalationReason,
        autoDetectionResult.should_escalate,
        autoDetectionResult.detected_keywords
      );

      setEscalationStatus('pending');
      setIsEscalated(true);

      // Add escalation notification message
      const escalationMessage: Message = {
        id: `system-${Date.now()}`,
        text: `✋ Yêu cầu của bạn đã được chuyển đến nhân viên hỗ trợ. Lý do: "${escalationReason}". Nhân viên sẽ hỗ trợ bạn trong giây lát.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, escalationMessage]);

      setShowEscalationDialog(false);
      setEscalationReason('');

      console.log('✅ Session escalated:', response);
    } catch (error) {
      console.error('❌ Escalation error:', error);
      alert(`Không thể gửi yêu cầu hỗ trợ: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }
  };

  const primaryColor = tenant.theme.primaryColor;
  // Ensure primaryColor is a valid CSS color (hex) for inline styles
  // If it happens to be a tailwind class name like 'blue-600', this won't work with style={{backgroundColor}}
  // But we updated widget.tsx to pass hex.

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

  return (
    <div className={`bg-white rounded-lg shadow-2xl flex flex-col font-sans transition-all duration-300 ${mode === 'widget' ? 'w-full h-full overflow-hidden' : 'w-96 h-[600px]'
      }`}>
      <header
        className={`p-4 text-white flex justify-between items-center shadow-md ${mode === 'widget' ? '' : 'rounded-t-lg'
          }`}
        style={{ backgroundColor: primaryColor }}
      >
        <div>
          <h2 className="font-bold text-lg">{tenant.theme.headerText}</h2>
          <p className="text-xs opacity-90">
            Chủ đề: {currentTopic?.name}
            {isEscalated && <span className="ml-2 inline-block px-2 py-0.5 bg-orange-400 text-white text-xs rounded-full">Đã yêu cầu hỗ trợ</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEscalated && (
            <button
              onClick={() => setShowEscalationDialog(true)}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded"
              title="Yêu cầu hỗ trợ từ nhân viên"
            >
              Yêu cầu hỗ trợ
            </button>
          )}
          <button onClick={() => { try { localStorage.removeItem(getActiveSessionKey()); } catch { }; onEndSession(); }} className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-2 py-1 rounded">Kết thúc phiên</button>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><XMarkIcon className="h-6 w-6" /></button>
        </div>
      </header>

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

      <div className="p-3 border-t bg-white rounded-b-lg">
        {attachedFile && (
          <div className="flex items-center justify-between bg-gray-100 p-2 rounded-md mb-2 text-sm">
            <span className="truncate">{attachedFile.name}</span>
            <button onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="p-1 text-gray-500 hover:text-gray-800"><XMarkIcon className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Đặt câu hỏi..."
            className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1"
            disabled={isTyping}
          />
          <input type="file" ref={fileInputRef} onChange={handleFileAttach} className="hidden" id="file-upload-chat" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-gray-800">
            <PaperclipIcon className="h-6 w-6" />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={isTyping || (!input.trim() && !attachedFile)}
            className="p-2 rounded-full text-white transition-colors"
            style={
              isTyping || (!input.trim() && !attachedFile)
                ? { backgroundColor: '#D1D5DB', cursor: 'not-allowed' }
                : { backgroundColor: primaryColor }
            }
          >
            <SendIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Escalation Dialog Modal */}
      {
        showEscalationDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4 text-gray-800">Yêu cầu hỗ trợ từ nhân viên</h3>
              <p className="text-sm text-gray-600 mb-4">
                Vì sao bạn cần hỗ trợ từ nhân viên? Vui lòng mô tả vấn đề hoặc lý do yêu cầu hỗ trợ.
              </p>
              <textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Mô tả vấn đề hoặc lý do cần hỗ trợ..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4 resize-none"
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowEscalationDialog(false);
                    setEscalationReason('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={handleEscalationSubmit}
                  className="px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium"
                >
                  Gửi yêu cầu
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default ChatWidget;
