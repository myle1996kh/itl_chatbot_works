"""Unit tests for RAG post-query validation and cross-tenant leak detection."""
import pytest
from unittest.mock import MagicMock, patch, Mock
from langchain_core.documents import Document
from src.services.rag_service import RAGService
from src.utils.exceptions import SecurityError


class TestRAGPostQueryValidation:
    """Test RAG service post-query validation for cross-tenant leak prevention."""

    @pytest.fixture
    def mock_rag_service(self):
        """Create RAGService with mocked dependencies."""
        with patch("src.services.rag_service.get_embedding_service"), \
             patch("src.services.rag_service.get_document_processor"), \
             patch("src.services.rag_service.create_engine"):
            service = RAGService()
            return service

    @pytest.fixture
    def mock_vector_store(self):
        """Create mock vector store."""
        mock_store = MagicMock()
        return mock_store

    def test_query_returns_only_matching_tenant_documents(self, mock_rag_service, mock_vector_store):
        """Test normal query returns only documents matching tenant_id."""
        tenant_id = "tenant-123"

        # Mock results with correct tenant_id
        mock_results = [
            (
                Document(
                    page_content="Test document 1",
                    metadata={"tenant_id": tenant_id, "doc_id": "doc-1"}
                ),
                0.15
            ),
            (
                Document(
                    page_content="Test document 2",
                    metadata={"tenant_id": tenant_id, "doc_id": "doc-2"}
                ),
                0.25
            ),
        ]

        mock_vector_store.similarity_search_with_score.return_value = mock_results

        with patch.object(mock_rag_service, "_get_vector_store", return_value=mock_vector_store):
            result = mock_rag_service.query_knowledge_base(
                tenant_id=tenant_id,
                query="test query",
                top_k=5
            )

        # Verify success
        assert result["success"] is True
        assert result["total_results"] == 2
        assert len(result["documents"]) == 2

        # Verify all documents have correct tenant_id
        for doc in result["documents"]:
            assert doc["metadata"]["tenant_id"] == tenant_id

    def test_query_raises_security_error_on_cross_tenant_leak(self, mock_rag_service, mock_vector_store):
        """Test query raises SecurityError when cross-tenant document detected."""
        tenant_id = "tenant-123"
        wrong_tenant_id = "tenant-999"

        # Mock results with WRONG tenant_id
        mock_results = [
            (
                Document(
                    page_content="Test document 1",
                    metadata={"tenant_id": tenant_id, "doc_id": "doc-1"}
                ),
                0.15
            ),
            (
                Document(
                    page_content="Leaked document",
                    metadata={"tenant_id": wrong_tenant_id, "doc_id": "doc-leaked"}
                ),
                0.20
            ),
        ]

        mock_vector_store.similarity_search_with_score.return_value = mock_results

        with patch.object(mock_rag_service, "_get_vector_store", return_value=mock_vector_store), \
             patch("src.services.rag_service.rag_cross_tenant_leak_counter") as mock_counter:

            # Should raise SecurityError
            with pytest.raises(SecurityError) as exc_info:
                mock_rag_service.query_knowledge_base(
                    tenant_id=tenant_id,
                    query="test query",
                    top_k=5,
                    enforce_validation=True  # Strict mode
                )

            # Verify error message
            assert "Cross-tenant document leak detected" in str(exc_info.value)
            assert tenant_id in str(exc_info.value)
            assert wrong_tenant_id in str(exc_info.value)

            # Verify error details
            assert exc_info.value.details["expected_tenant_id"] == tenant_id
            assert exc_info.value.details["actual_tenant_id"] == wrong_tenant_id
            assert exc_info.value.details["document_id"] == "doc-leaked"

            # Verify Prometheus counter incremented
            mock_counter.labels.assert_called_with(
                tenant_id=tenant_id,
                leak_source="pgvector"
            )
            mock_counter.labels.return_value.inc.assert_called_once()

    def test_query_filters_invalid_docs_in_fail_open_mode(self, mock_rag_service, mock_vector_store):
        """Test query filters out invalid documents when enforce_validation=False."""
        tenant_id = "tenant-123"
        wrong_tenant_id = "tenant-999"

        # Mock results with mixed tenant_ids
        mock_results = [
            (
                Document(
                    page_content="Valid document 1",
                    metadata={"tenant_id": tenant_id, "doc_id": "doc-1"}
                ),
                0.15
            ),
            (
                Document(
                    page_content="Invalid document",
                    metadata={"tenant_id": wrong_tenant_id, "doc_id": "doc-leaked"}
                ),
                0.20
            ),
            (
                Document(
                    page_content="Valid document 2",
                    metadata={"tenant_id": tenant_id, "doc_id": "doc-2"}
                ),
                0.25
            ),
        ]

        mock_vector_store.similarity_search_with_score.return_value = mock_results

        with patch.object(mock_rag_service, "_get_vector_store", return_value=mock_vector_store), \
             patch("src.services.rag_service.rag_cross_tenant_leak_counter") as mock_counter:

            # Should NOT raise error in fail-open mode
            result = mock_rag_service.query_knowledge_base(
                tenant_id=tenant_id,
                query="test query",
                top_k=5,
                enforce_validation=False  # Fail-open mode
            )

            # Verify success
            assert result["success"] is True

            # Verify only valid documents returned (invalid doc filtered out)
            assert result["total_results"] == 2
            assert len(result["documents"]) == 2

            # Verify all returned documents have correct tenant_id
            for doc in result["documents"]:
                assert doc["metadata"]["tenant_id"] == tenant_id

            # Verify metrics counter still incremented (leak was detected and logged)
            mock_counter.labels.assert_called_with(
                tenant_id=tenant_id,
                leak_source="pgvector"
            )
            mock_counter.labels.return_value.inc.assert_called_once()

    def test_metrics_counter_increments_on_leak_detection(self, mock_rag_service, mock_vector_store):
        """Test Prometheus counter increments when leak detected."""
        tenant_id = "tenant-123"
        wrong_tenant_id = "tenant-999"

        mock_results = [
            (
                Document(
                    page_content="Leaked document",
                    metadata={"tenant_id": wrong_tenant_id, "doc_id": "doc-leaked"}
                ),
                0.15
            ),
        ]

        mock_vector_store.similarity_search_with_score.return_value = mock_results

        with patch.object(mock_rag_service, "_get_vector_store", return_value=mock_vector_store), \
             patch("src.services.rag_service.rag_cross_tenant_leak_counter") as mock_counter:

            # Try query (will raise SecurityError)
            try:
                mock_rag_service.query_knowledge_base(
                    tenant_id=tenant_id,
                    query="test query",
                    enforce_validation=True
                )
            except SecurityError:
                pass  # Expected

            # Verify counter incremented with correct labels
            mock_counter.labels.assert_called_once_with(
                tenant_id=tenant_id,
                leak_source="pgvector"
            )
            mock_counter.labels.return_value.inc.assert_called_once()

    def test_validation_works_with_section_expansion(self, mock_rag_service, mock_vector_store):
        """Test validation also applies to full section expansion queries."""
        tenant_id = "tenant-123"
        wrong_tenant_id = "tenant-999"

        # Initial query results (trigger section expansion)
        initial_results = [
            (
                Document(
                    page_content="Doc from Section A",
                    metadata={
                        "tenant_id": tenant_id,
                        "doc_id": "doc-1",
                        "section_title": "Section A"
                    }
                ),
                0.15
            ),
            (
                Document(
                    page_content="Another doc from Section A",
                    metadata={
                        "tenant_id": tenant_id,
                        "doc_id": "doc-2",
                        "section_title": "Section A"
                    }
                ),
                0.20
            ),
        ]

        # Full section query results (contains leaked document)
        full_section_results = [
            (
                Document(
                    page_content="Full section doc 1",
                    metadata={
                        "tenant_id": tenant_id,
                        "doc_id": "doc-3",
                        "section_title": "Section A"
                    }
                ),
                0.10
            ),
            (
                Document(
                    page_content="Leaked full section doc",
                    metadata={
                        "tenant_id": wrong_tenant_id,
                        "doc_id": "doc-leaked",
                        "section_title": "Section A"
                    }
                ),
                0.15
            ),
        ]

        # Mock two different query results
        mock_vector_store.similarity_search_with_score.side_effect = [
            initial_results,
            full_section_results
        ]

        with patch.object(mock_rag_service, "_get_vector_store", return_value=mock_vector_store), \
             patch("src.services.rag_service.rag_cross_tenant_leak_counter") as mock_counter:

            # Should raise SecurityError during full section expansion
            with pytest.raises(SecurityError) as exc_info:
                mock_rag_service.query_knowledge_base(
                    tenant_id=tenant_id,
                    query="test query",
                    top_k=5,
                    expand_to_full_section=True,  # Trigger section expansion
                    enforce_validation=True
                )

            # Verify error mentions full section leak
            assert "Cross-tenant document leak" in str(exc_info.value)

    def test_empty_results_handled_correctly(self, mock_rag_service, mock_vector_store):
        """Test that empty query results are handled without errors."""
        tenant_id = "tenant-123"

        # Mock empty results
        mock_results = []
        mock_vector_store.similarity_search_with_score.return_value = mock_results

        with patch.object(mock_rag_service, "_get_vector_store", return_value=mock_vector_store):
            result = mock_rag_service.query_knowledge_base(
                tenant_id=tenant_id,
                query="test query",
                top_k=5
            )

        # Verify success with no results
        assert result["success"] is True
        assert result["total_results"] == 0
        assert len(result["documents"]) == 0


class TestSecurityErrorException:
    """Test SecurityError exception behavior."""

    def test_security_error_creation(self):
        """Test SecurityError can be created with message and details."""
        error = SecurityError(
            "Test security violation",
            details={"key": "value"}
        )

        assert str(error) == "SecurityError: Test security violation"
        assert error.message == "Test security violation"
        assert error.details == {"key": "value"}

    def test_security_error_without_details(self):
        """Test SecurityError can be created without details."""
        error = SecurityError("Test security violation")

        assert error.message == "Test security violation"
        assert error.details == {}


class TestSecurityErrorHandler:
    """Test FastAPI exception handler for SecurityError."""

    @pytest.mark.asyncio
    async def test_security_error_handler_returns_generic_error(self):
        """Test exception handler returns generic error without leaking details."""
        from src.main import security_error_handler
        from fastapi import Request

        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.method = "POST"

        # Create SecurityError
        error = SecurityError(
            "Cross-tenant leak detected",
            details={"sensitive": "data"}
        )

        # Call exception handler
        response = await security_error_handler(mock_request, error)

        # Verify response
        assert response.status_code == 500
        assert "incident_id" in response.body.decode()
        assert "security policy violation" in response.body.decode().lower()

        # Verify sensitive details NOT leaked
        assert "sensitive" not in response.body.decode()
        assert "Cross-tenant leak" not in response.body.decode()

    @pytest.mark.asyncio
    async def test_security_error_handler_logs_details(self):
        """Test exception handler logs full details for investigation."""
        from src.main import security_error_handler
        from fastapi import Request

        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.method = "POST"

        error = SecurityError(
            "Cross-tenant leak detected",
            details={"tenant_id": "123", "leaked_doc": "abc"}
        )

        with patch("src.main.logger") as mock_logger:
            response = await security_error_handler(mock_request, error)

            # Verify logging called with correct severity
            mock_logger.critical.assert_called_once()
            log_call = mock_logger.critical.call_args

            # Verify log contains full details
            assert "security_violation" in log_call[0]
            assert "tenant_id" in str(log_call)
            assert "leaked_doc" in str(log_call)
