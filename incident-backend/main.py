from fastapi import FastAPI, Depends, HTTPException
from dotenv import load_dotenv
load_dotenv()

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware

import os
import boto3
import requests

from auth import authorize_token, admin_only
from db import get_db
from dynamo import log_event

# -------------------------------------------------
# Load environment
# -------------------------------------------------

AWS_REGION = os.getenv("AWS_REGION")
if not AWS_REGION:
    raise RuntimeError("AWS_REGION is not set")

# -------------------------------------------------
# FastAPI app
# -------------------------------------------------
app = FastAPI(title="Incident Backend API")


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
# AWS clients (explicit region = REQUIRED)
# -------------------------------------------------
s3 = boto3.client("s3", region_name=AWS_REGION)

# -------------------------------------------------
# Security (Swagger-aware)
# -------------------------------------------------
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """
    Validates JWT and returns user claims.
    Locks Swagger with Bearer auth.
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
# Health check (ALB)
# -------------------------------------------------
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}


# -------------------------------------------------
# User APIs (🔒)
# -------------------------------------------------
@app.post("/incident", tags=["User"])
def create_incident(
    data: dict,
    user: dict = Depends(get_current_user),
):
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        """
        INSERT INTO incidents (user_id, incident_name, description, priority)
        VALUES (%s,%s,%s,%s)
        RETURNING id
        """,
        (
            user["sub"],
            data["incident_name"],
            data["description"],
            data["priority"],
        ),
    )

    incident_id = cur.fetchone()[0]
    conn.commit()
    conn.close()

    log_event(f"incident-{incident_id} created", user, incident_id)

    screenshot_key = f"screenshots/{incident_id}.png"
    cur.execute(
        """
        UPDATE incidents
        SET screenshot_key = %s
        WHERE id = %s
        """,
        (screenshot_key, incident_id),
    )
    conn.commit()

    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": os.environ["S3_BUCKET"],
            "Key": screenshot_key,
        },
        ExpiresIn=300,
    )

    return {
        "incident_id": incident_id,
        "uploadUrl": upload_url,
    }


@app.get("/incident/my", tags=["User"])
def my_incidents(
    user: dict = Depends(get_current_user),
):
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "SELECT * FROM incidents WHERE user_id=%s",
        (user["sub"],),
    )
    rows = cur.fetchall()
    conn.close()

    return rows


# -------------------------------------------------
# Admin APIs (🔒🔒)
# -------------------------------------------------
@app.post("/admin/resolve/{incident_id}", tags=["Admin"])
def resolve_incident(
    incident_id: int,
    user: dict = Depends(get_admin_user),
):
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        "UPDATE incidents SET status='RESOLVED' WHERE id=%s",
        (incident_id,),
    )
    conn.commit()
    conn.close()

    log_event(f"incident-{incident_id} resolved", user, incident_id)

    return {"status": "resolved"}
