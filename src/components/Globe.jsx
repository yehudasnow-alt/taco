import { Suspense, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { latLngToVector3, createArcPoints } from '../utils/geo';
import { getBorderGeometry } from '../utils/borders';
import { useRouteStore } from '../store/routeStore';
import { useAirports } from '../hooks/useAirports';

const TEX_DAY  = 'https://unpkg.com/three-globe/example/img/earth-day.jpg';
const TEX_BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

// ─── Earth ────────────────────────────────────────────────────────────────────
function Earth() {
  const [day, bump] = useTexture([TEX_DAY, TEX_BUMP]);
  day.colorSpace = THREE.SRGBColorSpace;
  return (
    <group>
      {/* Atmosphere glow */}
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#3a8fff" transparent opacity={0.06}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Globe */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={day} bumpMap={bump} bumpScale={0.04}
          roughness={0.7} metalness={0} />
      </mesh>
    </group>
  );
}

function EarthFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#0d2040" />
    </mesh>
  );
}

// ─── Country borders ──────────────────────────────────────────────────────────
function CountryBorders() {
  const geo = useMemo(() => getBorderGeometry(), []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#88ccff" transparent opacity={0.22} />
    </lineSegments>
  );
}

// ─── InstancedMesh airport dots — updates only when camera/state changes ──────
const MAX_AIRPORTS = 2200;
const TMP_OBJ   = new THREE.Object3D();
const TMP_COLOR = new THREE.Color();

function AirportDots({ sorted, tier1End, stopIatas, hoveredAirport, onClick, onHover }) {
  const meshRef  = useRef();
  const { camera } = useThree();

  // Cache 3D positions once
  const positions = useMemo(
    () => sorted.map(ap => latLngToVector3(ap.lat, ap.lng, 1.014)),
    [sorted]
  );

  // Track previous state to skip no-op frames
  const prev = useRef({ dist: 2.6, stops: null, hovered: null, count: -1 });

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || sorted.length === 0) return;

    const dist    = camera.position.length();
    const p       = prev.current;
    const distDelta  = Math.abs(dist - p.dist);
    const stopsChg   = stopIatas  !== p.stops;
    const hoverChg   = hoveredAirport !== p.hovered;
    const newCount   = dist > 2.75 ? tier1End : sorted.length;
    const countChg   = newCount !== p.count;

    if (distDelta < 0.02 && !stopsChg && !hoverChg && !countChg) return;

    // Dot size: constant screen-space appearance
    const base = 0.013 * (dist / 2.6);

    if (countChg) mesh.count = newCount;

    for (let i = 0; i < sorted.length; i++) {
      const ap = sorted[i];
      TMP_OBJ.position.copy(positions[i]);
      TMP_OBJ.scale.setScalar(ap.tier === 1 ? base * 1.7 : base);
      TMP_OBJ.updateMatrix();
      mesh.setMatrixAt(i, TMP_OBJ.matrix);

      const isStop = stopIatas.has(ap.iata);
      const isHov  = hoveredAirport?.iata === ap.iata;
      TMP_COLOR.set(isStop ? '#ff6b35' : isHov ? '#ffffff' : ap.tier === 1 ? '#4dd0e1' : '#4a9eff');
      mesh.setColorAt(i, TMP_COLOR);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    p.dist    = dist;
    p.stops   = stopIatas;
    p.hovered = hoveredAirport;
    p.count   = newCount;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_AIRPORTS]}
      onClick={e => {
        e.stopPropagation();
        const ap = sorted[e.instanceId];
        if (ap) onClick(ap);
      }}
      onPointerMove={e => {
        e.stopPropagation();
        const ap = sorted[e.instanceId];
        if (ap) onHover(ap);
      }}
      onPointerLeave={() => onHover(null)}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

// ─── Route arc (half the previous height) ────────────────────────────────────
function RouteArc({ from, to }) {
  const points  = useMemo(
    () => createArcPoints(from.lat, from.lng, to.lat, to.lng, 120, 0.14), // 0.28 → 0.14
    [from, to]
  );
  const geo    = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const matRef = useRef();

  useFrame(() => { if (matRef.current) matRef.current.dashOffset -= 0.004; });

  return (
    <line geometry={geo}>
      <lineDashedMaterial ref={matRef} color="#ff6b35" dashSize={0.055} gapSize={0.025}
        transparent opacity={0.9} />
    </line>
  );
}

// ─── Inner scene (needs access to useThree) ───────────────────────────────────
function Scene({ stops, addStop, setHoveredAirport, hoveredAirport }) {
  const { airports, loading } = useAirports();
  const stopIatas = useMemo(() => new Set(stops.map(s => s.iata)), [stops]);

  // Sort tier1 first so LOD count works cleanly
  const { sorted, tier1End } = useMemo(() => {
    const t1 = airports.filter(a => a.tier === 1);
    const t2 = airports.filter(a => a.tier !== 1);
    return { sorted: [...t1, ...t2], tier1End: t1.length };
  }, [airports]);

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 3, 5]}  intensity={1.2} />
      <directionalLight position={[-4, 2, -4]} intensity={0.45} color="#b0d0ff" />
      <directionalLight position={[0, -5, 2]}  intensity={0.25} color="#ffeedd" />

      <Stars radius={280} depth={50} count={2000} factor={3} fade speed={0.2} />

      <Suspense fallback={<EarthFallback />}>
        <Earth />
      </Suspense>

      <CountryBorders />

      {!loading && sorted.length > 0 && (
        <AirportDots
          sorted={sorted}
          tier1End={tier1End}
          stopIatas={stopIatas}
          hoveredAirport={hoveredAirport}
          onClick={addStop}
          onHover={setHoveredAirport}
        />
      )}

      {stops.length > 1 && stops.slice(0, -1).map((stop, i) => (
        <RouteArc key={`${stop.iata}-${stops[i+1].iata}`} from={stop} to={stops[i+1]} />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={1.35}
        maxDistance={4.8}
        rotateSpeed={0.45}
        zoomSpeed={0.9}
        enableDamping
        dampingFactor={0.07}
        autoRotate={stops.length === 0}   /* rotates when idle, stops when route is building */
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Globe() {
  const { stops, addStop, setHoveredAirport, hoveredAirport } = useRouteStore();
  const { loading } = useAirports();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Hover tooltip */}
      {hoveredAirport && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(7,11,20,0.92)',
          border: '1px solid rgba(74,158,255,0.3)',
          borderRadius: 8, padding: '7px 16px',
          color: '#fff', fontSize: 13,
          fontFamily: 'inherit', pointerEvents: 'none',
          zIndex: 10, whiteSpace: 'nowrap',
          backdropFilter: 'blur(10px)',
        }}>
          <span style={{ color: '#ff6b35', fontWeight: 700 }}>{hoveredAirport.iata}</span>
          {' · '}{hoveredAirport.name}
          <span style={{ color: '#888', marginLeft: 8 }}>
            {hoveredAirport.city}{hoveredAirport.city && ', '}{hoveredAirport.country}
          </span>
          {hoveredAirport.tier === 1 && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#4dd0e1',
              background: 'rgba(77,208,225,0.12)', border: '1px solid rgba(77,208,225,0.3)',
              borderRadius: 4, padding: '1px 6px' }}>HUB</span>
          )}
        </div>
      )}

      {/* Loading badge */}
      {loading && (
        <div style={{
          position: 'absolute', top: 16, right: 20,
          background: 'rgba(7,11,20,0.8)',
          border: '1px solid rgba(74,158,255,0.25)',
          borderRadius: 20, padding: '5px 12px',
          color: 'rgba(255,255,255,0.45)', fontSize: 12,
          fontFamily: 'inherit', pointerEvents: 'none', zIndex: 10,
        }}>
          Loading airports…
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 40, right: 20,
        color: 'rgba(255,255,255,0.28)', fontSize: 11,
        fontFamily: 'inherit', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      }}>
        <span>Scroll to zoom · Drag to rotate</span>
        <span style={{ color: 'rgba(77,208,225,0.55)' }}>● Major hubs</span>
        <span style={{ color: 'rgba(74,158,255,0.45)' }}>· Zoom in for all airports</span>
      </div>

      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene
          stops={stops}
          addStop={addStop}
          setHoveredAirport={setHoveredAirport}
          hoveredAirport={hoveredAirport}
        />
      </Canvas>
    </div>
  );
}
