"""
Run YOLOv8 training on combined dataset and copy best weights to backend.
Auto-resumes from last checkpoint if training was interrupted.
"""
import shutil
from pathlib import Path
from ultralytics import YOLO

DATA_YAML       = r"C:\Users\vk654\OneDrive\Documents\Desktop\Tree\ml\data\combined_dataset\combined_dataset.yaml"
OUT_DIR         = r"C:\Users\vk654\OneDrive\Documents\Desktop\Tree\ml\runs\yolo_tree"
RUN_NAME        = "tree_trunk_combined_v1"
BACKEND_WEIGHTS = Path(r"C:\Users\vk654\OneDrive\Documents\Desktop\Tree\backend\weights\yolov8_tree.pt")

# ── Auto-resume: check if last.pt checkpoint exists ──────────────────────────
last_ckpt = Path(OUT_DIR) / RUN_NAME / "weights" / "last.pt"

if last_ckpt.exists():
    print(f"\n⚡ Checkpoint found! Resuming from: {last_ckpt}")
    model   = YOLO(str(last_ckpt))
    results = model.train(resume=True)
else:
    print(f"\n🚀 No checkpoint found. Starting fresh training...")
    model   = YOLO("yolov8n.pt")
    results = model.train(
        data       = DATA_YAML,
        epochs     = 50,
        imgsz      = 640,
        batch      = 8,
        device     = "cpu",
        workers    = 0,
        project    = OUT_DIR,
        name       = RUN_NAME,
        exist_ok   = True,
        patience   = 15,
        save       = True,
        save_period= 1,       # save last.pt after EVERY epoch
        plots      = True,
        verbose    = True,
    )

best = Path(results.save_dir) / "weights" / "best.pt"
shutil.copy2(best, BACKEND_WEIGHTS)
print(f"\n✓ Training complete!")
print(f"  Best weights : {best}")
print(f"  Copied to    : {BACKEND_WEIGHTS}")
