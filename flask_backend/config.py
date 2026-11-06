import os
import pg8000
import sqlalchemy
from google.cloud.sql.connector import Connector, IPTypes

# Instance Connection Name untuk Cloud SQL di region asia-southeast1
DEFAULT_INSTANCE_CONNECTION_NAME = "absolute-booth-qggh3:asia-southeast1:ai-studio-edeee265"

# Inisialisasi Cloud SQL Python Connector global agar connection pooling efisien
connector = Connector()


def getconn() -> pg8000.dbapi.Connection:
    """
    Membuka koneksi terenkripsi IAM/TLS ke Google Cloud SQL (PostgreSQL)
    di region asia-southeast1 menggunakan Cloud SQL Python Connector.
    """
    instance_connection_name = os.environ.get(
        "INSTANCE_CONNECTION_NAME",
        DEFAULT_INSTANCE_CONNECTION_NAME,
    )
    db_user = os.environ.get("SQL_USER", "postgres")
    db_pass = os.environ.get("SQL_PASSWORD", "")
    db_name = os.environ.get("SQL_DB_NAME", "postgres")
    ip_type = IPTypes.PRIVATE if os.environ.get("PRIVATE_IP") else IPTypes.PUBLIC

    conn: pg8000.dbapi.Connection = connector.connect(
        instance_connection_name,
        "pg8000",
        user=db_user,
        password=db_pass,
        db=db_name,
        ip_type=ip_type,
    )
    return conn


def create_cloudsql_engine() -> sqlalchemy.engine.Engine:
    """
    Membuat SQLAlchemy Engine menggunakan Cloud SQL Python Connector creator.
    """
    return sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=getconn,
        pool_size=5,
        max_overflow=2,
        pool_timeout=30,
        pool_recycle=1800,
    )


class Config:
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "sipemas-fatululi-kupang-secret-key")
    CLOUD_SQL_REGION = "asia-southeast1"
    INSTANCE_CONNECTION_NAME = os.environ.get(
        "INSTANCE_CONNECTION_NAME",
        DEFAULT_INSTANCE_CONNECTION_NAME,
    )
    SQLALCHEMY_DATABASE_URI = "postgresql+pg8000://"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "creator": getconn,
        "pool_size": 5,
        "max_overflow": 2,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    }
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # Maksimal unggah foto bukti 10 MB
