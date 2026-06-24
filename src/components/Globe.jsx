import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouteStore } from '../store/routeStore';
import { AIRPORTS } from '../data/airports';

// ── Mapbox token ───────────────────────────────────────────────────────────────
mapboxgl.accessToken =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

// ── Static GeoJSON (the curated list never changes) ───────────────────────────
const AIRPORT_GEOJSON = {
  type: 'FeatureCollection',
  features: AIRPORTS.map(a => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
    properties: {
      iata: a.iata, name: a.name, city: a.city, country: a.country,
      lat: a.lat, lng: a.lng, primary: a.primary,
    },
  })),
};

// ── Great-circle helpers ──────────────────────────────────────────────────────
const R_EARTH_KM = 6371;

function distanceKm(a, b) {
  const r = Math.PI / 180;
  const φ1 = a.lat * r, φ2 = b.lat * r;
  const dφ = (b.lat - a.lat) * r;
  const dλ = (b.lng - a.lng) * r;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R_EARTH_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function gcArc(from, to, n = 96) {
  const r = Math.PI / 180, D = 180 / Math.PI;
  const la1 = from.lat * r, lo1 = from.lng * r;
  const la2 = to.lat   * r, lo2 = to.lng   * r;
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2
  ));
  if (d < 1e-10) return [[from.lng, from.lat]];
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    return [Math.atan2(y, x) * D, Math.atan2(z, Math.sqrt(x * x + y * y)) * D];
  });
}

// Build route GeoJSON. Each segment carries its own arc peak height (in meters)
// so the route can be lifted into 3D space via `line-z-offset`.
function routeGeoJSON(stops) {
  if (stops.length < 2) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: stops.slice(0, -1).map((from, i) => {
      const to = stops[i + 1];
      const dKm = distanceKm(from, to);
      // Peak height ≈ distance / 6, clamped. Looks natural across short & long hops.
      const arcHeight = Math.max(80_000, Math.min(2_000_000, dKm * 1000 / 6));
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: gcArc(from, to) },
        properties: { arcHeight },
      };
    }),
  };
}

// ── Easing ────────────────────────────────────────────────────────────────────
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ── Component ─────────────────────────────────────────────────────────────────
export default function Globe() {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const rafRef       = useRef(null);
  const idleRef      = useRef(null);
  const stopsRef     = useRef([]);
  const interactingRef = useRef(false);

  // Spin animation state — factor goes 0 (stopped) ↔ 1 (full speed) with easing.
  const spinRef = useRef({
    factor: 0,           // current speed multiplier
    from:   0,           // factor at transition start
    target: 1,           // factor we're heading toward
    start:  0,           // performance.now() when transition began
    dur:    1500,        // transition duration in ms
  });

  const { stops, addStop, hoveredAirport, setHoveredAirport } = useRouteStore();
  stopsRef.current = stops;

  // ── Schedule a smooth transition of the spin factor ─────────────────────────
  const transitionSpin = (target, dur) => {
    const s = spinRef.current;
    s.from   = s.factor;
    s.target = target;
    s.start  = performance.now();
    s.dur    = dur;
  };

  // Advance the easing each frame and return current factor.
  const tickSpin = (now) => {
    const s = spinRef.current;
    if (s.factor === s.target) return s.factor;
    const t = Math.min(1, (now - s.start) / s.dur);
    s.factor = s.from + (s.target - s.from) * easeInOutCubic(t);
    if (t >= 1) s.factor = s.target;
    return s.factor;
  };

  // ── Init map (once) ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:      'mapbox://styles/mapbox/outdoors-v12',
      projection: 'globe',
      zoom:       1.8,
      center:     [15, 20],
      pitch:      0,
      fadeDuration: 0,
    });
    mapRef.current = map;

    // Slow the wheel zoom — default feels too aggressive on a globe.
    map.scrollZoom.setZoomRate(1 / 220);
    map.scrollZoom.setWheelZoomRate(1 / 220);

    // ── Animation loop: rotation with eased speed factor ──────────────────────
    let prev = null;
    const frame = (ts) => {
      const factor = tickSpin(ts);

      // Only spin when:
      //   • factor > 0
      //   • user isn't dragging
      //   • map isn't currently in a programmatic animation
      //   • no stops yet
      if (prev !== null && factor > 0.001 && !interactingRef.current
          && !map.isMoving() && stopsRef.current.length === 0) {
        const dt   = ts - prev;
        const zoom = map.getZoom();
        // Rotation fades out as you zoom in (full at zoom ≤ 1.5, none above ~3.5).
        const zoomScale = Math.max(0, Math.min(1, (3.5 - zoom) / 2));
        if (zoomScale > 0) {
          const c = map.getCenter();
          c.lng += 0.006 * dt * factor * zoomScale; // ~0.36 °/s at full speed
          map.setCenter(c, { animate: false });
        }
      }
      prev = ts;
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    map.on('style.load', () => {
      // Space + atmosphere fog
      map.setFog({
        color:            'rgb(215, 230, 248)',
        'high-color':     'rgb(28, 65, 200)',
        'horizon-blend':  0.03,
        'space-color':    'rgb(7, 7, 20)',
        'star-intensity': 0.5,
      });

      // ── Sources ────────────────────────────────────────────────────────────
      map.addSource('airports', { type: 'geojson', data: AIRPORT_GEOJSON });
      map.addSource('routes',   { type: 'geojson', data: { type:'FeatureCollection', features: [] }, lineMetrics: true });

      // ── Route arc — lifted into 3D space via line-z-offset ────────────────
      // 5-point sine-ish curve along line-progress, peaking at midpoint at
      // the per-feature arcHeight (meters). Requires Mapbox GL JS ≥ 3.0.
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   '#ff6b35',
          'line-width':   ['interpolate', ['linear'], ['zoom'], 1, 2.2, 6, 3.5],
          'line-opacity': 0.92,
          'line-z-offset': [
            'interpolate', ['linear'], ['line-progress'],
            0,    0,
            0.25, ['*', ['get', 'arcHeight'], 0.707],
            0.5,  ['get', 'arcHeight'],
            0.75, ['*', ['get', 'arcHeight'], 0.707],
            1,    0,
          ],
          'line-emissive-strength': 1,
        },
      });

      // ── Primary airports — always visible, modest size ────────────────────
      map.addLayer({
        id: 'ap-primary',
        type: 'circle',
        source: 'airports',
        filter: ['==', ['get', 'primary'], true],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 3, 4, 4.5, 8, 6],
          'circle-color':        '#0ea5e9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.3,
          'circle-opacity':      0.95,
        },
      });

      // ── Secondary airports — appear only when zoomed in enough to see the
      //    country in detail (~zoom 4). Smaller than primaries.
      map.addLayer({
        id: 'ap-secondary',
        type: 'circle',
        source: 'airports',
        filter: ['==', ['get', 'primary'], false],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4, 2.5, 8, 4.5],
          'circle-color':        '#7dd3fc',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 3.6, 0, 4.6, 0.92],
        },
      });

      // ── Selected stops — orange, on top, slightly larger ──────────────────
      map.addLayer({
        id: 'ap-selected',
        type: 'circle',
        source: 'airports',
        filter: ['in', ['get', 'iata'], ['literal', []]],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 8],
          'circle-color':        '#ff6b35',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity':      1,
        },
      });

      // ── IATA labels: primaries always, secondaries only when zoomed in ────
      map.addLayer({
        id: 'ap-label',
        type: 'symbol',
        source: 'airports',
        filter: ['any',
          ['==', ['get', 'primary'], true],
          ['all', ['==', ['get', 'primary'], false], ['>=', ['zoom'], 5]],
        ],
        layout: {
          'text-field':  ['get', 'iata'],
          'text-font':   ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size':   ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 11, 8, 12],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':      '#1e3a5f',
          'text-halo-color': 'rgba(255,255,255,0.85)',
          'text-halo-width': 1.4,
          'text-opacity':    ['interpolate', ['linear'], ['zoom'], 1, 0.6, 3, 0.95, 5, 1],
        },
      });

      // Start spinning gently if no stops yet.
      if (stopsRef.current.length === 0) transitionSpin(1, 1800);
    });

    // ── Interaction: pause spin smoothly while user is touching the globe ────
    const onInteractStart = () => {
      interactingRef.current = true;
      clearTimeout(idleRef.current);
      // Ease the spin down (not abrupt) — 450ms looks like the globe gently stops.
      if (spinRef.current.target !== 0) transitionSpin(0, 450);
    };

    const onInteractEnd = () => {
      interactingRef.current = false;
      if (stopsRef.current.length > 0) return;            // route in progress → stay paused
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        if (interactingRef.current || stopsRef.current.length > 0) return;
        transitionSpin(1, 1800);                          // ease back up over 1.8s
      }, 2500);                                            // …after 2.5s of stillness
    };

    map.on('dragstart',     onInteractStart);
    map.on('rotatestart',   onInteractStart);
    map.on('pitchstart',    onInteractStart);
    map.on('zoomstart',     onInteractStart);
    map.on('touchstart',    onInteractStart);
    map.on('dragend',       onInteractEnd);
    map.on('rotateend',     onInteractEnd);
    map.on('pitchend',      onInteractEnd);
    map.on('zoomend',       onInteractEnd);
    map.on('touchend',      onInteractEnd);

    // Wheel zoom doesn't fire dragstart/dragend — debounce it ourselves.
    let wheelEnd = null;
    map.on('wheel', () => {
      onInteractStart();
      clearTimeout(wheelEnd);
      wheelEnd = setTimeout(onInteractEnd, 220);
    });

    // ── Click / hover on airport dots ─────────────────────────────────────────
    ['ap-primary', 'ap-secondary'].forEach(layer => {
      map.on('click', layer, e => {
        const p = e.features[0].properties;
        addStop({
          iata: p.iata, name: p.name, city: p.city, country: p.country,
          lat: Number(p.lat), lng: Number(p.lng),
        });
      });
      map.on('mouseenter', layer, e => {
        map.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties;
        setHoveredAirport({
          iata: p.iata, name: p.name, city: p.city, country: p.country,
          primary: p.primary === true || p.primary === 'true',
        });
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
        setHoveredAirport(null);
      });
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(idleRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Sync route arcs + selected highlight when stops change ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => {
      map.getSource('routes')?.setData(routeGeoJSON(stops));
      map.setFilter?.('ap-selected', ['in', ['get', 'iata'], ['literal', stops.map(s => s.iata)]]);
    };
    map.isStyleLoaded() ? sync() : map.once('style.load', sync);

    // Adding a stop pauses the spin smoothly; clearing the route lets it resume.
    clearTimeout(idleRef.current);
    if (stops.length > 0) {
      transitionSpin(0, 450);
    } else if (!interactingRef.current) {
      idleRef.current = setTimeout(() => transitionSpin(1, 1800), 800);
    }
  }, [stops]); // eslint-disable-line

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Hover tooltip */}
      {hoveredAirport && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,253,248,0.96)',
          border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: 8, padding: '7px 16px',
          color: '#333', fontSize: 13,
          fontFamily: 'inherit', pointerEvents: 'none',
          zIndex: 10, whiteSpace: 'nowrap',
          boxShadow: '0 2px 14px rgba(0,0,0,0.14)',
        }}>
          <span style={{ color: '#e05a2b', fontWeight: 700 }}>{hoveredAirport.iata}</span>
          {' · '}{hoveredAirport.name}
          <span style={{ color: '#999', marginLeft: 8 }}>
            {hoveredAirport.city}{hoveredAirport.city && ', '}{hoveredAirport.country}
          </span>
          {hoveredAirport.primary && (
            <span style={{
              marginLeft: 8, fontSize: 10, color: '#0369a1',
              background: 'rgba(3,105,161,0.08)',
              border: '1px solid rgba(3,105,161,0.25)',
              borderRadius: 4, padding: '1px 6px',
            }}>HUB</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 40, right: 20,
        color: 'rgba(30,30,30,0.45)', fontSize: 11,
        fontFamily: 'inherit', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      }}>
        <span>Scroll to zoom · Drag to rotate</span>
        <span style={{ color: 'rgba(14,165,233,0.8)' }}>● Main hubs</span>
        <span style={{ color: 'rgba(125,211,252,0.85)' }}>● Zoom in for more</span>
      </div>
    </div>
  );
}
