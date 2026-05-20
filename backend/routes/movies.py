from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json
from backend.database import get_db
from backend import schemas, auth
from backend.models import Movie, User

router = APIRouter(prefix="/api/movies", tags=["Movies"])

@router.get("/", response_model=schemas.PaginatedMovieResponse)
def list_movies(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: str = "",
    genre: str = None,
    year_from: int = None,
    year_to: int = None,
    min_rating: float = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user)
):
    query = db.query(Movie)
    if search:
        query = query.filter(or_(Movie.primaryTitle.ilike(f"%{search}%"), Movie.description.ilike(f"%{search}%")))
    if year_from:
        query = query.filter(Movie.startYear >= year_from)
    if year_to:
        query = query.filter(Movie.startYear <= year_to)
    if min_rating:
        query = query.filter(Movie.averageRating >= min_rating)

    total = query.count()
    movies = query.offset((page-1)*per_page).limit(per_page).all()
    
    # Convert JSON strings to lists for frontend convenience
    items = []
    for m in movies:
        item = m.__dict__.copy()
        for field in ['genres', 'interests', 'countriesOfOrigin', 'spokenLanguages', 'filmingLocations', 'externalLinks', 'productionCompanies', 'thumbnails']:
            if item.get(field):
                try:
                    item[field] = json.loads(item[field])
                except:
                    pass
        items.append(item)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page
    }

@router.get("/{movie_id}")
def get_movie(movie_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404)
    # Convert JSON strings
    result = movie.__dict__.copy()
    for field in ['genres', 'interests', 'countriesOfOrigin', 'spokenLanguages', 'filmingLocations', 'externalLinks', 'productionCompanies', 'thumbnails']:
        if result.get(field):
            try:
                result[field] = json.loads(result[field])
            except:
                pass
    return result

@router.post("/", response_model=schemas.MovieDetail)
def create_movie(movie: schemas.MovieCreate, db: Session = Depends(get_db), admin: User = Depends(auth.get_current_admin)):
    # Simplified creation – full implementation would handle nested relations
    new_movie = Movie(**movie.dict())
    db.add(new_movie)
    db.commit()
    db.refresh(new_movie)
    return new_movie

@router.put("/{movie_id}", response_model=schemas.MovieDetail)
def update_movie(movie_id: str, movie_update: schemas.MovieUpdate, db: Session = Depends(get_db), admin: User = Depends(auth.get_current_admin)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404)
    for key, value in movie_update.dict(exclude_unset=True).items():
        setattr(db_movie, key, value)
    db.commit()
    db.refresh(db_movie)
    return db_movie

@router.delete("/{movie_id}")
def delete_movie(movie_id: str, db: Session = Depends(get_db), admin: User = Depends(auth.get_current_admin)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404)
    db.delete(db_movie)
    db.commit()
    return {"ok": True}

@router.get("/test")
def test():
    return {"message": "movies router works"}