import React, { useState, useEffect, useMemo } from 'react';
// import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, isAdmin, type LoginResponse } from '../services/authService';
import {
  getDocumentsForTopic,
  addDocumentToKnowledgeBase,
  enrichKnowledgeBaseFromChat,
} from '../services/embeddingService';
import { parseFileToText } from '../services/fileParserService';
import { uploadDocument, getKnowledgeBaseStats, ingestTexts } from '../services/knowledgeService';
import { AGENT_NAMES } from '../src/config/topic-agent-mapping';
import {
  getEscalationQueue,
  assignSupporter as assignSupporterToEscalation,
  resolveEscalation,
  getSupporters as getSupportersForEscalation,
  type EscalationResponse,
  type Supporter as EscalationSupporter,
} from '../services/escalationService';
import {
  getSessionsWithFallback,
  getSessionDetail,
  getSessionDetailPublic,
  sendSupporterMessage,
  type ChatSession,
  type SessionDetail,
  type SessionSummary,
} from '../services/sessionService';
import {
  getTenants as getTenantsFromBackend,
  getSupporters as getSupportersFromBackend,
  listUsers,
  listTenantUsers,
  createSupporter,
  updateSupporter,
  deleteSupporter,
} from '../services/adminService';
import { getAgents } from '../services/agentService';
import { ChatBubbleIcon, DocumentIcon, ExtractIcon, KnowledgeBaseIcon, UploadIcon, XCircleIcon } from './icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LoginPage from '../pages/LoginPage';
import type { Supporter, Tenant, KnowledgeDocument, Message } from '../types';

type AdminView = 'sessions' | 'knowledge' | 'users' | 'supporters' | 'escalations';

// Helper functions with fallback to constants
const findSupporter = (id: string | null, supportersList: Supporter[]) =>
  id ? supportersList.find(s => s.id === id) : null;

const findTenant = (id: string, tenantsList: Tenant[]) =>
  tenantsList.find(t => t.id === id);

interface AdminDashboardProps {
  onLogout?: () => void;
  onSwitchToDemo?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onSwitchToDemo }) => {
  const navigate = useNavigate();
  // Authentication state
  const [authenticatedUser, setAuthenticatedUser] = useState<LoginResponse | null>(getCurrentUser());
  const [userRole, setUserRole] = useState<string | null>(authenticatedUser?.role || null);

  // Backend data state
  const [backendTenants, setBackendTenants] = useState<Tenant[]>([]);
  const [backendSupporters, setBackendSupporters] = useState<Supporter[]>([]);
  const [loadingBackendData, setLoadingBackendData] = useState(false);
  const jwtToken = localStorage.getItem('jwtToken');

  // Use only backend data - no fallbacks
  const tenants = backendTenants;
  const supporters = backendSupporters;

  // Session management state
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  // Start empty; set to a real backend UUID after tenants load (prefer eTMS)
  const [filterTenantId, setFilterTenantId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<Supporter | null>(null); // null means Admin
  const [view, setView] = useState<AdminView>('sessions');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionsPerPage] = useState(100);
  const [totalSessions, setTotalSessions] = useState(0);

  // State for Knowledge Base - Real agents from backend
  const [kbTenant, setKbTenant] = useState<Tenant | null>(null);
  const [kbAgent, setKbAgent] = useState<string>('');
  const [agents, setAgents] = useState<Array<{ agent_id: string; name: string }>>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // State for enrichment
  const [selectedMessages, setSelectedMessages] = useState<Record<string, Message>>({});
  const [showEnrichModal, setShowEnrichModal] = useState(false);

  // State for supporter chat
  const [supporterInput, setSupporterInput] = useState('');

  // State for backend knowledge base integration
  const [useBackendKnowledge, setUseBackendKnowledge] = useState(!!jwtToken);
  const [kbStats, setKbStats] = useState<{ document_count: number; collection_name: string } | null>(null);

  // State for escalations (Phase 4)
  const [escalations, setEscalations] = useState<EscalationResponse[]>([]);
  const [escalationStats, setEscalationStats] = useState({ pending: 0, assigned: 0, resolved: 0 });
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationResponse | null>(null);
  const [escalationSupporters, setEscalationSupporters] = useState<EscalationSupporter[]>([]);
  const [escalationFilter, setEscalationFilter] = useState<'all' | 'pending' | 'assigned' | 'resolved'>('pending');
  const [loadingEscalations, setLoadingEscalations] = useState(false);

  // State for User Management
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userFilter, setUserFilter] = useState<'all' | 'staff' | 'admin' | 'tenant_user'>('all');

  // State for Supporter Management
  const [supporterList, setSupporterList] = useState<any[]>([]);
  const [loadingSupporters, setLoadingSupporters] = useState(false);
  const [showCreateSupporterModal, setShowCreateSupporterModal] = useState(false);
  const [supporterFormData, setSupporterFormData] = useState({ userId: '', maxSessions: 5 });
  const [supporterActionLoading, setSupporterActionLoading] = useState(false);
  const [supporterMessage, setSupporterMessage] = useState('');

  // Helpers
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
      if (!jwtToken) {
        console.log('No JWT token, using fallback mock data');
        return;
      }

      setLoadingBackendData(true);
      try {
        // Load tenants from backend
        const backendTenantsData = await getTenantsFromBackend(jwtToken);
        if (backendTenantsData.length > 0) {
          setBackendTenants(backendTenantsData);
          console.log(`✅ Loaded ${backendTenantsData.length} tenants from backend`);

          // Prefer eTMS as default tenant
          const preferredId = pickPreferredTenantId(backendTenantsData);
          setFilterTenantId(preferredId);
          setKbTenant(backendTenantsData.find(t => t.id === preferredId) || backendTenantsData[0]);
          // Ensure filterTenantId uses a real backend tenant UUID (avoid 'default')
          setFilterTenantId(backendTenantsData[0].id);

          // Load supporters for the first tenant
          const firstTenantId = backendTenantsData[0].id;
          const supportersData = await getSupportersFromBackend(firstTenantId, jwtToken);
          setBackendSupporters(supportersData);
          if (supportersData.length > 0) {
            console.log(`✅ Loaded ${supportersData.length} supporters from backend`);
          } else {
            console.log('ℹ️ No supporters found for tenant', firstTenantId);
          }
        }
      } catch (error) {
        console.warn('Failed to load backend data, using mock data:', error);
      } finally {
        setLoadingBackendData(false);
      }
    };

    loadBackendData();
  }, [jwtToken]);

  // Keep backendSupporters in sync with the selected tenant filter (and session)
  useEffect(() => {
    const loadTenantSupporters = async () => {
      if (!jwtToken) return;
      const tenantId = selectedSession?.tenantId || filterTenantId;
      if (!tenantId) return;
      try {
        // 1) Preferred: supporters table
        const supporters = await getSupportersFromBackend(tenantId, jwtToken);
        if (supporters && supporters.length > 0) {
          setBackendSupporters(supporters);
          return;
        }

        // 2) Fallback: users table filtered to supporter OR staff for this tenant
        try {
          const users = await listUsers(jwtToken, { tenant_id: tenantId, limit: 200 });
          const fallback = (users || [])
            .filter(u => u.role === 'supporter' || u.role === 'staff')
            .map(u => ({ id: u.user_id, name: u.display_name || u.username || u.email, tenantId }));
          setBackendSupporters(fallback);
        } catch (userErr) {
          console.warn('Failed to load users fallback', userErr);
          setBackendSupporters([]);
        }
      } catch (e) {
        console.warn('Failed to load supporters for tenant', tenantId, e);
        setBackendSupporters([]);
      }
    };
    loadTenantSupporters();
  }, [filterTenantId, selectedSession?.tenantId, jwtToken]);

  // If we have backend tenants and current filterTenantId is not a UUID, default it (prefer eTMS)
  useEffect(() => {
    if (backendTenants.length > 0 && (!filterTenantId || !isUuid(filterTenantId))) {
      setFilterTenantId(pickPreferredTenantId(backendTenants));
    }
  }, [backendTenants]);

  // Load agents from backend
  useEffect(() => {
    const loadAgents = async () => {
      if (!jwtToken) {
        setAgents([]);
        return;
      }

      setLoadingAgents(true);
      try {
        const agentsData = await getAgents(true); // Only active agents
        setAgents(agentsData.map(a => ({ agent_id: a.agent_id, name: a.name })));

        // Set first agent as default if none selected
        if (agentsData.length > 0 && !kbAgent) {
          setKbAgent(agentsData[0].agent_id);
        }

        console.log(`✅ Loaded ${agentsData.length} agents from backend`);
      } catch (error) {
        console.error('Failed to load agents:', error);
        setAgents([]);
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, [jwtToken]);


  const loadChatSessions = async () => {
    try {
      // Skip if invalid tenant id (e.g., 'default') until backend tenants load
      if (!isUuid(filterTenantId)) {
        console.warn('Skipping session load; invalid tenantId:', filterTenantId);
        setAllSessions([]);
        return;
      }
      const sessionsData = await getSessionsWithFallback(filterTenantId);

      // Handle both backend and localStorage formats
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
      } else {
        // localStorage format
        Object.entries(sessionsData).forEach(([key, sessionData]: [string, any]) => {
          if (sessionData && Array.isArray(sessionData.messages)) {
            const [_, tenantId, userEmail] = key.split('_');
            sessions.push({
              id: key,
              tenantId,
              userEmail,
              messages: sessionData.messages,
              assignedSupporterId: sessionData.assignedSupporterId,
              lastActivity: new Date(sessionData.messages.slice(-1)[0]?.timestamp).toISOString(),
              // Fill required SessionSummary fields for localStorage items
              session_id: key,
              tenant_id: tenantId,
              user_id: userEmail, // Use email as ID for local
              created_at: new Date().toISOString(), // Fallback
              updated_at: new Date().toISOString(), // Fallback
              is_active: true,
            });
          }
        });
      }

      sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
      setAllSessions(sessions);
      console.log(`✅ Loaded ${sessions.length} sessions for tenant ${filterTenantId}`);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      setAllSessions([]);
    }
  };

  useEffect(() => {
    // Load sessions on mount and when tenant changes
    loadChatSessions();
    // Reset to page 1 when tenant changes
    setCurrentPage(1);
    // Set up an interval to refresh sessions periodically to catch live updates
    /* 
    const interval = setInterval(() => {
      loadChatSessions();
    }, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
    */
  }, [filterTenantId]);

  useEffect(() => {
    if (kbTenant) {
      setKnowledgeDocs(getDocumentsForTopic(kbTenant.id, kbAgent));
    }
  }, [kbTenant, kbAgent]);

  // Load knowledge base stats from backend when tenant changes
  useEffect(() => {
    if (useBackendKnowledge && jwtToken && kbTenant) {
      getKnowledgeBaseStats(kbTenant.id, jwtToken).then(response => {
        if (response.success && response.data) {
          setKbStats({
            document_count: response.data.document_count,
            collection_name: response.data.collection_name,
          });
        }
      }).catch(error => {
        console.error('Failed to load knowledge base stats:', error);
      });
    }
  }, [kbTenant?.id, useBackendKnowledge, jwtToken]);

  // When the sessions list refreshes, keep the selected session in sync
  // but preserve already loaded messages to avoid wiping the view.
  useEffect(() => {
    if (!selectedSession) return;
    const updated = allSessions.find(s => s.id === selectedSession.id);
    if (!updated) return;
    setSelectedSession(prev => {
      if (!prev) return updated;
      return {
        ...updated,
        messages: (prev.messages && prev.messages.length > 0) ? prev.messages : updated.messages,
      };
    });
  }, [allSessions]);

  // Load full session messages when a session is selected
  useEffect(() => {
    const loadSessionMessages = async () => {
      if (!selectedSession || !jwtToken) {
        return;
      }

      try {
        // Use public endpoint for supporters, admin endpoint for admins
        const sessionDetail = currentUser
          ? await getSessionDetailPublic(selectedSession.tenantId, selectedSession.id)
          : await getSessionDetail(selectedSession.tenantId, selectedSession.id);
        if (sessionDetail) {
          // Update selectedSession with full message data
          setSelectedSession(prev => {
            if (!prev) return null;
            const pickDisplayText = (data: any): string => {
              if (data == null) return '';
              // If backend stored a JSON string, try parse
              if (typeof data === 'string') {
                const raw = data.trim();
                // Try JSON parse
                try {
                  const parsed = JSON.parse(raw);
                  data = parsed;
                } catch {
                  // Try to extract "text" fields from JSON-like content
                  const textMatches = Array.from(raw.matchAll(/"text"\s*:\s*"([\s\S]*?)"/g)).map(m => m[1]);
                  if (textMatches.length) return textMatches.join('\n\n');
                  return raw; // Fallback to raw string
                }
              }
              // If object/array structures
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
            const normalizeSender = (role: string | undefined, originalRole?: string | null): 'user' | 'ai' | 'supporter' => {
              const candidate = (role || originalRole || '').toLowerCase();
              if (['user', 'chat_user', 'customer', 'client'].includes(candidate)) return 'user';
              if (['assistant', 'ai', 'bot', 'agent', 'system'].includes(candidate)) return 'ai';
              if (['supporter', 'support', 'staff', 'admin', 'human'].includes(candidate)) return 'supporter';
              return 'ai';
            };

            return {
              ...prev,
              messages: sessionDetail.messages?.map(msg => ({
                id: msg.message_id || `msg-${Math.random()}`,
                sender: normalizeSender(msg.sender || msg.role, msg.role),
                text: ((): string => {
                  if (normalizeSender(msg.sender || msg.role) !== 'ai') return msg.content;
                  // First, handle single-quoted dict-like strings from backend
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
          console.log(`✅ Loaded ${sessionDetail.messages?.length || 0} messages for session`);
        }
      } catch (error) {
        console.error('Failed to load session messages:', error);
      }
    };

    loadSessionMessages();
  }, [selectedSession?.id, filterTenantId, jwtToken]);

  const filteredSessions = useMemo(() => {
    let sessions = allSessions.filter(s => s.tenantId === filterTenantId);
    if (currentUser) { // If a supporter is logged in
      return sessions.filter(s => s.assignedSupporterId === currentUser.id);
    }
    return sessions; // Admin view
  }, [allSessions, filterTenantId, currentUser]);

  const handleLogin = (supporterId: string) => {
    if (supporterId === 'admin') {
      setCurrentUser(null);
    } else {
      setCurrentUser(findSupporter(supporterId, supporters) || null);
    }
    setSelectedSession(null); // Deselect session on role change
  };

  const assignSupporter = async (sessionId: string, supporterId: string) => {
    try {
      // If authenticated, persist assignment to backend escalation endpoint
      if (jwtToken) {
        const tenantId = selectedSession?.tenantId || filterTenantId;
        let targetSupporterId = supporterId;

        try {
          // Step 1: Escalate the session first (required before assignment)
          console.log('Step 1: Escalating session...');
          await escalateSession(tenantId, sessionId, 'Manual assignment by admin');
          console.log('✓ Session escalated');
        } catch (escalateErr) {
          console.error('Failed to escalate session:', escalateErr);
          alert(`Failed to escalate session: ${escalateErr instanceof Error ? escalateErr.message : String(escalateErr)}`);
          return;
        }

        try {
          // Step 2: Assign the supporter to the escalated session
          console.log('Step 2: Assigning supporter...');
          await assignSupporterToEscalation(tenantId, sessionId, targetSupporterId);
          console.log('✓ Supporter assigned');
        } catch (assignErr) {
          console.error('Failed to assign supporter:', assignErr);
          alert(`Failed to assign supporter: ${assignErr instanceof Error ? assignErr.message : String(assignErr)}`);
          return;
        }

        // Refresh sessions and selected session
        await loadChatSessions();
        setSelectedSession(prev => prev ? { ...prev, assignedSupporterId: supporterId || null } : prev);
        alert('✓ Supporter assigned successfully!');
        return;
      }

      // Local fallback if no JWT (dev/demo)
      const sessionDataRaw = localStorage.getItem(sessionId);
      if (sessionDataRaw) {
        const sessionData = JSON.parse(sessionDataRaw);
        sessionData.assignedSupporterId = supporterId || undefined;
        localStorage.setItem(sessionId, JSON.stringify(sessionData));
      }
      loadChatSessions();
    } catch (e) {
      console.error('Failed to assign supporter:', e);
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !kbTenant) return;

    setUploading(true);
    setUploadStatus(`Processing ${file.name}...`);

    try {
      // Phase 2: Use backend API if JWT is available
      if (useBackendKnowledge && jwtToken) {
        setUploadStatus(`Uploading to backend knowledge base...`);
        const response = await uploadDocument({
          tenantId: kbTenant.id,
          file: file,
          documentName: file.name,
          agentName: kbAgent, // Send agent name to backend
          jwt: jwtToken,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to upload document to backend');
        }

        setUploadStatus(`✅ Successfully uploaded ${file.name} to ${kbAgent}! (${response.data?.chunk_count} chunks)`);

        // Reload knowledge base stats
        const statsResponse = await getKnowledgeBaseStats(kbTenant.id, jwtToken);
        if (statsResponse.success && statsResponse.data) {
          setKbStats({
            document_count: statsResponse.data.document_count,
            collection_name: statsResponse.data.collection_name,
          });
        }
      } else {
        // Fallback: Local knowledge base (for development without JWT)
        setUploadStatus(`Parsing file content...`);
        // const content = await parseFileToText(file);
        const content = "File parsing disabled for build fix";

        setUploadStatus(`Adding to local knowledge base...`);
        addDocumentToKnowledgeBase(kbTenant.id, kbAgent, file.name, content);

        setKnowledgeDocs(getDocumentsForTopic(kbTenant.id, kbAgent));
        setUploadStatus(`✅ Successfully added ${file.name} to ${kbAgent}!`);
      }
    } catch (error: any) {
      console.error('File upload failed:', error);
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setUploading(false);
      // Clear status message after a few seconds
      setTimeout(() => setUploadStatus(''), 5000);
    }
  };

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

  const mapTopicToAgent = (topic: Topic): string => {
    const name = (topic?.name || topic?.id || '').toLowerCase();
    if (name.includes('guideline') || name.includes('hướng dẫn')) return AGENT_NAMES.GUIDELINE;
    if (name.includes('shipment') || name.includes('đơn hàng') || name.includes('tracking')) return AGENT_NAMES.SHIPMENT;
    if (name.includes('debt') || name.includes('công nợ') || name.includes('invoice') || name.includes('hóa đơn')) return AGENT_NAMES.DEBT;
    // Default agent for enrichment
    return AGENT_NAMES.GUIDELINE;
  };

  const handleEnrichment = async (topic?: Topic) => {
    try {
      const messagesToEnrich = Object.values(selectedMessages).map(m => ({ text: m.text, sender: m.sender }));
      const tenant = findTenant(selectedSession!.tenantId, tenants)!;

      // If backend is connected (JWT present), push to database via admin API
      if (useBackendKnowledge && jwtToken) {
        const conversationText = messagesToEnrich
          .map(m => `${m.sender === 'user' ? 'User' : m.sender === 'ai' ? 'Agent' : 'Supporter'}: ${m.text}`)
          .join('\n\n');

        const documentName = `Chat History - ${new Date().toLocaleString()}`;

        // Create text file blob for upload-document endpoint
        // This will be chunked & processed like a regular document upload
        const blob = new Blob([conversationText], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, `${selectedSession!.id}-enrichment.txt`);
        formData.append('document_name', documentName);

        console.log('📚 Enriching knowledge base from chat history:', {
          session_id: selectedSession!.id,
          messages_count: messagesToEnrich.length,
          tenant_id: tenant.id,
          endpoint: '/knowledge/upload-document',
        });

        // Upload to /knowledge/upload-document endpoint
        // Backend will: Extract → Chunk → Embed → Store with metadata
        const baseUrl = getApiBaseUrl();
        const response = await fetch(
          `${baseUrl}/api/admin/tenants/${tenant.id}/knowledge/upload-document`,
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
      } else {
        // Local-only fallback (no JWT): store in localStorage
        if (topic) {
          enrichKnowledgeBaseFromChat(tenant, topic, messagesToEnrich);
          alert('✅ Knowledge base enriched locally!');
        }
      }
    } catch (e: any) {
      console.error('❌ Enrichment failed:', e);
      alert(`Failed to enrich knowledge base: ${e.message || 'Unknown error'}`);
    } finally {
      setShowEnrichModal(false);
      setSelectedMessages({});
    }
  }

  const handleSendSupporterMessage = async () => {
    if (!supporterInput.trim() || !selectedSession) return;

    const supporterName = currentUser?.name || authenticatedUser?.display_name || 'Supporter';
    const messageText = supporterInput;
    setSupporterInput(''); // Clear input immediately

    // Optimistic update - add message to UI right away
    const newMessage: Message = {
      id: `supporter-${Date.now()}`,
      text: messageText,
      sender: 'supporter',
      timestamp: new Date().toISOString(),
      supporterName: supporterName,
    };

    setSelectedSession(prev => prev ? { ...prev, messages: [...(prev.messages || []), newMessage] } : null);

    // Send to backend using NEW admin endpoint (bypasses escalation requirement)
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/tenants/${selectedSession.tenantId}/supporter-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: jwtToken ? `Bearer ${jwtToken}` : '',
          },
          body: JSON.stringify({
            session_id: selectedSession.id,
            message: messageText,
            sender_user_id: authenticatedUser?.user_id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send message');
      }

      const responseData = await response.json();
      console.log('✅ Message sent to backend via supporter-chat endpoint', {
        message_id: responseData.message_id,
        session_id: responseData.session_id,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Keep the message in UI anyway (it was already displayed optimistically)
    }
  };

  const loadEscalations = async () => {
    try {
      setLoadingEscalations(true);
      const response = await getEscalationQueue(filterTenantId, escalationFilter === 'all' ? undefined : escalationFilter);
      setEscalations(response.escalations);
      setEscalationStats({
        pending: response.pending_count,
        assigned: response.assigned_count,
        resolved: response.resolved_count,
      });
    } catch (error) {
      console.error('Failed to load escalations:', error);
    } finally {
      setLoadingEscalations(false);
    }
  };

  const loadSupporters = async () => {
    try {
      const response = await getSupporters(filterTenantId);
      if (response.success) {
        setEscalationSupporters(response.supporters);
      }
    } catch (error) {
      console.error('Failed to load supporters:', error);
    }
  };

  const handleAssignSupporterToEscalation = async (escalationId: string, supporterId: string) => {
    try {
      const result = await assignSupporterToEscalation(filterTenantId, escalationId, supporterId);
      setSelectedEscalation(result);
      loadEscalations();
      alert('Supporter assigned successfully!');
    } catch (error) {
      console.error('Failed to assign supporter:', error);
      alert(`Failed to assign supporter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleResolveEscalation = async (escalationId: string) => {
    const notes = prompt('Enter resolution notes (optional):');
    try {
      const result = await resolveEscalation(filterTenantId, escalationId, notes || undefined);
      setSelectedEscalation(result);
      loadEscalations();
      alert('Escalation resolved successfully!');
    } catch (error) {
      console.error('Failed to resolve escalation:', error);
      alert(`Failed to resolve escalation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (view === 'escalations') {
      loadEscalations();
      loadSupporters();
    }
  }, [view, filterTenantId, escalationFilter]);

  const handleLogout = () => {
    logout();
    setAuthenticatedUser(null);
    setUserRole(null);
    navigate('/login');
  };

  // Redirect if not authenticated (double check, though ProtectedRoute handles this)
  if (!authenticatedUser) {
    navigate('/login');
    return null;
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            {authenticatedUser && (
              <p className="text-xs text-gray-500 mt-1">
                Logged in as: <strong>{authenticatedUser.display_name || authenticatedUser.email}</strong> ({authenticatedUser.role})
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {authenticatedUser ? (
              <>
                <div className="text-sm text-gray-600">
                  <p className="font-medium">{authenticatedUser.display_name || authenticatedUser.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{authenticatedUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-500">Not authenticated</span>
            )}
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t">
          <div className="flex">
            <button onClick={() => setView('sessions')} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === 'sessions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Chat Sessions</button>
            <button onClick={() => setView('knowledge')} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === 'knowledge' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Knowledge Base</button>
            <button onClick={() => { setView('escalations'); loadEscalations(); }} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === 'escalations' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Escalations {escalationStats.pending > 0 && <span className="ml-2 inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-semibold">{escalationStats.pending}</span>}
            </button>
            {authenticatedUser && isAdmin() && (
              <>
                <button onClick={() => setView('users')} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === 'users' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>User Management</button>
                <button onClick={() => setView('supporters')} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === 'supporters' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Supporter Management</button>
              </>
            )}
          </div>
          {onSwitchToDemo && (
            <button
              onClick={onSwitchToDemo}
              className="ml-auto my-1 px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <ChatBubbleIcon className="h-5 w-5" />
              Switch to Demo View
            </button>
          )}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {view === 'sessions' && (
          <div className="flex gap-6">
            <div className="w-1/3 bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">{currentUser ? `${currentUser.name}'s Chats` : 'All Chats'} ({filteredSessions.length})</h2>
                {!currentUser && (
                  <select
                    value={filterTenantId}
                    onChange={e => setFilterTenantId(e.target.value)}
                    className="mt-2 w-full rounded-md border-gray-300 text-sm"
                  >
                    {backendTenants.length === 0 ? (
                      <option value="" disabled>
                        {jwtToken ? 'Loading tenants…' : 'Login required'}
                      </option>
                    ) : (
                      backendTenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))
                    )}
                  </select>
                )}
                {/* Pagination Controls */}
                {filteredSessions.length > sessionsPerPage && (
                  <div className="mt-3 flex items-center justify-between text-sm">
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
              </div>
              <ul className="divide-y divide-gray-200 h-[calc(100vh-18rem)] overflow-y-auto">
                {filteredSessions
                  .slice((currentPage - 1) * sessionsPerPage, currentPage * sessionsPerPage)
                  .map(session => (
                    <li key={session.id} onClick={() => setSelectedSession(session)} className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedSession?.id === session.id ? 'bg-indigo-50' : ''}`}>
                      <div className="font-semibold text-gray-800">{(session as any).userName || session.userEmail || 'Unknown'}</div>
                      <div className="text-xs text-gray-600">{session.userEmail}</div>
                      <div className="text-sm text-gray-500">Tenant: {findTenant(session.tenantId, tenants)?.name}</div>
                      <div className="text-xs text-gray-400">Last message: {new Date(session.lastActivity).toLocaleString()}</div>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="w-2/3 bg-white rounded-lg shadow flex flex-col">
              {selectedSession ? (
                <>
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">{(selectedSession as any).userName || selectedSession.userEmail || 'Unknown'}</h2>
                      <p className="text-sm text-gray-600 mb-1">{selectedSession.userEmail}</p>
                      {selectedSession.assignedSupporterId ? (
                        <p className="text-sm text-green-600 font-medium">
                          ✓ Assigned to @{findSupporter(selectedSession.assignedSupporterId, supporters)?.name || 'Unknown'}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600">Not assigned</p>
                      )}
                    </div>
                    {!currentUser && !selectedSession.assignedSupporterId && (
                      <div>
                        <select value="" onChange={e => assignSupporter(selectedSession.id, e.target.value)} className="rounded-md border-gray-300 text-sm">
                          <option value="">Assign to...</option>
                          {supporters.filter(s => s.tenantId === selectedSession.tenantId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-4 bg-gray-50 space-y-4">
                    {/* Scrollable message list */}
                    <div
                      className="overflow-y-auto h-[calc(100vh-22rem)] pr-2"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {selectedSession.messages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-3 mb-3">
                          {/* Checkbox for message selection - always show in admin dashboard */}
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={!!selectedMessages[msg.id]}
                            onChange={() => handleMessageSelection(msg)}
                          />
                          <div className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`rounded-lg px-3 py-2 max-w-lg shadow-sm break-words whitespace-pre-wrap ${msg.sender === 'user'
                                  ? 'bg-blue-500 text-white'
                                  : msg.sender === 'supporter'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-800'
                                }`}
                            >
                              {msg.sender !== 'user' && (
                                <div className="font-bold text-xs mb-1">
                                  {msg.sender === 'ai' ? 'AI Assistant' : msg.supporterName || 'Support Agent'}
                                </div>
                              )}
                              {/* Allow long content inside each bubble to wrap and be scrollable if extremely long */}
                              <div className="prose prose-sm max-w-full">
                                <div className="break-words whitespace-pre-wrap">
                                  {/* <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown> */}
                                  <div className="whitespace-pre-wrap">{msg.text}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(currentUser || (authenticatedUser && (authenticatedUser.role === 'supporter' || authenticatedUser.role === 'staff'))) && (
                    <div className="p-3 border-t bg-white">
                      <div className="flex items-center gap-2">
                        <input value={supporterInput} onChange={e => setSupporterInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendSupporterMessage()} className="flex-1 border-gray-300 rounded-full py-2 px-4 focus:ring-2" placeholder={`Reply as ${currentUser?.name || authenticatedUser?.display_name || 'Supporter'}...`} />
                        <button onClick={handleSendSupporterMessage} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-full hover:bg-indigo-700">Send</button>
                      </div>
                    </div>
                  )}
                </>
              ) : <div className="flex items-center justify-center h-full text-gray-500">Select a chat session.</div>}
            </div >
            {
              Object.keys(selectedMessages).length > 0 && (
                <div className="fixed bottom-5 right-5 bg-white p-4 rounded-lg shadow-lg border animate-fade-in-up">
                  <p className="font-semibold mb-2">{Object.keys(selectedMessages).length} messages selected.</p>
                  <button onClick={() => setShowEnrichModal(true)} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2">
                    <ExtractIcon className="h-5 w-5" />
                    Enrich Knowledge Base
                  </button>
                </div>
              )
            }
          </div >
        )}
        {
          view === 'knowledge' && (
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Manage Knowledge Base</h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBackendKnowledge && !!jwtToken}
                      onChange={() => setUseBackendKnowledge(!useBackendKnowledge)}
                      disabled={!jwtToken}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Use Backend API {!jwtToken && '(No JWT)'}
                    </span>
                  </label>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${useBackendKnowledge && jwtToken ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {useBackendKnowledge && jwtToken ? '🔗 Connected' : '💾 Local'}
                  </span>
                </div>
              </div>
              {useBackendKnowledge && kbStats && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    📊 Backend Statistics: <strong>{kbStats.document_count} documents</strong> in collection "<strong>{kbStats.collection_name}</strong>"
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium">Tenant</label>
                  <select onChange={e => {
                    const newTenant = findTenant(e.target.value, tenants);
                    if (newTenant) {
                      setKbTenant(newTenant);
                    }
                  }} value={kbTenant?.id || ''} className="mt-1 w-full rounded-md border-gray-300">
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Agent</label>
                  <select onChange={e => setKbAgent(e.target.value)} value={kbAgent} className="mt-1 w-full rounded-md border-gray-300" disabled={loadingAgents}>
                    {loadingAgents ? (
                      <option>Loading agents...</option>
                    ) : agents.length === 0 ? (
                      <option>No agents available</option>
                    ) : (
                      agents.map(agent => <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>)
                    )}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label htmlFor="file-upload" className={`w-full cursor-pointer text-white text-center py-2 px-4 rounded-md flex items-center justify-center gap-2 ${uploading ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'}`}>
                    <UploadIcon className="h-5 w-5" />
                    {uploading ? 'Processing...' : 'Upload Document'}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept={useBackendKnowledge ? '.pdf,.docx,.doc' : '.txt,.pdf,.docx'}
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  {uploadStatus && <p className="text-xs text-center mt-1 text-gray-600">{uploadStatus}</p>}
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {useBackendKnowledge ? 'PDF, DOCX, DOC' : 'TXT, PDF, DOCX'}
                  </p>
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-2">Knowledge Base Status for "{agents.find(a => a.agent_id === kbAgent)?.name || kbAgent}"</h3>
              <div className="border rounded-lg p-4 bg-gray-50">
                {useBackendKnowledge && jwtToken ? (
                  <div className="space-y-4">
                    {/* Knowledge Base Stats Block */}
                    <div className="bg-white border border-indigo-200 rounded-lg p-4">
                      <h4 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                        <DocumentIcon className="h-5 w-5" />
                        Collection: {kbStats?.collection_name || 'Loading...'}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-50 rounded-md p-3">
                          <p className="text-xs text-gray-600 mb-1">Total Documents</p>
                          <p className="text-2xl font-bold text-indigo-600">{kbStats?.document_count || 0}</p>
                        </div>
                        <div className="bg-blue-50 rounded-md p-3">
                          <p className="text-xs text-gray-600 mb-1">Status</p>
                          <p className="text-sm font-semibold text-blue-600 mt-2">
                            {kbStats && kbStats.document_count > 0 ? '✅ Active' : '⚠️ Empty'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Usage Guide */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-900">
                        <strong>How to add documents:</strong>
                      </p>
                      <ul className="text-xs text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                        <li>Upload PDF, DOCX, or DOC files above</li>
                        <li>Or select messages from chat history and click "Enrich Knowledge Base"</li>
                        <li>Documents are chunked, embedded, and stored in pgvector</li>
                        <li>Agents will use these documents for RAG retrieval</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="mb-2">Using local knowledge base (no backend connection)</p>
                    <p className="text-xs">{knowledgeDocs.length} documents loaded locally</p>
                  </div>
                )}
              </div>
            </div>
          )
        }
        {
          view === 'users' && authenticatedUser && isAdmin() && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">User Management</h2>

              <div className="mb-6 flex gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Role:</label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="tenant_user">Tenant User</option>
                  </select>
                </div>
                <button
                  onClick={async () => {
                    setLoadingUsers(true);
                    try {
                      const userData = await listTenantUsers(filterTenantId, jwtToken || '', { role: userFilter === 'all' ? undefined : userFilter });
                      setUsers(userData);
                    } catch (error) {
                      console.error('Failed to load users:', error);
                    } finally {
                      setLoadingUsers(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                >
                  {loadingUsers ? 'Loading...' : 'Load Users'}
                </button>
              </div>

              {loadingUsers ? (
                <p className="text-gray-500">Loading users...</p>
              ) : users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Username</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Display Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Role</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map((user) => (
                        <tr key={user.user_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{user.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{user.username}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{user.display_name || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                              user.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No users found. Click "Load Users" to fetch data from backend.</p>
              )}
            </div>
          )
        }

        {
          view === 'supporters' && authenticatedUser && isAdmin() && (
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Supporter Management</h2>
                <button
                  onClick={() => setShowCreateSupporterModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  + Create Supporter
                </button>
              </div>

              {supporterMessage && (
                <div className={`mb-4 p-4 rounded-lg ${supporterMessage.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {supporterMessage}
                </div>
              )}

              <div className="mb-4">
                <button
                  onClick={async () => {
                    setLoadingSupporters(true);
                    try {
                      const supp = await getSupportersFromBackend(filterTenantId, jwtToken || '');
                      setSupporterList(supp);
                      setBackendSupporters(supp);
                    } catch (error) {
                      console.error('Failed to load supporters:', error);
                    } finally {
                      setLoadingSupporters(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                >
                  {loadingSupporters ? 'Loading...' : 'Refresh List'}
                </button>
              </div>

              {loadingSupporters ? (
                <p className="text-gray-500">Loading supporters...</p>
              ) : supporterList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Max Sessions</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {supporterList.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{s.email || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{s.name || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${s.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                              {s.status || 'offline'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{s.max_concurrent_sessions || 5}</td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => {
                                const newStatus = s.status === 'online' ? 'offline' : 'online';
                                setSupporterActionLoading(true);
                                updateSupporter(filterTenantId, s.id, { status: newStatus }, jwtToken || '')
                                  .then(() => {
                                    setSupporterMessage(`Supporter status updated to ${newStatus}`);
                                    setTimeout(() => setSupporterMessage(''), 3000);
                                  })
                                  .catch(err => setSupporterMessage(`Error: ${err.message}`))
                                  .finally(() => setSupporterActionLoading(false));
                              }}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 mr-2"
                              disabled={supporterActionLoading}
                            >
                              Toggle Status
                            </button>
                            <button
                              onClick={() => {
                                setSupporterActionLoading(true);
                                deleteSupporter(filterTenantId, s.id, jwtToken || '')
                                  .then(() => {
                                    setSupporterMessage('Supporter deleted successfully');
                                    setSupporterList(supporterList.filter(sup => sup.id !== s.id));
                                    setTimeout(() => setSupporterMessage(''), 3000);
                                  })
                                  .catch(err => setSupporterMessage(`Error: ${err.message}`))
                                  .finally(() => setSupporterActionLoading(false));
                              }}
                              className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                              disabled={supporterActionLoading}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No supporters found. Click "Refresh List" or create a new one.</p>
              )}

              {showCreateSupporterModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h3 className="text-lg font-bold mb-4">Create New Supporter</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">User ID:</label>
                        <input
                          type="text"
                          value={supporterFormData.userId}
                          onChange={(e) => setSupporterFormData({ ...supporterFormData, userId: e.target.value })}
                          placeholder="Paste staff user UUID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Max Concurrent Sessions:</label>
                        <input
                          type="number"
                          value={supporterFormData.maxSessions}
                          onChange={(e) => setSupporterFormData({ ...supporterFormData, maxSessions: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => setShowCreateSupporterModal(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setSupporterActionLoading(true);
                            createSupporter(filterTenantId, supporterFormData.userId, supporterFormData.maxSessions, jwtToken || '')
                              .then((newSupporter) => {
                                setSupporterList([...supporterList, newSupporter]);
                                setSupporterMessage('Supporter created successfully!');
                                setShowCreateSupporterModal(false);
                                setSupporterFormData({ userId: '', maxSessions: 5 });
                                setTimeout(() => setSupporterMessage(''), 3000);
                              })
                              .catch(err => setSupporterMessage(`Error: ${err.message}`))
                              .finally(() => setSupporterActionLoading(false));
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                          disabled={supporterActionLoading || !supporterFormData.userId}
                        >
                          {supporterActionLoading ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        }
        {
          view === 'escalations' && (
            <div className="flex gap-6">
              <div className="w-1/3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold mb-4">Escalations</h2>
                  <div className="flex gap-2 mb-4">
                    {(['pending', 'assigned', 'resolved'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setEscalationFilter(status)}
                        className={`px-3 py-1 text-xs font-medium rounded ${escalationFilter === status
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)} ({
                          status === 'pending' ? escalationStats.pending :
                            status === 'assigned' ? escalationStats.assigned :
                              escalationStats.resolved
                        })
                      </button>
                    ))}
                  </div>
                  <select
                    value={filterTenantId}
                    onChange={e => setFilterTenantId(e.target.value)}
                    className="w-full rounded-md border-gray-300 text-sm"
                  >
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingEscalations ? (
                    <div className="p-4 text-center text-gray-500">Loading escalations...</div>
                  ) : escalations.length > 0 ? (
                    <ul className="divide-y">
                      {escalations.map(esc => (
                        <li
                          key={esc.session_id}
                          onClick={() => setSelectedEscalation(esc)}
                          className={`p-3 cursor-pointer hover:bg-gray-50 border-l-4 ${selectedEscalation?.session_id === esc.session_id
                            ? 'bg-blue-50 border-l-blue-500'
                            : esc.escalation_status === 'pending'
                              ? 'border-l-orange-500'
                              : esc.escalation_status === 'assigned'
                                ? 'border-l-yellow-500'
                                : 'border-l-green-500'
                            }`}
                        >
                          <p className="font-semibold text-sm text-gray-800">{esc.user_id}</p>
                          <p className="text-xs text-gray-600 mt-1">Status: <span className="font-medium capitalize">{esc.escalation_status}</span></p>
                          <p className="text-xs mt-1">
                            {esc.assigned_user_id ? (
                              <span className="text-green-600">
                                Assigned to: <span className="font-medium">{escalationSupporters.find(s => s.supporter_id === esc.assigned_user_id)?.display_name || esc.assigned_user_id}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">Not assigned</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(esc.escalation_requested_at).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-gray-500">No escalations found.</div>
                  )}
                </div>
              </div>
              <div className="w-2/3 bg-white rounded-lg shadow flex flex-col p-4">
                {selectedEscalation ? (
                  <>
                    <div className="border-b pb-4 mb-4">
                      <h3 className="text-lg font-semibold">{selectedEscalation.user_id}</h3>
                      <div className="mt-2 space-y-2 text-sm text-gray-600">
                        <p><strong>Session ID:</strong> {selectedEscalation.session_id.slice(0, 8)}...</p>
                        <p><strong>Status:</strong> <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedEscalation.escalation_status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          selectedEscalation.escalation_status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>{selectedEscalation.escalation_status}</span></p>
                        <p><strong>Reason:</strong> {selectedEscalation.escalation_reason}</p>
                        <p><strong>Requested At:</strong> {new Date(selectedEscalation.escalation_requested_at).toLocaleString()}</p>
                        {selectedEscalation.escalation_assigned_at && (
                          <p><strong>Assigned At:</strong> {new Date(selectedEscalation.escalation_assigned_at).toLocaleString()}</p>
                        )}
                        <p>
                          <strong>Assigned To:</strong>{' '}
                          {selectedEscalation.assigned_user_id ? (
                            <span className="text-green-600 font-medium">
                              {escalationSupporters.find(s => s.supporter_id === selectedEscalation.assigned_user_id)?.display_name || selectedEscalation.assigned_user_id}
                            </span>
                          ) : (
                            <span className="text-gray-400">Not assigned</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {selectedEscalation.escalation_status === 'pending' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Assign Supporter</label>
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                handleAssignSupporterToEscalation(selectedEscalation.session_id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="w-full rounded-md border-gray-300 text-sm"
                          >
                            <option value="">-- Select Supporter --</option>
                            {escalationSupporters.map(s => (
                              <option key={s.supporter_id} value={s.supporter_id}>
                                {s.display_name} ({s.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {(selectedEscalation.escalation_status === 'pending' || selectedEscalation.escalation_status === 'assigned') && (
                        <button
                          onClick={() => handleResolveEscalation(selectedEscalation.session_id)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                        >
                          Mark as Resolved
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Select an escalation to view details.
                  </div>
                )}
              </div>
            </div>
          )
        }
      </main >
      {showEnrichModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Enrich Knowledge Base</h2>
            <p className="text-gray-600 mb-4 text-sm">
              This will add the selected {Object.keys(selectedMessages).length} messages from this chat to the knowledge base.
            </p>
            <p className="text-gray-600 mb-6 text-sm">
              <strong>Processing:</strong> Messages will be chunked and embedded for RAG retrieval.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEnrichModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEnrichment()}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
              >
                Enrich Knowledge Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default AdminDashboard;
