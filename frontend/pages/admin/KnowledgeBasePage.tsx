import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Tenant } from '../../types';
import { getTenants as getTenantsFromBackend } from '../../services/adminService';
import { getJWTToken, getCurrentUser, LoginResponse } from '../../services/authService';
import { uploadDocument, getAllDocuments, deleteDocuments, getKnowledgeBaseStats } from '../../services/knowledgeService';
import { DocumentIcon, UploadIcon, TrashIcon, ArrowPathIcon } from '../../components/icons';

const KnowledgeBasePage: React.FC = () => {
    // Authentication state
    const [authenticatedUser, setAuthenticatedUser] = useState<LoginResponse | null>(getCurrentUser());
    const jwtToken = getJWTToken();

    // Backend data state
    const [backendTenants, setBackendTenants] = useState<Tenant[]>([]);
    const [loadingBackendData, setLoadingBackendData] = useState(false);

    // Knowledge Base state
    const [filterTenantId, setFilterTenantId] = useState<string>('');
    const [documents, setDocuments] = useState<any[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [kbStats, setKbStats] = useState<{ document_count: number; collection_name: string } | null>(null);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    // Helpers
    const pickPreferredTenantId = (list: Tenant[]): string => {
        const byId = list.find(t => t.id === '3105b788-b5ff-4d56-88a9-532af4ab4ded');
        if (byId) return byId.id;
        const byName = list.find(t => (t.name || '').toLowerCase() === 'etms');
        if (byName) return byName.id;
        return list[0]?.id || '';
    };

    // Load tenants from backend on component mount
    useEffect(() => {
        const loadBackendData = async () => {
            if (!jwtToken) return;

            setLoadingBackendData(true);
            try {
                const backendTenantsData = await getTenantsFromBackend(jwtToken);
                if (backendTenantsData.length > 0) {
                    setBackendTenants(backendTenantsData);
                    const preferredId = pickPreferredTenantId(backendTenantsData);
                    setFilterTenantId(preferredId);
                }
            } catch (error) {
                console.warn('Failed to load backend data:', error);
            } finally {
                setLoadingBackendData(false);
            }
        };

        loadBackendData();
    }, [jwtToken]);

    const loadDocuments = async () => {
        if (!filterTenantId || !jwtToken) return;

        setLoadingDocs(true);
        try {
            // Load stats
            getKnowledgeBaseStats(filterTenantId, jwtToken).then(response => {
                if (response.success && response.data) {
                    setKbStats({
                        document_count: response.data.document_count,
                        collection_name: response.data.collection_name,
                    });
                }
            });

            // Load documents
            const response = await getAllDocuments(filterTenantId, jwtToken);
            if (response.success && response.data) {
                setDocuments(response.data.documents || []);
            } else {
                setDocuments([]);
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
            setDocuments([]);
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [filterTenantId, jwtToken]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !filterTenantId || !jwtToken) return;

        setUploading(true);
        setUploadStatus(`Processing ${file.name}...`);

        try {
            const response = await uploadDocument({
                tenantId: filterTenantId,
                file: file,
                documentName: file.name,
                jwt: jwtToken,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to upload document');
            }

            setUploadStatus(`✅ Successfully uploaded ${file.name}! (${response.data?.chunk_count} chunks)`);
            loadDocuments();
        } catch (error: any) {
            console.error('File upload failed:', error);
            setUploadStatus(`Error: ${error.message}`);
        } finally {
            setUploading(false);
            setTimeout(() => setUploadStatus(''), 5000);
            // Reset file input
            event.target.value = '';
        }
    };

    const handleDeleteDocument = async (docName: string) => {
        if (!filterTenantId || !jwtToken) return;

        if (!window.confirm(`Are you sure you want to delete all chunks for document "${docName}"?`)) {
            return;
        }

        try {
            // We need to find all chunks with this document name
            // The backend delete endpoint takes IDs, but we have a "delete by name" endpoint too?
            // Checking knowledge.py, there is DELETE /tenants/{tenant_id}/knowledge/by-name/{document_name}
            // But knowledgeService.ts only has deleteDocuments (by IDs).

            // For now, let's filter the documents list to find IDs for this name
            const docsToDelete = documents.filter(d => d.document_name === docName);
            const ids = docsToDelete.map(d => d.doc_id);

            if (ids.length === 0) return;

            const response = await deleteDocuments(filterTenantId, ids, jwtToken);

            if (response.success) {
                alert(`Successfully deleted ${response.data?.details?.deleted_count} chunks.`);
                loadDocuments();
            } else {
                alert(`Failed to delete: ${response.error}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };

    // Group documents by name for display (since we get chunks)
    const uniqueDocuments = React.useMemo(() => {
        const map = new Map();
        documents.forEach(doc => {
            if (!map.has(doc.document_name)) {
                map.set(doc.document_name, {
                    name: doc.document_name,
                    source: doc.source,
                    ingested_at: doc.ingested_at,
                    chunk_count: 1
                });
            } else {
                const existing = map.get(doc.document_name);
                existing.chunk_count++;
            }
        });
        return Array.from(map.values());
    }, [documents]);

    return (
        <AdminLayout>
            <div className="p-6 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage documents and context for AI agents
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select
                            value={filterTenantId}
                            onChange={e => setFilterTenantId(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            {backendTenants.length === 0 ? (
                                <option value="" disabled>Loading tenants...</option>
                            ) : (
                                backendTenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))
                            )}
                        </select>
                        <button
                            onClick={loadDocuments}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            title="Refresh"
                        >
                            <ArrowPathIcon className={`h-5 w-5 ${loadingDocs ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Documents</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                {uniqueDocuments.length}
                            </dd>
                        </div>
                    </div>
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Chunks</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                {kbStats?.document_count || documents.length}
                            </dd>
                        </div>
                    </div>
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Collection Name</dt>
                            <dd className="mt-1 text-lg font-semibold text-gray-900 truncate" title={kbStats?.collection_name}>
                                {kbStats?.collection_name || 'N/A'}
                            </dd>
                        </div>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="bg-white shadow sm:rounded-lg mb-8">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Upload New Document</h3>
                        <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>Upload PDF or DOCX files to enrich the knowledge base. The AI will use these documents to answer user queries.</p>
                        </div>
                        <div className="mt-5">
                            <div className="flex items-center gap-4">
                                <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <span className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                                        <UploadIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                                        Select File
                                    </span>
                                    <input
                                        type="file"
                                        className="sr-only"
                                        accept=".pdf,.docx,.doc,.txt"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                    />
                                </label>
                                {uploading && <span className="text-sm text-gray-500 animate-pulse">Uploading...</span>}
                                {uploadStatus && <span className={`text-sm ${uploadStatus.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>{uploadStatus}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Documents List */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Existing Documents</h3>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {uniqueDocuments.length === 0 ? (
                            <li className="px-4 py-8 text-center text-gray-500">
                                No documents found for this tenant.
                            </li>
                        ) : (
                            uniqueDocuments.map((doc) => (
                                <li key={doc.name}>
                                    <div className="px-4 py-4 flex items-center sm:px-6">
                                        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0">
                                                    <DocumentIcon className="h-8 w-8 text-gray-400" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-indigo-600 truncate">{doc.name}</div>
                                                    <div className="flex mt-1 text-xs text-gray-500">
                                                        <span className="mr-4">
                                                            Ingested: {doc.ingested_at ? new Date(doc.ingested_at).toLocaleDateString() : 'Unknown'}
                                                        </span>
                                                        <span>
                                                            Chunks: {doc.chunk_count}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-5 flex-shrink-0">
                                            <button
                                                onClick={() => handleDeleteDocument(doc.name)}
                                                className="text-red-600 hover:text-red-900 p-2"
                                                title="Delete Document"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>
        </AdminLayout>
    );
};

export default KnowledgeBasePage;
