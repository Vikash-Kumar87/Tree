"""Pydantic schemas for request / response bodies."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MeasurementsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    height_m:    float = Field(..., description="Tree height in metres")
    diameter_cm: float = Field(..., description="Trunk diameter at breast height in centimetres")
    biomass_kg:  float = Field(..., description="Above-ground dry biomass in kilograms")
    carbon_kg:   float = Field(..., description="Stored carbon in kilograms")
    co2_kg:      float = Field(..., description="CO₂ equivalent sequestered in kilograms")


class ConfidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    detection:    float
    segmentation: float
    keypoint:     float
    calibration:  float
    overall:      float


class InferenceResponse(BaseModel):
    measurements:     MeasurementsOut
    confidence:       ConfidenceOut
    model_versions:   dict
    processing_time_ms: float
    debug:            Optional[dict] = None


class MeasurementRecord(BaseModel):
    id:            str
    user_id:       str
    image_url:     Optional[str] = None
    reference_object: Optional[str] = None
    measurements:  MeasurementsOut
    confidence:    ConfidenceOut
    model_versions: dict
    processing_time_ms: float
    timestamp:     Optional[str] = None


class UserStatsResponse(BaseModel):
    total_trees:   int
    avg_height_m:  float
    avg_diameter_cm: float
    total_carbon_kg: float
    total_co2_kg:  float
