import { MAX_HP } from './player.js';
import { PALETTE, loadColor, saveColor } from './colors.js';

const $ = (id) => document.getElementById(id);

function loadName() {
  try {
    const saved = localStorage.getItem('forestwalk.name');
    if (saved) return saved;
  } catch { /* storage unavailable */ }
  return `Soldier-${Math.floor(Math.random() * 90 + 10)}`;
}
function saveName(name) {
  try { localStorage.setItem('forestwalk.name', name); } catch { /* ignore */ }
}

/** Uniform color swatches; the pick is saved and previewed live through `onColor(hex)`. */
function colorPicker(onColor) {
  const box = $('colors');
  let current = loadColor();
  const select = (hex) => {
    current = hex;
    saveColor(hex);
    for (const b of box.children) b.setAttribute('aria-checked', String(b.dataset.hex === hex));
    $('color-name').textContent = PALETTE.find((c) => c.hex === hex)?.name ?? '';
    onColor?.(hex);
  };
  box.innerHTML = '';
  for (const c of PALETTE) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.hex = c.hex;
    b.title = c.name;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.style.background = c.hex;
    b.onclick = () => select(c.hex);
    box.append(b);
  }
  select(current);
  return () => current;
}

/**
 * Start menu. Resolves the chosen mode once the player picks one:
 * { mode: 'solo' } | { mode: 'host', name } | { mode: 'join', name, code }, each with `color`.
 * `connect(choice)` is awaited before the menu closes, so errors can be shown in place.
 * `onColor(hex)` previews the uniform color as it's picked.
 */
export function showMenu(connect, { onColor } = {}) {
  const getColor = colorPicker(onColor);
  const menu = $('menu');
  const nameEl = $('name');
  const codeEl = $('code');
  const status = $('menu-status');
  const buttons = [$('btn-host'), $('btn-join'), $('btn-solo')];
  nameEl.value = loadName();
  menu.hidden = false;

  const params = new URLSearchParams(location.search);
  if (params.get('room')) codeEl.value = params.get('room').toUpperCase();

  return new Promise((resolve) => {
    const go = async (choice, busyText) => {
      choice.name = nameEl.value.trim().slice(0, 16) || 'Soldier';
      choice.color = getColor();
      saveName(choice.name);
      buttons.forEach((b) => { b.disabled = true; });
      status.textContent = busyText;
      try {
        await connect(choice);
        menu.hidden = true;
        resolve(choice);
      } catch (err) {
        status.textContent = err.message || String(err);
        buttons.forEach((b) => { b.disabled = false; });
      }
    };
    $('btn-solo').onclick = () => go({ mode: 'solo' }, '');
    $('btn-host').onclick = () => go({ mode: 'host' }, 'Creating room…');
    const join = () => {
      const code = codeEl.value.trim().toUpperCase();
      if (code.length < 5) { status.textContent = 'Enter the 5-letter room code.'; return; }
      go({ mode: 'join', code }, 'Connecting…');
    };
    $('btn-join').onclick = join;
    codeEl.onkeydown = (e) => { if (e.key === 'Enter') join(); };
  });
}

export const menuOpen = () => !$('menu').hidden;

export function showRoom(code, isHost) {
  $('net').hidden = false;
  const btn = $('room-code');
  btn.textContent = code;
  btn.title = isHost ? 'Copy code — share it with friends' : 'Room code';
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = code; }, 1000);
    } catch { /* clipboard blocked */ }
  };
}

export function setPlayerCount(n, alive = null) {
  $('player-count').textContent = alive === null
    ? `${n} player${n === 1 ? '' : 's'}`
    : `${alive} / ${n} alive`;
}

/** Status line at the top center, with an optional action button. */
export function setBanner(text, button = null) {
  $('banner').hidden = !text;
  $('banner-text').textContent = text ?? '';
  const btn = $('banner-btn');
  btn.hidden = !button;
  if (button) {
    btn.textContent = button.label;
    btn.disabled = !!button.disabled;
    btn.onclick = button.onClick;
  }
}

export function showHealth(visible) { $('health').hidden = !visible; }

/** Health bar: the fill drops at once, a pale trail behind it shows the chunk just lost. */
export function setHealth(hp) {
  const f = Math.max(0, hp) / MAX_HP;
  const fill = $('health-fill');
  fill.style.width = `${f * 100}%`;
  fill.style.background = f > 0.5 ? '#8fd16a' : f > 0.25 ? '#e8c14a' : '#e5533d';
  $('health-trail').style.width = `${f * 100}%`;
  $('health-text').textContent = Math.max(0, Math.round(hp));
  $('health').classList.toggle('low', f > 0 && f <= 0.25);
}

function flash(el, extra = null) {
  el.classList.toggle('head', extra === 'head');
  el.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on')));
}
export const flashDamage = (head = false) => flash($('damage'), head ? 'head' : null);
export const flashHitmarker = (head = false) => flash($('hitmarker'), head ? 'head' : null);

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Kill feed / event line; `html` parts are escaped by the caller via `name()`. */
export function feed(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  $('feed').prepend(el);
  setTimeout(() => { el.style.opacity = '0'; }, 5000);
  setTimeout(() => el.remove(), 5700);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
}
export const name = (s) => `<b>${escapeHtml(s)}</b>`;

/** Big centered announcement (zone warnings) that fades after a few seconds. */
let alertTimer = 0;
export function alert(text) {
  const el = $('alert');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => el.classList.remove('on'), 3500);
}

/**
 * Quick inventory for throwables (G): one slot per type with its count; the selected one is
 * highlighted, locked ones are greyed out. Fades after a moment.
 */
let throwMenuTimer = 0;
export function showThrowMenu(slots, counts, selected) {
  const el = $('throw-menu');
  el.innerHTML = slots.map((s) => {
    const n = counts[s.type] ?? 0;
    const cls = [s.type === selected && 'on', (s.locked || !n) && 'empty'].filter(Boolean).join(' ');
    const label = s.locked ? 'soon' : `× ${n}`;
    return `<div class="${cls}"><i class="ico-${s.type}"></i><span>${escapeHtml(s.name ?? s.type[0].toUpperCase() + s.type.slice(1))}</span><small>${label}</small></div>`;
  }).join('') + (selected ? '' : '<p>No grenades — find smoke cans on the map</p>');
  el.hidden = false;
  clearTimeout(throwMenuTimer);
  throwMenuTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * End of the match: "Winner winner chicken dinner!" for the winner (PUBG style), the placement
 * for everyone else, your stats, and the full results. Counts down to the lobby.
 * stats: [{ id, name, kills, damage, place, survived, left }] best place first.
 */
let matchEndTimer = 0;
export function showMatchEnd({ selfId, winnerId, stats, duration, seconds }) {
  const el = $('match-end');
  const me = stats.find((r) => r.id === selfId);
  const won = winnerId && winnerId === selfId;
  const winner = stats.find((r) => r.id === winnerId);
  const headline = won ? 'Winner winner chicken dinner!'
    : me?.place ? `${ordinal(me.place)} place` : 'Match over';
  const sub = won ? 'Last one standing' : winner ? `${escapeHtml(winner.name)} won the match` : 'Nobody survived';
  const stat = (label, value) => `<div><b>${value}</b><span>${label}</span></div>`;
  const mine = me ? `<div class="mine">
      ${stat('Place', me.place ? `#${me.place}<small>/${stats.length}</small>` : '—')}
      ${stat('Kills', me.kills)}
      ${stat('Damage', me.damage)}
      ${stat('Survived', mmss(me.survived))}
    </div>` : '<p class="spectated">You spectated this round</p>';
  const rows = stats.map((r) => `<tr class="${r.id === selfId ? 'me' : ''}">
      <td>${r.place ? `#${r.place}` : '—'}</td><td>${escapeHtml(r.name)}${r.left ? ' <small>(left)</small>' : ''}</td>
      <td>${r.kills}</td><td>${r.damage}</td><td>${mmss(r.survived)}</td></tr>`).join('');
  el.className = won ? 'won' : '';
  el.innerHTML = `<div class="card">
      <h1>${headline}</h1><p class="sub">${sub} · match ${mmss(duration)}</p>
      ${mine}
      <table><thead><tr><th>#</th><th>Player</th><th>Kills</th><th>Damage</th><th>Survived</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="next">Back to the lobby in <span>${seconds}</span> s</p>
    </div>`;
  el.hidden = false;
  clearInterval(matchEndTimer);
  let left = seconds;
  matchEndTimer = setInterval(() => {
    left = Math.max(0, left - 1);
    const span = el.querySelector('.next span');
    if (span) span.textContent = left;
    if (left <= 0) clearInterval(matchEndTimer);
  }, 1000);
}
export function hideMatchEnd() {
  clearInterval(matchEndTimer);
  $('match-end').hidden = true;
}

export function showOverlay(text, { button } = {}) {
  const el = $('overlay');
  el.hidden = false;
  el.textContent = text;
  if (button) {
    const b = document.createElement('button');
    b.textContent = button.label;
    b.onclick = button.onClick;
    el.append(document.createElement('br'), b);
  }
}
export function hideOverlay() { $('overlay').hidden = true; }
