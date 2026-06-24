// Curated list — one PRIMARY hub per country (always visible),
// plus 1–3 SECONDARY airports (visible only when zoomed in to that region).
// Goal: clean, proportional UX. No more than ~3 dots per country, fewer for small ones.

export const AIRPORTS = [
  // ── Middle East ─────────────────────────────────────────────────────────────
  { iata: "TLV", name: "Ben Gurion",            city: "Tel Aviv",    country: "Israel",       lat: 32.0114, lng:  34.8867, primary: true  },
  { iata: "RMN", name: "Ramon Airport",         city: "Eilat",       country: "Israel",       lat: 29.7236, lng:  35.0114, primary: false },
  { iata: "HFA", name: "Haifa Airport",         city: "Haifa",       country: "Israel",       lat: 32.8094, lng:  35.0431, primary: false },
  { iata: "AMM", name: "Queen Alia Intl",       city: "Amman",       country: "Jordan",       lat: 31.7226, lng:  35.9933, primary: true  },
  { iata: "BEY", name: "Rafic Hariri Intl",     city: "Beirut",      country: "Lebanon",      lat: 33.8209, lng:  35.4884, primary: true  },
  { iata: "DXB", name: "Dubai International",   city: "Dubai",       country: "UAE",          lat: 25.2532, lng:  55.3657, primary: true  },
  { iata: "AUH", name: "Abu Dhabi Intl",        city: "Abu Dhabi",   country: "UAE",          lat: 24.4330, lng:  54.6511, primary: false },
  { iata: "DOH", name: "Hamad International",   city: "Doha",        country: "Qatar",        lat: 25.2731, lng:  51.6081, primary: true  },
  { iata: "RUH", name: "King Khalid Intl",      city: "Riyadh",      country: "Saudi Arabia", lat: 24.9576, lng:  46.6988, primary: true  },
  { iata: "JED", name: "King Abdulaziz Intl",   city: "Jeddah",      country: "Saudi Arabia", lat: 21.6796, lng:  39.1565, primary: false },
  { iata: "BAH", name: "Bahrain Intl",          city: "Manama",      country: "Bahrain",      lat: 26.2708, lng:  50.6336, primary: true  },
  { iata: "KWI", name: "Kuwait Intl",           city: "Kuwait City", country: "Kuwait",       lat: 29.2266, lng:  47.9689, primary: true  },
  { iata: "MCT", name: "Muscat Intl",           city: "Muscat",      country: "Oman",         lat: 23.5933, lng:  58.2844, primary: true  },

  // ── Europe ──────────────────────────────────────────────────────────────────
  { iata: "LHR", name: "Heathrow",              city: "London",      country: "UK",           lat: 51.4775, lng:  -0.4614, primary: true  },
  { iata: "LGW", name: "Gatwick",               city: "London",      country: "UK",           lat: 51.1537, lng:  -0.1821, primary: false },
  { iata: "MAN", name: "Manchester",            city: "Manchester",  country: "UK",           lat: 53.3537, lng:  -2.2750, primary: false },
  { iata: "CDG", name: "Charles de Gaulle",     city: "Paris",       country: "France",       lat: 49.0097, lng:   2.5479, primary: true  },
  { iata: "ORY", name: "Orly",                  city: "Paris",       country: "France",       lat: 48.7233, lng:   2.3794, primary: false },
  { iata: "NCE", name: "Nice Côte d'Azur",      city: "Nice",        country: "France",       lat: 43.6584, lng:   7.2159, primary: false },
  { iata: "FRA", name: "Frankfurt",             city: "Frankfurt",   country: "Germany",      lat: 50.0379, lng:   8.5622, primary: true  },
  { iata: "MUC", name: "Munich",                city: "Munich",      country: "Germany",      lat: 48.3537, lng:  11.7750, primary: false },
  { iata: "BER", name: "Berlin Brandenburg",    city: "Berlin",      country: "Germany",      lat: 52.3667, lng:  13.5033, primary: false },
  { iata: "AMS", name: "Schiphol",              city: "Amsterdam",   country: "Netherlands",  lat: 52.3105, lng:   4.7683, primary: true  },
  { iata: "BRU", name: "Brussels Airport",      city: "Brussels",    country: "Belgium",      lat: 50.9014, lng:   4.4844, primary: true  },
  { iata: "MAD", name: "Adolfo Suárez Madrid",  city: "Madrid",      country: "Spain",        lat: 40.4983, lng:  -3.5676, primary: true  },
  { iata: "BCN", name: "Barcelona–El Prat",     city: "Barcelona",   country: "Spain",        lat: 41.2974, lng:   2.0833, primary: false },
  { iata: "PMI", name: "Palma de Mallorca",     city: "Palma",       country: "Spain",        lat: 39.5517, lng:   2.7388, primary: false },
  { iata: "LIS", name: "Humberto Delgado",      city: "Lisbon",      country: "Portugal",     lat: 38.7813, lng:  -9.1359, primary: true  },
  { iata: "OPO", name: "Francisco Sá Carneiro", city: "Porto",       country: "Portugal",     lat: 41.2481, lng:  -8.6814, primary: false },
  { iata: "FCO", name: "Leonardo da Vinci",     city: "Rome",        country: "Italy",        lat: 41.8003, lng:  12.2389, primary: true  },
  { iata: "MXP", name: "Milan Malpensa",        city: "Milan",       country: "Italy",        lat: 45.6306, lng:   8.7281, primary: false },
  { iata: "VCE", name: "Venice Marco Polo",     city: "Venice",      country: "Italy",        lat: 45.5053, lng:  12.3519, primary: false },
  { iata: "ZRH", name: "Zürich",                city: "Zürich",      country: "Switzerland",  lat: 47.4647, lng:   8.5492, primary: true  },
  { iata: "GVA", name: "Geneva",                city: "Geneva",      country: "Switzerland",  lat: 46.2381, lng:   6.1090, primary: false },
  { iata: "VIE", name: "Vienna",                city: "Vienna",      country: "Austria",      lat: 48.1102, lng:  16.5697, primary: true  },
  { iata: "DUB", name: "Dublin",                city: "Dublin",      country: "Ireland",      lat: 53.4264, lng:  -6.2499, primary: true  },
  { iata: "CPH", name: "Copenhagen",            city: "Copenhagen",  country: "Denmark",      lat: 55.6180, lng:  12.6508, primary: true  },
  { iata: "ARN", name: "Stockholm Arlanda",     city: "Stockholm",   country: "Sweden",       lat: 59.6519, lng:  17.9186, primary: true  },
  { iata: "OSL", name: "Oslo Gardermoen",       city: "Oslo",        country: "Norway",       lat: 60.1976, lng:  11.1004, primary: true  },
  { iata: "HEL", name: "Helsinki-Vantaa",       city: "Helsinki",    country: "Finland",      lat: 60.3172, lng:  24.9633, primary: true  },
  { iata: "KEF", name: "Keflavík",              city: "Reykjavík",   country: "Iceland",      lat: 63.9850, lng: -22.6056, primary: true  },
  { iata: "ATH", name: "Athens Eleftherios",    city: "Athens",      country: "Greece",       lat: 37.9364, lng:  23.9445, primary: true  },
  { iata: "WAW", name: "Warsaw Chopin",         city: "Warsaw",      country: "Poland",       lat: 52.1657, lng:  20.9671, primary: true  },
  { iata: "KRK", name: "Kraków",                city: "Kraków",      country: "Poland",       lat: 50.0777, lng:  19.7848, primary: false },
  { iata: "PRG", name: "Václav Havel Prague",   city: "Prague",      country: "Czechia",      lat: 50.1008, lng:  14.2600, primary: true  },
  { iata: "BUD", name: "Ferenc Liszt Budapest", city: "Budapest",    country: "Hungary",      lat: 47.4369, lng:  19.2556, primary: true  },
  { iata: "OTP", name: "Henri Coandă",          city: "Bucharest",   country: "Romania",      lat: 44.5711, lng:  26.0850, primary: true  },
  { iata: "SOF", name: "Sofia",                 city: "Sofia",       country: "Bulgaria",     lat: 42.6967, lng:  23.4114, primary: true  },
  { iata: "ZAG", name: "Franjo Tuđman",         city: "Zagreb",      country: "Croatia",      lat: 45.7429, lng:  16.0688, primary: true  },
  { iata: "IST", name: "Istanbul Airport",      city: "Istanbul",    country: "Turkey",       lat: 41.2608, lng:  28.7418, primary: true  },
  { iata: "SAW", name: "Sabiha Gökçen",         city: "Istanbul",    country: "Turkey",       lat: 40.8986, lng:  29.3092, primary: false },
  { iata: "AYT", name: "Antalya",               city: "Antalya",     country: "Turkey",       lat: 36.8987, lng:  30.8005, primary: false },
  { iata: "SVO", name: "Sheremetyevo",          city: "Moscow",      country: "Russia",       lat: 55.9726, lng:  37.4146, primary: true  },
  { iata: "LED", name: "Pulkovo",               city: "St Petersburg",country:"Russia",       lat: 59.8003, lng:  30.2625, primary: false },

  // ── Africa ──────────────────────────────────────────────────────────────────
  { iata: "CAI", name: "Cairo International",   city: "Cairo",       country: "Egypt",        lat: 30.1219, lng:  31.4056, primary: true  },
  { iata: "HRG", name: "Hurghada",              city: "Hurghada",    country: "Egypt",        lat: 27.1783, lng:  33.7994, primary: false },
  { iata: "CMN", name: "Mohammed V",            city: "Casablanca",  country: "Morocco",      lat: 33.3675, lng:  -7.5898, primary: true  },
  { iata: "TUN", name: "Tunis–Carthage",        city: "Tunis",       country: "Tunisia",      lat: 36.8510, lng:  10.2272, primary: true  },
  { iata: "ALG", name: "Houari Boumediene",     city: "Algiers",     country: "Algeria",      lat: 36.6910, lng:   3.2154, primary: true  },
  { iata: "JNB", name: "O.R. Tambo",            city: "Johannesburg",country: "South Africa", lat: -26.1367,lng:  28.2411, primary: true  },
  { iata: "CPT", name: "Cape Town Intl",        city: "Cape Town",   country: "South Africa", lat: -33.9648,lng:  18.6017, primary: false },
  { iata: "NBO", name: "Jomo Kenyatta",         city: "Nairobi",     country: "Kenya",        lat:  -1.3192,lng:  36.9275, primary: true  },
  { iata: "ADD", name: "Addis Ababa Bole",      city: "Addis Ababa", country: "Ethiopia",     lat:   8.9778,lng:  38.7993, primary: true  },
  { iata: "LOS", name: "Murtala Muhammed",      city: "Lagos",       country: "Nigeria",      lat:   6.5774,lng:   3.3212, primary: true  },
  { iata: "ACC", name: "Kotoka",                city: "Accra",       country: "Ghana",        lat:   5.6052,lng:  -0.1668, primary: true  },
  { iata: "DAR", name: "Julius Nyerere",        city: "Dar es Salaam",country:"Tanzania",     lat:  -6.8781,lng:  39.2026, primary: true  },

  // ── Asia ────────────────────────────────────────────────────────────────────
  { iata: "DEL", name: "Indira Gandhi",         city: "Delhi",       country: "India",        lat: 28.5562, lng:  77.1000, primary: true  },
  { iata: "BOM", name: "Chhatrapati Shivaji",   city: "Mumbai",      country: "India",        lat: 19.0896, lng:  72.8656, primary: false },
  { iata: "BLR", name: "Kempegowda",            city: "Bengaluru",   country: "India",        lat: 13.1986, lng:  77.7066, primary: false },
  { iata: "PEK", name: "Beijing Capital",       city: "Beijing",     country: "China",        lat: 40.0799, lng: 116.6031, primary: true  },
  { iata: "PVG", name: "Shanghai Pudong",       city: "Shanghai",    country: "China",        lat: 31.1443, lng: 121.8083, primary: false },
  { iata: "CAN", name: "Guangzhou Baiyun",      city: "Guangzhou",   country: "China",        lat: 23.3924, lng: 113.2988, primary: false },
  { iata: "HKG", name: "Hong Kong Intl",        city: "Hong Kong",   country: "Hong Kong",    lat: 22.3080, lng: 113.9185, primary: true  },
  { iata: "TPE", name: "Taoyuan",               city: "Taipei",      country: "Taiwan",       lat: 25.0797, lng: 121.2342, primary: true  },
  { iata: "HND", name: "Tokyo Haneda",          city: "Tokyo",       country: "Japan",        lat: 35.5494, lng: 139.7798, primary: true  },
  { iata: "NRT", name: "Narita",                city: "Tokyo",       country: "Japan",        lat: 35.7720, lng: 140.3929, primary: false },
  { iata: "KIX", name: "Kansai",                city: "Osaka",       country: "Japan",        lat: 34.4347, lng: 135.2440, primary: false },
  { iata: "ICN", name: "Incheon",               city: "Seoul",       country: "South Korea",  lat: 37.4602, lng: 126.4407, primary: true  },
  { iata: "GMP", name: "Gimpo",                 city: "Seoul",       country: "South Korea",  lat: 37.5587, lng: 126.7906, primary: false },
  { iata: "SIN", name: "Changi",                city: "Singapore",   country: "Singapore",    lat:  1.3644, lng: 103.9915, primary: true  },
  { iata: "BKK", name: "Suvarnabhumi",          city: "Bangkok",     country: "Thailand",     lat: 13.6900, lng: 100.7501, primary: true  },
  { iata: "HKT", name: "Phuket",                city: "Phuket",      country: "Thailand",     lat:  8.1132, lng:  98.3169, primary: false },
  { iata: "KUL", name: "Kuala Lumpur Intl",     city: "Kuala Lumpur",country: "Malaysia",     lat:  2.7456, lng: 101.7099, primary: true  },
  { iata: "CGK", name: "Soekarno–Hatta",        city: "Jakarta",     country: "Indonesia",    lat: -6.1256, lng: 106.6558, primary: true  },
  { iata: "DPS", name: "Ngurah Rai (Bali)",     city: "Denpasar",    country: "Indonesia",    lat: -8.7482, lng: 115.1672, primary: false },
  { iata: "MNL", name: "Ninoy Aquino",          city: "Manila",      country: "Philippines",  lat: 14.5086, lng: 121.0194, primary: true  },
  { iata: "SGN", name: "Tan Son Nhat",          city: "Ho Chi Minh", country: "Vietnam",      lat: 10.8188, lng: 106.6519, primary: true  },
  { iata: "HAN", name: "Noi Bai",               city: "Hanoi",       country: "Vietnam",      lat: 21.2214, lng: 105.8073, primary: false },

  // ── Oceania ─────────────────────────────────────────────────────────────────
  { iata: "SYD", name: "Kingsford Smith",       city: "Sydney",      country: "Australia",    lat: -33.9399,lng: 151.1753, primary: true  },
  { iata: "MEL", name: "Melbourne",             city: "Melbourne",   country: "Australia",    lat: -37.6690,lng: 144.8410, primary: false },
  { iata: "BNE", name: "Brisbane",              city: "Brisbane",    country: "Australia",    lat: -27.3942,lng: 153.1218, primary: false },
  { iata: "PER", name: "Perth",                 city: "Perth",       country: "Australia",    lat: -31.9402,lng: 115.9670, primary: false },
  { iata: "AKL", name: "Auckland",              city: "Auckland",    country: "New Zealand",  lat: -37.0082,lng: 174.7850, primary: true  },

  // ── North America ───────────────────────────────────────────────────────────
  { iata: "JFK", name: "John F. Kennedy",       city: "New York",    country: "USA",          lat: 40.6413, lng: -73.7781, primary: true  },
  { iata: "LAX", name: "Los Angeles Intl",      city: "Los Angeles", country: "USA",          lat: 33.9425, lng:-118.4081, primary: false },
  { iata: "ORD", name: "O'Hare",                city: "Chicago",     country: "USA",          lat: 41.9742, lng: -87.9073, primary: false },
  { iata: "ATL", name: "Hartsfield–Jackson",    city: "Atlanta",     country: "USA",          lat: 33.6407, lng: -84.4277, primary: false },
  { iata: "DFW", name: "Dallas/Fort Worth",     city: "Dallas",      country: "USA",          lat: 32.8998, lng: -97.0403, primary: false },
  { iata: "SFO", name: "San Francisco Intl",    city: "San Francisco",country:"USA",          lat: 37.6213, lng:-122.3790, primary: false },
  { iata: "MIA", name: "Miami Intl",            city: "Miami",       country: "USA",          lat: 25.7959, lng: -80.2870, primary: false },
  { iata: "SEA", name: "Seattle–Tacoma",        city: "Seattle",     country: "USA",          lat: 47.4502, lng:-122.3088, primary: false },
  { iata: "DEN", name: "Denver Intl",           city: "Denver",      country: "USA",          lat: 39.8561, lng:-104.6737, primary: false },
  { iata: "LAS", name: "Harry Reid",            city: "Las Vegas",   country: "USA",          lat: 36.0840, lng:-115.1537, primary: false },
  { iata: "BOS", name: "Logan",                 city: "Boston",      country: "USA",          lat: 42.3656, lng: -71.0096, primary: false },
  { iata: "YYZ", name: "Toronto Pearson",       city: "Toronto",     country: "Canada",       lat: 43.6777, lng: -79.6248, primary: true  },
  { iata: "YVR", name: "Vancouver",             city: "Vancouver",   country: "Canada",       lat: 49.1967, lng:-123.1815, primary: false },
  { iata: "YUL", name: "Montréal–Trudeau",      city: "Montréal",    country: "Canada",       lat: 45.4706, lng: -73.7408, primary: false },
  { iata: "MEX", name: "Benito Juárez",         city: "Mexico City", country: "Mexico",       lat: 19.4363, lng: -99.0721, primary: true  },
  { iata: "CUN", name: "Cancún",                city: "Cancún",      country: "Mexico",       lat: 21.0365, lng: -86.8770, primary: false },

  // ── South America ───────────────────────────────────────────────────────────
  { iata: "GRU", name: "Guarulhos",             city: "São Paulo",   country: "Brazil",       lat: -23.4356,lng: -46.4731, primary: true  },
  { iata: "GIG", name: "Galeão",                city: "Rio de Janeiro",country:"Brazil",      lat: -22.8090,lng: -43.2506, primary: false },
  { iata: "EZE", name: "Ministro Pistarini",    city: "Buenos Aires",country: "Argentina",    lat: -34.8222,lng: -58.5358, primary: true  },
  { iata: "SCL", name: "Arturo Merino Benítez", city: "Santiago",    country: "Chile",        lat: -33.3928,lng: -70.7858, primary: true  },
  { iata: "LIM", name: "Jorge Chávez",          city: "Lima",        country: "Peru",         lat: -12.0219,lng: -77.1143, primary: true  },
  { iata: "BOG", name: "El Dorado",             city: "Bogotá",      country: "Colombia",     lat:   4.7016,lng: -74.1469, primary: true  },
  { iata: "UIO", name: "Mariscal Sucre",        city: "Quito",       country: "Ecuador",      lat:  -0.1292,lng: -78.3575, primary: true  },
];

export function searchAirports(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return AIRPORTS.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  )
  // Show primaries first, then alphabetically
  .sort((a, b) => (b.primary === a.primary) ? a.iata.localeCompare(b.iata) : (b.primary ? 1 : -1))
  .slice(0, 8);
}

export function getAirportByIata(iata) {
  return AIRPORTS.find(a => a.iata === iata.toUpperCase());
}
