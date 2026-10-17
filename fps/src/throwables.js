import * as THREE from 'three';
import { heightAt } from './terrain.js';

/**
 * Throwables (PUBG-style). Each type goes off `fuse` seconds after the pin is pulled.
 *
 * smoke: the fuse starts at the throw; the cloud lasts `duration`, building up over `build` and
 *        thinning out over `fade`; `radius` in meters (PUBG: roughly 8–10 m across).
 * frag:  5 s fuse like PUBG's, and it can be cooked (R pulls the pin early). `blast`: full damage
 *        inside `lethal` meters, falling off to nothing at `radius`; cover blocks it.
 * bluezone: a small blue zone (PUBG had one too): a dome grows over `grow` seconds to `radius`,
 *        lasts `duration`, and hurts everyone inside by `dps` (100 hp → dead in 5 s), in pulses.
 */
export const THROWABLES = {
  smoke: { name: 'Smoke', fuse: 1.8, duration: 32, build: 2.5, fade: 8, radius: 6, max: 4 },
  frag: { name: 'Frag', fuse: 5, cook: true, duration: 0.1, max: 4, blast: { max: 130, lethal: 2, radius: 9 } },
  bluezone: { name: 'Blue zone', fuse: 1.5, duration: 12, grow: 3, shrink: 1.2, radius: 5.5, dps: 20, pulse: 0.5, max: 3 },
};

/** Radius of a blue zone dome `t` seconds after it popped (0 before/after). */
export function domeRadius(t) {
  const { duration, grow, shrink, radius } = THROWABLES.bluezone;
  if (t < 0 || t > duration) return 0;
  const up = Math.min(1, t / grow), down = Math.min(1, (duration - t) / shrink);
  return radius * (1 - (1 - up) ** 2) * down; // eases out while growing
}

/** Is `p` (a point on a player's body) inside a dome centered at `c` with radius `r`? */
export const inDome = (c, r, p) => r > 0 && p.y >= c.y - 0.5 && Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) <= r;
/** Order of the quick-inventory slots (G). `locked` ones aren't in the game yet. */
export const THROW_SLOTS = [
  { type: 'frag' },
  { type: 'smoke' },
  { type: 'bluezone', name: 'Blue zone' },
];

/** Frag damage at `d` meters from the blast (before cover is checked). */
export function fragDamage(d) {
  const { max, lethal, radius } = THROWABLES.frag.blast;
  if (d <= lethal) return max;
  if (d >= radius) return 0;
  return Math.round(max * (1 - (d - lethal) / (radius - lethal)) ** 1.5);
}

export const THROW_SPEED = { over: 21, under: 10 };   // m/s at release (overhand reaches ~30–35 m)
export const THROW_LIFT = { over: 0.4, under: 0.15 };  // radians added above the aim direction
export const THROW_RELEASE = 0.3;                     // s from pressing release to the grenade leaving the hand

const GRAVITY = 18;
const STEP = 1 / 60;
const RESTITUTION = 0.35;
const FRICTION = 0.6;
const RADIUS = 0.07;

/** Where a throw starts: just above the right shoulder, a little in front. */
export function throwOrigin(pos, yaw, out = new THREE.Vector3()) {
  return out.set(pos.x - Math.sin(yaw) * 0.4 + Math.cos(yaw) * 0.25, pos.y + 1.65, pos.z - Math.cos(yaw) * 0.4 - Math.sin(yaw) * 0.25);
}

const LEVEL_PITCH = 0.25; // third-person camera pitch that aims at the horizon

/** Release velocity for a throw along camera yaw/pitch (pitch > 0 = looking down). */
export function throwVelocity(yaw, pitch, mode, out = new THREE.Vector3()) {
  const up = Math.min(1.1, Math.max(-0.6, LEVEL_PITCH - pitch + THROW_LIFT[mode]));
  const c = Math.cos(up);
  return out.set(-Math.sin(yaw) * c, Math.sin(up), -Math.cos(yaw) * c).multiplyScalar(THROW_SPEED[mode]);
}

const _n = new THREE.Vector3();

/**
 * One fixed physics step for a grenade: gravity, bounces off terrain, tree trunks and rocks.
 * Every client runs the same steps from the same release, so everyone sees it land in the same spot.
 * Returns true while it is still moving.
 */
export function stepGrenade(p, v, colliders) {
  v.y -= GRAVITY * STEP;
  const ox = p.x, oy = p.y, oz = p.z;
  p.addScaledVector(v, STEP);

  for (const c of colliders.near(p.x, p.z)) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    if (c.kind === 'tree') {
      if (d >= c.r + RADIUS || p.y > heightAt(c.x, c.z) + 6) continue; // trunks; canopies let it through
      _n.set(dx / (d || 1), 0, dz / (d || 1));
      p.set(c.x + _n.x * (c.r + RADIUS), p.y, c.z + _n.z * (c.r + RADIUS));
      v.addScaledVector(_n, -(1 + RESTITUTION) * v.dot(_n));
    }
  }
  const rockTop = colliders.surfaceAt(p.x, p.z);
  if (p.y < rockTop) {
    if (oy >= rockTop - 0.05) { // came down onto the rock: bounce off its top
      p.y = rockTop;
      v.y = -v.y * RESTITUTION;
      v.x *= FRICTION; v.z *= FRICTION;
    } else { // hit its side: knock back horizontally
      p.x = ox; p.z = oz;
      v.x *= -RESTITUTION; v.z *= -RESTITUTION;
    }
  }
  const ground = heightAt(p.x, p.z);
  if (p.y < ground + RADIUS) {
    p.y = ground + RADIUS;
    const e = 0.5;
    _n.set(heightAt(p.x - e, p.z) - heightAt(p.x + e, p.z), 2 * e, heightAt(p.x, p.z - e) - heightAt(p.x, p.z + e)).normalize();
    const vn = v.dot(_n);
    if (vn < 0) {
      v.addScaledVector(_n, -vn * (1 + RESTITUTION));
      v.multiplyScalar(FRICTION + (1 - FRICTION) * 0.5);
    }
  }
  return v.lengthSq() > 0.04;
}

/** Where a grenade released at `origin` with `velocity` will be after `fuse` seconds (host damage). */
export function predictGrenade(origin, velocity, fuse, colliders) {
  const p = origin.clone(), v = velocity.clone();
  for (let t = 0; t < fuse && stepGrenade(p, v, colliders); t += STEP);
  return p;
}

/** Soft round puff texture shared by all smoke sprites. */
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A thrown grenade in flight, then (for smoke) the cloud it leaves behind. */
class Grenade {
  constructor(manager, type, origin, velocity, { fuse, by } = {}) {
    this.m = manager;
    this.type = type;
    this.def = THROWABLES[type];
    this.fuse = fuse ?? this.def.fuse; // less if it was cooked
    this.by = by;
    this.p = origin.clone();
    this.v = velocity.clone();
    this.age = 0;
    this.moving = true;
    this.acc = 0;
    this.mesh = manager.makeGrenadeMesh(type);
    this.mesh.position.copy(this.p);
    manager.scene.add(this.mesh);
    this.cloud = null;
  }

  update(dt) {
    this.age += dt;
    if (this.moving) {
      this.acc += dt;
      while (this.acc >= STEP && this.moving) {
        this.acc -= STEP;
        this.moving = stepGrenade(this.p, this.v, this.m.colliders);
      }
      this.mesh.position.copy(this.p);
      this.mesh.rotation.x += dt * 9;
    }
    if (!this.done && this.age >= this.fuse) this.#detonate();
    if (this.cloud) this.#updateCloud(dt);
    if (this.domeMesh) {
      this.domeAge += dt;
      this.domeMesh.scale.setScalar(Math.max(0.01, this.domeR));
      this.mesh.visible = false;
    }
    return this.age < this.fuse + this.def.duration;
  }

  #detonate() {
    this.done = true;
    if (this.type === 'frag') {
      this.mesh.visible = false;
      this.m.onExplode?.(this.p.clone(), this.by);
      return;
    }
    if (this.type === 'bluezone') this.#dome();
    else this.#smoke();
  }

  /** Blue zone: a shimmering hemisphere (same look as the big zone wall) that grows, then shrinks. */
  #dome() {
    this.center = this.p.clone();
    this.domeMesh = new THREE.Mesh(this.m.domeGeo, this.m.domeMat);
    this.domeMesh.position.copy(this.center);
    this.domeMesh.scale.setScalar(0.01);
    this.domeMesh.renderOrder = 6;
    this.m.scene.add(this.domeMesh);
    this.domeAge = 0;
  }

  /** Current dome radius (0 when it isn't a live blue zone). */
  get domeR() { return this.domeMesh ? domeRadius(this.domeAge) : 0; }

  /** Smoke: a cluster of soft sprites around where it settled. */
  #smoke() {
    const r = this.def.radius;
    this.center = this.p.clone();
    this.cloud = new THREE.Group();
    this.puffs = [];
    const count = 46;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.m.puff, color: new THREE.Color().setHSL(0.22, 0.05, 0.62 + Math.random() * 0.18),
        transparent: true, depthWrite: false, opacity: 0, fog: true,
      });
      const s = new THREE.Sprite(mat);
      // Denser and lower in the middle, a dome overall.
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.75;
      const home = new THREE.Vector3(Math.cos(a) * d, 0.2 + Math.random() * (r * 0.8 - d * 0.5), Math.sin(a) * d);
      const size = 3 + Math.random() * 2.5;
      s.position.set(0, 0.3, 0);
      this.cloud.add(s);
      this.puffs.push({ s, home, size, spin: (Math.random() - 0.5) * 0.3, delay: Math.random() * 0.8 });
    }
    this.cloud.position.copy(this.center);
    this.m.scene.add(this.cloud);
    this.smokeAge = 0;
  }

  /** 0..1 thickness over the smoke's life. */
  get density() {
    if (!this.cloud) return 0;
    const { build, duration, fade } = this.def;
    const t = this.smokeAge;
    return Math.min(1, t / build) * Math.min(1, Math.max(0, (duration - t) / fade));
  }

  #updateCloud(dt) {
    this.smokeAge += dt;
    const k = this.density;
    for (const p of this.puffs) {
      const grow = Math.min(1, Math.max(0, (this.smokeAge - p.delay) / this.def.build));
      const ease = 1 - (1 - grow) ** 3;
      p.s.position.lerpVectors(_n.set(0, 0.3, 0), p.home, ease);
      p.s.position.y += Math.sin(this.smokeAge * 0.4 + p.size) * 0.15 + this.smokeAge * 0.01;
      p.s.scale.setScalar(p.size * (0.4 + 0.6 * ease) * (1 + this.smokeAge * 0.006));
      p.s.material.rotation += p.spin * dt;
      p.s.material.opacity = 0.8 * k * Math.min(1, grow * 1.5);
    }
    this.mesh.visible = this.smokeAge < 3; // can is swallowed by the smoke
  }

  dispose() {
    this.mesh.removeFromParent();
    this.domeMesh?.removeFromParent();
    if (this.cloud) {
      this.cloud.removeFromParent();
      for (const p of this.puffs) p.s.material.dispose();
    }
  }
}

/** All grenades in the world plus the throw-arc preview. */
export class Throwables {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.list = [];
    this.puff = puffTexture();
    this.canMat = new THREE.MeshStandardMaterial({ color: '#56634a', roughness: 0.7 });
    this.canGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.13, 10);
    this.fragMat = new THREE.MeshStandardMaterial({ color: '#3f4a2c', roughness: 0.6, flatShading: true });
    this.fragGeo = new THREE.IcosahedronGeometry(0.055, 1);
    this.bzMat = new THREE.MeshStandardMaterial({ color: '#2f5fd0', roughness: 0.5, emissive: '#10307a' });
    // Blue zone dome: unit hemisphere, scaled to the current radius.
    this.domeGeo = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    this.domeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vPos; varying vec3 vN; varying vec3 vView;
        void main() { vPos = position; vec4 w = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal); vView = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vPos; varying vec3 vN; varying vec3 vView;
        void main() {
          float rim = 1.0 - abs(dot(vN, vView));                       // brighter at the edges
          float lines = step(0.92, fract(vPos.y * 6.0 - uTime * 0.6)) + step(0.94, fract(atan(vPos.z, vPos.x) * 8.0));
          float a = 0.14 + rim * 0.35 + min(lines, 1.0) * 0.18;
          gl_FragColor = vec4(vec3(0.27, 0.47, 0.95) + lines * 0.2, a);
        }`,
    });
    /** Called with (position, thrower id) when a frag goes off. */
    this.onExplode = null;

    // Trajectory preview: dashed arc + landing ring.
    this.arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, () => new THREE.Vector3())),
      new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.8, depthTest: false }),
    );
    this.arc.frustumCulled = false;
    this.arc.renderOrder = 20;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthTest: false }),
    );
    this.ring.renderOrder = 20;
    this.arc.visible = this.ring.visible = false;
    scene.add(this.arc, this.ring);
  }

  makeGrenadeMesh(type) {
    const m = type === 'frag' ? new THREE.Mesh(this.fragGeo, this.fragMat)
      : new THREE.Mesh(this.canGeo, type === 'bluezone' ? this.bzMat : this.canMat);
    m.castShadow = true;
    return m;
  }

  /** opts: { fuse: seconds left (cooked frags), by: thrower id } */
  spawn(type, origin, velocity, opts) {
    this.list.push(new Grenade(this, type, origin, velocity, opts));
  }

  /** Remove everything (new round). */
  clear() {
    for (const g of this.list) g.dispose();
    this.list.length = 0;
  }

  update(dt) {
    this.domeMat.uniforms.uTime.value += dt;
    this.list = this.list.filter((g) => {
      if (g.update(dt)) return true;
      g.dispose();
      return false;
    });
  }

  /** Shows (or hides with null) the arc a throw would follow from `origin` with `velocity`. */
  preview(origin, velocity) {
    if (!origin) { this.arc.visible = this.ring.visible = false; return; }
    const pos = this.arc.geometry.attributes.position;
    const p = origin.clone(), v = velocity.clone();
    let n = 0;
    // Sample every other step until it first touches down (or runs out of points).
    for (let i = 0; i < pos.count * 2 && n < pos.count; i++) {
      if (i % 2 === 0) pos.setXYZ(n++, p.x, p.y, p.z);
      const vy = v.y;
      stepGrenade(p, v, this.colliders);
      if (vy < 0 && v.y >= 0) break; // first bounce
    }
    for (let i = n; i < pos.count; i++) pos.setXYZ(i, p.x, p.y, p.z);
    pos.needsUpdate = true;
    this.arc.computeLineDistances();
    this.ring.position.set(p.x, p.y + 0.03, p.z);
    this.arc.visible = this.ring.visible = true;
  }

  /** True if `p` is inside any live blue zone dome. */
  inBlueZone(p) {
    return this.list.some((g) => g.domeMesh && inDome(g.center, g.domeR, p));
  }

  /** Live blue zone domes { center, r, by } (solo damage). */
  domes() {
    return this.list.filter((g) => g.domeR > 0).map((g) => ({ center: g.center, r: g.domeR, by: g.by }));
  }

  /** True if the line of sight from `a` to `b` passes through thick smoke. */
  blocksView(a, b) {
    for (const g of this.list) {
      if (g.density < 0.5) continue;
      const c = g.center, r = g.def.radius * 0.8;
      const ab = _n.subVectors(b, a);
      const len = ab.length();
      const t = Math.max(0, Math.min(len, ab.normalize().dot(new THREE.Vector3().subVectors(c, a))));
      const closest = a.clone().addScaledVector(ab, t);
      if (closest.distanceTo(c.clone().setY(c.y + 1.5)) < r) return true;
    }
    return false;
  }
}
