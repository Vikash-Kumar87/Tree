"""
Inference Router
=================
POST /api/inference/analyze   – accepts image + metadata, returns ML results
GET  /api/inference/result/{id} – cached result lookup
"""

from __future__ import annotations
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import get_optional_user
from app.schemas.measurement import ConfidenceOut, InferenceResponse, MeasurementsOut
from app.services.measurement_service import MeasurementService

router  = APIRouter()
_svc    = MeasurementService()

# Simple in-process cache (replace with Redis in production)
_result_cache: dict[str, dict] = {}

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_FILE_SIZE = 20 * 1024 * 1024   # 20 MB


@router.post(
    "/analyze",
    response_model=InferenceResponse,
    summary="Run multi-model tree measurement",
    description=(
        "Accepts a JPEG/PNG tree photo and a reference object type. "
        "Runs YOLOv8 → Mask R-CNN → HRNet keypoints → calibration pipeline. "
        "Returns height, diameter, biomass, carbon, and confidence scores."
    ),
)
async def analyze_tree(
    image:          UploadFile = File(..., description="Tree photo (JPEG/PNG/WEBP ≤20 MB)"),
    reference_type: str        = Form("a4", description="a4 | credit_card | phone"),
    metadata:       Optional[str] = Form(None, description="JSON metadata string"),
    current_user:   Optional[dict] = Depends(get_optional_user),
):
    # ── Validate ──────────────────────────────────────────────────────────
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {image.content_type}",
        )
    if reference_type not in ("a4", "credit_card", "phone"):
        raise HTTPException(status_code=400, detail="reference_type must be a4, credit_card, or phone")

    raw = await image.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit")
    if len(raw) < 1024:
        raise HTTPException(status_code=400, detail="Image appears to be empty or corrupt")

    # ── Inference ─────────────────────────────────────────────────────────
    try:
        result = await _svc.analyse(raw, reference_type=reference_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")

    # ── Cache & return ────────────────────────────────────────────────────
    job_id = str(uuid.uuid4())
    _result_cache[job_id] = {
        "measurements":      result.measurements.__dict__,
        "confidence":        result.confidence.__dict__,
        "model_versions":    result.model_versions,
        "processing_time_ms": result.processing_time_ms,
        "debug":             result.debug,
    }

    return InferenceResponse(
        measurements=MeasurementsOut.model_validate(result.measurements),
        confidence=ConfidenceOut.model_validate(result.confidence),
        model_versions=result.model_versions,
        processing_time_ms=result.processing_time_ms,
        debug=result.debug,
    )


@router.get(
    "/result/{job_id}",
    summary="Retrieve cached inference result",
)
async def get_result(
    job_id: str,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    if job_id not in _result_cache:
        raise HTTPException(status_code=404, detail="Result not found or expired")
    return _result_cache[job_id]
