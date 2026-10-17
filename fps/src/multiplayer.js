import * as THREE from 'three';
import { MSG, MIN_PLAYERS, WIN_DELAY } from './net/protocol.js';
import { PeerTransport } from './net/peer-transport.js';
import { Session } from './net/session.js';
import { RemotePlayer } from './remote-player.js';
import * as ui from './ui.js';

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

  /** @param {{mode:'host'|'join', name:string, code?:string}} choice */
  async start(choice) {
    const isHost = choice.mode === 'host';
    this.session = new Session(new PeerTransport(), isHost, {
      name: choice.name,
      getLocalState: () => this.game.player.netState(),
      traceWorld: this.game.traceWorld,
      findSpawns: this.game.findSpawns,
      onEvent: (type, msg) => this.#onEvent(type, msg),
    });
    try {
      await this.session.start(choice.code);
    } catch (err) {
      this.session.stop();
      throw err;
    }
    ui.showRoom(this.session.roomCode ?? choice.code, isHost);
    ui.showHealth(true);
    ui.setHealth(this.game.player.hp);
    if (isHost) ui.feed(`You are hosting. Share code ${ui.name(this.session.roomCode)}`);
    this.#refreshHud();
  }

  /** Other players as hit targets for local shot visuals. */
  targets() { return this.session ? this.session.others() : []; }

  /** Local player fired; the host resolves the hit. */
  fire(muzzle, origin, dir) { this.session?.fire(muzzle, origin, dir); }

  /** Host: start the match (button or Enter). */
  startMatch() { this.session?.startMatch(); }

  /** While we're out of the match, the camera follows this object instead of our own body. */
  spectateTarget() {
    if (this.game.player.alive || this.phase !== 'match') return null;
    const p = this.session.players.get(this.spectating);
    if (!p?.alive) this.nextSpectate();
    return this.remotes.get(this.spectating)?.object ?? null;
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
    for (const r of this.remotes.values()) r.update(dt);
  }

  // --- HUD -----------------------------------------------------------------------

  #nameOf(id) {
    if (id === this.selfId) return 'You';
    return this.session.players.get(id)?.name ?? 'Someone';
  }

  #refreshHud() {
    const s = this.session;
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
      ui.setBanner(watched ? `Spectating ${watched.name} — click to switch` : 'Spectating');
    } else {
      ui.setBanner(null);
    }
  }

  // --- remotes ---------------------------------------------------------------------

  async #ensureRemote(id) {
    if (this.remotes.has(id) || this.pending.has(id)) return;
    this.pending.add(id);
    const remote = await RemotePlayer.create(id, this.session.players.get(id)?.name ?? '…');
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
      case MSG.WELCOME:
        ui.feed('Joined the game');
        if (msg.phase !== 'lobby') {
          player.spectate();
          ui.showOverlay('Match in progress — you will join the next round');
          setTimeout(() => ui.hideOverlay(), 3000);
        }
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
          remote.setName(this.session.players.get(u.id)?.name ?? remote.name);
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
          ui.flashDamage();
        }
        if (msg.by === this.selfId) ui.flashHitmarker();
        break;

      case MSG.DEATH:
        ui.feed(`${ui.name(this.#nameOf(msg.by))} ✕ ${ui.name(this.#nameOf(msg.target))}`);
        if (msg.target === this.selfId) {
          player.die();
          ui.setHealth(0);
          ui.showOverlay(`Eliminated by ${this.#nameOf(msg.by)} — ${ordinal(msg.place)} place`);
          setTimeout(() => { if (this.phase === 'match') ui.hideOverlay(); }, 3500);
          this.spectating = msg.by !== this.selfId ? msg.by : null; // watch whoever got us
        }
        break;

      case MSG.TP:
        if (msg.id === this.selfId) this.#placeSelf({ [msg.id]: msg.p });
        else this.remotes.get(msg.id)?.teleport();
        break;

      case MSG.START:
        for (const r of this.remotes.values()) r.teleport();
        this.#placeSelf(msg.spawns);
        this.spectating = null;
        ui.feed('Match started — last one standing wins');
        ui.showOverlay('Fight!');
        setTimeout(() => { if (this.phase === 'match' && player.alive) ui.hideOverlay(); }, 1500);
        break;

      case MSG.WIN: {
        const won = msg.id === this.selfId;
        const text = won ? 'Victory! Last one standing' : msg.id ? `${this.#nameOf(msg.id)} wins!` : 'Nobody survived';
        ui.showOverlay(`${text}\nBack to the lobby in ${Math.round(WIN_DELAY / 1000)} s`);
        if (msg.id) ui.feed(`${ui.name(this.#nameOf(msg.id))} won the match`);
        break;
      }

      case MSG.LOBBY:
        for (const r of this.remotes.values()) r.teleport();
        this.#placeSelf(msg.spawns);
        this.spectating = null;
        break;

      case 'host-left':
        this.session.stop();
        for (const id of [...this.remotes.keys()]) this.#removeRemote(id);
        this.session.players.clear();
        ui.setBanner(null);
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
