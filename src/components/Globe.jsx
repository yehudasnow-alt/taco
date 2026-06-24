import { useRef, useEffect, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouteStore } from '../store/routeStore';
import { useAirports } from '../hooks/useAirports';

mapboxgl.accessToken =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

// ── Great-circle arc (densified for smooth visual curve) ──────────────────────
function gcArc(from, to, n = 80) {
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

// Hide street/POI/internal-admin clutter from any Mapbox style. Keeps water,
// land, terrain shading, country borders, and major place labels.
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
    /airport-label/i, // we draw our own
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
  const stopsRef     = useRef([]);
  const interactingRef = useRef(false);

  const spinRef = useRef({ factor: 0, from: 0, target: 1, start: 0, dur: 1500 });

  const { airports, loading } = useAirports();
  const { stops, addStop, hoveredAirport, setHoveredAirport } = useRouteStore();
  stopsRef.current = stops;

  // GeoJSON regenerates whenever the airports dataset updates (CSV finishes loading).
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

  // ── Render SVG arc overlay (direct DOM for perf during map moves) ───────────
  const renderArcs = () => {
    const map = mapRef.current;
    const svg = svgRef.current;
    if (!map || !svg) return;
    const stops = stopsRef.current;

    if (stops.length < 2) { svg.innerHTML = ''; return; }

    const segments = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to   = stops[i + 1];
      const pts  = gcArc(from, to, 80);
      const proj = pts.map(([lng, lat]) => {
        const p = map.project([lng, lat]);
        return [p.x, p.y];
      });
      const dx = proj[proj.length - 1][0] - proj[0][0];
      const dy = proj[proj.length - 1][1] - proj[0][1];
      const screenDist = Math.hypot(dx, dy);
      const peakLift   = Math.min(Math.max(screenDist * 0.18, 30), 320);
      const path = proj.map(([x, y], j) => {
        const t = j / (proj.length - 1);
        const lift = Math.sin(t * Math.PI) * peakLift;
        return (j === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + (y - lift).toFixed(1);
      }).join(' ');
      segments.push(path);
    }

    svg.innerHTML = `
      <defs>
        <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      ${segments.map(d => `
        <path d="${d}" fill="none" stroke="#ff6b35" stroke-opacity="0.35" stroke-width="9" filter="url(#arcGlow)" />
        <path d="${d}" fill="none" stroke="#ff6b35" stroke-width="2.6" stroke-linecap="round" />
      `).join('')}
    `;
  };

  // ── Init map (once) ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:      'mapbox://styles/mapbox/outdoors-v12',  // natural colors: sea, green land, beige desert
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
      if (prev !== null && factor > 0.001 && !interactingRef.current
          && !map.isMoving() && stopsRef.current.length === 0) {
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

      // Use the current airports state (might be initial or already-loaded CSV)
      map.addSource('airports', { type: 'geojson', data: airportGeoJSON });

      // ── Tier 0 — country primary, always visible ──────────────────────────
      map.addLayer({
        id: 'ap-t0-glow', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 0],
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 1, 9,  4, 13, 8, 18],
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

      // ── Tier 1 — major airports + curated secondaries, from zoom 2.8 ──────
      map.addLayer({
        id: 'ap-t1-glow', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 1],
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 3, 7, 8, 12],
          'circle-color':   '#0ea5e9',
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2.6, 0, 3.6, 0.22],
          'circle-blur':    0.7,
        },
      });
      map.addLayer({
        id: 'ap-t1', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 1],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 3, 3.5, 8, 5.5],
          'circle-color':        '#38bdf8',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.6,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 2.6, 0, 3.6, 1],
        },
      });

      // ── Tier 2 — medium commercial airports, from zoom 4.5 ────────────────
      map.addLayer({
        id: 'ap-t2', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 2],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 4.5, 2.5, 9, 4.5],
          'circle-color':        '#7dd3fc',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 4.3, 0, 5.3, 0.95],
        },
      });

      // ── Tier 3 — small airports with scheduled service, from zoom 6.5 ─────
      map.addLayer({
        id: 'ap-t3', type: 'circle', source: 'airports',
        filter: ['==', ['get', 'tier'], 3],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 6.5, 2, 10, 3.5],
          'circle-color':        '#bae6fd',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity':      ['interpolate', ['linear'], ['zoom'], 6.3, 0, 7.3, 0.9],
        },
      });

      // ── Selected stops on top ─────────────────────────────────────────────
      map.addLayer({
        id: 'ap-selected-glow', type: 'circle', source: 'airports',
        filter: ['in', ['get', 'iata'], ['literal', []]],
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 1, 14, 6, 22],
          'circle-color':   '#ff6b35',
          'circle-opacity': 0.35,
          'circle-blur':    0.55,
        },
      });
      map.addLayer({
        id: 'ap-selected', type: 'circle', source: 'airports',
        filter: ['in', ['get', 'iata'], ['literal', []]],
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 6.5, 6, 11],
          'circle-color':        '#ff6b35',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-opacity':      1,
        },
      });

      // ── IATA labels: tier-aware visibility, sort by tier so primaries win ─
      map.addLayer({
        id: 'ap-label', type: 'symbol', source: 'airports',
        filter: ['any',
          ['==', ['get', 'tier'], 0],
          ['all', ['==', ['get', 'tier'], 1], ['>=', ['zoom'], 4]],
          ['all', ['==', ['get', 'tier'], 2], ['>=', ['zoom'], 5.5]],
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

      if (stopsRef.current.length === 0) transitionSpin(1, 1800);
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
      if (stopsRef.current.length > 0) return;
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        if (interactingRef.current || stopsRef.current.length > 0) return;
        transitionSpin(1, 1800);
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

    // Bind click + hover to every tier layer (so users can click the small dots too)
    ['ap-t0', 'ap-t1', 'ap-t2', 'ap-t3'].forEach(layer => {
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

  // ── Update source whenever airports dataset grows (CSV finished loading) ────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => map.getSource('airports')?.setData(airportGeoJSON);
    map.isStyleLoaded() ? apply() : map.once('style.load', apply);
  }, [airportGeoJSON]);

  // ── Sync selected highlight + arcs when stops change ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const iatas = stops.map(s => s.iata);
      ['ap-selected', 'ap-selected-glow'].forEach(id => {
        map.setFilter?.(id, ['in', ['get', 'iata'], ['literal', iatas]]);
      });
      renderArcs();
    };
    map.isStyleLoaded() ? apply() : map.once('style.load', apply);

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

      {/* Loading indicator while CSV downloads (first visit only — then localStorage). */}
      {loading && (
        <div style={{
          position: 'absolute', top: 16, right: 20,
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 999, padding: '5px 12px',
          color: '#555', fontSize: 11,
          fontFamily: 'inherit', pointerEvents: 'none',
          zIndex: 5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          Loading airports…
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
        <span style={{ color: 'rgba(125,211,252,0.95)' }}>● Zoom in for more</span>
      </div>
    </div>
  );
}
