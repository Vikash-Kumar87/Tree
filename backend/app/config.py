"""
Application Configuration
Reads all settings from environment variables (with .env file support via pydantic-settings).
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ─── General ────────────────────────────────────────────────────────────
    ENV:              str  = "development"
    SECRET_KEY:       str  = "change-me-in-production"
    ALLOWED_ORIGINS:  List[str] = ["http://localhost:3000", "https://yourdomain.com"]

    # ─── Firebase Admin SDK ──────────────────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: str = "firebase-adminsdk.json"
    FIREBASE_STORAGE_BUCKET:   str = "your-project.appspot.com"

    # ─── Model Weights ───────────────────────────────────────────────────────
    # Paths to local .pt / config files. Downloaded on first run if absent.
    YOLO_WEIGHTS:       str = "weights/yolov8_tree.pt"
    MASKRCNN_CONFIG:    str = "weights/maskrcnn_config.yaml"
    MASKRCNN_WEIGHTS:   str = "weights/maskrcnn_tree.pth"
    KEYPOINT_WEIGHTS:   str = "weights/hrnet_keypoint.pth"

    # ─── Inference ───────────────────────────────────────────────────────────
    YOLO_CONFIDENCE_THRESHOLD:  float = 0.35   # lowered from 0.45 — custom model recall ~74%
    YOLO_IOU_THRESHOLD:         float = 0.45
    DEVICE:                     str   = "cpu"   # 'cpu' | 'cuda' | 'mps'
    MAX_IMAGE_SIZE_PX:          int   = 1280    # longest edge resize before inference

    # ─── Reference Object Dimensions (mm) ───────────────────────────────────
    REF_A4_WIDTH_MM:          float = 210.0
    REF_A4_HEIGHT_MM:         float = 297.0
    REF_CREDIT_CARD_WIDTH_MM: float = 85.6
    REF_CREDIT_CARD_HEIGHT_MM:float = 54.0

    # ─── Allometric Constants ────────────────────────────────────────────────
    # Chave et al. 2005 (tropical broadleaf)
    WOOD_DENSITY_G_CM3:   float = 0.6       # ρ  (g/cm³)
    BIOMASS_TO_CARBON:    float = 0.5       # IPCC conversion factor
    CARBON_TO_CO2:        float = 3.6667    # C→CO₂ molecular weight ratio

    # ─── Logging ─────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
