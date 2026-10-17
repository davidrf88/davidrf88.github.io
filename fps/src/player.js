import * as THREE from 'three';
import { WORLD_SIZE, heightAt } from './terrain.js';
import { Soldier, SOLDIER_HEIGHT } from './soldier.js';

const HEIGHT = SOLDIER_HEIGHT;
const RADIUS = 0.4;
const JUMP_SPEED = 6;
const GRAVITY = 20;
const MAG_SIZE = 12;
const FIRE_INTERVAL = 0.18;
export const MAX_HP = 100;

const STEP = 0.45;                // walk straight onto anything lower than this
const VAULT_OVER_MAX = 1.3;        // tallest thin obstacle you can vault over (taller ones: vault up, up to HEIGHT)
const _zero = new THREE.Vector3();
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

const SPEED = { jog: 3.8, sprint: 6.5, walk: 1.7, crouch: 1.6, crawl: 0.7 };

// Directional clips, indexed by 45° sector: 0 = forward, positive = to the right, ±4 = backward.
const DIR_CLIPS = {
  jog: { 0: 'Jog_Fwd_Loop', 1: 'Jog_Fwd_R_Loop', 2: 'Jog_Right_Loop', 3: 'Jog_Bwd_R_Loop', 4: 'Jog_Bwd_Loop', '-1': 'Jog_Fwd_L_Loop', '-2': 'Jog_Left_Loop', '-3': 'Jog_Bwd_L_Loop' },
  walk: { 0: 'Walk_Fwd_Loop', 1: 'Walk_Fwd_R_Loop', 2: 'Walk_R_Loop', 3: 'Walk_Bwd_R_Loop', 4: 'Walk_Bwd_Loop', '-1': 'Walk_Fwd_L_Loop', '-2': 'Walk_L_Loop', '-3': 'Walk_Bwd_L_Loop' },
  crouch: { 0: 'Crouch_Fwd_Loop', 1: 'Crouch_Fwd_R_Loop', 2: 'Crouch_Right_Loop', 3: 'Crouch_Bwd_R_Loop', 4: 'Crouch_Bwd_Loop', '-1': 'Crouch_Fwd_L_Loop', '-2': 'Crouch_Left_Loop', '-3': 'Crouch_Bwd_L_Loop' },
  crawl: { 0: 'Crawl_Fwd_Loop', 1: 'Crawl_Fwd_Loop', 2: 'Crawl_Right_Loop', 3: 'Crawl_Bwd_Loop', 4: 'Crawl_Bwd_Loop', '-1': 'Crawl_Fwd_Loop', '-2': 'Crawl_Left_Loop', '-3': 'Crawl_Bwd_Loop' },
};
const IDLE_CLIP = { stand: 'Idle_Loop', crouch: 'Crouch_Idle_Loop', prone: 'Crawl_Idle_Loop' };

const round2 = (v) => Math.round(v * 100) / 100;

export class Player {
  static async load() {
    return new Player(await Soldier.create());
  }

  /** @param {Soldier} soldier */
  constructor(soldier) {
    this.soldier = soldier;
    this.object = soldier.object;

    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.facing = 0;
    this.stance = 'stand';          // 'stand' | 'crouch' | 'prone'
    this.transition = null;         // { name, until, then } while entering/leaving prone
    this.time = 0;
    this.airTime = 0;
    this.landTimer = 0;
    this.aimFrac = 0;
    this.aimPitch = 0;              // -1 (down) … 1 (up), drives the aim layers
    this.lean = 0;                  // -1 (left) … 1 (right)
    this.aiming = false;
    this.vault = null;              // active vault, see #tryVault
    this.moveDir = new THREE.Vector3(0, 0, 1);
    this.hipFireTimer = 0;
    this.fireCooldown = 0;
    this.reloadUntil = 0;
    this.ammo = MAG_SIZE;
    this.hp = MAX_HP;
    this.alive = true;
    this.object.position.set(0, heightAt(0, 0), 0);
  }

  get position() { return this.object.position; }
  get reloading() { return this.time < this.reloadUntil; }
  get magSize() { return MAG_SIZE; }
  get currentStance() { return this.transition?.then ?? this.stance; }

  /** Eye height the camera should orbit around for the current stance. */
  get viewHeight() {
    if (!this.alive) return 0.6;
    return { stand: 1.55, crouch: 1.05, prone: 0.55 }[this.currentStance];
  }

  fadeTo(name, duration, opts) { this.soldier.fadeTo(name, duration, opts); }

  #startTransition(name, then) {
    this.fadeTo(name, 0.2, { once: true });
    this.transition = { name, then, until: this.time + this.soldier.clipDuration(name) * 0.95 };
  }

  setStance(target) {
    if (!this.alive || this.vault || this.transition || target === this.stance || !this.onGround) return;
    if (target === 'prone') this.#startTransition('Crawl_Enter', 'prone');
    else if (this.stance === 'prone') this.#startTransition('Crawl_Exit', target);
    else this.stance = target;
  }

  /** Returns true if a shot was fired. */
  tryShoot() {
    if (!this.alive || this.vault || this.stance === 'prone' || this.transition || this.reloading || this.fireCooldown > 0) return false;
    if (this.ammo <= 0) { this.reload(); return false; }
    this.ammo--;
    this.fireCooldown = FIRE_INTERVAL;
    this.hipFireTimer = 0.8;
    this.soldier.playShoot();
    if (this.ammo === 0) setTimeout(() => this.reload(), 250);
    return true;
  }

  reload() {
    if (!this.alive || this.vault || this.reloading || this.ammo === MAG_SIZE || this.stance === 'prone') return;
    this.soldier.playReload();
    const dur = this.soldier.clipDuration('Pistol_Reload');
    this.reloadUntil = this.time + dur;
    setTimeout(() => { this.ammo = MAG_SIZE; }, dur * 800);
  }

  getMuzzlePosition(target) { return this.soldier.getMuzzlePosition(target); }

  // --- Health (driven by the host in multiplayer) -----------------------------

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.vault = null;
    this.transition = null;
    this.aiming = false;
    this.fadeTo('Death01', 0.2, { once: true });
  }

  /** Joined mid-match: no body in the world until the next round. */
  spectate() {
    this.alive = false;
    this.hp = 0;
    this.object.visible = false;
  }

  /** Placed at a spawn point with full health (match start / back to lobby). */
  respawn(x, y, z) {
    this.object.visible = true;
    this.alive = true;
    this.hp = MAX_HP;
    this.ammo = MAG_SIZE;
    this.stance = 'stand';
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.object.position.set(x, y, z);
    this.fadeTo('Idle_Loop', 0.2);
  }

  /** Compact state sent to other players (see net/protocol.js). */
  netState() {
    const p = this.object.position;
    return {
      p: [round2(p.x), round2(p.y), round2(p.z)],
      f: round2(this.facing),
      b: this.soldier.baseName,
      a: round2(this.aimFrac),
      pi: round2(this.aimPitch),
      l: round2(this.lean),
      st: this.currentStance,
      r: this.reloading ? 1 : 0,
      v: this.object.visible ? 1 : 0,
    };
  }

  // --- Movement -----------------------------------------------------------------

  /** Ground height under (x, z): terrain, or a rock top if it is within stepping reach. */
  #groundAt(x, z, feetY, colliders) {
    const terrain = heightAt(x, z);
    const rock = colliders.surfaceAt(x, z);
    return rock <= feetY + STEP ? Math.max(terrain, rock) : terrain;
  }

  /** True if a rock face too tall to step onto is at (x, z) or just ahead of it. */
  #blocked(x, z, dir, feetY, colliders) {
    for (const k of [0, RADIUS]) {
      if (colliders.surfaceAt(x + dir.x * k, z + dir.z * k) - feetY > STEP) return true;
    }
    return false;
  }

  #face(dir) {
    this.facing = Math.atan2(dir.x, dir.z);
    this.object.rotation.y = this.facing;
  }

  /**
   * Space next to an obstacle:
   * - low and thin (log, stump): vault over it and land on the far side;
   * - otherwise, if its lip is lower than the player: vault up and land on top.
   * Returns false when nothing is vaultable ahead, so Space falls back to a jump.
   */
  #tryVault(colliders, moving) {
    const pos = this.object.position;
    const dir = moving ? this.moveDir.clone() : new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const heightAhead = (d) => colliders.surfaceAt(pos.x + dir.x * d, pos.z + dir.z * d) - pos.y;
    for (const d of [0.45, 0.7, 0.95]) {
      if (!(heightAhead(d) > STEP)) continue;
      const lip = Math.max(heightAhead(d), heightAhead(d + 0.35));
      const thin = !(heightAhead(d + 0.7) > STEP) && !(heightAhead(d + 1.0) > STEP);

      let to, clip, over;
      if (thin && lip <= VAULT_OVER_MAX) {
        over = true;
        clip = 'SafetyVault';
        to = pos.clone().addScaledVector(dir, d + 1.3);
        to.y = this.#groundAt(to.x, to.z, pos.y + lip, colliders);
      } else {
        // Vault up: land just past the lip, provided the top there is still within reach.
        over = false;
        to = pos.clone().addScaledVector(dir, d + 0.5);
        const top = colliders.surfaceAt(to.x, to.z);
        if (!Number.isFinite(top)) return false;
        to.y = top;
        if (Math.max(lip, top - pos.y) > HEIGHT) return false; // lip is above the player's head
        clip = lip < 0.8 ? 'StepUp' : lip < 1.4 ? 'ClimbUp_1m' : 'ClimbUp_2m';
      }
      if (this.#blocked(to.x, to.z, _zero, to.y, colliders)) return false; // nowhere to land

      this.#face(dir);
      this.velocity.set(0, 0, 0);
      this.vault = { over, from: pos.clone(), to, t: 0, dur: this.soldier.clipDuration(clip) };
      this.fadeTo(clip, 0.1, { once: true });
      return true;
    }
    return false;
  }

  /** Vault clips are in-place, so carry the body along while they play. */
  #updateVault(dt) {
    const v = this.vault;
    v.t += dt;
    const k = Math.min(1, v.t / v.dur);
    // Over: move evenly across. Up: rise first, then step forward onto the top.
    const ky = v.over ? k : smooth(0, 0.6, k);
    const kh = v.over ? smooth(0.1, 0.9, k) : smooth(0.3, 0.95, k);
    const pos = this.object.position;
    pos.y = THREE.MathUtils.lerp(v.from.y, v.to.y, ky);
    pos.x = THREE.MathUtils.lerp(v.from.x, v.to.x, kh);
    pos.z = THREE.MathUtils.lerp(v.from.z, v.to.z, kh);
    if (k >= 1) {
      this.vault = null;
      this.onGround = true;
      this.landTimer = 0;
    }
  }

  /**
   * @param {number} dt
   * @param {{forward:number, right:number, sprint:boolean, jump:boolean, aim:boolean, lean:number}} input
   * @param {{yaw:number, pitch:number}} view  camera orientation (movement is camera-relative)
   * @param {import('./forest.js').ColliderGrid} colliders
   */
  update(dt, input, view, colliders) {
    this.time += dt;
    this.fireCooldown -= dt;
    this.hipFireTimer -= dt;

    if (this.transition && this.time >= this.transition.until) {
      this.stance = this.transition.then;
      this.transition = null;
    }

    if (!this.alive) {
      this.aiming = false;
    } else if (this.vault) {
      this.aiming = false;
      this.#updateVault(dt);
    } else {
      this.#updateOnFoot(dt, input, view, colliders);
    }

    // Upper-body aim (blended up/neutral/down by camera pitch) and lean.
    this.aimFrac = THREE.MathUtils.damp(this.aimFrac, this.aiming ? 1 : 0, 14, dt);
    this.aimPitch = THREE.MathUtils.clamp(-(view.pitch - 0.1) / 0.6, -1, 1);
    // Lean only while aiming on your feet (standing or crouched).
    const leanTarget = this.aiming && this.stance !== 'prone' ? input.lean : 0;
    this.lean = THREE.MathUtils.damp(this.lean, leanTarget, 10, dt);

    this.soldier.update(dt, {
      aimFrac: this.aimFrac,
      pitch: this.aimPitch,
      lean: this.lean,
      handsBusy: this.stance === 'prone' || !!this.vault || !this.alive,
    });
  }

  #updateOnFoot(dt, input, view, colliders) {
    const pos = this.object.position;
    const moving = (input.forward !== 0 || input.right !== 0) && !this.transition;
    if (moving && input.sprint && this.stance === 'crouch') this.stance = 'stand';
    this.aiming = (input.aim || this.hipFireTimer > 0 || this.reloading) && this.stance !== 'prone' && !this.transition;
    const sprinting = moving && input.sprint && input.forward > 0 && this.stance === 'stand' && !this.aiming;

    // Shooter-style facing: body follows the camera while moving or aiming.
    if (moving || this.aiming) {
      const target = view.yaw + Math.PI;
      const delta = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += delta * Math.min(1, dt * (this.aiming ? 20 : 10));
      this.object.rotation.y = this.facing;
    }

    // Pick gait + direction, then move; rock faces block and we slide along them axis by axis.
    let gait = { stand: this.aiming ? 'walk' : 'jog', crouch: 'crouch', prone: 'crawl' }[this.stance];
    if (sprinting) gait = 'sprint';
    let sector = 0;
    if (moving) {
      sector = Math.round(Math.atan2(input.right, input.forward) / (Math.PI / 4));
      if (sector === -4) sector = 4;
      const dir = this.moveDir.set(input.right, 0, -input.forward).normalize()
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, view.yaw);
      const step = SPEED[gait] * (Math.abs(sector) >= 3 ? 0.85 : 1) * dt;
      const ox = pos.x, oz = pos.z, nx = ox + dir.x * step, nz = oz + dir.z * step;
      const stuck = this.#blocked(ox, oz, _zero, pos.y, colliders); // never trap the player inside a rock
      if (stuck || !this.#blocked(nx, nz, dir, pos.y, colliders)) { pos.x = nx; pos.z = nz; }
      else if (!this.#blocked(nx, oz, new THREE.Vector3(Math.sign(dir.x), 0, 0), pos.y, colliders)) pos.x = nx;
      else if (!this.#blocked(ox, nz, new THREE.Vector3(0, 0, Math.sign(dir.z)), pos.y, colliders)) pos.z = nz;
    }

    for (const c of colliders.near(pos.x, pos.z)) {
      if (c.kind !== 'tree') continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const min = c.r + RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
    const limit = WORLD_SIZE / 2 - 12;
    pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
    pos.z = THREE.MathUtils.clamp(pos.z, -limit, limit);

    // Space: vault if facing a low obstacle, otherwise jump; from crouch/prone it stands you up.
    if (input.jump && this.onGround && !this.transition) {
      if (this.stance !== 'stand') {
        this.setStance('stand');
      } else if (this.#tryVault(colliders, moving)) {
        return;
      } else {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
        this.airTime = 0;
        this.fadeTo('Jump_Start', 0.1, { once: true });
      }
    }

    const ground = this.#groundAt(pos.x, pos.z, pos.y, colliders);
    if (!this.onGround) {
      this.airTime += dt;
      this.velocity.y -= GRAVITY * dt;
      pos.y += this.velocity.y * dt;
      if (pos.y <= ground) {
        pos.y = ground;
        this.velocity.y = 0;
        this.onGround = true;
        this.landTimer = 0.25;
        if (!moving) this.fadeTo('Jump_Land', 0.1, { once: true });
      } else if (this.airTime > 0.25) {
        this.fadeTo('Jump_Loop', 0.3);
      }
    } else if (pos.y - ground > 0.5) {
      // Walked off a ledge: start falling.
      this.onGround = false;
      this.airTime = 0;
      this.velocity.y = 0;
    } else {
      pos.y = ground;
    }
    this.landTimer -= dt;

    // Base (full-body) animation.
    if (this.onGround && !this.transition && !(this.landTimer > 0 && !moving)) {
      if (!moving) this.fadeTo(IDLE_CLIP[this.stance], 0.3);
      else if (gait === 'sprint') this.fadeTo('Sprint_Loop', 0.25);
      else this.fadeTo(DIR_CLIPS[gait][sector], 0.25, { sync: true });
    }
  }
}
