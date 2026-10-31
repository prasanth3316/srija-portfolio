// Cloudflare Pages Function: /api/visit
// GET  -> current totals
// POST -> count this visitor's country, then return totals
// Needs a KV namespace bound as VISITS (see README.md).
// Cloudflare supplies the visitor's country on request.cf, so no IP lookup service and no IPs stored.

const KEY = "countries";

export async function onRequest({ request, env }) {
  if (!env.VISITS) {
    return json({ error: "KV namespace VISITS is not bound" }, 500);
  }

  const you = (request.cf && request.cf.country) || "XX";
  let countries = (await env.VISITS.get(KEY, "json")) || {};

  if (request.method === "POST") {
    countries[you] = (countries[you] || 0) + 1;
    await env.VISITS.put(KEY, JSON.stringify(countries));
  } else if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const total = Object.values(countries).reduce((a, b) => a + b, 0);
  return json({ total, countries, you });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
