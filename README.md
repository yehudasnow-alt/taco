# Taco ✈️

Multi-stop flight route builder on an interactive 3D globe.

## Tech Stack
- React 19 + Vite · Mapbox GL JS (globe projection) · Zustand

## Local dev
```bash
npm install
npm run dev
```

Optional: drop a free Mapbox token in `.env.local` as `VITE_MAPBOX_TOKEN=…`
(otherwise the bundled public demo token is used).

## Deployments
| Host | URL | Trigger |
|------|-----|---------|
| Vercel | taco.vercel.app | Push to `main` (auto) |
| GitHub Pages | YOUR_USERNAME.github.io/taco | Push to `main` (auto) |

## Structure
```
src/
├── components/
│   ├── Globe.jsx          # Mapbox globe, markers, 3D-lifted route arcs, smooth auto-spin
│   ├── RouteSidebar.jsx   # Route builder panel
│   └── AirportSearch.jsx  # Autocomplete search
├── data/airports.js       # Curated list: 1 primary hub per country + optional secondaries
└── store/routeStore.js    # Global state (Zustand)
```

## Behaviour notes
- The globe **auto-rotates** when no stops are selected and the user isn't touching it.
  Rotation eases in/out (no hard snap) and stops automatically when you zoom in or pick a stop.
- **Primary airports** (one per country) are always visible.
  **Secondary airports** appear only when zoomed in enough to see the country in detail.
- **Route arcs** are lifted into 3D space (`line-z-offset`) so they curve above the globe rather than wrap its surface.

## Roadmap
- [x] 3D globe with curated airport markers
- [x] Multi-stop route builder
- [x] Animated 3D arc visualization (lifted into space)
- [x] Smooth eased auto-rotation
- [ ] Duffel API — real flight search
- [ ] Price comparison + markup engine
- [ ] Date/time picker per leg
- [ ] Booking + payment flow
- [ ] localStorage persistence
- [ ] Drag-and-drop reordering
- [ ] Mobile responsive layout
