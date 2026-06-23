import { useState, useEffect } from 'react';
import { AIRPORTS as STATIC } from '../data/airports';

const CSV_URL =
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';

let globalCache = null;
let fetchPromise = null;

// Simple but robust CSV line parser (handles quoted commas)
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
  const headers = parseLine(lines[0]).map(h => h.trim());

  const I = {
    type:   headers.indexOf('type'),
    name:   headers.indexOf('name'),
    lat:    headers.indexOf('latitude_deg'),
    lng:    headers.indexOf('longitude_deg'),
    country:headers.indexOf('iso_country'),
    city:   headers.indexOf('municipality'),
    sched:  headers.indexOf('scheduled_service'),
    iata:   headers.indexOf('iata_code'),
  };

  const airports = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const v = parseLine(lines[i]);

    const iata  = (v[I.iata]  || '').trim();
    const type  = (v[I.type]  || '').trim();
    const sched = (v[I.sched] || '').trim();

    if (iata.length !== 3) continue;
    if (!['large_airport', 'medium_airport'].includes(type)) continue;
    if (sched !== 'yes') continue;

    const lat = parseFloat(v[I.lat]);
    const lng = parseFloat(v[I.lng]);
    if (isNaN(lat) || isNaN(lng)) continue;

    airports.push({
      iata,
      name:    (v[I.name]    || '').trim(),
      city:    (v[I.city]    || '').trim(),
      country: (v[I.country] || '').trim(),
      lat, lng,
      tier: type === 'large_airport' ? 1 : 2,
    });
  }

  return airports;
}

export function useAirports() {
  const [airports, setAirports] = useState(globalCache || STATIC);
  const [loading,  setLoading]  = useState(!globalCache);

  useEffect(() => {
    if (globalCache) { setAirports(globalCache); setLoading(false); return; }

    if (!fetchPromise) {
      fetchPromise = fetch(CSV_URL)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then(parseCSV)
        .catch(() => STATIC);
    }

    fetchPromise.then(data => {
      globalCache = data;
      setAirports(data);
      setLoading(false);
    });
  }, []);

  return { airports, loading };
}

// Also export a search helper that works on the cached/static list
export function searchAirports(query) {
  const list = globalCache || STATIC;
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return list.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  ).slice(0, 8);
}
