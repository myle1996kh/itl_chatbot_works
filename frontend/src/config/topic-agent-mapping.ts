/**
 * Topic to Agent Mapping Configuration
 *
 * Maps user topics/intents to specific agent names for Phase 1 direct routing.
 * Agent names are constant across all tenants.
 * The backend will look up the actual agent_id per tenant when needed.
 *
 * Usage:
 *   const agentName = TOPIC_AGENT_MAP[userTopic] || 'GuidelineAgent';
 *   // Send message with agent_name to backend
 *   chatService.sendMessage(message, agentName);
 */

/**
 * Agent Names (Constant across all tenants)
 * These map to actual agents seeded in the database
 */
export const AGENT_NAMES = {
  SUPPORT: 'GuidelineAgent',
  GENERAL: 'SupervisorAgent',
  DEBT: 'DebtAgent',
} as const;

export type AgentName = typeof AGENT_NAMES[keyof typeof AGENT_NAMES];

/**
 * Topic Keywords to Agent Mapping
 *
 * Maps keywords and phrases in user messages to appropriate agents
 * This helps the frontend suggest/select the right agent
 */
export const TOPIC_KEYWORDS = {
  [AGENT_NAMES.SUPPORT]: [
    'support',
    'help',
    'assist',
    'hỗ trợ',
    'giúp đỡ',
    'tư vấn',
    'policy',
    'guideline',
    'procedure',
    'quy trình',
    'quy định',
    'hướng dẫn',
  ],
  [AGENT_NAMES.GENERAL]: [
    'general',
    'chung',
    'thông tin',
    'question',
    'câu hỏi',
    'other',
    'khác',
  ],
  [AGENT_NAMES.DEBT]: [
    'debt',
    'công nợ',
    'payment',
    'thanh toán',
    'financial',
    'tài chính',
    'money',
    'tiền',
    'loan',
    'vay',
    'credit',
    'bill',
    'hóa đơn',
    'invoice',
    'owe',
    'nợ',
  ],
} as const;

/**
 * Topic Enum for Type Safety
 */
export enum Topic {
  SUPPORT = 'SUPPORT',
  GENERAL = 'GENERAL',
  DEBT = 'DEBT',
}

/**
 * Map Topic enum to Agent Name
 */
export const TOPIC_TO_AGENT: Record<Topic, AgentName> = {
  [Topic.SUPPORT]: AGENT_NAMES.SUPPORT,
  [Topic.GENERAL]: AGENT_NAMES.GENERAL,
  [Topic.DEBT]: AGENT_NAMES.DEBT,
};

/**
 * Detect topic from user message based on keywords
 *
 * @param message User message to analyze
 * @returns Topic enum or null if no topic detected
 *
 * Example:
 *   const topic = detectTopic('Tôi cần hỗ trợ');
 *   // Returns: Topic.SUPPORT
 */
export function detectTopic(message: string): Topic | null {
  const lowerMessage = message.toLowerCase();

  // Priority order: Check more specific topics first (DEBT, SUPPORT) before GENERAL
  // This prevents generic keywords like "hỏi" from matching GENERAL when the message is about debt

  // 1. Check DEBT keywords first (most specific)
  const debtKeywords = TOPIC_KEYWORDS[AGENT_NAMES.DEBT];
  for (const keyword of debtKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return Topic.DEBT;
    }
  }

  // 2. Check SUPPORT keywords
  const supportKeywords = TOPIC_KEYWORDS[AGENT_NAMES.SUPPORT];
  for (const keyword of supportKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return Topic.SUPPORT;
    }
  }

  // 3. Check GENERAL keywords last (most generic)
  const generalKeywords = TOPIC_KEYWORDS[AGENT_NAMES.GENERAL];
  for (const keyword of generalKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return Topic.GENERAL;
    }
  }

  return null;
}

/**
 * Get agent name from topic
 *
 * @param topic Topic enum
 * @returns Agent name constant
 *
 * Example:
 *   const agentName = getAgentName(Topic.GENERAL);
 *   // Returns: 'SupervisorAgent'
 */
export function getAgentName(topic: Topic): AgentName {
  return TOPIC_TO_AGENT[topic];
}

/**
 * Get agent name from user message
 *
 * Detects topic from message keywords and returns corresponding agent name.
 * Falls back to SupervisorAgent if no topic is detected.
 *
 * @param message User message
 * @returns Agent name to use for routing
 *
 * Example:
 *   const agentName = getAgentNameFromMessage('Câu hỏi chung');
 *   // Returns: 'SupervisorAgent'
 */
export function getAgentNameFromMessage(message: string): AgentName {
  const topic = detectTopic(message);
  return topic ? getAgentName(topic) : AGENT_NAMES.GENERAL;
}

/**
 * Agent Descriptions for UI Display
 */
export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  [AGENT_NAMES.SUPPORT]: 'Hỗ trợ, tư vấn và hướng dẫn',
  [AGENT_NAMES.GENERAL]: 'Câu hỏi chung và thông tin tổng quát',
  [AGENT_NAMES.DEBT]: 'Quản lý công nợ và tài chính',
};

/**
 * Agent Icons for UI Display (Emoji or Icon Names)
 */
export const AGENT_ICONS: Record<AgentName, string> = {
  [AGENT_NAMES.SUPPORT]: '🆘',
  [AGENT_NAMES.GENERAL]: '�',
  [AGENT_NAMES.DEBT]: '💰',
};

/**
 * Available Agents
 * Used to populate UI dropdowns or agent selection components
 */
export const AVAILABLE_AGENTS: Array<{ name: AgentName; description: string; icon: string }> = [
  {
    name: AGENT_NAMES.SUPPORT,
    description: AGENT_DESCRIPTIONS[AGENT_NAMES.SUPPORT],
    icon: AGENT_ICONS[AGENT_NAMES.SUPPORT],
  },
  {
    name: AGENT_NAMES.GENERAL,
    description: AGENT_DESCRIPTIONS[AGENT_NAMES.GENERAL],
    icon: AGENT_ICONS[AGENT_NAMES.GENERAL],
  },
  {
    name: AGENT_NAMES.DEBT,
    description: AGENT_DESCRIPTIONS[AGENT_NAMES.DEBT],
    icon: AGENT_ICONS[AGENT_NAMES.DEBT],
  },
];
