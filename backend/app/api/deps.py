"""
FastAPI dependency: extract & verify Firebase token from Authorization header.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.firebase_service import firebase_service

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Dependency that returns the Firebase decoded token dict.
    Raises 401 if the token is missing or invalid.
    """
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    user = firebase_service.verify_token(creds.credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        )
    return user


def get_optional_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict | None:
    """
    Optional auth – returns decoded token dict when a valid Bearer token is
    present, otherwise returns None (allows unauthenticated access).
    """
    if creds is None:
        return None
    return firebase_service.verify_token(creds.credentials)
