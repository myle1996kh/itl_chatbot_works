"""Admin API endpoints for knowledge base management."""
from typing import List
import os
import tempfile
from pathlib import Path as FilePath
from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File, Form
from sqlalchemy.orm import Session
from src.config import get_db
from src.models.tenant import Tenant
from src.models.tool import ToolConfig
from src.models.base_tool import BaseTool
from src.schemas.admin import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    KnowledgeBaseStatsResponse,
    MessageResponse,
    PDFUploadResponse,
)
from src.services.rag_service import get_rag_service
from src.middleware.auth import require_admin_role, require_staff_role
from src.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-knowledge"])


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


@router.get("/tenants/{tenant_id}/knowledge/all")
async def get_all_documents_for_tenant(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Get ALL documents from tenant's knowledge base.
    
    Returns a list of all document chunks with metadata.
    Useful for verification after deletion.
    
    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Query database directly
        from sqlalchemy import create_engine, text
        from src.config import settings
        
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT 
                        cmetadata->>'doc_id' as doc_id,
                        cmetadata->>'document_name' as document_name,
                        cmetadata->>'source' as source,
                        cmetadata->>'ingested_at' as ingested_at,
                        LEFT(document, 200) as content_preview
                    FROM langchain_pg_embedding
                    WHERE cmetadata->>'tenant_id' = :tenant_id
                    ORDER BY cmetadata->>'ingested_at' DESC
                    LIMIT 100
                """),
                {"tenant_id": str(tenant_id)}
            )
            
            documents = []
            for row in result:
                documents.append({
                    "doc_id": row.doc_id,
                    "document_name": row.document_name,
                    "source": row.source,
                    "ingested_at": row.ingested_at,
                    "content_preview": row.content_preview
                })

        logger.info(
            "all_documents_listed",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            document_count=len(documents),
        )

        return {
            "success": True,
            "tenant_id": tenant_id,
            "document_count": len(documents),
            "documents": documents
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "get_all_documents_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get all documents: {str(e)}"
        )


@router.delete("/tenants/{tenant_id}/knowledge", response_model=MessageResponse)
async def delete_documents(
    tenant_id: str = Path(..., description="Tenant UUID"),
    document_ids: List[str] = ...,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> MessageResponse:
    """
    Delete documents from tenant's knowledge base by document IDs.

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


@router.delete("/tenants/{tenant_id}/knowledge/by-name/{document_name}", response_model=MessageResponse)
async def delete_documents_by_name(
    tenant_id: str = Path(..., description="Tenant UUID"),
    document_name: str = Path(..., description="Document name to delete"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> MessageResponse:
    """
    Delete documents from tenant's knowledge base by document name.

    This endpoint finds all document chunks associated with a specific document name
    and deletes them from the vector store. The document name is stored in the metadata.

    Args:
        tenant_id: Tenant UUID
        document_name: Name of the document to delete (as stored in document metadata)

    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get RAG service
        rag_service = get_rag_service()

        # First, find all document IDs that match the document name for this tenant
        # We need to query the database to get the doc_id values from metadata
        from sqlalchemy import create_engine, text
        from src.config import settings

        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            # Query to find all document IDs that match the document name
            result = conn.execute(text("""
                SELECT DISTINCT cmetadata->>'doc_id' as doc_id
                FROM langchain_pg_embedding
                WHERE cmetadata->>'tenant_id' = :tenant_id
                AND cmetadata->>'document_name' = :document_name
            """), {
                "tenant_id": tenant_id,
                "document_name": document_name
            })

            document_ids = [row.doc_id for row in result]

        if not document_ids:
            logger.info(
                "no_documents_found_to_delete_by_name",
                tenant_id=tenant_id,
                document_name=document_name
            )
            return MessageResponse(
                message=f"No documents found with name '{document_name}' for tenant",
                details={
                    "tenant_id": tenant_id,
                    "document_name": document_name,
                    "deleted_count": 0,
                }
            )

        # Delete documents by their IDs
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
            "documents_deleted_by_name",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            document_name=document_name,
            deleted_count=delete_result.get("deleted_count"),
        )

        return MessageResponse(
            message=f"Successfully deleted {delete_result.get('deleted_count')} document chunks with name '{document_name}'",
            details={
                "tenant_id": tenant_id,
                "document_name": document_name,
                "deleted_count": delete_result.get("deleted_count"),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "delete_documents_by_name_error",
            tenant_id=tenant_id,
            document_name=document_name,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete documents by name: {str(e)}"
        )


@router.delete("/tenants/{tenant_id}/knowledge/all", response_model=MessageResponse)
async def delete_all_documents_for_tenant(
    tenant_id: str = Path(..., description="Tenant UUID"),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> MessageResponse:
    """
    Delete ALL documents from tenant's knowledge base.

    This endpoint removes all embeddings and document chunks for the specified tenant.

    Args:
        tenant_id: Tenant UUID

    Requires admin role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get RAG service
        rag_service = get_rag_service()

        # Delete all documents for this tenant
        delete_result = rag_service.delete_all_documents_for_tenant(
            tenant_id=tenant_id,
        )

        if not delete_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=delete_result.get("error", "Failed to delete all documents")
            )

        logger.info(
            "all_documents_for_tenant_deleted_by_admin",
            admin_user=admin_payload.get("user_id"),
            tenant_id=tenant_id,
            deleted_count=delete_result.get("deleted_count"),
        )

        return MessageResponse(
            message=f"Successfully deleted all {delete_result.get('deleted_count')} documents for tenant",
            details={
                "tenant_id": tenant_id,
                "deleted_count": delete_result.get("deleted_count"),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "delete_all_documents_for_tenant_error",
            tenant_id=tenant_id,
            error=str(e)
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete all documents for tenant: {str(e)}"
        )


@router.post("/tenants/{tenant_id}/knowledge/upload-document", response_model=PDFUploadResponse)
async def upload_document(
    tenant_id: str = Path(..., description="Tenant UUID"),
    file: UploadFile = File(..., description="Document file to upload (PDF, DOCX)"),
    document_name: str = Form(None, description="Optional document name"),
    db: Session = Depends(get_db),
    staff_payload: dict = Depends(require_staff_role),
) -> PDFUploadResponse:
    """
    Upload and process a document file (PDF, DOCX, or TXT) into tenant's knowledge base.

    Uses the tenant's configured RAG tool settings for chunking parameters if available.
    Falls back to default parameters if no custom configuration is found.

    This endpoint:
    1. Validates the document file (supports .pdf, .docx, .doc, .txt)
    2. Extracts text and splits into chunks using tenant's configured RAG parameters
    3. For DOCX: Tracks section hierarchy and heading structure
    4. Generates embeddings using all-MiniLM-L6-v2 (384 dimensions)
    5. Stores in PgVector with multi-tenant isolation

    Metadata for DOCX files includes:
    - section_title: Current section heading (e.g., "2.3.3. Track and Trace")
    - section_number: Section number (e.g., "2.3.3")
    - file_type: '.docx', '.pdf', or '.txt'
    - paragraph_index: Position in document
    - is_heading: Whether the chunk is a heading

    Use case: .txt files are useful for enriching knowledge base from chat history.

    Requires admin or supporter role in JWT.
    """
    try:
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Find the RAG tool configuration for this tenant to get chunking parameters
        chunk_config = None
        try:
            # Look for RAG tools associated with this tenant
            base_rag_tool = db.query(BaseTool).filter(BaseTool.type == "rag").first()
            if base_rag_tool:
                # Get any RAG tool configuration for this tenant
                rag_tool_config = db.query(ToolConfig).filter(
                    ToolConfig.base_tool_id == base_rag_tool.base_tool_id,
                    ToolConfig.is_active == True
                ).first()

                if rag_tool_config and rag_tool_config.config:
                    # Extract chunking parameters from the tool configuration
                    config_data = rag_tool_config.config
                    chunk_config = {
                        "chunk_size": config_data.get("chunk_size", 900),
                        "chunk_overlap": config_data.get("chunk_overlap", 150),
                        "separators": config_data.get("separators", ["\n\n", "\n", ". ", " ", ""])
                    }
        except Exception as e:
            logger.warning(
                "rag_tool_config_lookup_failed",
                tenant_id=tenant_id,
                error=str(e)
            )

        # Validate file format
        file_ext = FilePath(file.filename).suffix.lower()
        if file_ext not in ['.pdf', '.docx', '.doc', '.txt']:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_ext}. Supported: .pdf, .docx, .doc, .txt"
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
                "uploaded_by": staff_payload.get("user_id") or staff_payload.get("sub"),
                "uploaded_by_role": staff_payload.get("role") or ("admin" if "admin" in staff_payload.get("roles", []) else "supporter"),
                "original_filename": file.filename,
                # Mark provenance so sources can be distinguished in vector store
                "source": "chat_history" if file.filename.endswith("-enrichment.txt") else "document",
                "source_detail": "chat_enrichment" if file.filename.endswith("-enrichment.txt") else "upload_document",
            }
            if document_name:
                additional_metadata["document_name"] = document_name

            # Process document: Auto-detect format → Load → Chunk → Enrich → Embed → Store
            ingest_result = rag_service.ingest_document(
                tenant_id=tenant_id,
                file_path=tmp_file_path,
                additional_metadata=additional_metadata,
                chunk_config=chunk_config  # Pass the chunk configuration
            )

            if not ingest_result.get("success"):
                raise HTTPException(
                    status_code=500,
                    detail=ingest_result.get("error", "Failed to process document")
                )

            logger.info(
                "document_uploaded_by_staff",
                staff_user=staff_payload.get("user_id") or staff_payload.get("sub"),
                staff_role=staff_payload.get("role") or ("admin" if "admin" in staff_payload.get("roles", []) else "supporter"),
                tenant_id=tenant_id,
                filename=file.filename,
                file_type=file_ext,
                chunk_count=ingest_result.get("document_count"),
                chunk_size=chunk_config.get("chunk_size") if chunk_config else "default",
                chunk_overlap=chunk_config.get("chunk_overlap") if chunk_config else "default",
                source=additional_metadata.get("source")
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

