import boto3, os, uuid
from datetime import datetime

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

dynamo = boto3.resource("dynamodb", region_name=AWS_REGION)

table = dynamo.Table(os.environ["DYNAMO_TABLE"])

def log_event(event, user, incident_id):
    table.put_item(
        Item={
            "event_id": str(uuid.uuid4()),
            "incident_id": str(incident_id),
            "event": event,
            "user_id": user["sub"],
            "timestamp": datetime.utcnow().isoformat()
        }
    )
