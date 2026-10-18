import * as THREE from 'three';
import { createTerrain, heightAt, slopeAt, WORLD_SIZE } from './terrain.js';
import { createForest } from './forest.js';
import { Player, BANDAGE, MAX_HP, DROP } from './player.js';
import { ShotEffects } from './combat.js';
import { traceShot } from './net/session.js';
import { Multiplayer } from './multiplayer.js';
import { showMenu, menuOpen, showHealth, showThrowMenu, setHealth, flashDamage, showOverlay, hideOverlay, alert as showAlert } from './ui.js';
import { Minimap } from './minimap.js';
import { ZoneView } from './zone-view.js';
import { PlaneView, PLANE, flightLine } from './plane.js';
import { Pickups, scatterPickups } from './pickups.js';
import { LOOT, SLOTS, WEAPONS } from './weapons.js';
import { Throwables, THROWABLES, THROW_SLOTS, THROW_RELEASE, throwOrigin, throwVelocity, predictGrenade, fragDamage } from './throwables.js';

const FOG_COLOR = new THREE.Color('#a9c6d6');

// --- Renderer / scene ----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = FOG_COLOR;
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.011);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);

// Gradient sky dome; its horizon matches the fog so distant terrain melts into it.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#4f8fd0') },
      horizon: { value: FOG_COLOR },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
      void main(){ float t = smoothstep(0.0, 0.5, vDir.y); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }`,
  }),
);
scene.add(sky);

// --- Lighting ------------------------------------------------------------
scene.add(new THREE.HemisphereLight('#cfe6ff', '#3d4a2a', 1.1));
const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
const SUN_OFFSET = new THREE.Vector3(40, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// --- World ---------------------------------------------------------------
const loadingEl = document.getElementById('loading');
const terrain = createTerrain();
scene.add(terrain);

const [{ forest, colliders, markers }, player] = await Promise.all([
  createForest((p) => { loadingEl.textContent = `Loading forest… ${Math.round(p * 100)}%`; }),
  Player.load(),
]);
scene.add(forest, player.object);
loadingEl.classList.add('done');

const effects = new ShotEffects(scene);
const minimap = new Minimap(markers);
const planeView = new PlaneView(scene);
const zoneView = new ZoneView(scene, sky.material.uniforms.horizon.value);
// ?zone=fast compresses the blue zone timings (host decides) for quick tests.
const zoneSpeed = new URLSearchParams(location.search).get('zone') === 'fast' ? 6 : 1;
const shootables = [terrain, ...forest.children.filter((g) => g.userData.solid)];
const raycaster = new THREE.Raycaster();
raycaster.far = 300;

/** First world hit (terrain, trees, rocks) along a ray, ignoring the first `near` meters. */
function traceWorld(origin, dir, near = 0, far = 300) {
  raycaster.set(origin, dir);
  raycaster.near = near;
  raycaster.far = far;
  const hit = raycaster.intersectObjects(shootables, true)[0];
  if (!hit) return null;
  const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
  return { distance: hit.distance, point: hit.point, normal };
}

/** True if (x, z) is open ground: not inside a rock, not against a trunk, not a cliff. */
function isClear(x, z) {
  if (Number.isFinite(colliders.surfaceAt(x, z)) || slopeAt(x, z) > 0.6) return false;
  for (const c of colliders.near(x, z)) {
    if (c.kind === 'tree' && Math.hypot(c.x - x, c.z - z) < c.r + 1) return false;
  }
  return true;
}

function randomClearPoint(minR, maxR, square = false) {
  for (let i = 0; i < 100; i++) {
    let x, z;
    if (square) {
      x = (Math.random() * 2 - 1) * maxR;
      z = (Math.random() * 2 - 1) * maxR;
    } else {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    if (isClear(x, z)) return [x, z];
  }
  return [0, 0];
}

const toSpawn = ([x, z]) => [Math.round(x * 100) / 100, Math.round(heightAt(x, z) * 100) / 100, Math.round(z * 100) / 100];

/**
 * Spawn points for `count` players.
 * 'lobby': scattered around the central clearing.
 * 'match': as far apart as possible across the whole map (greedy farthest-point sampling).
 */
function findSpawns(count, mode) {
  if (mode === 'lobby') return Array.from({ length: count }, () => toSpawn(randomClearPoint(6, 30)));
  const reach = WORLD_SIZE / 2 - 35; // stay off the border hills
  const candidates = Array.from({ length: 400 }, () => randomClearPoint(0, reach, true));
  const chosen = [candidates[Math.floor(Math.random() * candidates.length)]];
  while (chosen.length < count) {
    let best = null, bestD = -1;
    for (const c of candidates) {
      const d = Math.min(...chosen.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])));
      if (d > bestD) { bestD = d; best = c; }
    }
    chosen.push(best);
  }
  return chosen.sort(() => Math.random() - 0.5).map(toSpawn);
}

/**
 * Guns to scatter. 'lobby': a few around the camp to try out; 'match': loot across the map;
 * 'solo': both.
 */
const CAMP_GUNS = [
  [5, 3, 'smg'], [-6, 6, 'smg'],
  [0, 3, 'rifle'], [-2.5, 3, 'sniper'], [2.5, 3, 'smoke'], [3.5, 2, 'smoke'], [7, -4, 'rifle'], [-8, 3, 'sniper'],
  [2, -9, 'rifle'], [-3, 8, 'rifle'], [-6, -6, 'smoke'], [9, 5, 'smoke'], [-1, 4.5, 'frag'], [1, 4.5, 'frag'], [-9, -2, 'frag'],
  [-4, 1.5, 'bluezone'], [6, 7, 'bluezone'], [1.5, -2, 'bandage'], [-1.5, -2.5, 'bandage'], [8, -8, 'bandage'],
];
function makePickups(mode) {
  if (mode === 'lobby') return scatterPickups({}, randomClearPoint, heightAt, { near: CAMP_GUNS });
  const loot = { maxR: WORLD_SIZE / 2 - 30, near: mode === 'solo' ? CAMP_GUNS : [] };
  return scatterPickups(LOOT, randomClearPoint, heightAt, loot);
}
const pickups = new Pickups(scene);
const throwables = new Throwables(scene, colliders);
let shake = 0;
/** Frag went off (on every client): boom, flash, shake; in solo it can hurt you. */
throwables.onExplode = (pos) => {
  const dist = camera.position.distanceTo(pos);
  effects.explode(pos, dist);
  shake = Math.max(shake, 0.6 * Math.max(0, 1 - dist / 30));
  if (!mp && player.alive) soloBlast(pos);
};
function soloBlast(pos) {
  const center = pos.clone().setY(pos.y + 0.3);
  const target = player.position.clone().setY(player.position.y + 0.9);
  const dist = center.distanceTo(target);
  const dmg = fragDamage(dist);
  if (dmg <= 0) return;
  const hit = traceWorld(center, target.clone().sub(center).normalize(), 0, dist);
  if (hit && hit.distance < dist - 0.3) return;
  player.hp = Math.max(0, player.hp - dmg);
  setHealth(player.hp);
  flashDamage(true);
  if (player.hp > 0) return;
  player.die();
  showOverlay('Killed by your own frag');
  setTimeout(() => { hideOverlay(); player.respawn(0, heightAt(0, 0), 0); setHealth(player.hp); }, 3000);
}
const predictFrag = (o, v, fuse) => predictGrenade(o, v, fuse, colliders);

// Blue zone grenades: tint the screen while you're in a dome; in solo they hurt (the host does it in multiplayer).
const zoneTintEl = document.getElementById('zone-tint');
let bzPulse = 0;
function updateBlueZoneGrenades(dt, viewer) {
  const chest = viewer.clone().setY(viewer.y + 1);
  if (throwables.inBlueZone(chest)) zoneTintEl.style.opacity = Math.max(Number(zoneTintEl.style.opacity) || 0, 0.55);
  if (mp || !player.alive) return;
  const { pulse, dps } = THROWABLES.bluezone;
  if (!throwables.inBlueZone(player.position.clone().setY(player.position.y + 1))) { bzPulse = 0; return; }
  bzPulse += dt;
  if (bzPulse < pulse) return;
  bzPulse -= pulse;
  player.hp = Math.max(0, player.hp - dps * pulse);
  setHealth(player.hp);
  if (player.hp > 0) return;
  player.die();
  showOverlay('Caught in your own blue zone grenade');
  setTimeout(() => { hideOverlay(); player.respawn(0, heightAt(0, 0), 0); setHealth(player.hp); }, 3000);
}
pickups.set(makePickups('solo'));

/** Set once the player hosts or joins; null in solo play. */
let mp = null;

// --- Input ---------------------------------------------------------------
const keys = new Set();
const mouse = { aim: false, fire: false };
const crosshairEl = document.getElementById('crosshair');
const ammoEl = document.getElementById('ammo');

const isAlt = (e) => e.code === 'AltLeft' || e.code === 'AltRight';
addEventListener('keydown', (e) => {
  if (menuOpen() || e.target instanceof HTMLInputElement) return; // let the menu fields type
  // Swallow browser shortcuts the game uses: Alt alone focuses the menu, Alt+arrows
  // navigate back/forward, Space/arrows scroll. Ctrl/Meta combos are left alone.
  const gameKey = e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow') || isAlt(e);
  if ((gameKey || e.altKey) && !e.ctrlKey && !e.metaKey) e.preventDefault();
  if (e.repeat) return;
  // Plane drop: Space / F jumps out; Space in free fall opens the parachute.
  if (player.alive && player.airMode === 'plane' && (e.code === 'Space' || e.code === 'KeyF')) { jumpOut(); return; }
  if (player.alive && player.airMode === 'fall' && e.code === 'Space') { player.openChute(colliders); return; }
  if (e.code === 'Escape') { cancelThrow(); if (player.cancelBandage()) showAlert('Bandage cancelled'); }
  if (e.code === 'KeyH') useBandage();
  keys.add(e.code);
  if (e.code === 'KeyC') player.setStance(player.stance === 'crouch' ? 'stand' : 'crouch');
  if (e.code === 'KeyZ') player.setStance(player.stance === 'prone' ? 'stand' : 'prone');
  if (e.code === 'KeyR') { if (player.holdingThrowable) player.startCook(); else player.reload(); } // R with a frag: cook it
  if (e.code === 'KeyF') { if (player.alive) tryPickup(); else setFreeCam(!freeCam.on); }
  if (e.code === 'KeyG') showThrowMenu(THROW_SLOTS, player.throwables, player.cycleThrowable());
  // Number keys pick from the guns you own, in order (1 = first gun), also putting a grenade away.
  const slot = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (slot >= 0 && ownedGuns()[slot]) player.equip(ownedGuns()[slot]);
  if (e.code === 'Enter') mp?.startMatch(); // host only; ignored otherwise
  if (e.code === 'KeyM') minimap.toggleBig();
});
addEventListener('keyup', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (isAlt(e) || e.altKey) e.preventDefault();
  keys.delete(e.code);
});
addEventListener('blur', () => { keys.clear(); mouse.aim = mouse.fire = false; });
// Esc while the mouse is locked only releases the lock (the page may not see the key), so a lost
// lock cancels a throw too.
document.addEventListener('pointerlockchange', () => { if (!locked()) cancelThrow(); });

const cam = { yaw: Math.PI, pitch: 0.25, dist: 4.5, zoom: 0 };
// Free look (hold Alt): the camera orbits on its own while the body keeps this heading.
const look = { active: false, returning: false, yaw: 0, pitch: 0 };
const canvas = renderer.domElement;
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (menuOpen()) return;
  if (!locked()) { canvas.requestPointerLock?.()?.catch?.(() => {}); return; }
  if (!player.alive) { // out: click follows / switches who you watch
    if (e.button === 0) { setFreeCam(false); mp?.nextSpectate(); }
    return;
  }
  if (e.button === 0) mouse.fire = mouse.firePressed = true;
  if (e.button === 2) mouse.aim = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0 && throwReady) releaseThrow();
  if (e.button === 0) mouse.fire = false;
  if (e.button === 2) mouse.aim = false;
});
addEventListener('mousemove', (e) => {
  if (!locked()) return;
  const sens = player.scoped ? 0.0016 * (scopeFov / 48) : player.aiming ? 0.0016 : 0.0025;
  cam.yaw -= e.movementX * sens;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + e.movementY * sens, freeCam.on ? -1.45 : -0.7, freeCam.on ? 1.45 : 1.2);
  // While the camera eases back, mouse input steers the heading it returns to.
  if (look.returning) {
    look.yaw -= e.movementX * sens;
    look.pitch = THREE.MathUtils.clamp(look.pitch + e.movementY * sens, -0.7, 1.2);
  }
});

// Sniper scope zoom: the wheel steps between the scope's max magnification (narrowest view) and
// half of it. Kept between scopings.
let scopeFov = 9;
const scopeZoomEl = document.getElementById('scope-zoom');
const magnification = (fov) => Math.tan(THREE.MathUtils.degToRad(30)) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
addEventListener('wheel', (e) => {
  if (!player.scoped) return;
  const gun = player.gun;
  const step = Math.pow(gun.scopeMin / gun.scope, 1 / 4); // 4 wheel notches from max to min
  scopeFov = THREE.MathUtils.clamp(scopeFov * (e.deltaY > 0 ? step : 1 / step), gun.scope, gun.scopeMin);
}, { passive: true });

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Loop ----------------------------------------------------------------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const right = new THREE.Vector3();
let jumpHeld = false;

const NO_INPUT = { forward: 0, right: 0, sprint: false, jump: false, aim: false, lean: 0 };

function readInput() {
  if (menuOpen() || !player.alive) return NO_INPUT;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const space = keys.has('Space');
  const jump = space && !jumpHeld; // edge-triggered
  jumpHeld = space;
  const lean = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  return { forward: f, right: r, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), jump, aim: mouse.aim, lean };
}

// --- Drop plane: ride it, jump out where you like (forced at the end), fall, parachute, land ---
const dropHintEl = document.getElementById('drop-hint');
let plane = null; // current plane state (planeAt) during the flight, else null

function updatePlane(dt) {
  const flight = mp?.flight ?? null;
  plane = planeView.update(flight, dt);
  if (player.alive && player.airMode === 'plane') {
    if (!plane) jumpOut(); // no flight info (e.g. after a reconnect late in the drop): just drop
    else {
      player.position.copy(plane.pos);
      if (plane.forceJump) jumpOut();
    }
  }
  updateDropHint();
}

function jumpOut() {
  if (plane && !plane.canJump && !plane.forceJump) return; // not over the map yet
  const dir = plane?.dir ?? new THREE.Vector3(0, 0, 1);
  if (!player.jumpFromPlane(dir, PLANE.speed)) return;
  player.position.y -= 3; // out of the cargo door, below the fuselage
}

function updateDropHint() {
  const mode = player.alive ? player.airMode : null;
  let text = '';
  if (mode === 'plane' && plane) {
    text = plane.canJump
      ? `<b>Space</b> / <b>F</b> Jump · auto-jump in ${Math.ceil(plane.timeLeft)} s`
      : `Over the map in ${Math.ceil(plane.timeToJump)} s — pick your landing spot (M: map)`;
  } else if (mode === 'fall') {
    text = `<b>W</b> dive faster · <b>Space</b> open parachute (opens itself at ${DROP.chuteAt} m)`;
  } else if (mode === 'chute') {
    text = '<b>WASD</b> steer · <b>W</b> faster';
  }
  dropHintEl.hidden = !text;
  if (text) dropHintEl.innerHTML = text;
}

// --- Free spectator camera: eliminated players fly around (F toggles; click goes back to following) ---
const freeCam = { on: false, pos: new THREE.Vector3() };
const FLY_SPEED = 12, FLY_FAST = 32;
const _fly = new THREE.Vector3(), _flyRight = new THREE.Vector3();

function setFreeCam(on) {
  on = on && !player.alive && !!mp;
  if (on === freeCam.on) return;
  freeCam.on = on;
  if (on) {
    freeCam.pos.copy(camera.position);
    cam.pitch = THREE.MathUtils.clamp(cam.pitch, -1.45, 1.45);
  } else {
    cam.pitch = THREE.MathUtils.clamp(cam.pitch, -0.7, 1.2);
  }
  mp?.setFreeCam(on);
}

/** Flies the camera: W/S along the view, A/D sideways, Space/C up/down, Shift faster. A ghost: no collisions. */
function updateFreeCam(dt) {
  const cp = Math.cos(cam.pitch);
  const look = _fly.set(-Math.sin(cam.yaw) * cp, -Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
  _flyRight.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  if (!menuOpen() && !minimap.bigOpen) {
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const u = (keys.has('Space') ? 1 : 0) - (keys.has('KeyC') || keys.has('ControlLeft') ? 1 : 0);
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? FLY_FAST : FLY_SPEED) * dt;
    freeCam.pos.addScaledVector(look, f * speed).addScaledVector(_flyRight, r * speed);
    freeCam.pos.y += u * speed;
  }
  // Stay over the map, above the ground (and rocks), below the clouds.
  const half = WORLD_SIZE / 2 - 2;
  freeCam.pos.x = THREE.MathUtils.clamp(freeCam.pos.x, -half, half);
  freeCam.pos.z = THREE.MathUtils.clamp(freeCam.pos.z, -half, half);
  const floor = Math.max(heightAt(freeCam.pos.x, freeCam.pos.z), colliders.surfaceAt(freeCam.pos.x, freeCam.pos.z)) + 0.4;
  freeCam.pos.y = THREE.MathUtils.clamp(freeCam.pos.y, floor, 140);
  camera.fov = 65;
  camera.updateProjectionMatrix();
  camera.position.copy(freeCam.pos);
  camera.lookAt(freeCam.pos.x + look.x, freeCam.pos.y + look.y, freeCam.pos.z + look.z);
}

function updateCamera(dt) {
  if (freeCam.on && player.alive) setFreeCam(false); // back in the game (new round)
  if (freeCam.on) { updateFreeCam(dt); return; }
  // Over-the-shoulder: zoom in while aiming, lower the pivot when crouched/prone.
  cam.zoom = THREE.MathUtils.damp(cam.zoom, player.aiming ? 1 : 0, 10, dt);
  // Further out while riding the plane (it's big) and while dropping (to see where you'll land).
  const airDist = player.alive ? { plane: 32, fall: 7, chute: 8 }[player.airMode] ?? 0 : 0;
  cam.air = THREE.MathUtils.damp(cam.air ?? 0, airDist, 3, dt);
  const dist = Math.max(THREE.MathUtils.lerp(cam.dist, 2.7, cam.zoom), cam.air);
  // Leaning slides the camera out with the upper body; leaning left swaps to the left shoulder.
  const baseShoulder = THREE.MathUtils.lerp(0.45, 0.75, cam.zoom);
  const shoulder = player.airMode ? 0 : baseShoulder * (1 - 2 * Math.max(0, -player.lean)) + player.lean * 0.45;
  camera.fov = THREE.MathUtils.lerp(60, 48, cam.zoom);
  camera.updateProjectionMatrix();

  right.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  // Eliminated players spectate someone still in the match.
  const watched = mp?.spectateTarget();
  const p = watched ? watched.position : player.position;
  const eye = watched ? 1.55 : player.viewHeight;
  desiredTarget.set(p.x, p.y + eye, p.z).addScaledVector(right, shoulder);
  camTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 14));

  const cp = Math.cos(cam.pitch);
  camPos.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp)
    .multiplyScalar(dist)
    .add(camTarget);
  // Keep the camera above terrain and rocks.
  camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + 0.3, colliders.surfaceAt(camPos.x, camPos.z) + 0.3);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  camera.rotateZ(-player.lean * 0.08); // slight roll sells the lean
  // Explosion shake.
  if (shake > 0.001) {
    camera.position.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake));
    shake *= Math.exp(-dt * 8);
  }

  // Scope: first-person from the eye, narrow field of view, body hidden.
  const scoped = player.scoped && !watched;
  player.soldier.scoped = scoped;
  document.body.classList.toggle('scoped', scoped);
  if (scoped) {
    const eyePos = desiredTarget.set(p.x, p.y + player.viewHeight, p.z).addScaledVector(right, player.lean * 0.45);
    camera.position.copy(eyePos);
    camera.lookAt(eyePos.x - Math.sin(cam.yaw) * cp, eyePos.y - Math.sin(cam.pitch), eyePos.z - Math.cos(cam.yaw) * cp);
    camera.rotateZ(-player.lean * 0.08);
    camera.fov = scopeFov = THREE.MathUtils.clamp(scopeFov, player.gun.scope, player.gun.scopeMin ?? player.gun.scope);
    camera.updateProjectionMatrix();
    scopeZoomEl.textContent = `${magnification(scopeFov).toFixed(1)}×`;
  }
}

function updateFreeLook(dt) {
  const want = (keys.has('AltLeft') || keys.has('AltRight')) && !mouse.aim;
  if (want && !look.active) {
    Object.assign(look, { active: true, returning: false, yaw: cam.yaw, pitch: cam.pitch });
  } else if (!want && look.active) {
    look.active = false;
    look.returning = true;
  }
  if (look.returning) {
    const dYaw = Math.atan2(Math.sin(look.yaw - cam.yaw), Math.cos(look.yaw - cam.yaw));
    const k = 1 - Math.exp(-dt * 12);
    cam.yaw += dYaw * k;
    cam.pitch += (look.pitch - cam.pitch) * k;
    if (Math.abs(dYaw) < 0.01 && Math.abs(look.pitch - cam.pitch) < 0.01) {
      cam.yaw = look.yaw;
      cam.pitch = look.pitch;
      look.returning = false;
    }
  }
  // The body follows the locked heading while free-looking or easing back.
  return look.active || look.returning ? look : cam;
}

const muzzle = new THREE.Vector3();
const aimRay = new THREE.Raycaster();
/** Guns you carry, in slot order (rifle, sniper, pistol); number keys index into this. */
const ownedGuns = () => SLOTS.filter((w) => player.has(w));

function tryPickup() {
  if (menuOpen() || !player.alive || player.airMode) return;
  const item = pickups.nearest(player.position);
  if (!item) return;
  if (!player.canTake(item.type)) return;
  if (mp) { mp.pickup(item.id); return; } // the host decides who gets it
  pickups.remove(item.id);
  player.pickUp(item.type);
}

// --- Grenades: hold LMB to ready (shows the arc), release to throw; RMB held = underhand toss ---
let throwReady = false;
const _to = new THREE.Vector3(), _tv = new THREE.Vector3();
const throwMode = () => (mouse.aim ? 'under' : 'over');
const round2v = (v) => v.set(Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100);

const cookEl = document.getElementById('cook');

function updateThrow() {
  // Cooked too long: it goes off in your hand.
  if (player.cooking && player.fuseLeft <= 0) {
    const type = player.weapon;
    if (player.consumeThrowable()) {
      const o = round2v(player.position.clone().setY(player.position.y + 1.2));
      throwables.spawn(type, o, new THREE.Vector3(), { fuse: 0, by: mp?.selfId });
      mp?.throwGrenade(type, o, new THREE.Vector3(), 0);
    }
  }
  cookEl.hidden = !player.cooking;
  if (player.cooking) cookEl.textContent = player.fuseLeft.toFixed(1);
  throwReady = player.holdingThrowable && !player.applyingBandage && !player.airMode && mouse.fire && player.alive && !menuOpen() && !look.active && player.throwCooldown <= 0;
  if (!throwReady) { throwables.preview(null); return; }
  throwables.preview(throwOrigin(player.position, cam.yaw, _to), throwVelocity(cam.yaw, cam.pitch, throwMode(), _tv));
}

// --- Bandages (H): 5 s to apply, then one health segment heals over 5 s ---
const bandageEl = document.getElementById('bandage');
const medsEl = document.getElementById('meds');
const healthEl = document.getElementById('health');
let healingUntil = 0;      // for the health bar glow
let soloHeal = null;       // { left, next } healing in solo play (the host does it in multiplayer)

function useBandage() {
  if (menuOpen() || !player.alive) return;
  if (player.cancelBandage()) { showAlert('Bandage cancelled'); return; }
  if (player.bandages <= 0) showAlert('No bandages');
  else if (player.hp >= MAX_HP) showAlert('Already at full health');
  else if (player.startBandage()) { throwReady = false; throwables.preview(null); }
}

player.onBandaged = () => {
  healingUntil = performance.now() + (BANDAGE.healTime + 0.6) * 1000;
  if (mp) mp.bandage();
  else soloHeal = { left: BANDAGE.heal, next: performance.now() + 500 };
};

function updateBandage() {
  bandageEl.hidden = !player.applyingBandage;
  if (player.applyingBandage) {
    bandageEl.querySelector('i').style.width = `${(player.bandageProgress * 100).toFixed(1)}%`;
    bandageEl.querySelector('span').textContent = `Applying bandage… ${Math.max(0, BANDAGE.apply * (1 - player.bandageProgress)).toFixed(1)} s`;
  }
  medsEl.hidden = player.bandages <= 0;
  medsEl.innerHTML = `<b>H</b> Bandage × ${player.bandages}`;
  healthEl.classList.toggle('healing', performance.now() < healingUntil && player.alive && player.hp < MAX_HP);
  // Solo healing ticks (same steps as the host's).
  const now = performance.now();
  while (soloHeal && soloHeal.next <= now) {
    const amt = Math.min(BANDAGE.heal / (BANDAGE.healTime * 2), soloHeal.left);
    soloHeal.left -= amt;
    soloHeal.next += 500;
    if (player.alive) { player.hp = Math.min(MAX_HP, player.hp + amt); setHealth(player.hp); }
    if (soloHeal.left <= 0 || player.hp >= MAX_HP || !player.alive) soloHeal = null;
  }
}

/** Esc: stop a throw you've readied (and put the pin back in a cooked frag). You keep the grenade. */
function cancelThrow() {
  if (!throwReady && !player.cooking) return;
  throwReady = false;
  mouse.fire = mouse.firePressed = false; // the release that follows must not throw
  throwables.preview(null);
  player.uncook();
  showAlert('Throw cancelled');
}

function releaseThrow() {
  throwReady = false;
  mouse.firePressed = false; // don't let the click carry over into a pistol shot
  throwables.preview(null);
  const type = player.weapon, mode = throwMode();
  // Uncooked frags (and smoke) start their fuse at the throw; cooked ones keep counting down.
  const fuse = player.cooking ? player.fuseLeft - THROW_RELEASE : THROWABLES[type].fuse;
  if (!player.consumeThrowable()) return;
  // Leaves the hand as the arm comes forward; aim is read then (rounded so every client simulates the same throw).
  setTimeout(() => {
    if (!player.alive) return;
    const o = round2v(throwOrigin(player.position, cam.yaw, new THREE.Vector3()));
    const v = round2v(throwVelocity(cam.yaw, cam.pitch, mode, new THREE.Vector3()));
    throwables.spawn(type, o, v, { fuse: Math.max(0.05, Math.round(fuse * 100) / 100), by: mp?.selfId });
    mp?.throwGrenade(type, o, v, Math.max(0.05, fuse));
    player.soldier.grenadeInHand = false;
    setTimeout(() => { player.soldier.grenadeInHand = true; }, 600);
  }, THROW_RELEASE * 1000);
}

/** Random direction within `angle` radians of `dir` (weapon spread). */
const _u = new THREE.Vector3(), _v = new THREE.Vector3();
function jitter(dir, angle) {
  if (angle <= 0) return dir;
  _u.crossVectors(dir, Math.abs(dir.y) < 0.99 ? THREE.Object3D.DEFAULT_UP : _v.set(1, 0, 0)).normalize();
  _v.crossVectors(dir, _u);
  const r = angle * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
  return dir.addScaledVector(_u, Math.cos(a) * r).addScaledVector(_v, Math.sin(a) * r).normalize();
}

function fire() {
  if (menuOpen() || look.active || look.returning) return; // crosshair isn't where the gun points
  const gun = player.gun;
  if (!gun.auto && !mouse.firePressed) return; // semi-auto: one shot per click
  const spread = player.spread;
  if (!player.tryShoot()) return;
  mouse.firePressed = false;
  // Recoil: kick the view up (and a little sideways).
  cam.pitch -= gun.recoil * (player.aiming ? 0.7 : 1);
  cam.yaw += (Math.random() - 0.5) * gun.recoil * 0.6;
  // Aim through the screen center (ignoring what's between the camera and the gun), then draw
  // the tracer from the gun to whatever is hit. In multiplayer the host makes the final call.
  aimRay.setFromCamera({ x: 0, y: 0 }, camera);
  const { origin } = aimRay.ray;
  const direction = jitter(aimRay.ray.direction, spread);
  player.getMuzzlePosition(muzzle);
  const near = Math.max(0, muzzle.clone().sub(origin).dot(direction));
  const res = traceShot(origin, direction, near, mp ? mp.targets() : [], traceWorld);
  effects.shoot(muzzle.clone(), res.point, res.normal);
  mp?.fire(muzzle, origin, direction, player.weapon);
}

function updateMap() {
  // Follow whoever the camera follows. Headings are clockwise from north (-z).
  const watched = mp?.spectateTarget();
  const zone = mp?.zone ?? null;
  const route = mp?.flight && plane && !plane.gone ? { line: flightLine(mp.flight.flight), at: [plane.pos.x, plane.pos.z] } : null;
  if (freeCam.on) {
    minimap.update(camera.position, -cam.yaw, zone, route);
    return { viewer: camera.position, zone };
  }
  if (watched) minimap.update(watched.position, Math.PI - watched.rotation.y, zone, route);
  else minimap.update(player.position, -cam.yaw, zone, route); // where the camera looks
  return { viewer: watched ? watched.position : player.position, zone };
}

// --- Inventory (hold Tab): guns with ammo, plus grenades and bandages ---
const inventoryEl = document.getElementById('inventory');
const FIRE_MODE = (w) => (w.scope ? 'Bolt · scope' : w.auto ? 'Full auto' : 'Semi-auto');
function updateInventory() {
  const open = keys.has('Tab') && !menuOpen() && player.alive;
  inventoryEl.hidden = !open;
  if (!open) return;
  const guns = ownedGuns().map((w, i) => {
    const gun = WEAPONS[w], slot = player.weapons[w];
    const held = w === (player.holdingThrowable ? null : player.weapon);
    const reserve = slot.reserve === Infinity ? '∞' : slot.reserve;
    const reloading = held && player.reloading;
    return `<div class="gun${held ? ' on' : ''}${slot.ammo === 0 ? ' empty' : ''}">
      <kbd>${i + 1}</kbd><b>${gun.name}</b><small>${FIRE_MODE(gun)}</small>
      <span class="ammo">${reloading ? 'Reloading…' : `${slot.ammo}<i> / ${reserve}</i>`}</span></div>`;
  }).join('');
  const items = [
    ...THROW_SLOTS.map((s) => `<span class="${player.weapon === s.type ? 'on' : ''}${player.throwables[s.type] ? '' : ' none'}">${THROWABLES[s.type].name} × ${player.throwables[s.type]}</span>`),
    `<span class="${player.bandages ? '' : 'none'}">Bandage × ${player.bandages}</span>`,
  ].join('');
  inventoryEl.innerHTML = `<div class="guns">${guns}</div><div class="items"><kbd>G</kbd>${items.replace(/(<span[^>]*>Bandage)/, '<kbd>H</kbd>$1')}</div>`;
}

function updateHud() {
  updateInventory();
  crosshairEl.classList.toggle('on', player.aiming);
  if (player.holdingThrowable) {
    const t = THROWABLES[player.weapon];
    const cookHint = t.cook ? (player.cooking ? ' · <b>pin pulled!</b>' : ' · R cook') : '';
    const back = player.cooking ? '' : ` · ${ownedGuns().map((w, i) => `${i + 1} ${WEAPONS[w].name}`).join(' · ')}`;
    ammoEl.innerHTML = `<small>${t.name} grenade · hold LMB, release to throw · +RMB underhand${cookHint}${back}</small>× ${player.throwables[player.weapon]}`;
    return;
  }
  const reserve = player.reserve === Infinity ? '∞' : player.reserve;
  const owned = ownedGuns().map((w, i) => `${i + 1} ${w === player.weapon ? `<b>${WEAPONS[w].name}</b>` : WEAPONS[w].name}`);
  ammoEl.innerHTML = `<small>${owned.length > 1 ? owned.join(' · ') : player.gun.name}</small>`
    + (player.reloading ? 'Reloading…'
      : player.ammo === 0 ? `<span class="empty">0 / ${reserve}${player.reserve > 0 ? ' · R reload' : ' · no ammo'}</span>`
        : `${player.ammo} / ${reserve}`);
}

camTarget.copy(player.position).y += player.viewHeight;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlane(dt);
  player.update(dt, readInput(), updateFreeLook(dt), colliders);
  updateCamera(dt);
  if (mouse.fire) fire();
  mp?.update(dt);
  effects.update(dt);
  pickups.update(dt, player.position, player.alive && !menuOpen());
  throwables.update(dt);
  updateThrow();
  updateBandage();
  updateHud();
  const { viewer, zone } = updateMap();
  zoneView.update(zone, viewer, dt);
  if (player.scoped) scene.fog.density *= 0.35; // optics see through the haze
  // High up (plane, free fall) the haze thins out so you can pick a landing spot from the sky.
  const altitude = camera.position.y - heightAt(camera.position.x, camera.position.z);
  scene.fog.density *= THREE.MathUtils.lerp(1, 0.25, THREE.MathUtils.smoothstep(altitude, 15, 80));
  updateBlueZoneGrenades(dt, viewer);

  // Keep the shadow frustum centered on the player.
  sun.target.position.copy(player.position);
  sun.position.copy(player.position).add(SUN_OFFSET);
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
});

// --- Start menu: solo, host or join --------------------------------------
// Your uniform color (saved in this browser); the menu previews changes on your soldier.
showMenu(async (choice) => {
  if (choice.mode === 'solo') { showHealth(true); return; }
  const next = new Multiplayer({ scene, camera, player, effects, traceWorld, findSpawns, zoneSpeed, pickups, makePickups, throwables, predictGrenade: predictFrag });
  await next.start(choice); // throws (shown in the menu) if the room can't be reached
  mp = next;
}, { onColor: (hex) => player.soldier.setColor(hex) });
