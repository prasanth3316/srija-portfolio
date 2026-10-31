// Cloudflare Worker: serves the static site from ./public and runs the
// visitor counter at /api/visit.
//   GET  /api/visit -> current totals
//   POST /api/visit -> count this visitor's country, then return totals
// Cloudflare supplies the visitor's country on request.cf, so no IP lookup
// service is used and no IP addresses are stored.

const KEY = "countries";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/visit") return visit(request, env);
    return env.ASSETS.fetch(request);
  },
};

async function visit(request, env) {
  if (!env.VISITS) return json({ error: "KV namespace VISITS is not bound" }, 500);

  const you = (request.cf && request.cf.country) || "XX";
  const countries = (await env.VISITS.get(KEY, "json")) || {};

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
