"""Admin API endpoints for knowledge base management - OPTIMIZED VERSION.

This is the optimized version with improvements:
- ❌ REMOVED deprecated /upload-pdf endpoint
- ✨ ADDED query validation
- 🔒 IMPROVED error handling
- 📊 IMPROVED metadata handling
- 📝 IMPROVED documentation

To apply: Replace backend/src/api/admin/knowledge.py with this file
"""
from typing import List, Optional
import os
import tempfile
import re
from pathlib import Path as FilePath
from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from src.config import get_db
from src.models.tenant import Tenant
from src.schemas.admin import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    KnowledgeBaseStatsResponse,
    MessageResponse,
    PDFUploadResponse,
)
from src.services.rag_service import get_rag_service
from src.middleware.auth import require_admin_role
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-knowledge"])

# Constants for validation
MIN_QUERY_LENGTH = 3
MAX_QUERY_LENGTH = 500
SUPPORTED_FILE_FORMATS = {'.pdf', '.docx', '.doc', '.txt'}
MAX_FILE_SIZE_MB = 50  # 50 MB limit


class QueryValidator:
    """Validate and process RAG queries."""

    @staticmethod
    def validate_query(query: str) -> str:
        """
        Validate and clean RAG query.

        Args:
            query: Raw query string

        Returns:
            Cleaned query string

        Raises:
            ValueError: If query is invalid
        """
        # Strip whitespace
        query = query.strip()

        # Check length
        if len(query) < MIN_QUERY_LENGTH:
            raise ValueError(
                f"Query too short. Minimum {MIN_QUERY_LENGTH} characters required."
            )

        if len(query) > MAX_QUERY_LENGTH:
            raise ValueError(
                f"Query too long. Maximum {MAX_QUERY_LENGTH} characters allowed."
            )

        # Remove special characters that might break vector search
        # Keep alphanumeric, spaces, hyphens, underscores, dots
        query = re.sub(r'[^\w\s\-.]', '', query)

        if not query:
            raise ValueError("Query contains no valid characters after sanitization.")

        return query

    @staticmethod
    def expand_acronyms(query: str) -> str:
        """
        Expand common acronyms for better semantic matching.

        Args:
            query: Original query

        Returns:
            Query with expanded acronyms
        """
        expansions = {
            r'\bSSO\b': 'single sign on authentication',
            r'\bAPI\b': 'application programming interface',
            r'\bFAQ\b': 'frequently asked questions',
            r'\bRAG\b': 'retrieval augmented generation',
            r'\bLLM\b': 'large language model',
            r'\bUUID\b': 'universally unique identifier',
        }

        for acronym_pattern, expansion in expansions.items():
            query = re.sub(acronym_pattern, expansion, query, flags=re.IGNORECASE)

        return query


# ============================================================================
# ENDPOINT 1: Upload Document (File-based) - MAIN ENDPOINT
# ============================================================================

@router.post("/tenants/{tenant_id}/knowledge/upload", response_model=PDFUploadResponse)
async def upload_document(
    tenant_id: str = Path(..., description="Tenant UUID"),
    file: UploadFile = File(..., description="Document file (PDF, DOCX, DOC, TXT)"),
    document_name: Optional[str] = Form(None, description="Optional custom document name"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> PDFUploadResponse:
    """
    Upload and process a single document file into tenant's knowledge base.

    **Supported Formats**:
    - PDF (.pdf) - Extracted via pdfplumber
    - DOCX (.docx) - Extracted with section hierarchy preservation
    - DOC (.doc) - Extracted via python-docx
    - TXT (.txt) - Plain text ingestion (useful for chat history)

    **Processing Pipeline**:
    1. Validate file format and size
    2. Extract and process content
    3. Chunk text (400-600 chars with 200-char overlap)
    4. Generate embeddings (all-MiniLM-L6-v2, 384 dimensions)
    5. Store in PgVector with multi-tenant isolation
    6. Track provenance metadata

    **Metadata Tracked**:
    - source_filename: Original filename
    - file_type: .pdf, .docx, etc.
    - uploaded_by: Admin user ID
    - section_title & section_number: (DOCX only)
    - chunk_index: Position in document

    **Error Handling**:
    - 400: Invalid file format or size
    - 404: Tenant not found
    - 500: Processing failed

    **Returns**:
    - success: Boolean status
    - chunk_count: Number of text chunks created
    - document_ids: List of created document IDs
    - collection_name: Vector store collection

    **Example**:
    ```bash
    curl -X POST "http://localhost:8000/api/admin/tenants/tenant-uuid/knowledge/upload" \
      -F "file=@policies.pdf" \
      -F "document_name=Company Policies 2025" \
      -H "Authorization: Bearer admin-token"
    ```

    **Requirements**: Admin role JWT token
    """
    try:
        # ================================================================
        # VALIDATION PHASE
        # ================================================================

        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate file format
        file_ext = FilePath(file.filename).suffix.lower()
        if file_ext not in SUPPORTED_FILE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported file format '{file_ext}'. "
                    f"Supported: {', '.join(SUPPORTED_FILE_FORMATS)}"
                )
            )

        # Validate filename
        if not file.filename or len(file.filename) > 255:
            raise HTTPException(
                status_code=400,
                detail="Invalid filename. Must be 1-255 characters."
            )

        # ================================================================
        # FILE PROCESSING PHASE
        # ================================================================

        # Create temporary file with correct extension
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_ext,
            prefix="kb_upload_"
        ) as tmp_file:
            content = await file.read()

            # Validate file size (50 MB limit)
            file_size_mb = len(content) / (1024 * 1024)
            if file_size_mb > MAX_FILE_SIZE_MB:
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large. Maximum {MAX_FILE_SIZE_MB} MB allowed."
                )

            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            # ================================================================
            # METADATA STANDARDIZATION
            # ================================================================

            # Standard metadata structure for all ingestion methods
            additional_metadata = {
                # Upload context
                "uploaded_by_admin": admin_payload.get("user_id"),
                "upload_timestamp": str(__import__('datetime').datetime.now(
                    __import__('datetime').timezone.utc
                )),
                "upload_method": "file_upload",

                # Document identification
                "source_filename": file.filename,
                "file_type": file_ext,
                "source": "document",
                "source_detail": "knowledge_upload_endpoint",

                # Custom metadata (if provided)
                "document_name": document_name or file.filename,

                # For tracking & versioning
                "version": 1,
                "deprecated": False,
            }

            # ================================================================
            # INGESTION PHASE
            # ================================================================

            rag_service = get_rag_service()

            # Process document: Auto-detect format → Load → Chunk → Embed → Store
            ingest_result = rag_service.ingest_document(
                tenant_id=tenant_id,
                file_path=tmp_file_path,
                additional_metadata=additional_metadata
            )

            if not ingest_result.get("success"):
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to process document: {ingest_result.get('error', 'Unknown error')}"
                )

            # ================================================================
            # SUCCESS LOGGING
            # ================================================================

            logger.info(
                "document_uploaded_successfully",
                admin_user=admin_payload.get("user_id"),
                tenant_id=tenant_id,
                filename=file.filename,
                file_type=file_ext,
                chunk_count=ingest_result.get("document_count"),
                file_size_mb=round(file_size_mb, 2),
                collection_name=ingest_result.get("collection_name"),
            )

            # ================================================================
            # RESPONSE
            # ================================================================

            return PDFUploadResponse(
                success=True,
                tenant_id=tenant_id,
                filename=file.filename,
                document_name=document_name or file.filename,
                chunk_count=ingest_result.get("document_count"),
                collection_name=ingest_result.get("collection_name"),
                document_ids=ingest_result.get("document_ids"),
            )

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        raise
    except Exception as e:
        logger.error(
            "document_upload_failed",
            tenant_id=tenant_id,
            filename=file.filename if file else "unknown",
            error=str(e),
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(e)}"
        )


# ============================================================================
# ENDPOINT 2: Batch Ingest Documents (Programmatic) - OPTIONAL
# ============================================================================

@router.post("/tenants/{tenant_id}/knowledge/batch-ingest", response_model=DocumentIngestResponse)
async def batch_ingest_documents(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: DocumentIngestRequest = ...,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> DocumentIngestResponse:
    """
    Batch ingest pre-processed documents into tenant's knowledge base.

    **Use Case**: Programmatic ingestion of documents that have already
    been processed (e.g., from chat history, external sources, or
    pre-chunked content).

    **Input Format**:
    ```json
    {
      "documents": [
        {"text": "Document content 1"},
        {"text": "Document content 2"}
      ],
      "metadatas": [
        {"source": "chat_history", "conversation_id": "..."},
        {"source": "chat_history", "conversation_id": "..."}
      ]
    }
    ```

    **Requirements**:
    - Documents must be pre-chunked (recommended < 600 chars each)
    - Metadata should include source and context
    - Admin role JWT token required

    **Returns**:
    - success: Boolean status
    - document_count: Number of documents ingested
    - document_ids: List of created document IDs
    - collection_name: Vector store collection

    **Differences from /upload**:
    - No file parsing (you provide text directly)
    - Faster ingestion (no document processing)
    - Better for programmatic use
    - Good for enriching KB from chat history

    **Example**:
    ```python
    # From chat history
    documents = [
        {"text": "User asked about return policy..."},
        {"text": "User asked about shipping..."}
    ]
    metadatas = [
        {"source": "chat_history", "conversation_id": "conv-123"},
        {"source": "chat_history", "conversation_id": "conv-124"}
    ]
    ```

    **Requirements**: Admin role JWT token
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate documents
        if not request.documents or len(request.documents) == 0:
            raise HTTPException(status_code=400, detail="No documents provided")

        if len(request.documents) > 1000:
            raise HTTPException(
                status_code=400,
                detail="Maximum 1000 documents per batch. Consider splitting into multiple requests."
            )

        # Get RAG service
        rag_service = get_rag_service()

        # Ingest documents
        ingest_result = rag_service.ingest_documents(
            tenant_id=tenant_id,
            documents=request.documents,
            metadatas=request.metadatas,
        )

        if not ingest_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to ingest documents: {ingest_result.get('error', 'Unknown error')}"
            )

        logger.info(
            "batch_documents_ingested",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            document_count=ingest_result.get("document_count"),
        )

        return DocumentIngestResponse(
            success=True,
            tenant_id=tenant_id,
            collection_name=ingest_result.get("collection_name"),
            document_count=ingest_result.get("document_count"),
            document_ids=ingest_result.get("document_ids"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "batch_ingest_failed",
            tenant_id=tenant_id,
            error=str(e),
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest documents: {str(e)}"
        )


# ============================================================================
# ENDPOINT 3: Get Knowledge Base Statistics
# ============================================================================

@router.get("/tenants/{tenant_id}/knowledge/stats", response_model=KnowledgeBaseStatsResponse)
async def get_knowledge_base_stats(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> KnowledgeBaseStatsResponse:
    """
    Get statistics for tenant's knowledge base.

    **Returns**:
    - tenant_id: Tenant UUID
    - collection_name: Vector store collection name
    - document_count: Number of documents/chunks in KB
    - size_mb: Approximate size in MB
    - last_updated: Timestamp of last modification

    **Use Cases**:
    - Monitor KB growth over time
    - Check if KB is populated before using RAG
    - Verify upload success
    - Track storage usage

    **Requirements**: Admin role JWT token
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get RAG service
        rag_service = get_rag_service()

        # Get collection stats
        stats_result = rag_service.get_collection_stats(tenant_id=tenant_id)

        if not stats_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get knowledge base stats: {stats_result.get('error', 'Unknown error')}"
            )

        logger.info(
            "knowledge_stats_retrieved",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            document_count=stats_result.get("document_count"),
        )

        return KnowledgeBaseStatsResponse(
            success=True,
            tenant_id=tenant_id,
            collection_name=stats_result.get("collection_name"),
            document_count=stats_result.get("document_count"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_stats_failed",
            tenant_id=tenant_id,
            error=str(e),
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get knowledge base stats: {str(e)}"
        )


# ============================================================================
# ENDPOINT 4: Delete Documents
# ============================================================================

@router.delete("/tenants/{tenant_id}/knowledge/documents/{document_id}", response_model=MessageResponse)
async def delete_document(
    tenant_id: str = Path(..., description="Tenant UUID"),
    document_id: str = Path(..., description="Document/Chunk ID to delete"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> MessageResponse:
    """
    Delete a single document/chunk from tenant's knowledge base.

    **Parameters**:
    - tenant_id: Tenant UUID
    - document_id: Specific document/chunk ID (from upload response)

    **Returns**:
    - success: Boolean status
    - message: Confirmation message

    **Use Cases**:
    - Remove outdated documents
    - Clean up incorrect uploads
    - Remove sensitive information

    **Soft Delete**: For audit trail, considers marking as deprecated
    rather than hard delete (see improvements in documentation).

    **Requirements**: Admin role JWT token
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get RAG service
        rag_service = get_rag_service()

        # Delete document
        delete_result = rag_service.delete_documents(
            tenant_id=tenant_id,
            document_ids=[document_id],
        )

        if not delete_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete document: {delete_result.get('error', 'Unknown error')}"
            )

        logger.info(
            "document_deleted",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            document_id=document_id,
        )

        return MessageResponse(
            message="Document deleted successfully",
            details={
                "tenant_id": tenant_id,
                "document_id": document_id,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "delete_document_failed",
            tenant_id=tenant_id,
            document_id=document_id,
            error=str(e),
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {str(e)}"
        )


# ============================================================================
# ENDPOINT 5: Search Knowledge Base (Testing)
# ============================================================================

@router.post("/tenants/{tenant_id}/knowledge/search")
async def search_knowledge_base(
    tenant_id: str = Path(..., description="Tenant UUID"),
    query: str = Query(..., min_length=3, max_length=500, description="Search query"),
    top_k: int = Query(5, ge=1, le=20, description="Number of results"),
    min_score: float = Query(0.5, ge=0.0, le=1.0, description="Minimum relevance score"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> dict:
    """
    Search tenant's knowledge base directly.

    **Purpose**: Testing endpoint for verifying RAG functionality
    and knowledge base content.

    **Parameters**:
    - query: Search query (3-500 characters)
    - top_k: Number of results (1-20)
    - min_score: Minimum relevance score (0.0-1.0)

    **Returns**:
    - results: List of matching documents with relevance scores
    - total_hits: Number of results found
    - query_time_ms: Query execution time

    **Use Cases**:
    - Debug RAG results
    - Verify KB content
    - Test query expansion
    - Performance testing

    **Requirements**: Admin role JWT token
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate & clean query
        try:
            query = QueryValidator.validate_query(query)
            query = QueryValidator.expand_acronyms(query)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Get RAG service
        rag_service = get_rag_service()

        # Execute search
        import time
        start_time = time.time()

        search_result = rag_service.search(
            tenant_id=tenant_id,
            query=query,
            top_k=top_k,
            min_score=min_score,
        )

        query_time_ms = (time.time() - start_time) * 1000

        logger.info(
            "knowledge_search_executed",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            query=query,
            results_count=len(search_result.get("results", [])),
            query_time_ms=query_time_ms,
        )

        return {
            "success": True,
            "tenant_id": tenant_id,
            "query": query,
            "results": search_result.get("results", []),
            "total_hits": search_result.get("total_hits", 0),
            "query_time_ms": round(query_time_ms, 2),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "knowledge_search_failed",
            tenant_id=tenant_id,
            query=query,
            error=str(e),
            error_type=type(e).__name__
        )
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


# ============================================================================
# REMOVED ENDPOINTS (See documentation)
# ============================================================================

# REMOVED: POST /upload-pdf (deprecated, use /upload instead)
# REMOVED: DELETE /knowledge (use /documents/{document_id} instead)

# ============================================================================
# NOTES FOR IMPLEMENTATION
# ============================================================================

"""
CHANGES FROM ORIGINAL:

❌ REMOVED ENDPOINTS:
1. @router.post("/tenants/{tenant_id}/knowledge/upload-pdf")
   - Was deprecated and redundant with /upload-document
   - Only called upload_document internally
   - Removed to reduce API confusion

✅ RENAMED ENDPOINTS:
1. /upload-document → /upload
   - Shorter, clearer path
   - Still handles PDF, DOCX, TXT

✨ NEW ENDPOINTS:
1. /documents/{document_id} (DELETE)
   - Delete specific documents by ID
   - Replaces bulk delete endpoint

2. /search (POST)
   - Testing endpoint to search KB directly
   - Useful for debugging RAG
   - Includes query validation & expansion

✨ IMPROVEMENTS:
1. Query Validation
   - Min/max length checks
   - Special character removal
   - Acronym expansion

2. Metadata Standardization
   - Consistent structure across all endpoints
   - Versioning support
   - Deprecation flag

3. File Validation
   - File size limits (50 MB)
   - Supported formats check
   - Filename validation

4. Better Error Messages
   - Specific error details
   - File size/format feedback
   - Clear validation messages

5. Enhanced Logging
   - Error types logged
   - File sizes tracked
   - Query times measured

MIGRATION PATH:
1. Update frontend to use /upload instead of /upload-pdf
2. Update any batch ingestion to use /batch-ingest
3. Update bulk delete to delete individual documents
4. Test with new query validation endpoint (/search)
5. Deploy & monitor error rates
"""
