import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const WORLD_SIZE = 500;          // meters, square world centered on origin
const SEGMENTS = 250;                   // grid cells per side (2m cells)
const HALF = WORLD_SIZE / 2;
const CELL = WORLD_SIZE / SEGMENTS;

const perlin = new ImprovedNoise();
const SEED = 12.345;

function fbm(x, z, octaves = 4) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += perlin.noise(x * freq, z * freq, SEED + i * 7.1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Analytic height used to build the grid (the walkable surface is the grid itself, see heightAt).
function rawHeight(x, z) {
  let h = fbm(x * 0.006, z * 0.006) * 22 + fbm(x * 0.035, z * 0.035, 3) * 2.5;
  // Flatten a clearing around the spawn point.
  h *= smoothstep(8, 45, Math.hypot(x, z));
  // Raise hills at the border so the world feels enclosed.
  const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
  h += smoothstep(0.82, 1.0, edge) * 45;
  return h;
}

/** Noise in [-1, 1] for other systems (e.g. forest density). */
export function densityNoise(x, z) {
  return fbm(x * 0.012 + 100, z * 0.012 - 50, 3);
}

const heights = new Float32Array((SEGMENTS + 1) * (SEGMENTS + 1));
for (let iz = 0; iz <= SEGMENTS; iz++) {
  for (let ix = 0; ix <= SEGMENTS; ix++) {
    heights[iz * (SEGMENTS + 1) + ix] = rawHeight(ix * CELL - HALF, iz * CELL - HALF);
  }
}

const h = (ix, iz) => heights[iz * (SEGMENTS + 1) + ix];

/** Exact surface height of the rendered terrain mesh at (x, z). */
export function heightAt(x, z) {
  const gx = Math.min(Math.max((x + HALF) / CELL, 0), SEGMENTS - 1e-4);
  const gz = Math.min(Math.max((z + HALF) / CELL, 0), SEGMENTS - 1e-4);
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  // Must match the triangle split used in createTerrain().
  if (fx + fz <= 1) {
    const h00 = h(ix, iz);
    return h00 + (h(ix + 1, iz) - h00) * fx + (h(ix, iz + 1) - h00) * fz;
  }
  const h11 = h(ix + 1, iz + 1);
  return h11 + (h(ix, iz + 1) - h11) * (1 - fx) + (h(ix + 1, iz) - h11) * (1 - fz);
}

/** Approximate slope (0 = flat, 1 = 45°). */
export function slopeAt(x, z) {
  const e = 1;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

export function createTerrain() {
  const n = SEGMENTS + 1;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const grassA = new THREE.Color('#4f7a32');
  const grassB = new THREE.Color('#6d8f3a');
  const moss = new THREE.Color('#3a5a2a');
  const dirt = new THREE.Color('#7a6346');
  const c = new THREE.Color();

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      const x = ix * CELL - HALF, z = iz * CELL - HALF;
      const y = heights[i];
      positions.set([x, y, z], i * 3);

      const t = fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5;
      c.copy(grassA).lerp(grassB, t);
      c.lerp(moss, smoothstep(0.1, 0.6, densityNoise(x, z)) * 0.7);
      c.lerp(dirt, smoothstep(0.35, 0.7, slopeAt(x, z)));
      // Small speckle so flat shading reads as texture.
      const s = (Math.sin(ix * 12.9898 + iz * 78.233) * 43758.5453) % 1;
      c.offsetHSL(0, 0, s * 0.025);
      colors.set([c.r, c.g, c.b], i * 3);
    }
  }

  const index = [];
  for (let iz = 0; iz < SEGMENTS; iz++) {
    for (let ix = 0; ix < SEGMENTS; ix++) {
      const v00 = iz * n + ix, v10 = v00 + 1, v01 = v00 + n, v11 = v01 + 1;
      index.push(v00, v01, v10, v10, v01, v11);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
