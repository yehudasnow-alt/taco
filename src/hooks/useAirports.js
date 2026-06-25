import { useState, useEffect } from 'react';
import { AIRPORTS as STATIC } from '../data/airports';

const CSV_URL  = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const CACHE_KEY = 'taco_airports_v3';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Tier assignment ────────────────────────────────────────────────────────
// tier 0  ▸ Country primary hub — one per country, ALWAYS visible (the
//           orange "main" dots on the globe). Sourced from the curated static
//           list (primary: true). ~150-ish countries get one.
// tier 1  ▸ Secondary hub. Either a curated non-primary, or any large_airport
//           with scheduled service in OurAirports. Visible from zoom 4.5+.
// tier 2  ▸ Medium airport with scheduled service. Visible from zoom 5.5+.
// tier 3  ▸ Small airport with scheduled service. Visible from zoom 7+.

function assignStaticTiers(staticList) {
  return staticList.map(a => ({
    ...a,
    tier: a.primary ? 0 : 1,
  }));
}

// Pre-compute the tiered static list (always available, never empty)
const STATIC_TIERED = assignStaticTiers(STATIC);

// Simple CSV line parser (handles quoted commas)
function parseLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]).map(h => h.trim());
  const I = {
    type:    headers.indexOf('type'),
    name:    headers.indexOf('name'),
    lat:     headers.indexOf('latitude_deg'),
    lng:     headers.indexOf('longitude_deg'),
    country: headers.indexOf('iso_country'),
    city:    headers.indexOf('municipality'),
    sched:   headers.indexOf('scheduled_service'),
    iata:    headers.indexOf('iata_code'),
  };

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const v = parseLine(raw);

    const iata  = (v[I.iata]  || '').trim();
    if (iata.length !== 3) continue;

    const type  = (v[I.type]  || '').trim();
    if (!['large_airport', 'medium_airport', 'small_airport'].includes(type)) continue;

    const sched = (v[I.sched] || '').trim();
    if (sched !== 'yes') continue;

    const lat = parseFloat(v[I.lat]);
    const lng = parseFloat(v[I.lng]);
    if (isNaN(lat) || isNaN(lng)) continue;

    out.push({
      iata,
      name:    (v[I.name]    || '').trim().replace(/"/g, ''),
      city:    (v[I.city]    || '').trim().replace(/"/g, ''),
      country: (v[I.country] || '').trim(),
      lat, lng,
      _csvType: type, // remember type so we can tier later
    });
  }
  return out;
}

// ISO country code → friendly name (for display when joining with CSV)
const ISO_NAMES = {
  IL: 'Israel', US: 'USA', GB: 'UK', FR: 'France', DE: 'Germany', IT: 'Italy',
  ES: 'Spain', PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
  AT: 'Austria', PL: 'Poland', CZ: 'Czechia', HU: 'Hungary', RO: 'Romania',
  BG: 'Bulgaria', HR: 'Croatia', GR: 'Greece', TR: 'Turkey', IE: 'Ireland',
  DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', IS: 'Iceland',
  RU: 'Russia', UA: 'Ukraine', JP: 'Japan', CN: 'China', KR: 'South Korea',
  IN: 'India', TH: 'Thailand', VN: 'Vietnam', SG: 'Singapore', MY: 'Malaysia',
  ID: 'Indonesia', PH: 'Philippines', AU: 'Australia', NZ: 'New Zealand',
  AE: 'UAE', SA: 'Saudi Arabia', QA: 'Qatar', KW: 'Kuwait', BH: 'Bahrain',
  OM: 'Oman', JO: 'Jordan', LB: 'Lebanon', EG: 'Egypt', MA: 'Morocco',
  TN: 'Tunisia', DZ: 'Algeria', LY: 'Libya', ZA: 'South Africa', KE: 'Kenya',
  ET: 'Ethiopia', NG: 'Nigeria', GH: 'Ghana', CA: 'Canada', MX: 'Mexico',
  BR: 'Brazil', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru',
  VE: 'Venezuela', UY: 'Uruguay', PY: 'Paraguay', BO: 'Bolivia', EC: 'Ecuador',
  CR: 'Costa Rica', PA: 'Panama', DO: 'Dominican Rep.', CU: 'Cuba', JM: 'Jamaica',
  PR: 'Puerto Rico', BS: 'Bahamas', BB: 'Barbados', PK: 'Pakistan', BD: 'Bangladesh',
  LK: 'Sri Lanka', NP: 'Nepal', AF: 'Afghanistan', IR: 'Iran', IQ: 'Iraq',
  SY: 'Syria', YE: 'Yemen', UZ: 'Uzbekistan', KZ: 'Kazakhstan', GE: 'Georgia',
  AM: 'Armenia', AZ: 'Azerbaijan', BY: 'Belarus', LT: 'Lithuania', LV: 'Latvia',
  EE: 'Estonia', SK: 'Slovakia', SI: 'Slovenia', RS: 'Serbia', AL: 'Albania',
  MK: 'N. Macedonia', BA: 'Bosnia', MT: 'Malta', CY: 'Cyprus', LU: 'Luxembourg',
  TW: 'Taiwan', HK: 'Hong Kong', MO: 'Macau', MM: 'Myanmar', KH: 'Cambodia',
  LA: 'Laos', MN: 'Mongolia', BN: 'Brunei', FJ: 'Fiji',
};

// Merge static curated airports with CSV. Curated wins on duplicate IATA,
// keeping their `primary` flag (which determines tier 0).
function mergeAndTier(csvAirports) {
  const byIata = new Map();

  // 1. Curated airports first — they keep their tier 0/1 from `primary`.
  for (const a of STATIC_TIERED) {
    byIata.set(a.iata, a);
  }

  // 2. CSV airports — only added if not already in curated. Tier from size.
  for (const c of csvAirports) {
    if (byIata.has(c.iata)) continue; // curated wins
    const tier =
      c._csvType === 'large_airport'  ? 1 :
      c._csvType === 'medium_airport' ? 2 : 3;
    byIata.set(c.iata, {
      iata:    c.iata,
      name:    c.name,
      city:    c.city,
      country: ISO_NAMES[c.country] || c.country,
      lat:     c.lat,
      lng:     c.lng,
      tier,
      primary: false,
    });
  }

  return Array.from(byIata.values());
}

// In-memory cache shared across all hook callers in the session
let memCache = null;
let inFlight = null;

function readLocalCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeLocalCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota, private mode, etc. — silently ignore */ }
}

export function useAirports() {
  // Initial state: ALWAYS the curated list with tiers — never empty.
  const [airports, setAirports] = useState(memCache || STATIC_TIERED);
  const [loading,  setLoading]  = useState(!memCache);

  useEffect(() => {
    if (memCache) return; // already loaded in this session

    // Try local cache first — instant load on repeat visits
    const cached = readLocalCache();
    if (cached && Array.isArray(cached) && cached.length > 200) {
      memCache = cached;
      setAirports(cached);
      setLoading(false);
      return;
    }

    // Otherwise fetch CSV (shared promise so multiple hook instances don't double-fetch)
    if (!inFlight) {
      inFlight = fetch(CSV_URL)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then(parseCSV)
        .then(mergeAndTier)
        .then(data => { writeLocalCache(data); return data; })
        .catch(err => {
          // If the CSV fails (offline, CORS, etc.) fall back to curated static
          // — the user still sees the main hubs. Log so we know in dev.
          // eslint-disable-next-line no-console
          console.warn('[taco] airports CSV fetch failed, using static fallback:', err);
          return STATIC_TIERED;
        });
    }

    inFlight.then(data => {
      memCache = data;
      setAirports(data);
      setLoading(false);
    });
  }, []);

  return { airports, loading };
}

// Search helper for the picker autocomplete — uses whichever dataset is loaded.
export function searchAirports(query) {
  const list = memCache || STATIC_TIERED;
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return list.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    (a.city    && a.city.toLowerCase().includes(q)) ||
    (a.country && a.country.toLowerCase().includes(q))
  ).slice(0, 8);
}
