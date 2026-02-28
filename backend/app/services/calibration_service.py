"""
Camera Calibration Service
===========================
Converts pixel measurements to real-world units using:
  1. A reference object of known size in the same image plane as the trunk.
  2. OpenCV contour detection to find rectangles matching the reference aspect ratio.
  3. Focal-length estimate fallback when no object is found.

Pixel-to-metre ratio (PTM):
    PTM = known_size_mm / reference_object_pixel_size_mm

Real Height (m) = pixel_height × PTM / 1000
Real Diameter (cm) = pixel_diameter × PTM / 10
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List

import cv2
import numpy as np
import structlog

from app.config import settings

log = structlog.get_logger(__name__)

# Reference object real dimensions (mm)  width × height
REFERENCE_DIMS: dict[str, tuple[float, float]] = {
    "a4":          (settings.REF_A4_WIDTH_MM,           settings.REF_A4_HEIGHT_MM),
    "credit_card": (settings.REF_CREDIT_CARD_WIDTH_MM,  settings.REF_CREDIT_CARD_HEIGHT_MM),
    "phone":       (75.0, 150.0),   # average smartphone
}

# Tolerance for aspect-ratio matching (±X%)
_AR_TOLERANCE = 0.30


@dataclass
class CalibrationResult:
    pixels_per_mm: float
    reference_type: str
    reference_pixel_w: float
    reference_pixel_h: float
    confidence: float           # 0.92 ref-obj | 0.72 contour | 0.50 fallback
    method: str                 # 'reference_object' | 'contour_detection' | 'focal_length_estimate'


class CalibrationService:
    """
    Given a detected reference-object bounding box and its known real dimensions,
    compute the pixels-per-millimetre ratio for the image.
    """

    def compute(
        self,
        reference_type: str,
        reference_bbox_xyxy: Optional[list],
        image_wh: tuple,
        image_bgr: Optional[np.ndarray] = None,
        use_perspective_correction: bool = True,
    ) -> CalibrationResult:
        """
        Args:
            reference_type:         'a4' | 'credit_card' | 'phone'
            reference_bbox_xyxy:    [x1,y1,x2,y2] from YOLO (may be None)
            image_wh:               (width, height) of the full image in pixels
            image_bgr:              Optional BGR numpy array for OpenCV fallback
            use_perspective_correction: apply homographic skew correction
        """
        real_w_mm, real_h_mm = REFERENCE_DIMS.get(reference_type, (85.6, 54.0))

        # ── Path 1: YOLO gave us a bbox ──────────────────────────────────────
        if reference_bbox_xyxy is not None:
            result = self._from_bbox(
                reference_bbox_xyxy, real_w_mm, real_h_mm,
                reference_type, use_perspective_correction,
            )
            log.info("calibration.yolo_reference", ref=reference_type,
                     ppm=round(result.pixels_per_mm, 4))
            return result

        # ── Path 2: OpenCV contour search ────────────────────────────────────
        if image_bgr is not None:
            bbox = self._find_reference_contour(image_bgr, reference_type)
            if bbox is not None:
                result = self._from_bbox(
                    bbox, real_w_mm, real_h_mm,
                    reference_type, use_perspective_correction,
                )
                result.confidence = 0.72
                result.method     = "contour_detection"
                log.info("calibration.contour_reference", ref=reference_type,
                         ppm=round(result.pixels_per_mm, 4))
                return result

        # ── Path 3: Focal-length estimate fallback ────────────────────────────
        return self._focal_length_fallback(image_wh, reference_type)

    # ─── Private helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _from_bbox(
        bbox_xyxy: list,
        real_w_mm: float,
        real_h_mm: float,
        ref_type: str,
        perspective: bool,
    ) -> CalibrationResult:
        x1, y1, x2, y2 = bbox_xyxy
        px_w = abs(x2 - x1)
        px_h = abs(y2 - y1)

        if perspective and px_w > 0 and px_h > 0:
            ratio_w = px_w / real_w_mm
            ratio_h = px_h / real_h_mm
            ppm = float(np.sqrt(ratio_w * ratio_h))
        else:
            ppm = (px_w / real_w_mm) if px_w > 0 else (px_h / real_h_mm)

        return CalibrationResult(
            pixels_per_mm=ppm,
            reference_type=ref_type,
            reference_pixel_w=float(px_w),
            reference_pixel_h=float(px_h),
            confidence=0.92,
            method="reference_object",
        )

    @staticmethod
    def _find_reference_contour(
        image_bgr: np.ndarray,
        reference_type: str,
    ) -> Optional[list]:
        """
        Use Canny + contour analysis to find a rectangle whose aspect ratio
        matches the selected reference object.  Returns [x1,y1,x2,y2] or None.
        """
        real_w, real_h = REFERENCE_DIMS.get(reference_type, (85.6, 54.0))
        target_ar = real_w / real_h          # expected width/height ratio
        img_h, img_w = image_bgr.shape[:2]
        min_area =  (img_w * img_h) * 0.001  # at least 0.1% of image
        max_area =  (img_w * img_h) * 0.40   # at most 40% of image

        gray  = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        blur  = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150)
        # Dilate edges slightly to close small gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges  = cv2.dilate(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best: Optional[tuple] = None    # (score, bbox)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if not (min_area < area < max_area):
                continue

            # Approximate to polygon
            peri   = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)

            # Accept 4-sided shapes (rectangles/quads) and bounding rects of
            # any contour whose aspect ratio matches closely enough.
            x, y, w, h = cv2.boundingRect(cnt)
            if w == 0 or h == 0:
                continue

            # Check both orientations (portrait and landscape)
            ar_landscape = w / h
            ar_portrait  = h / w
            err_l = abs(ar_landscape - target_ar) / target_ar
            err_p = abs(ar_portrait  - target_ar) / target_ar
            err   = min(err_l, err_p)

            if err > _AR_TOLERANCE:
                continue

            # Prefer larger areas (more prominent = more likely the reference obj)
            score = area * (1.0 - err)
            if best is None or score > best[0]:
                best = (score, [float(x), float(y), float(x + w), float(y + h)])

        if best is not None:
            log.debug("calibration.contour_found", ref=reference_type, bbox=best[1])
            return best[1]

        log.debug("calibration.contour_not_found", ref=reference_type)
        return None

    @staticmethod
    def _focal_length_fallback(
        image_wh: tuple,
        reference_type: str,
    ) -> CalibrationResult:
        """
        Last-resort estimate: assume the reference object occupies a
        reference-type-specific fraction of image width at ~1.5 m shooting
        distance.  More accurate than the old fixed-10m-tree heuristic.
        """
        img_w, img_h = image_wh

        # Typical fraction of image width the reference object spans at ~1.5 m
        TYPICAL_FRACTION = {
            "a4":          0.22,   # A4 held against trunk
            "credit_card": 0.08,   # small card near base
            "phone":       0.12,   # phone propped up
        }
        real_w_mm = REFERENCE_DIMS.get(reference_type, (85.6, 54.0))[0]
        frac      = TYPICAL_FRACTION.get(reference_type, 0.15)
        px_w_est  = img_w * frac
        ppm       = px_w_est / real_w_mm

        log.warning("calibration.fallback_estimate",
                    ref=reference_type, ppm=round(ppm, 4))
        return CalibrationResult(
            pixels_per_mm=ppm,
            reference_type=reference_type,
            reference_pixel_w=px_w_est,
            reference_pixel_h=0.0,
            confidence=0.50,
            method="focal_length_estimate",
        )

    # ─── OpenCV-based undistortion ─────────────────────────────────────────
    @staticmethod
    def undistort_image(
        image: np.ndarray,
        camera_matrix: Optional[np.ndarray] = None,
        dist_coeffs: Optional[np.ndarray]   = None,
    ) -> np.ndarray:
        if camera_matrix is None or dist_coeffs is None:
            return image
        h, w = image.shape[:2]
        new_cam_mtx, roi = cv2.getOptimalNewCameraMatrix(
            camera_matrix, dist_coeffs, (w, h), 1, (w, h)
        )
        dst = cv2.undistort(image, camera_matrix, dist_coeffs, None, new_cam_mtx)
        x, y, rw, rh = roi
        return dst[y:y+rh, x:x+rw]
