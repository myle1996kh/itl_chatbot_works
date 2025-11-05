"""Admin API endpoints for knowledge base management."""
from typing import List
import os
import tempfile
from pathlib import Path as FilePath
from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File, Form
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


@router.post("/tenants/{tenant_id}/knowledge", response_model=DocumentIngestResponse)
async def ingest_documents(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: DocumentIngestRequest = ...,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> DocumentIngestResponse:
    """
    Ingest documents into tenant's knowledge base.

    This creates a tenant-specific ChromaDB collection and adds documents
    for later retrieval by AgentAnalysis via RAG.

    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get RAG service
        rag_service = get_rag_service()

        # Create collection if it doesn't exist
        collection_result = rag_service.create_tenant_collection(
            tenant_id=tenant_id,
            metadata={"created_by_admin": admin_payload.get("user_id")}
        )

        if not collection_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=collection_result.get("error", "Failed to create collection")
            )

        # Ingest documents
        ingest_result = rag_service.ingest_documents(
            tenant_id=tenant_id,
            documents=request.documents,
            metadatas=request.metadatas,
        )

        if not ingest_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=ingest_result.get("error", "Failed to ingest documents")
            )

        logger.info(
            "documents_ingested_by_admin",
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
            "ingest_documents_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest documents: {str(e)}"
        )


@router.get("/tenants/{tenant_id}/knowledge/stats", response_model=KnowledgeBaseStatsResponse)
async def get_knowledge_base_stats(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> KnowledgeBaseStatsResponse:
    """
    Get statistics for tenant's knowledge base.

    Returns document count and collection information.

    Requires admin role in JWT.
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
                detail=stats_result.get("error", "Failed to get collection stats")
            )

        logger.info(
            "knowledge_base_stats_retrieved",
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
            "get_knowledge_base_stats_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get knowledge base stats: {str(e)}"
        )


@router.delete("/tenants/{tenant_id}/knowledge", response_model=MessageResponse)
async def delete_documents(
    tenant_id: str = Path(..., description="Tenant UUID"),
    document_ids: List[str] = ...,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> MessageResponse:
    """
    Delete documents from tenant's knowledge base.

    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get RAG service
        rag_service = get_rag_service()

        # Delete documents
        delete_result = rag_service.delete_documents(
            tenant_id=tenant_id,
            document_ids=document_ids,
        )

        if not delete_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=delete_result.get("error", "Failed to delete documents")
            )

        logger.info(
            "documents_deleted_by_admin",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            deleted_count=delete_result.get("deleted_count"),
        )

        return MessageResponse(
            message="Successfully deleted documents",
            details={
                "tenant_id": tenant_id,
                "deleted_count": delete_result.get("deleted_count"),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "delete_documents_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete documents: {str(e)}"
        )


@router.post("/tenants/{tenant_id}/knowledge/upload-document", response_model=PDFUploadResponse)
async def upload_document(
    tenant_id: str = Path(..., description="Tenant UUID"),
    file: UploadFile = File(..., description="Document file to upload (PDF, DOCX)"),
    document_name: str = Form(None, description="Optional document name"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> PDFUploadResponse:
    """
    Upload and process a document file (PDF or DOCX) into tenant's knowledge base.

    This endpoint:
    1. Validates the document file (supports .pdf, .docx, .doc)
    2. Extracts text and splits into chunks (400 chars, 200 overlap)
    3. For DOCX: Tracks section hierarchy and heading structure
    4. Generates embeddings using all-MiniLM-L6-v2 (384 dimensions)
    5. Stores in PgVector with multi-tenant isolation

    Metadata for DOCX files includes:
    - section_title: Current section heading (e.g., "2.3.3. Track and Trace")
    - section_number: Section number (e.g., "2.3.3")
    - file_type: '.docx' or '.pdf'
    - paragraph_index: Position in document
    - is_heading: Whether the chunk is a heading

    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Validate file format
        file_ext = FilePath(file.filename).suffix.lower()
        if file_ext not in ['.pdf', '.docx', '.doc']:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_ext}. Supported: .pdf, .docx, .doc"
            )

        # Get RAG service
        rag_service = get_rag_service()

        # Save uploaded file to temporary location with correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            # Read file content
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            # Prepare metadata
            additional_metadata = {
                "uploaded_by_admin": admin_payload.get("user_id"),
                "original_filename": file.filename,
            }
            if document_name:
                additional_metadata["document_name"] = document_name

            # Process document: Auto-detect format → Load → Chunk → Enrich → Embed → Store
            ingest_result = rag_service.ingest_document(
                tenant_id=tenant_id,
                file_path=tmp_file_path,
                additional_metadata=additional_metadata
            )

            if not ingest_result.get("success"):
                raise HTTPException(
                    status_code=500,
                    detail=ingest_result.get("error", "Failed to process document")
                )

            logger.info(
                "document_uploaded_by_admin",
                admin_user=admin_payload.get("user_id"),
                tenant_id=tenant_id,
                filename=file.filename,
                file_type=file_ext,
                chunk_count=ingest_result.get("document_count"),
            )

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
        raise
    except Exception as e:
        logger.error(
            "upload_document_error",
            tenant_id=tenant_id,
            filename=file.filename if file else "unknown",
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.post("/tenants/{tenant_id}/knowledge/upload-pdf", response_model=PDFUploadResponse)
async def upload_pdf(
    tenant_id: str = Path(..., description="Tenant UUID"),
    file: UploadFile = File(..., description="PDF file to upload"),
    document_name: str = Form(None, description="Optional document name"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> PDFUploadResponse:
    """
    Upload and process a PDF file into tenant's knowledge base.

    DEPRECATED: Use /upload-document instead for universal file support (PDF, DOCX).
    This endpoint is kept for backward compatibility.

    Requires admin role in JWT.
    """
    logger.warning(
        "upload_pdf_deprecated",
        message="upload_pdf endpoint is deprecated, use upload_document instead"
    )
    return await upload_document(tenant_id, file, document_name, db, admin_payload)
