import * as THREE from 'three';
import { Soldier, ONCE_CLIPS } from './soldier.js';

const INTERP_DELAY = 100; // ms behind the newest state, so there are always two states to blend
const BUFFER_MS = 1000;

// Fallback shades for players whose color we don't know yet.
const UNIFORMS = ['#5b4a32', '#3f5560', '#604040', '#4d5a2c', '#545454', '#3c4a6a'];
let nextUniform = 0;

const TAG_HEIGHT = { stand: 2.15, crouch: 1.55, prone: 0.9 };

const lerpAngle =(a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function makeNameTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(248, ctx.measureText(name).width + 28);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(128 - w / 2, 10, w, 44, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(1.4, 0.35, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Another player's soldier, driven by network snapshots with ~100 ms interpolation. */
export class RemotePlayer {
  static async create(id, name, color = null) {
    const soldier = await Soldier.create({ color: color ?? UNIFORMS[nextUniform++ % UNIFORMS.length] });
    const remote = new RemotePlayer(id, name, soldier);
    remote.color = color;
    return remote;
  }

  /** The player's chosen uniform color (from the host). */
  setColor(hex) {
    if (!hex || hex === this.color) return;
    this.color = hex;
    this.soldier.setColor(hex);
  }

  constructor(id, name, soldier) {
    this.id = id;
    this.name = name;
    this.soldier = soldier;
    this.object = soldier.object;
    this.buffer = [];   // [{ time, s }]
    this.alive = true;
    this.lastReload = 0;
    this.pose = { aimFrac: 0, pitch: 0, lean: 0, handsBusy: false };
    this.tag = makeNameTag(name);
    this.object.add(this.tag); // sprites always face the camera
    this.tag.position.y = 2.2;
    this.object.visible = false; // until the first state arrives
  }

  setName(name) {
    if (name === this.name) return;
    this.name = name;
    this.object.remove(this.tag);
    this.tag.material.map.dispose();
    this.tag = makeNameTag(name);
    this.tag.position.y = 2.2;
    this.object.add(this.tag);
  }

  push(s, alive) {
    if (!s) return;
    const now = performance.now();
    this.buffer.push({ time: now, s });
    while (this.buffer.length > 2 && this.buffer[0].time < now - BUFFER_MS) this.buffer.shift();
    this.alive = alive;
  }

  /** Respawns teleport: drop history so we don't interpolate across the map. */
  teleport() { this.buffer.length = 0; }

  playShoot() { this.soldier.playShoot(); }

  update(dt) {
    if (this.buffer.length === 0) return;
    this.object.visible = this.buffer[this.buffer.length - 1].s.v !== 0; // spectators have no body
    const renderTime = performance.now() - INTERP_DELAY;
    let a = this.buffer[0], b = this.buffer[this.buffer.length - 1];
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= renderTime && this.buffer[i + 1].time >= renderTime) {
        a = this.buffer[i];
        b = this.buffer[i + 1];
        break;
      }
    }
    const span = b.time - a.time;
    const t = span > 0 ? THREE.MathUtils.clamp((renderTime - a.time) / span, 0, 1) : 1;
    const sa = a.s, sb = b.s;

    this.object.position.set(
      THREE.MathUtils.lerp(sa.p[0], sb.p[0], t),
      THREE.MathUtils.lerp(sa.p[1], sb.p[1], t),
      THREE.MathUtils.lerp(sa.p[2], sb.p[2], t),
    );
    this.object.rotation.y = lerpAngle(sa.f, sb.f, t);

    // Base clip comes from the newer state; directional loops keep their foot phase.
    const cur = t < 0.5 ? sa : sb;
    if (cur.b !== this.soldier.baseName) this.soldier.fadeTo(cur.b, 0.2, { sync: !ONCE_CLIPS.has(cur.b) });
    this.soldier.setWeapon(sb.w ?? 'pistol');
    this.soldier.bandaging = !!sb.h && this.alive;
    if (sb.r && !this.lastReload) this.soldier.playReload();
    this.lastReload = sb.r;

    this.pose.aimFrac = THREE.MathUtils.lerp(sa.a, sb.a, t);
    this.pose.pitch = THREE.MathUtils.lerp(sa.pi, sb.pi, t);
    this.pose.lean = THREE.MathUtils.lerp(sa.l, sb.l, t);
    this.pose.handsBusy = cur.st === 'prone' || !this.alive;
    this.soldier.update(dt, this.pose);

    this.tag.visible = this.alive;
    const tagY = TAG_HEIGHT[cur.st] ?? TAG_HEIGHT.stand;
    this.tag.position.y = THREE.MathUtils.damp(this.tag.position.y, tagY, 8, dt);
  }

  dispose() {
    this.tag.material.map.dispose();
    this.tag.material.dispose();
    this.soldier.dispose();
  }
}
