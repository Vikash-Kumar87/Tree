from fastapi import APIRouter
from app.models import model_registry

router = APIRouter()


@router.get("/health", summary="Health Check")
async def health_check():
    return {
        "status":  "ok",
        "models_loaded": model_registry.loaded_models,
        "versions":      model_registry.model_versions(),
    }
