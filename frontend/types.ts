
export interface Theme {
  primaryColor: string;
  headerText: string;
  welcomeMessage: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  ragContext: string; // This is the initial, static context.
}

export interface TenantConfig {
  apiUrl: string;
  apiKey: string;
}

export interface Tenant {
  id: string;
  name: string;
  config: TenantConfig;
  theme: Theme;
  topics: Topic[];
}

export interface Supporter {
  id: string;
  name: string;
  tenantId: string;
}

export interface UserInfo {
  username: string;
  email: string;
  department?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'supporter';
  timestamp: string;
  isTyping?: boolean;
  supporterName?: string;
  fileInfo?: {
      name: string;
      size: number;
  }
}

export interface ChatSession {
    id: string;
    tenantId: string;
    userEmail: string;
    messages: Message[];
    assignedSupporterId: string | null;
    escalationStatus?: string;
    lastActivity: string;
}

export interface KnowledgeDocument {
    id: string;
    tenantId: string;
    topicId: string;
    fileName: string;
    content: string;
    uploadedAt: string;
}
