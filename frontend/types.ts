
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

export interface Attachment {
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

export interface MessageDetail {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
  supporter_name?: string;
  attachments?: Attachment[];
}

export interface SessionSummary {
  session_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  is_active: boolean;
  assigned_supporter_id?: string;
  escalation_status?: 'pending' | 'assigned' | 'resolved';
}

export interface SessionDetail extends SessionSummary {
  messages: MessageDetail[];
}

export interface KnowledgeDocument {
  id: string;
  tenantId: string;
  topicId: string;
  fileName: string;
  content: string;
  uploadedAt: string;
}

export interface ChatSession extends SessionSummary {
  id: string;
  tenantId: string;
  userName?: string;
  userEmail?: string;
  messages?: Message[];
  assignedSupporterId?: string;
  escalationStatus?: 'pending' | 'assigned' | 'resolved';
  lastActivity: string;
}
