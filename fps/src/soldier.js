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
  return { helmet, vest, belt, pistol, muzzle };
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

    this.base = this.#action('Idle_Loop');
    this.base.play();
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
    place(gear.pistol, 'hand_r', wp('hand_r').lerp(wp('middle_01_r'), 0.6).add(new THREE.Vector3(0, -0.01, 0)));

    this.muzzle = gear.muzzle;
    pose.stop();
    this.mixer.update(0);
  }

  fadeTo(name, duration = 0.25, { once = ONCE_CLIPS.has(name), sync = false } = {}) {
    const next = this.#action(name);
    if (next === this.base) return;
    const prev = this.base;
    next.reset();
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

  playShoot() { this.shootAction.reset().play(); }
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

    this.mixer.update(dt);
    if (Math.abs(lean) > 1e-3) this.#applyLean(lean);
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
