# Srija Gummadi, portfolio

A static site (plain HTML, CSS and JavaScript; no build step) plus one Cloudflare Pages Function that counts visitors by country.

```
public/index.html       page content
public/styles.css       styles
public/main.js          loader, robot cell, section animations, PID demo, visitor table
functions/api/visit.js  visitor counter (runs on Cloudflare)

Only public/ (plus functions/) is deployed, so Resume-2.pdf and the .claude folder stay private.
```

## Preview locally

```
npx wrangler pages dev public --kv VISITS
```

Open the URL it prints. The visitor counter works locally too (your country shows as whatever Cloudflare's dev server reports).
Opening `public/index.html` directly also works, but the visitor section will show a setup message because there's no `/api/visit` endpoint.

## Deploy (free) with visitor counts

1. Create a free Cloudflare account.
2. Create the KV store: `npx wrangler kv namespace create VISITS`
3. Deploy: `npx wrangler pages deploy public --project-name srija-portfolio`
4. In the Cloudflare dashboard: Workers & Pages → srija-portfolio → Settings → Bindings → add a **KV namespace** binding named `VISITS` pointing at the namespace from step 2. Redeploy (repeat step 3).

Each browser is counted once (a flag in localStorage). Only country codes are stored, never IP addresses.

## Editing content

All text is in `public/index.html`. Experience rungs are the `<li class="rung">` blocks; projects are the `<article class="sheet">` blocks; skills are the `.module` lists.
