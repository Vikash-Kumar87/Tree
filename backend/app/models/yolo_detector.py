"""
YOLOv8 Tree + Reference-Object Detector
========================================
Responsibilities:
  • Detect tree bounding boxes (class 0)
  • Detect reference objects (A4 paper, credit card, phone) for scale calibration
  • Return confidence scores and pixel bounding boxes
"""

from __future__ import annotations
import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import numpy as np
import structlog
from ultralytics import YOLO

from app.config import settings

log = structlog.get_logger(__name__)

# YOLO class indices expected in the custom-trained model.
TREE_CLASS_ID  = 0
REF_CLASS_IDS  = {
    "a4":          1,
    "credit_card": 2,
    "phone":       3,
}


@dataclass
class Detection:
    class_id:   int
    class_name: str
    confidence: float
    bbox_xyxy:  List[float]   # [x1, y1, x2, y2] in pixel coords
    bbox_xywh:  List[float]   # [cx, cy, w, h]

    @property
    def width(self)  -> float: return self.bbox_xywh[2]
    @property
    def height(self) -> float: return self.bbox_xywh[3]
    @property
    def area(self)   -> float: return self.width * self.height


@dataclass
class YOLOResult:
    trees:            List[Detection]
    reference_objects: List[Detection]
    best_tree:        Optional[Detection]    # largest-area tree
    best_reference:   Optional[Detection]    # highest-confidence reference
    image_wh:         tuple[int, int]
    confidence_score: float                  # mean tree confidence (0–1)
    inference_time_ms: float


# Class names that indicate a tree in COCO or general models
_TREE_NAMES = {"tree", "plant", "potted plant", "trunk", "palm tree"}


class YOLODetector:
    """Thin wrapper around YOLOv8 for tree and reference-object detection."""

    def __init__(self):
        self._model: Optional[YOLO] = None
        self._custom_model: bool = False   # True only when custom tree weights loaded

    def load(self) -> None:
        weights = Path(settings.YOLO_WEIGHTS)
        if not weights.exists():
            log.warning("yolo.weights_missing", path=str(weights))
            log.info("yolo.loading_pretrained", model="yolov8n.pt")
            self._model = YOLO("yolov8n.pt")   # fallback to COCO pretrained
            self._custom_model = False
        else:
            log.info("yolo.loading_custom", path=str(weights))
            self._model = YOLO(str(weights))
            self._custom_model = True
        self._model.to(settings.DEVICE)
        log.info("yolo.ready", device=settings.DEVICE)

    def unload(self) -> None:
        self._model = None

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    # ─── Inference ────────────────────────────────────────────────────────────

    async def detect(self, image: np.ndarray, reference_type: str = "a4") -> YOLOResult:
        """
        Run async-safe inference on a BGR numpy image.

        Args:
            image:          HxWx3 BGR uint8 array (already resized)
            reference_type: one of 'a4', 'credit_card', 'phone'

        Returns:
            YOLOResult with all detections.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_sync, image, reference_type)

    def _run_sync(self, image: np.ndarray, reference_type: str) -> YOLOResult:
        import time
        start = time.perf_counter()

        results = self._model.predict(
            source=image,
            conf=settings.YOLO_CONFIDENCE_THRESHOLD,
            iou=settings.YOLO_IOU_THRESHOLD,
            device=settings.DEVICE,
            verbose=False,
            imgsz=settings.MAX_IMAGE_SIZE_PX,
        )
        elapsed = (time.perf_counter() - start) * 1000

        h, w = image.shape[:2]
        trees:   List[Detection] = []
        refs:    List[Detection] = []
        ref_cls_id = REF_CLASS_IDS.get(reference_type, 1)

        for r in results:
            for box in r.boxes:
                cls_id  = int(box.cls[0].item())
                conf    = float(box.conf[0].item())
                xyxy    = box.xyxy[0].tolist()
                xywh    = box.xywhn[0].tolist()   # normalized cx,cy,w,h
                # denormalize
                xywh_px = [xywh[0]*w, xywh[1]*h, xywh[2]*w, xywh[3]*h]
                name    = self._model.names.get(cls_id, str(cls_id))

                det = Detection(cls_id, name, conf, xyxy, xywh_px)
                if cls_id == TREE_CLASS_ID:
                    # Custom model: class 0 is always tree.
                    # COCO fallback: class 0 is 'person' — only accept if name matches tree keywords.
                    if self._custom_model or name.lower() in _TREE_NAMES:
                        trees.append(det)
                elif cls_id == ref_cls_id:
                    refs.append(det)

        best_tree = max(trees, key=lambda d: d.area, default=None)
        best_ref  = max(refs,  key=lambda d: d.confidence, default=None)
        avg_conf  = float(np.mean([d.confidence for d in trees])) if trees else 0.0

        return YOLOResult(
            trees=trees,
            reference_objects=refs,
            best_tree=best_tree,
            best_reference=best_ref,
            image_wh=(w, h),
            confidence_score=avg_conf,
            inference_time_ms=round(elapsed, 1),
        )

    @property
    def version(self) -> str:
        if self._custom_model:
            return "yolov8n-tree-custom-v1"
        if self._model and hasattr(self._model, "model"):
            cfg = getattr(self._model.model, "yaml", {}) or {}
            return cfg.get("model", "yolov8-coco")
        return "yolov8-unknown"
