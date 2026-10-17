/**
 * Weapon stats. Players have 100 hp; damage is per hit (body / head), decided by the host.
 *
 * spread: cone half-angle (radians) when hip-firing / aiming; bloom is added per shot while
 * firing continuously and recovers over time. recoil kicks the camera up per shot.
 * scope: aiming looks through a scope with this field of view (degrees) instead of over the shoulder;
 *        the mouse wheel zooms out to `scopeMin` (a wider view: here half the magnification).
 */
export const WEAPONS = {
  pistol: {
    name: 'Pistol', mag: 12, reserve: Infinity, interval: 0.18, auto: false,
    damage: { body: 20, head: 50 },             // 5 body shots / 2 headshots
    spread: { hip: 0.02, aim: 0.004 }, bloom: 0.004, bloomMax: 0.02, recoil: 0.01,
  },
  rifle: {
    name: 'Rifle', mag: 20, reserve: 60, interval: 0.1, auto: true,
    damage: { body: 15, head: 35 },             // 7 body shots / 3 headshots
    spread: { hip: 0.035, aim: 0.006 }, bloom: 0.005, bloomMax: 0.04, recoil: 0.014, reloadK: 1.25,
  },
  smg: {
    name: 'SMG', mag: 30, reserve: 90, interval: 0.09, auto: true, // ~11/s: ~133 dmg/s vs the rifle's 150
    damage: { body: 12, head: 28 },             // 9 body shots / 4 headshots
    spread: { hip: 0.022, aim: 0.008 }, bloom: 0.003, bloomMax: 0.022, recoil: 0.006, reloadK: 1.1,
  },
  sniper: {
    name: 'Sniper', mag: 5, reserve: 15, interval: 1.4, auto: false,
    damage: { body: 60, head: 120 },            // 2 body shots / 1 headshot
    spread: { hip: 0.07, aim: 0 }, bloom: 0, bloomMax: 0, recoil: 0.06,
    scope: 9, scopeMin: 18, reloadK: 1.5,
  },
};

/** Weapons that can lie on the ground, with how many to scatter per match. */
export const LOOT = { rifle: 12, smg: 12, sniper: 5, smoke: 12, frag: 12, bluezone: 8, bandage: 18 };

/** Number keys, in order. */
export const SLOTS = ['rifle', 'smg', 'sniper', 'pistol'];

export const PICKUP_RANGE = 2;  // meters; how close you must be to press F
