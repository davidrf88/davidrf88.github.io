import * as THREE from 'three';
import { createTerrain, heightAt, slopeAt, WORLD_SIZE } from './terrain.js';
import { createForest } from './forest.js';
import { Player } from './player.js';
import { ShotEffects } from './combat.js';
import { traceShot } from './net/session.js';
import { Multiplayer } from './multiplayer.js';
import { showMenu, menuOpen } from './ui.js';

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

const [{ forest, colliders }, player] = await Promise.all([
  createForest((p) => { loadingEl.textContent = `Loading forest… ${Math.round(p * 100)}%`; }),
  Player.load(),
]);
scene.add(forest, player.object);
loadingEl.classList.add('done');

const effects = new ShotEffects(scene);
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
  const reach = WORLD_SIZE / 2 - 30;
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
  const gameKey = e.code === 'Space' || e.code.startsWith('Arrow') || isAlt(e);
  if ((gameKey || e.altKey) && !e.ctrlKey && !e.metaKey) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyC') player.setStance(player.stance === 'crouch' ? 'stand' : 'crouch');
  if (e.code === 'KeyZ') player.setStance(player.stance === 'prone' ? 'stand' : 'prone');
  if (e.code === 'KeyR') player.reload();
  if (e.code === 'Enter') mp?.startMatch(); // host only; ignored otherwise
});
addEventListener('keyup', (e) => {
  if (isAlt(e) || e.altKey) e.preventDefault();
  keys.delete(e.code);
});
addEventListener('blur', () => { keys.clear(); mouse.aim = mouse.fire = false; });

const cam = { yaw: Math.PI, pitch: 0.25, dist: 4.5, zoom: 0 };
// Free look (hold Alt): the camera orbits on its own while the body keeps this heading.
const look = { active: false, returning: false, yaw: 0, pitch: 0 };
const canvas = renderer.domElement;
const locked = () => document.pointerLockElement === canvas;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (menuOpen()) return;
  if (!locked()) { canvas.requestPointerLock?.(); return; }
  if (!player.alive) { if (e.button === 0) mp?.nextSpectate(); return; } // out: click switches who you watch
  if (e.button === 0) mouse.fire = true;
  if (e.button === 2) mouse.aim = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.fire = false;
  if (e.button === 2) mouse.aim = false;
});
addEventListener('mousemove', (e) => {
  if (!locked()) return;
  const sens = player.aiming ? 0.0016 : 0.0025;
  cam.yaw -= e.movementX * sens;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + e.movementY * sens, -0.7, 1.2);
  // While the camera eases back, mouse input steers the heading it returns to.
  if (look.returning) {
    look.yaw -= e.movementX * sens;
    look.pitch = THREE.MathUtils.clamp(look.pitch + e.movementY * sens, -0.7, 1.2);
  }
});
addEventListener('wheel', (e) => {
  cam.dist = THREE.MathUtils.clamp(cam.dist + Math.sign(e.deltaY) * 0.5, 2, 12);
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

function updateCamera(dt) {
  // Over-the-shoulder: zoom in while aiming, lower the pivot when crouched/prone.
  cam.zoom = THREE.MathUtils.damp(cam.zoom, player.aiming ? 1 : 0, 10, dt);
  const dist = THREE.MathUtils.lerp(cam.dist, 2.7, cam.zoom);
  // Leaning slides the camera out with the upper body; leaning left swaps to the left shoulder.
  const baseShoulder = THREE.MathUtils.lerp(0.45, 0.75, cam.zoom);
  const shoulder = baseShoulder * (1 - 2 * Math.max(0, -player.lean)) + player.lean * 0.45;
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
function fire() {
  if (menuOpen() || look.active || look.returning) return; // crosshair isn't where the gun points
  if (!player.tryShoot()) return;
  // Aim through the screen center (ignoring what's between the camera and the gun), then draw
  // the tracer from the gun to whatever is hit. In multiplayer the host makes the final call.
  aimRay.setFromCamera({ x: 0, y: 0 }, camera);
  const { origin, direction } = aimRay.ray;
  player.getMuzzlePosition(muzzle);
  const near = Math.max(0, muzzle.clone().sub(origin).dot(direction));
  const res = traceShot(origin, direction, near, mp ? mp.targets() : [], traceWorld);
  effects.shoot(muzzle.clone(), res.point, res.normal);
  mp?.fire(muzzle, origin, direction);
}

function updateHud() {
  crosshairEl.classList.toggle('on', player.aiming);
  ammoEl.textContent = player.reloading ? 'Reloading…' : `${player.ammo} / ${player.magSize}`;
}

camTarget.copy(player.position).y += player.viewHeight;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt, readInput(), updateFreeLook(dt), colliders);
  updateCamera(dt);
  if (mouse.fire) fire();
  mp?.update(dt);
  effects.update(dt);
  updateHud();

  // Keep the shadow frustum centered on the player.
  sun.target.position.copy(player.position);
  sun.position.copy(player.position).add(SUN_OFFSET);
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
});

// --- Start menu: solo, host or join --------------------------------------
showMenu(async (choice) => {
  if (choice.mode === 'solo') return;
  const next = new Multiplayer({ scene, player, effects, traceWorld, findSpawns });
  await next.start(choice); // throws (shown in the menu) if the room can't be reached
  mp = next;
});
