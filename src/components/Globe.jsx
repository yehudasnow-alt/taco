import { useRef, useEffect, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouteStore, selectedStopIatas } from '../store/routeStore';
import { useAirports } from '../hooks/useAirports';
import { generateRoutes, buildManualRoute } from '../utils/routeFinder';

mapboxgl.accessToken =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

// ── Great-circle arc ──────────────────────────────────────────────────────────
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

const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// True if the given lng/lat is on the camera-facing side of the globe.
// Uses 3D unit-sphere dot product against the map center direction.
function visibleFromCenter(lng, lat, cLng, cLat) {
  const r = Math.PI / 180;
  const pLa = lat * r, pLo = lng * r;
  const cLa = cLat * r, cLo = cLng * r;
  const dot =
    Math.cos(pLa) * Math.cos(cLa) * Math.cos(pLo - cLo) +
    Math.sin(pLa) * Math.sin(cLa);
  return dot > 0.05; // small buffer so we don't draw points right at the horizon
}

function declutter(map) {
  const layers = map.getStyle()?.layers || [];
  const hide = [
    /road/i, /tunnel/i, /bridge/i, /highway/i, /street/i, /motorway/i,
    /^path/i, /ferry/i, /rail/i, /aerialway/i, /pedestrian/i,
    /^poi/i, /transit/i, /^building/i, /^landuse-/i,
    /admin-1/i, /admin-2/i, /admin-3/i, /state-label/i,
    /natural-line-label/i, /natural-point-label/i,
    /water-line-label/i, /water-point-label/i,
    /settlement-minor-label/i, /settlement-subdivision-label/i,
    /airport-label/i,
  ];
  layers.forEach(layer => {
    if (hide.some(p => p.test(layer.id))) {
      try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
    }
  });
}

export default function Globe() {
  const containerRef = useRef(null);
  const svgRef       = useRef(null);
  const mapRef       = useRef(null);
  const rafRef       = useRef(null);
  const idleRef      = useRef(null);
  const interactingRef = useRef(false);

  const spinRef = useRef({ factor: 0, from: 0, target: 1, start: 0, dur: 1500 });

  const { airports } = useAirports();
  const store = useRouteStore();
  const {
    origin, destination, intermediates,
    maxStops, tripType,
    routeOptions, selectedRouteId,
    hoveredAirport, setHoveredAirport,
    pickAirport, setRouteOptions, selectRoute,
  } = store;

  // Refs that animation/render handlers read — avoid stale closures.
  const stateRef = useRef(store);
  stateRef.current = store;

  // GeoJSON regenerates whenever the airports dataset updates.
  const airportGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: airports.map(a => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        iata: a.iata, name: a.name, city: a.city, country: a.country,
        lat: a.lat, lng: a.lng, tier: a.tier, primary: a.tier === 0,
      },
    })),
  }), [airports]);

  const transitionSpin = (target, dur) => {
    const s = spinRef.current;
    s.from = s.factor; s.target = target;
    s.start = performance.now(); s.dur = dur;
  };
  const tickSpin = (now) => {
    const s = spinRef.current;
    if (s.factor === s.target) return s.factor;
    const t = Math.min(1, (now - s.start) / s.dur);
    s.factor = s.from + (s.target - s.from) * easeInOutCubic(t);
    if (t >= 1) s.factor = s.target;
    return s.factor;
  };

  // ── Render route arcs as SVG overlay ────────────────────────────────────────
  // For each route, we walk its great-circle path one point at a time:
  //   (1) skip points hidden behind the globe (hemisphere check)
  //   (2) project visible points to screen space
  //   (3) lift each point outward radially from the globe's screen center
  //       blended with a touch of straight-up so arcs near the centre still
  //       rise visibly. Magnitude follows sin(progress·π).
  // Visible runs become SVG sub-paths so the arc disappears cleanly when it
  // wraps behind the globe and re-emerges later.
  const renderArcs = () => {
    const map = mapRef.current;
    const svg = svgRef.current;
    if (!map || !svg) return;

    const { routeOptions, selectedRouteId, origin, destination, intermediates, tripType } = stateRef.current;

    // Choose what to draw: algorithmic route options, or the manual route, or nothing.
    let routesToDraw = routeOptions;
    if (routesToDraw.length === 0) {
      const manual = buildManualRoute({ origin, destination, intermediates, tripType });
      if (manual) routesToDraw = [{ ...manual, id: 'manual' }];
    }

    if (routesToDraw.length === 0) { svg.innerHTML = ''; return; }

    const center = map.getCenter();
    const centerScreen = map.project([center.lng, center.lat]);
    const cx = centerScreen.x, cy = centerScreen.y;

    // Sort so the selected route is drawn last (on top).
    const sorted = [...routesToDraw].sort((a, b) => {
      const aSel = a.id === selectedRouteId ? 1 : 0;
      const bSel = b.id === selectedRouteId ? 1 : 0;
      return aSel - bSel;
    });

    const RADIAL_WEIGHT   = 0.65; // 65% radial + 35% straight-up = arcs lift naturally
    const VERTICAL_WEIGHT = 1 - RADIAL_WEIGHT;

    let svgContent = `
      <defs>
        <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
    `;

    for (const route of sorted) {
      const isSelected = route.id === selectedRouteId;
      const opacity    = isSelected ? 1 : 0.45;
      const widthMain  = isSelected ? 3.2 : 2.2;
      const widthGlow  = isSelected ? 10  : 6;

      const segmentPaths = [];

      for (let segI = 0; segI < route.stops.length - 1; segI++) {
        const from = route.stops[segI];
        const to   = route.stops[segI + 1];

        const fromScreen = map.project([from.lng, from.lat]);
        const toScreen   = map.project([to.lng,   to.lat]);
        const screenDist = Math.hypot(toScreen.x - fromScreen.x, toScreen.y - fromScreen.y);
        const peakLift   = Math.min(Math.max(screenDist * 0.20, 35), 340);

        const pts = gcArc(from, to, 96);

        let pathStr = '';
        let inSeg = false;
        for (let j = 0; j < pts.length; j++) {
          const [lng, lat] = pts[j];
          if (!visibleFromCenter(lng, lat, center.lng, center.lat)) {
            inSeg = false;
            continue;
          }
          const screen = map.project([lng, lat]);
          const t = j / (pts.length - 1);
          const lift = Math.sin(t * Math.PI) * peakLift;

          // Direction: outward from globe centre in screen space.
          const rdx = screen.x - cx, rdy = screen.y - cy;
          const rlen = Math.hypot(rdx, rdy);
          const ux_r = rlen > 1 ? rdx / rlen : 0;
          const uy_r = rlen > 1 ? rdy / rlen : -1;

          // Blend with straight-up so arcs over the centre of view still rise.
          const bx = ux_r * RADIAL_WEIGHT + 0  * VERTICAL_WEIGHT;
          const by = uy_r * RADIAL_WEIGHT + -1 * VERTICAL_WEIGHT;
          const blen = Math.hypot(bx, by);
          const ux = blen > 0 ? bx / blen : 0;
          const uy = blen > 0 ? by / blen : -1;

          const x = screen.x + ux * lift;
          const y = screen.y + uy * lift;

          pathStr += (inSeg ? 'L' : 'M') + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
          inSeg = true;
        }
        if (pathStr) segmentPaths.push(pathStr);
      }

      segmentPaths.forEach(d => {
        svgContent += `<path d="${d}" fill="none" stroke="${route.color}" stroke-opacity="${0.35 * opacity}" stroke-width="${widthGlow}" filter="url(#arcGlow)" />`;
        svgContent += `<path d="${d}" fill="none" stroke="${route.color}" stroke-opacity="${opacity}" stroke-width="${widthMain}" stroke-linecap="round" />`;
      });
    }

    svg.innerHTML = svgContent;
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

    map.scrollZoom.setZoomRate(1 / 220);
    map.scrollZoom.setWheelZoomRate(1 / 220);

    let prev = null;
    const frame = (ts) => {
      const factor = tickSpin(ts);
      const noStops = !stateRef.current.origin && !stateRef.current.destination;
      if (prev !== null && factor > 0.001 && !interactingRef.current
          && !map.isMoving() && noStops) {
        const dt   = ts - prev;
        const zoom = map.getZoom();
        const zoomScale = Math.max(0, Math.min(1, (3.5 - zoom) / 2));
        if (zoomScale > 0) {
          const c = map.getCenter();
          c.lng += 0.006 * dt * factor * zoomScale;
          map.setCenter(c, { animate: false });
        }
      }
      prev = ts;
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    map.on('style.load', () => {
      declutter(map);

      map.setFog({
        color:            'rgb(220, 232, 248)',
        'high-color':     'rgb(32, 78, 180)',
        'horizon-blend':  0.04,
        'space-color':    'rgb(7, 7, 20)',
        'star-intensity': 0.45,
      });

      map.addSource('airports', { type: 'geojson', data: airportGeoJSON });

      // ── Tier 0 (country primary): bold blue, glow, always visible ─────────
      map.addLayer({
        id: 'ap-t0-glow', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 0],
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 13, 8, 18],
          'circle-color':   '#0ea5e9',
          'circle-opacity': 0.28,
          'circle-blur':    0.65,
        },
      });
      map.addLayer({
        id: 'ap-t0', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 0],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 4.5, 4, 6.5, 8, 8.5],
          'circle-color':        '#0ea5e9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity':      1,
        },
      });

      // ── Secondary tiers (1–3): white fill, blue outline, smaller. Hidden
      //    until you zoom into a country (≥ 4.5 for major, ≥ 5.5 / 7 for the rest).
      map.addLayer({
        id: 'ap-t1', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 1],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4.5, 3, 9, 5],
          'circle-color':        '#ffffff',
          'circle-stroke-color': '#0ea5e9',
          'circle-stroke-width': 1.8,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 4.3, 0, 5.0, 1],
        },
      });
      map.addLayer({
        id: 'ap-t2', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 2],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 5.5, 2.5, 9, 4],
          'circle-color':        '#ffffff',
          'circle-stroke-color': '#38bdf8',
          'circle-stroke-width': 1.4,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 5.3, 0, 6.0, 1],
        },
      });
      map.addLayer({
        id: 'ap-t3', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 3],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 3.5],
          'circle-color':        '#ffffff',
          'circle-stroke-color': '#7dd3fc',
          'circle-stroke-width': 1.2,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 6.8, 0, 7.5, 1],
        },
      });

      // ── Selected stops (orange, prominent, on top) ─────────────────────────
      map.addLayer({
        id: 'ap-sel-glow', type: 'circle', source: 'airports',
        filter: ['in', ['get', 'iata'], ['literal', []]],
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 1, 14, 6, 22],
          'circle-color':   '#ff6b35',
          'circle-opacity': 0.35,
          'circle-blur':    0.55,
        },
      });
      map.addLayer({
        id: 'ap-sel', type: 'circle', source: 'airports',
        filter: ['in', ['get', 'iata'], ['literal', []]],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 6.5, 6, 11],
          'circle-color':        '#ff6b35',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });

      // ── IATA labels: tier-aware visibility ────────────────────────────────
      map.addLayer({
        id: 'ap-label', type: 'symbol', source: 'airports',
        filter: ['any',
          ['==', ['get', 'tier'], 0],
          ['all', ['==', ['get', 'tier'], 1], ['>=', ['zoom'], 5]],
          ['all', ['==', ['get', 'tier'], 2], ['>=', ['zoom'], 6]],
          ['all', ['==', ['get', 'tier'], 3], ['>=', ['zoom'], 7.5]],
        ],
        layout: {
          'text-field':       ['get', 'iata'],
          'text-font':        ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size':        ['interpolate', ['linear'], ['zoom'], 1, 10, 4, 12, 8, 14],
          'text-offset':      [0, 1.3],
          'text-anchor':      'top',
          'text-allow-overlap': false,
          'symbol-sort-key':  ['get', 'tier'],
        },
        paint: {
          'text-color':      '#0c4a6e',
          'text-halo-color': 'rgba(255,255,255,0.95)',
          'text-halo-width': 2,
          'text-opacity':    ['interpolate', ['linear'], ['zoom'], 1, 0.7, 3, 0.95, 5, 1],
        },
      });

      const empty = !stateRef.current.origin && !stateRef.current.destination;
      if (empty) transitionSpin(1, 1800);
      renderArcs();
    });

    map.on('move',   renderArcs);
    map.on('resize', renderArcs);

    const onInteractStart = () => {
      interactingRef.current = true;
      clearTimeout(idleRef.current);
      if (spinRef.current.target !== 0) transitionSpin(0, 450);
    };
    const onInteractEnd = () => {
      interactingRef.current = false;
      const { origin, destination } = stateRef.current;
      if (origin || destination) return;
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        if (interactingRef.current) return;
        const s = stateRef.current;
        if (!s.origin && !s.destination) transitionSpin(1, 1800);
      }, 2500);
    };

    map.on('dragstart',   onInteractStart);
    map.on('rotatestart', onInteractStart);
    map.on('pitchstart',  onInteractStart);
    map.on('zoomstart',   onInteractStart);
    map.on('touchstart',  onInteractStart);
    map.on('dragend',     onInteractEnd);
    map.on('rotateend',   onInteractEnd);
    map.on('pitchend',    onInteractEnd);
    map.on('zoomend',     onInteractEnd);
    map.on('touchend',    onInteractEnd);

    let wheelEnd = null;
    map.on('wheel', () => {
      onInteractStart();
      clearTimeout(wheelEnd);
      wheelEnd = setTimeout(onInteractEnd, 220);
    });

    // Bind click + hover to every tier layer.
    ['ap-t0', 'ap-t1', 'ap-t2', 'ap-t3'].forEach(layer => {
      map.on('click', layer, e => {
        const p = e.features[0].properties;
        const airport = {
          iata: p.iata, name: p.name, city: p.city, country: p.country,
          lat: Number(p.lat), lng: Number(p.lng),
        };
        // Use a fresh getState call to avoid stale closure
        stateRef.current.pickAirport(airport);
      });
      map.on('mouseenter', layer, e => {
        map.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties;
        stateRef.current.setHoveredAirport({
          iata: p.iata, name: p.name, city: p.city, country: p.country,
          primary: p.primary === true || p.primary === 'true',
        });
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
        stateRef.current.setHoveredAirport(null);
      });
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(idleRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Refresh source when airports dataset grows ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => map.getSource('airports')?.setData(airportGeoJSON);
    map.isStyleLoaded() ? apply() : map.once('style.load', apply);
  }, [airportGeoJSON]);

  // ── Generate route options whenever the search params change ────────────────
  useEffect(() => {
    if (!origin || !destination) {
      setRouteOptions([]);
      selectRoute(null);
      return;
    }
    if (intermediates.length > 0) {
      // Manual override — the user has explicit stops; skip the algorithm
      // and render exactly the manual route (built inside renderArcs).
      setRouteOptions([]);
      selectRoute(null);
      return;
    }
    const opts = generateRoutes({
      origin, destination,
      maxStops, tripType,
      allAirports: airports,
    });
    setRouteOptions(opts);
    selectRoute(opts[0]?.id || null);
  }, [origin, destination, intermediates, maxStops, tripType, airports]);  // eslint-disable-line

  // ── Update selected highlight + redraw arcs when routes change ──────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const iatas = selectedStopIatas(stateRef.current);
      ['ap-sel', 'ap-sel-glow'].forEach(id => {
        map.setFilter?.(id, ['in', ['get', 'iata'], ['literal', iatas]]);
      });
      renderArcs();
    };
    map.isStyleLoaded() ? apply() : map.once('style.load', apply);

    clearTimeout(idleRef.current);
    const hasRoute = !!(origin || destination);
    if (hasRoute) {
      transitionSpin(0, 450);
    } else if (!interactingRef.current) {
      idleRef.current = setTimeout(() => transitionSpin(1, 1800), 800);
    }
  }, [origin, destination, intermediates, routeOptions, selectedRouteId]);  // eslint-disable-line

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <svg
        ref={svgRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

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

      <div style={{
        position: 'absolute', bottom: 40, right: 20,
        color: 'rgba(30,30,30,0.55)', fontSize: 11,
        fontFamily: 'inherit', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
        zIndex: 3,
      }}>
        <span>Scroll to zoom · Drag to rotate</span>
        <span style={{ color: 'rgba(14,165,233,0.95)' }}>● Main hubs</span>
        <span style={{ color: 'rgba(125,211,252,0.95)' }}>○ Zoom in for more</span>
      </div>
    </div>
  );
}
