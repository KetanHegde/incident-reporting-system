import json
import os
from jose import jwt
from fastapi import HTTPException, status

# -------------------------------------------------
# Load JWKS from local file
# -------------------------------------------------
JWKS_FILE = os.path.join(os.path.dirname(__file__), "jwks.json")

with open(JWKS_FILE, "r") as f:
    JWKS = json.load(f)

ALGORITHMS = ["RS256"]


def _get_signing_key(token: str) -> dict:
    """
    Find the correct public key for the JWT.
    """
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers["kid"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header",
        )

    for key in JWKS["keys"]:
        if key["kid"] == kid:
            return key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token key",
    )


def authorize_token(token: str) -> dict:
    """
    Validate JWT and return user claims.
    Used by FastAPI Depends().
    """
    try:
        key = _get_signing_key(token)

        claims = jwt.decode(
            token,
            key,
            algorithms=ALGORITHMS,
            options={"verify_aud": False},
        )

        return claims

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def admin_only(user: dict):
    """
    Allow only users in Cognito 'admin' group.
    """
    groups = user.get("cognito:groups", [])

    if "admin" not in groups:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin only",
        )