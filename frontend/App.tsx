import React, { useState, useEffect } from 'react';
import { Tenant, UserInfo } from './types';
import { TENANTS } from './constants';
import { getTenants, getTenantApiBaseUrl, type TenantResponse } from './services/tenantService';
import UserInfoForm from './components/UserInfoForm';
import ChatWidget from './components/ChatWidget';
import AdminDashboard from './components/AdminDashboard';
import { ChatBubbleIcon, DashboardIcon } from './components/icons';

type View = 'demo' | 'admin';

const App: React.FC = () => {
  const [availableTenants, setAvailableTenants] = useState<TenantResponse[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantResponse | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [initialTopicId, setInitialTopicId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [view, setView] = useState<View>('demo');

  // Load tenants from backend on mount
  useEffect(() => {
    const loadTenantsFromBackend = async () => {
      try {
        setTenantsLoading(true);
        setTenantsError(null);
        const tenants = await getTenants();

        if (tenants.length === 0) {
          setTenantsError('No tenants found in database. Please create at least one tenant.');
          setTenantsLoading(false);
          return;
        }

        setAvailableTenants(tenants);
        setSelectedTenant(tenants[0]);
        console.log(`✅ Loaded ${tenants.length} tenant(s) from backend`);
      } catch (error) {
        console.error('Failed to load tenants:', error);
        setTenantsError(`Failed to load tenants: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setTenantsLoading(false);
      }
    };

    loadTenantsFromBackend();
  }, []);
  
  const getSessionKey = () => selectedTenant ? `activeUser_${selectedTenant.tenant_id}` : null;

  useEffect(() => {
    // Load active user session when tenant changes or app loads
    if (!selectedTenant) return;

    try {
        const key = getSessionKey();
        if (key) {
          const savedUser = sessionStorage.getItem(key);
          if (savedUser) {
              const parsed = JSON.parse(savedUser);
              setUserInfo({
                username: parsed.username,
                email: parsed.email,
                department: parsed.department,
              });
              setUserId(parsed.user_id);
              setSessionId(parsed.session_id);
              // Default to first topic from constants (since database doesn't store topics)
              setInitialTopicId(TENANTS[0].topics[0].id);
              console.log('✅ Restored user from cache:', parsed.email);
          } else {
              setUserInfo(null);
              setUserId(null);
              setSessionId(null);
              setInitialTopicId(null);
          }
        }
    } catch (error) {
        console.error("Failed to parse user session from sessionStorage", error);
        setUserInfo(null);
        setUserId(null);
        setSessionId(null);
    }
    setIsChatOpen(false); // Always start with chat closed on tenant switch
  }, [selectedTenant, view]);

  const handleFormComplete = (info: UserInfo, topicId: string, newUserId: string, newSessionId: string) => {
    setUserInfo(info);
    setInitialTopicId(topicId);
    setUserId(newUserId);
    setSessionId(newSessionId);
    try {
        const key = getSessionKey();
        if (key) {
          sessionStorage.setItem(key, JSON.stringify({
            ...info,
            user_id: newUserId,
            session_id: newSessionId,
          }));
        }
    } catch (error) {
        console.error("Failed to save user session to sessionStorage", error);
    }
  };

  const handleEndSession = async () => {
      if (userInfo && selectedTenant && sessionId && userId) {
          // Call API to end current session
          try {
              const { endSession, createSession } = await import('./services/chatUserService');
              await endSession(selectedTenant.tenant_id, sessionId);
              console.log('✅ Session ended');

              // Create a NEW session for the same user
              try {
                  const sessionResponse = await createSession(selectedTenant.tenant_id, userId);
                  if (sessionResponse.success && sessionResponse.data) {
                      const newSessionId = sessionResponse.data.session_id;
                      setSessionId(newSessionId);
                      console.log('✅ New session created:', newSessionId);

                      // Update cache with new session
                      const key = getSessionKey();
                      if (key) {
                          sessionStorage.setItem(key, JSON.stringify({
                              ...userInfo,
                              user_id: userId,
                              session_id: newSessionId,
                          }));
                      }
                  }
              } catch (error) {
                  console.error('Failed to create new session:', error);
              }

              // Clear chat history from localStorage
              localStorage.removeItem(`chatHistory_${selectedTenant.tenant_id}_${userInfo.email}`);
          } catch (error) {
              console.error('Failed to end session on backend:', error);
          }
      }
      // Keep chat open so user can see new session is ready
      setIsChatOpen(true);
  };

  const getPrimaryColor = () => {
    // Use default color from constants for now
    return TENANTS[0].theme.primaryColor || 'blue-600';
  };

  if (view === 'admin') {
    return (
        <div>
            <AdminDashboard onSwitchToDemo={() => setView('demo')} />
        </div>
    );
  }

  // Show loading state
  if (tenantsLoading) {
    return (
      <div className="font-sans">
        <div className="max-w-4xl mx-auto p-8 flex flex-col items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Chatbot Demo Environment</h1>
            <div className="flex items-center justify-center gap-2 mt-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="text-lg text-gray-600">Loading tenants from database...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (tenantsError || !selectedTenant) {
    return (
      <div className="font-sans">
        <div className="max-w-4xl mx-auto p-8 flex flex-col items-center justify-center min-h-screen">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error Loading Tenants</h1>
            <p className="text-red-700 mb-4">
              {tenantsError || 'No tenants available. Please check your backend connection.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <p className="text-xs text-red-600 mt-4">
              🔧 Backend: {getTenantApiBaseUrl()} <br />
              Ensure backend is running with database tenants.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans">
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Chatbot Demo Environment</h1>
        <p className="text-gray-600 mb-6">
          This page simulates a website where a multi-tenant RAG chatbot can be embedded.
          Select a tenant from the dropdown below. Click the chat bubble to start, or switch to the admin view.
        </p>

        <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center gap-4">
          <div className="flex-1">
            <label htmlFor="tenant-switcher" className="block text-sm font-medium text-gray-700 mb-2">
              Select Tenant (from database):
            </label>
            <select
              id="tenant-switcher"
              value={selectedTenant.tenant_id}
              onChange={(e) => {
                const tenant = availableTenants.find(t => t.tenant_id === e.target.value);
                if (tenant) setSelectedTenant(tenant);
              }}
              className="w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {availableTenants.map(tenant => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                  {tenant.name} ({tenant.domain})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Loaded {availableTenants.length} tenant(s) from backend ✅
            </p>
          </div>
          <button
            onClick={() => setView('admin')}
            className="bg-gray-700 text-white py-2 px-4 rounded-lg shadow-md hover:bg-gray-800 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
              <DashboardIcon className="h-5 w-5" />
              Go to Admin Dashboard
          </button>
        </div>
      </div>

      {/* Chat Widget Container */}
      <div className="fixed bottom-5 right-5 z-50">
          {isChatOpen ? (
              <div className="transition-all duration-300 ease-out transform scale-100 opacity-100">
                {userInfo && initialTopicId && userId && sessionId ? (
                  <ChatWidget
                    tenant={{
                      ...TENANTS[0],
                      id: selectedTenant.tenant_id,
                      name: selectedTenant.name,
                    }}
                    userInfo={userInfo}
                    initialTopicId={initialTopicId}
                    userId={userId}
                    sessionId={sessionId}
                    onClose={() => setIsChatOpen(false)}
                    onEndSession={handleEndSession}
                  />
                ) : (
                  <UserInfoForm
                    tenant={{
                      ...TENANTS[0],
                      id: selectedTenant.tenant_id,
                      name: selectedTenant.name,
                    }}
                    onComplete={handleFormComplete}
                  />
                )}
              </div>
          ) : (
             <button
              onClick={() => setIsChatOpen(true)}
              className={`p-4 rounded-full text-white shadow-lg hover:scale-110 transition-transform duration-200 bg-${getPrimaryColor()}`}
              aria-label="Open Chat"
            >
              <ChatBubbleIcon className="h-8 w-8" />
            </button>
          )}
      </div>
    </div>
  );
};

export default App;
