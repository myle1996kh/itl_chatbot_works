import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/ChatWidget';
import { Tenant, UserInfo } from './types';
import { getApiBaseUrl, setApiBaseUrl } from './services/chatService';
import './src/index.css';

import { ChatBubbleIcon } from './components/icons';

const WidgetApp: React.FC = () => {
  const [config, setConfig] = useState<any>(null);

  const ANONYMOUS_USER: UserInfo = {
    email: 'anonymous@guest.com',
    username: 'Guest',
    department: 'Website Visitor'
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isStandalone = window.self === window.top; // Determine if running in top-level window

  useEffect(() => {
    const initWidget = async () => {
      try {
        const pathParts = window.location.pathname.split('/');
        const widgetKey = pathParts[pathParts.indexOf('widget') + 1];
        const params = new URLSearchParams(window.location.search);
        const tenantId = params.get('tenant_id');

        console.log('🔧 Widget Init:', { widgetKey, tenantId, pathname: window.location.pathname });

        if (!widgetKey || !tenantId) {
          throw new Error('Missing widget_key or tenant_id');
        }

        const currentOrigin = window.location.origin;
        setApiBaseUrl(currentOrigin);

        console.log('📡 Fetching widget config from:', `${currentOrigin}/api/widget-config?tenant_id=${tenantId}&widget_key=${widgetKey}`);

        const response = await fetch(
          `${currentOrigin}/api/widget-config?tenant_id=${tenantId}&widget_key=${widgetKey}`
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
        if (!isStandalone) { // Only postmessage if inside an iframe
            try {
                if (widgetConfig.auto_open) {
                    window.parent.postMessage({ type: 'agenthub:maximize' }, '*');
                    console.log('📨 Sent maximize message to parent');
                } else {
                    window.parent.postMessage({ type: 'agenthub:minimize' }, '*');
                    console.log('📨 Sent minimize message to parent');
                }
            } catch (e) {
                console.warn('⚠️ Could not send message to parent (expected if parent not listening):', e);
            }
        }


        let currentUserId = localStorage.getItem(`agenthub_user_${tenantId}`);
        if (!currentUserId) {
            const userUrl = `${currentOrigin}/api/${tenantId}/chat_users`;
            console.log('👤 Creating new chat user at:', userUrl);
            const userRes = await fetch(userUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: `guest_${Date.now()}@anonymous.com`,
                    username: 'Guest User',
                    department: 'Website Visitor'
                })
            });
            console.log('👤 User creation response status:', userRes.status);

            if (userRes.ok) {
                const userData = await userRes.json();
                currentUserId = userData.user_id;
                localStorage.setItem(`agenthub_user_${tenantId}`, currentUserId!);
                console.log('✅ Chat user created:', currentUserId);
            } else {
                const errText = await userRes.text();
                console.error('❌ Failed to create user (status ' + userRes.status + '):', errText);
                console.log('⚠️ Using random UUID instead');
                currentUserId = crypto.randomUUID();
            }
        } else {
            console.log('👤 Using existing user:', currentUserId);
        }
        console.log('✅ User ID set:', currentUserId);
        setUserId(currentUserId);

        const sessionUrl = `${currentOrigin}/api/${tenantId}/sessions?user_id=${currentUserId}`;
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
            console.error('❌ Session creation failed (status ' + sessionRes.status + '):', errText);
            throw new Error(`Failed to create session: ${sessionRes.status} - ${errText}`);
        }

      } catch (err) {
        console.error('❌ Widget initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load widget');
      } finally {
        setLoading(false);
      }
    };

    initWidget();
  }, [isStandalone]); // Depend on isStandalone to re-run effect if it changes (unlikely)

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

  if (!config || !userId || !sessionId) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-white">
        <div className="text-center p-4">
          <p className="text-red-500 text-sm mb-4">Failed to initialize chat widget</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Try Again
          </button>
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

  // Conditional styling for the root container
  const containerClassName = isStandalone
    ? "fixed bottom-5 right-5 z-50 w-96 h-[600px] rounded-lg overflow-hidden"
    : "w-full h-full";

  return (
    <div className={containerClassName}>
      {isOpen ? (
        <div className="w-full h-full shadow-lg rounded-lg overflow-hidden">
            <ChatWidget
                tenant={tenant}
                userInfo={ANONYMOUS_USER}
                initialTopicId="general"
                userId={userId}
                sessionId={sessionId}
                onClose={() => toggleOpen(false)}
                onEndSession={() => window.location.reload()}
            />
        </div>
      ) : isStandalone ? (
        <div className="w-full h-full flex items-end justify-end p-4">
            <button
                onClick={() => toggleOpen(true)}
                className="rounded-full text-white shadow-lg hover:scale-110 transition-transform duration-200 flex items-center justify-center w-14 h-14"
                style={{ backgroundColor: primaryColor }}
                aria-label="Open Chat"
            >
                <ChatBubbleIcon className="h-8 w-8" />
            </button>
        </div>
      ) : null}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WidgetApp />
  </React.StrictMode>
);
