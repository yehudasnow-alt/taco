import * as THREE from 'three';

const RADIUS = 1;

export function latLngToVector3(lat, lng, radius = RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function createArcPoints(startLat, startLng, endLat, endLng, segments = 80, arcHeight = 0.28) {
  const start = latLngToVector3(startLat, startLng, RADIUS);
  const end = latLngToVector3(endLat, endLng, RADIUS);
  const points = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Slerp between start and end
    const interpolated = new THREE.Vector3().lerpVectors(start, end, t).normalize();
    // Lift the midpoint for the arc effect
    const lift = Math.sin(Math.PI * t) * arcHeight;
    interpolated.multiplyScalar(RADIUS + lift);
    points.push(interpolated);
  }
  return points;
}

export function getGreatCircleMidpoint(lat1, lng1, lat2, lng2) {
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  return { lat: midLat, lng: midLng };
}
