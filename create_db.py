# create_db.py
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# Your TiDB Cloud credentials
connection = pymysql.connect(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", 4000)),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database="sys",  # Use sys as default
    ssl_verify_cert=True,
    ssl_verify_identity=True,
    ssl_ca=os.getenv("SSL_CA_PATH", "ca.pem")
)

try:
    with connection.cursor() as cursor:
        db_name = os.getenv("DB_NAME")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        print(f"✅ Database '{db_name}' created successfully!")
finally:
    connection.close()