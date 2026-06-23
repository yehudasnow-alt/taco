import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

import { latLngToVector3, createArcPoints } from '../utils/geo';
import { getBorderGeometry }                from '../utils/borders';
import { generateEarthTexture }             from '../utils/earthTexture';
import { useRouteStore }                    from '../store/routeStore';
import { useAirports }                      from '../hooks/useAirports';

// ── Tier-0: one major hub per country visible from max zoom-out (~50 airports) ─
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
  'SYD','MEL','AKL',
  // Russia / CIS
  'SVO',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Earth (vector canvas texture)
// ─────────────────────────────────────────────────────────────────────────────
function Earth() {
  const [tex, setTex] = useState(null);

  useEffect(() => {
    let live = true;
    generateEarthTexture().then(t => { if (live) setTex(t); });
    return () => { live = false; };
  }, []);

  return (
    <group>
      {/* Atmosphere rim */}
      <mesh scale={1.055}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#4a9eff" transparent opacity={0.05}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Globe */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        {tex
          ? <meshStandardMaterial map={tex} roughness={0.6} metalness={0} />
          : <meshBasicMaterial color={OCEAN_PLACEHOLDER} />}
      </mesh>
    </group>
  );
}
const OCEAN_PLACEHOLDER = '#bed8ec';

// ─────────────────────────────────────────────────────────────────────────────
// Country border lines (crisp 3-D overlay)
// ─────────────────────────────────────────────────────────────────────────────
function CountryBorders() {
  const geo = useMemo(() => getBorderGeometry(), []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#9a8f7a" transparent opacity={0.28} />
    </lineSegments>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Airport dots (InstancedMesh — updates only when something changes)
// ─────────────────────────────────────────────────────────────────────────────
const MAX_INST = 2500;
const _O = new THREE.Object3D();
const _C = new THREE.Color();

function AirportDots({ sorted, t0end, t1end, stopIatas, hovered, onClick, onHover }) {
  const ref    = useRef();
  const { camera } = useThree();

  // 3-D positions cached — only recalculated when airport list changes
  const pos3d = useMemo(
    () => sorted.map(a => latLngToVector3(a.lat, a.lng, 1.015)),
    [sorted]
  );

  const prev = useRef({ dist: -1, stops: null, hov: null, cnt: -1 });

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !sorted.length) return;

    const dist = camera.position.length();
    const p    = prev.current;

    // LOD thresholds
    const cnt = dist > 3.4 ? t0end
              : dist > 2.55 ? t1end
              : sorted.length;

    if (
      Math.abs(dist - p.dist) < 0.012 &&
      stopIatas === p.stops &&
      hovered   === p.hov   &&
      cnt       === p.cnt
    ) return;

    // Dot size: constant apparent size on screen
    const base = 0.0115 * (dist / 2.6);

    if (cnt !== mesh.count) mesh.count = cnt;

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      _O.position.copy(pos3d[i]);
      const isT0 = TIER0.has(a.iata);
      _O.scale.setScalar(isT0 ? base * 1.9 : a.tier === 1 ? base * 1.2 : base * 0.75);
      _O.updateMatrix();
      mesh.setMatrixAt(i, _O.matrix);

      const isStop = stopIatas.has(a.iata);
      const isHov  = hovered?.iata === a.iata;
      _C.set(isStop ? '#ff6b35' : isHov ? '#ffffff'
           : isT0   ? '#2dd4bf' : a.tier === 1 ? '#60a5fa' : '#93c5fd');
      mesh.setColorAt(i, _C);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    p.dist  = dist;
    p.stops = stopIatas;
    p.hov   = hovered;
    p.cnt   = cnt;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[null, null, MAX_INST]}
      onClick={e => { e.stopPropagation(); const a = sorted[e.instanceId]; if (a) onClick(a); }}
      onPointerMove={e => { e.stopPropagation(); const a = sorted[e.instanceId]; if (a) onHover(a); }}
      onPointerLeave={() => onHover(null)}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated dashed arc
// ─────────────────────────────────────────────────────────────────────────────
function RouteArc({ from, to }) {
  const pts = useMemo(
    () => createArcPoints(from.lat, from.lng, to.lat, to.lng, 120, 0.14),
    [from, to]
  );
  const geo    = useMemo(() => new THREE.BufferGeometry().setFromPoints(pts), [pts]);
  const matRef = useRef();
  useFrame(() => { if (matRef.current) matRef.current.dashOffset -= 0.004; });
  return (
    <line geometry={geo}>
      <lineDashedMaterial ref={matRef}
        color="#ff6b35" dashSize={0.055} gapSize={0.025} transparent opacity={0.92} />
    </line>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene (needs useThree, so must live inside Canvas)
// ─────────────────────────────────────────────────────────────────────────────
function Scene({ stops, addStop, setHovered, hovered, autoRotate }) {
  const { airports } = useAirports();
  const stopIatas = useMemo(() => new Set(stops.map(s => s.iata)), [stops]);

  // Sort: tier0 first → large_airport → medium_airport
  const { sorted, t0end, t1end } = useMemo(() => {
    const t0 = airports.filter(a =>  TIER0.has(a.iata));
    const t1 = airports.filter(a => !TIER0.has(a.iata) && a.tier === 1);
    const t2 = airports.filter(a => !TIER0.has(a.iata) && a.tier !== 1);
    return {
      sorted: [...t0, ...t1, ...t2],
      t0end:  t0.length,
      t1end:  t0.length + t1.length,
    };
  }, [airports]);

  return (
    <>
      <ambientLight intensity={2.5} />
      <directionalLight position={[5, 3, 5]}  intensity={0.7} />
      <directionalLight position={[-3, 2, -3]} intensity={0.25} color="#d0e8ff" />

      <Stars radius={280} depth={50} count={1600} factor={3} fade speed={0.2} />

      <Earth />
      <CountryBorders />

      {sorted.length > 0 && (
        <AirportDots
          sorted={sorted} t0end={t0end} t1end={t1end}
          stopIatas={stopIatas} hovered={hovered}
          onClick={addStop} onHover={setHovered}
        />
      )}

      {stops.length > 1 && stops.slice(0, -1).map((s, i) => (
        <RouteArc key={`${s.iata}-${stops[i+1].iata}`} from={s} to={stops[i+1]} />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={1.04}      /* zoom very close to surface */
        maxDistance={5.2}
        rotateSpeed={0.38}
        zoomSpeed={0.7}
        enableDamping
        dampingFactor={0.07}
        autoRotate={autoRotate && stops.length === 0}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────
export default function Globe() {
  const { stops, addStop, setHoveredAirport, hoveredAirport } = useRouteStore();

  // Globe auto-rotates until user first touches it — then stops permanently
  const [autoRotate, setAutoRotate] = useState(true);
  const touched = useRef(false);
  const handleTouch = () => {
    if (!touched.current) { touched.current = true; setAutoRotate(false); }
  };

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerDown={handleTouch}
    >
      {/* Hover tooltip */}
      {hoveredAirport && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,253,248,0.95)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 8, padding: '7px 16px',
          color: '#3a3530', fontSize: 13,
          fontFamily: 'inherit', pointerEvents: 'none',
          zIndex: 10, whiteSpace: 'nowrap',
          boxShadow: '0 2px 14px rgba(0,0,0,0.14)',
        }}>
          <span style={{ color: '#e05a2b', fontWeight: 700 }}>{hoveredAirport.iata}</span>
          {' · '}{hoveredAirport.name}
          <span style={{ color: '#999', marginLeft: 8 }}>
            {hoveredAirport.city}{hoveredAirport.city && ', '}{hoveredAirport.country}
          </span>
          {TIER0.has(hoveredAirport.iata) && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#0d9488',
              background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.3)',
              borderRadius: 4, padding: '1px 6px' }}>HUB</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 40, right: 20,
        color: 'rgba(255,255,255,0.35)', fontSize: 11,
        fontFamily: 'inherit', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      }}>
        <span>Scroll to zoom · Drag to rotate</span>
        <span style={{ color: 'rgba(45,212,191,0.75)' }}>● Major hubs always visible</span>
        <span style={{ color: 'rgba(96,165,250,0.6)' }}>· Zoom in to reveal more airports</span>
      </div>

      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene
          stops={stops}
          addStop={addStop}
          setHovered={setHoveredAirport}
          hovered={hoveredAirport}
          autoRotate={autoRotate}
        />
      </Canvas>
    </div>
  );
}
