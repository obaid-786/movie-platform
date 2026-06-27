from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Movie

router = APIRouter(prefix="/api/movies", tags=["Movies"])


# BUG FIX 1: Changed @router.get("/") → @router.get("")
# With prefix="/api/movies", get("/") registers /api/movies/ (trailing slash).
# The frontend fetches /api/movies (no slash). StaticFiles at "/" intercepted the
# redirect → 404. Using "" registers exactly /api/movies with no trailing slash.

# BUG FIX 4: Added search, genre, year_from, year_to, min_rating filters —
# they were accepted as query params but completely ignored before.

@router.get("")
def list_movies(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: str = Query(""),
    genre: str = Query(""),
    year_from: str = Query(""),
    year_to: str = Query(""),
    min_rating: str = Query(""),
    db: Session = Depends(get_db),
):
    query = db.query(Movie)

    if search:
        query = query.filter(Movie.primaryTitle.ilike(f"%{search}%"))
    if genre:
        query = query.filter(Movie.genres.ilike(f"%{genre}%"))
    if year_from:
        query = query.filter(Movie.startYear >= int(year_from))
    if year_to:
        query = query.filter(Movie.startYear <= int(year_to))
    if min_rating:
        query = query.filter(Movie.averageRating >= float(min_rating))

    total = query.count()
    movies = query.offset((page - 1) * per_page).limit(per_page).all()

    items = [
        {
            "id": m.id,
            "primaryTitle": m.primaryTitle,
            "type": m.type,
            "startYear": m.startYear,
            "averageRating": m.averageRating,
        }
        for m in movies
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/test")
def test():
    return {"message": "movies router works"}


# BUG FIX 3: Added GET /{id} — viewMovieDetail() in main.js calls this
# endpoint but it didn't exist, causing a 404 on movie detail view.
@router.get("/{movie_id}")
def get_movie(movie_id: str, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return {col.name: getattr(movie, col.name) for col in movie.__table__.columns}


# BUG FIX 3 (cont): Added DELETE /{id} — the delete button in main.js
# calls this endpoint but it didn't exist either.
# AUTH REMOVED: this app no longer has user accounts, so the admin check
# (Depends(auth.get_current_admin)) has been dropped — this endpoint is
# now open to anyone who can reach it.
@router.delete("/{movie_id}")
def delete_movie(
    movie_id: str,
    db: Session = Depends(get_db),
):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    db.delete(movie)
    db.commit()
    return {"ok": True}