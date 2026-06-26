from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# TiDB Cloud connection details from environment
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")          # e.g., gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com
DB_PORT = os.getenv("DB_PORT", "4000")  # TiDB Cloud default port
DB_NAME = os.getenv("DB_NAME")          # Your database name, e.g., movie_platform
SSL_CA_PATH = os.getenv("SSL_CA_PATH", "ca.pem")  # Path to downloaded CA certificate

# Build connection URL with SSL
SQLALCHEMY_DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?ssl_ca={SSL_CA_PATH}&ssl_verify_cert=true&ssl_verify_identity=true"
)

# Create engine with pool settings for TiDB Cloud
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,      # Check connection before using
    pool_recycle=3600,       # Recycle connections after 1 hour
    pool_size=5,
    max_overflow=10,
    echo=False               # Set to True to see SQL logs
)

# Ensure database exists (TiDB Cloud's sys database is read-only, so we create our own)
def init_db():
    """Create database if it doesn't exist, then create tables."""
    # First connect without database name to create it
    temp_url = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/"
        f"?ssl_ca={SSL_CA_PATH}&ssl_verify_cert=true&ssl_verify_identity=true"
    )
    temp_engine = create_engine(temp_url, pool_pre_ping=True)
    with temp_engine.connect() as conn:
        conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}"))
        conn.commit()
        print(f"✅ Database '{DB_NAME}' is ready")
    # Now create tables
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created (or already exist)")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()