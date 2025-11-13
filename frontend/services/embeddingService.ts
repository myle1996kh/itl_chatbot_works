
import { KnowledgeDocument, Tenant, Topic } from '../types';

const KNOWLEDGE_BASE_PREFIX = 'knowledgeBase';

/**
 * Retrieves all documents for a specific topic from localStorage.
 * @param tenantId The ID of the tenant.
 * @param topicId The ID of the topic.
 * @returns An array of KnowledgeDocument objects.
 */
export const getDocumentsForTopic = (tenantId: string, topicId: string): KnowledgeDocument[] => {
  const key = `${KNOWLEDGE_BASE_PREFIX}_${tenantId}_${topicId}`;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to retrieve documents from localStorage:', error);
    return [];
  }
};

/**
 * Saves an array of documents for a specific topic to localStorage.
 * @param tenantId The ID of the tenant.
 * @param topicId The ID of the topic.
 * @param documents The array of documents to save.
 */
const saveDocumentsForTopic = (tenantId: string, topicId: string, documents: KnowledgeDocument[]) => {
  const key = `${KNOWLEDGE_BASE_PREFIX}_${tenantId}_${topicId}`;
  try {
    localStorage.setItem(key, JSON.stringify(documents));
  } catch (error) {
    console.error('Failed to save documents to localStorage:', error);
  }
};

/**
 * Adds a new document to the knowledge base for a specific topic.
 * @param tenantId The ID of the tenant.
 * @param topicId The ID of the topic.
 * @param fileName The name of the document file.
 * @param content The text content of the document.
 */
export const addDocumentToKnowledgeBase = (tenantId: string, topicId: string, fileName: string, content: string) => {
  const documents = getDocumentsForTopic(tenantId, topicId);
  const newDocument: KnowledgeDocument = {
    id: `doc-${Date.now()}`,
    tenantId,
    topicId,
    fileName,
    content,
    uploadedAt: new Date().toISOString(),
  };
  documents.push(newDocument);
  saveDocumentsForTopic(tenantId, topicId, documents);
};

/**
 * Enriches a topic's knowledge base from selected chat messages.
 * This simulates a process where an admin curates useful information from a conversation.
 * @param tenant The tenant object.
 * @param topic The topic to enrich.
 * @param messages The messages selected for enrichment.
 */
export const enrichKnowledgeBaseFromChat = (
  tenant: Tenant,
  topic: Topic,
  messages: Array<{ text: string; sender: string }>
) => {
  const documents = getDocumentsForTopic(tenant.id, topic.id);
  const conversationText = messages
    .map(m => `${m.sender === 'user' ? 'User' : 'Agent'}: ${m.text}`)
    .join('\n\n');

  const newDocument: KnowledgeDocument = {
    id: `doc-enrich-${Date.now()}`,
    tenantId: tenant.id,
    topicId: topic.id,
    fileName: `Enriched from chat on ${new Date().toLocaleDateString()}.txt`,
    content: `The following is an excerpt from a support conversation that was deemed useful for this topic:\n\n---\n\n${conversationText}`,
    uploadedAt: new Date().toISOString(),
  };

  documents.push(newDocument);
  saveDocumentsForTopic(tenant.id, topic.id, documents);
};
