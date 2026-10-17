import { WORLD_SIZE } from './terrain.js';

const HALF = WORLD_SIZE / 2;

/**
 * Named areas of the map. Each point belongs to the region with the nearest center, so the
 * borders form a Voronoi diagram. North is -z (up on the map).
 */
export const REGIONS = [
  { name: 'Ranger Camp', x: 0, z: 0 },
  { name: 'Highpine Ridge', x: 4, z: -72 },
  { name: "Crow's Nest", x: -66, z: -64 },
  { name: 'Wolf Hollow', x: 64, z: -62 },
  { name: 'Stone Fields', x: 74, z: 4 },
  { name: 'Old Timber', x: -74, z: -2 },
  { name: 'Fern Gully', x: -64, z: 66 },
  { name: 'Deadfall', x: 2, z: 74 },
  { name: 'Mossgrove', x: 66, z: 64 },
];

/** The region (x, z) is in. */
export function regionAt(x, z) {
  let best = REGIONS[0], bestD = Infinity;
  for (const r of REGIONS) {
    const d = (r.x - x) ** 2 + (r.z - z) ** 2;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** Map grid: 5×5 squares, columns A–E west→east, rows 1–5 north→south. */
export const GRID = 5;
export function gridRef(x, z) {
  const cell = WORLD_SIZE / GRID;
  const col = Math.min(GRID - 1, Math.max(0, Math.floor((x + HALF) / cell)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor((z + HALF) / cell)));
  return `${'ABCDE'[col]}${row + 1}`;
}
