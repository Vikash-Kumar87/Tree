"""
Measurements Router
====================
GET  /api/measurements/         – get current user's measurements
GET  /api/measurements/{id}     – get single measurement
GET  /api/measurements/stats    – aggregate stats for current user
"""

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps         import get_current_user
from app.services.firebase_service import firebase_service

router = APIRouter()


@router.get("/", summary="Get all measurements for the current user")
async def list_measurements(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    try:
        records = firebase_service.get_user_measurements(current_user["uid"], limit=limit)
        return {"measurements": records, "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", summary="Aggregate statistics for current user")
async def user_stats(current_user: dict = Depends(get_current_user)):
    try:
        records = firebase_service.get_user_measurements(current_user["uid"], limit=1000)
        if not records:
            return {"total_trees": 0, "avg_height_m": 0, "avg_diameter_cm": 0,
                    "total_carbon_kg": 0, "total_co2_kg": 0}

        import statistics
        heights   = [r["measurements"]["height_m"]   for r in records if r.get("measurements")]
        diameters = [r["measurements"]["diameter_cm"] for r in records if r.get("measurements")]
        carbons   = [r["measurements"]["carbon_kg"]  for r in records if r.get("measurements")]
        co2s      = [r["measurements"]["co2_kg"]     for r in records if r.get("measurements")]

        return {
            "total_trees":    len(records),
            "avg_height_m":   round(statistics.mean(heights),   2) if heights   else 0,
            "avg_diameter_cm": round(statistics.mean(diameters), 2) if diameters else 0,
            "total_carbon_kg": round(sum(carbons), 2),
            "total_co2_kg":   round(sum(co2s), 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{doc_id}", summary="Get single measurement by Firestore document ID")
async def get_measurement(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    record = firebase_service.get_measurement(doc_id)
    if not record:
        raise HTTPException(status_code=404, detail="Measurement not found")
    if record.get("userId") != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return record
