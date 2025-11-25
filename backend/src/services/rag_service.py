"""RAG Service for managing tenant-specific knowledge bases with PgVector.

This service provides:
- Multi-tenant knowledge base management using PostgreSQL + pgvector
- Document ingestion with automatic embedding generation
- Similarity search using cosine distance
- LangChain integration for RAG pipelines
"""
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
from langchain_postgres import PGVector
from langchain_postgres.vectorstores import DistanceStrategy
from langchain_core.documents import Document
from sqlalchemy import create_engine, text
from src.config import settings
from src.services.embedding_service import get_embedding_service
from src.services.document_processor import get_document_processor
from src.utils.logging import get_logger
from src.utils.exceptions import SecurityError
from src.utils.metrics import rag_cross_tenant_leak_counter

logger = get_logger(__name__)


class RAGService:
    """Service for managing PgVector-based knowledge bases with multi-tenant isolation."""

    def __init__(self):
        """
        Initialize RAG Service with PgVector backend.

        Uses:
            - PostgreSQL + pgvector for vector storage
            - LangChain PGVector for vector store operations
            - Sentence-transformers for embeddings (all-MiniLM-L6-v2, 384 dimensions)
        """
        try:
            # Get embedding service (singleton, cached model)
            self.embedding_service = get_embedding_service()

            # Get document processor
            self.doc_processor = get_document_processor()

            # Database connection
            self.connection_string = settings.DATABASE_URL
            self.engine = create_engine(self.connection_string)

            # Collection name (single table for all tenants, isolated by tenant_id)
            self.collection_name = "knowledge_documents"

            logger.info(
                "rag_service_initialized",
                backend="pgvector",
                embedding_model=self.embedding_service.model_name,
                embedding_dimension=self.embedding_service.dimension,
                collection_name=self.collection_name
            )
        except Exception as e:
            logger.error(
                "rag_service_init_failed",
                backend="pgvector",
                error=str(e)
            )
            raise

    def _get_vector_store(self, tenant_id: str) -> PGVector:
        """
        Get PGVector store instance with tenant-specific filtering.

        Args:
            tenant_id: Tenant UUID for isolation

        Returns:
            PGVector instance configured for this tenant

        Note:
            Multi-tenancy is handled via metadata filtering on tenant_id.
            All tenants share the same table but queries are isolated.
        """
        try:
            # Create PGVector store with tenant-specific pre-filter
            vector_store = PGVector(
                embeddings=self.embedding_service,
                collection_name=self.collection_name,
                connection=self.connection_string,
                distance_strategy=DistanceStrategy.COSINE,
                pre_delete_collection=False,  # Don't auto-drop table
                use_jsonb=True  # Use JSONB for metadata
            )

            logger.debug(
                "vector_store_initialized",
                tenant_id=tenant_id,
                collection_name=self.collection_name
            )

            return vector_store

        except Exception as e:
            logger.error(
                "vector_store_init_failed",
                tenant_id=tenant_id,
                error=str(e)
            )
            raise

    def get_collection_name(self, tenant_id: str) -> str:
        """
        Get standardized collection name for tenant.

        Args:
            tenant_id: Tenant UUID

        Returns:
            Collection name (now same for all tenants: knowledge_documents)

        Note:
            With PgVector, all tenants share the same table.
            Isolation is via WHERE tenant_id = ? in queries.
        """
        return self.collection_name

    def create_tenant_collection(
        self,
        tenant_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create or get a tenant-specific collection.

        Args:
            tenant_id: Tenant UUID
            metadata: Optional collection metadata (not used in PgVector, kept for API compatibility)

        Returns:
            Dictionary with collection info

        Note:
            In PgVector, collection creation is automatic. This method exists
            for backward compatibility with ChromaDB API.
        """
        collection_name = self.get_collection_name(tenant_id)

        try:
            # Verify database connection
            with self.engine.connect() as conn:
                # Check if pgvector extension exists
                result = conn.execute(text(
                    "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
                ))
                if not result.fetchone():
                    raise RuntimeError("pgvector extension not installed")

            logger.info(
                "tenant_collection_ready",
                tenant_id=tenant_id,
                collection_name=collection_name,
            )

            return {
                "success": True,
                "collection_name": collection_name,
                "tenant_id": tenant_id,
            }

        except Exception as e:
            logger.error(
                "create_tenant_collection_failed",
                tenant_id=tenant_id,
                collection_name=collection_name,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to create collection: {str(e)}",
            }

    def ingest_documents(
        self,
        tenant_id: str,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Ingest documents into tenant's knowledge base.

        Args:
            tenant_id: Tenant UUID
            documents: List of document texts
            metadatas: Optional list of metadata dicts (one per document)
            ids: Optional list of document IDs (stored in metadata as 'doc_id')

        Returns:
            Dictionary with ingestion results
        """
        collection_name = self.get_collection_name(tenant_id)

        try:
            # Generate IDs if not provided
            if ids is None:
                ids = [str(uuid.uuid4()) for _ in documents]

            # Ensure metadatas list exists
            if metadatas is None:
                metadatas = [{} for _ in documents]

            # Add tenant_id and doc_id to all metadata
            for i, metadata in enumerate(metadatas):
                metadata["tenant_id"] = str(tenant_id)
                metadata["doc_id"] = ids[i]
                metadata["ingested_at"] = datetime.utcnow().isoformat()

            # Create LangChain Document objects
            langchain_docs = [
                Document(page_content=doc, metadata=meta)
                for doc, meta in zip(documents, metadatas)
            ]

            # Get vector store
            vector_store = self._get_vector_store(tenant_id)

            # Add documents to PgVector
            vector_store.add_documents(langchain_docs)

            logger.info(
                "documents_ingested",
                tenant_id=tenant_id,
                collection_name=collection_name,
                document_count=len(documents),
            )

            return {
                "success": True,
                "tenant_id": tenant_id,
                "collection_name": collection_name,
                "document_count": len(documents),
                "document_ids": ids,
            }

        except Exception as e:
            logger.error(
                "ingest_documents_failed",
                tenant_id=tenant_id,
                collection_name=collection_name,
                document_count=len(documents),
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to ingest documents: {str(e)}",
            }

    def query_knowledge_base(
        self,
        tenant_id: str,
        query: str,
        top_k: int = 5,
        section_filter: Optional[str] = None,
        include_section_context: bool = True,
        expand_to_full_section: bool = False,
        enforce_validation: bool = True,
        chunk_config: Optional[Dict[str, Any]] = None,
        embedding_config: Optional[Dict[str, Any]] = None,
        distance_strategy: str = "COSINE"
    ) -> Dict[str, Any]:
        """
        Query tenant's knowledge base using similarity search with optional section filtering and custom config.

        Args:
            tenant_id: Tenant UUID
            query: Search query
            top_k: Number of results to return
            section_filter: Optional section title/number filter (e.g., "Track and Trace" or "2.3.3")
            include_section_context: Whether to format results with section context for LLM
            expand_to_full_section: If True and top results are from same section, return ALL chunks from that section
            enforce_validation: If True, raise SecurityError on cross-tenant leak; if False, filter out invalid docs
            chunk_config: Optional chunking config (chunk_size, chunk_overlap, separators)
            embedding_config: Optional embedding config (model, dimension)
            distance_strategy: Distance metric: COSINE, EUCLIDEAN, or INNER_PRODUCT

        Returns:
            Dictionary with query results

        Example:
            >>> # Strategy A: Top-K only (for specific facts)
            >>> result = rag_service.query_knowledge_base(
            ...     tenant_id="...",
            ...     query="What is container size limit?",
            ...     top_k=5
            ... )

            >>> # Strategy B: Full section context (for procedures)
            >>> result = rag_service.query_knowledge_base(
            ...     tenant_id="...",
            ...     query="How to create LCL booking?",
            ...     expand_to_full_section=True  # Get all chunks if same section
            ... )
        """
        collection_name = self.get_collection_name(tenant_id)

        try:
            # Check if using custom embedding model (ignore dimension parameter if provided)
            custom_model = embedding_config.get("model") if embedding_config else None
            default_model = self.embedding_service.model_name

            # Only use custom embedding if model is different from default
            if custom_model and custom_model != default_model:
                from src.services.embedding_service import EmbeddingService

                try:
                    # Create custom embedding service
                    custom_embedding_service = EmbeddingService(
                        model_name=custom_model
                    )

                    # Map distance strategy string to enum
                    distance_map = {
                        "COSINE": DistanceStrategy.COSINE,
                        "EUCLIDEAN": DistanceStrategy.EUCLIDEAN,
                        "INNER_PRODUCT": DistanceStrategy.INNER_PRODUCT
                    }

                    # Get the distance strategy enum
                    selected_distance = distance_map.get(distance_strategy, DistanceStrategy.COSINE)

                    # Create vector store with custom embedding and distance strategy
                    vector_store = PGVector(
                        embeddings=custom_embedding_service,
                        collection_name=self.collection_name,
                        connection=self.connection_string,
                        distance_strategy=selected_distance,
                        pre_delete_collection=False,
                        use_jsonb=True
                    )

                    logger.debug(
                        "using_custom_embedding_config",
                        tenant_id=tenant_id,
                        embedding_model=custom_model,
                        embedding_dimension=custom_embedding_service.dimension,
                        distance_strategy=distance_strategy
                    )

                except Exception as e:
                    logger.error(
                        "custom_embedding_init_failed",
                        tenant_id=tenant_id,
                        model=custom_model,
                        error=str(e)
                    )
                    raise
            else:
                # Use default vector store with default embedding service
                vector_store = self._get_vector_store(tenant_id)

            # Build metadata filter
            metadata_filter = {"tenant_id": str(tenant_id)}

            # Add section filter if provided
            if section_filter:
                # Try to match section_title or section_number
                # This uses JSONB containment in PostgreSQL
                metadata_filter["section_title"] = {"$like": f"%{section_filter}%"}

                logger.debug(
                    "query_with_section_filter",
                    tenant_id=tenant_id,
                    section_filter=section_filter
                )

            # Query with filters
            raw_results = vector_store.similarity_search_with_score(
                query=query,
                k=top_k,
                filter=metadata_filter
            )

            # ✅ Post-query validation (defense in depth against cross-tenant leaks)
            validated_results = []
            for doc, score in raw_results:
                doc_tenant_id = doc.metadata.get("tenant_id")

                # Validate tenant_id match
                if doc_tenant_id != str(tenant_id):
                    # Log security event
                    logger.error(
                        "rag_cross_tenant_leak_detected",
                        extra={
                            "expected_tenant_id": str(tenant_id),
                            "actual_tenant_id": doc_tenant_id,
                            "document_id": doc.metadata.get("doc_id"),
                            "query_preview": query[:100],
                            "score": score,
                        },
                    )

                    # Increment monitoring counter
                    rag_cross_tenant_leak_counter.labels(
                        tenant_id=str(tenant_id), leak_source="pgvector"
                    ).inc()

                    # Enforce validation policy
                    if enforce_validation:
                        raise SecurityError(
                            f"Cross-tenant document leak detected in RAG query. "
                            f"Expected tenant {tenant_id}, got {doc_tenant_id}. "
                            "This incident has been logged.",
                            details={
                                "expected_tenant_id": str(tenant_id),
                                "actual_tenant_id": doc_tenant_id,
                                "document_id": doc.metadata.get("doc_id"),
                            },
                        )
                    else:
                        # Skip invalid document (fail-open mode)
                        logger.warning(
                            "rag_cross_tenant_leak_filtered",
                            extra={
                                "expected_tenant_id": str(tenant_id),
                                "actual_tenant_id": doc_tenant_id,
                                "enforce_validation": False,
                            },
                        )
                        continue

                validated_results.append((doc, score))

            # Use validated results for remaining processing
            results = validated_results

            # Check if we should expand to full section
            should_expand = False
            dominant_section = None

            if expand_to_full_section and len(results) >= 2:
                # Count sections in top results
                section_counts = {}
                for doc, _ in results[:3]:  # Check top 3
                    section = doc.metadata.get('section_title')
                    if section and section != 'Unknown':
                        section_counts[section] = section_counts.get(section, 0) + 1

                # If 2+ of top 3 are from same section, expand
                if section_counts:
                    dominant_section, count = max(section_counts.items(), key=lambda x: x[1])
                    if count >= 2:
                        should_expand = True

                        logger.info(
                            "expanding_to_full_section",
                            tenant_id=tenant_id,
                            section=dominant_section,
                            original_results=len(results)
                        )

            # Expand to full section if needed
            if should_expand and dominant_section:
                # Query for ALL chunks from this section
                full_section_raw_results = vector_store.similarity_search_with_score(
                    query=query,
                    k=100,  # High limit to get all chunks
                    filter={
                        "tenant_id": str(tenant_id),
                        "section_title": dominant_section
                    }
                )

                # Validate full section results
                full_section_validated = []
                for doc, score in full_section_raw_results:
                    doc_tenant_id = doc.metadata.get("tenant_id")
                    if doc_tenant_id != str(tenant_id):
                        logger.error(
                            "rag_cross_tenant_leak_detected_full_section",
                            extra={
                                "expected_tenant_id": str(tenant_id),
                                "actual_tenant_id": doc_tenant_id,
                                "document_id": doc.metadata.get("doc_id"),
                            },
                        )
                        rag_cross_tenant_leak_counter.labels(
                            tenant_id=str(tenant_id), leak_source="pgvector"
                        ).inc()
                        if enforce_validation:
                            raise SecurityError(
                                f"Cross-tenant document leak in full section query. "
                                f"Expected tenant {tenant_id}, got {doc_tenant_id}.",
                                details={
                                    "expected_tenant_id": str(tenant_id),
                                    "actual_tenant_id": doc_tenant_id,
                                    "document_id": doc.metadata.get("doc_id"),
                                },
                            )
                        continue
                    full_section_validated.append((doc, score))

                full_section_results = full_section_validated

                # Sort by paragraph_index or chunk_index for sequential reading
                full_section_results = sorted(
                    full_section_results,
                    key=lambda x: (
                        x[0].metadata.get('paragraph_index', 0),
                        x[0].metadata.get('chunk_index', 0)
                    )
                )

                # Use full section instead of top-k
                results = full_section_results

                logger.info(
                    "full_section_retrieved",
                    tenant_id=tenant_id,
                    section=dominant_section,
                    chunk_count=len(results)
                )

            # Format results
            documents = []
            for i, (doc, score) in enumerate(results):
                # Base result structure
                result_doc = {
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "distance": float(score),  # Cosine distance (0 = identical, 2 = opposite)
                    "rank": i + 1,
                }

                # Add formatted context for LLM if requested
                if include_section_context:
                    section_title = doc.metadata.get('section_title', 'Unknown')
                    section_number = doc.metadata.get('section_number')
                    file_type = doc.metadata.get('file_type', 'unknown')

                    # Format section header
                    if section_number and section_title != 'Unknown':
                        section_header = f"[Section {section_number}: {section_title}]"
                    elif section_title != 'Unknown':
                        section_header = f"[Section: {section_title}]"
                    else:
                        section_header = "[Section: Not specified]"

                    # Add formatted content with section context
                    result_doc["formatted_content"] = f"{section_header}\n\n{doc.page_content}"

                    # Add source info
                    if 'source' in doc.metadata:
                        from pathlib import Path
                        filename = Path(doc.metadata['source']).name
                        result_doc["source_display"] = f"{filename} ({file_type})"

                documents.append(result_doc)

            logger.info(
                "knowledge_base_queried",
                tenant_id=tenant_id,
                collection_name=collection_name,
                query_length=len(query),
                results_count=len(documents),
                section_filter=section_filter,
                include_section_context=include_section_context
            )

            return {
                "success": True,
                "tenant_id": tenant_id,
                "query": query,
                "documents": documents,
                "total_results": len(documents),
                "section_filter": section_filter,
                "expanded_to_full_section": should_expand,
                "expanded_section": dominant_section if should_expand else None
            }

        except SecurityError:
            # Re-raise SecurityError without catching (let it propagate to FastAPI handler)
            raise
        except Exception as e:
            logger.error(
                "query_knowledge_base_failed",
                tenant_id=tenant_id,
                collection_name=collection_name,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to query knowledge base: {str(e)}",
                "documents": [],
            }

    def delete_documents(
        self,
        tenant_id: str,
        document_ids: List[str],
    ) -> Dict[str, Any]:
        """
        Delete documents from tenant's knowledge base.

        Args:
            tenant_id: Tenant UUID
            document_ids: List of document IDs to delete (stored in metadata as 'doc_id')

        Returns:
            Dictionary with deletion results
        """
        collection_name = self.get_collection_name(tenant_id)

        try:
            # Use raw SQL to delete by metadata filter
            # PGVector stores metadata as JSONB, so we filter by tenant_id AND doc_id
            with self.engine.connect() as conn:
                for doc_id in document_ids:
                    result = conn.execute(
                        text("""
                            DELETE FROM langchain_pg_embedding
                            WHERE cmetadata->>'tenant_id' = :tenant_id
                            AND cmetadata->>'doc_id' = :doc_id
                        """),
                        {"tenant_id": str(tenant_id), "doc_id": doc_id}
                    )
                    conn.commit()

            logger.info(
                "documents_deleted",
                tenant_id=tenant_id,
                collection_name=collection_name,
                deleted_count=len(document_ids),
            )

            return {
                "success": True,
                "tenant_id": tenant_id,
                "deleted_count": len(document_ids),
            }

        except Exception as e:
            logger.error(
                "delete_documents_failed",
                tenant_id=tenant_id,
                collection_name=collection_name,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to delete documents: {str(e)}",
            }

    def delete_all_documents_for_tenant(
        self,
        tenant_id: str,
    ) -> Dict[str, Any]:
        """
        Delete ALL documents from tenant's knowledge base.

        Args:
            tenant_id: Tenant UUID

        Returns:
            Dictionary with deletion results
        """
        collection_name = self.get_collection_name(tenant_id)

        try:
            # Use raw SQL to delete by metadata filter
            # PGVector stores metadata as JSONB, so we filter by tenant_id only
            with self.engine.connect() as conn:
                result = conn.execute(
                    text("""
                        DELETE FROM langchain_pg_embedding
                        WHERE cmetadata->>'tenant_id' = :tenant_id
                    """),
                    {"tenant_id": str(tenant_id)}
                )
                conn.commit()

                # Get the number of rows affected
                deleted_count = result.rowcount

            logger.info(
                "all_documents_for_tenant_deleted",
                tenant_id=tenant_id,
                collection_name=collection_name,
                deleted_count=deleted_count,
            )

            return {
                "success": True,
                "tenant_id": tenant_id,
                "deleted_count": deleted_count,
            }

        except Exception as e:
            logger.error(
                "delete_all_documents_for_tenant_failed",
                tenant_id=tenant_id,
                collection_name=collection_name,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to delete all documents for tenant: {str(e)}",
            }

    def get_collection_stats(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get statistics for tenant's collection.

        Args:
            tenant_id: Tenant UUID

        Returns:
            Dictionary with collection statistics
        """
        collection_name = self.get_collection_name(tenant_id)

        try:
            # Count documents for this tenant
            with self.engine.connect() as conn:
                result = conn.execute(
                    text("""
                        SELECT COUNT(*) as count
                        FROM langchain_pg_embedding
                        WHERE cmetadata->>'tenant_id' = :tenant_id
                    """),
                    {"tenant_id": str(tenant_id)}
                )
                count = result.fetchone()[0]

            logger.info(
                "collection_stats_retrieved",
                tenant_id=tenant_id,
                collection_name=collection_name,
                document_count=count,
            )

            return {
                "success": True,
                "tenant_id": tenant_id,
                "collection_name": collection_name,
                "document_count": count,
            }

        except Exception as e:
            logger.error(
                "get_collection_stats_failed",
                tenant_id=tenant_id,
                collection_name=collection_name,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to get collection stats: {str(e)}",
            }

    def ingest_document(
        self,
        tenant_id: str,
        file_path: str,
        additional_metadata: Optional[Dict[str, Any]] = None,
        chunk_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process and ingest ANY supported document (PDF, DOCX) into tenant's knowledge base.

        Auto-detects file format and uses appropriate processor.

        Args:
            tenant_id: Tenant UUID
            file_path: Path to document file (.pdf, .docx, or .doc)
            additional_metadata: Optional metadata to add to all chunks
            chunk_config: Optional chunking config (chunk_size, chunk_overlap, separators)

        Returns:
            Dictionary with ingestion results

        Supported formats:
            - .pdf: Page-based extraction
            - .docx/.doc: Paragraph-based with section tracking
        """
        try:
            from pathlib import Path
            file_ext = Path(file_path).suffix.lower()

            logger.info(
                "document_ingestion_started",
                tenant_id=tenant_id,
                file_path=file_path,
                file_type=file_ext
            )

            # Process document: Load → Chunk → Enrich (with section metadata for DOCX)
            chunks = self.doc_processor.process_document(
                file_path=file_path,
                tenant_id=tenant_id,
                additional_metadata=additional_metadata,
                chunk_config=chunk_config  # Pass the configuration
            )

            # Extract texts and metadatas (metadata includes section_title, section_number for DOCX)
            documents = [chunk.page_content for chunk in chunks]
            metadatas = [chunk.metadata for chunk in chunks]

            # Ingest into vector store
            result = self.ingest_documents(
                tenant_id=tenant_id,
                documents=documents,
                metadatas=metadatas
            )

            if result["success"]:
                if chunk_config:
                    logger.info(
                        "document_ingestion_completed_with_custom_config",
                        tenant_id=tenant_id,
                        file_path=file_path,
                        file_type=file_ext,
                        chunk_count=len(chunks),
                        chunk_size=chunk_config.get('chunk_size', self.doc_processor.chunk_size),
                        chunk_overlap=chunk_config.get('chunk_overlap', self.doc_processor.chunk_overlap)
                    )
                else:
                    logger.info(
                        "document_ingestion_completed",
                        tenant_id=tenant_id,
                        file_path=file_path,
                        file_type=file_ext,
                        chunk_count=len(chunks)
                    )

            return result

        except Exception as e:
            logger.error(
                "document_ingestion_failed",
                tenant_id=tenant_id,
                file_path=file_path,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Failed to ingest document: {str(e)}",
            }

    def ingest_pdf(
        self,
        tenant_id: str,
        pdf_path: str,
        additional_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process and ingest a PDF file into tenant's knowledge base.

        DEPRECATED: Use ingest_document() instead for universal file support.
        This method is kept for backward compatibility.

        Args:
            tenant_id: Tenant UUID
            pdf_path: Path to PDF file
            additional_metadata: Optional metadata to add to all chunks

        Returns:
            Dictionary with ingestion results
        """
        logger.warning(
            "ingest_pdf_deprecated",
            message="ingest_pdf() is deprecated, use ingest_document() instead"
        )
        return self.ingest_document(tenant_id, pdf_path, additional_metadata)


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """
    Get or create RAG service singleton.

    Returns:
        RAGService instance
    """
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
        logger.info("rag_service_singleton_created")
    return _rag_service
