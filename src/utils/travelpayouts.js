// Client-side glue for Travelpayouts integration.
// Public values only — the API token lives server-side in the Edge Function.

// Public affiliate ID. Safe to ship in browser code; appears in every
// deep-link URL so Travelpayouts can attribute clicks back to this account.
export const TRAVELPAYOUTS_MARKER = '744341';

// The White Label search front-end that handles real-time search + checkout.
// Lives on a CNAME pointed at hosting.travelpayouts.com.
export const WHITE_LABEL_URL = 'https://flights.fly-taco.com';

// ── Deep-link builder ────────────────────────────────────────────────────────
// Aviasales URL format (used by the White Label too):
//   /searches/{ORIGIN}{DDMM_DEPART}{DDMM_RETURN}{DESTINATION}{ADULTS}
// e.g.  TLV1508NRT1        → one-way TLV→NRT on Aug 15, 1 adult
//       TLV15082508NRT2    → round-trip TLV→NRT, Aug 15 / Aug 25, 2 adults

const pad2 = (n) => String(n).padStart(2, '0');

function ddmm(isoDate) {
  if (!isoDate) return '';
  // Accepts "YYYY-MM-DD" or Date
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (isNaN(d.getTime())) return '';
  return pad2(d.getDate()) + pad2(d.getMonth() + 1);
}

export function buildBookingUrl({
  origin,
  destination,
  departDate,
  returnDate,
  adults = 1,
}) {
  if (!origin || !destination) return WHITE_LABEL_URL;

  const path =
    origin.toUpperCase() +
    ddmm(departDate) +
    ddmm(returnDate) +
    destination.toUpperCase() +
    Math.max(1, Math.min(9, adults));

  return `${WHITE_LABEL_URL}/searches/${path}?marker=${TRAVELPAYOUTS_MARKER}`;
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
