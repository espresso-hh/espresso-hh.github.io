# Double Espresso Tasting Sheet

This is a static GitHub Pages site. It needs no Flask server, database, account
password, build step, or third-party backend.

## View the site

Open the published GitHub Pages URL. The public page reads café reviews from
[`reviews.json`](./reviews.json), and review photos are served from
`assets/reviews/`.

Each review has a `category` field in `reviews.json`:

- Use `"home"` for espresso made at home.
- Use `"cafe"` for espresso tasted at a café.

Reviews and photos can be added or changed directly in `reviews.json` and
`assets/reviews/`, then published by committing the changes to GitHub.

The page can also be tested locally with any static-file server. For example:

```sh
python3 -m http.server
```

Then open <http://localhost:8000>. Opening the HTML file directly with `file://`
may prevent the browser from loading `reviews.json`.
