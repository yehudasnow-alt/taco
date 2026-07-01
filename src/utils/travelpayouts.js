// Client-side glue for Travelpayouts integration.
// Public values only — the API token lives server-side in the Edge Function.

// Public affiliate ID. Safe to ship in browser code; appears in every
// deep-link URL so Travelpayouts can attribute clicks back to this account.
export const TRAVELPAYOUTS_MARKER = '744341';

// The White Label search front-end that handles real-time search + checkout.
// Lives on a CNAME pointed at hosting.travelpayouts.com.
export const WHITE_LABEL_URL = 'https://flights.fly-taco.com';

// ── Deep-link builder ────────────────────────────────────────────────────────
// White Label Web URL format (per Travelpayouts docs referenced by support):
//   /?flightSearch={ORIGIN}{DDMM_DEPART}{DESTINATION}{DDMM_RETURN}{CLASS}{ADULTS}[CHILDREN][INFANTS]
// e.g.  TLV1508NRT1         → one-way TLV→NRT on Aug 15, economy, 1 adult
//       TLV1508NRT2508c1    → round-trip Aug 15 / Aug 25, business, 1 adult
//       MOW1607IST2007c321  → round-trip Moscow→Istanbul, business, 3 adults + 2 children + 1 infant
//
// Class char: empty = economy (default), 'c' = business, 'f' = first, 'w' = comfort.
// Origin/destination MUST be 3-letter IATA in uppercase Latin letters.
// A departure date is required for the search form to prefill; if none was
// picked in Taco, we default to +30 days so the White Label still lands on
// a real search page instead of the empty homepage.

const pad2 = (n) => String(n).padStart(2, '0');

function ddmm(isoDate) {
  if (!isoDate) return '';
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (isNaN(d.getTime())) return '';
  return pad2(d.getDate()) + pad2(d.getMonth() + 1);
}

function defaultFutureIsoDate(daysAhead = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function buildBookingUrl({
  origin,
  destination,
  departDate,
  returnDate,
  adults    = 1,
  tripClass = '', // '' = economy, 'c' = business, 'f' = first, 'w' = comfort
}) {
  if (!origin || !destination) {
    return `${WHITE_LABEL_URL}/?marker=${TRAVELPAYOUTS_MARKER}`;
  }

  const depart = departDate || defaultFutureIsoDate(30);
  const clamped = Math.max(1, Math.min(9, Number(adults) || 1));

  const flightSearch =
    origin.toUpperCase()      +
    ddmm(depart)              +
    destination.toUpperCase() +
    (returnDate ? ddmm(returnDate) : '') +
    (tripClass || '')         +
    String(clamped);

  return `${WHITE_LABEL_URL}/?flightSearch=${flightSearch}&marker=${TRAVELPAYOUTS_MARKER}`;
}

// ── Price fetch from our own Edge Function ───────────────────────────────────
// Returns { direct, oneStop, twoStop } or null on any failure. Always non-throwing
// so the UI can render with estimates when the API is unreachable.

export async function fetchPrices(originIata, destinationIata) {
  if (!originIata || !destinationIata) return null;
  if (originIata === destinationIata)   return null;
  try {
    const url = `/api/prices?origin=${encodeURIComponent(originIata)}` +
                `&destination=${encodeURIComponent(destinationIata)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
