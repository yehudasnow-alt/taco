import * as THREE from 'three';

// Natural Earth 110m scale — has country names in properties
const GEO_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// ── Apple Maps palette ─────────────────────────────────────────────────────────
const OCEAN   = '#bed8ec';
const LANDS   = ['#ede8d9','#e8e2cc','#f0ead8','#e5dfca','#ece6d5','#e9e3ce'];
const BORDER  = 'rgba(148,137,115,0.65)';
const LBLCOL  = 'rgba(85,76,62,0.88)';
const LBLSHADOW = 'rgba(248,244,236,0.92)';

let _geo     = null;
let _texture = null;

// ── Equirectangular projection ─────────────────────────────────────────────────
function xy(lng, lat, W, H) {
  return [(lng + 180) / 360 * W, (90 - lat) / 180 * H];
}

// ── Simple average centroid (good enough for labeling) ─────────────────────────
function centroid(ring) {
  let sx = 0, sy = 0;
  ring.forEach(([lng, lat]) => { sx += lng; sy += lat; });
  return [sx / ring.length, sy / ring.length];
}

// ── Largest polygon ring across a MultiPolygon (for centroid) ──────────────────
function biggestRing(geom) {
  if (geom.type === 'Polygon') return geom.coordinates[0];
  let best = null, bestLen = 0;
  geom.coordinates.forEach(poly => {
    if (poly[0].length > bestLen) { bestLen = poly[0].length; best = poly[0]; }
  });
  return best;
}

// ── Draw one ring as a canvas path ────────────────────────────────────────────
function ringPath(ctx, ring, W, H) {
  ctx.beginPath();
  ring.forEach(([lng, lat], i) => {
    const [x, y] = xy(lng, lat, W, H);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
}

// ── Main async texture generator (cached after first call) ────────────────────
export async function generateEarthTexture() {
  if (_texture) return _texture;

  if (!_geo) {
    const res = await fetch(GEO_URL);
    _geo = await res.json();
  }

  const W = 4096, H = 2048;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  // Ocean
  ctx.fillStyle = OCEAN;
  ctx.fillRect(0, 0, W, H);

  const { features } = _geo;

  // ── Country fills ──────────────────────────────────────────────────────────
  features.forEach((f, idx) => {
    ctx.fillStyle = LANDS[idx % LANDS.length];
    const { type, coordinates } = f.geometry;
    if (type === 'Polygon') {
      ringPath(ctx, coordinates[0], W, H);
      ctx.fill();
    } else if (type === 'MultiPolygon') {
      coordinates.forEach(poly => { ringPath(ctx, poly[0], W, H); ctx.fill(); });
    }
  });

  // ── Borders ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = BORDER;
  ctx.lineWidth   = 1.4;
  ctx.lineJoin    = 'round';
  features.forEach(f => {
    const { type, coordinates } = f.geometry;
    const rings = type === 'Polygon'
      ? coordinates
      : type === 'MultiPolygon' ? coordinates.flat() : [];
    rings.forEach(ring => { ringPath(ctx, ring, W, H); ctx.stroke(); });
  });

  // ── Country name labels ────────────────────────────────────────────────────
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  features.forEach(f => {
    const name = (f.properties?.NAME_EN || f.properties?.ADMIN || f.properties?.NAME || '').trim();
    if (!name) return;

    const ring = biggestRing(f.geometry);
    if (!ring) return;

    const [cLng, cLat] = centroid(ring);
    const [cx, cy]     = xy(cLng, cLat, W, H);

    // Skip labels near the anti-meridian edge
    if (cx < 40 || cx > W - 40) return;

    // Font size proportional to polygon complexity (rough area proxy)
    const n  = ring.length;
    const fs = n > 3000 ? 34 : n > 1200 ? 26 : n > 400 ? 20 : n > 120 ? 15 : n > 50 ? 12 : 0;
    if (fs === 0) return;

    ctx.font        = `400 ${fs}px -apple-system,"Helvetica Neue",Arial,sans-serif`;
    ctx.shadowColor = LBLSHADOW;
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = LBLCOL;
    ctx.fillText(name, cx, cy);
    ctx.shadowBlur  = 0;
  });

  _texture = new THREE.CanvasTexture(cvs);
  _texture.colorSpace  = THREE.SRGBColorSpace;
  _texture.anisotropy  = 16;
  _texture.needsUpdate = true;
  return _texture;
}
