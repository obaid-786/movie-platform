from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import Movie, User
from backend import auth
import json
from backend.utils.import_json import import_movies_from_json

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(auth.get_current_admin),
):
    total_movies = db.query(Movie).count()
    total_users = db.query(User).count()
    avg_rating = db.query(func.avg(Movie.averageRating)).scalar()
    type_counts = (
        db.query(Movie.type, func.count(Movie.id)).group_by(Movie.type).all()
    )
    return {
        "total_movies": total_movies,
        "total_users": total_users,
        "average_rating": float(avg_rating or 0),
        "type_distribution": [{"type": t, "count": c} for t, c in type_counts],
    }


# BUG FIX 5: Added db: Session = Depends(get_db) parameter and pass it to
# import_movies_from_json. Previously the function was called without a db
# session, so any DB writes inside import_json.py would fail.
@router.post("/upload-json")
async def upload_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(auth.get_current_admin),
):
    if not file.filename.endswith(".json"):
        raise HTTPException(400, "Only JSON files allowed")
    content = await file.read()
    data = json.loads(content)
    import_movies_from_json(db, data)   # ← db is now passed correctly
    return {"message": "Data imported successfully"}


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(auth.get_current_admin),
):
    users = db.query(User).all()
    return users


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(auth.get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"ok": True}