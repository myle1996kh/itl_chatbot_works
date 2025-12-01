import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import EmbeddedWidget from './components/EmbeddedWidget';
import UserInfoForm from './components/UserInfoForm';
import { Tenant, UserInfo } from './types';
import { getApiBaseUrl, setApiBaseUrl } from './services/chatService';
import './src/index.css';

const WidgetApp: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const isStandalone = window.self === window.top;

  useEffect(() => {
    const initWidget = async () => {
      try {
        const pathParts = window.location.pathname.split('/');
        const widgetKey = pathParts[pathParts.indexOf('widget') + 1];
        const params = new URLSearchParams(window.location.search);
        const tId = params.get('tenant_id');

        console.log('🔧 Widget Init:', { widgetKey, tenantId: tId, pathname: window.location.pathname });

        if (!widgetKey || !tId) {
          throw new Error('Missing widget_key or tenant_id');
        }

        setTenantId(tId);
        const currentOrigin = window.location.origin;
        setApiBaseUrl(currentOrigin);

        console.log('📡 Fetching widget config from:', `${currentOrigin}/api/widget-config?tenant_id=${tId}&widget_key=${widgetKey}`);

        const response = await fetch(
          `${currentOrigin}/api/widget-config?tenant_id=${tId}&widget_key=${widgetKey}`
        );

        console.log('📡 Widget config response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Widget config error response:', errorText);
          throw new Error(`Failed to load widget config: ${response.status} - ${errorText}`);
        }

        const widgetConfig = await response.json();
        console.log('✅ Widget config loaded:', widgetConfig);
        setConfig(widgetConfig);

        // Initialize open state from config
        setIsOpen(widgetConfig.auto_open);
        if (!isStandalone) {
          try {
            if (widgetConfig.auto_open) {
              window.parent.postMessage({ type: 'agenthub:maximize' }, '*');
              console.log('📨 Sent maximize message to parent');
            } else {
              window.parent.postMessage({ type: 'agenthub:minimize' }, '*');
              console.log('📨 Sent minimize message to parent');
            }
          } catch (e) {
            console.warn('⚠️ Could not send message to parent:', e);
          }
        }

        // Check if user info already exists in localStorage
        const savedUserInfo = localStorage.getItem(`agenthub_user_info_${tId}`);
        const savedUserId = localStorage.getItem(`agenthub_user_${tId}`);
        const savedToken = localStorage.getItem(`agenthub_token_${tId}`);

        if (savedUserInfo && savedUserId && savedToken) {
          // User already exists, proceed with session creation
          console.log('👤 Using existing user:', savedUserId);
          const parsed = JSON.parse(savedUserInfo);
          setUserInfo(parsed);
          setUserId(savedUserId);
          setToken(savedToken);
          await createSession(tId, savedUserId, currentOrigin, savedToken);
        } else {
          // Show form to collect user info
          console.log('📝 No user info found, showing form');
          setShowUserForm(true);
        }

      } catch (err) {
        console.error('❌ Widget initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load widget');
      } finally {
        setLoading(false);
      }
    };

    initWidget();
  }, [isStandalone]);

  const createSession = async (tId: string, uId: string, currentOrigin: string, tkn: string) => {
    try {
      const sessionUrl = `${currentOrigin}/api/${tId}/sessions?user_id=${uId}`;
      console.log('🔄 Creating session at:', sessionUrl);
      const sessionRes = await fetch(sessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📡 Session response status:', sessionRes.status);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        console.log('📡 Session response data:', sessionData);
        setSessionId(sessionData.session_id);
        console.log('✅ Session created:', sessionData.session_id);
      } else {
        const errText = await sessionRes.text();
        console.error('❌ Session creation failed:', errText);

        if (sessionRes.status === 401) {
          console.warn('⚠️ Detected invalid token. Clearing storage and reloading...');
          localStorage.removeItem(`agenthub_token_${tId}`);
          localStorage.removeItem(`agenthub_user_${tId}`);
          localStorage.removeItem(`agenthub_user_info_${tId}`);
          window.location.reload();
          return;
        }

        throw new Error(`Failed to create session: ${sessionRes.status} - ${errText}`);
      }
    } catch (err) {
      console.error('❌ Session creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleUserFormSubmit = async (formData: { username: string; email: string; department?: string }) => {
    if (!tenantId) return;

    setFormLoading(true);
    try {
      const currentOrigin = window.location.origin;
      const userUrl = `${currentOrigin}/api/${tenantId}/chat_users`;
      console.log('👤 Creating chat user at:', userUrl, formData);

      const userRes = await fetch(userUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          department: formData.department || 'General Support'
        })
      });

      console.log('👤 User creation response status:', userRes.status);

      if (userRes.ok) {
        const userData = await userRes.json();
        const newUserId = userData.user_id;
        const newToken = userData.token;

        // Save to localStorage
        localStorage.setItem(`agenthub_user_info_${tenantId}`, JSON.stringify({
          username: formData.username,
          email: formData.email,
          department: formData.department || 'General Support'
        }));
        localStorage.setItem(`agenthub_user_${tenantId}`, newUserId);
        localStorage.setItem(`agenthub_token_${tenantId}`, newToken);

        console.log('✅ Chat user created:', newUserId);
        console.log('✅ JWT token received and stored');

        setUserInfo({
          username: formData.username,
          email: formData.email,
          department: formData.department || 'General Support'
        });
        setUserId(newUserId);
        setToken(newToken);
        setShowUserForm(false);

        // Create session
        await createSession(tenantId, newUserId, currentOrigin, newToken);
      } else {
        const errText = await userRes.text();
        console.error('❌ Failed to create user:', errText);
        throw new Error('Failed to create user account');
      }
    } catch (err) {
      console.error('❌ User creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleOpen = (open: boolean) => {
    setIsOpen(open);
    if (!isStandalone) { // Only postmessage if inside an iframe
      if (open) {
        window.parent.postMessage({ type: 'agenthub:maximize' }, '*');
      } else {
        window.parent.postMessage({ type: 'agenthub:minimize' }, '*');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-500">Loading chat widget...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-white">
        <div className="text-center p-4">
          <div className="text-red-500 mb-2 text-lg">⚠️</div>
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show user form if needed
  if (showUserForm && config) {
    const tenant: Tenant = {
      id: config.tenant_id,
      name: 'AgentHub Widget',
      config: { apiUrl: getApiBaseUrl(), apiKey: '' },
      theme: {
        primaryColor: config.primary_color || '#3B82F6',
        headerText: 'Support Chat',
        welcomeMessage: config.welcome_message || 'How can we help you?',
      },
      topics: [{ id: 'general', name: 'General', description: 'General support', ragContext: '' }]
    };

    const handleFormClose = () => {
      setShowUserForm(false);
      setIsOpen(false);
      if (!isStandalone) {
        try {
          window.parent.postMessage({ type: 'agenthub:minimize' }, '*');
        } catch (e) {
          console.warn('Could not send minimize message to parent');
        }
      }
    };

    const primaryColor = config.primary_color || '#3B82F6';

    return (
      <div className={isOpen ? (isStandalone ? "fixed bottom-5 right-5 z-50 w-96 h-[600px]" : "w-full h-full") : "fixed bottom-5 right-5 z-50"}>
        {isOpen ? (
          <div className="w-full h-full shadow-lg rounded-lg overflow-hidden">
            <UserInfoForm
              tenant={tenant}
              onSubmit={handleUserFormSubmit}
              loading={formLoading}
              onClose={handleFormClose}
              isStandalone={isStandalone}
            />
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="hover:scale-110 transition-transform duration-200 cursor-pointer rounded-full p-4 shadow-xl"
            style={{ backgroundColor: primaryColor }}
            aria-label="Open Chat"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  if (!config || !userId || !sessionId || !token || !userInfo) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-white">
        <div className="text-center p-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-500 text-sm">Initializing chat...</p>
        </div>
      </div>
    );
  }

  const tenant: Tenant = {
    id: config.tenant_id,
    name: 'AgentHub Widget',
    config: { apiUrl: getApiBaseUrl(), apiKey: '' },
    theme: {
      primaryColor: config.primary_color || '#3B82F6',
      headerText: 'Support Chat',
      welcomeMessage: config.welcome_message || 'How can we help you?',
    },
    topics: [{ id: 'general', name: 'General', description: 'General support', ragContext: '' }]
  };

  const primaryColor = tenant.theme.primaryColor;

  return (
    <div className={isOpen ? (isStandalone ? "fixed bottom-5 right-5 z-50 w-96 h-[600px]" : "w-full h-full") : "fixed bottom-5 right-5 z-50"}>
      {isOpen ? (
        <div className="w-full h-full shadow-lg rounded-lg overflow-hidden">
          <EmbeddedWidget
            tenant={tenant}
            userInfo={userInfo}
            userId={userId}
            sessionId={sessionId}
            token={token}
            onClose={() => toggleOpen(false)}
            onMinimize={() => toggleOpen(false)}
            onEndSession={() => window.location.reload()}
          />
        </div>
      ) : (
        <button
          onClick={() => toggleOpen(true)}
          className="hover:scale-110 transition-transform duration-200 cursor-pointer rounded-full p-4 shadow-xl"
          style={{ backgroundColor: primaryColor }}
          aria-label="Open Chat"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WidgetApp />
  </React.StrictMode>
);
