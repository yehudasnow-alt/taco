import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { AIRPORTS } from '../data/airports';
import { latLngToVector3, createArcPoints } from '../utils/geo';
import { useRouteStore } from '../store/routeStore';

// ─── Earth sphere ───────────────────────────────────────────────────────────
function EarthSphere() {
  const meshRef = useRef();

  // Simple procedural texture using canvas
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Ocean
    ctx.fillStyle = '#0d1b3e';
    ctx.fillRect(0, 0, 1024, 512);

    // Very subtle grid
    ctx.strokeStyle = 'rgba(30, 80, 180, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * 1024;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * 512;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
    }

    // Rough continent silhouettes (simplified polygons)
    ctx.fillStyle = 'rgba(20, 60, 30, 0.75)';

    // North America
    ctx.beginPath();
    ctx.moveTo(145, 115); ctx.lineTo(185, 95); ctx.lineTo(230, 90);
    ctx.lineTo(255, 105); ctx.lineTo(260, 130); ctx.lineTo(250, 165);
    ctx.lineTo(235, 200); ctx.lineTo(215, 225); ctx.lineTo(200, 240);
    ctx.lineTo(175, 245); ctx.lineTo(160, 230); ctx.lineTo(150, 200);
    ctx.lineTo(140, 165); ctx.closePath(); ctx.fill();

    // South America
    ctx.beginPath();
    ctx.moveTo(205, 255); ctx.lineTo(235, 250); ctx.lineTo(250, 270);
    ctx.lineTo(255, 310); ctx.lineTo(245, 360); ctx.lineTo(225, 390);
    ctx.lineTo(210, 400); ctx.lineTo(195, 380); ctx.lineTo(190, 340);
    ctx.lineTo(185, 290); ctx.closePath(); ctx.fill();

    // Europe
    ctx.beginPath();
    ctx.moveTo(455, 95); ctx.lineTo(510, 88); ctx.lineTo(530, 100);
    ctx.lineTo(525, 120); ctx.lineTo(510, 135); ctx.lineTo(490, 140);
    ctx.lineTo(470, 135); ctx.lineTo(455, 120); ctx.closePath(); ctx.fill();

    // Africa
    ctx.beginPath();
    ctx.moveTo(460, 150); ctx.lineTo(510, 145); ctx.lineTo(545, 160);
    ctx.lineTo(555, 200); ctx.lineTo(545, 265); ctx.lineTo(520, 310);
    ctx.lineTo(495, 330); ctx.lineTo(470, 320); ctx.lineTo(450, 285);
    ctx.lineTo(440, 240); ctx.lineTo(445, 190); ctx.closePath(); ctx.fill();

    // Asia
    ctx.beginPath();
    ctx.moveTo(535, 85); ctx.lineTo(620, 75); ctx.lineTo(720, 80);
    ctx.lineTo(790, 90); ctx.lineTo(820, 110); ctx.lineTo(810, 140);
    ctx.lineTo(770, 165); ctx.lineTo(720, 175); ctx.lineTo(680, 185);
    ctx.lineTo(640, 195); ctx.lineTo(600, 190); ctx.lineTo(560, 175);
    ctx.lineTo(540, 155); ctx.lineTo(535, 125); ctx.closePath(); ctx.fill();

    // Australia
    ctx.beginPath();
    ctx.moveTo(720, 275); ctx.lineTo(785, 265); ctx.lineTo(820, 285);
    ctx.lineTo(830, 325); ctx.lineTo(810, 355); ctx.lineTo(770, 360);
    ctx.lineTo(730, 345); ctx.lineTo(710, 315); ctx.closePath(); ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }, []);

  // Atmosphere glow shader
  const atmosphereMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x1a4fcc),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.12,
  }), []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <group ref={meshRef}>
      {/* Atmosphere */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[1, 64, 64]} />
        <primitive object={atmosphereMat} attach="material" />
      </mesh>
      {/* Earth */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={texture}
          specularMap={texture}
          specular={new THREE.Color(0x112244)}
          shininess={8}
        />
      </mesh>
    </group>
  );
}

// ─── Airport dot ────────────────────────────────────────────────────────────
function AirportMarker({ airport, isInRoute, isHovered, onClick, onHover }) {
  const pos = useMemo(() => latLngToVector3(airport.lat, airport.lng, 1.012), [airport]);
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = isInRoute ? 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3 : 1;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const color = isInRoute ? '#ff6b35' : isHovered ? '#ffffff' : '#4a9eff';
  const size = isInRoute ? 0.018 : 0.01;

  return (
    <mesh
      ref={meshRef}
      position={pos}
      onClick={(e) => { e.stopPropagation(); onClick(airport); }}
      onPointerEnter={() => onHover(airport)}
      onPointerLeave={() => onHover(null)}
    >
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

// ─── Arc line between two airports ─────────────────────────────────────────
function RouteArc({ from, to, index }) {
  const points = useMemo(() =>
    createArcPoints(from.lat, from.lng, to.lat, to.lng, 100, 0.3),
    [from, to]
  );

  const lineRef = useRef();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  // Animated dash offset
  useFrame((state) => {
    if (lineRef.current?.material) {
      lineRef.current.material.dashOffset -= 0.003;
    }
  });

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineDashedMaterial
        color="#ff6b35"
        dashSize={0.05}
        gapSize={0.025}
        linewidth={2}
        transparent
        opacity={0.9}
      />
    </line>
  );
}

// ─── Tooltip label in 3D ────────────────────────────────────────────────────
function HoverTooltip({ airport }) {
  const { camera, size } = useThree();
  if (!airport) return null;

  const pos = latLngToVector3(airport.lat, airport.lng, 1.12);
  return (
    <group position={pos}>
      <mesh>
        <planeGeometry args={[0.4, 0.1]} />
        <meshBasicMaterial color="#0d1117" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// ─── Main Globe Canvas ──────────────────────────────────────────────────────
export default function Globe() {
  const { stops, addStop, setHoveredAirport, hoveredAirport } = useRouteStore();
  const stopIatas = new Set(stops.map(s => s.iata));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Hover label overlay */}
      {hoveredAirport && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(13,17,23,0.92)',
          border: '1px solid rgba(74,158,255,0.4)',
          borderRadius: 8,
          padding: '8px 16px',
          color: '#fff',
          fontSize: 13,
          fontFamily: 'inherit',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ color: '#ff6b35', fontWeight: 600 }}>{hoveredAirport.iata}</span>
          {' · '}{hoveredAirport.name}
          <span style={{ color: '#888', marginLeft: 8 }}>{hoveredAirport.city}, {hoveredAirport.country}</span>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />
        <directionalLight position={[-5, -2, -3]} intensity={0.2} color="#1a3a8f" />

        <Stars radius={300} depth={60} count={3000} factor={3} fade speed={0.3} />

        <EarthSphere />

        {/* Airport markers */}
        {AIRPORTS.map(airport => (
          <AirportMarker
            key={airport.iata}
            airport={airport}
            isInRoute={stopIatas.has(airport.iata)}
            isHovered={hoveredAirport?.iata === airport.iata}
            onClick={addStop}
            onHover={setHoveredAirport}
          />
        ))}

        {/* Route arcs */}
        {stops.length > 1 && stops.slice(0, -1).map((stop, i) => (
          <RouteArc key={`${stop.iata}-${stops[i + 1].iata}`} from={stop} to={stops[i + 1]} index={i} />
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={4}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          autoRotate={stops.length === 0}
          autoRotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
}
