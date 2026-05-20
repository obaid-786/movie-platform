import json
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Movie, User
from datetime import datetime
from backend.auth import get_password_hash

def import_movies_from_json(json_path: str):
    db = SessionLocal()
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    for item in data:
        # Skip if movie already exists
        if db.query(Movie).filter(Movie.id == item['id']).first():
            print(f"Skipping existing movie: {item['id']}")
            continue

        release_date = None
        if item.get('releaseDate'):
            try:
                release_date = datetime.strptime(item['releaseDate'], '%Y-%m-%d').date()
            except:
                pass

        movie = Movie(
            id=item['id'],
            url=item.get('url'),
            primaryTitle=item.get('primaryTitle'),
            originalTitle=item.get('originalTitle'),
            type=item.get('type'),
            description=item.get('description'),
            primaryImage=item.get('primaryImage'),
            trailer=item.get('trailer'),
            contentRating=item.get('contentRating'),
            isAdult=item.get('isAdult', False),
            releaseDate=release_date,
            startYear=item.get('startYear'),
            endYear=item.get('endYear'),
            runtimeMinutes=item.get('runtimeMinutes'),
            budget=item.get('budget'),
            grossWorldwide=item.get('grossWorldwide'),
            averageRating=item.get('averageRating'),
            numVotes=item.get('numVotes'),
            metascore=item.get('metascore'),
            # Convert lists to JSON strings
            genres=json.dumps(item.get('genres', [])),
            interests=json.dumps(item.get('interests', [])),
            countriesOfOrigin=json.dumps(item.get('countriesOfOrigin', [])),
            spokenLanguages=json.dumps(item.get('spokenLanguages', [])),
            filmingLocations=json.dumps(item.get('filmingLocations', [])),
            externalLinks=json.dumps(item.get('externalLinks', [])),
            productionCompanies=json.dumps(item.get('productionCompanies', [])),
            thumbnails=json.dumps(item.get('thumbnails', []))
        )
        db.add(movie)
        count += 1

    db.commit()
    db.close()
    print(f"Imported {count} movies successfully!")

if __name__ == "__main__":
    import_movies_from_json("movies.json")