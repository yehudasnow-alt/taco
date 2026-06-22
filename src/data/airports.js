// tier 1 = main hub per country (visible at all zoom levels)
// tier 2 = secondary airports (visible when zoomed in)
export const AIRPORTS = [
  // ── Japan ──
  { iata: "NRT", name: "Narita International",    city: "Tokyo",     country: "Japan",        lat: 35.7720, lng: 140.3929, tier: 1 },
  { iata: "TYO", name: "Tokyo Haneda",            city: "Tokyo",     country: "Japan",        lat: 35.5494, lng: 139.7798, tier: 2 },
  { iata: "OSA", name: "Osaka Kansai",            city: "Osaka",     country: "Japan",        lat: 34.4347, lng: 135.2440, tier: 2 },
  // ── South Korea ──
  { iata: "ICN", name: "Incheon International",   city: "Seoul",     country: "South Korea",  lat: 37.4602, lng: 126.4407, tier: 1 },
  // ── China ──
  { iata: "PEK", name: "Beijing Capital",         city: "Beijing",   country: "China",        lat: 40.0799, lng: 116.6031, tier: 1 },
  { iata: "PVG", name: "Shanghai Pudong",         city: "Shanghai",  country: "China",        lat: 31.1443, lng: 121.8083, tier: 2 },
  // ── Hong Kong ──
  { iata: "HKG", name: "Hong Kong Intl",          city: "Hong Kong", country: "Hong Kong",    lat: 22.3080, lng: 113.9185, tier: 1 },
  // ── Southeast Asia ──
  { iata: "SIN", name: "Changi Airport",          city: "Singapore", country: "Singapore",    lat:  1.3644, lng: 103.9915, tier: 1 },
  { iata: "BKK", name: "Suvarnabhumi",            city: "Bangkok",   country: "Thailand",     lat: 13.6900, lng: 100.7501, tier: 1 },
  // ── India ──
  { iata: "DEL", name: "Indira Gandhi Intl",      city: "Delhi",     country: "India",        lat: 28.5562, lng:  77.1000, tier: 1 },
  { iata: "BOM", name: "Chhatrapati Shivaji",     city: "Mumbai",    country: "India",        lat: 19.0896, lng:  72.8656, tier: 2 },
  // ── Gulf ──
  { iata: "DXB", name: "Dubai International",     city: "Dubai",     country: "UAE",          lat: 25.2532, lng:  55.3657, tier: 1 },
  { iata: "DOH", name: "Hamad International",     city: "Doha",      country: "Qatar",        lat: 25.2731, lng:  51.6081, tier: 1 },
  { iata: "AUH", name: "Abu Dhabi Intl",          city: "Abu Dhabi", country: "UAE",          lat: 24.4330, lng:  54.6511, tier: 2 },
  // ── Israel ──
  { iata: "TLV", name: "Ben Gurion Airport",      city: "Tel Aviv",  country: "Israel",       lat: 32.0114, lng:  34.8867, tier: 1 },
  // ── Turkey ──
  { iata: "IST", name: "Istanbul Airport",        city: "Istanbul",  country: "Turkey",       lat: 41.2608, lng:  28.7418, tier: 1 },
  // ── Egypt ──
  { iata: "CAI", name: "Cairo International",     city: "Cairo",     country: "Egypt",        lat: 30.1219, lng:  31.4056, tier: 1 },
  // ── Greece ──
  { iata: "ATH", name: "Athens Intl",             city: "Athens",    country: "Greece",       lat: 37.9364, lng:  23.9445, tier: 2 },
  // ── UK ──
  { iata: "LHR", name: "Heathrow Airport",        city: "London",    country: "UK",           lat: 51.4775, lng:  -0.4614, tier: 1 },
  { iata: "LGW", name: "Gatwick Airport",         city: "London",    country: "UK",           lat: 51.1537, lng:  -0.1821, tier: 2 },
  // ── Netherlands ──
  { iata: "AMS", name: "Amsterdam Schiphol",      city: "Amsterdam", country: "Netherlands",  lat: 52.3105, lng:   4.7683, tier: 1 },
  // ── France ──
  { iata: "CDG", name: "Charles de Gaulle",       city: "Paris",     country: "France",       lat: 49.0097, lng:   2.5479, tier: 1 },
  // ── Germany ──
  { iata: "FRA", name: "Frankfurt Airport",       city: "Frankfurt", country: "Germany",      lat: 50.0379, lng:   8.5622, tier: 1 },
  { iata: "MUC", name: "Munich Airport",          city: "Munich",    country: "Germany",      lat: 48.3537, lng:  11.7750, tier: 2 },
  // ── Spain ──
  { iata: "MAD", name: "Barajas Airport",         city: "Madrid",    country: "Spain",        lat: 40.4983, lng:  -3.5676, tier: 1 },
  { iata: "BCN", name: "El Prat Airport",         city: "Barcelona", country: "Spain",        lat: 41.2974, lng:   2.0833, tier: 2 },
  // ── Italy ──
  { iata: "FCO", name: "Fiumicino Airport",       city: "Rome",      country: "Italy",        lat: 41.8003, lng:  12.2389, tier: 1 },
  // ── Austria ──
  { iata: "VIE", name: "Vienna Airport",          city: "Vienna",    country: "Austria",      lat: 48.1102, lng:  16.5697, tier: 2 },
  // ── Switzerland ──
  { iata: "ZRH", name: "Zurich Airport",          city: "Zurich",    country: "Switzerland",  lat: 47.4647, lng:   8.5492, tier: 2 },
  // ── USA ──
  { iata: "JFK", name: "John F. Kennedy Intl",    city: "New York",  country: "USA",          lat: 40.6413, lng: -73.7781, tier: 1 },
  { iata: "LAX", name: "Los Angeles Intl",        city: "Los Angeles","country": "USA",       lat: 33.9425, lng:-118.4081, tier: 1 },
  { iata: "ORD", name: "O'Hare International",    city: "Chicago",   country: "USA",          lat: 41.9742, lng: -87.9073, tier: 2 },
  { iata: "MIA", name: "Miami International",     city: "Miami",     country: "USA",          lat: 25.7959, lng: -80.2870, tier: 2 },
  { iata: "SFO", name: "San Francisco Intl",      city: "San Francisco","country": "USA",     lat: 37.6213, lng:-122.3790, tier: 2 },
  // ── Canada ──
  { iata: "YYZ", name: "Pearson International",   city: "Toronto",   country: "Canada",       lat: 43.6777, lng: -79.6248, tier: 2 },
  // ── Mexico ──
  { iata: "MEX", name: "Benito Juárez Intl",      city: "Mexico City","country": "Mexico",    lat: 19.4363, lng: -99.0721, tier: 2 },
  // ── Brazil ──
  { iata: "GRU", name: "Guarulhos Intl",          city: "São Paulo", country: "Brazil",       lat:-23.4356, lng: -46.4731, tier: 1 },
  // ── Argentina ──
  { iata: "EZE", name: "Ministro Pistarini",      city: "Buenos Aires","country":"Argentina", lat:-34.8222, lng: -58.5358, tier: 2 },
  // ── Africa ──
  { iata: "JNB", name: "O.R. Tambo Intl",         city: "Johannesburg","country":"South Africa",lat:-26.1367,lng: 28.2411, tier: 1 },
  { iata: "NBO", name: "Jomo Kenyatta Intl",      city: "Nairobi",   country: "Kenya",        lat: -1.3192, lng:  36.9275, tier: 2 },
  // ── Australia ──
  { iata: "SYD", name: "Kingsford Smith",         city: "Sydney",    country: "Australia",    lat:-33.9399, lng: 151.1753, tier: 1 },
  { iata: "MEL", name: "Melbourne Airport",       city: "Melbourne", country: "Australia",    lat:-37.6690, lng: 144.8410, tier: 2 },
];

export function searchAirports(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return AIRPORTS.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  ).slice(0, 8);
}

export function getAirportByIata(iata) {
  return AIRPORTS.find(a => a.iata === iata.toUpperCase());
}
