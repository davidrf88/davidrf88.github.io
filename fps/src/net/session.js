import * as THREE from 'three';
import { MSG, TICK_HZ, DAMAGE, MIN_PLAYERS, WIN_DELAY, vec } from './protocol.js';
import { startTicker } from './transport.js';
import { MAX_HP } from '../player.js';

const MIN_FIRE_GAP = 150; // ms; host-side sanity limit on fire rate

const _oc = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Distance along a normalized ray to a sphere, or null. */
function raySphere(origin, dir, center, r) {
  _oc.subVectors(origin, center);
  const b = _oc.dot(dir);
  const disc = b * b - (_oc.lengthSq() - r * r);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t = -b - s >= 0 ? -b - s : -b + s;
  return t >= 0 ? t : null;
}

/** Hitbox: a few spheres along the body, laid out for the player's stance. */
function* hitSpheres(s) {
  const [x, y, z] = s.p;
  if (s.st === 'prone') {
    const fx = Math.sin(s.f), fz = Math.cos(s.f);
    for (const [k, r] of [[-0.6, 0.25], [0, 0.27], [0.55, 0.2]]) yield { c: _c.set(x + fx * k, y + 0.22, z + fz * k), r };
  } else if (s.st === 'crouch') {
    for (const [h, r] of [[0.4, 0.3], [0.8, 0.3], [1.15, 0.16]]) yield { c: _c.set(x, y + h, z), r };
  } else {
    for (const [h, r] of [[0.45, 0.28], [1.0, 0.3], [1.6, 0.16]]) yield { c: _c.set(x, y + h, z), r };
  }
}

/**
 * Traces a shot from `origin` along `dir`, ignoring anything closer than `near`
 * (the camera sits behind the shooter). Returns the first thing hit: a player or the world.
 */
export function traceShot(origin, dir, near, players, traceWorld, maxDist = 150) {
  const world = traceWorld(origin, dir, near, maxDist);
  let best = world ? world.distance : maxDist;
  let targetId = null;
  for (const p of players) {
    if (!p.alive || !p.s) continue;
    for (const { c, r } of hitSpheres(p.s)) {
      const t = raySphere(origin, dir, c, r);
      if (t !== null && t >= near && t < best) { best = t; targetId = p.id; }
    }
  }
  return {
    point: origin.clone().addScaledVector(dir, best),
    normal: targetId ? null : world?.normal ?? null,
    targetId,
  };
}

/**
 * Battle-royale game session over a Transport. The host is authoritative for health, hits,
 * eliminations and the round flow (lobby → match → winner → lobby); every client simulates its
 * own movement and reports it 20×/s.
 *
 * hooks:
 *   name                       local player name
 *   getLocalState()            PlayerState of the local player
 *   traceWorld(o, d, near, far) → { distance, point, normal } | null   (host only)
 *   findSpawns(count, mode)    → [[x, y, z], …]; mode 'lobby' (near the center) or 'match' (far apart)  (host only)
 *   onEvent(type, msg)         game reacts to session events (see protocol.js, plus 'host-left')
 */
export class Session {
  constructor(transport, isHost, hooks) {
    this.transport = transport;
    this.isHost = isHost;
    this.hooks = hooks;
    this.players = new Map(); // id -> { id, name, s, hp, alive, kills, lastFire }
    this.selfId = null;
    this.hostId = null;
    this.phase = 'lobby';
    this.stopTicker = null;
  }

  get roomCode() { return this.transport.roomCode; }
  get aliveCount() { return [...this.players.values()].filter((p) => p.alive).length; }
  get canStart() { return this.isHost && this.phase === 'lobby' && this.players.size >= MIN_PLAYERS; }

  async start(code) {
    const t = this.transport;
    t.on('message', (from, msg) => this.#onMessage(from, msg));
    t.on('peer-leave', (id) => this.#onPeerLeave(id));

    if (this.isHost) {
      await t.host();
      this.selfId = this.hostId = t.selfId;
      this.#addPlayer(this.selfId, this.hooks.name);
    } else {
      await t.join(code);
      t.send(this.#hostPeer(), { t: MSG.HELLO, name: this.hooks.name });
    }
    this.stopTicker = startTicker(TICK_HZ, () => this.#tick());
  }

  stop() {
    this.stopTicker?.();
    this.transport.close();
  }

  /** Local player fired: muzzle position, camera ray origin + direction. */
  fire(muzzle, origin, dir) {
    const msg = { t: MSG.FIRE, o: vec(muzzle), c: vec(origin), d: [dir.x, dir.y, dir.z] };
    if (this.isHost) this.#handleFire(this.selfId, msg);
    else this.transport.send(this.#hostPeer(), msg);
  }

  /** Other players, for local hit visuals. */
  others() {
    return [...this.players.values()].filter((p) => p.id !== this.selfId);
  }

  /** Host: begin a match, scattering everyone as far apart as the map allows. */
  startMatch() {
    if (!this.canStart) return;
    const ids = [...this.players.keys()];
    const points = this.hooks.findSpawns(ids.length, 'match');
    const spawns = Object.fromEntries(ids.map((id, i) => [id, points[i]]));
    this.#emitAll({ t: MSG.START, spawns });
  }

  // --- internals --------------------------------------------------------------

  #hostPeer() {
    return [...this.transport.conns.keys()][0]; // a client has exactly one connection: the host
  }

  #addPlayer(id, name) {
    const p = { id, name, s: null, hp: MAX_HP, alive: true, kills: 0, lastFire: 0 };
    this.players.set(id, p);
    return p;
  }

  #tick() {
    const s = this.hooks.getLocalState();
    if (this.isHost) {
      const self = this.players.get(this.selfId);
      self.s = s;
      this.#emitAll({
        t: MSG.SNAP,
        players: [...this.players.values()].map((p) => ({ id: p.id, s: p.s, hp: p.hp, alive: p.alive })),
      });
    } else if (this.selfId) {
      this.transport.send(this.#hostPeer(), { t: MSG.STATE, s });
    }
  }

  /** Host: send to all clients and apply locally. */
  #emitAll(msg) {
    this.transport.broadcast(msg);
    this.#apply(msg);
  }

  #onMessage(from, msg) {
    if (!this.isHost) { this.#apply(msg); return; }
    switch (msg.t) {
      case MSG.HELLO: {
        const name = String(msg.name || 'Soldier').slice(0, 16);
        const p = this.#addPlayer(from, name);
        // Joining mid-match: spectate until the next round.
        if (this.phase !== 'lobby') { p.alive = false; p.hp = 0; }
        this.transport.send(from, {
          t: MSG.WELCOME,
          id: from,
          hostId: this.selfId,
          phase: this.phase,
          players: [...this.players.values()].map(({ id, name, hp, alive, kills, s }) => ({ id, name, hp, alive, kills, s })),
        });
        this.transport.broadcast({ t: MSG.JOIN, id: from, name }, from);
        this.hooks.onEvent(MSG.JOIN, { id: from, name });
        if (this.phase === 'lobby') this.#emitAll({ t: MSG.TP, id: from, p: this.hooks.findSpawns(1, 'lobby')[0] });
        break;
      }
      case MSG.STATE: {
        const p = this.players.get(from);
        if (p) p.s = msg.s;
        break;
      }
      case MSG.FIRE:
        this.#handleFire(from, msg);
        break;
    }
  }

  #onPeerLeave(id) {
    if (!this.isHost) { this.hooks.onEvent('host-left', {}); return; }
    if (!this.players.delete(id)) return;
    this.#emitAll({ t: MSG.LEAVE, id });
    this.#checkWin();
  }

  /** Host: authoritative shot resolution. Damage only counts during a match. */
  #handleFire(shooterId, msg) {
    const shooter = this.players.get(shooterId);
    const now = performance.now();
    if (!shooter?.alive || now - shooter.lastFire < MIN_FIRE_GAP) return;
    shooter.lastFire = now;

    const origin = new THREE.Vector3(...msg.c);
    const dir = new THREE.Vector3(...msg.d).normalize();
    const muzzle = new THREE.Vector3(...msg.o);
    const near = Math.max(0, muzzle.clone().sub(origin).dot(dir));
    const others = [...this.players.values()].filter((p) => p.id !== shooterId);
    const res = traceShot(origin, dir, near, others, this.hooks.traceWorld);

    this.#emitAll({ t: MSG.SHOT, by: shooterId, o: msg.o, to: vec(res.point), n: res.normal ? vec(res.normal) : null });

    const target = res.targetId && this.players.get(res.targetId);
    if (this.phase !== 'match' || !target?.alive) return;
    target.hp = Math.max(0, target.hp - DAMAGE);
    this.#emitAll({ t: MSG.HIT, target: target.id, by: shooterId, hp: target.hp });
    if (target.hp > 0) return;
    // Place = how many were still alive including the victim (last one standing is #1).
    this.#emitAll({ t: MSG.DEATH, target: target.id, by: shooterId, place: this.aliveCount });
    this.#checkWin();
  }

  /** Host: end the match when at most one player is left standing. */
  #checkWin() {
    if (this.phase !== 'match') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length > 1) return;
    this.#emitAll({ t: MSG.WIN, id: alive[0]?.id ?? null });
    setTimeout(() => {
      const ids = [...this.players.keys()];
      const points = this.hooks.findSpawns(ids.length, 'lobby');
      this.#emitAll({ t: MSG.LOBBY, spawns: Object.fromEntries(ids.map((id, i) => [id, points[i]])) });
    }, WIN_DELAY);
  }

  /** Applies a host message to local state and tells the game. */
  #apply(msg) {
    const players = this.players;
    const reviveAll = () => { for (const p of players.values()) { p.alive = true; p.hp = MAX_HP; } };
    switch (msg.t) {
      case MSG.WELCOME:
        this.selfId = msg.id;
        this.hostId = msg.hostId;
        this.phase = msg.phase;
        for (const p of msg.players) players.set(p.id, { ...p, lastFire: 0 });
        break;
      case MSG.JOIN:
        if (!players.has(msg.id)) this.#addPlayer(msg.id, msg.name);
        break;
      case MSG.LEAVE:
        players.delete(msg.id);
        break;
      case MSG.SNAP:
        for (const u of msg.players) {
          const p = players.get(u.id) ?? this.#addPlayer(u.id, '…');
          if (u.id !== this.selfId || this.isHost) p.s = u.s;
          p.hp = u.hp;
          p.alive = u.alive;
        }
        break;
      case MSG.HIT: {
        const p = players.get(msg.target);
        if (p) p.hp = msg.hp;
        break;
      }
      case MSG.DEATH: {
        const p = players.get(msg.target);
        if (p) { p.alive = false; p.hp = 0; }
        const killer = players.get(msg.by);
        if (killer) killer.kills++;
        break;
      }
      case MSG.START:
        this.phase = 'match';
        reviveAll();
        for (const p of players.values()) p.kills = 0;
        break;
      case MSG.WIN:
        this.phase = 'ended';
        break;
      case MSG.LOBBY:
        this.phase = 'lobby';
        reviveAll();
        break;
    }
    this.hooks.onEvent(msg.t, msg);
  }
}
