import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouteStore } from '../store/routeStore';
import { useAirports }   from '../hooks/useAirports';

// ── Mapbox token ───────────────────────────────────────────────────────────────
// Get your own free token at https://mapbox.com (50k loads/month free)
// In production: move to VITE_MAPBOX_TOKEN in .env.local
mapboxgl.accessToken =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

// ── One major hub per country (tier 0) ────────────────────────────────────────
const TIER0 = new Set([
  // Americas
  'JFK','LAX','ORD','MIA','SFO','YYZ','MEX','GRU','EZE','SCL','LIM','BOG',
  // Europe
  'LHR','CDG','FRA','AMS','MAD','FCO','IST','VIE','ZRH','ARN','CPH','HEL',
  'BCN','MUC','BRU','ATH','LIS','WAW','PRG','BUD','DUB','OTP',
  // Middle East & Africa
  'DXB','DOH','RUH','TLV','CAI','AMM','JNB','NBO','LOS','ADD','CMN','ACC','CPT',
  // Asia-Pacific
  'NRT','ICN','PEK','PVG','HKG','SIN','BKK','DEL','BOM','KUL','CGK','MNL','SGN',
  'SYD','MEL','AKL','SVO',
]);

// ── Great-circle arc (densified so Mapbox renders it curved on globe) ─────────
function gcArc(from, to, n = 80) {
  const R   = Math.PI / 180;
  const D   = 180 / Math.PI;
  const la1 = from.lat * R, lo1 = from.lng * R;
  const la2 = to.lat   * R, lo2 = to.lng   * R;
  const d   = 2 * Math.asin(Math.sqrt(
    Math.sin((la2-la1)/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2
  ));
  if (d < 1e-10) return [[from.lng, from.lat]];
  return Array.from({length: n+1}, (_,i) => {
    const f = i/n;
    const A = Math.sin((1-f)*d)/Math.sin(d), B = Math.sin(f*d)/Math.sin(d);
    const x = A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2);
    const y = A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2);
    const z = A*Math.sin(la1)+B*Math.sin(la2);
    return [Math.atan2(y,x)*D, Math.atan2(z,Math.sqrt(x*x+y*y))*D];
  });
}

function airportGeoJSON(airports) {
  return {
    type: 'FeatureCollection',
    features: airports.map(a => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: {
        iata: a.iata, name: a.name, city: a.city,
        country: a.country, lat: a.lat, lng: a.lng,
        tier: TIER0.has(a.iata) ? 0 : a.tier === 1 ? 1 : 2,
      },
    }))
  };
}

function routeGeoJSON(stops) {
  if (stops.length < 2) return { type:'FeatureCollection', features:[] };
  return {
    type: 'FeatureCollection',
    features: stops.slice(0,-1).map((from,i) => ({
      type: 'Feature',
      geometry: { type:'LineString', coordinates: gcArc(from, stops[i+1]) },
      properties: {},
    }))
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Globe() {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const spinRef      = useRef(null);   // rAF handle
  const idleRef      = useRef(null);   // resume-after-idle timer
  const stopsRef     = useRef([]);

  const { stops, addStop, hoveredAirport, setHoveredAirport } = useRouteStore();
  const { airports } = useAirports();

  stopsRef.current = stops;

  // ── Spin helpers (stable refs so they don't re-trigger effects) ───────────
  const startSpin = useRef(() => {
    if (spinRef.current) return;
    let prev = null;
    const frame = (ts) => {
      if (prev !== null && mapRef.current && !mapRef.current.isMoving()) {
        const dt = ts - prev;
        const c  = mapRef.current.getCenter();
        c.lng   += 0.008 * dt; // ~0.5 °/s
        mapRef.current.setCenter(c, { animate: false });
      }
      prev = ts;
      spinRef.current = requestAnimationFrame(frame);
    };
    spinRef.current = requestAnimationFrame(frame);
  }).current;

  const stopSpin = useRef(() => {
    cancelAnimationFrame(spinRef.current);
    spinRef.current = null;
    clearTimeout(idleRef.current);
    idleRef.current = null;
  }).current;

  const scheduleResume = useRef(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      if (stopsRef.current.length === 0 && mapRef.current) startSpin();
    }, 3000);
  }).current;

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/outdoors-v12',
      projection: 'globe',
      zoom:       1.8,
      center:     [15, 20],
      pitch:      0,
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on('style.load', () => {
      // Space fog around globe
      map.setFog({
        color:            'rgb(215, 230, 248)',
        'high-color':     'rgb(28, 65, 200)',
        'horizon-blend':  0.03,
        'space-color':    'rgb(7, 7, 20)',
        'star-intensity': 0.5,
      });

      // ── Sources ──────────────────────────────────────────────────────────
      map.addSource('airports', {
        type: 'geojson',
        data: { type:'FeatureCollection', features:[] },
      });
      map.addSource('routes', {
        type: 'geojson',
        data: { type:'FeatureCollection', features:[] },
        lineMetrics: true,
      });

      // ── Route arc ─────────────────────────────────────────────────────────
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap':'round', 'line-join':'round' },
        paint: {
          'line-color':   '#ff6b35',
          'line-width':   ['interpolate',['linear'],['zoom'], 1,2, 6,3.5],
          'line-opacity': 0.88,
        },
      });

      // ── Airport layers (tier 0 → 1 → 2, revealed by zoom) ────────────────
      // Tier 0: always visible
      map.addLayer({
        id: 'ap-t0',
        type: 'circle',
        source: 'airports',
        filter: ['==',['get','tier'],0],
        paint: {
          'circle-radius':         ['interpolate',['linear'],['zoom'],1,5,4,7,8,11],
          'circle-color':          '#0ea5e9',
          'circle-stroke-color':   '#ffffff',
          'circle-stroke-width':   1.8,
          'circle-opacity':        1,
        },
      });

      // Tier 1: large airports at zoom ≥ 2.5
      map.addLayer({
        id: 'ap-t1',
        type: 'circle',
        source: 'airports',
        filter: ['all',['==',['get','tier'],1],['>=',['zoom'],2.5]],
        paint: {
          'circle-radius':         ['interpolate',['linear'],['zoom'],2.5,3,6,7,10,11],
          'circle-color':          '#38bdf8',
          'circle-stroke-color':   '#ffffff',
          'circle-stroke-width':   1.2,
          'circle-opacity':        ['interpolate',['linear'],['zoom'],2.5,0,3.2,1],
        },
      });

      // Tier 2: medium airports at zoom ≥ 4.5
      map.addLayer({
        id: 'ap-t2',
        type: 'circle',
        source: 'airports',
        filter: ['all',['==',['get','tier'],2],['>=',['zoom'],4.5]],
        paint: {
          'circle-radius':         ['interpolate',['linear'],['zoom'],4.5,2,8,6],
          'circle-color':          '#7dd3fc',
          'circle-stroke-color':   '#ffffff',
          'circle-stroke-width':   0.8,
          'circle-opacity':        ['interpolate',['linear'],['zoom'],4.5,0,5.2,1],
        },
      });

      // Selected stops (orange, on top)
      map.addLayer({
        id: 'ap-selected',
        type: 'circle',
        source: 'airports',
        filter: ['in',['get','iata'],['literal',[]]],
        paint: {
          'circle-radius':         ['interpolate',['linear'],['zoom'],1,8,6,14],
          'circle-color':          '#ff6b35',
          'circle-stroke-color':   '#ffffff',
          'circle-stroke-width':   2.5,
          'circle-opacity':        1,
        },
      });

      // Airport IATA label (fades in at zoom 4+)
      map.addLayer({
        id: 'ap-label',
        type: 'symbol',
        source: 'airports',
        filter: ['any',
          ['==',['get','tier'],0],
          ['all',['==',['get','tier'],1],['>=',['zoom'],4]],
        ],
        layout: {
          'text-field':  ['get','iata'],
          'text-font':   ['DIN Pro Medium','Arial Unicode MS Regular'],
          'text-size':   ['interpolate',['linear'],['zoom'],1,9,4,11,8,13],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':        '#1e3a5f',
          'text-halo-color':   'rgba(255,255,255,0.85)',
          'text-halo-width':   1.5,
          'text-opacity':      ['interpolate',['linear'],['zoom'],1,0.7,3,1],
        },
      });

      // Populate if airports already loaded
      if (stopsRef.current.length === 0) startSpin();
    });

    // ── Interaction: stop spin, resume after idle ────────────────────────────
    const onDown  = () => stopSpin();
    const onUp    = () => { if (stopsRef.current.length === 0) scheduleResume(); };
    const onWheel = () => { stopSpin(); scheduleResume(); };

    map.on('mousedown',  onDown);
    map.on('touchstart', onDown);
    map.on('mouseup',    onUp);
    map.on('touchend',   onUp);
    map.on('wheel',      onWheel);

    // ── Clicks on airport dots ───────────────────────────────────────────────
    ['ap-t0','ap-t1','ap-t2'].forEach(layer => {
      map.on('click', layer, e => {
        const p = e.features[0].properties;
        addStop({ iata:p.iata, name:p.name, city:p.city, country:p.country,
                  lat:p.lat, lng:p.lng });
      });
      map.on('mouseenter', layer, e => {
        map.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties;
        setHoveredAirport({ iata:p.iata, name:p.name, city:p.city, country:p.country, tier:p.tier });
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
        setHoveredAirport(null);
      });
    });

    return () => {
      stopSpin();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Sync airports data ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !airports.length) return;
    const sync = () => map.getSource('airports')?.setData(airportGeoJSON(airports));
    map.isStyleLoaded() ? sync() : map.once('style.load', sync);
  }, [airports]);

  // ── Sync route arcs & selected highlights ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => {
      map.getSource('routes')?.setData(routeGeoJSON(stops));
      map.setFilter?.('ap-selected', ['in',['get','iata'],['literal',stops.map(s=>s.iata)]]);
    };
    map.isStyleLoaded() ? sync() : map.once('style.load', sync);
    if (stops.length > 0) stopSpin();
  }, [stops]); // eslint-disable-line

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />

      {/* Hover tooltip */}
      {hoveredAirport && (
        <div style={{
          position:'absolute', bottom:40, left:'50%',
          transform:'translateX(-50%)',
          background:'rgba(255,253,248,0.96)',
          border:'1px solid rgba(0,0,0,0.09)',
          borderRadius:8, padding:'7px 16px',
          color:'#333', fontSize:13,
          fontFamily:'inherit', pointerEvents:'none',
          zIndex:10, whiteSpace:'nowrap',
          boxShadow:'0 2px 14px rgba(0,0,0,0.14)',
        }}>
          <span style={{color:'#e05a2b',fontWeight:700}}>{hoveredAirport.iata}</span>
          {' · '}{hoveredAirport.name}
          <span style={{color:'#999',marginLeft:8}}>
            {hoveredAirport.city}{hoveredAirport.city&&', '}{hoveredAirport.country}
          </span>
          {hoveredAirport.tier === 0 && (
            <span style={{marginLeft:8,fontSize:10,color:'#0369a1',
              background:'rgba(3,105,161,0.08)',border:'1px solid rgba(3,105,161,0.25)',
              borderRadius:4,padding:'1px 6px'}}>HUB</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position:'absolute', bottom:40, right:20,
        color:'rgba(30,30,30,0.45)', fontSize:11,
        fontFamily:'inherit', pointerEvents:'none',
        display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4,
      }}>
        <span>Scroll to zoom · Drag to rotate</span>
        <span style={{color:'rgba(14,165,233,0.8)'}}>● Major hubs always visible</span>
        <span style={{color:'rgba(96,165,250,0.7)'}}>· Zoom in to reveal more airports</span>
      </div>
    </div>
  );
}
