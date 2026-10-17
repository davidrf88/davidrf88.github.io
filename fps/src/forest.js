import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_SIZE, heightAt, slopeAt, densityNoise } from './terrain.js';

const ASSET_DIR = 'assets/nature/';

// Kenney Nature Kit (CC0). Heights are target sizes in meters; models are rescaled to fit.
const TREES = [
  { file: 'tree_oak', h: [10, 16] },
  { file: 'tree_oak_dark', h: [10, 16] },
  { file: 'tree_detailed', h: [9, 15] },
  { file: 'tree_detailed_dark', h: [9, 15] },
  { file: 'tree_default', h: [8, 13] },
  { file: 'tree_fat', h: [8, 12] },
  { file: 'tree_tall', h: [12, 18] },
  { file: 'tree_pineTallA_detailed', h: [16, 26] },
  { file: 'tree_pineTallB_detailed', h: [16, 26] },
  { file: 'tree_pineRoundC', h: [10, 16] },
  { file: 'tree_pineDefaultA', h: [10, 16] },
];
const ROCKS = [
  { file: 'rock_largeA', h: [1.5, 3.5] },
  { file: 'rock_largeC', h: [1.5, 3.5] },
  { file: 'rock_tallA', h: [2, 4] },
  { file: 'rock_smallB', h: [0.4, 0.9] },
  { file: 'stump_old', h: [0.6, 1.2] },
  { file: 'stump_roundDetailed', h: [0.5, 1] },
  { file: 'log_large', h: [0.8, 1.2] },
  { file: 'log', h: [0.5, 0.8] },
];
const UNDERGROWTH = [
  { file: 'plant_bush', h: [0.6, 1.2] },
  { file: 'plant_bushLarge', h: [1, 1.8] },
  { file: 'plant_bushDetailed', h: [0.8, 1.4] },
  { file: 'grass', h: [0.3, 0.6] },
  { file: 'grass_large', h: [0.4, 0.8] },
  { file: 'grass_leafs', h: [0.3, 0.6] },
  { file: 'mushroom_redGroup', h: [0.25, 0.45] },
  { file: 'mushroom_tanGroup', h: [0.25, 0.45] },
  { file: 'flower_redA', h: [0.3, 0.5] },
  { file: 'flower_yellowA', h: [0.3, 0.5] },
  { file: 'flower_purpleB', h: [0.3, 0.5] },
];

// Deterministic RNG so the forest looks the same on every load.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1337);
const range = ([a, b]) => a + rand() * (b - a);

/** Bakes a glTF scene into a list of {geometry, material} parts with its base at y=0. */
function toPrototype(gltf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const offset = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(offset);
    // glTF defaults metallicFactor to 1, which renders black without an env map.
    o.material.metalness = 0;
    o.material.roughness = 1;
    parts.push({ geometry, material: o.material });
  });
  const size = box.getSize(new THREE.Vector3());
  // Plain meshes sharing the part geometry, used to raycast exact surfaces of any instance.
  const hitMeshes = parts.map((p) => {
    const m = new THREE.Mesh(p.geometry, HIT_MATERIAL);
    m.matrixAutoUpdate = false;
    return m;
  });
  return {
    parts,
    hitMeshes,
    height: size.y,
    radius: Math.max(size.x, size.z) / 2,
    footprint: Math.hypot(size.x, size.z) / 2, // covers the model at any rotation
  };
}

const HIT_MATERIAL = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const _ray = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
const _hits = [];

/**
 * Uniform-grid spatial hash of obstacles.
 * - trees: { kind: 'tree', x, z, r } — solid trunk circles
 * - rocks/stumps/logs: { kind: 'rock', x, z, r, top, matrix, meshes } — exact surfaces you can
 *   stand on and vault over, queried by raycasting the instance's own geometry.
 */
export class ColliderGrid {
  constructor(cell = 8) {
    this.cell = cell;
    this.map = new Map();
  }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(entry) {
    const k = this.key(Math.floor(entry.x / this.cell), Math.floor(entry.z / this.cell));
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push(entry);
  }
  /** Height of the highest rock surface directly above/below (x, z), or -Infinity. */
  surfaceAt(x, z) {
    let best = -Infinity;
    for (const c of this.near(x, z)) {
      if (c.kind !== 'rock') continue;
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz > c.r * c.r) continue;
      _ray.ray.origin.set(x, c.top + 1, z);
      _ray.ray.direction.copy(_down);
      for (const mesh of c.meshes) {
        mesh.matrixWorld.copy(c.matrix);
        _hits.length = 0;
        mesh.raycast(_ray, _hits);
        for (const h of _hits) if (h.point.y > best) best = h.point.y;
      }
    }
    return best;
  }
  *near(x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.map.get(this.key(cx + dx, cz + dz));
        if (list) yield* list;
      }
    }
  }
}

function buildInstanced(proto, transforms, { castShadow }) {
  const group = new THREE.Group();
  for (const part of proto.parts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, transforms.length);
    transforms.forEach((t, i) => mesh.setMatrixAt(i, t.matrix));
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

export async function createForest(onProgress) {
  const loader = new GLTFLoader();
  const all = [...TREES, ...ROCKS, ...UNDERGROWTH];
  let done = 0;
  const protos = {};
  await Promise.all(all.map(async (def) => {
    const gltf = await loader.loadAsync(`${ASSET_DIR}${def.file}.glb`);
    protos[def.file] = toPrototype(gltf);
    onProgress?.(++done / all.length);
  }));

  const forest = new THREE.Group();
  const colliders = new ColliderGrid();
  const half = WORLD_SIZE / 2 - 10;
  const placements = new Map(); // file -> transforms[]
  const place = (def, x, z, sink = 0) => {
    const proto = protos[def.file];
    const targetH = range(def.h);
    const scale = targetH / proto.height;
    const y = heightAt(x, z) - sink * targetH;
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI * 2),
      new THREE.Vector3().setScalar(scale),
    );
    if (!placements.has(def.file)) placements.set(def.file, []);
    placements.get(def.file).push({ matrix });
    return { scale, proto, y, matrix };
  };
  const addRock = (def, x, z) => {
    const { scale, proto, y, matrix } = place(def, x, z, 0.1);
    colliders.add({
      kind: 'rock', x, z, r: proto.footprint * scale, top: y + proto.height * scale, matrix, meshes: proto.hitMeshes,
    });
  };
  const nearSpawn = (x, z, r) => Math.hypot(x, z) < r;

  // Trees: jittered grid, density modulated by noise to form groves and clearings.
  const treeCell = 7;
  for (let gx = -half; gx < half; gx += treeCell) {
    for (let gz = -half; gz < half; gz += treeCell) {
      const x = gx + rand() * treeCell, z = gz + rand() * treeCell;
      if (nearSpawn(x, z, 14)) continue;
      const density = 0.55 + densityNoise(x, z) * 0.9;
      if (rand() > density || slopeAt(x, z) > 0.7) continue;
      const def = TREES[Math.floor(rand() * TREES.length)];
      const { scale, proto } = place(def, x, z, 0.01);
      // Trunks are thin relative to the canopy; approximate with a fraction of the footprint.
      colliders.add({ kind: 'tree', x, z, r: Math.max(0.35, proto.radius * scale * 0.12) });
    }
  }

  // Rocks, stumps and logs (solid; low ones can be vaulted, and you can stand on them).
  for (let i = 0; i < 700; i++) {
    const x = (rand() * 2 - 1) * half, z = (rand() * 2 - 1) * half;
    if (nearSpawn(x, z, 8)) continue;
    addRock(ROCKS[Math.floor(rand() * ROCKS.length)], x, z);
  }
  // In front of the spawn: two logs to vault over and a boulder to vault up onto.
  const byFile = Object.fromEntries(ROCKS.map((d) => [d.file, d]));
  addRock({ ...byFile.log_large, h: [0.9, 0.9] }, -5, 10);
  addRock({ ...byFile.log_large, h: [0.8, 0.8] }, 3, 14);
  addRock({ ...byFile.rock_largeA, h: [1.6, 1.6] }, -1, 17);

  // Undergrowth: dense, no collisions.
  for (let i = 0; i < 14000; i++) {
    const x = (rand() * 2 - 1) * half, z = (rand() * 2 - 1) * half;
    if (slopeAt(x, z) > 0.8) continue;
    const def = UNDERGROWTH[Math.floor(rand() * UNDERGROWTH.length)];
    place(def, x, z, 0.05);
  }

  const small = new Set(UNDERGROWTH.map((d) => d.file));
  for (const [file, transforms] of placements) {
    const group = buildInstanced(protos[file], transforms, { castShadow: !small.has(file) || file.startsWith('plant_bush') });
    group.userData.solid = !small.has(file); // bullets hit trees/rocks, pass through grass
    forest.add(group);
  }

  return { forest, colliders };
}
