/**
 * Knowledge Service
 *
 * Handles communication with the ITL Backend API for knowledge base management.
 * Supports document uploads (PDF, DOCX) and knowledge base operations.
 */

/**
 * API Configuration
 */
const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  UPLOAD_ENDPOINT: '/api/admin/tenants/{tenant_id}/knowledge/upload-document',
  STATS_ENDPOINT: '/api/admin/tenants/{tenant_id}/knowledge/stats',
  GET_ALL_ENDPOINT: '/api/admin/tenants/{tenant_id}/knowledge/all',
  DELETE_ENDPOINT: '/api/admin/tenants/{tenant_id}/knowledge',
  TIMEOUT_MS: 60000, // Longer timeout for file uploads
};

/**
 * Knowledge Service Interfaces
 */
interface UploadDocumentParams {
  tenantId: string;
  file: File;
  documentName?: string;
  agentName?: string; // Agent/Topic name (e.g., 'GuidelineAgent')
  jwt?: string; // Required: JWT token for admin authentication
}

interface PDFUploadResponse {
  success: boolean;
  tenant_id: string;
  filename: string;
  document_name: string;
  chunk_count: number;
  collection_name: string;
  document_ids: string[];
}

interface KnowledgeBaseStats {
  success: boolean;
  tenant_id: string;
  collection_name: string;
  document_count: number;
}

interface KnowledgeServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Ingest raw text(s) into the tenant knowledge base using admin API
 * Leverages /api/admin/tenants/{tenant_id}/knowledge which accepts
 * { documents: string[], metadatas?: object[] }
 */
export async function ingestTexts(
  tenantId: string,
  texts: string[],
  metadatas?: Record<string, any>[],
  jwt?: string
): Promise<KnowledgeServiceResponse<{ document_count: number }>> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/admin/tenants/${tenantId}/knowledge`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      body: JSON.stringify({
        documents: texts,
        metadatas: metadatas,
      }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        error: err.detail || `HTTP ${response.status}: ${response.statusText}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data: { document_count: data.document_count } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'INGEST_TEXTS_ERROR',
    };
  }
}

/**
 * Upload a document to the knowledge base
 *
 * This function uploads a document file (PDF or DOCX) to the tenant's knowledge base.
 * The file is processed as follows:
 * 1. Validated for file format (.pdf, .docx, .doc)
 * 2. Text is extracted and split into chunks (400 chars, 200 overlap)
 * 3. For DOCX: Section hierarchy and headings are tracked in metadata
 * 4. Embeddings are generated using all-MiniLM-L6-v2 (384 dimensions)
 * 5. Data is stored in PgVector with tenant isolation
 *
 * @param params - Upload document parameters
 * @returns Upload response from backend
 *
 * @example
 * // Upload a PDF file
 * const response = await uploadDocument({
 *   tenantId: '550e8400-e29b-41d4-a716-446655440000',
 *   file: fileObject,
 *   documentName: 'Company Policies',
 *   jwt: 'eyJhbGciOiJSUzI1NiIs...',
 * });
 */
export async function uploadDocument(
  params: UploadDocumentParams
): Promise<KnowledgeServiceResponse<PDFUploadResponse>> {
  try {
    // Validate file format
    const fileExt = params.file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['pdf', 'docx', 'doc'].includes(fileExt)) {
      return {
        success: false,
        error: `Unsupported file format: .${fileExt}. Supported: .pdf, .docx, .doc`,
        code: 'INVALID_FILE_FORMAT',
      };
    }

    // Validate file size (max 80MB)
    const maxSizeMB = 80;
    if (params.file.size > maxSizeMB * 1024 * 1024) {
      return {
        success: false,
        error: `File size exceeds ${maxSizeMB}MB limit`,
        code: 'FILE_TOO_LARGE',
      };
    }

    // Build FormData
    const formData = new FormData();
    formData.append('file', params.file);
    if (params.documentName) {
      formData.append('document_name', params.documentName);
    }
    if (params.agentName) {
      formData.append('agent_name', params.agentName);
    }

    // Build URL
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.UPLOAD_ENDPOINT.replace(
      '{tenant_id}',
      params.tenantId
    )}`;

    console.log('📤 Uploading document', {
      url,
      filename: params.file.name,
      size: params.file.size,
      documentName: params.documentName,
    });

    // Make the API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(params.jwt && { Authorization: `Bearer ${params.jwt}` }),
      },
      body: formData,
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;

      console.error('❌ Document upload error', {
        status: response.status,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        code: `HTTP_${response.status}`,
      };
    }

    const data: PDFUploadResponse = await response.json();

    console.log('✅ Document uploaded successfully', {
      filename: data.filename,
      chunkCount: data.chunk_count,
      collectionName: data.collection_name,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('❌ Knowledge service error - upload', {
      error: errorMessage,
      params: {
        filename: params.file.name,
        tenantId: params.tenantId,
      },
    });

    return {
      success: false,
      error: errorMessage,
      code: 'KNOWLEDGE_SERVICE_ERROR',
    };
  }
}

/**
 * Get knowledge base statistics
 *
 * Retrieves statistics about the tenant's knowledge base including
 * document count and collection information.
 *
 * @param tenantId - Tenant ID
 * @param jwt - JWT token for authentication
 * @returns Knowledge base statistics
 *
 * @example
 * const stats = await getKnowledgeBaseStats(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function getKnowledgeBaseStats(
  tenantId: string,
  jwt?: string
): Promise<KnowledgeServiceResponse<KnowledgeBaseStats>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.STATS_ENDPOINT.replace(
      '{tenant_id}',
      tenantId
    )}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get knowledge base stats: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data: KnowledgeBaseStats = await response.json();

    console.log('✅ Knowledge base stats retrieved', {
      documentCount: data.document_count,
      collectionName: data.collection_name,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GET_STATS_ERROR',
    };
  }
}

/**
 * Get all documents from the knowledge base
 * 
 * @param tenantId - Tenant ID
 * @param jwt - JWT token for authentication
 * @returns List of documents
 */
export async function getAllDocuments(
  tenantId: string,
  jwt?: string
): Promise<KnowledgeServiceResponse<{ documents: any[]; document_count: number }>> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.GET_ALL_ENDPOINT.replace(
      '{tenant_id}',
      tenantId
    )}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get documents: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GET_ALL_DOCS_ERROR',
    };
  }
}


/**
 * Delete documents from knowledge base
 *
 * Removes specific documents from the tenant's knowledge base.
 *
 * @param tenantId - Tenant ID
 * @param documentIds - Array of document IDs to delete
 * @param jwt - JWT token for authentication
 * @returns Deletion result
 *
 * @example
 * const result = await deleteDocuments(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   ['doc-uuid-1', 'doc-uuid-2'],
 *   'eyJhbGciOiJSUzI1NiIs...'
 * );
 */
export async function deleteDocuments(
  tenantId: string,
  documentIds: string[],
  jwt?: string
): Promise<KnowledgeServiceResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.DELETE_ENDPOINT.replace(
      '{tenant_id}',
      tenantId
    )}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
      },
      body: JSON.stringify({ document_ids: documentIds }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to delete documents: HTTP ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();

    console.log('✅ Documents deleted successfully', {
      deletedCount: data.details?.deleted_count,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'DELETE_ERROR',
    };
  }
}

/**
 * Set the API base URL (useful for testing or dynamic configuration)
 *
 * @param baseUrl - New base URL
 */
export function setApiBaseUrl(baseUrl: string): void {
  API_CONFIG.BASE_URL = baseUrl;
}

/**
 * Get current API base URL
 */
export function getApiBaseUrl(): string {
  return API_CONFIG.BASE_URL;
}

export default {
  uploadDocument,
  getKnowledgeBaseStats,
  getAllDocuments,
  ingestTexts,
  deleteDocuments,
  setApiBaseUrl,
  getApiBaseUrl,
};
