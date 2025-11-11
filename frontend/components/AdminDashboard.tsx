import React, { useState, useEffect, useMemo } from 'react';
import { ChatSession, Message, Supporter, Tenant, Topic } from '../types';
import { SUPPORTERS, TENANTS } from '../constants';
import { KnowledgeDocument, getDocumentsForTopic, addDocumentToKnowledgeBase, enrichKnowledgeBaseFromChat } from '../services/embeddingService';
import { parseFileToText } from '../services/fileParserService';
import { uploadDocument, getKnowledgeBaseStats } from '../services/knowledgeService';
import { getCurrentUser, logout, isAdmin, isStaff, type LoginResponse } from '../services/authService';
import { getEscalationQueue, assignSupporter as assignSupporterToEscalation, resolveEscalation, getSupporters, type EscalationResponse, type Supporter as EscalationSupporter } from '../services/escalationService';
import { getSessionsWithFallback, type SessionSummary } from '../services/sessionService';
import { getTenants as getTenantsFromBackend, getSupporters as getSupportersFromBackend, listUsers, listTenantUsers, createSupporter, updateSupporter, deleteSupporter } from '../services/adminService';
import { ChatBubbleIcon, DocumentIcon, ExtractIcon, KnowledgeBaseIcon, UploadIcon, XCircleIcon } from './icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type AdminView = 'sessions' | 'knowledge' | 'users' | 'supporters' | 'escalations';

// Helper functions with fallback to constants
const findSupporter = (id: string | null, supportersList: Supporter[]) =>
  id ? supportersList.find(s => s.id === id) : null;

const findTenant = (id: string, tenantsList: Tenant[]) =>
  tenantsList.find(t => t.id === id);

interface AdminDashboardProps {
  onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  // Authentication state
  const [authenticatedUser, setAuthenticatedUser] = useState<LoginResponse | null>(getCurrentUser());
  const [userRole, setUserRole] = useState<string | null>(authenticatedUser?.role || null);

  // Backend data state
  const [backendTenants, setBackendTenants] = useState<Tenant[]>([]);
  const [backendSupporters, setBackendSupporters] = useState<Supporter[]>([]);
  const [loadingBackendData, setLoadingBackendData] = useState(false);
  const jwtToken = localStorage.getItem('jwtToken');

  // Use backend tenants if available, otherwise fallback to constants
  const tenants = backendTenants.length > 0 ? backendTenants : TENANTS;
  const supporters = backendSupporters.length > 0 ? backendSupporters : SUPPORTERS;

  // Session management state
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [filterTenantId, setFilterTenantId] = useState<string>(tenants[0]?.id || TENANTS[0].id);
  const [currentUser, setCurrentUser] = useState<Supporter | null>(null); // null means Admin
  const [view, setView] = useState<AdminView>('sessions');

  // State for Knowledge Base
  const [kbTenant, setKbTenant] = useState<Tenant>(tenants[0] || TENANTS[0]);
  const [kbTopic, setKbTopic] = useState<Topic>((tenants[0] || TENANTS[0]).topics[0]);
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

          // Load supporters for the first tenant
          const firstTenantId = backendTenantsData[0].id;
          const supportersData = await getSupportersFromBackend(firstTenantId, jwtToken);
          if (supportersData.length > 0) {
            setBackendSupporters(supportersData);
            console.log(`✅ Loaded ${supportersData.length} supporters from backend`);
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

  const loadChatSessions = async () => {
    try {
      const sessionsData = await getSessionsWithFallback(filterTenantId);

      // Handle both backend and localStorage formats
      let sessions: ChatSession[] = [];

      if (Array.isArray(sessionsData)) {
        // Backend format (SessionSummary[])
        sessions = sessionsData.map((summary: SessionSummary) => ({
          id: summary.session_id,
          tenantId: filterTenantId,
          userEmail: summary.user_id,
          messages: [], // Messages loaded on demand
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
    // Set up an interval to refresh sessions periodically to catch live updates
    const interval = setInterval(() => {
      loadChatSessions();
    }, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [filterTenantId]);

  useEffect(() => {
    setKnowledgeDocs(getDocumentsForTopic(kbTenant.id, kbTopic.id));
  }, [kbTenant, kbTopic]);

  // Load knowledge base stats from backend when tenant changes
  useEffect(() => {
    if (useBackendKnowledge && jwtToken) {
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
  }, [kbTenant.id, useBackendKnowledge, jwtToken]);
  
  // When selected session changes, update its content from the main list
  useEffect(() => {
      if (selectedSession) {
          const updatedSession = allSessions.find(s => s.id === selectedSession.id);
          if (updatedSession) {
              setSelectedSession(updatedSession);
          }
      }
  }, [allSessions, selectedSession]);

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
  
  const assignSupporter = (sessionId: string, supporterId: string) => {
    const sessionData = JSON.parse(localStorage.getItem(sessionId)!);
    sessionData.assignedSupporterId = supporterId || undefined;
    localStorage.setItem(sessionId, JSON.stringify(sessionData));
    loadChatSessions();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
          jwt: jwtToken,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to upload document to backend');
        }

        setUploadStatus(`✅ Successfully uploaded ${file.name}! (${response.data?.chunk_count} chunks)`);

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
        const content = await parseFileToText(file);

        setUploadStatus(`Adding to local knowledge base...`);
        addDocumentToKnowledgeBase(kbTenant.id, kbTopic.id, file.name, content);

        setKnowledgeDocs(getDocumentsForTopic(kbTenant.id, kbTopic.id));
        setUploadStatus(`✅ Successfully added ${file.name} to local knowledge base!`);
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

  const handleEnrichment = (topic: Topic) => {
    const messagesToEnrich = Object.values(selectedMessages).map(m => ({ text: m.text, sender: m.sender }));
    enrichKnowledgeBaseFromChat(findTenant(selectedSession!.tenantId, tenants)!, topic, messagesToEnrich);
    alert(`Knowledge base for topic "${topic.name}" has been enriched!`);
    setShowEnrichModal(false);
    setSelectedMessages({});
  }
  
  const handleSendSupporterMessage = () => {
    if (!supporterInput.trim() || !selectedSession || !currentUser) return;

    const newMessage: Message = {
        id: `supporter-${Date.now()}`,
        text: supporterInput,
        sender: 'supporter',
        timestamp: new Date().toISOString(),
        supporterName: currentUser.name,
    };

    const sessionData = JSON.parse(localStorage.getItem(selectedSession.id)!);
    sessionData.messages.push(newMessage);
    localStorage.setItem(selectedSession.id, JSON.stringify(sessionData));

    setSupporterInput('');
    loadChatSessions(); // Reload to reflect the change
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
    if (onLogout) {
      onLogout();
    }
  };

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
        </nav>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {view === 'sessions' && (
          <div className="flex gap-6">
            <div className="w-1/3 bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">{currentUser ? `${currentUser.name}'s Chats` : 'All Chats'} ({filteredSessions.length})</h2>
                    {!currentUser && (
                         <select value={filterTenantId} onChange={e => setFilterTenantId(e.target.value)} className="mt-2 w-full rounded-md border-gray-300 text-sm">
                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    )}
                </div>
                <ul className="divide-y divide-gray-200 h-[calc(100vh-18rem)] overflow-y-auto">
                {filteredSessions.map(session => (
                    <li key={session.id} onClick={() => setSelectedSession(session)} className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedSession?.id === session.id ? 'bg-indigo-50' : ''}`}>
                    <div className="font-semibold text-gray-800">{session.userEmail}</div>
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
                        <h2 className="text-lg font-semibold">{selectedSession.userEmail}</h2>
                        <p className="text-sm text-gray-600">Assigned to: {findSupporter(selectedSession.assignedSupporterId, supporters)?.name || 'Unassigned'}</p>
                    </div>
                    {!currentUser && (
                    <div>
                        <select value={selectedSession.assignedSupporterId || ''} onChange={e => assignSupporter(selectedSession.id, e.target.value)} className="rounded-md border-gray-300 text-sm">
                            <option value="">Assign to...</option>
                            {supporters.filter(s => s.tenantId === selectedSession.tenantId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    )}
                </div>
                <div className="flex-1 p-4 overflow-y-auto h-[calc(100vh-22rem)] bg-gray-50 space-y-4">
                  {selectedSession.messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3">
                        {!currentUser && <input type="checkbox" className="mt-1" checked={!!selectedMessages[msg.id]} onChange={() => handleMessageSelection(msg)} />}
                        <div className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`rounded-lg px-3 py-2 max-w-lg shadow-sm ${
                                msg.sender === 'user' ? 'bg-blue-500 text-white' : msg.sender === 'supporter' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                {msg.sender !== 'user' && <div className="font-bold text-xs mb-1">{msg.sender === 'ai' ? 'AI Assistant' : msg.supporterName || 'Support Agent'}</div>}
                                <div className="prose prose-sm"><Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown></div>
                            </div>
                        </div>
                    </div>
                  ))}
                </div>
                {currentUser && (
                    <div className="p-3 border-t bg-white">
                        <div className="flex items-center gap-2">
                        <input value={supporterInput} onChange={e => setSupporterInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendSupporterMessage()} className="flex-1 border-gray-300 rounded-full py-2 px-4 focus:ring-2" placeholder={`Reply as ${currentUser.name}...`} />
                        <button onClick={handleSendSupporterMessage} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-full hover:bg-indigo-700">Send</button>
                        </div>
                    </div>
                )}
                </>
              ) : <div className="flex items-center justify-center h-full text-gray-500">Select a chat session.</div>}
            </div>
            {Object.keys(selectedMessages).length > 0 && (
                <div className="fixed bottom-5 right-5 bg-white p-4 rounded-lg shadow-lg border animate-fade-in-up">
                    <p className="font-semibold mb-2">{Object.keys(selectedMessages).length} messages selected.</p>
                    <button onClick={() => setShowEnrichModal(true)} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2">
                        <ExtractIcon className="h-5 w-5" />
                        Enrich Knowledge Base
                    </button>
                </div>
            )}
          </div>
        )}
        {view === 'knowledge' && (
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
                            const newTenant = findTenant(e.target.value, tenants)!;
                            setKbTenant(newTenant);
                            setKbTopic(newTenant.topics[0]);
                        }} value={kbTenant.id} className="mt-1 w-full rounded-md border-gray-300">
                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Topic</label>
                        <select onChange={e => setKbTopic(kbTenant.topics.find(t => t.id === e.target.value)!)} value={kbTopic.id} className="mt-1 w-full rounded-md border-gray-300">
                            {kbTenant.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                 <h3 className="font-semibold text-lg mb-2">Documents for "{kbTopic.name}"</h3>
                 <div className="border rounded-lg p-4 h-96 overflow-y-auto bg-gray-50 space-y-3">
                    {knowledgeDocs.length > 0 ? knowledgeDocs.map(doc => (
                        <div key={doc.id} className="p-3 bg-white border rounded-md">
                            <p className="font-semibold text-gray-700 flex items-center gap-2"><DocumentIcon className="h-5 w-5"/>{doc.fileName}</p>
                            <p className="text-xs text-gray-500 mt-1">Uploaded: {new Date(doc.uploadedAt).toLocaleString()}</p>
                            <pre className="mt-2 text-sm bg-gray-100 p-2 rounded whitespace-pre-wrap font-mono">{doc.content.substring(0, 200)}...</pre>
                        </div>
                    )) : <p className="text-gray-500">No documents uploaded for this topic yet.</p>}
                 </div>
            </div>
        )}
        {view === 'users' && authenticatedUser && isAdmin() && (
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
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                user.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
        )}

        {view === 'supporters' && authenticatedUser && isAdmin() && (
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
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                s.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
                            onChange={(e) => setSupporterFormData({...supporterFormData, userId: e.target.value})}
                            placeholder="Paste staff user UUID"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Max Concurrent Sessions:</label>
                          <input
                            type="number"
                            value={supporterFormData.maxSessions}
                            onChange={(e) => setSupporterFormData({...supporterFormData, maxSessions: parseInt(e.target.value)})}
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
        )}
        {view === 'escalations' && (
          <div className="flex gap-6">
            <div className="w-1/3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold mb-4">Escalations</h2>
                <div className="flex gap-2 mb-4">
                  {(['pending', 'assigned', 'resolved'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setEscalationFilter(status)}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        escalationFilter === status
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
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-l-4 ${
                          selectedEscalation?.session_id === esc.session_id
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
                      <p><strong>Status:</strong> <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedEscalation.escalation_status === 'pending' ? 'bg-orange-100 text-orange-800' :
                        selectedEscalation.escalation_status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>{selectedEscalation.escalation_status}</span></p>
                      <p><strong>Reason:</strong> {selectedEscalation.escalation_reason}</p>
                      <p><strong>Requested At:</strong> {new Date(selectedEscalation.escalation_requested_at).toLocaleString()}</p>
                      {selectedEscalation.escalation_assigned_at && (
                        <p><strong>Assigned At:</strong> {new Date(selectedEscalation.escalation_assigned_at).toLocaleString()}</p>
                      )}
                      {selectedEscalation.assigned_supporter_id && (
                        <p><strong>Assigned To:</strong> {escalationSupporters.find(s => s.supporter_id === selectedEscalation.assigned_supporter_id)?.display_name || 'Unknown'}</p>
                      )}
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
        )}
      </main>
      {showEnrichModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">Select Topic for Enrichment</h2>
                <div className="space-y-2">
                    {findTenant(selectedSession.tenantId, tenants)?.topics.map(topic => (
                        <button key={topic.id} onClick={() => handleEnrichment(topic)} className="w-full text-left p-3 border rounded-md hover:bg-gray-100">{topic.name}</button>
                    ))}
                </div>
                <button onClick={() => setShowEnrichModal(false)} className="mt-4 w-full text-center p-2 bg-gray-200 rounded-md">Cancel</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;