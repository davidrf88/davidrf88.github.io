import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const SOLDIER_HEIGHT = 1.8;

// Mixer weight used to make an upper-body layer override the full-body locomotion.
// Weights are normalized per bone, so K / (K + 1) ≈ 100% for the layer.
const LAYER_K = 1000;

const MAX_LEAN = 0.38;            // radians of total spine roll at full lean
const LEAN_BONES = ['spine_01', 'spine_02', 'spine_03'];
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _qWorld = new THREE.Quaternion();
const _down = new THREE.Vector3(0, -1, 0);

const UPPER_BODY = /^(spine_02|spine_03|neck_01|Head|clavicle_|upperarm_|lowerarm_|hand_|index_|middle_|ring_|pinky_|thumb_)/;
const RIGHT_FINGERS = /^(index_|middle_|ring_|pinky_|thumb_)\d+(_leaf)?_r$/;

/** Base clips that play once and hold their last frame (everything else loops). */
export const ONCE_CLIPS = new Set([
  'Jump_Start', 'Jump_Land', 'Crawl_Enter', 'Crawl_Exit', 'SafetyVault', 'StepUp', 'ClimbUp_1m', 'ClimbUp_2m', 'Death01',
]);

function filterClip(clip, boneTest, suffix) {
  const tracks = clip.tracks.filter((t) => boneTest.test(t.name.split('.')[0]));
  return new THREE.AnimationClip(clip.name + suffix, clip.duration, tracks);
}

/** Keeps the character in place: drop horizontal motion of the root bone. */
function stripRootMotion(clip) {
  for (const t of clip.tracks) {
    if (t.name !== 'root.position') continue;
    for (let i = 0; i < t.values.length; i += 3) { t.values[i] = 0; t.values[i + 2] = 0; }
  }
  return clip;
}

/**
 * Assault rifle from primitives: origin at the pistol grip, barrel along +Z.
 * `foregrip` marks where the left hand goes, `muzzle` the barrel tip.
 */
export function buildRifle() {
  const steel = new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.45, metalness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3f26', roughness: 0.8, flatShading: true });
  const rifle = new THREE.Group();
  const box = (w, h, d, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    rifle.add(m);
    return m;
  };
  box(0.03, 0.1, 0.045, steel, 0, -0.01, 0, -0.3);           // pistol grip
  box(0.05, 0.07, 0.32, steel, 0, 0.065, 0.06);              // receiver
  box(0.045, 0.085, 0.24, wood, 0, 0.05, -0.2);              // stock
  box(0.05, 0.06, 0.2, wood, 0, 0.055, 0.3);                 // handguard
  box(0.032, 0.11, 0.06, steel, 0, -0.03, 0.14, 0.25);       // magazine
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 6), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.07, 0.52);
  barrel.castShadow = true;
  rifle.add(barrel);
  box(0.012, 0.03, 0.02, steel, 0, 0.115, 0.42);             // front sight
  const foregrip = new THREE.Object3D();
  foregrip.position.set(-0.015, 0.03, 0.26);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.07, 0.66);
  rifle.add(foregrip, muzzle);
  return { rifle, foregrip, muzzle };
}

/** Bolt-action sniper rifle with a long scope; same conventions as buildRifle. */
export function buildSniper() {
  const steel = new THREE.MeshStandardMaterial({ color: '#1b1d1f', roughness: 0.4, metalness: 0.65 });
  const stockMat = new THREE.MeshStandardMaterial({ color: '#3d4a2c', roughness: 0.85, flatShading: true });
  const lens = new THREE.MeshStandardMaterial({ color: '#7fb7ff', roughness: 0.1, metalness: 0.3, emissive: '#1a3a66' });
  const gun = new THREE.Group();
  const add = (mesh, x, y, z, rx = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    gun.add(mesh);
    return mesh;
  };
  const box = (w, h, d, mat, x, y, z, rx) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z, rx);
  const tube = (r, len, mat, x, y, z) => add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat), x, y, z, Math.PI / 2);
  box(0.03, 0.1, 0.045, stockMat, 0, -0.01, 0, -0.3);         // grip
  box(0.05, 0.065, 0.3, steel, 0, 0.06, 0.08);                // receiver
  box(0.05, 0.1, 0.32, stockMat, 0, 0.035, -0.25);            // stock
  box(0.05, 0.03, 0.08, stockMat, 0, 0.1, -0.2);              // cheek rest
  box(0.055, 0.055, 0.3, stockMat, 0, 0.05, 0.36);            // forend
  tube(0.012, 0.55, steel, 0, 0.068, 0.72);                   // long barrel
  tube(0.018, 0.08, steel, 0, 0.068, 1.0);                    // muzzle brake
  tube(0.024, 0.34, steel, 0, 0.14, 0.08);                    // scope tube
  tube(0.032, 0.07, steel, 0, 0.14, 0.27);                    // objective bell
  tube(0.029, 0.06, steel, 0, 0.14, -0.1);                    // eyepiece
  const glass = tube(0.027, 0.005, lens, 0, 0.14, 0.307);
  glass.castShadow = false;
  box(0.012, 0.05, 0.02, steel, 0, 0.1, 0.0);                 // scope mounts
  box(0.012, 0.05, 0.02, steel, 0, 0.1, 0.16);
  box(0.012, 0.012, 0.05, steel, 0.035, 0.07, 0.02);          // bolt handle
  box(0.04, 0.09, 0.05, steel, 0, -0.02, 0.15);               // magazine
  const foregrip = new THREE.Object3D();
  foregrip.position.set(-0.015, 0.03, 0.3);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.068, 1.05);
  gun.add(foregrip, muzzle);
  return { gun, foregrip, muzzle };
}

/** Compact SMG: short barrel, stick magazine, folding wire stock; same conventions as buildRifle. */
export function buildSMG() {
  const steel = new THREE.MeshStandardMaterial({ color: '#25282b', roughness: 0.45, metalness: 0.6 });
  const polymer = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.8 });
  const gun = new THREE.Group();
  const box = (w, h, d, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    gun.add(m);
    return m;
  };
  box(0.03, 0.1, 0.045, polymer, 0, -0.01, 0, -0.25);       // grip
  box(0.05, 0.075, 0.26, steel, 0, 0.06, 0.07);             // receiver
  box(0.045, 0.05, 0.1, polymer, 0, 0.055, 0.25);           // handguard
  box(0.028, 0.15, 0.04, steel, 0, -0.05, 0.12, 0.12);      // long stick magazine
  box(0.012, 0.012, 0.18, steel, 0.018, 0.07, -0.13);       // wire stock rails
  box(0.012, 0.012, 0.18, steel, -0.018, 0.07, -0.13);
  box(0.05, 0.06, 0.012, steel, 0, 0.06, -0.22);            // butt plate
  box(0.012, 0.025, 0.03, steel, 0, 0.11, 0.0);             // rear sight
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.065, 0.35);
  barrel.castShadow = true;
  gun.add(barrel);
  const foregrip = new THREE.Object3D();
  foregrip.position.set(-0.015, 0.03, 0.24);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.065, 0.42);
  gun.add(foregrip, muzzle);
  return { gun, foregrip, muzzle };
}

/** Rotates `bone` (in world space) so the direction `from` turns into `to`, keeping children attached. */
function swing(bone, from, to) {
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  bone.getWorldQuaternion(_qWorld).premultiply(_q);
  bone.parent.getWorldQuaternion(_qParent).invert();
  bone.quaternion.copy(_qParent.multiply(_qWorld));
  bone.updateMatrixWorld(true);
}

/**
 * Analytic two-bone IK: bends upper → lower → hand so the hand reaches `target`, with the
 * elbow pointing toward `bendHint` (a world direction). Unreachable targets are approached.
 */
function solveArm(upper, lower, hand, target, bendHint) {
  const A = upper.getWorldPosition(new THREE.Vector3());
  const B = lower.getWorldPosition(new THREE.Vector3());
  const C = hand.getWorldPosition(new THREE.Vector3());
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  const dir = target.clone().sub(A);
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  dir.normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const bend = bendHint.clone().addScaledVector(dir, -bendHint.dot(dir));
  if (bend.lengthSq() < 1e-6) bend.copy(_down).addScaledVector(dir, -_down.dot(dir));
  bend.normalize();
  const elbow = A.clone().addScaledVector(dir, cosA * l1).addScaledVector(bend, Math.sqrt(1 - cosA * cosA) * l1);
  swing(upper, B.clone().sub(A), elbow.clone().sub(A));
  const handNow = hand.getWorldPosition(new THREE.Vector3());
  const reach = A.clone().addScaledVector(dir, d);
  swing(lower, handNow.sub(elbow), reach.sub(elbow));
}

/** Low-poly soldier gear built from primitives, positioned in the character's space. */
function buildGear(uniformColor) {
  const olive = new THREE.MeshStandardMaterial({ color: uniformColor.clone().multiplyScalar(0.9), roughness: 0.9, flatShading: true });
  const darkOlive = new THREE.MeshStandardMaterial({ color: uniformColor.clone().multiplyScalar(0.65), roughness: 0.9, flatShading: true });
  const strap = new THREE.MeshStandardMaterial({ color: '#2b2a22', roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.45, metalness: 0.6 });

  const helmet = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), olive);
  dome.scale.set(1, 0.95, 1.12);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.02, 12), darkOlive);
  brim.scale.z = 1.12;
  helmet.add(dome, brim);

  const vest = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.27), olive);
  const pouches = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.05), darkOlive);
  pouches.position.set(0, -0.1, 0.155);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.11), darkOlive);
  pack.position.set(0, 0.0, -0.18);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 8), strap);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.18, -0.18);
  vest.add(plate, pouches, pack, roll);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.24), strap);

  // Pistol: origin at the grip, barrel along +Z, grip pointing down.
  const pistol = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.045), steel);
  grip.rotation.x = -0.25;
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.04, 0.19), steel);
  slide.position.set(0, 0.06, 0.05);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.065, 0.15);
  pistol.add(grip, slide, muzzle);

  for (const g of [helmet, vest, belt, pistol]) g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const rifle = buildRifle();
  const sniper = buildSniper();
  const smg = buildSMG();
  // Two-handed guns: model, where the left hand goes, barrel tip.
  const longGuns = {
    rifle: { object: rifle.rifle, foregrip: rifle.foregrip, muzzle: rifle.muzzle },
    sniper: { object: sniper.gun, foregrip: sniper.foregrip, muzzle: sniper.muzzle },
    smg: { object: smg.gun, foregrip: smg.foregrip, muzzle: smg.muzzle },
  };
  // Smoke grenade in hand: a can with a cap and spoon.
  const grenade = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#56634a', roughness: 0.7 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.03, 8), steel);
  cap.position.y = 0.075;
  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.015), steel);
  spoon.position.set(0.045, 0.02, 0);
  grenade.add(can, cap, spoon);
  grenade.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // Frag: a ribbed olive egg with a fuse head.
  const frag = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), new THREE.MeshStandardMaterial({ color: '#3f4a2c', roughness: 0.6, flatShading: true }));
  body.scale.y = 1.15;
  const fuseHead = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.03, 8), steel);
  fuseHead.position.y = 0.06;
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.014), steel);
  lever.position.set(0.04, 0.03, 0);
  frag.add(body, fuseHead, lever);
  frag.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // Blue zone grenade: the smoke can in blue with a glowing band.
  const bluezone = grenade.clone();
  bluezone.children[0].material = new THREE.MeshStandardMaterial({ color: '#2f5fd0', roughness: 0.5, emissive: '#10307a' });
  // Throwables held in the right hand, by type.
  const inHand = { smoke: grenade, frag, bluezone };
  return { helmet, vest, belt, pistol, muzzle, longGuns, inHand, uniform: { olive, darkOlive } };
}

let assetsPromise = null;

/** Loads the Quaternius "Universal Animation Library" 1 & 2 (CC0) once; same rig, shared clips. */
function loadAssets() {
  assetsPromise ??= (async () => {
    const loader = new GLTFLoader();
    const [ual1, ual2] = await Promise.all([
      loader.loadAsync('assets/character/UAL1.glb'),
      loader.loadAsync('assets/character/UAL2.glb'),
    ]);
    const clips = new Map();
    for (const clip of [...ual2.animations, ...ual1.animations]) clips.set(clip.name, stripRootMotion(clip));
    return { scene: ual1.scene, clips };
  })();
  return assetsPromise;
}

/**
 * The soldier's visuals: recolored mannequin + gear, an animation mixer with a full-body base
 * clip, and upper-body layers (aim up/neutral/down, finger grip, shoot, reload) plus lean.
 * Used both by the local Player and by remote players.
 */
export class Soldier {
  static async create({ color = '#56603a' } = {}) {
    const { scene, clips } = await loadAssets();
    return new Soldier(SkeletonUtils.clone(scene), clips, new THREE.Color(color));
  }

  constructor(model, clips, uniformColor) {
    this.uniformMats = []; // body materials that take the uniform color
    this.object = new THREE.Group();
    this.model = model;
    this.clips = clips;
    this.object.add(model);

    // Soldier uniform: recolor the mannequin's two materials.
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      o.material = o.material.clone();
      o.material.color.copy(o.material.name === 'M_Joints' ? new THREE.Color('#25261f') : uniformColor);
      o.material.roughness = 0.9;
      if (o.material.name !== 'M_Joints') this.uniformMats.push(o.material);
    });

    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(SOLDIER_HEIGHT / size.y);
    this.bones = {};
    model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });

    // Make the model face +Z regardless of how it was authored (toe direction in rest pose).
    model.updateMatrixWorld(true);
    const wp = (name) => this.bones[name].getWorldPosition(new THREE.Vector3());
    const toe = wp('ball_l').sub(wp('foot_l'));
    model.rotation.y = -Math.atan2(toe.x, toe.z);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();
    this.weapon = 'pistol';
    this.longGun = null;
    this.#attachGear(uniformColor);

    // Upper-body layers (always running; weights driven every frame).
    this.layers = {
      aimUp: this.#layer('Pistol_Aim_Up', UPPER_BODY, '_upper'),
      aimNeutral: this.#layer('Pistol_Aim_Neutral', UPPER_BODY, '_upper'),
      aimDown: this.#layer('Pistol_Aim_Down', UPPER_BODY, '_upper'),
      grip: this.#layer('Pistol_Idle_Loop', RIGHT_FINGERS, '_fingers'),
    };
    this.shootAction = this.#layer('Pistol_Shoot', UPPER_BODY, '_upper', true);
    this.reloadAction = this.#layer('Pistol_Reload', UPPER_BODY, '_upper', true);
    this.throwAction = this.#layer('OverhandThrow', UPPER_BODY, '_upper', true);
    this.throwAction.timeScale = 1.6;
    this.bandageAction = this.#layer('Bandage_Loop', UPPER_BODY, '_upper');
    this.bandaging = false; // set while wrapping a bandage

    this.base = this.#action('Idle_Loop');
    this.base.play();

    this.chute = this.#buildChute(uniformColor);
    this.object.add(this.chute);
  }

  /** Parachute canopy in the uniform color (lightened) with four risers; hidden until opened. */
  #buildChute(uniformColor) {
    const g = new THREE.Group();
    this.chuteMat = new THREE.MeshStandardMaterial({
      color: uniformColor.clone().lerp(new THREE.Color('#ffffff'), 0.35), roughness: 0.8, side: THREE.DoubleSide, flatShading: true,
    });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 6, 0, Math.PI * 2, 0, 1.0), this.chuteMat);
    canopy.scale.y = 0.55;
    canopy.position.y = 4.3;
    canopy.castShadow = true;
    const rim = 2.6 * Math.sin(1.0), rimY = 4.3 + 2.6 * Math.cos(1.0) * 0.55;
    const pts = [];
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      pts.push(new THREE.Vector3(x * 0.22, 1.5, z * 0.1), new THREE.Vector3(x * rim * 0.7, rimY, z * rim * 0.7));
    }
    const risers = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2b2a22' }));
    g.add(canopy, risers);
    g.visible = false;
    return g;
  }

  /**
   * In the air: `tilt` pitches the body forward (radians; diving ≈ 1.1), `chute` shows the canopy.
   */
  airPose({ tilt = 0, chute = false }) {
    this.model.rotation.x = tilt;
    this.chute.visible = chute;
  }

  get baseName() { return this.base.getClip().name; }
  get reloading() { return this.reloadAction.isRunning(); }
  clipDuration(name) { return this.clips.get(name).duration; }

  #action(name) {
    if (!this.actions.has(name)) {
      const clip = this.clips.get(name);
      if (!clip) throw new Error(`Missing animation ${name}`);
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    return this.actions.get(name);
  }

  #layer(name, boneTest, suffix, once = false) {
    const action = this.mixer.clipAction(filterClip(this.clips.get(name), boneTest, suffix));
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.play();
    }
    action.setEffectiveWeight(0);
    return action;
  }

  /** Attaches gear in the pistol-aim pose so the gun lines up with the aiming hand. */
  #attachGear(uniformColor) {
    const pose = this.mixer.clipAction(this.clips.get('Pistol_Aim_Neutral'));
    pose.play();
    this.mixer.update(0);
    this.model.updateMatrixWorld(true);

    const wp = (name) => this.bones[name].getWorldPosition(new THREE.Vector3());
    const gear = buildGear(uniformColor);
    const place = (obj, bone, pos) => {
      obj.position.copy(pos);
      this.object.add(obj);
      obj.updateMatrixWorld(true);
      this.bones[bone].attach(obj);
    };

    place(gear.helmet, 'Head', wp('Head').add(new THREE.Vector3(0, 0.1, 0.01)));
    place(gear.vest, 'spine_03', wp('spine_02').lerp(wp('spine_03'), 0.6).add(new THREE.Vector3(0, 0.02, 0.0)));
    place(gear.belt, 'pelvis', wp('pelvis').add(new THREE.Vector3(0, 0.08, 0)));
    const gripAt = wp('hand_r').lerp(wp('middle_01_r'), 0.6).add(new THREE.Vector3(0, -0.01, 0));
    place(gear.pistol, 'hand_r', gripAt);
    for (const g of Object.values(gear.inHand)) {
      place(g, 'hand_r', wp('hand_r').lerp(wp('middle_01_r'), 0.5).add(new THREE.Vector3(0, 0.02, 0)));
      g.visible = false;
    }
    for (const g of Object.values(gear.longGuns)) {
      place(g.object, 'hand_r', gripAt.clone());
      g.object.visible = false;
    }

    this.gear = gear;
    this.muzzle = gear.muzzle;
    pose.stop();
    this.mixer.update(0);
  }

  fadeTo(name, duration = 0.25, { once = ONCE_CLIPS.has(name), sync = false, from = 0 } = {}) {
    const next = this.#action(name);
    if (next === this.base) return;
    const prev = this.base;
    next.reset();
    next.time = from; // start partway into the clip
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    // Keep foot phase when switching between directional variants of the same gait.
    if (sync && prev.isRunning()) {
      next.time = (prev.time / prev.getClip().duration) * next.getClip().duration;
    }
    next.setEffectiveWeight(1).fadeIn(duration).play();
    prev.fadeOut(duration);
    this.base = next;
  }

  /**
   * 'pistol' | 'rifle' | 'smg' | 'sniper' | a throwable ('frag', 'smoke', 'bluezone'): shows it in hand; long guns are held
   * two-handed (see #rifleIK).
   */
  setWeapon(type) {
    if (type === this.weapon) return;
    const throwable = !!this.gear.inHand[type];
    if (!(type === 'pistol' || throwable || this.gear.longGuns[type])) return;
    this.weapon = type;
    this.gear.pistol.visible = type === 'pistol';
    for (const [name, g] of Object.entries(this.gear.inHand)) g.visible = name === type;
    for (const [name, g] of Object.entries(this.gear.longGuns)) g.object.visible = name === type;
    this.longGun = this.gear.longGuns[type] ?? null;
    this.muzzle = this.longGun ? this.longGun.muzzle : this.gear.pistol.children.at(-1);
  }

  /** Hides the body while looking through a scope (the camera sits in the head). */
  set scoped(on) { this.model.visible = !on; } // gear hangs off the bones, so it hides too

  /** Recolors the uniform (body, helmet, vest, pack). */
  setColor(hex) {
    const c = new THREE.Color(hex);
    for (const m of this.uniformMats) m.color.copy(c);
    this.gear.uniform.olive.color.copy(c).multiplyScalar(0.9);
    this.gear.uniform.darkOlive.color.copy(c).multiplyScalar(0.65);
    this.chuteMat.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.35);
  }

  playShoot() { this.shootAction.reset().play(); }
  playThrow() { this.throwAction.reset().play(); }
  /** The grenade leaves the hand (the can stays hidden until the throw clip ends). */
  set grenadeInHand(on) {
    const g = this.gear.inHand[this.weapon];
    if (g) g.visible = on;
  }
  playReload() { this.reloadAction.reset().play(); }

  getMuzzlePosition(target = new THREE.Vector3()) {
    return this.muzzle.getWorldPosition(target);
  }

  /**
   * @param {number} dt
   * @param {{aimFrac:number, pitch:number, lean:number, handsBusy:boolean}} pose
   *   aimFrac 0..1, pitch -1 (down) … 1 (up), lean -1 (left) … 1 (right)
   */
  update(dt, { aimFrac, pitch, lean, handsBusy }) {
    const layerWeight = (f) => (f <= 1e-3 ? 0 : Math.min(LAYER_K, f / Math.max(1e-3, 1 - f)));
    const aimW = layerWeight(aimFrac);
    this.layers.aimUp.setEffectiveWeight(aimW * Math.max(0, pitch));
    this.layers.aimDown.setEffectiveWeight(aimW * Math.max(0, -pitch));
    this.layers.aimNeutral.setEffectiveWeight(aimW * (1 - Math.abs(pitch)));
    this.layers.grip.setEffectiveWeight(handsBusy ? 0 : LAYER_K);
    this.shootAction.setEffectiveWeight(this.shootAction.isRunning() ? LAYER_K * 3 : 0);
    this.reloadAction.setEffectiveWeight(this.reloadAction.isRunning() ? LAYER_K * 5 : 0);
    this.throwAction.setEffectiveWeight(this.throwAction.isRunning() ? LAYER_K * 6 : 0);
    this.bandageAction.setEffectiveWeight(this.bandaging ? LAYER_K * 8 : 0);

    this.mixer.update(dt);
    if (Math.abs(lean) > 1e-3) this.#applyLean(lean);
    if (this.longGun && !handsBusy && !this.bandaging) this.#rifleIK(aimFrac);
  }

  /**
   * The library only has pistol animations, so the rifle is posed procedurally on top of them:
   * the right hand (holding the grip) is pulled back toward the shoulder so the stock sits there
   * while aiming, keeping the gun's direction from the aim clips; the left hand reaches for the
   * handguard.
   */
  #rifleIK(aimFrac) {
    const b = this.bones;
    this.object.updateMatrixWorld(true);
    const hand = b.hand_r;
    const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
    const shoulder = b.upperarm_r.getWorldPosition(new THREE.Vector3());
    const handPos = hand.getWorldPosition(new THREE.Vector3());
    const pull = THREE.MathUtils.lerp(0.85, 0.55, aimFrac);
    const target = shoulder.clone().lerp(handPos, pull);
    const elbowOut = b.lowerarm_r.getWorldPosition(new THREE.Vector3()).sub(shoulder).add(_down);
    solveArm(b.upperarm_r, b.lowerarm_r, hand, target, elbowOut);
    // Keep the hand (and so the rifle) pointing where the animation aimed it.
    hand.parent.getWorldQuaternion(_qParent).invert();
    hand.quaternion.copy(_qParent.multiply(handQ));
    hand.updateMatrixWorld(true);

    const grip = this.longGun.foregrip.getWorldPosition(new THREE.Vector3());
    const lShoulder = b.upperarm_l.getWorldPosition(new THREE.Vector3());
    const lElbow = b.lowerarm_l.getWorldPosition(new THREE.Vector3()).sub(lShoulder).add(_down);
    solveArm(b.upperarm_l, b.lowerarm_l, b.hand_l, grip, lElbow);
  }

  /**
   * Procedural lean on top of the animation: rolls the spine around the body's forward axis,
   * split across the spine bones. Rolling a chain about one shared world axis composes cleanly,
   * so each bone just gets its share expressed in its parent's space.
   */
  #applyLean(lean) {
    this.object.updateMatrixWorld(true);
    const facing = this.object.rotation.y;
    const forward = _axis.set(Math.sin(facing), 0, Math.cos(facing));
    const share = (lean * MAX_LEAN) / LEAN_BONES.length;
    for (const name of LEAN_BONES) {
      const bone = this.bones[name];
      bone.parent.getWorldQuaternion(_qParent).invert();
      const localAxis = forward.clone().applyQuaternion(_qParent);
      bone.quaternion.premultiply(_q.setFromAxisAngle(localAxis, share));
    }
  }

  dispose() {
    this.object.removeFromParent();
    this.mixer.stopAllAction();
    this.object.traverse((o) => { if (o.isMesh) o.material.dispose(); });
  }
}
