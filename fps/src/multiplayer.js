import * as THREE from 'three';
import { MSG, MIN_PLAYERS, WIN_DELAY } from './net/protocol.js';
import { PeerTransport } from './net/peer-transport.js';
import { Session } from './net/session.js';
import { RemotePlayer } from './remote-player.js';
import * as ui from './ui.js';
import { colorName } from './colors.js';

const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/**
 * Glue between the network Session and the game: spawns/updates remote soldiers, draws other
 * players' shots, applies damage/eliminations to the local player, spectating, and the HUD.
 */
export class Multiplayer {
  /**
   * @param {object} game
   * @param {THREE.Scene} game.scene
   * @param {import('./player.js').Player} game.player
   * @param {import('./combat.js').ShotEffects} game.effects
   * @param {Function} game.traceWorld (origin, dir, near, far) → { distance, point, normal } | null
   * @param {Function} game.findSpawns (count, 'lobby' | 'match') → [[x, y, z], …]
   */
  constructor(game) {
    this.game = game;
    this.remotes = new Map();   // id -> RemotePlayer
    this.pending = new Set();   // ids whose RemotePlayer is still loading
    this.session = null;
    this.spectating = null;     // id of the player the camera follows while we're out
  }

  get selfId() { return this.session?.selfId; }
  get phase() { return this.session?.phase; }
  /** Drop plane { flight, t } during a match, else null. */
  get flight() { return this.session?.flightState() ?? null; }

  /** Blue zone state during a match, else null. */
  get zone() { return this.session?.phase === 'match' ? this.session.zoneState() : null; }

  /** @param {{mode:'host'|'join', name:string, code?:string}} choice */
  async start(choice) {
    const isHost = choice.mode === 'host';
    this.choiceColor = choice.color;
    this.session = new Session(new PeerTransport(), isHost, {
      name: choice.name,
      color: choice.color,
      getLocalState: () => this.game.player.netState(),
      traceWorld: this.game.traceWorld,
      findSpawns: this.game.findSpawns,
      zoneSpeed: this.game.zoneSpeed,
      makePickups: this.game.makePickups,
      predictGrenade: this.game.predictGrenade,
      onEvent: (type, msg) => this.#onEvent(type, msg),
    });
    try {
      await this.session.start(choice.code);
    } catch (err) {
      this.session.stop();
      throw err;
    }
    ui.showRoom(this.session.roomCode ?? choice.code, isHost);
    if (isHost) this.#syncPickups();
    ui.showHealth(true);
    ui.setHealth(this.game.player.hp);
    if (isHost) ui.feed(`You are hosting. Share code ${ui.name(this.session.roomCode)}`);
    this.#refreshHud();
  }

  /** Other players as hit targets for local shot visuals. */
  targets() { return this.session ? this.session.others() : []; }

  /** Local player fired; the host resolves the hit. */
  fire(muzzle, origin, dir, weapon) { this.session?.fire(muzzle, origin, dir, weapon); }

  /** Local player finished applying a bandage. */
  bandage() { this.session?.bandage(); }

  /** Local player threw a grenade. */
  throwGrenade(type, origin, velocity, fuse) { this.session?.throwGrenade(type, origin, velocity, fuse); }

  /** Local player pressed F on a gun. */
  pickup(id) { this.session?.pickup(id); }

  #syncPickups() { this.game.pickups.set([...this.session.pickups.values()]); }

  /** Host: start the match (button or Enter). */
  startMatch() { this.session?.startMatch(); }

  /** While we're out of the match, the camera follows this object instead of our own body. */
  spectateTarget() {
    if (this.game.player.alive || this.phase !== 'match' || this.freeCam) return null;
    const p = this.session.players.get(this.spectating);
    if (!p?.alive) this.nextSpectate();
    return this.remotes.get(this.spectating)?.object ?? null;
  }

  /** Eliminated players can fly a free camera instead of following someone (F toggles). */
  setFreeCam(on) {
    if (this.freeCam === on) return;
    this.freeCam = on;
    this.#refreshHud();
  }

  /** Cycle to the next player still alive. */
  nextSpectate() {
    const alive = this.session.others().filter((p) => p.alive && this.remotes.has(p.id)).map((p) => p.id);
    if (alive.length === 0) { this.spectating = null; return; }
    const i = alive.indexOf(this.spectating);
    const next = alive[(i + 1) % alive.length];
    if (next === this.spectating) return;
    this.spectating = next;
    this.#refreshHud();
  }

  update(dt) {
    const { camera, throwables } = this.game;
    const tagPos = new THREE.Vector3();
    for (const r of this.remotes.values()) {
      r.update(dt);
      // Smoke is cover: no name tags through it.
      if (r.tag.visible && throwables.blocksView(camera.position, r.tag.getWorldPosition(tagPos))) r.tag.visible = false;
    }
  }

  // --- HUD -----------------------------------------------------------------------

  #nameOf(id) {
    if (id === this.selfId) return 'You';
    return this.session.players.get(id)?.name ?? 'Someone';
  }

  #refreshHud() {
    const s = this.session;
    if (this.reconnecting) { ui.setBanner('Connection to the host lost — reconnecting…'); return; }
    const total = s.players.size;
    if (s.phase === 'match') ui.setPlayerCount(total, s.aliveCount);
    else ui.setPlayerCount(total);

    if (s.phase === 'lobby') {
      if (s.isHost) {
        const ready = total >= MIN_PLAYERS;
        ui.setBanner(ready ? 'Lobby — start when everyone is in (Enter)' : `Lobby — waiting for players (${total}/${MIN_PLAYERS})`, {
          label: 'Start match',
          disabled: !ready,
          onClick: () => this.startMatch(),
        });
      } else {
        ui.setBanner('Lobby — waiting for the host to start the match');
      }
    } else if (s.phase === 'match' && !this.game.player.alive) {
      const watched = this.spectating && this.session.players.get(this.spectating);
      if (this.freeCam) ui.setBanner('Free camera — WASD fly · Space / C up / down · Shift fast · F or click: follow players');
      else ui.setBanner(watched ? `Spectating ${watched.name} — click to switch · F free camera` : 'Spectating · F free camera');
    } else {
      ui.setBanner(null);
    }
  }

  // --- remotes ---------------------------------------------------------------------

  async #ensureRemote(id) {
    if (this.remotes.has(id) || this.pending.has(id)) return;
    this.pending.add(id);
    const info = this.session.players.get(id);
    const remote = await RemotePlayer.create(id, info?.name ?? '…', info?.color);
    this.pending.delete(id);
    if (!this.session.players.has(id)) { remote.dispose(); return; } // left while loading
    this.remotes.set(id, remote);
    this.game.scene.add(remote.object);
  }

  #removeRemote(id) {
    this.remotes.get(id)?.dispose();
    this.remotes.delete(id);
  }

  /** Puts the local player at the spawn the host picked for us, if any. */
  #placeSelf(spawns) {
    const p = spawns[this.selfId];
    if (!p) return;
    this.game.player.respawn(...p);
    ui.setHealth(this.game.player.hp);
    ui.hideOverlay();
  }

  // --- events ------------------------------------------------------------------

  #onEvent(type, msg) {
    const { player, effects } = this.game;
    switch (type) {
      case MSG.WELCOME: {
        this.#syncPickups();
        if (msg.resumed) {
          // Back after a dropped connection: the host kept our player; take its word on health.
          this.reconnecting = false;
          ui.feed('Reconnected');
          const me = msg.players.find((p) => p.id === msg.id);
          if (me && !me.alive && player.alive) player.die();
          if (me) { player.hp = me.hp; ui.setHealth(me.hp); }
          break;
        }
        ui.feed('Joined the game');
        {
          // The host may have given us a different color if ours was already taken.
          const mine = msg.players.find((p) => p.id === msg.id)?.color;
          if (mine) {
            player.soldier.setColor(mine);
            if (mine !== this.choiceColor) ui.feed(`Your color was taken — you're ${ui.name(colorName(mine))} this game`);
          }
        }
        if (msg.phase !== 'lobby') {
          player.spectate();
          ui.showOverlay('Match in progress — you will join the next round');
          setTimeout(() => ui.hideOverlay(), 3000);
        }
        break;
      }

      case 'reconnecting':
        this.reconnecting = true;
        ui.setBanner('Connection to the host lost — reconnecting…');
        return; // keep the banner (no HUD refresh)

      case MSG.AWAY:
        if (msg.id !== this.selfId) ui.feed(`${ui.name(this.#nameOf(msg.id))} ${msg.away ? 'lost connection…' : 'is back'}`);
        break;

      case MSG.JOIN:
        ui.feed(`${ui.name(msg.name)} joined`);
        break;

      case MSG.LEAVE:
        ui.feed(`${ui.name(this.remotes.get(msg.id)?.name ?? 'A player')} left`);
        this.#removeRemote(msg.id);
        break;

      case MSG.SNAP:
        for (const u of msg.players) {
          if (u.id === this.selfId) continue;
          const remote = this.remotes.get(u.id);
          if (!remote) { this.#ensureRemote(u.id); continue; }
          const info = this.session.players.get(u.id);
          remote.setName(info?.name ?? remote.name);
          remote.setColor(info?.color);
          remote.push(u.s, u.alive);
        }
        // Drop avatars of players the host no longer lists.
        for (const id of this.remotes.keys()) if (!this.session.players.has(id)) this.#removeRemote(id);
        break;

      case MSG.SHOT:
        if (msg.by === this.selfId) break; // already drawn locally
        effects.shoot(new THREE.Vector3(...msg.o), new THREE.Vector3(...msg.to), msg.n ? new THREE.Vector3(...msg.n) : null);
        this.remotes.get(msg.by)?.playShoot();
        break;

      case MSG.HIT:
        if (msg.target === this.selfId) {
          player.hp = msg.hp;
          ui.setHealth(msg.hp);
          if (!msg.zone && !msg.bz) ui.flashDamage(msg.head || msg.frag);
        }
        if (msg.by === this.selfId) ui.flashHitmarker(msg.head);
        break;

      case MSG.DEATH:
        if (msg.zone) ui.feed(`${ui.name(this.#nameOf(msg.target))} was caught by the blue zone`);
        else if (msg.frag && msg.by === msg.target) ui.feed(`${ui.name(this.#nameOf(msg.target))} blew themselves up`);
        else if (msg.bz) {
          const whose = msg.by === msg.target ? (msg.target === this.selfId ? 'your own' : 'their own')
            : msg.by === this.selfId ? 'your' : `${ui.name(this.#nameOf(msg.by))}'s`;
          ui.feed(`${ui.name(this.#nameOf(msg.target))} ${msg.target === this.selfId ? 'were' : 'was'} caught in ${whose} blue zone grenade`);
        }
        else if (msg.frag) ui.feed(`${ui.name(this.#nameOf(msg.by))} ✕ frag ✕ ${ui.name(this.#nameOf(msg.target))}`);
        else ui.feed(`${ui.name(this.#nameOf(msg.by))} ${msg.head ? '✕ headshot ✕' : '✕'} ${ui.name(this.#nameOf(msg.target))}`);
        if (msg.target === this.selfId) {
          player.die();
          ui.setHealth(0);
          const cause = msg.zone ? 'the blue zone'
            : msg.frag && msg.by === this.selfId ? 'your own frag'
              : msg.bz ? (msg.by === this.selfId ? 'your own blue zone grenade' : `${this.#nameOf(msg.by)}'s blue zone grenade`)
              : `${this.#nameOf(msg.by)}${msg.head ? ' (headshot)' : msg.frag ? ' (frag)' : ''}`;
          ui.showOverlay(`Eliminated by ${cause} — ${ordinal(msg.place)} place`);
          setTimeout(() => { if (this.phase === 'match') ui.hideOverlay(); }, 3500);
          this.spectating = msg.by && msg.by !== this.selfId ? msg.by : null; // watch whoever got us
        }
        break;

      case MSG.HEAL:
        if (msg.target === this.selfId) {
          player.hp = msg.hp;
          ui.setHealth(msg.hp);
        }
        break;

      case MSG.TAKE:
        this.game.pickups.remove(msg.id);
        if (msg.by === this.selfId) player.pickUp(msg.type);
        break;

      case MSG.THROWN:
        if (msg.by === this.selfId) break; // already thrown locally
        this.game.throwables.spawn(msg.k, new THREE.Vector3(...msg.o), new THREE.Vector3(...msg.v), { fuse: msg.f, by: msg.by });
        this.remotes.get(msg.by)?.soldier.playThrow();
        break;

      case MSG.TP:
        if (msg.id === this.selfId) this.#placeSelf({ [msg.id]: msg.p });
        else this.remotes.get(msg.id)?.teleport();
        break;

      case MSG.START:
        for (const r of this.remotes.values()) r.teleport();
        this.#placeSelf(msg.spawns);
        if (msg.flight) player.boardPlane(); // everyone starts in the drop plane
        this.#syncPickups();
        this.game.throwables.clear();
        this.spectating = null;
        ui.feed('Match started — jump from the plane where you want to land. Last one standing wins.');
        ui.showOverlay(msg.flight ? 'Get ready to jump!' : 'Fight!');
        setTimeout(() => { if (this.phase === 'match' && player.alive) ui.hideOverlay(); }, 2000);
        break;

      case MSG.WIN:
        ui.hideOverlay();
        ui.showMatchEnd({ selfId: this.selfId, winnerId: msg.id, stats: msg.stats ?? [], duration: msg.duration ?? 0, seconds: Math.round(WIN_DELAY / 1000) });
        if (msg.id) ui.feed(`${ui.name(this.#nameOf(msg.id))} won the match`);
        break;

      case MSG.LOBBY:
        ui.hideMatchEnd();
        for (const r of this.remotes.values()) r.teleport();
        this.#placeSelf(msg.spawns);
        this.#syncPickups();
        this.game.throwables.clear();
        this.spectating = null;
        break;

      case 'host-left':
        this.session.stop();
        for (const id of [...this.remotes.keys()]) this.#removeRemote(id);
        this.session.players.clear();
        ui.setBanner(null);
        ui.hideMatchEnd();
        ui.showOverlay('The host left the game.', { button: { label: 'Back to menu', onClick: () => location.reload() } });
        return;
    }
    if (type !== MSG.SNAP && type !== MSG.SHOT) this.#refreshHud();
    else if (type === MSG.SNAP && this.session.players.size !== this.lastCount) {
      this.lastCount = this.session.players.size;
      this.#refreshHud();
    }
  }
}
