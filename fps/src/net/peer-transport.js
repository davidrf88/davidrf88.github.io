import { Peer } from 'peerjs';
import { Transport } from './transport.js';

// Peer ids on the public PeerJS broker are global, so namespace ours.
const ID_PREFIX = 'forestwalk-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const randomCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

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
  }

  host() {
    return new Promise((resolve, reject) => {
      const tryCode = (attempt) => {
        const code = randomCode();
        const peer = new Peer(ID_PREFIX + code);
        peer.on('open', (id) => {
          this.peer = peer;
          this.selfId = id;
          this.roomCode = code;
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
      peer.on('open', (id) => {
        this.peer = peer;
        this.selfId = id;
        const conn = peer.connect(ID_PREFIX + code.trim().toUpperCase(), { serialization: 'json', reliable: true });
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

  #wire(conn, isHostSide) {
    const ready = () => {
      this.conns.set(conn.peer, conn);
      if (isHostSide) this.emit('peer-join', conn.peer);
    };
    if (conn.open) ready(); else conn.on('open', ready);
    conn.on('data', (msg) => this.emit('message', conn.peer, msg));
    const gone = () => {
      if (!this.conns.delete(conn.peer)) return;
      this.emit('peer-leave', conn.peer);
    };
    conn.on('close', gone);
    conn.on('error', gone);
    // Data channels don't always fire 'close' when the other tab is closed; watch ICE state too.
    conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
      const s = conn.peerConnection.iceConnectionState;
      if (s === 'disconnected' || s === 'failed' || s === 'closed') gone();
    });
  }

  send(peerId, msg) {
    const conn = this.conns.get(peerId);
    if (conn?.open) conn.send(msg);
  }

  broadcast(msg, exceptId) {
    for (const [id, conn] of this.conns) if (id !== exceptId && conn.open) conn.send(msg);
  }

  close() {
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
