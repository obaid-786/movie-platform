from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date

class MovieBase(BaseModel):
    primaryTitle: str
    originalTitle: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    primaryImage: Optional[str] = None
    trailer: Optional[str] = None
    contentRating: Optional[str] = None
    isAdult: bool = False
    releaseDate: Optional[date] = None
    startYear: Optional[int] = None
    endYear: Optional[int] = None
    runtimeMinutes: Optional[int] = None
    budget: Optional[int] = None
    grossWorldwide: Optional[int] = None
    averageRating: Optional[float] = None
    numVotes: Optional[int] = None
    metascore: Optional[int] = None
    # JSON fields as strings
    genres: Optional[str] = None
    interests: Optional[str] = None
    countriesOfOrigin: Optional[str] = None
    spokenLanguages: Optional[str] = None
    filmingLocations: Optional[str] = None
    externalLinks: Optional[str] = None
    productionCompanies: Optional[str] = None
    thumbnails: Optional[str] = None

class MovieCreate(MovieBase):
    pass

class MovieUpdate(BaseModel):
    primaryTitle: Optional[str] = None
    description: Optional[str] = None
    averageRating: Optional[float] = None
    # Add other fields if needed

class MovieResponse(MovieBase):
    id: str

    class Config:
        from_attributes = True

# ✅ Add MovieDetail for single movie view (could be same as response but we can extend)
class MovieDetail(MovieResponse):
    # If you need extra fields, add them here; otherwise it's the same as MovieResponse
    pass

class UserCreate(BaseModel):
    email: str
    username: str
    full_name: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    is_admin: bool

class PaginatedMovieResponse(BaseModel):
    items: List[MovieResponse]
    total: int
    page: int
    per_page: int
    total_pages: int