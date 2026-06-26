import json
import os
from datetime import date
from backend.database import SessionLocal
from backend.models import Movie
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def import_movies_from_json(file_path="movies.json"):
    """Read JSON file and insert all movies into the database."""
    if not os.path.exists(file_path):
        logging.error(f"File '{file_path}' not found.")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        logging.error("JSON root must be a list of objects.")
        return

    db = SessionLocal()
    added = 0
    skipped = 0
    batch_size = 100  # commit every 100 records to avoid memory issues
    batch = []

    for idx, item in enumerate(data, 1):
        # Required fields
        if "id" not in item or "primaryTitle" not in item:
            logging.warning(f"Skipping record {idx}: missing 'id' or 'primaryTitle'")
            skipped += 1
            continue

        # Check if movie already exists
        existing = db.query(Movie).filter(Movie.id == item["id"]).first()
        if existing:
            logging.info(f"Movie {item['id']} already exists, skipping.")
            skipped += 1
            continue

        try:
            # Convert releaseDate string to date object if present
            release_date = None
            if item.get("releaseDate"):
                release_date = date.fromisoformat(item["releaseDate"])

            # Convert array/object fields to JSON strings
            def to_json_str(value):
                if value is None:
                    return None
                if isinstance(value, (list, dict)):
                    return json.dumps(value, ensure_ascii=False)
                return str(value)  # fallback

            movie = Movie(
                id=item["id"],
                primaryTitle=item["primaryTitle"],
                originalTitle=item.get("originalTitle"),
                description=item.get("description"),
                primaryImage=item.get("primaryImage"),
                trailer=item.get("trailer"),
                contentRating=item.get("contentRating"),
                isAdult=item.get("isAdult", False),
                releaseDate=release_date,
                startYear=item.get("startYear"),
                endYear=item.get("endYear"),
                runtimeMinutes=item.get("runtimeMinutes"),
                budget=item.get("budget"),
                grossWorldwide=item.get("grossWorldwide"),
                averageRating=item.get("averageRating"),
                numVotes=item.get("numVotes"),
                metascore=item.get("metascore"),
                genres=to_json_str(item.get("genres")),
                interests=to_json_str(item.get("interests")),
                countriesOfOrigin=to_json_str(item.get("countriesOfOrigin")),
                spokenLanguages=to_json_str(item.get("spokenLanguages")),
                filmingLocations=to_json_str(item.get("filmingLocations")),
                externalLinks=to_json_str(item.get("externalLinks")),  # could be array or string
                productionCompanies=to_json_str(item.get("productionCompanies")),
                thumbnails=to_json_str(item.get("thumbnails")),
            )
            batch.append(movie)
            added += 1

            # Commit in batches
            if len(batch) >= batch_size:
                db.add_all(batch)
                db.commit()
                logging.info(f"Committed batch of {len(batch)} movies.")
                batch = []

        except Exception as e:
            logging.error(f"Error processing {item.get('id')}: {e}")
            skipped += 1

    # Commit remaining
    if batch:
        try:
            db.add_all(batch)
            db.commit()
            logging.info(f"Committed final batch of {len(batch)} movies.")
        except Exception as e:
            db.rollback()
            logging.error(f"Final commit failed: {e}")

    logging.info(f"✅ Import complete: {added} movies added, {skipped} skipped.")
    db.close()

if __name__ == "__main__":
    import_movies_from_json("movies.json")   # Change filename if needed