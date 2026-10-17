/**
 * Message protocol shared by host and clients (and a future Node server).
 * Every message is a plain JSON object with a `t` (type) field.
 *
 * client → host
 *   hello   { name }
 *   state   { s: PlayerState }                     20 Hz
 *   fire    { o: [x,y,z] muzzle, c: [x,y,z] ray origin, d: [x,y,z] ray dir }
 *
 * host → clients
 *   welcome { id, hostId, phase, players: [{ id, name, hp, alive, kills, s }] }
 *   join    { id, name }
 *   leave   { id }
 *   snap    { players: [{ id, s, hp, alive }] }   20 Hz
 *   shot    { by, o, to, n }                       tracer for everyone except the shooter
 *   hit     { target, by, hp }
 *   death   { target, by, place }                  eliminated; no respawn until the next round
 *   tp      { id, p: [x,y,z] }                     teleport (lobby arrivals)
 *   start   { spawns: { [id]: [x,y,z] } }          match begins; players spread far apart
 *   win     { id | null }                          last one standing (null: nobody)
 *   lobby   { spawns: { [id]: [x,y,z] } }          back to the lobby for another round
 *
 * Phases: 'lobby' (no damage, host can start) → 'match' (battle royale) → 'ended' → 'lobby'.
 *
 * PlayerState: { p:[x,y,z], f:facing, b:baseClip, a:aimFrac, pi:aimPitch, l:lean, st:stance, r:reloading, v:visible }
 */
export const MSG = {
  HELLO: 'hello',
  STATE: 'state',
  FIRE: 'fire',
  WELCOME: 'welcome',
  JOIN: 'join',
  LEAVE: 'leave',
  SNAP: 'snap',
  SHOT: 'shot',
  HIT: 'hit',
  DEATH: 'death',
  TP: 'tp',
  START: 'start',
  WIN: 'win',
  LOBBY: 'lobby',
};

export const TICK_HZ = 20;
export const DAMAGE = 34;          // 3 hits from full health
export const MIN_PLAYERS = 2;      // to start a match
export const WIN_DELAY = 8000;     // ms showing the winner before returning to the lobby

export const vec = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
