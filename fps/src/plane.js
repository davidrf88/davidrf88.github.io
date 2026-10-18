import * as THREE from 'three';
import { WORLD_SIZE } from './terrain.js';

const HALF = WORLD_SIZE / 2;

/**
 * The drop plane (PUBG-style). Each match the host picks a straight flight line at a random
 * angle, passing near (not through) the map center. Every client draws the plane from the same
 * numbers and the match clock, so the plane itself is never sent over the network.
 *
 * Along the line, distances `s` are measured from the line's center point:
 *   s0 … sIn   approach from outside the map (can't jump yet)
 *   sIn … sOut over the map: jump any time
 *   sOut       anyone still aboard is dropped
 *   … s1       the plane flies off and disappears
 */
export const PLANE = {
  altitude: 130,     // m above sea level (the terrain tops out around 70 m at the border hills)
  speed: 14,         // m/s (≈ 20 s across the map)
  jumpLimit: HALF - 25, // jumping is allowed over this square: playable ground, inside the border hills
  offset: 40,        // the line passes within this distance of the map center
  approach: 45,      // m of flight before reaching the jump area
  exit: 40,          // m after it before the plane vanishes
};

/** Host: a new random flight line for a match. */
export function makeFlight(rand = Math.random) {
  const a = rand() * Math.PI * 2;
  const dx = Math.cos(a), dz = Math.sin(a);
  // Line center: random point near the middle (offset sideways from the map center).
  const off = (rand() * 2 - 1) * PLANE.offset;
  const cx = -dz * off, cz = dx * off;
  // Where the line is inside the jump square |x|, |z| ≤ jumpLimit (slab intersection).
  const L = PLANE.jumpLimit;
  let sIn = -Infinity, sOut = Infinity;
  for (const [c, d] of [[cx, dx], [cz, dz]]) {
    if (Math.abs(d) < 1e-6) continue;
    const s1 = (-L - c) / d, s2 = (L - c) / d;
    sIn = Math.max(sIn, Math.min(s1, s2));
    sOut = Math.min(sOut, Math.max(s1, s2));
  }
  const r = (v) => Math.round(v * 100) / 100;
  return { cx: r(cx), cz: r(cz), a: r(a), sIn: r(sIn), sOut: r(sOut) };
}

/**
 * The plane `t` seconds after the match started.
 * → { pos, dir, canJump, forceJump (past the jump area), gone (flew off), timeToJump, timeLeft }
 */
export function planeAt(flight, t, out = new THREE.Vector3()) {
  const dx = Math.cos(flight.a), dz = Math.sin(flight.a);
  const s0 = flight.sIn - PLANE.approach;
  const s = s0 + PLANE.speed * t;
  out.set(flight.cx + dx * s, PLANE.altitude, flight.cz + dz * s);
  return {
    pos: out,
    dir: new THREE.Vector3(dx, 0, dz),
    canJump: s >= flight.sIn && s <= flight.sOut,
    forceJump: s > flight.sOut,
    gone: s > flight.sOut + PLANE.exit,
    timeToJump: Math.max(0, (flight.sIn - s) / PLANE.speed),
    timeLeft: Math.max(0, (flight.sOut - s) / PLANE.speed),
  };
}

/** Both ends of the flight line, for the maps. */
export function flightLine(flight) {
  const dx = Math.cos(flight.a), dz = Math.sin(flight.a);
  const a = flight.sIn - PLANE.approach, b = flight.sOut + PLANE.exit;
  return [[flight.cx + dx * a, flight.cz + dz * a], [flight.cx + dx * b, flight.cz + dz * b]];
}

/** Low-poly cargo plane, nose along +Z. */
function buildPlane() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: '#7d8a76', roughness: 0.7, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a4036', roughness: 0.8, flatShading: true });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2a33', roughness: 0.2, metalness: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(1.6, 1.6, 22, 12), hull, 0, 0, 0, Math.PI / 2);          // fuselage
  add(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hull, 0, 0, 11, Math.PI / 2); // nose
  add(new THREE.ConeGeometry(1.6, 6, 12), hull, 0, 0.6, -14, -Math.PI / 2 - 0.12);        // tail cone
  add(new THREE.BoxGeometry(30, 0.35, 3.4), hull, 0, 1.2, 1);                            // wings
  add(new THREE.BoxGeometry(10, 0.3, 2), hull, 0, 1.6, -15.5);                           // tailplane
  add(new THREE.BoxGeometry(0.3, 4.5, 3), hull, 0, 3.6, -15.5);                          // fin
  add(new THREE.BoxGeometry(2.2, 0.8, 1.2), glass, 0, 0.9, 11.2, -0.5);                  // cockpit glass
  const props = [];
  for (const x of [-9, -4.5, 4.5, 9]) {
    add(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 8), dark, x, 0.9, 2, Math.PI / 2);   // engine
    const prop = add(new THREE.BoxGeometry(3.6, 0.25, 0.08), dark, x, 0.9, 3.7);
    props.push(prop);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.props = props;
  return g;
}

/** Draws the plane for the current match (hidden when there's no flight or it has flown off). */
export class PlaneView {
  constructor(scene) {
    this.object = buildPlane();
    this.object.visible = false;
    scene.add(this.object);
    this.spin = 0;
  }

  /** @param {{flight, t}|null} f */
  update(f, dt) {
    if (!f) { this.object.visible = false; return null; }
    const st = planeAt(f.flight, f.t, this.object.position);
    this.object.visible = !st.gone;
    this.object.rotation.y = Math.atan2(st.dir.x, st.dir.z);
    this.spin += dt * 40;
    for (const p of this.object.userData.props) p.rotation.z = this.spin;
    return st;
  }
}
