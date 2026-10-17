import * as THREE from 'three';
import { buildRifle, buildSniper, buildSMG } from './soldier.js';
import { WEAPONS, PICKUP_RANGE } from './weapons.js';
import { THROWABLES } from './throwables.js';

function buildSmokeCan() {
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 10), new THREE.MeshStandardMaterial({ color: '#56634a', roughness: 0.7 }));
  can.rotation.z = Math.PI / 2; // undo the "lying on its side" turn below: cans stand up
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10), new THREE.MeshStandardMaterial({ color: '#d8d8d0', roughness: 0.6 }));
  band.rotation.z = Math.PI / 2;
  g.add(can, band);
  g.scale.setScalar(1.6);
  return g;
}

function buildFrag() {
  const g = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), new THREE.MeshStandardMaterial({ color: '#3f4a2c', roughness: 0.6, flatShading: true }));
  g.scale.set(1.6, 1.6 * 1.15, 1.6);
  return g;
}

function buildBlueZoneCan() {
  const g = buildSmokeCan();
  g.children[0].material = new THREE.MeshStandardMaterial({ color: '#2f5fd0', roughness: 0.5, emissive: '#10307a' });
  return g;
}

/** Two rolled bandages (white rolls with a red cross band). */
function buildBandages() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f1efe6', roughness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: '#c8352b', roughness: 0.7 });
  for (const x of [-0.06, 0.06]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 12), white);
    roll.position.set(x, 0, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 12), red);
    band.position.set(x, 0, 0);
    g.add(roll, band);
  }
  g.rotation.z = -Math.PI / 2; // undo the "lying on its side" turn: rolls stand up
  g.scale.setScalar(1.5);
  return g;
}

const builders = {
  rifle: () => buildRifle().rifle, smg: () => buildSMG().gun, sniper: () => buildSniper().gun, smoke: buildSmokeCan, frag: buildFrag, bluezone: buildBlueZoneCan,
  bandage: buildBandages,
};
const nameOf = (type) => (type === 'bandage' ? 'Bandages' : (WEAPONS[type] ?? THROWABLES[type]).name);

/**
 * Guns lying on the ground. The list comes from the host (or is made locally in solo); each item
 * is { id, type, x, y, z }. Items float a little above the grass, turn slowly and sit on a faint
 * ring so they're easy to spot.
 */
export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map(); // id -> { ...item, object }
    this.time = 0;
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.45, depthWrite: false });
    this.ringGeo = new THREE.RingGeometry(0.45, 0.6, 24).rotateX(-Math.PI / 2);
  }

  /** Replaces all items (match start, back to the lobby, joining). */
  set(list) {
    for (const id of [...this.items.keys()]) this.remove(id);
    for (const item of list) this.add(item);
  }

  add(item) {
    const object = new THREE.Group();
    const gun = builders[item.type]();
    gun.scale.setScalar(1.3);
    gun.rotation.z = Math.PI / 2; // lying on its side
    gun.position.y = 0.35;
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    ring.position.y = 0.04;
    object.add(gun, ring);
    object.position.set(item.x, item.y, item.z);
    object.rotation.y = (item.id * 2.399) % (Math.PI * 2);
    object.userData.gun = gun;
    this.scene.add(object);
    this.items.set(item.id, { ...item, object });
  }

  remove(id) {
    const item = this.items.get(id);
    if (!item) return;
    item.object.removeFromParent();
    this.items.delete(id);
  }

  /** Closest item within reach of `pos`, or null. */
  nearest(pos) {
    let best = null, bestD = PICKUP_RANGE;
    for (const item of this.items.values()) {
      const d = Math.hypot(item.x - pos.x, item.z - pos.z);
      if (d < bestD && Math.abs(item.y - pos.y) < 2) { bestD = d; best = item; }
    }
    return best;
  }

  /** Spins the guns and shows the "F to pick up" prompt when one is in reach. */
  update(dt, pos, canPick) {
    this.time += dt;
    this.ringMat.opacity = 0.3 + 0.2 * Math.sin(this.time * 3);
    for (const item of this.items.values()) {
      item.object.rotation.y += dt * 0.8;
      item.object.userData.gun.position.y = 0.35 + Math.sin(this.time * 2 + item.id) * 0.05;
    }
    const near = canPick ? this.nearest(pos) : null;
    const el = document.getElementById('pickup-prompt');
    el.hidden = !near;
    if (near) el.innerHTML = `<b>F</b> Pick up ${nameOf(near.type)}${THROWABLES[near.type] ? ' grenade' : ''}`;
    return near;
  }
}

/**
 * Random loot spread over the map at clear spots (`randomClearPoint` from main.js), kept a few
 * meters apart. `counts` is { type: how many }; `near` places fixed [x, z, type] items first.
 * Used by the host and in solo play.
 */
export function scatterPickups(counts, randomClearPoint, heightAt, { minR = 0, maxR, near = [] } = {}) {
  const items = [];
  let id = 1;
  const r2 = (v) => Math.round(v * 100) / 100;
  for (const [x, z, type] of near) items.push({ id: id++, type, x, y: r2(heightAt(x, z)), z });
  for (const [type, count] of Object.entries(counts)) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 20; tries++) {
      const [x, z] = randomClearPoint(minR, maxR, true);
      if (items.some((it) => Math.hypot(it.x - x, it.z - z) < 12)) continue;
      items.push({ id: id++, type, x: r2(x), y: r2(heightAt(x, z)), z: r2(z) });
      placed++;
    }
  }
  return items;
}
