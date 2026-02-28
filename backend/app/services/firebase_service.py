"""
Firebase Admin Service
========================
Provides server-side Firebase operations:
  • Verify Firebase ID tokens from frontend
  • Store / retrieve Firestore measurement documents
  • Upload processed images to Cloud Storage
"""

from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import structlog
from app.config import settings

log = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def _get_firebase_app():
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore, storage

        creds_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
        if not creds_path.exists():
            log.warning("firebase.credentials_missing", path=str(creds_path))
            return None

        cred = credentials.Certificate(str(creds_path))
        app  = firebase_admin.initialize_app(cred, {
            "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
        })
        log.info("firebase.initialised", project=cred.project_id)
        return app
    except Exception as e:
        log.error("firebase.init_failed", error=str(e))
        return None


class FirebaseService:

    # ─── Auth ─────────────────────────────────────────────────────────────────

    def verify_token(self, id_token: str) -> Optional[dict]:
        """
        Verify the Firebase ID token and return decoded claims.
        Returns None if invalid.
        """
        try:
            from firebase_admin import auth
            _get_firebase_app()
            return auth.verify_id_token(id_token)
        except Exception as e:
            log.warning("firebase.token_invalid", error=str(e))
            return None

    # ─── Firestore ────────────────────────────────────────────────────────────

    def get_db(self):
        from firebase_admin import firestore
        _get_firebase_app()
        return firestore.client()

    def save_measurement(self, data: dict) -> str:
        db = self.get_db()
        doc_ref = db.collection("measurements").document()
        from google.cloud.firestore import SERVER_TIMESTAMP
        data["timestamp"] = SERVER_TIMESTAMP
        doc_ref.set(data)
        return doc_ref.id

    def get_measurement(self, doc_id: str) -> Optional[dict]:
        db  = self.get_db()
        doc = db.collection("measurements").document(doc_id).get()
        return {"id": doc.id, **doc.to_dict()} if doc.exists else None

    def get_user_measurements(self, user_id: str, limit: int = 50) -> list:
        db = self.get_db()
        docs = (
            db.collection("measurements")
            .where("userId", "==", user_id)
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [{"id": d.id, **d.to_dict()} for d in docs]

    # ─── Cloud Storage ────────────────────────────────────────────────────────

    def upload_image(self, image_bytes: bytes, user_id: str, filename: str) -> str:
        """Upload image to Cloud Storage; return public URL."""
        from firebase_admin import storage as fb_storage
        _get_firebase_app()
        bucket = fb_storage.bucket()
        blob   = bucket.blob(f"trees/{user_id}/{filename}")
        blob.upload_from_string(image_bytes, content_type="image/jpeg")
        blob.make_public()
        return blob.public_url


firebase_service = FirebaseService()
