# Double Espresso Tasting Sheet

The tasting sheet uses a Flask API and SQLAlchemy to store café visits in a
local SQLite database.

## Run locally

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5000> in a browser. Keep the server running while using
the page; opening `index.html` directly will not connect to the database.

By default the database is created at `data/espresso.db`. To select a different
SQLAlchemy database URL, set `ESPRESSO_DATABASE_URL` before starting the app.

## Data model

- `cafes` stores each café once by name.
- `tastings` stores each visit, its date, single and double espresso prices,
  written impression, and calculated score.
- `ratings` stores each individual criterion score for a tasting.

Existing tasting entries in this browser's local storage are imported when the
page is next opened through the Flask server. The browser copy is removed only
after the import completes.

## Tests

```sh
python -m unittest discover -s tests
```
