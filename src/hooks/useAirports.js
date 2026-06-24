import { useState, useEffect } from 'react';
import { AIRPORTS as CURATED } from '../data/airports';

// Public OurAirports dataset — ~10k rows, ~5MB. Filtered down to commercial
// scheduled service only, then merged with our curated list.
const CSV_URL    = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const CACHE_KEY  = 'taco_airports_v2';
const CACHE_TTL  = 7 * 24 * 60 * 60 * 1000; // 1 week

// ISO 3166-1 alpha-2 → friendly country name.
const ISO_NAMES = {
  IL:'Israel', US:'USA', GB:'UK', FR:'France', DE:'Germany', ES:'Spain', IT:'Italy',
  NL:'Netherlands', BE:'Belgium', CH:'Switzerland', AT:'Austria', GR:'Greece',
  PT:'Portugal', IE:'Ireland', SE:'Sweden', NO:'Norway', DK:'Denmark', FI:'Finland',
  IS:'Iceland', PL:'Poland', CZ:'Czechia', HU:'Hungary', RO:'Romania', BG:'Bulgaria',
  HR:'Croatia', SK:'Slovakia', SI:'Slovenia', LT:'Lithuania', LV:'Latvia', EE:'Estonia',
  LU:'Luxembourg', MT:'Malta', CY:'Cyprus', RS:'Serbia', BA:'Bosnia', ME:'Montenegro',
  MK:'North Macedonia', AL:'Albania', MD:'Moldova', BY:'Belarus', UA:'Ukraine',
  TR:'Turkey', RU:'Russia', GE:'Georgia', AM:'Armenia', AZ:'Azerbaijan',
  AE:'UAE', SA:'Saudi Arabia', QA:'Qatar', KW:'Kuwait', BH:'Bahrain', OM:'Oman',
  JO:'Jordan', LB:'Lebanon', SY:'Syria', IQ:'Iraq', IR:'Iran', YE:'Yemen',
  EG:'Egypt', MA:'Morocco', TN:'Tunisia', DZ:'Algeria', LY:'Libya', SD:'Sudan',
  ZA:'South Africa', KE:'Kenya', ET:'Ethiopia', NG:'Nigeria', GH:'Ghana', TZ:'Tanzania',
  UG:'Uganda', RW:'Rwanda', SN:'Senegal', CI:"Côte d'Ivoire", CM:'Cameroon',
  AO:'Angola', MZ:'Mozambique', ZW:'Zimbabwe', NA:'Namibia', BW:'Botswana',
  MG:'Madagascar', MU:'Mauritius', SC:'Seychelles', RE:'Réunion',
  IN:'India', CN:'China', HK:'Hong Kong', MO:'Macau', TW:'Taiwan',
  JP:'Japan', KR:'South Korea', KP:'North Korea', MN:'Mongolia',
  SG:'Singapore', TH:'Thailand', MY:'Malaysia', ID:'Indonesia', PH:'Philippines',
  VN:'Vietnam', KH:'Cambodia', LA:'Laos', MM:'Myanmar', BN:'Brunei', TL:'Timor-Leste',
  PK:'Pakistan', BD:'Bangladesh', LK:'Sri Lanka', NP:'Nepal', BT:'Bhutan', MV:'Maldives',
  AF:'Afghanistan', UZ:'Uzbekistan', KZ:'Kazakhstan', KG:'Kyrgyzstan', TJ:'Tajikistan', TM:'Turkmenistan',
  AU:'Australia', NZ:'New Zealand', FJ:'Fiji', PG:'Papua New Guinea', SB:'Solomon Islands',
  VU:'Vanuatu', NC:'New Caledonia', PF:'French Polynesia', WS:'Samoa', TO:'Tonga',
  CA:'Canada', MX:'Mexico', GT:'Guatemala', BZ:'Belize', SV:'El Salvador', HN:'Honduras',
  NI:'Nicaragua', CR:'Costa Rica', PA:'Panama', CU:'Cuba', JM:'Jamaica', HT:'Haiti',
  DO:'Dominican Republic', PR:'Puerto Rico', BS:'Bahamas', BB:'Barbados', TT:'Trinidad & Tobago',
  BR:'Brazil', AR:'Argentina', CL:'Chile', PE:'Peru', CO:'Colombia', EC:'Ecuador',
  VE:'Venezuela', BO:'Bolivia', PY:'Paraguay', UY:'Uruguay', GY:'Guyana', SR:'Suriname',
};

// Seed dataset from curated list. Primaries → tier 0, secondaries → tier 1.
const INITIAL = CURATED.map(a => ({
  iata: a.iata, name: a.name, city: a.city, country: a.country,
  lat: a.lat, lng: a.lng,
  primary: a.primary, tier: a.primary ? 0 : 1,
}));

// Module-level cache so searchAirports() always sees the latest dataset.
let _data    = INITIAL;
let _loading = null;

function parseLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map(h => h.trim());
  const idx = {
    type:   headers.indexOf('type'),
    name:   headers.indexOf('name'),
    lat:    headers.indexOf('latitude_deg'),
    lng:    headers.indexOf('longitude_deg'),
    iso:    headers.indexOf('iso_country'),
    city:   headers.indexOf('municipality'),
    sched:  headers.indexOf('scheduled_service'),
    iata:   headers.indexOf('iata_code'),
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const v = parseLine(lines[i]);
    const iata  = (v[idx.iata]  || '').trim();
    const type  = (v[idx.type]  || '').trim();
    const sched = (v[idx.sched] || '').trim();
    if (iata.length !== 3) continue;
    if (sched !== 'yes') continue;
    if (type !== 'large_airport' && type !== 'medium_airport' && type !== 'small_airport') continue;
    const lat = parseFloat(v[idx.lat]);
    const lng = parseFloat(v[idx.lng]);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    out.push({
      iata, type,
      name: (v[idx.name] || '').trim(),
      city: (v[idx.city] || '').trim(),
      iso:  (v[idx.iso]  || '').trim(),
      lat, lng,
    });
  }
  return out;
}

function haversineKm(a, b) {
  const r = Math.PI / 180;
  const φ1 = a.lat * r, φ2 = b.lat * r;
  const dφ = (b.lat - a.lat) * r;
  const dλ = (b.lng - a.lng) * r;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Merge curated with CSV. Each airport gets a tier:
//   0 — primary hub (1 per country, always visible)
//   1 — major airports + curated secondaries (zoom ≥ 2.8)
//   2 — medium airports (zoom ≥ 4.5)
//   3 — small airports with scheduled service (zoom ≥ 6.5)
function mergeWithCurated(fetched) {
  const out = [];
  const curatedByIata = new Map(CURATED.map(a => [a.iata, a]));

  CURATED.forEach(a => {
    out.push({
      iata: a.iata, name: a.name, city: a.city, country: a.country,
      lat: a.lat, lng: a.lng,
      primary: a.primary, tier: a.primary ? 0 : 1,
    });
  });

  const hasPrimary = new Set(CURATED.filter(a => a.primary).map(a => a.country));

  // Index curated by country name for proximity dedup
  const curatedByCountry = new Map();
  CURATED.forEach(a => {
    if (!curatedByCountry.has(a.country)) curatedByCountry.set(a.country, []);
    curatedByCountry.get(a.country).push(a);
  });

  const byIso = new Map();
  fetched.forEach(a => {
    if (curatedByIata.has(a.iata)) return;
    const friendly = ISO_NAMES[a.iso] || a.iso;
    // Skip if within 3km of a curated airport in the same country — likely
    // the same airport carrying a different IATA in the dataset.
    const nearby = curatedByCountry.get(friendly);
    if (nearby && nearby.some(c => haversineKm(c, a) < 3)) return;
    if (!byIso.has(a.iso)) byIso.set(a.iso, []);
    byIso.get(a.iso).push(a);
  });

  byIso.forEach((airports, iso) => {
    const friendly = ISO_NAMES[iso] || iso;
    airports.sort((a, b) => {
      const r = { large_airport: 0, medium_airport: 1, small_airport: 2 };
      return r[a.type] - r[b.type];
    });
    let primaryAssigned = hasPrimary.has(friendly);

    airports.forEach(a => {
      let tier;
      if (!primaryAssigned) { tier = 0; primaryAssigned = true; }
      else if (a.type === 'large_airport')  tier = 1;
      else if (a.type === 'medium_airport') tier = 2;
      else                                  tier = 3;

      out.push({
        iata: a.iata, name: a.name, city: a.city, country: friendly,
        lat: a.lat, lng: a.lng,
        primary: tier === 0, tier,
      });
    });
  });

  return out;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.timestamp || !obj.data) return null;
    if (Date.now() - obj.timestamp > CACHE_TTL) return null;
    return obj.data;
  } catch { return null; }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); }
  catch { /* quota exceeded — fine */ }
}

export function useAirports() {
  const [airports, setAirports] = useState(_data);

  useEffect(() => {
    if (_data !== INITIAL) { setAirports(_data); return; }

    const cached = loadCache();
    if (cached && Array.isArray(cached) && cached.length > INITIAL.length) {
      _data = cached;
      setAirports(cached);
      return;
    }

    if (!_loading) {
      _loading = fetch(CSV_URL)
        .then(r => r.ok ? r.text() : Promise.reject(new Error('CSV ' + r.status)))
        .then(parseCSV)
        .then(mergeWithCurated)
        .catch(err => { console.warn('[useAirports]', err); return null; });
    }

    let cancelled = false;
    _loading.then(data => {
      if (cancelled || !data) return;
      _data = data;
      saveCache(data);
      setAirports(data);
    });
    return () => { cancelled = true; };
  }, []);

  return { airports, loading: airports === INITIAL };
}

export function searchAirports(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return _data
    .filter(a =>
      a.iata.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    )
    .sort((a, b) => (a.tier - b.tier) || a.iata.localeCompare(b.iata))
    .slice(0, 10);
}
