# Marketing site port

The tooling that moved the ten `mindelo.site` pages out of
`trinirugby/Mindelo-Website` and into `src/app/(site)/`.

It is kept because it is the evidence, not because it needs to run again. The
generated routes are ordinary source files now, edited by hand. If the old repo
is ever consulted again, this is what the transformation was.

## Files

- **`html2jsx.py`** — HTML to JSX. Deliberately narrow: it handles what these ten
  pages actually contain and raises on anything it does not recognise, rather
  than emitting subtly wrong JSX. Notably it restores `viewBox` casing, which
  Python's `HTMLParser` lowercases, and refuses to silently drop an inline event
  handler.
- **`generate_site.py`** — drives the conversion. Extracts `<head>` metadata into
  a Next `Metadata` export, scopes each page's CSS to `.site-root`, splices the
  inline scripts back at their original positions, and repoints the Netlify
  Function and Netlify Forms endpoints.
- **`compare_tokens.py`** — the check that made the port trustworthy. Compares
  visible text tokens and the CSS class multiset against saved copies of the
  live Netlify pages.

## Re-running the comparison

The baseline is not committed. Recreate it from any copy of the old site, then:

```
python scripts/site-port/compare_tokens.py <baseline-dir> https://mindelo.site
```

Two classes are expected on every route and are allow-listed: `site-root` and
the `next/font` variable class. Both come from the site layout.

## What the comparison caught

Worth knowing, because each looked fine until it was diffed:

- Descriptions containing an apostrophe were truncated at the apostrophe, because
  the obvious `content="..."` regex stops at the first quote of either kind.
- `noindex` was dropped from both `/demo/*` pages, which would have published two
  client demos that are deliberately hidden.
- `viewBox` arrived as `viewbox` and every SVG rendered at the wrong size.
- A comment sitting between two CSS rules was absorbed into the next rule's
  selector, producing `.site-root /* ... */ @keyframes` and killing the whole
  stylesheet.

The comparison also produced two false alarms that are worth not chasing again:
Netlify serves `&rarr;` as an entity while React emits the character, and Netlify
Forms rewrites the contact `<form>` tag using single quotes.
