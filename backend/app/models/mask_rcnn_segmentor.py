"""
Mask R-CNN Trunk Segmentor (Detectron2)
========================================
Responsibilities:
  • Produce a pixel-level segmentation mask of the tree trunk
  • Extract trunk width at DBH (1.3 m) for diameter estimation
  • Return confidence score and mask polygon

Why Mask R-CNN for diameter vs YOLO bounding-box?
  YOLO gives axis-aligned boxes; the trunk is *not* rectangular.
  Mask R-CNN provides sub-pixel-precise silhouettes, letting us measure
  trunk width at any height even when the tree is partially occluded or
  the trunk curves. This is the primary accuracy advantage of the multi-
  model pipeline.
"""

from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import structlog

from app.config import settings

log = structlog.get_logger(__name__)


@dataclass
class SegmentationResult:
    mask:             np.ndarray       # HxW bool mask of trunk region
    contours:         List[np.ndarray] # OpenCV contours
    trunk_bbox_xyxy:  List[float]      # tight bounding box around trunk mask
    dbh_pixel_width:  float            # trunk width at simulated DBH level (px)
    mean_width_px:    float            # mean trunk width across all sampled heights
    confidence:       float            # instance segmentation score (Detectron2)
    inference_time_ms: float


class MaskRCNNSegmentor:
    """Detectron2-based trunk segmentation."""

    def __init__(self):
        self._predictor = None
        self._cfg       = None

    def load(self) -> None:
        try:
            from detectron2 import model_zoo
            from detectron2.config import get_cfg
            from detectron2.engine import DefaultPredictor

            cfg = get_cfg()
            cfg.merge_from_file(
                model_zoo.get_config_file(
                    "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"
                )
            )
            cfg.MODEL.DEVICE = settings.DEVICE

            weights = Path(settings.MASKRCNN_WEIGHTS)
            if weights.exists():
                cfg.MODEL.WEIGHTS = str(weights)
                log.info("maskrcnn.loading_custom", path=str(weights))
            else:
                cfg.MODEL.WEIGHTS = model_zoo.get_checkpoint_url(
                    "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"
                )
                log.warning("maskrcnn.weights_missing", fallback="COCO pretrained")

            cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.50
            cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1   # trunk only in custom model
            self._predictor = DefaultPredictor(cfg)
            self._cfg       = cfg
            log.info("maskrcnn.ready", device=settings.DEVICE)
        except ImportError:
            log.warning("maskrcnn.detectron2_not_installed", msg="Falling back to bbox-based segmentation")
            self._predictor = None

    def unload(self) -> None:
        self._predictor = None

    @property
    def is_loaded(self) -> bool:
        return self._predictor is not None

    # ─── Inference ────────────────────────────────────────────────────────────

    async def segment(
        self,
        image: np.ndarray,
        tree_bbox_xyxy: Optional[List[float]] = None,
    ) -> SegmentationResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_sync, image, tree_bbox_xyxy)

    def _run_sync(
        self,
        image: np.ndarray,
        tree_bbox_xyxy: Optional[List[float]],
    ) -> SegmentationResult:
        import time, cv2
        start = time.perf_counter()

        h, w = image.shape[:2]

        # Crop to tree bounding box (+20% padding) for faster inference
        crop, offset_x, offset_y = self._crop_to_bbox(image, tree_bbox_xyxy, pad=0.20)

        if self._predictor is not None:
            result = self._predictor(crop)
            instances = result["instances"]
            if len(instances) == 0:
                return self._fallback_result(image, tree_bbox_xyxy, time.perf_counter() - start)

            # Pick highest-scoring instance (trunk)
            scores = instances.scores.cpu().numpy()
            best   = int(np.argmax(scores))
            conf   = float(scores[best])
            mask_crop = instances.pred_masks[best].cpu().numpy().astype(np.uint8) * 255
            # Restore to full image coords
            mask_full = np.zeros((h, w), dtype=np.uint8)
            ch, cw = mask_crop.shape[:2]
            y1 = offset_y; y2 = min(offset_y + ch, h)
            x1 = offset_x; x2 = min(offset_x + cw, w)
            mask_full[y1:y2, x1:x2] = mask_crop[: y2-y1, : x2-x1]
        else:
            # Fallback: approximate trunk from tree bbox centre column
            mask_full, conf = self._approximate_mask(image, tree_bbox_xyxy)

        # Compute trunk metrics from mask
        dbh_w, mean_w, contours, bbox = self._analyse_mask(mask_full, h)
        elapsed = (time.perf_counter() - start) * 1000

        return SegmentationResult(
            mask=mask_full.astype(bool),
            contours=contours,
            trunk_bbox_xyxy=bbox,
            dbh_pixel_width=dbh_w,
            mean_width_px=mean_w,
            confidence=conf,
            inference_time_ms=round(elapsed, 1),
        )

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _crop_to_bbox(
        self,
        image: np.ndarray,
        bbox: Optional[List[float]],
        pad: float,
    ) -> Tuple[np.ndarray, int, int]:
        h, w = image.shape[:2]
        if bbox is None:
            return image, 0, 0
        x1, y1, x2, y2 = [int(v) for v in bbox]
        pw = int((x2 - x1) * pad); ph = int((y2 - y1) * pad)
        x1 = max(0, x1 - pw); y1 = max(0, y1 - ph)
        x2 = min(w, x2 + pw); y2 = min(h, y2 + ph)
        return image[y1:y2, x1:x2], x1, y1

    def _approximate_mask(
        self,
        image: np.ndarray,
        bbox: Optional[List[float]],
    ) -> Tuple[np.ndarray, float]:
        """Fallback when Detectron2 is unavailable: use HSV/colour segmentation."""
        import cv2
        h, w = image.shape[:2]
        mask = np.zeros((h, w), np.uint8)
        if bbox:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            bw = x2 - x1
            # Estimate trunk occupies centre third of bbox width
            tx1 = x1 + bw // 3; tx2 = x1 + 2 * bw // 3
            mask[y1:y2, tx1:tx2] = 255
        return mask, 0.55  # lower confidence for approximation

    def _analyse_mask(
        self,
        mask: np.ndarray,
        img_h: int,
    ) -> Tuple[float, float, list, List[float]]:
        import cv2
        # Sample horizontal widths at multiple heights
        rows = np.where(mask.any(axis=1))[0]
        if len(rows) == 0:
            return 0.0, 0.0, [], [0, 0, 0, 0]

        top = int(rows.min()); bottom = int(rows.max())
        # DBH is at ~30% from bottom (≈1.3 m in typical 5–20 m frame)
        dbh_row = bottom - int((bottom - top) * 0.30)
        dbh_row = np.clip(dbh_row, 0, img_h - 1)
        dbh_cols = np.where(mask[dbh_row] > 0)[0]
        dbh_w = float(dbh_cols[-1] - dbh_cols[0]) if len(dbh_cols) >= 2 else 0.0

        # Mean width across random sample of rows
        sample_rows = rows[::max(1, len(rows)//20)]
        widths = []
        for r in sample_rows:
            cols = np.where(mask[r] > 0)[0]
            if len(cols) >= 2:
                widths.append(cols[-1] - cols[0])
        mean_w = float(np.mean(widths)) if widths else dbh_w

        # Contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # Tight bbox
        cols_all = np.where(mask.any(axis=0))[0]
        bbox = [
            float(cols_all.min()), float(top),
            float(cols_all.max()), float(bottom),
        ] if len(cols_all) else [0, 0, 0, 0]

        return dbh_w, mean_w, list(contours), bbox

    def _fallback_result(self, image, bbox, elapsed) -> SegmentationResult:
        mask, conf = self._approximate_mask(image, bbox)
        dbh_w, mean_w, contours, bbox_out = self._analyse_mask(mask, image.shape[0])
        return SegmentationResult(
            mask=mask.astype(bool), contours=contours,
            trunk_bbox_xyxy=bbox_out, dbh_pixel_width=dbh_w,
            mean_width_px=mean_w, confidence=conf * 0.6,
            inference_time_ms=round(elapsed * 1000, 1)
        )

    @property
    def version(self) -> str:
        return "mask_rcnn_R_50_FPN_3x-custom" if self._predictor else "approximate_fallback"
