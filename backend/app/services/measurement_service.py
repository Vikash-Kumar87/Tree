"""
Measurement Service
====================
Orchestrates the full multi-model inference pipeline:
  1. Pre-process image (resize, undistort)
  2. YOLO  → tree + reference object detection
  3. Mask R-CNN → trunk segmentation & DBH pixel width
  4. HRNet → keypoint detection (apex + base)
  5. Calibration → pixel-to-mm scale factor
  6. Geometry → height (m) and diameter (cm)
  7. Biomass / carbon estimation

Returns a structured MeasurementResult consumed by the API route.
"""

from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np
import structlog

from app.config import settings
from app.models import model_registry
from app.services.calibration_service import CalibrationService
from app.utils.bio_estimator import BiomassEstimator

log = structlog.get_logger(__name__)
_calibrator = CalibrationService()
_bio_est    = BiomassEstimator()


@dataclass
class Measurements:
    height_m:   float
    diameter_cm: float
    biomass_kg:  float
    carbon_kg:   float
    co2_kg:      float


@dataclass
class ConfidenceScores:
    detection:    float   # YOLO
    segmentation: float   # Mask R-CNN
    keypoint:     float   # HRNet
    calibration:  float   # CalibrationService
    overall:      float   # weighted harmonic mean


@dataclass
class MeasurementResult:
    measurements:     Measurements
    confidence:       ConfidenceScores
    model_versions:   dict
    processing_time_ms: float
    debug: dict = field(default_factory=dict)


class MeasurementService:

    # Weights for the overall confidence harmonic mean
    _CONF_WEIGHTS = {
        "detection":    0.25,
        "segmentation": 0.30,
        "keypoint":     0.30,
        "calibration":  0.15,
    }

    async def analyse(
        self,
        image_bytes: bytes,
        reference_type: str = "a4",
    ) -> MeasurementResult:
        t0 = time.perf_counter()

        # ── 1. Decode & resize ───────────────────────────────────────────────
        image = self._decode(image_bytes)
        image = self._resize(image)

        # ── 2. YOLO Detection ────────────────────────────────────────────────
        yolo_result = await model_registry.yolo.detect(image, reference_type)
        tree_bbox   = yolo_result.best_tree.bbox_xyxy  if yolo_result.best_tree  else None
        ref_bbox    = yolo_result.best_reference.bbox_xyxy if yolo_result.best_reference else None

        if not yolo_result.trees:
            # No trees detected — custom weights are absent and COCO pretrained
            # model has no tree class.  Fall back: treat the full image as the
            # tree region so the rest of the pipeline can still produce estimates.
            log.warning(
                "measurement.no_tree_detected_fallback",
                msg="Using full-image region as tree (custom weights not loaded)",
            )
            from app.models.yolo_detector import Detection, YOLOResult
            h_img, w_img = image.shape[:2]
            synth_bbox = [0.0, 0.0, float(w_img), float(h_img)]
            synth_det = Detection(
                class_id=0,
                class_name="tree (inferred)",
                confidence=0.30,
                bbox_xyxy=synth_bbox,
                bbox_xywh=[w_img / 2, h_img / 2, float(w_img), float(h_img)],
            )
            yolo_result = YOLOResult(
                trees=[synth_det],
                reference_objects=yolo_result.reference_objects,
                best_tree=synth_det,
                best_reference=yolo_result.best_reference,
                image_wh=yolo_result.image_wh,
                confidence_score=0.30,
                inference_time_ms=yolo_result.inference_time_ms,
            )
            tree_bbox = synth_bbox

        # ── 3. Mask R-CNN Segmentation ───────────────────────────────────────
        seg_result = await model_registry.mask_rcnn.segment(image, tree_bbox)

        # ── 4. Keypoint Detection ────────────────────────────────────────────
        kp_result = await model_registry.keypoint.detect(
            image,
            tree_bbox_xyxy=tree_bbox,
            seg_mask=seg_result.mask if seg_result.mask.any() else None,
        )

        # ── 5. Calibration ───────────────────────────────────────────────────
        calib = _calibrator.compute(
            reference_type=reference_type,
            reference_bbox_xyxy=ref_bbox,
            image_wh=yolo_result.image_wh,
            image_bgr=image,          # passed for OpenCV contour fallback
        )

        # ── 6. Geometry ──────────────────────────────────────────────────────
        ppm    = calib.pixels_per_mm          # pixels per millimetre
        height_m   = self._pixel_to_metres(kp_result.pixel_height, ppm)
        diameter_cm = self._pixel_to_cm(seg_result.dbh_pixel_width, ppm)

        # Sanity clamps – real forest trees
        height_m    = float(np.clip(height_m,   0.5,  120.0))
        diameter_cm = float(np.clip(diameter_cm, 1.0,  600.0))

        # ── 7. Biomass / Carbon ──────────────────────────────────────────────
        bio = _bio_est.estimate(height_m, diameter_cm)

        # ── 8. Confidence Aggregation ────────────────────────────────────────
        conf_vals = {
            "detection":    yolo_result.confidence_score,
            "segmentation": seg_result.confidence,
            "keypoint":     kp_result.confidence,
            "calibration":  calib.confidence,
        }
        overall = self._harmonic_mean(conf_vals)
        confidence = ConfidenceScores(
            detection=round(conf_vals["detection"], 4),
            segmentation=round(conf_vals["segmentation"], 4),
            keypoint=round(conf_vals["keypoint"], 4),
            calibration=round(conf_vals["calibration"], 4),
            overall=round(overall, 4),
        )

        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        log.info(
            "measurement.complete",
            height_m=round(height_m, 3),
            diameter_cm=round(diameter_cm, 2),
            overall_conf=round(overall, 3),
            ms=elapsed,
        )

        return MeasurementResult(
            measurements=Measurements(
                height_m=round(height_m, 3),
                diameter_cm=round(diameter_cm, 2),
                biomass_kg=round(bio["biomass_kg"], 2),
                carbon_kg=round(bio["carbon_kg"], 2),
                co2_kg=round(bio["co2_kg"], 2),
            ),
            confidence=confidence,
            model_versions=model_registry.model_versions(),
            processing_time_ms=elapsed,
            debug={
                "yolo_trees_detected":    len(yolo_result.trees),
                "reference_found":        ref_bbox is not None,
                "calibration_method":     calib.method,
                "calibration_confidence": round(calib.confidence, 2),
                "pixels_per_mm":          round(ppm, 4),
                "apex_kp":    {"x": round(kp_result.apex.x, 1), "y": round(kp_result.apex.y, 1)},
                "base_kp":    {"x": round(kp_result.base.x, 1), "y": round(kp_result.base.y, 1)},
                "pixel_height":           round(kp_result.pixel_height, 1),
                "dbh_pixel_width":        round(seg_result.dbh_pixel_width, 1),
            }
        )

    # ─── Static helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _decode(raw: bytes) -> np.ndarray:
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes")
        return img

    @staticmethod
    def _resize(image: np.ndarray) -> np.ndarray:
        h, w = image.shape[:2]
        max_side = settings.MAX_IMAGE_SIZE_PX
        if max(h, w) <= max_side:
            return image
        scale = max_side / max(h, w)
        return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    @staticmethod
    def _pixel_to_metres(pixels: float, ppm: float) -> float:
        """pixels → metres via pixels-per-millimetre scale."""
        if ppm <= 0:
            return 0.0
        return pixels / ppm / 1000.0   # px / (px/mm) / 1000 = m

    @staticmethod
    def _pixel_to_cm(pixels: float, ppm: float) -> float:
        """pixels → cm."""
        if ppm <= 0:
            return 0.0
        return pixels / ppm / 10.0    # px / (px/mm) / 10 = cm

    def _harmonic_mean(self, vals: dict) -> float:
        w = self._CONF_WEIGHTS
        denom = sum(w[k] / max(vals[k], 1e-6) for k in vals)
        return sum(w.values()) / denom
