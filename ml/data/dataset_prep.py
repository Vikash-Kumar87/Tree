"""
Roboflow Dataset Preparation
==============================
Downloads, merges, and splits datasets from Roboflow Universe for:
  1. Tree detection (bounding boxes) – for YOLOv8
  2. Trunk segmentation (polygon masks) – for Mask R-CNN
  3. Keypoint annotation – for HRNet (must be done manually or semi-auto)

Target Splits:
  70% Train / 20% Validation / 10% Test

Roboflow Universe Dataset Recommendations:
  ┌──────────────────────────────────┬─────────┬────────────────────────────────┐
  │ Dataset Name                     │ Images  │ Purpose                        │
  ├──────────────────────────────────┼─────────┼────────────────────────────────┤
  │ tree-detection-k4eiv             │ ~3 000  │ YOLO bbox tree/reference       │
  │ tree-trunk-detection             │ ~1 200  │ YOLO bbox trunks               │
  │ urban-tree-detection             │ ~2 500  │ diversity (urban, different angles) │
  │ forest-segmentation              │ ~2 000  │ Mask R-CNN trunk masks         │
  │ tree-instance-segmentation       │ ~1 800  │ Mask R-CNN trunk masks         │
  │ tree-species-classification      │ ~4 000  │ additional diversity           │
  └──────────────────────────────────┴─────────┴────────────────────────────────┘

Usage:
    pip install roboflow
    python ml/data/dataset_prep.py --api-key YOUR_KEY --output data/
"""

import argparse
import json
import os
import random
import shutil
from pathlib import Path


def download_roboflow_datasets(api_key: str, output_dir: str) -> list[str]:
    """Download recommended datasets using the Roboflow Python SDK."""
    from roboflow import Roboflow

    rf = Roboflow(api_key=api_key)

    DATASETS = [
        # (workspace, project, version, format)
        ("roboflow-universe-projects", "tree-detection-k4eiv",  3, "yolov8"),
        ("roboflow-universe-projects", "tree-trunk-detection",   2, "yolov8"),
        ("roboflow-universe-projects", "urban-trees-detection",  1, "yolov8"),
        ("roboflow-universe-projects", "forest-segmentation",    4, "coco"),
        ("roboflow-universe-projects", "tree-instance-seg",      1, "coco"),
    ]

    downloaded = []
    for ws, proj, ver, fmt in DATASETS:
        try:
            project  = rf.workspace(ws).project(proj)
            version  = project.version(ver)
            location = version.download(fmt, location=f"{output_dir}/raw/{proj}")
            downloaded.append(location.location)
            print(f"[✓] Downloaded: {proj} ({fmt})")
        except Exception as e:
            print(f"[✗] Skipped: {proj} – {e}")
    return downloaded


def merge_yolo_datasets(source_dirs: list[str], output_dir: str, splits=(0.70, 0.20, 0.10)):
    """
    Merge multiple YOLO-format datasets into one with a clean train/val/test split.
    """
    from tqdm import tqdm

    all_pairs = []   # (image_path, label_path)
    for src in source_dirs:
        for split in ("train", "valid", "test"):
            img_dir = Path(src) / split / "images"
            lbl_dir = Path(src) / split / "labels"
            if not img_dir.exists():
                continue
            for img in img_dir.glob("*.[jJpP][pPnN][gG]*"):
                lbl = lbl_dir / (img.stem + ".txt")
                if lbl.exists():
                    all_pairs.append((img, lbl))

    random.shuffle(all_pairs)
    n = len(all_pairs)
    t_end = int(n * splits[0])
    v_end = t_end + int(n * splits[1])

    split_map = {
        "train": all_pairs[:t_end],
        "valid": all_pairs[t_end:v_end],
        "test":  all_pairs[v_end:],
    }

    for split, pairs in split_map.items():
        img_out = Path(output_dir) / "images" / split
        lbl_out = Path(output_dir) / "labels" / split
        img_out.mkdir(parents=True, exist_ok=True)
        lbl_out.mkdir(parents=True, exist_ok=True)
        for img, lbl in tqdm(pairs, desc=f"Copying {split}"):
            shutil.copy2(img, img_out / img.name)
            shutil.copy2(lbl, lbl_out / lbl.name)

    print(f"\n[✓] Merged YOLO dataset at {output_dir}")
    for split, pairs in split_map.items():
        print(f"    {split}: {len(pairs)} images")

    # Write data.yaml
    yaml = f"""\
path: {output_dir}
train: images/train
val:   images/valid
test:  images/test
nc: 4
names:
  0: tree
  1: a4_paper
  2: credit_card
  3: phone
"""
    (Path(output_dir) / "data.yaml").write_text(yaml)
    return output_dir


def apply_augmentation_offline(image_dir: str, label_dir: str, target_count: int = 500):
    """
    Optional: offline augmentation using albumentations to increase rare scenarios.
    Adds: heavy rain, fog, night-time, extreme angles.
    """
    try:
        import albumentations as A
        import cv2, numpy as np
    except ImportError:
        print("[!] Install albumentations for offline augmentation: pip install albumentations")
        return

    heavy_transform = A.Compose([
        A.RandomRain(p=0.3),
        A.RandomFog(p=0.2),
        A.RandomSunFlare(p=0.1),
        A.GaussNoise(p=0.3),
        A.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.4, p=0.6),
        A.Perspective(scale=(0.05, 0.15), p=0.4),
        A.Rotate(limit=20, p=0.5),
    ], bbox_params=A.BboxParams(format="yolo", label_fields=["class_labels"]))

    img_paths = list(Path(image_dir).glob("*.[jJ][pP][gG]"))
    print(f"[⏳] Augmenting {len(img_paths)} images → {target_count} additional samples")

    generated = 0
    for img_path in img_paths:
        if generated >= target_count:
            break
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        lbl_path = Path(label_dir) / (img_path.stem + ".txt")
        bboxes, labels = [], []
        if lbl_path.exists():
            for line in lbl_path.read_text().strip().splitlines():
                parts = list(map(float, line.split()))
                labels.append(int(parts[0]))
                bboxes.append(parts[1:5])

        aug = heavy_transform(image=img, bboxes=bboxes, class_labels=labels)
        out_img = Path(image_dir) / f"aug_{generated}_{img_path.name}"
        cv2.imwrite(str(out_img), aug["image"])

        out_lbl = Path(label_dir) / f"aug_{generated}_{img_path.stem}.txt"
        with open(out_lbl, "w") as f:
            for cls, bb in zip(aug["class_labels"], aug["bboxes"]):
                f.write(f"{cls} {' '.join(f'{v:.6f}' for v in bb)}\n")
        generated += 1

    print(f"[✓] Generated {generated} augmented samples")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare tree measurement dataset")
    parser.add_argument("--api-key", required=True, help="Roboflow API key")
    parser.add_argument("--output",  default="data/tree_dataset",  help="Output root dir")
    parser.add_argument("--augment-count", type=int, default=500,  help="Offline augmentation count")
    args = parser.parse_args()

    print("=" * 60)
    print("  TreeMeasure AI – Dataset Preparation")
    print("=" * 60)

    downloaded = download_roboflow_datasets(args.api_key, args.output)
    yolo_dirs  = [d for d in downloaded if d]
    if yolo_dirs:
        merged = merge_yolo_datasets(yolo_dirs, f"{args.output}/merged_yolo")
        apply_augmentation_offline(
            f"{merged}/images/train",
            f"{merged}/labels/train",
            args.augment_count
        )
    print("\n[✓] Dataset preparation complete.")
