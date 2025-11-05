"""RAG Tool for PgVector knowledge base retrieval."""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, create_model
from src.tools.base import BaseTool
from src.services.rag_service import get_rag_service
from src.utils.logging import get_logger

logger = get_logger(__name__)


class RAGToolConfig(BaseModel):
    """Configuration for RAG tool."""
    top_k: int = Field(default=5, ge=1, le=20, description="Number of documents to retrieve")
    collection_name: Optional[str] = Field(default=None, description="[Deprecated] Collection name (now ignored, kept for backward compatibility)")


class RAGTool(BaseTool):
    """Tool for retrieving relevant documents from PgVector knowledge base."""

    def __init__(
        self,
        config: Dict[str, Any],
        input_schema: Dict[str, Any],
        tenant_id: str,
        jwt_token: Optional[str] = None,
    ):
        """
        Initialize RAG Tool.

        Args:
            config: Tool configuration (top_k)
            input_schema: JSON schema for tool inputs (query field)
            tenant_id: Tenant UUID for isolation
            jwt_token: Optional JWT token (not used for RAG)
        """
        super().__init__(config, input_schema, tenant_id, jwt_token)

        # Parse config
        self.rag_config = RAGToolConfig(**config)

        # Get RAG service (singleton with PgVector backend)
        try:
            self.rag_service = get_rag_service()

            logger.info(
                "rag_tool_initialized",
                tenant_id=tenant_id,
                top_k=self.rag_config.top_k,
                backend="pgvector"
            )
        except Exception as e:
            logger.error(
                "rag_tool_init_failed",
                tenant_id=tenant_id,
                error=str(e)
            )
            raise

    async def execute(self, **kwargs) -> Dict[str, Any]:
        """
        Execute RAG retrieval (async wrapper for LangChain compatibility).

        Args:
            **kwargs: Tool parameters (query, etc.)

        Returns:
            Dictionary with retrieved documents and metadata
        """
        return self._execute(**kwargs)

    def _execute(self, **kwargs) -> Dict[str, Any]:
        """
        Execute RAG retrieval using PgVector similarity search.

        Args:
            query: Search query string

        Returns:
            Dictionary with retrieved documents and metadata
        """
        query = kwargs.get("query", "")

        if not query:
            logger.warning(
                "rag_tool_empty_query",
                tenant_id=self.tenant_id,
            )
            return {
                "success": False,
                "error": "Query parameter is required",
                "documents": [],
            }

        try:
            # Query knowledge base using RAGService
            result = self.rag_service.query_knowledge_base(
                tenant_id=self.tenant_id,
                query=query,
                top_k=self.rag_config.top_k
            )

            logger.info(
                "rag_tool_executed",
                tenant_id=self.tenant_id,
                query_length=len(query),
                results_count=result.get("total_results", 0),
                backend="pgvector"
            )

            return result

        except Exception as e:
            logger.error(
                "rag_tool_execution_failed",
                tenant_id=self.tenant_id,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"RAG retrieval failed: {str(e)}",
                "documents": [],
            }

    @staticmethod
    def create_langchain_tool(
        name: str,
        description: str,
        config: Dict[str, Any],
        input_schema: Dict[str, Any],
        tenant_id: str,
        jwt_token: Optional[str] = None,
    ):
        """
        Create a LangChain-compatible tool from RAG configuration.

        Args:
            name: Tool name
            description: Tool description
            config: Tool configuration
            input_schema: JSON schema for inputs
            tenant_id: Tenant UUID
            jwt_token: Optional JWT token

        Returns:
            LangChain StructuredTool
        """
        from langchain_core.tools import StructuredTool

        # Create RAG tool instance
        rag_tool = RAGTool(
            config=config,
            input_schema=input_schema,
            tenant_id=tenant_id,
            jwt_token=jwt_token,
        )

        # Create Pydantic model from input schema
        properties = input_schema.get("properties", {})
        required_fields = input_schema.get("required", [])

        fields = {}
        for field_name, field_spec in properties.items():
            field_type = str  # Default to str
            field_description = field_spec.get("description", "")

            if field_spec.get("type") == "string":
                field_type = str
            elif field_spec.get("type") == "integer":
                field_type = int
            elif field_spec.get("type") == "number":
                field_type = float
            elif field_spec.get("type") == "boolean":
                field_type = bool

            # Make optional if not required
            if field_name not in required_fields:
                field_type = Optional[field_type]
                fields[field_name] = (field_type, Field(None, description=field_description))
            else:
                fields[field_name] = (field_type, Field(..., description=field_description))

        InputModel = create_model(f"{name}Input", **fields)

        # Create LangChain tool with async support
        # Use coroutine parameter for async functions
        return StructuredTool(
            name=name,
            description=description,
            func=lambda **kwargs: rag_tool._execute(**kwargs),  # Sync wrapper
            coroutine=rag_tool.execute,  # Async function for ainvoke()
            args_schema=InputModel,
        )
