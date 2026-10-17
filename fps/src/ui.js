import { MAX_HP } from './player.js';

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

/**
 * Start menu. Resolves the chosen mode once the player picks one:
 * { mode: 'solo' } | { mode: 'host', name } | { mode: 'join', name, code }.
 * `connect(choice)` is awaited before the menu closes, so errors can be shown in place.
 */
export function showMenu(connect) {
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

export function setHealth(hp) {
  const f = Math.max(0, hp) / MAX_HP;
  const fill = $('health-fill');
  fill.style.width = `${f * 100}%`;
  fill.style.background = f > 0.5 ? '#8fd16a' : f > 0.25 ? '#e8c14a' : '#e5533d';
}

function flash(el) {
  el.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on')));
}
export const flashDamage = () => flash($('damage'));
export const flashHitmarker = () => flash($('hitmarker'));

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
