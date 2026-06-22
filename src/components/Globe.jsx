import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { AIRPORTS } from '../data/airports';
import { latLngToVector3, createArcPoints } from '../utils/geo';
import { useRouteStore } from '../store/routeStore';

// Real Earth textures loaded in browser at runtime (no CORS issue)
const TEX_DAY  = 'https://unpkg.com/three-globe/example/img/earth-day.jpg';
const TEX_BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

// ─── Earth ───────────────────────────────────────────────────────────────────
function Earth() {
  const [dayTex, bumpTex] = useTexture([TEX_DAY, TEX_BUMP]);

  // Boost brightness / saturation via texture settings
  dayTex.colorSpace = THREE.SRGBColorSpace;

  return (
    <group>
      {/* Outer atmosphere halo */}
      <mesh scale={1.14}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#3a8fff"
          transparent opacity={0.07}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner thin atmosphere rim */}
      <mesh scale={1.003}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#60b0ff"
          transparent opacity={0.04}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Globe */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={dayTex}
          bumpMap={bumpTex}
          bumpScale={0.05}
          roughness={0.75}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

function EarthFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#0d1b3e" />
    </mesh>
  );
}

// ─── Airport marker ───────────────────────────────────────────────────────────
function AirportMarker({ airport, isRoute, isHovered, tier, onClick, onHover }) {
  const pos  = latLngToVector3(airport.lat, airport.lng, 1.013);
  const ref  = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = isRoute ? 1 + Math.sin(clock.elapsedTime * 3.5) * 0.35 : 1;
    ref.current.scale.setScalar(pulse);
  });

  // Visual by state
  const color = isRoute ? '#ff6b35' : isHovered ? '#ffffff' : tier === 1 ? '#4dd0e1' : '#4a9eff';
  const size  = isRoute ? 0.022 : tier === 1 ? 0.015 : 0.009;

  return (
    <group
      ref={ref}
      position={pos}
      onClick={e => { e.stopPropagation(); onClick(airport); }}
      onPointerEnter={() => onHover(airport)}
      onPointerLeave={() => onHover(null)}
    >
      {/* Core dot */}
      <mesh>
        <sphereGeometry args={[size, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Tier-1 outer ring */}
      {tier === 1 && !isRoute && (
        <mesh>
          <ringGeometry args={[size * 1.7, size * 2.1, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ─── LOD wrapper — shows airports based on camera distance ───────────────────
function AirportLayer({ addStop, setHoveredAirport, hoveredAirport, stopIatas }) {
  const { camera } = useThree();
  const tierRef    = useRef(1);
  const [maxTier, setMaxTier] = useState(1);

  useFrame(() => {
    const d = camera.position.length();
    // distance thresholds: >2.6 → only tier 1 | 1.9-2.6 → tier 2 | <1.9 → all
    const t = d > 2.6 ? 1 : d > 1.9 ? 2 : 3;
    if (t !== tierRef.current) {
      tierRef.current = t;
      setMaxTier(t);
    }
  });

  const visible = AIRPORTS.filter(a => (a.tier ?? 2) <= maxTier);

  return (
    <>
      {visible.map(ap => (
        <AirportMarker
          key={ap.iata}
          airport={ap}
          isRoute={stopIatas.has(ap.iata)}
          isHovered={hoveredAirport?.iata === ap.iata}
          tier={ap.tier ?? 2}
          onClick={addStop}
          onHover={setHoveredAirport}
        />
      ))}
    </>
  );
}

// ─── Animated dashed arc ─────────────────────────────────────────────────────
function RouteArc({ from, to }) {
  const points   = createArcPoints(from.lat, from.lng, to.lat, to.lng, 100, 0.28);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const matRef   = useRef();

  useFrame(() => {
    if (matRef.current) matRef.current.dashOffset -= 0.004;
  });

  return (
    <line geometry={geometry}>
      <lineDashedMaterial
        ref={matRef}
        color="#ff6b35"
        dashSize={0.06}
        gapSize={0.03}
        transparent
        opacity={0.9}
      />
    </line>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function Globe() {
  const { stops, addStop, setHoveredAirport, hoveredAirport } = useRouteStore();
  const stopIatas = new Set(stops.map(s => s.iata));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* Hover tooltip overlay */}
      {hoveredAirport && (
        <div style={{
          position: 'absolute', bottom: 36, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9,12,20,0.92)',
          border: '1px solid rgba(74,158,255,0.35)',
          borderRadius: 8, padding: '7px 16px',
          color: '#fff', fontSize: 13,
          fontFamily: 'inherit', pointerEvents: 'none',
          zIndex: 10, whiteSpace: 'nowrap',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ color: '#ff6b35', fontWeight: 700 }}>{hoveredAirport.iata}</span>
          {' · '}{hoveredAirport.name}
          <span style={{ color: '#888', marginLeft: 8 }}>
            {hoveredAirport.city}, {hoveredAirport.country}
          </span>
          {hoveredAirport.tier === 1 && (
            <span style={{
              marginLeft: 8, fontSize: 10, color: '#4dd0e1',
              background: 'rgba(77,208,225,0.12)',
              border: '1px solid rgba(77,208,225,0.3)',
              borderRadius: 4, padding: '1px 6px',
            }}>MAIN HUB</span>
          )}
        </div>
      )}

      {/* Zoom hint */}
      <div style={{
        position: 'absolute', bottom: 36, right: 20,
        color: 'rgba(255,255,255,0.25)', fontSize: 11,
        fontFamily: 'inherit', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
      }}>
        <span>Scroll to zoom · Drag to rotate</span>
        <span style={{ color: 'rgba(77,208,225,0.5)' }}>● Main hubs</span>
        <span style={{ color: 'rgba(74,158,255,0.5)' }}>· Zoom in for more airports</span>
      </div>

      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Bright, even lighting so the Earth looks vibrant */}
        <ambientLight intensity={1.8} />
        <directionalLight position={[5, 3, 5]}   intensity={1.2} color="#ffffff" />
        <directionalLight position={[-4, 2, -4]}  intensity={0.5} color="#b0d0ff" />
        <directionalLight position={[0, -5, 2]}   intensity={0.3} color="#ffeedd" />

        <Stars radius={280} depth={50} count={2500} factor={3} fade speed={0.2} />

        {/* Real Earth — Suspense shows fallback while texture loads */}
        <Suspense fallback={<EarthFallback />}>
          <Earth />
        </Suspense>

        {/* Airport markers with LOD */}
        <AirportLayer
          addStop={addStop}
          setHoveredAirport={setHoveredAirport}
          hoveredAirport={hoveredAirport}
          stopIatas={stopIatas}
        />

        {/* Route arcs */}
        {stops.length > 1 && stops.slice(0, -1).map((stop, i) => (
          <RouteArc key={`${stop.iata}-${stops[i+1].iata}-${i}`} from={stop} to={stops[i+1]} />
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={1.4}
          maxDistance={4.5}
          rotateSpeed={0.45}
          zoomSpeed={0.9}
          autoRotate={false}      // ← user controls only
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
