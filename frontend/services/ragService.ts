
import { Message, Tenant, Topic } from '../types';
import { getDocumentsForTopic } from './embeddingService';
import { getAiResponse } from './geminiService';

/**
 * Combines various context sources into a single string for the RAG prompt.
 * @param query The user's original query.
 * @param topic The selected topic, containing initial context.
 * @param documents The dynamically retrieved knowledge base documents.
 * @param chatHistory The recent messages from the current conversation.
 * @returns A formatted string containing all the context.
 */
const buildRagContext = (
  query: string,
  topic: Topic,
  documents: any[],
  chatHistory: Message[]
): string => {
  let context = `Bối cảnh: Bạn là một trợ lý ảo chuyên nghiệp của ${topic.name}. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng dựa trên các thông tin được cung cấp dưới đây. Trả lời bằng tiếng Việt.`;

  // 1. Add static topic context
  if (topic.ragContext) {
    context += `\n\n--- Hướng dẫn chung về chủ đề "${topic.name}" ---\n${topic.ragContext}`;
  }

  // 2. Add dynamic knowledge from uploaded documents
  if (documents.length > 0) {
    context += `\n\n--- Thông tin bổ sung từ tài liệu ---\n`;
    documents.forEach((doc, index) => {
      context += `Tài liệu ${index + 1} (${doc.fileName}):\n${doc.content}\n\n`;
    });
  }

  // 3. Add conversation history for conversational context
  if (chatHistory.length > 0) {
    context += `\n\n--- Lịch sử cuộc trò chuyện gần đây (để tham khảo) ---\n`;
    // We only need the last few messages to avoid making the prompt too long.
    const recentHistory = chatHistory.slice(-4);
    recentHistory.forEach(msg => {
      if (msg.sender === 'user') {
        context += `Người dùng: ${msg.text}\n`;
      } else if (msg.sender === 'ai') {
        context += `Trợ lý: ${msg.text}\n`;
      }
    });
  }

  // 4. Add the user's final question
  context += `\n\n--- Câu hỏi của người dùng ---\nDựa vào toàn bộ thông tin trên, hãy trả lời câu hỏi sau một cách chi tiết và chính xác:\n"${query}"`;
  
  return context;
};

/**
 * Generates a response using Retrieval-Augmented Generation (RAG).
 * It fetches relevant documents, builds a comprehensive prompt, and calls the Gemini API.
 * @param query The user's question.
 * @param tenant The current tenant.
 * @param topic The selected topic.
 * @param chatHistory The history of the current conversation.
 * @returns A promise that resolves to the AI-generated response string.
 */
export const generateRagResponse = async (
  query: string,
  tenant: Tenant,
  topic: Topic,
  chatHistory: Message[]
): Promise<string> => {
  try {
    // Step 1: Retrieve relevant documents from the knowledge base.
    // For this simple service, we'll retrieve all documents for the topic.
    // A more advanced system would use vector search to find the most relevant chunks.
    const relevantDocuments = getDocumentsForTopic(tenant.id, topic.id);

    // Step 2: Build a comprehensive prompt with all available context.
    const fullPrompt = buildRagContext(query, topic, relevantDocuments, chatHistory);
    
    // Step 3: Call the Gemini service with the constructed prompt.
    const response = await getAiResponse(fullPrompt);
    return response;
  } catch (error) {
    console.error('Error in RAG service:', error);
    return 'Xin lỗi, tôi đã gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
  }
};
