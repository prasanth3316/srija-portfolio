# Srija Gummadi, portfolio

A static site (plain HTML, CSS and JavaScript; no build step) served by a small Cloudflare Worker that also counts visitors by country.

```
public/index.html   page content
public/styles.css   styles
public/main.js      loader, robot cell, station layout, PID demo, floor plan, contact station
src/worker.js       serves public/ and runs the visitor counter at /api/visit
wrangler.jsonc      Cloudflare config: site folder and the VISITS storage binding
```

## Deploy on Cloudflare (Workers, connected to GitHub)

1. Cloudflare dashboard → Storage & Databases → KV → Create a namespace (e.g. `portfolio-visits`). Copy its **ID**.
2. Workers & Pages → Create → Import a repository → pick this repo. Defaults are fine (deploy command `npx wrangler deploy`).
   The Worker name in Cloudflare must match `"name"` in `wrangler.jsonc` (`srija-portfolio`).

Every push to `main` redeploys. The storage binding comes from `wrangler.jsonc`, so there's nothing to add under Settings → Bindings.

Each browser is counted once (a flag in localStorage). Only country codes are stored, never IP addresses.

## Preview locally

```
npx wrangler dev
```

## Editing content

All text is in `public/index.html`.
