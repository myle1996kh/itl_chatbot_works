
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
    // Load chat history from localStorage
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
    } catch (error) {
      console.error("Failed to load or parse chat history", error);
    }
  }, [tenant, userInfo, initialTopicId]);

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

  // Poll for new messages periodically (to catch supporter messages from admin)
  useEffect(() => {
    // Start polling every 3 seconds for new messages
    const pollInterval = setInterval(async () => {
      try {
        // Fetch session details from backend to get latest messages
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
          // Check if there are new messages
          if (data.messages && Array.isArray(data.messages)) {
            // Transform backend messages to our format
            const backendMessages = data.messages.map((msg: any) => ({
              id: msg.message_id || `msg-${Math.random()}`,
              text: msg.content,
              sender: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'ai' : 'supporter',
              timestamp: msg.created_at || new Date().toISOString(),
            }));

            // Always update with latest messages from backend for this session
            // (prevents message carryover when session changes)
            console.log(`✅ Fetched ${backendMessages.length} messages from backend (was ${messages.length})`);
            setMessages(backendMessages);
            // Update localStorage
            try {
              localStorage.setItem(getHistoryKey(), JSON.stringify({ messages: backendMessages }));
            } catch { }
          }
        }
      } catch (error) {
        // Silently ignore polling errors (not critical)
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [sessionId, tenant.id]);

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
        text: `✋ Your request has been escalated to a human supporter. Reason: "${escalationReason}". A supporter will be with you shortly.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, escalationMessage]);

      setShowEscalationDialog(false);
      setEscalationReason('');

      console.log('✅ Session escalated:', response);
    } catch (error) {
      console.error('❌ Escalation error:', error);
      alert(`Failed to escalate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const primaryColor = tenant.theme.primaryColor;
  // Ensure primaryColor is a valid CSS color (hex) for inline styles
  // If it happens to be a tailwind class name like 'blue-600', this won't work with style={{backgroundColor}}
  // But we updated widget.tsx to pass hex.

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
            Topic: {currentTopic?.name}
            {isEscalated && <span className="ml-2 inline-block px-2 py-0.5 bg-orange-400 text-white text-xs rounded-full">Escalated</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEscalated && (
            <button
              onClick={() => setShowEscalationDialog(true)}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded"
              title="Request human support"
            >
              Escalate
            </button>
          )}
          <button onClick={() => { try { localStorage.removeItem(getActiveSessionKey()); } catch { }; onEndSession(); }} className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-2 py-1 rounded">End Session</button>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><XMarkIcon className="h-6 w-6" /></button>
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender !== 'user' && (
              <div
                className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: msg.sender === 'ai' ? primaryColor : '#9CA3AF' }}
              >
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
            )}
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
                className="prose prose-sm max-w-none"
                style={{
                  whiteSpace: 'pre-wrap',
                }}
              >
                {/* <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // ... components ...
                  }}
                >
                  {msg.text}
                </Markdown> */}
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
            {msg.sender === 'user' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center"><UserCircleIcon className="h-6 w-6 text-gray-600" /></div>}
          </div>
        ))}
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
            placeholder="Ask a question..."
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
      {showEscalationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Request Human Support</h3>
            <p className="text-sm text-gray-600 mb-4">
              Why do you need human support? Please describe the issue or your reason for escalation.
            </p>
            <textarea
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              placeholder="Describe your issue or reason for escalation..."
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
                Cancel
              </button>
              <button
                onClick={handleEscalationSubmit}
                className="px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium"
              >
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
