from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend.routes import auth, movies, admin
from backend.models import User  # to create tables
from sqlalchemy.orm import Session
from backend.auth import get_password_hash
import os

app = FastAPI(title="Dynamic Movie Platform")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Create tables
Base.metadata.create_all(bind=engine)

# Create default admin user if not exists
def create_default_admin():
    db = Session(bind=engine)
    if not db.query(User).filter(User.email == "admin@example.com").first():
        admin = User(
            email="admin@example.com",
            username="admin",
            full_name="Administrator",
            hashed_password=get_password_hash("admin123"),
            is_admin=True,
            is_active=True
        )
        db.add(admin)
        db.commit()
    db.close()

create_default_admin()

app.include_router(auth.router)
app.include_router(movies.router)
app.include_router(admin.router)

# Serve static frontend
os.makedirs("static", exist_ok=True)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)