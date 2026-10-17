/**
 * Transport interface: how messages get between the host and clients.
 * Game/session code only talks to this, so the PeerJS implementation can later be swapped
 * for a WebSocket one talking to our own Node server.
 *
 * Events:
 *   'open'       (selfId)          ready; for a host, `roomCode` is set
 *   'peer-join'  (peerId)          host only: a client connected
 *   'peer-leave' (peerId)          host: a client left · client: the host left
 *   'message'    (peerId, msg)     a message from that peer
 *   'error'      (Error)
 */
export class Transport {
  constructor() {
    this.handlers = new Map();
    this.selfId = null;
    this.roomCode = null;
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
    return this;
  }

  emit(event, ...args) {
    for (const fn of this.handlers.get(event) ?? []) fn(...args);
  }

  /** Start hosting; resolves with the room code to share. */
  async host() { throw new Error('not implemented'); }
  /** Join a host by room code; resolves once connected. */
  async join(_code) { throw new Error('not implemented'); }
  /** Send to one peer. */
  send(_peerId, _msg) { throw new Error('not implemented'); }
  /** Host: send to every connected client, optionally skipping one. */
  broadcast(_msg, _exceptId) { throw new Error('not implemented'); }
  close() {}
}

/**
 * A steady tick that keeps running in background tabs (main-thread timers and
 * requestAnimationFrame are throttled there, which would stall the host for everyone).
 */
export function startTicker(hz, fn) {
  const src = `setInterval(() => postMessage(0), ${Math.round(1000 / hz)});`;
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const worker = new Worker(url);
  worker.onmessage = fn;
  return () => { worker.terminate(); URL.revokeObjectURL(url); };
}
