import * as THREE from 'three';
import { MSG, TICK_HZ, MIN_PLAYERS, WIN_DELAY, vec } from './protocol.js';
import { startTicker } from './transport.js';
import { MAX_HP, BANDAGE } from '../player.js';
import { makeZonePlan, zoneAt, outsideBy, ZONE_RAMP, ZONE_RAMP_MAX } from '../zone.js';
import { PICKUP_RANGE, WEAPONS } from '../weapons.js';
import { sanitizeColor, assignColor } from '../colors.js';
import { makeFlight } from '../plane.js';
import { fragDamage, THROWABLES, domeRadius, inDome } from '../throwables.js';

// A dropped player keeps their slot (and their body in the world) this long, waiting to reconnect.
const AWAY_GRACE = 30000;
// A client whose link to the host dropped keeps trying to rejoin this long.
const REJOIN_FOR = 30000;

const MIN_FIRE_GAP = 70; // ms; host-side sanity limit on fire rate (SMG: 90 ms)

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

/** Hitbox: a few spheres along the body, laid out for the player's stance; the last one is the head. */
function* hitSpheres(s) {
  const [x, y, z] = s.p;
  if (s.st === 'prone') {
    const fx = Math.sin(s.f), fz = Math.cos(s.f);
    for (const [k, r, head] of [[-0.6, 0.25], [0, 0.27], [0.55, 0.2, true]]) yield { c: _c.set(x + fx * k, y + 0.22, z + fz * k), r, head };
  } else if (s.st === 'crouch') {
    for (const [h, r, head] of [[0.4, 0.3], [0.8, 0.3], [1.15, 0.16, true]]) yield { c: _c.set(x, y + h, z), r, head };
  } else {
    for (const [h, r, head] of [[0.45, 0.28], [1.0, 0.3], [1.6, 0.16, true]]) yield { c: _c.set(x, y + h, z), r, head };
  }
}

/**
 * Traces a shot from `origin` along `dir`, ignoring anything closer than `near`
 * (the camera sits behind the shooter). Returns the first thing hit: a player (and whether it was
 * the head) or the world.
 */
export function traceShot(origin, dir, near, players, traceWorld, maxDist = 320) {
  const world = traceWorld(origin, dir, near, maxDist);
  let best = world ? world.distance : maxDist;
  let targetId = null, head = false;
  for (const p of players) {
    if (!p.alive || !p.s || p.s.m === 1) continue; // nobody can be hit while still in the plane
    for (const { c, r, head: isHead } of hitSpheres(p.s)) {
      const t = raySphere(origin, dir, c, r);
      if (t !== null && t >= near && t < best) { best = t; targetId = p.id; head = !!isHead; }
    }
  }
  return {
    point: origin.clone().addScaledVector(dir, best),
    normal: targetId ? null : world?.normal ?? null,
    targetId,
    head: targetId !== null && head,
  };
}

/**
 * Battle-royale game session over a Transport. The host is authoritative for health, hits,
 * eliminations and the round flow (lobby → match → winner → lobby); every client simulates its
 * own movement and reports it 20×/s.
 *
 * hooks:
 *   name                       local player name
 *   color                      local player's uniform color (palette hex)
 *   getLocalState()            PlayerState of the local player
 *   traceWorld(o, d, near, far) → { distance, point, normal } | null   (host only)
 *   findSpawns(count, mode)    → [[x, y, z], …]; mode 'lobby' (near the center) or 'match' (far apart)  (host only)
 *   zoneSpeed                  optional timing multiplier for the blue zone (host only; >1 = faster)
 *   makePickups(mode)          → [{ id, type, x, y, z }] guns to scatter; mode 'lobby' | 'match'  (host only)
 *   predictGrenade(o, v, fuse) → THREE.Vector3 where a grenade will be when it goes off  (host only)
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
    this.zone = null;          // { plan, start } during a match
    this.pickups = new Map();  // id -> { id, type, x, y, z } guns on the ground
    this.blasts = [];          // host: frags in the air { at, pos, by }
    this.domes = [];           // host: blue zone grenades { start, pos, by, next }
    this.departed = [];        // host: players who left mid-match (still listed in the results)
    this.matchStart = 0;
    this.lastZoneDamage = 0;
  }

  get roomCode() { return this.transport.roomCode; }
  get aliveCount() { return [...this.players.values()].filter((p) => p.alive).length; }
  /** The drop plane: { flight, t seconds since the match started }, or null outside a match. */
  flightState() {
    if (this.phase !== 'match' || !this.flight) return null;
    return { flight: this.flight, t: (performance.now() - this.flightStart) / 1000 };
  }

  /** Current blue zone (see zone.js), or null outside a match. */
  zoneState() {
    return this.zone ? zoneAt(this.zone.plan, (performance.now() - this.zone.start) / 1000) : null;
  }

  get canStart() { return this.isHost && this.phase === 'lobby' && this.players.size >= MIN_PLAYERS; }

  async start(code) {
    const t = this.transport;
    t.on('message', (from, msg) => this.#onMessage(from, msg));
    t.on('peer-leave', (id) => this.#onPeerLeave(id));

    if (this.isHost) {
      await t.host();
      this.selfId = this.hostId = t.selfId;
      this.#addPlayer(this.selfId, this.hooks.name, this.hooks.color);
      this.#setPickups(this.hooks.makePickups('lobby'));
    } else {
      await t.join(code);
      t.send(this.#hostPeer(), { t: MSG.HELLO, name: this.hooks.name, color: this.hooks.color });
    }
    this.reconnecting = false;
    this.stopTicker = startTicker(TICK_HZ, () => this.#tick());
  }

  stop() {
    this.stopped = true;
    this.stopTicker?.();
    this.transport.close();
  }

  /** Local player fired: muzzle position, camera ray origin + direction. */
  fire(muzzle, origin, dir, weapon) {
    const msg = { t: MSG.FIRE, o: vec(muzzle), c: vec(origin), d: [dir.x, dir.y, dir.z], w: weapon };
    if (this.isHost) this.#handleFire(this.selfId, msg);
    else this.transport.send(this.#hostPeer(), msg);
  }

  /** Local player pressed F on a gun; the host decides who gets it. */
  pickup(id) {
    if (this.isHost) this.#handlePickup(this.selfId, id);
    else this.transport.send(this.#hostPeer(), { t: MSG.PICKUP, id });
  }

  /** Local player finished applying a bandage; the host heals them. */
  bandage() {
    if (this.isHost) this.#startHeal(this.selfId);
    else this.transport.send(this.#hostPeer(), { t: MSG.BANDAGE });
  }

  /** Host: a bandage heals BANDAGE.heal hp over BANDAGE.healTime, in half-second ticks. */
  #startHeal(id) {
    const p = this.players.get(id);
    const now = performance.now();
    // Can't be faster than one bandage per application time (light anti-cheat).
    if (!p?.alive || p.hp >= MAX_HP || now - (p.lastBandage ?? -Infinity) < (BANDAGE.apply - 0.5) * 1000) return;
    p.lastBandage = now;
    p.heal = { left: BANDAGE.heal, next: now + 500 };
  }

  #healTick(now) {
    const per = BANDAGE.heal / (BANDAGE.healTime * 2);
    for (const p of this.players.values()) {
      const h = p.heal;
      if (!h) continue;
      while (h.next <= now && h.left > 0 && p.alive && p.hp < MAX_HP) {
        const amt = Math.min(per, h.left);
        h.left -= amt;
        h.next += 500;
        p.hp = Math.min(MAX_HP, Math.round((p.hp + amt) * 10) / 10);
        this.#emitAll({ t: MSG.HEAL, target: p.id, hp: p.hp });
      }
      if (h.left <= 0 || !p.alive || p.hp >= MAX_HP) p.heal = null;
    }
  }

  /** Local player threw a grenade; everyone simulates the same throw. */
  throwGrenade(type, origin, velocity, fuse) {
    const msg = { k: type, o: vec(origin), v: vec(velocity), f: Math.round(fuse * 100) / 100 };
    if (this.isHost) this.#thrown(this.selfId, msg);
    else this.transport.send(this.#hostPeer(), { t: MSG.THROW, ...msg });
  }

  /**
   * Host: tell everyone, and for frags work out where it will blow up now (the same physics every
   * client runs) and schedule the damage on the network ticker, which keeps running in background tabs.
   */
  #thrown(by, { k, o, v, f }) {
    this.#emitAll({ t: MSG.THROWN, by, k, o, v, f });
    if (k !== 'frag' && k !== 'bluezone') return;
    const pos = this.hooks.predictGrenade(new THREE.Vector3(...o), new THREE.Vector3(...v), f);
    const at = performance.now() + f * 1000;
    if (k === 'frag') this.blasts.push({ at, pos, by });
    else this.domes.push({ start: at, pos, by, next: at + THROWABLES.bluezone.pulse * 1000 });
  }

  /** Host: blue zone grenades hurt everyone inside their dome, one pulse every `pulse` seconds. */
  #domeDamage(now) {
    const { pulse, dps, duration } = THROWABLES.bluezone;
    for (const d of this.domes) {
      while (d.next <= now && this.phase === 'match') {
        const r = domeRadius((d.next - d.start) / 1000);
        d.next += pulse * 1000;
        for (const p of [...this.players.values()]) {
          if (this.phase !== 'match') break;
          if (!p.alive || !p.s) continue;
          const chest = { prone: 0.25, crouch: 0.7 }[p.s.st] ?? 1.0;
          if (!inDome(d.pos, r, new THREE.Vector3(p.s.p[0], p.s.p[1] + chest, p.s.p[2]))) continue;
          const before = p.hp;
          p.hp = Math.max(0, p.hp - dps * pulse);
          this.#credit(d.by, p, before);
          this.#emitAll({ t: MSG.HIT, target: p.id, by: d.by, hp: p.hp, bz: true });
          if (p.hp > 0) continue;
          this.#emitAll({ t: MSG.DEATH, target: p.id, by: d.by, place: this.aliveCount, bz: true });
          this.#checkWin();
        }
      }
    }
    this.domes = this.domes.filter((d) => now < d.start + duration * 1000 && this.phase === 'match');
  }

  /** Host: frag damage to everyone in range who isn't behind cover. Lobby blasts are harmless. */
  #explode({ pos, by }) {
    if (this.phase !== 'match') return;
    const center = pos.clone();
    center.y += 0.3;
    for (const p of [...this.players.values()]) {
      if (this.phase !== 'match') return;
      if (!p.alive || !p.s) continue;
      const chest = { prone: 0.25, crouch: 0.7 }[p.s.st] ?? 1.0;
      const target = new THREE.Vector3(p.s.p[0], p.s.p[1] + chest, p.s.p[2]);
      const dist = center.distanceTo(target);
      const dmg = fragDamage(dist);
      if (dmg <= 0) continue;
      const hit = this.hooks.traceWorld(center, target.clone().sub(center).normalize(), 0, dist);
      if (hit && hit.distance < dist - 0.3) continue; // rock, tree or hill in the way
      const before = p.hp;
      p.hp = Math.max(0, p.hp - dmg);
      this.#credit(by, p, before);
      this.#emitAll({ t: MSG.HIT, target: p.id, by, hp: p.hp, frag: true });
      if (p.hp > 0) continue;
      this.#emitAll({ t: MSG.DEATH, target: p.id, by, place: this.aliveCount, frag: true });
      this.#checkWin();
    }
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
    this.#emitAll({
      t: MSG.START, spawns, flight: makeFlight(),
      zone: makeZonePlan(Math.random, this.hooks.zoneSpeed ?? 1), pickups: this.hooks.makePickups('match'),
    });
  }

  // --- internals --------------------------------------------------------------

  #hostPeer() {
    return [...this.transport.conns.keys()][0]; // a client has exactly one connection: the host
  }

  #addPlayer(id, name, color = null) {
    const p = { id, name, color: sanitizeColor(color), s: null, hp: MAX_HP, alive: true, kills: 0, lastFire: 0, zoneOut: 0 };
    this.players.set(id, p);
    return p;
  }

  #tick() {
    const s = this.hooks.getLocalState();
    if (this.isHost) {
      const self = this.players.get(this.selfId);
      self.s = s;
      this.#zoneDamage();
      const now = performance.now();
      for (const b of this.blasts.filter((b) => b.at <= now)) this.#explode(b);
      this.blasts = this.blasts.filter((b) => b.at > now);
      this.#domeDamage(now);
      this.#healTick(now);
      this.#expireAway(now);
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
        // Same peer id as a player we already have: they reconnected. Pick up where they were.
        const back = this.players.get(from);
        if (back) {
          back.away = false;
          this.#sendWelcome(from, true);
          this.#emitAll({ t: MSG.AWAY, id: from, away: false });
          break;
        }
        // Everyone gets a color nobody else is wearing (their pick when it's free).
        const taken = new Set([...this.players.values()].map((q) => q.color).filter(Boolean));
        const color = assignColor(sanitizeColor(msg.color), taken);
        const p = this.#addPlayer(from, name, color);
        // Joining mid-match: spectate until the next round.
        if (this.phase !== 'lobby') { p.alive = false; p.hp = 0; p.spectator = true; }
        this.#sendWelcome(from, false);
        this.transport.broadcast({ t: MSG.JOIN, id: from, name, color }, from);
        this.hooks.onEvent(MSG.JOIN, { id: from, name, color });
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
      case MSG.PICKUP:
        this.#handlePickup(from, msg.id);
        break;
      case MSG.BANDAGE:
        this.#startHeal(from);
        break;
      case MSG.THROW:
        if (this.players.get(from)?.alive) this.#thrown(from, msg);
        break;
    }
  }

  /** Host: everything a (re)joining client needs to catch up. */
  #sendWelcome(to, resumed) {
    this.transport.send(to, {
      t: MSG.WELCOME,
      id: to,
      hostId: this.selfId,
      resumed,
      phase: this.phase,
      zone: this.zone && { plan: this.zone.plan, elapsed: performance.now() - this.zone.start },
      flight: this.flight && { ...this.flight, elapsed: performance.now() - this.flightStart },
      pickups: [...this.pickups.values()],
      players: [...this.players.values()].map(({ id, name, color, hp, alive, kills, s }) => ({ id, name, color, hp, alive, kills, s })),
    });
  }

  /**
   * A connection dropped. Host: keep the player's slot for AWAY_GRACE (their soldier stays put and
   * can still be hit) in case they come back. Client: try to rejoin the host.
   */
  #onPeerLeave(id) {
    if (!this.isHost) { this.#rejoin(); return; }
    const p = this.players.get(id);
    if (!p || p.away) return;
    p.away = true;
    p.awayAt = performance.now();
    this.#emitAll({ t: MSG.AWAY, id, away: true });
  }

  /** Host: drop players who were away too long. */
  #expireAway(now) {
    for (const p of [...this.players.values()]) {
      if (!p.away || now - p.awayAt < AWAY_GRACE) continue;
      this.players.delete(p.id);
      if (this.phase === 'match') this.departed.push({ ...p, leftMatch: true, diedAt: p.diedAt ?? now });
      this.#emitAll({ t: MSG.LEAVE, id: p.id });
      this.#checkWin();
    }
  }

  /** Client: the link to the host dropped; keep trying to reconnect (same peer id) for a while. */
  async #rejoin() {
    if (this.reconnecting || this.stopped) return;
    this.reconnecting = true;
    this.hooks.onEvent('reconnecting', {});
    const until = performance.now() + REJOIN_FOR;
    while (performance.now() < until && !this.stopped) {
      try {
        await this.transport.rejoin();
        this.transport.send(this.#hostPeer(), { t: MSG.HELLO, name: this.hooks.name, color: this.hooks.color });
        this.reconnecting = false;
        return; // the host answers with a WELCOME (resumed)
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.reconnecting = false;
    if (!this.stopped) this.hooks.onEvent('host-left', {});
  }

  #setPickups(list) { this.pickups = new Map((list ?? []).map((it) => [it.id, it])); }

  /** Host: first come, first served, and only within reach (with some slack for lag). */
  #handlePickup(playerId, id) {
    const p = this.players.get(playerId);
    const item = this.pickups.get(id);
    if (!p?.alive || !item || this.phase === 'ended') return;
    const pos = p.s?.p;
    if (pos && Math.hypot(pos[0] - item.x, pos[2] - item.z) > PICKUP_RANGE + 1.5) return;
    this.#emitAll({ t: MSG.TAKE, id, by: playerId, type: item.type });
  }

  /** Host: once a second, hurt everyone outside the blue wall (more the longer they stay out). */
  #zoneDamage() {
    const zone = this.phase === 'match' && this.zoneState();
    const now = performance.now();
    if (!zone || now - this.lastZoneDamage < 1000) return;
    this.lastZoneDamage = now;
    for (const p of [...this.players.values()]) {
      if (this.phase !== 'match') return; // the match just ended
      if (!p.alive || !p.s) continue;
      if (zone.dps <= 0 || outsideBy(zone, p.s.p[0], p.s.p[2]) <= 0) { p.zoneOut = 0; continue; }
      p.zoneOut++;
      const dmg = zone.dps * Math.min(1 + ZONE_RAMP * (p.zoneOut - 1), ZONE_RAMP_MAX);
      p.hp = Math.max(0, Math.round((p.hp - dmg) * 10) / 10);
      this.#emitAll({ t: MSG.HIT, target: p.id, by: null, hp: p.hp, zone: true });
      if (p.hp > 0) continue;
      this.#emitAll({ t: MSG.DEATH, target: p.id, by: null, place: this.aliveCount, zone: true });
      this.#checkWin();
    }
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
    const head = res.head;
    const { damage } = WEAPONS[msg.w] ?? WEAPONS.pistol; // trusts the client's weapon (POC)
    const before = target.hp;
    target.hp = Math.max(0, target.hp - (head ? damage.head : damage.body));
    this.#credit(shooterId, target, before);
    this.#emitAll({ t: MSG.HIT, target: target.id, by: shooterId, hp: target.hp, head });
    if (target.hp > 0) return;
    // Place = how many were still alive including the victim (last one standing is #1).
    this.#emitAll({ t: MSG.DEATH, target: target.id, by: shooterId, place: this.aliveCount, head });
    this.#checkWin();
  }

  /** Host: end the match when at most one player is left standing. */
  /** Host: count damage dealt to someone else toward the attacker's match stats. */
  #credit(byId, target, hpBefore) {
    const by = this.players.get(byId);
    if (by && byId !== target.id) by.damage = (by.damage ?? 0) + (hpBefore - target.hp);
  }

  /** Host: end-of-match results for everyone, best placement first. */
  #matchStats(winnerId) {
    const now = performance.now();
    const rows = [...this.players.values(), ...this.departed].filter((p) => !p.spectator).map((p) => ({
      id: p.id,
      name: p.name,
      kills: p.kills ?? 0,
      damage: Math.round(p.damage ?? 0),
      place: p.id === winnerId ? 1 : p.place ?? null,
      survived: Math.round(((p.diedAt ?? now) - this.matchStart) / 1000),
      left: !!p.leftMatch,
    }));
    return rows.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  }

  #checkWin() {
    if (this.phase !== 'match') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length > 1) return;
    const id = alive[0]?.id ?? null;
    this.#emitAll({ t: MSG.WIN, id, stats: this.#matchStats(id), duration: Math.round((performance.now() - this.matchStart) / 1000) });
    setTimeout(() => {
      const ids = [...this.players.keys()];
      const points = this.hooks.findSpawns(ids.length, 'lobby');
      this.#emitAll({ t: MSG.LOBBY, spawns: Object.fromEntries(ids.map((id, i) => [id, points[i]])), pickups: this.hooks.makePickups('lobby') });
    }, WIN_DELAY);
  }

  /** Applies a host message to local state and tells the game. */
  #apply(msg) {
    const players = this.players;
    const reviveAll = () => { for (const p of players.values()) { p.alive = true; p.hp = MAX_HP; p.heal = null; } };
    switch (msg.t) {
      case MSG.WELCOME:
        this.selfId = msg.id;
        this.hostId = msg.hostId;
        this.phase = msg.phase;
        if (msg.resumed) players.clear(); // catch up from scratch after a reconnect
        for (const p of msg.players) players.set(p.id, { ...p, lastFire: 0, zoneOut: 0 });
        if (msg.zone) this.zone = { plan: msg.zone.plan, start: performance.now() - msg.zone.elapsed };
        if (msg.flight) { this.flight = msg.flight; this.flightStart = performance.now() - msg.flight.elapsed; }
        this.#setPickups(msg.pickups);
        break;
      case MSG.JOIN:
        if (!players.has(msg.id)) this.#addPlayer(msg.id, msg.name, msg.color);
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
        if (p) { p.place = msg.place; p.diedAt = performance.now(); }
        const killer = msg.by !== msg.target && players.get(msg.by);
        if (killer) killer.kills++;
        break;
      }
      case MSG.START:
        this.blasts = [];
        this.domes = [];
        this.phase = 'match';
        this.zone = { plan: msg.zone, start: performance.now() };
        this.flight = msg.flight ?? null;
        this.flightStart = performance.now();
        this.#setPickups(msg.pickups);
        reviveAll();
        for (const p of players.values()) { p.kills = 0; p.damage = 0; p.place = null; p.diedAt = null; p.spectator = false; }
        this.departed = [];
        this.matchStart = performance.now();
        break;
      case MSG.TAKE:
        this.pickups.delete(msg.id);
        break;
      case MSG.AWAY: {
        const p = players.get(msg.id);
        if (p) p.away = msg.away;
        break;
      }
      case MSG.HEAL: {
        const p = players.get(msg.target);
        if (p) p.hp = msg.hp;
        break;
      }
      case MSG.WIN:
        this.phase = 'ended';
        this.zone = null;
        this.flight = null;
        break;
      case MSG.LOBBY:
        this.phase = 'lobby';
        this.zone = null;
        this.flight = null;
        this.#setPickups(msg.pickups);
        reviveAll();
        break;
    }
    this.hooks.onEvent(msg.t, msg);
  }
}
