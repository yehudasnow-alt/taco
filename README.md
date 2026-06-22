# Taco ✈️

Multi-stop flight route builder with a 3D interactive globe.

## Tech Stack
- React + Vite · Three.js + React Three Fiber · Zustand

## Local dev
```bash
npm install
npm run dev
```

## Deployments
| Host | URL | Trigger |
|------|-----|---------|
| Vercel | taco.vercel.app | Push to `main` (auto) |
| GitHub Pages | YOUR_USERNAME.github.io/taco | Push to `main` (auto) |

## Structure
```
src/
├── components/
│   ├── Globe.jsx          # 3D globe, markers, arc routes
│   ├── RouteSidebar.jsx   # Route builder panel
│   └── AirportSearch.jsx  # Autocomplete search
├── data/airports.js       # 45 major airports + coords
├── store/routeStore.js    # Global state (Zustand)
└── utils/geo.js           # Coordinate math + arc generation
```

## Roadmap
- [x] 3D globe with airport markers
- [x] Multi-stop route builder
- [x] Animated arc visualization
- [ ] Duffel API — real flight search
- [ ] Price comparison + markup engine
- [ ] Date/time picker per leg
- [ ] Booking + payment flow
