"""
Model Registry
==============
Single source of truth for all ML model instances.
Models are loaded once at application startup and shared across requests.
"""

import asyncio
import structlog

from app.models.yolo_detector        import YOLODetector
from app.models.mask_rcnn_segmentor  import MaskRCNNSegmentor
from app.models.keypoint_detector    import KeypointDetector

log = structlog.get_logger(__name__)


class ModelRegistry:
    def __init__(self):
        self.yolo        = YOLODetector()
        self.mask_rcnn   = MaskRCNNSegmentor()
        self.keypoint    = KeypointDetector()

    @property
    def loaded_models(self) -> list:
        names = []
        if self.yolo.is_loaded:    names.append("yolo")
        if self.mask_rcnn.is_loaded: names.append("mask_rcnn")
        if self.keypoint.is_loaded:  names.append("keypoint")
        return names

    async def load_all(self) -> None:
        """Load all models concurrently in a thread pool."""
        loop = asyncio.get_event_loop()
        await asyncio.gather(
            loop.run_in_executor(None, self.yolo.load),
            loop.run_in_executor(None, self.mask_rcnn.load),
            loop.run_in_executor(None, self.keypoint.load),
        )
        log.info("model_registry.loaded", models=self.loaded_models)

    async def unload_all(self) -> None:
        self.yolo.unload()
        self.mask_rcnn.unload()
        self.keypoint.unload()

    def model_versions(self) -> dict:
        return {
            "yolo":     self.yolo.version,
            "maskrcnn": self.mask_rcnn.version,
            "keypoint": self.keypoint.version,
        }


# Global singleton – imported by routes
model_registry = ModelRegistry()
