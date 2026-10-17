import { Peer } from 'peerjs';
import { Transport } from './transport.js';

// Peer ids on the public PeerJS broker are global, so namespace ours.
const ID_PREFIX = 'forestwalk-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const randomCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// Background tabs miss WebRTC connectivity checks, so ICE often reports 'disconnected' for a few
// seconds and then recovers. Only give up on a peer after this long without recovering…
const ICE_GRACE = 12000;
// …or after this long without any message (the game sends ~20/s even from background tabs).
const SILENCE_LIMIT = 20000;

/**
 * WebRTC data channels via PeerJS. The free public PeerJS broker (0.peerjs.com) only
 * introduces the browsers; game traffic then flows directly between them (star topology:
 * every client is connected to the host only).
 */
export class PeerTransport extends Transport {
  constructor() {
    super();
    this.peer = null;
    this.conns = new Map(); // peerId -> DataConnection
    this.lastSeen = new Map(); // peerId -> ms of the last message
    this.hostId = null;     // client: the host's peer id (for rejoining)
    this.closed = false;
    this.watchdog = setInterval(() => this.#checkSilence(), 2000);
  }

  /**
   * The link to the matchmaking broker drops easily in background tabs (its keep-alive timer is
   * throttled). Game traffic doesn't need it, but new joins and rejoins do, so re-register,
   * keeping the same peer id.
   */
  #keepRegistered(peer) {
    let delay = 1000;
    peer.on('disconnected', () => {
      const retry = () => {
        if (this.closed || peer.destroyed || !peer.disconnected) return;
        try { peer.reconnect(); } catch { /* retried below */ }
        delay = Math.min(delay * 2, 15000);
        setTimeout(retry, delay);
      };
      setTimeout(retry, delay);
    });
    peer.on('open', () => { delay = 1000; });
  }

  #checkSilence() {
    const now = performance.now();
    for (const [id, conn] of this.conns) {
      if (now - (this.lastSeen.get(id) ?? now) > SILENCE_LIMIT) this.#drop(conn);
    }
  }

  host() {
    return new Promise((resolve, reject) => {
      const tryCode = (attempt) => {
        const code = randomCode();
        const peer = new Peer(ID_PREFIX + code);
        peer.on('open', (id) => {
          if (this.peer) return; // a re-registration, not the first open
          this.peer = peer;
          this.selfId = id;
          this.roomCode = code;
          this.#keepRegistered(peer);
          peer.on('connection', (conn) => this.#wire(conn, true));
          peer.on('error', (err) => this.emit('error', err));
          this.emit('open', id);
          resolve(code);
        });
        peer.once('error', (err) => {
          if (this.peer) return;
          peer.destroy();
          if (err.type === 'unavailable-id' && attempt < 5) tryCode(attempt + 1); // code taken, pick another
          else reject(friendlyError(err));
        });
      };
      tryCode(0);
    });
  }

  join(code) {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      let settled = false;
      const fail = (err) => {
        if (settled) { this.emit('error', friendlyError(err)); return; }
        settled = true;
        peer.destroy();
        reject(friendlyError(err));
      };
      peer.on('error', fail);
      peer.once('open', (id) => {
        this.peer = peer;
        this.selfId = id;
        this.hostId = ID_PREFIX + code.trim().toUpperCase();
        this.#keepRegistered(peer);
        const conn = peer.connect(this.hostId, { serialization: 'json', reliable: true });
        conn.on('open', () => {
          settled = true;
          this.#wire(conn, false);
          this.emit('open', id);
          resolve();
        });
        setTimeout(() => { if (!settled) fail({ type: 'timeout' }); }, 12000);
      });
    });
  }

  /**
   * Client: connect to the same host again after the link dropped, keeping our peer id so the
   * host recognizes us. Resolves when connected; rejects if this attempt fails.
   */
  rejoin(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const peer = this.peer;
      if (!peer || peer.destroyed || this.closed) { reject(new Error('closed')); return; }
      const attempt = () => {
        const conn = peer.connect(this.hostId, { serialization: 'json', reliable: true });
        const timer = setTimeout(() => { conn.close(); reject(new Error('timeout')); }, timeout);
        conn.on('open', () => { clearTimeout(timer); this.#wire(conn, false); resolve(); });
        conn.on('error', () => { clearTimeout(timer); reject(new Error('failed')); });
      };
      if (!peer.disconnected) { attempt(); return; }
      // Re-register with the broker first (same id), then connect.
      const onOpen = () => { peer.off('error', onErr); attempt(); };
      const onErr = () => { peer.off('open', onOpen); reject(new Error('broker')); };
      peer.once('open', onOpen);
      peer.once('error', onErr);
      try { peer.reconnect(); } catch { /* already reconnecting */ }
    });
  }

  #wire(conn, isHostSide) {
    const ready = () => {
      const old = this.conns.get(conn.peer);
      this.conns.set(conn.peer, conn); // a rejoin replaces the dead connection
      this.lastSeen.set(conn.peer, performance.now());
      if (old && old !== conn) old.close();
      if (isHostSide) this.emit('peer-join', conn.peer);
    };
    if (conn.open) ready(); else conn.on('open', ready);
    conn.on('data', (msg) => {
      this.lastSeen.set(conn.peer, performance.now());
      this.emit('message', conn.peer, msg);
    });
    const gone = () => this.#drop(conn);
    conn.on('close', gone);
    conn.on('error', gone);
    // Data channels don't always fire 'close' when the other tab is closed; watch ICE state too,
    // but give a 'disconnected' blip time to recover (it usually does).
    let graceTimer = 0;
    conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
      const s = conn.peerConnection.iceConnectionState;
      clearTimeout(graceTimer);
      if (s === 'failed' || s === 'closed') gone();
      else if (s === 'disconnected') graceTimer = setTimeout(gone, ICE_GRACE);
    });
  }

  /** A connection is dead: forget it (unless a newer one for the same peer replaced it). */
  #drop(conn) {
    if (this.conns.get(conn.peer) !== conn) return;
    this.conns.delete(conn.peer);
    this.lastSeen.delete(conn.peer);
    conn.close();
    this.emit('peer-leave', conn.peer);
  }

  send(peerId, msg) {
    const conn = this.conns.get(peerId);
    if (conn?.open) conn.send(msg);
  }

  broadcast(msg, exceptId) {
    for (const [id, conn] of this.conns) if (id !== exceptId && conn.open) conn.send(msg);
  }

  close() {
    this.closed = true;
    clearInterval(this.watchdog);
    for (const conn of this.conns.values()) conn.close();
    this.conns.clear();
    this.peer?.destroy();
  }
}

function friendlyError(err) {
  const map = {
    'peer-unavailable': 'Room not found. Check the code.',
    'unavailable-id': 'Could not create a room, try again.',
    network: 'Network error reaching the matchmaking server.',
    'server-error': 'Matchmaking server error.',
    'browser-incompatible': 'This browser does not support WebRTC.',
    timeout: 'Timed out connecting to the host.',
  };
  return new Error(map[err?.type] ?? err?.message ?? String(err));
}
