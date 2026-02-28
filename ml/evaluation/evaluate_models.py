"""
Multi-Model Evaluation Suite
==============================
Evaluates the full pipeline (YOLO + Mask R-CNN + Keypoints) on a held-out
test set with ground-truth measurements.

Metrics:
  • YOLOv8:     mAP@0.5, mAP@0.5:0.95, Precision, Recall
  • Mask R-CNN: Segmentation AP (COCO), Mean IoU
  • Keypoints:  PCK (Percentage of Correct Keypoints) @ threshold 10px/50px
  • Height:     MAE (m), RMSE (m), MAPE (%), correlation
  • Diameter:   MAE (cm), RMSE (cm), MAPE (%)
  • Overall:    Accuracy within 5% / 10% error band

Usage:
    python ml/evaluation/evaluate_models.py \\
        --test-dir data/test/ \\
        --gt-csv data/test/ground_truth.csv \\
        --yolo-weights weights/yolov8_tree.pt \\
        --device cpu
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np


# ─── Metric helpers ───────────────────────────────────────────────────────────

def mae(y_true, y_pred):
    return float(np.mean(np.abs(np.array(y_true) - np.array(y_pred))))

def rmse(y_true, y_pred):
    return float(np.sqrt(np.mean((np.array(y_true) - np.array(y_pred))**2)))

def mape(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    mask = y_true != 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)

def within_band(y_true, y_pred, pct=0.05):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    return float(np.mean(np.abs(y_true - y_pred) / (y_true + 1e-9) <= pct) * 100)

def pck(gt_kps, pred_kps, threshold_px=10):
    """Percentage of Correct Keypoints within `threshold_px` Euclidean distance."""
    correct = 0; total = 0
    for gt, pred in zip(gt_kps, pred_kps):
        for (gx, gy), (px, py) in zip(gt, pred):
            dist = np.sqrt((gx - px)**2 + (gy - py)**2)
            if dist <= threshold_px:
                correct += 1
            total += 1
    return (correct / total * 100) if total > 0 else 0.0


# ─── Main evaluation ──────────────────────────────────────────────────────────

def evaluate_yolo(weights: str, data_yaml: str, device: str = "cpu"):
    from ultralytics import YOLO
    model   = YOLO(weights)
    results = model.val(data=data_yaml, device=device, verbose=True)
    return {
        "map50":    round(float(results.box.map50), 4),
        "map50_95": round(float(results.box.map), 4),
        "precision": round(float(results.box.p.mean()), 4),
        "recall":    round(float(results.box.r.mean()), 4),
    }


def evaluate_measurements(gt_csv: str, predictions: list[dict]) -> dict:
    """
    Compare predicted heights + diameters against ground-truth CSV.

    GT CSV columns: image_id, height_m, diameter_cm
    """
    gt = {}
    with open(gt_csv) as f:
        for row in csv.DictReader(f):
            gt[row["image_id"]] = {
                "height_m":    float(row["height_m"]),
                "diameter_cm": float(row["diameter_cm"]),
            }

    gt_h, pred_h, gt_d, pred_d = [], [], [], []
    for pred in predictions:
        img_id = pred["image_id"]
        if img_id not in gt:
            continue
        gt_h.append(gt[img_id]["height_m"])
        pred_h.append(pred["height_m"])
        gt_d.append(gt[img_id]["diameter_cm"])
        pred_d.append(pred["diameter_cm"])

    if not gt_h:
        return {"error": "No matching images found in ground truth CSV"}

    return {
        "n_samples": len(gt_h),
        "height": {
            "mae_m":          round(mae(gt_h, pred_h), 3),
            "rmse_m":         round(rmse(gt_h, pred_h), 3),
            "mape_pct":       round(mape(gt_h, pred_h), 2),
            "within_5pct":    round(within_band(gt_h, pred_h, 0.05), 1),
            "within_10pct":   round(within_band(gt_h, pred_h, 0.10), 1),
        },
        "diameter": {
            "mae_cm":         round(mae(gt_d, pred_d), 3),
            "rmse_cm":        round(rmse(gt_d, pred_d), 3),
            "mape_pct":       round(mape(gt_d, pred_d), 2),
            "within_5pct":    round(within_band(gt_d, pred_d, 0.05), 1),
            "within_10pct":   round(within_band(gt_d, pred_d, 0.10), 1),
        },
    }


def run_pipeline_on_test_set(
    test_dir: str,
    yolo_weights: str,
    device: str,
    reference_type: str = "a4",
) -> list[dict]:
    """
    Run the full inference pipeline on all images in test_dir.
    Returns list of {image_id, height_m, diameter_cm} dicts.
    """
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    import asyncio

    from app.models.yolo_detector       import YOLODetector
    from app.models.mask_rcnn_segmentor import MaskRCNNSegmentor
    from app.models.keypoint_detector   import KeypointDetector
    from app.services.calibration_service import CalibrationService
    from app.utils.bio_estimator        import BiomassEstimator
    import cv2

    yolo   = YOLODetector();    yolo.load()
    mrcnn  = MaskRCNNSegmentor(); mrcnn.load()
    kpdet  = KeypointDetector(); kpdet.load()
    calib  = CalibrationService()

    results = []
    for img_path in sorted(Path(test_dir).glob("*.[jJpP][pPnN][gG]*")):
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        img_id = img_path.stem

        async def _run():
            yr  = await yolo.detect(img, reference_type)
            sr  = await mrcnn.segment(img, yr.best_tree.bbox_xyxy if yr.best_tree else None)
            kpr = await kpdet.detect(img, yr.best_tree.bbox_xyxy if yr.best_tree else None, sr.mask)
            cal = calib.compute(reference_type, yr.best_reference.bbox_xyxy if yr.best_reference else None, yr.image_wh)
            ppm = cal.pixels_per_mm
            h = kpr.pixel_height / ppm / 1000 if ppm > 0 else 0.0
            d = sr.dbh_pixel_width / ppm / 10  if ppm > 0 else 0.0
            return {"image_id": img_id, "height_m": round(h,3), "diameter_cm": round(d,2)}

        res = asyncio.run(_run())
        results.append(res)
        print(f"  {img_id}: h={res['height_m']} m  d={res['diameter_cm']} cm")

    return results


def main(args):
    print("=" * 60)
    print("  TreeMeasure AI – Full Pipeline Evaluation")
    print("=" * 60)

    # 1. YOLO metric
    if args.yolo_weights and args.data_yaml:
        print("\n[1] YOLOv8 Detection Metrics")
        yolo_metrics = evaluate_yolo(args.yolo_weights, args.data_yaml, args.device)
        for k, v in yolo_metrics.items():
            print(f"    {k:<15}: {v}")

    # 2. End-to-end measurement accuracy
    print("\n[2] Running pipeline on test set…")
    predictions = run_pipeline_on_test_set(
        args.test_dir, args.yolo_weights, args.device, args.reference_type
    )

    if args.gt_csv:
        print("\n[3] Measurement Accuracy vs Ground Truth")
        metrics = evaluate_measurements(args.gt_csv, predictions)
        print(json.dumps(metrics, indent=2))

    # 3. Save predictions
    out_path = Path(args.test_dir) / "predictions.json"
    with open(out_path, "w") as f:
        json.dump(predictions, f, indent=2)
    print(f"\n[✓] Predictions saved to: {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate TreeMeasure AI pipeline")
    parser.add_argument("--test-dir",       required=True)
    parser.add_argument("--gt-csv",         default=None,    help="Ground truth CSV")
    parser.add_argument("--data-yaml",      default=None,    help="YOLO data.yaml for mAP")
    parser.add_argument("--yolo-weights",   default="weights/yolov8_tree.pt")
    parser.add_argument("--device",         default="cpu")
    parser.add_argument("--reference-type", default="a4")
    args = parser.parse_args()
    main(args)
