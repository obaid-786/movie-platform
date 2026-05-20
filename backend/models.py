from sqlalchemy import Column, Integer, String, Float, Boolean, Date
from backend.database import Base

class Movie(Base):
    __tablename__ = "movies"
    id = Column(String(20), primary_key=True, index=True)
    url = Column(String(500))
    primaryTitle = Column(String(500), nullable=False, index=True)
    originalTitle = Column(String(500))
    type = Column(String(50))
    description = Column(String(2000))
    primaryImage = Column(String(500))
    trailer = Column(String(500))
    contentRating = Column(String(20))
    isAdult = Column(Boolean, default=False)
    releaseDate = Column(Date)
    startYear = Column(Integer)
    endYear = Column(Integer, nullable=True)
    runtimeMinutes = Column(Integer, nullable=True)
    budget = Column(Integer, nullable=True)
    grossWorldwide = Column(Integer, nullable=True)
    averageRating = Column(Float)
    numVotes = Column(Integer)
    metascore = Column(Integer, nullable=True)

    # JSON fields as strings (no foreign keys)
    genres = Column(String(500))
    interests = Column(String(500))
    countriesOfOrigin = Column(String(200))
    spokenLanguages = Column(String(200))
    filmingLocations = Column(String(1000))
    externalLinks = Column(String(1000))
    productionCompanies = Column(String(1000))
    thumbnails = Column(String(2000))

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    username = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(Date)