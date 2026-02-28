"""
Mask R-CNN Trunk Segmentation Training (Detectron2)
=====================================================
Fine-tunes a Mask R-CNN R-50-FPN-3x model on COCO-format trunk segmentation data.

Recommended Roboflow Universe datasets:
  • "Tree Trunk Segmentation"  – polygon masks on trunks
  • "Forest Tree Segmentation" – full-tree + trunk masks
  • "Urban Tree Instance Segmentation"

After download, convert to COCO JSON format (option available in Roboflow export).

Usage:
    python ml/training/train_maskrcnn.py --data data/coco_trunk/annotations.json \\
           --images data/coco_trunk/images --epochs 50
"""

import argparse
import os


def setup_detectron2_dataset(coco_json: str, image_dir: str, split: str):
    """Register a COCO-format dataset with Detectron2's DatasetCatalog."""
    from detectron2.data.datasets import register_coco_instances
    name = f"tree_trunk_{split}"
    register_coco_instances(name, {}, coco_json, image_dir)
    return name


def train(args):
    import detectron2
    from detectron2 import model_zoo
    from detectron2.config import get_cfg
    from detectron2.engine import DefaultTrainer
    from detectron2.evaluation import COCOEvaluator
    import detectron2.data.transforms as T
    import os

    # ── Register datasets ────────────────────────────────────────────────
    train_name = setup_detectron2_dataset(
        args.train_json, args.images, "train"
    )
    val_name = setup_detectron2_dataset(
        args.val_json, args.images, "val"
    )

    # ── Config ───────────────────────────────────────────────────────────
    cfg = get_cfg()
    cfg.merge_from_file(
        model_zoo.get_config_file(
            "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"
        )
    )
    cfg.DATASETS.TRAIN = (train_name,)
    cfg.DATASETS.TEST  = (val_name,)

    cfg.DATALOADER.NUM_WORKERS = args.workers

    # Transfer learning from COCO pretrained
    cfg.MODEL.WEIGHTS = model_zoo.get_checkpoint_url(
        "COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"
    )
    cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1   # trunk only
    cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.5
    cfg.MODEL.DEVICE = args.device

    # ── Training Schedule ─────────────────────────────────────────────
    cfg.SOLVER.IMS_PER_BATCH = args.batch
    cfg.SOLVER.BASE_LR       = args.lr
    cfg.SOLVER.MAX_ITER      = args.epochs * (args.train_size // args.batch)
    cfg.SOLVER.STEPS         = (
        int(cfg.SOLVER.MAX_ITER * 0.667),
        int(cfg.SOLVER.MAX_ITER * 0.889),
    )
    cfg.SOLVER.GAMMA         = 0.1
    cfg.SOLVER.WARMUP_ITERS  = 200
    cfg.SOLVER.CHECKPOINT_PERIOD = 500

    # ── Augmentation ──────────────────────────────────────────────────
    cfg.INPUT.MIN_SIZE_TRAIN = (480, 512, 544, 576, 608, 640, 672, 704, 736, 768, 800)
    cfg.INPUT.MAX_SIZE_TRAIN = 1333
    cfg.INPUT.MIN_SIZE_TEST  = 800
    cfg.INPUT.MAX_SIZE_TEST  = 1333

    cfg.OUTPUT_DIR = args.output_dir
    os.makedirs(cfg.OUTPUT_DIR, exist_ok=True)

    # ── Custom Trainer with COCO Evaluation ───────────────────────────
    class TreeTrainer(DefaultTrainer):
        @classmethod
        def build_evaluator(cls, cfg, dataset_name, output_folder=None):
            return COCOEvaluator(dataset_name, output_dir=output_folder or cfg.OUTPUT_DIR)

    print(f"[⏳] Starting Mask R-CNN training for {args.epochs} epochs…")
    trainer = TreeTrainer(cfg)
    trainer.resume_or_load(resume=False)
    trainer.train()
    print(f"[✓] Training complete. Weights: {args.output_dir}/model_final.pth")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Mask R-CNN trunk segmentation")
    parser.add_argument("--train-json",  required=True, help="COCO JSON for train split")
    parser.add_argument("--val-json",    required=True, help="COCO JSON for val split")
    parser.add_argument("--images",      required=True, help="Image directory")
    parser.add_argument("--train-size",  type=int, default=3000,
                        help="Number of training images (used to calc iterations)")
    parser.add_argument("--epochs",  type=int, default=50)
    parser.add_argument("--batch",   type=int, default=4)
    parser.add_argument("--lr",      type=float, default=0.00025)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--device",  default="cuda")
    parser.add_argument("--output-dir", default="runs/maskrcnn_trunk")
    args = parser.parse_args()
    train(args)
