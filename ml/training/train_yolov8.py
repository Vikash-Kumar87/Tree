"""
YOLOv8 Tree + Reference-Object Detection Training
===================================================
Uses Ultralytics YOLO API to fine-tune YOLOv8 on a custom Roboflow dataset.

Dataset Class Map (must match your Roboflow export):
  0 – tree
  1 – a4_paper
  2 – credit_card
  3 – phone

Recommended Roboflow Universe datasets to combine:
  • "Tree Detection" – roboflow.com/universe/browse?q=tree+detection (multiple)
  • "Tree Trunk Detection" – search "trunk"
  • "Urban Trees" for diversity of species and angles
  Total target: 5 000–15 000 labelled images

Usage:
    python ml/training/train_yolov8.py --data data/tree_dataset.yaml --epochs 100
"""

import argparse
import os
from pathlib import Path


def build_data_yaml(dataset_root: str) -> str:
    """Generate the YOLO data config from the extracted Roboflow download."""
    yaml_content = f"""\
path: {dataset_root}

train: images/train
val:   images/val
test:  images/test

nc: 4
names:
  0: tree
  1: a4_paper
  2: credit_card
  3: phone
"""
    out_path = Path(dataset_root) / "tree_dataset.yaml"
    out_path.write_text(yaml_content)
    return str(out_path)


def train(args):
    from ultralytics import YOLO

    # Load base model (or resume from checkpoint)
    model = YOLO(args.base_model)

    data_yaml = args.data or build_data_yaml(args.dataset_root)

    results = model.train(
        data=data_yaml,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        project=args.project,
        name=args.name,
        patience=30,
        save=True,
        save_period=10,

        # ─── Augmentation Hyperparameters ──────────────────────────────
        hsv_h=0.015,    # hue jitter
        hsv_s=0.7,      # saturation jitter
        hsv_v=0.4,      # brightness jitter
        degrees=15,     # rotation ±15°
        translate=0.1,
        scale=0.5,
        shear=2.0,
        perspective=0.0005,
        flipud=0.05,    # small vertical flip probability
        fliplr=0.5,
        mosaic=1.0,     # mosaic augmentation (4 images combined)
        mixup=0.15,     # mixup augmentation
        copy_paste=0.1, # copy-paste augmentation

        # ─── Learning Rate ─────────────────────────────────────────────
        lr0=0.01,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        warmup_bias_lr=0.1,

        # ─── Loss Weights ──────────────────────────────────────────────
        box=7.5,
        cls=0.5,
        dfl=1.5,

        # ─── Validation ────────────────────────────────────────────────
        val=True,
        plots=True,
        verbose=True,
    )

    print(f"\n[✓] Training complete. Weights saved to: {results.save_dir}/weights/best.pt")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLOv8 for tree detection")
    parser.add_argument("--base-model",   default="yolov8m.pt",
                        help="Base checkpoint: yolov8n/s/m/l/x.pt")
    parser.add_argument("--data",         default=None,
                        help="Path to dataset YAML (auto-generated if omitted)")
    parser.add_argument("--dataset-root", default="data/tree_dataset",
                        help="Root of extracted Roboflow dataset")
    parser.add_argument("--epochs",  type=int, default=100)
    parser.add_argument("--imgsz",   type=int, default=640)
    parser.add_argument("--batch",   type=int, default=16)
    parser.add_argument("--device",  default="0",
                        help="'cpu', '0' (GPU 0), '0,1' (multi-GPU)")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--project", default="runs/yolo_tree")
    parser.add_argument("--name",    default="exp")
    args = parser.parse_args()
    train(args)
