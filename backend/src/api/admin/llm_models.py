"""Admin API endpoints for LLM model management."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.config import get_db
from src.models.llm_model import LLMModel
from src.middleware.auth import require_admin_role
from src.utils.logging import get_logger
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

logger = get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-llm-models"])

class LLMModelResponse(BaseModel):
    llm_model_id: str
    provider: str
    model_name: str
    context_window: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/llm-models", response_model=List[LLMModelResponse])
async def list_llm_models(
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
) -> List[LLMModelResponse]:
    """
    List all available LLM models.

    Requires admin role in JWT.
    """
    try:
        models = db.query(LLMModel).filter(LLMModel.is_active == True).all()
        
        return [
            LLMModelResponse(
                llm_model_id=str(model.llm_model_id),
                provider=model.provider,
                model_name=model.model_name,
                context_window=model.context_window,
                is_active=model.is_active,
                created_at=model.created_at
            )
            for model in models
        ]

    except Exception as e:
        logger.error("list_llm_models_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list LLM models: {str(e)}")
