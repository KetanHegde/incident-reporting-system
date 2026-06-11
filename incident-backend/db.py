import os
import pymysql


def get_db():
    """
    Create and return a PyMySQL connection.

    Required environment variables:
    DB_HOST
    DB_NAME
    DB_USER
    DB_PASSWORD

    Optional:
    DB_PORT default 3306
    """

    required_envs = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]

    for env in required_envs:
        if not os.getenv(env):
            raise RuntimeError(f"{env} is not set")

    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=10,
        charset="utf8mb4",
    )
