import { Tenant, Supporter } from './types';

// DEFAULT TENANT - Used only as fallback for App.tsx styling
// Real tenants are fetched dynamically from backend - see tenantService.ts
export const TENANTS: Tenant[] = [
  {
    id: 'default',
    name: 'Default',
    config: {
      apiUrl: 'http://localhost:8000/api/rag',
      apiKey: 'default-key',
    },
    theme: {
      primaryColor: 'blue-600',
      headerText: 'AgentHub',
      welcomeMessage: 'Welcome to AgentHub. How can I help you?',
    },
    topics: [
      {
        id: 'general',
        name: 'General Support',
        description: 'General inquiries',
        ragContext: 'General support context',
      }
    ],
  }
];

export const SUPPORTERS: Supporter[] = [
    { id: 'sup-1', name: 'Nguyễn Văn An', tenantId: 'etms' },
    { id: 'sup-2', name: 'Trần Thị Bình', tenantId: 'etms' },
    { id: 'sup-3', name: 'Lê Minh Cường', tenantId: 'efms' },
    { id: 'sup-4', name: 'Phạm Thị Dung', tenantId: 'efms' },
    { id: 'sup-5', name: 'Hoàng Văn Hải', tenantId: 'vela' },
    { id: 'sup-6', name: 'Vũ Thu Hà', tenantId: 'vela' },
];
