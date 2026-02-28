"""
Merge 3 Tree Trunk datasets into one combined YOLOv8 dataset.

Dataset 1: Tree Trunks Dataset.v2i.yolov8   → already YOLO, class 0 = tree trunk
Dataset 2: YOLO Tree Dataset.v3i.yolov8      → YOLO, class 0=trunk, 1=trunktrack → remap to 0
Dataset 3: Tree Trunk Detection.v2i.coco     → COCO format → convert to YOLO class 0

Output: ml/data/combined_dataset/
"""

import json
import shutil
import random
from pathlib import Path

BASE = Path(r"C:\Users\vk654\OneDrive\Documents\Desktop\Tree\ml\data")
OUT  = BASE / "combined_dataset"

# Create output folders
for split in ("train", "val"):
    (OUT / split / "images").mkdir(parents=True, exist_ok=True)
    (OUT / split / "labels").mkdir(parents=True, exist_ok=True)

counter = {"train": 0, "val": 0}


# ── Helper: copy YOLO image+label, remapping all class IDs to 0 ──────────────
def copy_yolo_remap(img_path: Path, lbl_path: Path, split: str, prefix: str):
    if not img_path.exists():
        return
    idx = counter[split]
    new_stem = f"{prefix}_{idx:05d}"

    # Copy image
    dst_img = OUT / split / "images" / (new_stem + img_path.suffix)
    shutil.copy2(img_path, dst_img)

    # Copy / remap label
    dst_lbl = OUT / split / "labels" / (new_stem + ".txt")
    if lbl_path.exists():
        lines = lbl_path.read_text().strip().splitlines()
        new_lines = []
        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                parts[0] = "0"          # remap any class → 0 (tree trunk)
                new_lines.append(" ".join(parts))
        dst_lbl.write_text("\n".join(new_lines))
    else:
        dst_lbl.write_text("")          # empty label = background image

    counter[split] += 1


# ── Dataset 1: Tree Trunks Dataset (YOLO) ─────────────────────────────────────
print("Processing Dataset 1: Tree Trunks Dataset (YOLO)...")
d1 = BASE / "tree_dataset"
for split_src, split_dst in [("train", "train"), ("valid", "val")]:
    img_dir = d1 / split_src / "images"
    lbl_dir = d1 / split_src / "labels"
    if not img_dir.exists():
        continue
    for img in sorted(img_dir.glob("*")):
        if img.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
            lbl = lbl_dir / (img.stem + ".txt")
            copy_yolo_remap(img, lbl, split_dst, "d1")
print(f"  → train: {counter['train']}  val: {counter['val']}")
snap1 = dict(counter)


# ── Dataset 2: YOLO Tree Dataset (YOLO, 2 classes → remap to 0) ──────────────
print("Processing Dataset 2: YOLO Tree Dataset (YOLO)...")
d2 = BASE / "yolo_tree_dataset"
for split_src, split_dst in [("train", "train"), ("valid", "val")]:
    img_dir = d2 / split_src / "images"
    lbl_dir = d2 / split_src / "labels"
    if not img_dir.exists():
        continue
    for img in sorted(img_dir.glob("*")):
        if img.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
            lbl = lbl_dir / (img.stem + ".txt")
            copy_yolo_remap(img, lbl, split_dst, "d2")
print(f"  → train: {counter['train']}  val: {counter['val']}")


# ── Dataset 3: COCO Segmentation → convert to YOLO bbox ──────────────────────
print("Processing Dataset 3: COCO Tree Trunk Detection (COCO→YOLO)...")
d3 = BASE / "coco_tree_dataset"

def coco_to_yolo(json_path: Path, img_dir: Path, split_dst: str, prefix: str):
    """Convert COCO annotations to YOLO bbox format, all class → 0."""
    with open(json_path) as f:
        coco = json.load(f)

    # Build image id → info map
    id2img = {img["id"]: img for img in coco["images"]}

    # Build image id → annotations map
    id2anns: dict = {}
    for ann in coco["annotations"]:
        id2anns.setdefault(ann["image_id"], []).append(ann)

    for img_info in coco["images"]:
        img_id   = img_info["id"]
        filename = img_info["file_name"]
        W = img_info["width"]
        H = img_info["height"]

        img_path = img_dir / filename
        if not img_path.exists():
            # Try without subdirectories
            img_path = img_dir / Path(filename).name
        if not img_path.exists():
            continue

        idx = counter[split_dst]
        new_stem = f"{prefix}_{idx:05d}"
        dst_img  = OUT / split_dst / "images" / (new_stem + img_path.suffix)
        dst_lbl  = OUT / split_dst / "labels" / (new_stem + ".txt")

        shutil.copy2(img_path, dst_img)

        anns = id2anns.get(img_id, [])
        yolo_lines = []
        for ann in anns:
            # COCO bbox: [x_min, y_min, width, height]
            if "bbox" in ann and len(ann["bbox"]) == 4:
                x, y, w, h = ann["bbox"]
                cx = (x + w / 2) / W
                cy = (y + h / 2) / H
                nw = w / W
                nh = h / H
                # Clamp to [0,1]
                cx = max(0.0, min(1.0, cx))
                cy = max(0.0, min(1.0, cy))
                nw = max(0.0, min(1.0, nw))
                nh = max(0.0, min(1.0, nh))
                yolo_lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

        dst_lbl.write_text("\n".join(yolo_lines))
        counter[split_dst] += 1

# COCO splits: train → train, valid → val, test → val (merged in)
for split_src, split_dst in [("train","train"), ("valid","val"), ("test","val")]:
    json_path = d3 / split_src / "_annotations.coco.json"
    img_dir   = d3 / split_src
    if json_path.exists():
        coco_to_yolo(json_path, img_dir, split_dst, f"d3_{split_src}")

print(f"  → train: {counter['train']}  val: {counter['val']}")


# ── Write combined YAML ───────────────────────────────────────────────────────
yaml_content = f"""path: {OUT.as_posix()}

train: train/images
val:   val/images

nc: 1
names:
  0: tree trunk
"""
(OUT / "combined_dataset.yaml").write_text(yaml_content)

print("\n✓ Merge complete!")
print(f"  Total train images : {counter['train']}")
print(f"  Total val   images : {counter['val']}")
print(f"  YAML saved to      : {OUT / 'combined_dataset.yaml'}")
