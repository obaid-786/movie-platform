from sqlalchemy.orm import Session
from backend import models, schemas

def get_movie(db: Session, movie_id: str):
    return db.query(models.Movie).filter(models.Movie.id == movie_id).first()

def get_movies(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Movie).offset(skip).limit(limit).all()

def create_movie(db: Session, movie: schemas.MovieCreate):
    db_movie = models.Movie(**movie.dict())
    db.add(db_movie)
    db.commit()
    db.refresh(db_movie)
    return db_movie

def update_movie(db: Session, movie_id: str, movie_update: schemas.MovieUpdate):
    db_movie = get_movie(db, movie_id)
    if not db_movie:
        return None
    for key, value in movie_update.dict(exclude_unset=True).items():
        setattr(db_movie, key, value)
    db.commit()
    db.refresh(db_movie)
    return db_movie

def delete_movie(db: Session, movie_id: str):
    db_movie = get_movie(db, movie_id)
    if not db_movie:
        return False
    db.delete(db_movie)
    db.commit()
    return True