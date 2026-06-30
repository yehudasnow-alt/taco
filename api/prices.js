// Vercel Edge Function — server-side proxy to the Aviasales Data API.
//
// Strategy: try v2/prices/latest first (broadest data, returns recent prices
// from anywhere in the network), then fall back to v1/prices/cheap if v2
// returns nothing. This dual-source approach catches the majority of routes
// — including less-popular ones like TLV→NRT — where a single endpoint may
// have stale or no cached prices.
//
// The token never appears in browser code. It's read from a Vercel Environment
// Variable and only used in server-side fetch calls.
//
// Endpoint: GET /api/prices?origin=TLV&destination=NRT
// Returns:  {
//   direct:  { price: 612, airline: 'SU', depart_date: '2026-08-15' } | null,
//   oneStop: { price: 480, airline: 'TK', depart_date: '2026-08-15' } | null,
//   twoStop: { price: 425, airline: '...', depart_date: '...' } | null,
//   currency: 'USD',
//   source:   'aviasales-latest' | 'aviasales-cheap' | 'aviasales-mixed',
//   ...
// }

export const config = { runtime: 'edge' };

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

// ── Source 1: v2/prices/latest ───────────────────────────────────────────────
// Best coverage — returns recent prices for the route across the whole network.
// Response shape: { success, data: [ { value, origin, destination, gate,
//   depart_date, number_of_changes, duration }, ... ] }
async function fetchLatest(origin, destination, token) {
  const url =
    `https://api.travelpayouts.com/v2/prices/latest` +
    `?currency=usd` +
    `&origin=${origin}` +
    `&destination=${destination}` +
    `&period_type=year` +
    `&page=1&limit=30` +
    `&show_to_affiliates=true` +
    `&sorting=price` +
    `&one_way=true` +
    `&token=${token}`;

  const resp = await fetch(url, {
    headers: { 'Accept-Encoding': 'gzip' },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) return null;

  const body = await resp.json();
  if (!body?.success || !Array.isArray(body.data) || body.data.length === 0) return null;

  return body.data.map(d => ({
    price:        d.value,
    airline:      d.gate || null,
    depart_date:  d.depart_date || null,
    transfers:    Number(d.number_of_changes ?? 0),
  }));
}

// ── Source 2: v1/prices/cheap ────────────────────────────────────────────────
// Narrower — has the cheapest known by transfer count, but doesn't cover every
// route. Useful as fallback when /latest returns nothing.
async function fetchCheap(origin, destination, token) {
  const url =
    `https://api.travelpayouts.com/v1/prices/cheap` +
    `?currency=usd` +
    `&origin=${origin}` +
    `&destination=${destination}` +
    `&token=${token}`;

  const resp = await fetch(url, {
    headers: { 'Accept-Encoding': 'gzip' },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) return null;

  const body = await resp.json();
  if (!body?.success) return null;

  const entries = Object.values(body.data?.[destination] || {});
  if (entries.length === 0) return null;

  return entries.map(d => ({
    price:        d.price,
    airline:      d.airline || null,
    depart_date:  d.departure_at || null,
    transfers:    Number(d.transfers ?? 0),
  }));
}

// Pick cheapest entry matching the given transfer count (0=direct, 1, 2, ...)
function cheapestByTransfers(rows, transfers) {
  let best = null;
  for (const r of rows) {
    if (r.transfers !== transfers) continue;
    if (!best || r.price < best.price) best = r;
  }
  return best
    ? { price: best.price, airline: best.airline, depart_date: best.depart_date }
    : null;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url         = new URL(req.url);
  const origin      = (url.searchParams.get('origin')      || '').toUpperCase();
  const destination = (url.searchParams.get('destination') || '').toUpperCase();

  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
    return json({ error: 'origin and destination must be 3-letter IATA codes' }, 400);
  }
  if (origin === destination) {
    return json({ error: 'origin and destination must differ' }, 400);
  }

  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    return json({ error: 'Server missing TRAVELPAYOUTS_API_TOKEN' }, 500);
  }

  const cacheKey = `${origin}-${destination}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return json(cached.data, 200, { 'X-Cache': 'HIT' });
  }

  try {
    // Try both sources in parallel — even if /latest has data, /cheap might
    // have a better transfer-count match. Merging both gives the best coverage.
    const [latestRows, cheapRows] = await Promise.allSettled([
      fetchLatest(origin, destination, token),
      fetchCheap(origin, destination, token),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

    const allRows = [
      ...(latestRows || []),
      ...(cheapRows  || []),
    ];

    if (allRows.length === 0) {
      // Cache the empty result for a shorter time so we re-check sooner.
      const empty = {
        direct: null, oneStop: null, twoStop: null,
        currency: 'USD', source: 'aviasales-empty',
        origin, destination,
        fetched_at: new Date().toISOString(),
        debug: 'Both endpoints returned no data — Aviasales has no cached prices for this route right now.',
      };
      cache.set(cacheKey, { data: empty, timestamp: Date.now() - CACHE_TTL_MS + 5 * 60 * 1000 });
      return json(empty, 200, { 'X-Cache': 'MISS', 'X-Source': 'empty' });
    }

    const result = {
      direct:   cheapestByTransfers(allRows, 0),
      oneStop:  cheapestByTransfers(allRows, 1),
      twoStop:  cheapestByTransfers(allRows, 2),
      currency: 'USD',
      source:   latestRows && cheapRows ? 'aviasales-mixed'
              : latestRows               ? 'aviasales-latest'
                                          : 'aviasales-cheap',
      origin, destination,
      fetched_at: new Date().toISOString(),
      total_rows: allRows.length,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return json(result, 200, { 'X-Cache': 'MISS', 'X-Source': result.source });
  } catch (err) {
    return json({ error: 'Upstream fetch failed', message: String(err) }, 502);
  }
}
