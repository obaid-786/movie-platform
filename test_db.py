from backend.database import engine, get_db
from sqlalchemy import text

def test_connection():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT VERSION()"))
            print("✅ Connected to TiDB Cloud!")
            print(f"Version: {result.fetchone()[0]}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    test_connection()