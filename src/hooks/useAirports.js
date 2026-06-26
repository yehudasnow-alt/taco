import { AIRPORTS } from '../data/airports';

// All 4,046 commercial airports are baked directly into the bundle now
// (see src/data/airports.js). No network fetch, no CSV parsing, no
// localStorage cache — the dataset is available the moment the JS runs.

export function useAirports() {
  return { airports: AIRPORTS, loading: false };
}

// Search helper for the picker autocomplete.
export function searchAirports(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return AIRPORTS.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    (a.city    && a.city.toLowerCase().includes(q)) ||
    (a.country && a.country.toLowerCase().includes(q))
  )
  // Show tier-0 hubs first when there are many matches so the obvious one
  // ("Paris" → CDG, not LBG) lands at the top.
  .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9))
  .slice(0, 8);
}
