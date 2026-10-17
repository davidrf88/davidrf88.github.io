/**
 * Uniform colors players can pick in the start menu, chosen so none is camouflage:
 * - hues only on the blue → violet → red arc, 22° apart, away from everything in the forest
 *   (teal-green leaves, green grass, red-brown trunks, beige rocks);
 * - the same luminance (0.11) and saturation for all, so none is darker in the shade or brighter
 *   in the sun than another.
 * The host hands out each color to one player at a time (see assignColor).
 */
export const PALETTE = [
  { name: 'Sky', hex: '#216385' },
  { name: 'Azure', hex: '#2e58b9' },
  { name: 'Indigo', hex: '#5148d1' },
  { name: 'Violet', hex: '#7736cd' },
  { name: 'Purple', hex: '#932bad' },
  { name: 'Magenta', hex: '#a1288d' },
  { name: 'Pink', hex: '#a92a65' },
  { name: 'Crimson', hex: '#ae2b38' },
];

const KEY = 'forestwalk.color';
const valid = (hex) => PALETTE.some((c) => c.hex === hex);

/** Your saved color, or a random one the first time (saved so you keep it). */
export function loadColor() {
  try {
    const saved = localStorage.getItem(KEY);
    if (valid(saved)) return saved;
  } catch { /* storage unavailable */ }
  const pick = PALETTE[Math.floor(Math.random() * PALETTE.length)].hex;
  saveColor(pick);
  return pick;
}

export function saveColor(hex) {
  try { localStorage.setItem(KEY, hex); } catch { /* ignore */ }
}

/** Colors from the network are checked against the palette. */
export const sanitizeColor = (hex) => (valid(hex) ? hex : null);

export const colorName = (hex) => PALETTE.find((c) => c.hex === hex)?.name ?? '';

/**
 * Host: the color a player gets. Their pick if nobody else wears it, otherwise the nearest free
 * one around the palette; only when every color is taken do two players share one.
 */
export function assignColor(wanted, taken) {
  const start = Math.max(0, PALETTE.findIndex((c) => c.hex === wanted));
  // The pick, then its neighbours along the arc: +1, -1, +2, -2… (no wrap: the ends are far apart).
  for (let d = 0; d < PALETTE.length; d++) {
    for (const i of d === 0 ? [start] : [start + d, start - d]) {
      if (i >= 0 && i < PALETTE.length && !taken.has(PALETTE[i].hex)) return PALETTE[i].hex;
    }
  }
  return valid(wanted) ? wanted : PALETTE[0].hex;
}
