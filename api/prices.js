// Vercel Edge Function — server-side proxy to the Aviasales Data API.
//
// Why: the API token must never appear in browser-side code. The browser hits
// our own /api/prices endpoint; we read the token from a Vercel Environment
// Variable, call Travelpayouts, and return only the price data the UI needs.
//
// Endpoint: GET /api/prices?origin=TLV&destination=NRT
// Returns:  { direct: 612, oneStop: 540, twoStop: 480, currency: 'USD', source: 'aviasales' }
//
// In-memory cache (1 hour) survives across warm invocations within the same
// Edge worker instance — keeps us well under any unstated rate limits.

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
    // v1 "cheap" endpoint — returns the cheapest known flight for each
    // transfer count (0, 1, 2) over a recent window. Best fit for our
    // "show indicative prices on the globe" use case.
    const apiUrl =
      `https://api.travelpayouts.com/v1/prices/cheap` +
      `?origin=${origin}&destination=${destination}` +
      `&currency=usd&token=${token}`;

    const resp = await fetch(apiUrl, {
      headers: { 'Accept-Encoding': 'gzip' },
      // 6-second budget — well under Vercel's 25s default for edge
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      return json({ error: `Travelpayouts returned ${resp.status}` }, 502);
    }

    const body = await resp.json();
    if (!body?.success) {
      return json({ error: 'Travelpayouts returned no data', raw: body }, 502);
    }

    // Response shape: { data: { [destination]: { "0": {...}, "1": {...} } } }
    // Each entry has fields: price, airline, flight_number, transfers,
    // departure_at, return_at, expires_at.
    const flights = Object.values(body.data?.[destination] || {});

    // For each transfer count, pick the cheapest entry seen.
    const cheapestBy = (transfers) =>
      flights
        .filter(f => f.transfers === transfers)
        .reduce((min, f) => (min == null || f.price < min.price ? f : min), null);

    const d  = cheapestBy(0);
    const s1 = cheapestBy(1);
    const s2 = cheapestBy(2);

    const result = {
      direct:   d  ? { price: d.price,  airline: d.airline,  departure_at: d.departure_at  } : null,
      oneStop:  s1 ? { price: s1.price, airline: s1.airline, departure_at: s1.departure_at } : null,
      twoStop:  s2 ? { price: s2.price, airline: s2.airline, departure_at: s2.departure_at } : null,
      currency: 'USD',
      source:   'aviasales',
      origin, destination,
      fetched_at: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return json(result, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    return json({ error: 'Upstream fetch failed', message: String(err) }, 502);
  }
}
