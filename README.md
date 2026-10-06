# Double Espresso Tasting Sheet

This is a static GitHub Pages site. It needs no Flask server, database, account
password, build step, or third-party backend.

## View the site

Open the published GitHub Pages URL. The public page reads café reviews from
[`reviews.json`](./reviews.json), and review photos are served from
`assets/reviews/`.

Each review has a `category` field in `reviews.json`, which determines which
criteria are shown:

- Use `"home"` for espresso made at home.
- Use `"cafe"` for espresso tasted at a café.

Home reviews use `roasting_date`, `price_per_250g`, and `recipe` instead of
visit date and espresso-shot prices. Use an ISO date such as `"2026-09-20"` for
`roasting_date`, a number in euros for `price_per_250g`, and text describing
the recipe (for example, `"18g coffee in, 36g espresso out, 28 seconds."`).

Café reviews keep the original `date`, `double_price`, and `single_price`
fields; they do not need home coffee's roasting date, bag price, or recipe.

Home reviews use criteria about the beans and preparation, taste, and cup
consistency. Café reviews use criteria about taste, texture and finish, and the
café experience. The category-specific criteria and their order are defined in
`assets/js/criteria.js`; the order must match the keys in each review's
`ratings` object (for example, `"0-0"` is the first criterion in the first
group).

Each criterion has equal weight. For each of the three groups, the page
calculates the average of its rated criteria (out of 5), then adds those three
group averages for an overall score out of 15. Reviews are ranked by this
calculated score; it is not stored separately in `reviews.json`.

This is a static GitHub Pages site, so the browser cannot save new reviews back
into `reviews.json`. Add or edit review objects in that file, set their
`category` to `"home"` or `"cafe"`, and commit the changes along with any photos
in `assets/reviews/`.

The page can also be tested locally with any static-file server. For example:

```sh
python3 -m http.server
```

Then open <http://localhost:8000>. Opening the HTML file directly with `file://`
may prevent the browser from loading `reviews.json`.

## Blog posts

Open `blog-posts.json` and add a post object to its top-level array. Each post
has an `image` path, `heading`, `subheading`, `paragraphs` array, `signature`,
and ISO `date` (for example, `"2026-10-07"`). Put image files in
`assets/reviews/` and set `image` to their relative path, such as
`"assets/reviews/my-coffee.jpg"`. The blog page displays newest posts first.

For example:

```json
{
  "image": "assets/reviews/my-coffee.jpg",
  "image_alt": "A cup of coffee by the window",
  "heading": "A new coffee discovery",
  "subheading": "A short introduction to the post",
  "paragraphs": [
    "First paragraph of the post.",
    "Second paragraph of the post."
  ],
  "signature": "Your name",
  "date": "2026-10-07"
}
```

The site is static, so posts are published by committing the JSON and image
files; the page does not save edits made in the browser.
