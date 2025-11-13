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
  GUIDELINE: 'GuidelineAgent',
  SHIPMENT: 'ShipmentAgent',
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
  [AGENT_NAMES.GUIDELINE]: [
    'policy',
    'guideline',
    'procedure',
    'rule',
    'company policy',
    'how to',
    'can i',
    'am i allowed',
    'compliance',
    'standard',
    'best practice',
  ],
  [AGENT_NAMES.SHIPMENT]: [
    'shipment',
    'track',
    'tracking',
    'delivery',
    'shipped',
    'order',
    'package',
    'logistics',
    'where is',
    'when will',
    'shipping status',
  ],
  [AGENT_NAMES.DEBT]: [
    'debt',
    'payment',
    'financial',
    'money',
    'loan',
    'credit',
    'bill',
    'invoice',
    'owe',
    'owing',
    'how much',
    'bankruptcy',
  ],
} as const;

/**
 * Topic Enum for Type Safety
 */
export enum Topic {
  GUIDELINE = 'GUIDELINE',
  SHIPMENT = 'SHIPMENT',
  DEBT = 'DEBT',
}

/**
 * Map Topic enum to Agent Name
 */
export const TOPIC_TO_AGENT: Record<Topic, AgentName> = {
  [Topic.GUIDELINE]: AGENT_NAMES.GUIDELINE,
  [Topic.SHIPMENT]: AGENT_NAMES.SHIPMENT,
  [Topic.DEBT]: AGENT_NAMES.DEBT,
};

/**
 * Detect topic from user message based on keywords
 *
 * @param message User message to analyze
 * @returns Topic enum or null if no topic detected
 *
 * Example:
 *   const topic = detectTopic('Where is my shipment?');
 *   // Returns: Topic.SHIPMENT
 */
export function detectTopic(message: string): Topic | null {
  const lowerMessage = message.toLowerCase();

  // Check each agent's keywords
  for (const [agentName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        // Convert agent name back to Topic enum
        if (agentName === AGENT_NAMES.GUIDELINE) return Topic.GUIDELINE;
        if (agentName === AGENT_NAMES.SHIPMENT) return Topic.SHIPMENT;
        if (agentName === AGENT_NAMES.DEBT) return Topic.DEBT;
      }
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
 *   const agentName = getAgentName(Topic.SHIPMENT);
 *   // Returns: 'ShipmentAgent'
 */
export function getAgentName(topic: Topic): AgentName {
  return TOPIC_TO_AGENT[topic];
}

/**
 * Get agent name from user message
 *
 * Detects topic from message keywords and returns corresponding agent name.
 * Falls back to GuidelineAgent if no topic is detected.
 *
 * @param message User message
 * @returns Agent name to use for routing
 *
 * Example:
 *   const agentName = getAgentNameFromMessage('Where is my order?');
 *   // Returns: 'ShipmentAgent'
 */
export function getAgentNameFromMessage(message: string): AgentName {
  const topic = detectTopic(message);
  return topic ? getAgentName(topic) : AGENT_NAMES.GUIDELINE;
}

/**
 * Agent Descriptions for UI Display
 */
export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  [AGENT_NAMES.GUIDELINE]: 'Company policies, procedures, and guidelines',
  [AGENT_NAMES.SHIPMENT]: 'Shipment tracking and logistics inquiries',
  [AGENT_NAMES.DEBT]: 'Debt management and financial assistance',
};

/**
 * Agent Icons for UI Display (Emoji or Icon Names)
 */
export const AGENT_ICONS: Record<AgentName, string> = {
  [AGENT_NAMES.GUIDELINE]: '📋',
  [AGENT_NAMES.SHIPMENT]: '📦',
  [AGENT_NAMES.DEBT]: '💰',
};

/**
 * Available Agents
 * Used to populate UI dropdowns or agent selection components
 */
export const AVAILABLE_AGENTS: Array<{ name: AgentName; description: string; icon: string }> = [
  {
    name: AGENT_NAMES.GUIDELINE,
    description: AGENT_DESCRIPTIONS[AGENT_NAMES.GUIDELINE],
    icon: AGENT_ICONS[AGENT_NAMES.GUIDELINE],
  },
  {
    name: AGENT_NAMES.SHIPMENT,
    description: AGENT_DESCRIPTIONS[AGENT_NAMES.SHIPMENT],
    icon: AGENT_ICONS[AGENT_NAMES.SHIPMENT],
  },
  {
    name: AGENT_NAMES.DEBT,
    description: AGENT_DESCRIPTIONS[AGENT_NAMES.DEBT],
    icon: AGENT_ICONS[AGENT_NAMES.DEBT],
  },
];
