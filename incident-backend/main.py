from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import os
import boto3
from botocore.exceptions import ClientError

from auth import authorize_token, admin_only
from db import get_db
from dynamo import log_event

# -------------------------------------------------
# Load environment
# -------------------------------------------------
load_dotenv()

AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET")

if not AWS_REGION:
    raise RuntimeError("AWS_REGION is not set")

if not S3_BUCKET:
    raise RuntimeError("S3_BUCKET is not set")

# -------------------------------------------------
# FastAPI app
# -------------------------------------------------
app = FastAPI(title="Incident Backend API")

# -------------------------------------------------
# CORS
# -------------------------------------------------
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost",
    "https://d3v1bwweufhpww.cloudfront.net",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# AWS clients
# -------------------------------------------------
s3 = boto3.client("s3", region_name=AWS_REGION)

# -------------------------------------------------
# Security
# -------------------------------------------------
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """
    Validates JWT and returns user claims.
    """
    return authorize_token(credentials.credentials)


def get_admin_user(
    user: dict = Depends(get_current_user),
):
    """
    Admin-only dependency.
    """
    admin_only(user)
    return user


# -------------------------------------------------
# Health check
# -------------------------------------------------
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}


# -------------------------------------------------
# User APIs
# -------------------------------------------------
@app.post("/incident", tags=["User"])
def create_incident(
    data: dict,
    user: dict = Depends(get_current_user),
):
    required_fields = ["incident_name", "description", "priority"]

    for field in required_fields:
        if field not in data or data[field] in [None, ""]:
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required",
            )

    priority = str(data["priority"]).upper()

    if priority not in ["LOW", "MEDIUM", "HIGH"]:
        raise HTTPException(
            status_code=400,
            detail="priority must be one of: LOW, MEDIUM, HIGH",
        )

    conn = None

    try:
        conn = get_db()

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO incidents
                (
                    user_id,
                    incident_name,
                    description,
                    priority,
                    status,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    %s, %s, %s, %s, 'OPEN', NOW(), NOW()
                )
                """,
                (
                    user["sub"],
                    data["incident_name"],
                    data["description"],
                    priority,
                ),
            )

            incident_id = cur.lastrowid
            screenshot_key = f"screenshots/{incident_id}.png"

            cur.execute(
                """
                UPDATE incidents
                SET screenshot_key = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (screenshot_key, incident_id),
            )

        conn.commit()

        try:
            log_event("INCIDENT_CREATED", user, incident_id)
        except Exception as log_error:
            print(f"Failed to log INCIDENT_CREATED event: {log_error}")

        upload_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": screenshot_key,
                "ContentType": "image/png",
            },
            ExpiresIn=300,
        )

        return {
            "incident_id": incident_id,
            "uploadUrl": upload_url,
            "screenshot_key": screenshot_key,
        }

    except ClientError as e:
        if conn:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"S3 error: {str(e)}",
        )

    except Exception as e:
        if conn:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to create incident: {str(e)}",
        )

    finally:
        if conn:
            conn.close()


@app.get("/incidents/my", tags=["User"])
def get_my_incidents(
    user: dict = Depends(get_current_user),
):
    conn = None

    try:
        conn = get_db()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    user_id,
                    incident_name,
                    description,
                    priority,
                    status,
                    screenshot_key,
                    created_at,
                    updated_at
                FROM incidents
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (user["sub"],),
            )

            rows = cur.fetchall()

        return rows

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch incidents: {str(e)}",
        )

    finally:
        if conn:
            conn.close()


@app.post("/incident/{incident_id}/screenshot", tags=["User"])
def confirm_screenshot(
    incident_id: int,
    user: dict = Depends(get_current_user),
):
    """
    Confirms screenshot action.

    Your current MySQL schema does not have a screenshot_uploaded column,
    so this endpoint only verifies ownership and updates updated_at.
    """

    conn = None

    try:
        conn = get_db()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    user_id,
                    screenshot_key
                FROM incidents
                WHERE id = %s
                """,
                (incident_id,),
            )

            incident = cur.fetchone()

            if not incident:
                raise HTTPException(
                    status_code=404,
                    detail="Incident not found",
                )

            if incident["user_id"] != user["sub"]:
                raise HTTPException(
                    status_code=403,
                    detail="You are not allowed to update this incident",
                )

            cur.execute(
                """
                UPDATE incidents
                SET updated_at = NOW()
                WHERE id = %s
                """,
                (incident_id,),
            )

        conn.commit()

        try:
            log_event("SCREENSHOT_UPLOADED", user, incident_id)
        except Exception as log_error:
            print(f"Failed to log SCREENSHOT_UPLOADED event: {log_error}")

        return {
            "status": "screenshot_confirmed",
            "incident_id": incident_id,
            "screenshot_key": incident["screenshot_key"],
        }

    except HTTPException:
        raise

    except Exception as e:
        if conn:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to confirm screenshot: {str(e)}",
        )

    finally:
        if conn:
            conn.close()


# -------------------------------------------------
# Admin APIs
# -------------------------------------------------
@app.get("/admin/incidents", tags=["Admin"])
def get_all_incidents(
    user: dict = Depends(get_admin_user),
):
    conn = None

    try:
        conn = get_db()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    user_id,
                    incident_name,
                    description,
                    priority,
                    status,
                    screenshot_key,
                    created_at,
                    updated_at
                FROM incidents
                ORDER BY created_at DESC
                """
            )

            rows = cur.fetchall()

        return rows

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch all incidents: {str(e)}",
        )

    finally:
        if conn:
            conn.close()


@app.post("/admin/resolve/{incident_id}", tags=["Admin"])
def resolve_incident(
    incident_id: int,
    user: dict = Depends(get_admin_user),
):
    conn = None

    try:
        conn = get_db()

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    status
                FROM incidents
                WHERE id = %s
                """,
                (incident_id,),
            )

            incident = cur.fetchone()

            if not incident:
                raise HTTPException(
                    status_code=404,
                    detail="Incident not found",
                )

            if incident["status"] == "RESOLVED":
                return {
                    "status": "already_resolved",
                    "incident_id": incident_id,
                }

            cur.execute(
                """
                UPDATE incidents
                SET status = 'RESOLVED',
                    updated_at = NOW()
                WHERE id = %s
                """,
                (incident_id,),
            )

        conn.commit()

        try:
            log_event("INCIDENT_RESOLVED", user, incident_id)
        except Exception as log_error:
            print(f"Failed to log INCIDENT_RESOLVED event: {log_error}")

        return {
            "status": "resolved",
            "incident_id": incident_id,
        }

    except HTTPException:
        raise

    except Exception as e:
        if conn:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to resolve incident: {str(e)}",
        )

    finally:
        if conn:
            conn.close()
