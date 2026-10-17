import { WORLD_SIZE } from './terrain.js';

const HALF = WORLD_SIZE / 2;

/**
 * PUBG-style blue zone, scaled down to a 250 m map (PUBG: ~30 min on 8 km; here ~6.5 min).
 * The match starts with the whole map safe. Each phase:
 *   wait   — the next safe zone (white circle) is shown; the blue wall stays put
 *   shrink — the blue wall closes in on the white circle
 * Later phases wait less and hurt more; shrink speed (m/s) varies from phase to phase.
 * Damage is per second while outside the blue wall, plus a ramp for staying out (like PUBG's
 * newer "the longer you stay out, the more it hurts").
 */
export const START_RADIUS = Math.ceil(HALF * Math.SQRT2) + 2; // circle around the whole square map
const GRACE = 40; // s before the first white circle appears

const PHASES = [
  // radius (m), wait (s), shrink (s), dps (hp/s; players have 100)
  { r: 95, wait: 50, shrink: 55, dps: 1 },
  { r: 62, wait: 40, shrink: 40, dps: 2 },
  { r: 38, wait: 32, shrink: 35, dps: 3.5 },
  { r: 20, wait: 25, shrink: 22, dps: 6 },
  { r: 9, wait: 20, shrink: 18, dps: 9 },
  { r: 0, wait: 15, shrink: 22, dps: 14 },
];
export const ZONE_RAMP = 0.15;     // extra hp/s for every second spent outside, capped below
export const ZONE_RAMP_MAX = 1.5;  // ×dps

/**
 * Host: a new zone plan. Each circle lies fully inside the previous one and on the map.
 * `speed` > 1 compresses all timings (for testing, `?zone=fast`).
 */
export function makeZonePlan(rand = Math.random, speed = 1) {
  let cx = 0, cz = 0, r = START_RADIUS;
  const phases = [];
  for (const ph of PHASES) {
    let nx = cx, nz = cz;
    const maxShift = Math.max(0, (r === START_RADIUS ? HALF : r) - ph.r);
    const bound = HALF - 25 - ph.r * 0.5; // keep the circle mostly on the playable ground
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * maxShift;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.abs(x) <= bound && Math.abs(z) <= bound) { nx = x; nz = z; break; }
    }
    phases.push({
      x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10, r: ph.r,
      wait: ph.wait / speed, shrink: ph.shrink / speed, dps: ph.dps,
    });
    cx = nx; cz = nz; r = ph.r;
  }
  return { grace: GRACE / speed, phases };
}

/**
 * Zone at `t` seconds into the match.
 * → { x, z, r }            the blue wall (outside it hurts)
 *   next: { x, z, r }|null  the white circle being moved to
 *   stage                   'grace' | 'wait' | 'shrink' | 'final'
 *   phase                   1-based phase number (0 during grace)
 *   timeLeft                seconds until the stage changes
 *   dps                     damage per second outside the blue wall right now
 */
export function zoneAt(plan, t) {
  let cur = { x: 0, z: 0, r: START_RADIUS };
  let clock = plan.grace;
  if (t < clock) return { ...cur, next: null, stage: 'grace', phase: 0, timeLeft: clock - t, dps: 0 };
  let dps = 0;
  for (let i = 0; i < plan.phases.length; i++) {
    const ph = plan.phases[i];
    if (t < clock + ph.wait) {
      return { ...cur, next: ph, stage: 'wait', phase: i + 1, timeLeft: clock + ph.wait - t, dps };
    }
    clock += ph.wait;
    if (t < clock + ph.shrink) {
      const k = (t - clock) / ph.shrink;
      return {
        x: cur.x + (ph.x - cur.x) * k, z: cur.z + (ph.z - cur.z) * k, r: cur.r + (ph.r - cur.r) * k,
        next: ph, stage: 'shrink', phase: i + 1, timeLeft: clock + ph.shrink - t, dps: ph.dps,
      };
    }
    clock += ph.shrink;
    cur = ph;
    dps = ph.dps;
  }
  return { x: cur.x, z: cur.z, r: cur.r, next: null, stage: 'final', phase: plan.phases.length, timeLeft: 0, dps };
}

/** Meters outside the blue wall (≤ 0 means safe). */
export const outsideBy = (zone, x, z) => Math.hypot(x - zone.x, z - zone.z) - zone.r;
