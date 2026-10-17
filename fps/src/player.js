import * as THREE from 'three';
import { WORLD_SIZE, heightAt } from './terrain.js';
import { Soldier, SOLDIER_HEIGHT } from './soldier.js';
import { WEAPONS } from './weapons.js';
import { THROWABLES, THROW_SLOTS } from './throwables.js';

const HEIGHT = SOLDIER_HEIGHT;
const RADIUS = 0.4;
const JUMP_SPEED = 6;
const GRAVITY = 20;
export const MAX_HP = 100;

/** Bandages: 5 s to apply, then one health-bar segment (20 hp) fills back in over 5 s. */
export const BANDAGE = { apply: 5, heal: 20, healTime: 5, perPickup: 2, max: 10 };

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
    this.reloadTimer = 0;
    this.bloom = 0;                 // extra spread from sustained fire
    this.#resetWeapons();
    this.hp = MAX_HP;
    this.alive = true;
    this.object.position.set(0, heightAt(0, 0), 0);
  }

  get position() { return this.object.position; }
  get reloading() { return this.time < this.reloadUntil; }
  /** The gun in hand (while holding a grenade: the gun you'll switch back to). */
  get gun() { return WEAPONS[this.holdingThrowable ? this.lastGun : this.weapon]; }
  get holdingThrowable() { return !!THROWABLES[this.weapon]; }
  get ammo() { return this.weapons[this.holdingThrowable ? this.lastGun : this.weapon].ammo; }
  set ammo(v) { this.weapons[this.weapon].ammo = v; }
  get reserve() { return this.weapons[this.holdingThrowable ? this.lastGun : this.weapon].reserve; }
  get magSize() { return this.gun.mag; }
  /** Looking through the scope: scoped gun, right mouse held, gun fully raised. */
  get scoped() { return !!this.gun.scope && !this.holdingThrowable && this.aimHeld && this.aiming && this.aimFrac > 0.8; }
  /** Current accuracy cone half-angle (radians). */
  get spread() {
    const aimed = this.gun.scope ? this.scoped : this.aiming && this.aimFrac > 0.6;
    return (aimed ? this.gun.spread.aim : this.gun.spread.hip) + this.bloom;
  }
  has(type) { return !!this.weapons[type]; }

  #resetWeapons() {
    this.weapons = { pistol: { ammo: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve } };
    this.throwables = Object.fromEntries(Object.keys(THROWABLES).map((t) => [t, 0]));
    this.bandages = 0;
    this.bandageUntil = null; // applying: time it finishes
    this.weapon = this.lastGun = 'pistol';
    this.soldier.setWeapon('pistol');
  }

  /** Can this pickup be taken? (Grenades and bandages are capped.) */
  canTake(type) {
    if (type === 'bandage') return this.bandages < BANDAGE.max;
    return !THROWABLES[type] || this.throwables[type] < THROWABLES[type].max;
  }

  /** Picked up something from the ground: a gun, a grenade or bandages. */
  pickUp(type) {
    if (type === 'bandage') this.bandages = Math.min(BANDAGE.max, this.bandages + BANDAGE.perPickup);
    else if (THROWABLES[type]) this.giveThrowable(type);
    else this.giveWeapon(type);
  }

  /** Picked up a grenade (capped per type). */
  giveThrowable(type) {
    this.throwables[type] = Math.min(THROWABLES[type].max, this.throwables[type] + 1);
  }

  /**
   * G: take out a grenade, or cycle to the next type you have. Returns the selected type (or null).
   */
  cycleThrowable() {
    const owned = THROW_SLOTS.filter((s) => !s.locked && this.throwables[s.type] > 0).map((s) => s.type);
    if (!owned.length || !this.alive) return null;
    const i = owned.indexOf(this.weapon);
    const next = owned[(i + 1) % owned.length];
    this.equip(next);
    return next;
  }

  // --- Bandages ---------------------------------------------------------------

  get applyingBandage() { return this.bandageUntil != null; }
  /** 0..1 progress of the bandage being applied. */
  get bandageProgress() { return this.applyingBandage ? 1 - (this.bandageUntil - this.time) / BANDAGE.apply : 0; }

  /** H: start wrapping a bandage (needs one, and missing health). Returns false if you can't. */
  startBandage() {
    if (!this.alive || this.applyingBandage || this.bandages <= 0 || this.hp >= MAX_HP || this.vault || this.cooking) return false;
    this.bandageUntil = this.time + BANDAGE.apply;
    this.reloadUntil = 0;
    clearTimeout(this.reloadTimer);
    this.soldier.bandaging = true;
    return true;
  }

  /** Stopped before it was done: you keep the bandage. */
  cancelBandage() {
    if (!this.applyingBandage) return false;
    this.bandageUntil = null;
    this.soldier.bandaging = false;
    return true;
  }

  /** R with a frag in hand: pull the pin; the fuse starts now (PUBG "cooking"). */
  startCook() {
    if (!this.holdingThrowable || !THROWABLES[this.weapon].cook || this.cookStart != null) return false;
    this.cookStart = this.time;
    return true;
  }
  get cooking() { return this.cookStart != null; }
  /** Throw cancelled: the pin goes back in. */
  uncook() { this.cookStart = null; }
  /** Seconds left on the fuse of the grenade in hand (full fuse if the pin is still in). */
  get fuseLeft() {
    const def = THROWABLES[this.weapon];
    if (!def) return 0;
    return this.cooking ? def.fuse - (this.time - this.cookStart) : def.fuse;
  }

  /** Released a grenade: one fewer; back to the gun when you run out. Returns false if you can't. */
  consumeThrowable() {
    const type = this.weapon;
    if (!THROWABLES[type] || this.throwables[type] <= 0) return false;
    this.cookStart = null;
    this.throwables[type]--;
    this.throwCooldown = 0.9;
    this.soldier.playThrow();
    this.hipFireTimer = 0;
    if (this.throwables[type] === 0) setTimeout(() => { if (this.weapon === type) this.equip(this.lastGun); }, 700);
    return true;
  }

  /** Picked up a gun: a full magazine plus reserve ammo, and switch to it. */
  giveWeapon(type) {
    const w = WEAPONS[type];
    const slot = this.weapons[type];
    if (slot) slot.reserve += w.mag + w.reserve; // already have one: take its ammo
    else this.weapons[type] = { ammo: w.mag, reserve: w.reserve };
    this.equip(type);
  }

  equip(type) {
    if (this.cooking) return; // the pin is out: throw it first
    if (type !== this.weapon) this.cancelBandage();
    const throwable = !!THROWABLES[type];
    if (!this.alive || type === this.weapon || (throwable ? !(this.throwables[type] > 0) : !this.weapons[type])) return;
    if (!throwable) this.lastGun = type;
    clearTimeout(this.reloadTimer);
    this.reloadUntil = 0;
    this.weapon = type;
    this.bloom = 0;
    this.fireCooldown = 0.35; // raise the new gun
    this.soldier.setWeapon(type);
  }
  get currentStance() { return this.transition?.then ?? this.stance; }

  /** Eye height the camera should orbit around for the current stance. */
  get viewHeight() {
    if (!this.alive) return 0.6;
    return { stand: 1.55, crouch: 1.05, prone: 0.55 }[this.currentStance];
  }

  fadeTo(name, duration, opts) { this.soldier.fadeTo(name, duration, opts); }

  /** Plays part of a stance clip (`from`..`to` as fractions of it), then settles into `then`. */
  #startTransition(name, then, { from = 0, to = 1 } = {}) {
    const dur = this.soldier.clipDuration(name);
    this.fadeTo(name, 0.2, { once: true, from: dur * from });
    this.transition = { name, then, until: this.time + dur * (to - from) * 0.95 };
  }

  setStance(target) {
    if (!this.alive || this.vault || this.transition || target === this.stance || !this.onGround) return;
    // The library's prone clips go to/from full standing. From a crouch, start Crawl_Enter once the
    // hips are at crouch height (~15%); to a crouch, stop Crawl_Exit there (~42%) instead of standing up.
    if (target === 'prone') this.#startTransition('Crawl_Enter', 'prone', { from: this.stance === 'crouch' ? 0.15 : 0 });
    else if (this.stance === 'prone') this.#startTransition('Crawl_Exit', target, { to: target === 'crouch' ? 0.42 : 1 });
    else this.stance = target;
  }

  /** Returns true if a shot was fired. */
  tryShoot() {
    if (this.holdingThrowable || this.applyingBandage) return false;
    if (!this.alive || this.vault || this.stance === 'prone' || this.transition || this.reloading || this.fireCooldown > 0) return false;
    if (this.ammo <= 0) return false; // empty: no auto-reload, press R
    this.ammo--;
    this.fireCooldown = this.gun.interval;
    this.bloom = Math.min(this.gun.bloomMax, this.bloom + this.gun.bloom);
    this.hipFireTimer = 0.8;
    this.soldier.playShoot();
    return true;
  }

  reload() {
    if (this.holdingThrowable || this.applyingBandage) return;
    const slot = this.weapons[this.weapon];
    if (!this.alive || this.vault || this.reloading || slot.ammo === this.magSize || slot.reserve <= 0 || this.stance === 'prone') return;
    this.soldier.playReload();
    const dur = this.soldier.clipDuration('Pistol_Reload') * (this.gun.reloadK ?? 1);
    this.reloadUntil = this.time + dur;
    const mag = this.magSize;
    this.reloadTimer = setTimeout(() => {
      const take = Math.min(mag - slot.ammo, slot.reserve);
      slot.ammo += take;
      slot.reserve -= take;
    }, dur * 800);
  }

  getMuzzlePosition(target) { return this.soldier.getMuzzlePosition(target); }

  // --- Health (driven by the host in multiplayer) -----------------------------

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.cookStart = null;
    this.cancelBandage();
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
    clearTimeout(this.reloadTimer);
    this.reloadUntil = 0;
    this.cancelBandage();
    this.#resetWeapons();
    this.cookStart = null;
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
      w: this.weapon,
      h: this.applyingBandage ? 1 : 0,
    };
  }

  // --- Movement -----------------------------------------------------------------

  /** Ground height under (x, z): terrain, or a rock top if it is within stepping reach. */
  #groundAt(x, z, feetY, colliders) {
    const terrain = heightAt(x, z);
    const rock = colliders.surfaceAt(x, z);
    return rock <= feetY + STEP ? Math.max(terrain, rock) : terrain;
  }

  /**
   * True if a rock face too tall to step onto is anywhere under the body at (x, z): its center
   * plus a ring at the body's radius (so you can't slide into a rock at an angle either).
   */
  #blocked(x, z, dir, feetY, colliders) {
    if (colliders.surfaceAt(x, z) - feetY > STEP) return true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (colliders.surfaceAt(x + Math.cos(a) * RADIUS, z + Math.sin(a) * RADIUS) - feetY > STEP) return true;
    }
    return false;
  }

  /** Only the center point: used to free a player who is already overlapping a rock. */
  #inside(x, z, feetY, colliders) { return colliders.surfaceAt(x, z) - feetY > STEP; }

  /** How much of the body ring at (x, z) is inside rock, and which way the rock is. */
  #overlap(x, z, feetY, colliders) {
    let count = 0;
    const toward = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      if (colliders.surfaceAt(x + dx * RADIUS, z + dz * RADIUS) - feetY > STEP) { count++; toward.x += dx; toward.z += dz; }
    }
    return { count, toward };
  }

  /**
   * A step from (ox, oz) to (nx, nz) is fine if it ends clear of rock, or — when the body already
   * touches one — if it doesn't go deeper (so you can always back away or slide off).
   */
  #canStep(ox, oz, nx, nz, feetY, colliders) {
    if (this.#inside(nx, nz, feetY, colliders)) return false;
    const next = this.#overlap(nx, nz, feetY, colliders);
    if (next.count === 0) return true;
    const now = this.#overlap(ox, oz, feetY, colliders);
    if (now.count === 0) return false;
    return next.count < now.count || ((nx - ox) * now.toward.x + (nz - oz) * now.toward.z) <= 0;
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
      for (const c of colliders.near(to.x, to.z)) {
        if (c.kind === 'tree' && Math.hypot(to.x - c.x, to.z - c.z) < c.r + RADIUS) return false; // a trunk is in the way
      }

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
    this.throwCooldown = (this.throwCooldown ?? 0) - dt;
    this.hipFireTimer -= dt;
    this.bloom = Math.max(0, this.bloom - dt * 0.08);

    // Bandage finished: use it up and tell the game to start healing (onBandaged).
    if (this.applyingBandage && this.time >= this.bandageUntil) {
      this.cancelBandage();
      this.bandages--;
      this.onBandaged?.();
    }
    if (this.vault) this.cancelBandage();

    if (this.transition && this.time >= this.transition.until) {
      this.stance = this.transition.then;
      this.transition = null;
    }

    if (!this.alive) {
      this.aiming = this.aimHeld = false;
    } else if (this.vault) {
      this.aiming = this.aimHeld = false;
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
    this.aimHeld = input.aim;
    this.aiming = (input.aim || this.hipFireTimer > 0 || this.reloading) && this.stance !== 'prone' && !this.transition && !this.applyingBandage;
    const sprinting = moving && input.sprint && input.forward > 0 && this.stance === 'stand' && !this.aiming && !this.applyingBandage;

    // Shooter-style facing: body follows the camera while moving or aiming.
    if (moving || this.aiming) {
      const target = view.yaw + Math.PI;
      const delta = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += delta * Math.min(1, dt * (this.aiming ? 20 : 10));
      this.object.rotation.y = this.facing;
    }

    // Pick gait + direction, then move; rock faces block and we slide along them axis by axis.
    let gait = { stand: this.aiming || this.applyingBandage ? 'walk' : 'jog', crouch: 'crouch', prone: 'crawl' }[this.stance];
    if (sprinting) gait = 'sprint';
    let sector = 0;
    if (moving) {
      sector = Math.round(Math.atan2(input.right, input.forward) / (Math.PI / 4));
      if (sector === -4) sector = 4;
      const dir = this.moveDir.set(input.right, 0, -input.forward).normalize()
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, view.yaw);
      const step = SPEED[gait] * (Math.abs(sector) >= 3 ? 0.85 : 1) * dt;
      const ox = pos.x, oz = pos.z, nx = ox + dir.x * step, nz = oz + dir.z * step;
      const stuck = this.#inside(ox, oz, pos.y, colliders); // never trap the player inside a rock
      const y = pos.y;
      if (stuck || this.#canStep(ox, oz, nx, nz, y, colliders)) { pos.x = nx; pos.z = nz; }
      else {
        // Blocked: slide along the rock face (the move minus its part pointing into the rock),
        // then fall back to the world axes.
        const into = this.#overlap(nx, nz, y, colliders).toward.normalize();
        const k = dir.x * into.x + dir.z * into.z;
        const sx = (dir.x - into.x * k) * step, sz = (dir.z - into.z * k) * step;
        if (Math.hypot(sx, sz) > step * 0.15 && this.#canStep(ox, oz, ox + sx, oz + sz, y, colliders)) { pos.x = ox + sx; pos.z = oz + sz; }
        else if (this.#canStep(ox, oz, nx, oz, y, colliders)) pos.x = nx;
        else if (this.#canStep(ox, oz, ox, nz, y, colliders)) pos.z = nz;
      }
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
