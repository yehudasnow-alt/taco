import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import { latLngToVector3 } from './geo';
import * as THREE from 'three';

let cached = null;

export function getBorderGeometry(radius = 1.0015) {
  if (cached) return cached;

  const { features } = feature(worldTopo, worldTopo.objects.countries);
  const positions = [];

  function addRing(ring) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      // Skip anti-meridian crossings (would draw wrong line across the globe)
      if (Math.abs(lng2 - lng1) > 90) continue;
      const v1 = latLngToVector3(lat1, lng1, radius);
      const v2 = latLngToVector3(lat2, lng2, radius);
      positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
  }

  features.forEach(f => {
    if (!f.geometry) return;
    const { type, coordinates } = f.geometry;
    if (type === 'Polygon') {
      coordinates.forEach(addRing);
    } else if (type === 'MultiPolygon') {
      coordinates.forEach(poly => poly.forEach(addRing));
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  cached = geo;
  return geo;
}
