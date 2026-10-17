/**
 * Message protocol shared by host and clients (and a future Node server).
 * Every message is a plain JSON object with a `t` (type) field.
 *
 * client → host
 *   hello   { name, color }
 *   state   { s: PlayerState }                     20 Hz
 *   fire    { o: [x,y,z] muzzle, c: [x,y,z] ray origin, d: [x,y,z] ray dir, w: weapon }
 *   pickup  { id }                                 wants the gun lying there
 *   bandage {}                                     finished applying a bandage: start healing
 *   throw   { k: type, o: [x,y,z], v: [vx,vy,vz], f } threw a grenade (release point, velocity, fuse left)
 *
 * host → clients
 *   welcome { id, hostId, resumed, phase, zone: { plan, elapsed ms } | null, pickups, players: [{ id, name, color, hp, alive, kills, s }] }
 *   join    { id, name, color }
 *   leave   { id }
 *   snap    { players: [{ id, s, hp, alive }] }   20 Hz
 *   shot    { by, o, to, n }                       tracer for everyone except the shooter
 *   hit     { target, by, hp, head, zone }         head: headshot; zone: blue-zone damage (by = null)
 *   death   { target, by, place, head, zone }                 eliminated; no respawn until the next round
 *   tp      { id, p: [x,y,z] }                     teleport (lobby arrivals)
 *   start   { spawns: { [id]: [x,y,z] }, zone, pickups }  match begins; players spread far apart; zone plan (zone.js); loot
 *   take    { id, by }                             a player picked up item `id`
 *   heal    { target, hp }                         bandage healing tick
 *   away    { id, away }                           a player's connection dropped (true) / they reconnected (false)
 *   thrown  { by, k, o, v, f }                     a grenade is in the air; every client simulates it
 *                                                  (frag / blue zone grenade damage arrives as hit/death with frag / bz: true)
 *   win     { id | null, stats, duration }         last one standing (null: nobody); stats: [{ id, name, kills, damage, place, survived, left }]
 *   lobby   { spawns: { [id]: [x,y,z] }, pickups } back to the lobby for another round
 *
 * pickups: [{ id, type, x, y, z }] guns on the ground (see pickups.js)
 *
 * Phases: 'lobby' (no damage, host can start) → 'match' (battle royale) → 'ended' → 'lobby'.
 *
 * PlayerState: { p:[x,y,z], f:facing, b:baseClip, a:aimFrac, pi:aimPitch, l:lean, st:stance, r:reloading, v:visible, w:weapon }
 */
export const MSG = {
  HELLO: 'hello',
  STATE: 'state',
  FIRE: 'fire',
  PICKUP: 'pickup',
  THROW: 'throw',
  BANDAGE: 'bandage',
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
  TAKE: 'take',
  THROWN: 'thrown',
  HEAL: 'heal',
  AWAY: 'away',
};

export const TICK_HZ = 20;
export const MIN_PLAYERS = 2;      // to start a match
export const WIN_DELAY = 12000;    // ms showing the winner and match stats before returning to the lobby

export const vec = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
