/* Car Screen — split screen map navigation + apps, built for the Car Screen Android app (android/). */
(() => {
'use strict';
// index.html names the build it expects. A page from one release with a script from another (a stale cache
// or a half-published update) stops here so the start-up notice can repair it, instead of failing somewhere random.
const BUILD = 35;
if (window.__want && window.__want !== BUILD) throw new Error('ไฟล์แอปคนละเวอร์ชัน (' + BUILD + '/' + window.__want + ')');
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const app = $('#app'), root = document.documentElement, body = document.body;

// The Android app exposes window.CarScreenNative: native browser views laid over parts of this page
// (pane 0 = apps side, pane 1 = Google Maps tab over the map), app updates, and requests outside CORS.
const native = window.CarScreenNative || null;
const nLoad = (id, url) => native.paneLoad ? native.paneLoad(id, url) : id === 0 && native.load(url);
const nRect = (id, x, y, w, h, show) => native.paneRect ? native.paneRect(id, x, y, w, h, show) : id === 0 && native.rect(x, y, w, h, show);
const nStop = id => native.paneStop ? native.paneStop(id) : id === 0 && native.stop();

// ===================================================================
// Storage & settings
// ===================================================================
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEFAULT_APPS = [
  { id: 'youtube', name: 'YouTube', url: 'https://m.youtube.com', color: '#ff0033', icon: 'play' },
  { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/browse', color: '#e50914', letter: 'N' },
  { id: 'ytmusic', name: 'YT Music', url: 'https://music.youtube.com', color: '#c4102b', letter: '♪' },
  { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com', color: '#1db954', letter: 'S' },
  { id: 'web', name: 'เว็บ', url: '', color: '#2c2d31', icon: 'globe' }
];
const DEF = { headingUp: true, autoZoom: true, ratio: 55, swapped: false, stack: null, mode: 'split', voice: true, evPins: true, home: null, work: null, avoid: { toll: false, motorway: false, ferry: false }, recentDest: [], apps: null };
const st = Object.assign({}, DEF, store.get('carscreen', {}));
// first run of this version: start from the defaults plus apps added earlier (st.custom)
if (!Array.isArray(st.apps)) {
  st.apps = DEFAULT_APPS.map(a => ({ ...a }));
  for (const c of st.custom || []) if (c?.url) st.apps.push({ id: 'c' + Date.now().toString(36) + st.apps.length, name: c.name, url: c.url });
}
for (const k of ['custom', 'extSeen', 'ytHistory', 'ytKey', 'ytClientId', 'navGoogle', 'longdoKey', 'autoNext', 'lastView']) delete st[k];
const save = () => store.set('carscreen', st);
save();

// ===================================================================
// Icons (Material Symbols paths, Apache 2.0)
// ===================================================================
const P = {
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  loc: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7',
  nav: 'M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71z',
  open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z',
  vol: 'M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77',
  mute: 'M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63m2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z',
  apps: 'M4 8h4V4H4zm6 12h4v-4h-4zm-6 0h4v-4H4zm0-6h4v-4H4zm6 0h4v-4h-4zm6-10v4h4V4zm-6 4h4V4h-4zm6 6h4v-4h-4zm0 6h4v-4h-4z',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39',
  map: 'm20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z',
  split: 'M3 5v14h18V5zm8 12H5V7h6zm8 0h-6V7h6z',
  play: 'M8 5v14l11-7z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99zM21 9l-3.99-4v3H10v2h7.01v3z',
  dl: 'M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z',
  tune: 'M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z',
  reload: 'M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  bolt: 'M7 2v11h3v9l7-12h-4l4-8z',
  addStop: 'M13 7h-2v3H8v2h3v3h2v-3h3v-2h-3zm-1-5C7.8 2 4 5.22 4 10.2c0 3.32 2.67 7.25 8 11.8 5.33-4.55 8-8.48 8-11.8C20 5.22 16.2 2 12 2m0 18c-4.1-3.6-6-6.6-6-9.8C6 6.6 8.7 4 12 4s6 2.6 6 6.2c0 3.2-1.9 6.2-6 9.8',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  work: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2m-6 0h-4V4h4z',
  list: 'M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z',
  fuel: 'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11A2.5 2.5 0 0 0 15.5 9 2.5 2.5 0 0 0 18 11.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5a2.5 2.5 0 0 0 5 0V9c0-.69-.28-1.32-.73-1.77M12 10H6V5h6zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1',
  food: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4',
  wc: 'M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22zM18 22v-6h3l-2.54-7.63A2.01 2.01 0 0 0 16.56 7h-.12a2 2 0 0 0-1.9 1.37L12 16h3v6zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2m9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2',
  parking: 'M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6m.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2',
  history: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18m-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z',
  // maneuver arrows
  up: 'M11 21V7.83l-4.59 4.58L5 11l7-7 7 7-1.41 1.41L13 7.83V21z',
  right: 'M14 4l5 5-5 5v-4h-4a2 2 0 0 0-2 2v8H6v-8a4 4 0 0 1 4-4h4z',
  slight: 'M13.5 4H20v6.5l-2.4-2.4-4.9 4.9c-.45.45-.7 1.06-.7 1.7V21h-2v-6.3c0-1.17.46-2.3 1.29-3.12l4.9-4.9z',
  uturn: 'M17 13l-4 4h3v4h2v-4h3zM16 13V9a5 5 0 0 0-10 0v12h2V9a3 3 0 0 1 6 0v4z',
  round: 'M12 6a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4v3l4-4-4-4z',
  flag: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
  pin: 'M15 1C8.92 1 4 5.92 4 12c0 8.25 11 27 11 27s11-18.75 11-27C26 5.92 21.08 1 15 1m0 15.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9'
};
const svg = (n, extra = '') => `<svg viewBox="0 0 ${n === 'pin' ? '30 40' : '24 24'}" aria-hidden="true"${extra}><path d="${P[n]}"/></svg>`;
const paintIcons = (scope = document) => scope.querySelectorAll('[data-i]').forEach(el => {
  if (!el.dataset.painted) { el.insertAdjacentHTML('afterbegin', svg(el.dataset.i)); el.dataset.painted = 1; }
});
const setIcon = (el, n) => { el.dataset.i = n; el.innerHTML = svg(n); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===================================================================
// Toast, snackbar, sheet, idle auto-hide, wake lock
// ===================================================================
let toastT;
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms);
}
let snackT, snackUndo = null;
function snack(msg, undo) {
  $('#snackText').textContent = msg; $('#snack').hidden = false; snackUndo = undo;
  clearTimeout(snackT); snackT = setTimeout(() => { $('#snack').hidden = true; snackUndo = null; }, 6000);
}
$('#snackUndo').onclick = () => { snackUndo?.(); snackUndo = null; $('#snack').hidden = true; };
function openSheet(html, bind) {
  const s = $('#sheet'); s.innerHTML = html; paintIcons(s);
  $('#sheetWrap').hidden = false; requestSync(); bind?.(s);
  s.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheet));
}
const closeSheet = () => { $('#sheetWrap').hidden = true; $('#sheet').innerHTML = ''; requestSync(); };
$('#sheetWrap').addEventListener('click', e => { if (e.target.id === 'sheetWrap') closeSheet(); });

let idleT;
function wake() {
  body.classList.remove('idle'); clearTimeout(idleT);
  idleT = setTimeout(() => {
    const busy = document.activeElement?.matches('input') || !$('#results').hidden || !$('#sheetWrap').hidden;
    if (busy) return wake();
    body.classList.add('idle');
  }, 4500);
}
['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, wake, { passive: true, capture: true }));

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && nav.active) keepAwake(true); });

// ===================================================================
// Layout: map / split / apps, swap, divider, bottom bar
// ===================================================================
const isStack = () => st.stack ?? (innerHeight > innerWidth);
function applyLayout() {
  app.classList.toggle('stack', isStack());
  app.classList.toggle('swapped', st.swapped);
  ['map', 'split', 'media'].forEach(m => app.classList.toggle('mode-' + m, st.mode === m));
  $$('#bar .seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
  root.style.setProperty('--ratio', st.ratio);
  map && setTimeout(() => map.invalidateSize(), 60);
  requestSync();
}
function setMode(m) { st.mode = m; save(); applyLayout(); }
addEventListener('resize', applyLayout);
// Respond to pane size as well as viewport size (divider, orientation and full-screen modes).
const mapPane = $('#mapPane');
function fitMapControls() {
  mapPane.classList.toggle('compact', mapPane.clientWidth < 480);
}
if (window.ResizeObserver) new ResizeObserver(fitMapControls).observe(mapPane);
else addEventListener('resize', fitMapControls);
fitMapControls();
$$('#bar .seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));

const div = $('#divider');
div.addEventListener('pointerdown', e => {
  e.preventDefault(); div.setPointerCapture(e.pointerId);
  div.classList.add('drag');
  const move = ev => {
    const r = $('#stage').getBoundingClientRect();
    let p = isStack() ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
    if (st.swapped) p = 1 - p;
    st.ratio = Math.round(Math.min(80, Math.max(20, p * 100)));
    root.style.setProperty('--ratio', st.ratio);
    requestSync();
  };
  const up = () => {
    div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); div.removeEventListener('pointercancel', up);
    div.classList.remove('drag'); save(); map?.invalidateSize(); requestSync();
  };
  div.addEventListener('pointermove', move); div.addEventListener('pointerup', up); div.addEventListener('pointercancel', up);
});
div.addEventListener('dblclick', () => { st.ratio = DEF.ratio; save(); applyLayout(); });

const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); };
setInterval(tickClock, 15000);

// ===================================================================
// Geo helpers
// ===================================================================
const R = 6371000, rad = d => d * Math.PI / 180;
function haversine(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
// project point p onto segment a-b (lat,lng) in a local metric plane
function projectOnSeg(p, a, b) {
  const kx = Math.cos(rad(p[0])) * 111320, ky = 110540;
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky, bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0; t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx, py = ay + t * dy;
  return { t, d: Math.hypot(px, py) };
}
const fmtDist = m => m >= 1000 ? (m >= 10000 ? Math.round(m / 1000) : (m / 1000).toFixed(1)) + ' กม.' : Math.max(10, Math.round(m / 10) * 10) + ' ม.';
const sayDist = m => m >= 1000 ? (m >= 10000 ? Math.round(m / 1000) : (Math.round(m / 100) / 10)) + ' กิโลเมตร' : (m >= 100 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10) + ' เมตร';
const fmtDur = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' นาที' : Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' นาที'; };
const fmtClock = d => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

// ===================================================================
// Thai turn instructions from OSRM steps
// ===================================================================
const SIDE = m => (m || '').includes('left') ? 'ซ้าย' : 'ขวา';
function turnWord(mod) {
  switch (mod) {
    case 'uturn': return 'กลับรถ';
    case 'sharp left': return 'เลี้ยวซ้ายหักศอก';
    case 'sharp right': return 'เลี้ยวขวาหักศอก';
    case 'left': return 'เลี้ยวซ้าย';
    case 'right': return 'เลี้ยวขวา';
    case 'slight left': return 'เบี่ยงซ้าย';
    case 'slight right': return 'เบี่ยงขวา';
    default: return 'ตรงไป';
  }
}
function instr(step) {
  const { type, modifier: mod, exit } = step.maneuver;
  const name = step.name || step.ref || '';
  let t;
  switch (type) {
    case 'depart': return name ? `มุ่งหน้าไปตาม${name}` : 'เริ่มออกเดินทาง';
    case 'arrive': return step._wp ? `ถึงจุดแวะ ${step._wp}` : 'ถึงจุดหมายปลายทาง';
    case 'roundabout': case 'rotary': t = exit ? `เข้าวงเวียน ออกทางออกที่ ${exit}` : 'เข้าวงเวียน'; break;
    case 'roundabout turn': t = `ที่วงเวียน ${turnWord(mod)}`; break;
    case 'exit roundabout': case 'exit rotary': t = 'ออกจากวงเวียน'; break;
    case 'fork': t = `ที่ทางแยก ชิด${SIDE(mod)}`; break;
    case 'merge': t = `รวมเลน ชิด${SIDE(mod)}`; break;
    case 'on ramp': t = `ขึ้นทางลาดด้าน${SIDE(mod)}`; break;
    case 'off ramp': t = `ออกทางลาดด้าน${SIDE(mod)}`; break;
    case 'end of road': t = `สุดทาง ${turnWord(mod)}`; break;
    case 'continue': case 'new name': t = mod && mod !== 'straight' ? turnWord(mod) : 'ตรงไป'; break;
    default: t = turnWord(mod);
  }
  return name ? `${t} เข้าสู่${name}` : t;
}
function arrowFor(step) {
  const { type, modifier: m = 'straight' } = step.maneuver;
  if (type === 'arrive') return svg('flag');
  if (/roundabout|rotary/.test(type) && type !== 'roundabout turn') return svg('round');
  if (m === 'uturn') return svg('uturn');
  const flip = m.includes('left') ? ' style="transform:scaleX(-1)"' : '';
  if (m.startsWith('slight')) return svg('slight', flip);
  if (m.includes('left') || m.includes('right')) return svg('right', flip);
  return svg('up');
}

// ===================================================================
// Map
// ===================================================================
// OpenStreetMap tiles (no key needed), darkened with a CSS filter for night-friendly driving
const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
// the public OSRM demo server has no guarantees, so a second public server stands by
const ROUTERS = ['https://router.project-osrm.org/route/v1/driving/', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'];
let routerFirst = 0; // the one that worked last goes first
const REFOLLOW_MS = 8000;
const AVOID = ['toll', 'motorway', 'ferry'];
const AVOID_TXT = { toll: 'ทางเสียค่าผ่านทาง', motorway: 'ทางด่วน', ferry: 'เรือข้ามฟาก' };
let map = null;
const L_ = window.L;
const here = { ll: null, acc: null, heading: null, speed: null };
let meMarker, destMarker, routeLines = [], altLines = [], stopMarkers = [], follow = true;
const nav = { dest: null, stops: [], adding: false, route: null, active: false, line: [], cum: [], stepAt: [], seg: 0, step: 1, said: {}, off: 0, lastReroute: 0, routing: false };

if (L_) {
  map = L_.map('map', { zoomControl: false, attributionControl: true, tapHold: true, rotate: !!L_.Map.prototype.setBearing, bearing: 0, rotateControl: false, touchRotate: false, shiftKeyRotate: false }).setView(store.get('carscreen.view', [13.7563, 100.5018]), 13);
  L_.tileLayer(TILE, { maxZoom: 19, className: 'dark-tiles', updateWhenZooming: false, keepBuffer: 2, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  map.attributionControl.setPrefix(false);
  // panning pauses follow mode; while navigating it snaps back after a few seconds
  let refollowT;
  map.on('dragstart', () => {
    setFollow(false); clearTimeout(refollowT);
    if (nav.active) refollowT = setTimeout(() => nav.active && !follow && setFollow(true), REFOLLOW_MS);
  });
  // remembering the view is a storage write, so not on every GPS pan
  let viewT;
  const saveView = () => { clearTimeout(viewT); store.set('carscreen.view', [map.getCenter().lat, map.getCenter().lng]); };
  map.on('moveend', () => { clearTimeout(viewT); viewT = setTimeout(saveView, 1500); });
  addEventListener('pagehide', saveView);
  map.on('contextmenu', e => pickDest({ lat: e.latlng.lat, lng: e.latlng.lng, name: 'ตำแหน่งที่เลือก', sub: `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}` }));
}

// Leaflet ignores view changes while a zoom animation is running (e.g. the zoom to the first GPS fix)
function whenMapIdle(fn) {
  if (!map) return;
  if (map._animatingZoom) map.once('zoomend', () => setTimeout(fn, 0)); else fn();
}
function setFollow(on) {
  follow = on;
  $('#recenter').classList.toggle('off', !on);
  if (on && nav.active) view.manualUntil = 0;
  if (on && here.ll && map) { if (nav.active) followView(17); else map.setView(here.ll, Math.max(map.getZoom(), 15), { animate: true }); }
}
$('#recenter').onclick = () => { if (!here.ll) startGeo(true); setFollow(true); };

// ---- Driving view: the map turns so the road ahead points up, the car is an arrow low on the screen ----
// view.shown is the map's turn in CSS degrees (what leaflet-rotate calls bearing): heading h needs 360 - h.
const view = { shown: 0, goal: 0, raf: 0, car: 0, nextDist: Infinity, zoomAt: 0, manualUntil: 0, selfZoom: false };
const canTurn = () => !!(map && map.setBearing && map.options.rotate);
const headingUpOn = () => canTurn() && nav.active && st.headingUp;
const wrap360 = a => ((a % 360) + 360) % 360;
const angDiff = (to, from) => ((to - from + 540) % 360) - 180; // shortest signed turn
let meEl;
function applyArrow() {
  if (!meEl) return;
  // the arrow points the way the car goes, measured on the screen: its heading minus how far the map is turned
  const nose = meEl.querySelector('.car');
  if (nose) nose.style.transform = `rotate(${angDiff(view.car - (360 - view.shown), 0)}deg)`;
  const c = $('#compass'); if (c) c.firstElementChild.style.transform = `rotate(${view.shown}deg)`;
}
function setTurn(t) {
  view.shown = wrap360(t);
  if (canTurn()) map.setBearing(view.shown);
  applyArrow();
}
function turnTo(goal, instant) {
  if (!canTurn()) return;
  view.goal = wrap360(goal);
  if (instant) { cancelAnimationFrame(view.raf); view.raf = 0; return setTurn(view.goal); }
  if (view.raf) return;
  const step = () => {
    const d = angDiff(view.goal, view.shown);
    if (Math.abs(d) < .4) { view.raf = 0; return setTurn(view.goal); }
    setTurn(view.shown + d * .2);
    view.raf = requestAnimationFrame(step);
  };
  view.raf = requestAnimationFrame(step);
}
// which way the car points: along the route when on it (steady), else the GPS heading
function carHeading() {
  const { line, cum } = nav;
  if (nav.route && line.length > 1 && nav.off === 0) {
    const along = cum[nav.seg], i = nav.seg;
    let j = i + 1;
    while (j < line.length - 1 && cum[j] - along < 30) j++;
    const a = line[i], b = line[j];
    if (a && b && (a[0] !== b[0] || a[1] !== b[1])) return bearing(a, b);
  }
  return here.heading != null ? here.heading : view.car;
}
// zoom like a car navigation: far out when fast, in close for a turn. A zoom the driver made is left alone for 20 s.
function wantZoom(minZoom) {
  const cur = map.getZoom();
  if (nav.active && Date.now() < view.manualUntil) return cur;
  if (!nav.active || st.autoZoom === false) return Math.max(cur, minZoom || 16);
  const kmh = here.speed != null && here.speed > 0 ? here.speed * 3.6 : 0;
  let z = kmh >= 80 ? 15 : kmh >= 45 ? 16 : 17;
  const turn = view.nextDist <= 200;
  if (turn) z = Math.min(18, z + 1);
  // zoom in for a turn at once; otherwise change at most every 5 s so the map does not breathe
  if (z !== cur && !(turn && z > cur) && Date.now() - view.zoomAt < 5000) return cur;
  if (z !== cur) view.zoomAt = Date.now();
  return z;
}
function followView(minZoom) {
  if (!map || !here.ll || map._animatingZoom) return; // mid-zoom the zoom level is stale: wait, zoomend calls us again
  const z = wantZoom(minZoom);
  view.selfZoom = z !== map.getZoom();
  let c = here.ll;
  if (headingUpOn()) {
    const target = carHeading();
    view.car = wrap360(view.car + angDiff(target, view.car) * .5); // steady, not twitchy
    if (Math.abs(angDiff(360 - view.car, view.goal)) >= 2) turnTo(360 - view.car);
    // keep the car in the lower part of the map: aim the view ahead of it, along the screen's "up"
    const h = (360 - view.shown) * Math.PI / 180, dy = map.getSize().y * .2, px = map.project(c, z);
    c = map.unproject(px.add([Math.sin(h) * dy, -Math.cos(h) * dy]), z);
  } else view.car = here.heading != null ? here.heading : view.car;
  map.setView(c, z, { animate: true });
}
if (map) {
  map.on('zoomstart', () => { if (!view.selfZoom) view.manualUntil = Date.now() + 20000; });
  map.on('zoomend', () => { view.selfZoom = false; if (nav.active && follow) followView(16); });
}
function drawMe() {
  if (!map || !here.ll) return;
  if (!meMarker) {
    meMarker = L_.marker(here.ll, { icon: L_.divIcon({ className: '', html: `<div class="me"><b></b><i></i>${svg('nav', ' class="car"')}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
    meEl = meMarker.getElement().firstChild;
  } else meMarker.setLatLng(here.ll);
  meEl.classList.toggle('dir', here.heading != null);
  meEl.classList.toggle('nav', nav.active);
  meEl.firstChild.style.transform = `rotate(${here.heading || 0}deg)`;
  if (!nav.active && here.heading != null) view.car = here.heading;
  applyArrow();
}

let geoId = null;
function startGeo(user) {
  if (!navigator.geolocation) return toast('อุปกรณ์นี้ไม่รองรับ GPS');
  if (geoId != null) { if (user && !here.ll) toast('กำลังหาตำแหน่ง…'); return; }
  geoId = navigator.geolocation.watchPosition(onPos, err => {
    geoId != null && navigator.geolocation.clearWatch(geoId); geoId = null;
    if (user || nav.active) toast(err.code === 1 ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ตำแหน่งให้ Car Screen' : 'หาตำแหน่งไม่ได้ ลองอีกครั้ง');
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
}
function onPos(p) {
  const ll = [p.coords.latitude, p.coords.longitude];
  const first = !here.ll;
  if (here.ll && haversine(here.ll, ll) > 3) here.heading = bearing(here.ll, ll);
  if (p.coords.heading != null && !isNaN(p.coords.heading) && (p.coords.speed || 0) > 1) here.heading = p.coords.heading;
  here.ll = ll; here.acc = p.coords.accuracy; here.speed = p.coords.speed;
  drawMe();
  if (first && follow && !nav.route) map?.setView(ll, 15);
  else if (follow && map && !nav.active) map.panTo(ll, { animate: true, duration: .5 }); // while navigating, navTick moves the map
  if (nav.active) navTick();
}

async function getJSON(url, ms = 8000, opts = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ===================================================================
// Search: Google Maps, shown as a tab over the map
// ===================================================================
const qEl = $('#q'), resEl = $('#results');
function showResults(html) { resEl.innerHTML = html; resEl.hidden = !html; paintIcons(resEl); }
function renderRecent() {
  if (!st.recentDest.length) return showResults('');
  showResults('<div class="label">ล่าสุด</div>' + st.recentDest.map((d, i) =>
    `<button class="ritem" data-recent="${i}"><span class="ic" data-i="history"></span><div class="grow"><div class="t ellipsis">${esc(d.name)}</div><div class="muted ellipsis">${esc(d.sub || '')}</div></div></button>`).join(''));
}
qEl.addEventListener('focus', () => { if (!qEl.value) renderRecent(); });
qEl.addEventListener('input', () => { $('#qClear').hidden = !qEl.value; if (!qEl.value) renderRecent(); else showResults(''); });
$('#qClear').onclick = () => { qEl.value = ''; $('#qClear').hidden = true; showResults(''); qEl.focus(); };
document.addEventListener('pointerdown', e => { if (!resEl.hidden && !e.target.closest('#results,#search')) showResults(''); });
resEl.addEventListener('click', e => {
  const b = e.target.closest('[data-recent]'); if (!b) return;
  qEl.blur(); pickDest(st.recentDest[+b.dataset.recent]);
});

// Google Maps links: full links carry the pin; short maps.app.goo.gl links are resolved by the app
function parseGmaps(url) {
  const n = '(-?\\d{1,3}\\.\\d+)';
  const m = url.match(new RegExp('!3d' + n + '!4d' + n)) || url.match(new RegExp('[?&](?:q|ll|query|destination|daddr)=' + n + '(?:,|%2C)\\+?' + n))
    || url.match(new RegExp('@' + n + ',' + n));
  if (!m) return null;
  const name = decodeURIComponent((url.match(/\/place\/([^/@?]+)/) || [])[1] || '').replace(/\+/g, ' ');
  return { lat: +m[1], lng: +m[2], name: name || 'ตำแหน่งจาก Google Maps', sub: `${(+m[1]).toFixed(5)}, ${(+m[2]).toFixed(5)}` };
}
let httpSeq = 0; const httpWait = {};
window.__http = (id, status, finalUrl, body) => { httpWait[id]?.({ status, finalUrl, body }); delete httpWait[id]; };
function nativeGet(url, ms = 12000) {
  if (!native?.httpGet) return Promise.reject(new Error('no-native'));
  return new Promise((res, rej) => {
    const id = ++httpSeq; httpWait[id] = res; native.httpGet(id, url);
    setTimeout(() => { if (httpWait[id]) { delete httpWait[id]; rej(new Error('timeout')); } }, ms);
  });
}
async function openGmapsLink(q) {
  const url = /^https?:/i.test(q) ? q : 'https://' + q;
  let d = parseGmaps(url);
  if (!d) { try { const r = await nativeGet(url); d = parseGmaps(r.finalUrl || '') || parseGmaps(r.body || ''); } catch {} }
  if (!d) return toast('อ่านตำแหน่งจากลิงก์นี้ไม่ได้');
  pickDest(d);
}
$('#search').onsubmit = e => {
  e.preventDefault();
  const q = qEl.value.trim(); if (!q) return;
  qEl.blur(); showResults('');
  const coord = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coord) return pickDest({ lat: +coord[1], lng: +coord[2], name: q, sub: 'พิกัด' });
  if (/^(https?:\/\/)?([a-z]+\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(q)) return openGmapsLink(q);
  gmapsSearch(q);
};

// Google Maps tab: a native browser view over #gmHost. Opening a place there arrives through
// __gmUrl, and "ไปที่นี่" sets it as the destination and closes the tab.
const gm = { open: false, shown: false, place: null, key: '' };
function gmShow(on) {
  gm.shown = on;
  $('#gmPanel').hidden = !on;
  $('#gmTab').hidden = on || !gm.open;
  syncGm();
}
function gmClose() {
  if (!gm.open) return;
  gm.open = false; gm.place = null; $('#gmPick').hidden = true;
  gmShow(false);
  try { nStop(1); } catch {}
}
function syncGm() {
  if (!native?.paneRect) return;
  const r = $('#gmHost').getBoundingClientRect();
  const show = gm.open && gm.shown && st.mode !== 'media' && $('#sheetWrap').hidden && r.width > 0;
  const key = [r.left, r.top, r.width, r.height].map(Math.round).join() + show;
  if (key === gm.key) return;
  gm.key = key;
  try { native.paneRect(1, r.left, r.top, r.width, r.height, show); } catch {}
}
window.__gmUrl = url => {
  if (!gm.open || !/\/maps\/place\//.test(url || '')) return;
  const d = parseGmaps(url);
  if (!d || !/!3d/.test(url) && !d.name) return;
  gm.place = d;
  $('#gmPickName').textContent = d.name;
  $('#gmPick').hidden = false;
  syncGm();
};
$('#gmPickGo').onclick = () => { const d = gm.place; gmClose(); if (d) pickDest(d); };
$('#gmToMap').onclick = () => gmShow(false);
$('#gmTab').onclick = () => gmShow(true);
$('#gmX').onclick = gmClose;
function gmapsSearch(q) {
  if (!native?.paneLoad) return toast(native ? 'อัปเดตแอป Car Screen เป็นเวอร์ชันล่าสุดเพื่อค้นหาด้วย Google Maps' : 'ค้นหาด้วย Google Maps ใช้ได้ในแอป Android ของ Car Screen', 6000);
  const c = here.ll || (map ? [map.getCenter().lat, map.getCenter().lng] : [13.7563, 100.5018]);
  if (st.mode === 'media') setMode('split');
  gm.open = true; gm.place = null;
  $('#gmTitle').textContent = q; $('#gmPick').hidden = true;
  gmShow(true);
  native.paneLoad(1, `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${c[0]},${c[1]},14z`);
}

// ===================================================================
// Destination & route
// ===================================================================
function pickDest(d) {
  if (placePick) return finishPlace(d);
  if (nav.adding && nav.dest) return addStop(d);
  gmClose(); showResults('');
  qEl.value = d.name; $('#qClear').hidden = false;
  nav.dest = d; nav.stops = []; drawStops(); renderStops();
  st.recentDest = [d, ...st.recentDest.filter(x => Math.abs(x.lat - d.lat) + Math.abs(x.lng - d.lng) > 1e-5)].slice(0, 8).map(({ lat, lng, name, sub }) => ({ lat, lng, name, sub }));
  save();
  if (map) {
    destMarker?.remove();
    destMarker = L_.marker([d.lat, d.lng], { icon: L_.divIcon({ className: '', html: `<div class="pin">${svg('pin')}</div>`, iconSize: [30, 40], iconAnchor: [15, 40] }) }).addTo(map);
  }
  $('#rcName').textContent = d.name;
  $('#rcMeta').textContent = 'กำลังหาเส้นทาง…';
  $('#rcAlts').innerHTML = '';
  $('#routeCard').hidden = false; $('#mapPane').classList.add('has-card');
  if (st.mode === 'media') setMode('split');
  route();
}

async function route(reroute) {
  if (!nav.dest) return;
  if (!here.ll) {
    startGeo(true);
    $('#rcMeta').textContent = 'รอตำแหน่ง GPS…';
    const ok = await new Promise(res => { const t0 = Date.now(), iv = setInterval(() => { if (here.ll || Date.now() - t0 > 15000) { clearInterval(iv); res(!!here.ll); } }, 300); });
    if (!ok) { $('#rcMeta').textContent = 'ต้องเปิดตำแหน่ง (GPS) เพื่อหาเส้นทาง'; return; }
  }
  nav.routing = true;
  const pts = [here.ll, ...nav.stops.map(s => [s.lat, s.lng]), [nav.dest.lat, nav.dest.lng]];
  const many = nav.stops.length > 0; // OSRM offers alternatives only between two points
  const coords = pts.map(p => p[1] + ',' + p[0]).join(';');
  const q = `?overview=false&steps=true&geometries=geojson&alternatives=${reroute || many ? 'false' : 3}`;
  const want = AVOID.filter(k => st.avoid[k]);
  // a server may only accept one class per request: try all, then one at a time, then none.
  // A server that is down (timeout, 5xx) is skipped for the next one; a refused request (4xx) is not.
  const tries = [want, ...(want.length > 1 ? want.map(k => [k]) : []), ...(want.length ? [[]] : [])];
  try {
    let j, used, last;
    search: for (let n = 0; n < ROUTERS.length; n++) {
      const ri = (routerFirst + n) % ROUTERS.length;
      for (const ex of tries) {
        try {
          j = await getJSON(ROUTERS[ri] + coords + q + (ex.length ? '&exclude=' + ex.join(',') : ''), n ? 15000 : 9000);
          if (j.code === 'Ok' && j.routes?.length) { used = ex; routerFirst = ri; break search; }
          last = new Error(j.code);
        } catch (e) { last = e; if (!/^HTTP 4/.test(e.message)) break; }
      }
      if (last?.message === 'NoRoute') break;
    }
    if (!used) throw last;
    const missed = want.filter(k => !used.includes(k));
    if (missed.length && !reroute) toast('เลี่ยง' + missed.map(k => AVOID_TXT[k]).join(' และ') + 'ไม่ได้ในเส้นทางนี้', 5000);
    nav.alts = reroute ? [] : j.routes;
    nav.altIdx = 0;
    setRoute(j.routes[0]);
    if (!reroute) {
      renderAlts();
      const b = L_.latLngBounds(j.routes.flatMap(r => routeLine(r).line));
      whenMapIdle(() => map.fitBounds(b, { padding: [60, 60] }));
      setFollow(false);
    }
  } catch (err) {
    if (reroute) toast('คำนวณเส้นทางใหม่ไม่ได้');
    else $('#rcMeta').textContent = err?.message === 'NoRoute' ? 'ไม่พบเส้นทางขับรถไปจุดนี้' : 'หาเส้นทางไม่ได้ ตรวจสอบอินเทอร์เน็ต';
  } finally { nav.routing = false; }
}

function routeLine(r) {
  const line = [], stepAt = [], steps = [];
  r.legs.forEach((leg, li) => leg.steps.forEach(s => {
    const pts = s.geometry.coordinates.map(c => [c[1], c[0]]);
    if (line.length && pts.length) pts.shift();
    // a stop's arrival becomes "ถึงจุดแวะ …"; the next leg's "depart" adds nothing
    if (s.maneuver.type === 'arrive' && li < r.legs.length - 1) s._wp = nav.stops[li]?.name || 'จุดแวะ';
    const skip = /^exit (roundabout|rotary)$/.test(s.maneuver.type) || (s.maneuver.type === 'depart' && li > 0);
    if (!skip) { steps.push(s); stepAt.push(Math.max(0, line.length - 1)); }
    line.push(...pts);
  }));
  if (line.length < 2) line.push(line[0] || here.ll);
  return { line, stepAt, steps };
}
// road classes OSRM reports along the route: toll, motorway, ferry
const routeClasses = r => new Set(r.legs.flatMap(l => l.steps.flatMap(s => (s.intersections || []).flatMap(i => i.classes || []))));
function routeChips(r) {
  const c = routeClasses(r), out = [];
  if (c.has('toll')) out.push('<span class="chip warn">เสียค่าผ่านทาง</span>');
  if (c.has('motorway')) out.push('<span class="chip">ทางด่วน</span>');
  if (c.has('ferry')) out.push('<span class="chip warn">เรือข้ามฟาก</span>');
  if (!c.has('toll')) out.push('<span class="chip ok">ไม่มีค่าผ่านทาง</span>');
  return out.join('');
}
function renderAlts() {
  const alts = nav.alts || [], r = nav.route;
  $('#rcMeta').textContent = `${fmtDist(r.distance)} · ${fmtDur(r.duration)}` + (AVOID.some(k => st.avoid[k]) ? ' · เลี่ยง' + AVOID.filter(k => st.avoid[k]).map(k => AVOID_TXT[k]).join(', ') : '');
  $('#rcAlts').innerHTML = alts.map((a, i) => `<button class="alt${i === nav.altIdx ? ' on' : ''}" data-alt="${i}">
      <b>${fmtDur(a.duration)}</b><span class="muted">${fmtDist(a.distance)}${i === 0 && alts.length > 1 ? ' · เร็วที่สุด' : ''}</span>${routeChips(a)}</button>`).join('');
  drawAlts();
}
function drawAlts() {
  altLines.forEach(l => l.remove()); altLines = [];
  if (!map || nav.active) return;
  (nav.alts || []).forEach((a, i) => {
    if (i === nav.altIdx) return;
    const l = L_.polyline(routeLine(a).line, { color: '#5a5f69', weight: 7, opacity: .8 }).addTo(map);
    l.on('click', () => pickAlt(i)); l.bringToBack(); altLines.push(l);
  });
}
function pickAlt(i) { nav.altIdx = i; setRoute(nav.alts[i]); renderAlts(); }
$('#rcAlts').addEventListener('click', e => { const b = e.target.closest('[data-alt]'); if (b) pickAlt(+b.dataset.alt); });

function routeOptsSheet() {
  const row = (id, t, on) => `<label class="set-row"><span class="t">${t}</span><input type="checkbox" class="toggle" id="${id}" ${on ? 'checked' : ''}></label>`;
  openSheet(`<h2>ตัวเลือกเส้นทาง</h2>
    ${row('oToll', 'เลี่ยงทางที่เสียค่าผ่านทาง', st.avoid.toll)}
    ${row('oMotorway', 'เลี่ยงทางด่วน / มอเตอร์เวย์', st.avoid.motorway)}
    ${row('oFerry', 'เลี่ยงเรือข้ามฟาก', st.avoid.ferry)}
    <div class="sheet-actions"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="oSave">ใช้</button></div>`, s => {
    s.querySelector('#oSave').onclick = () => {
      st.avoid = { toll: s.querySelector('#oToll').checked, motorway: s.querySelector('#oMotorway').checked, ferry: s.querySelector('#oFerry').checked };
      save(); closeSheet(); optsBadge();
      if (nav.dest) { $('#rcMeta').textContent = 'กำลังหาเส้นทาง…'; route(nav.active); }
    };
  });
}
const optsBadge = () => $('#rcOpts').classList.toggle('on', AVOID.some(k => st.avoid[k]));
$('#rcOpts').onclick = routeOptsSheet;

function setRoute(r) {
  const { line, stepAt, steps } = routeLine(r);
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
  Object.assign(nav, { route: r, steps, line, cum, stepAt: stepAt.map(i => cum[i]), seg: 0, step: 1, said: {}, off: 0 });
  if (map) {
    routeLines.forEach(l => l.remove());
    routeLines = [
      L_.polyline(line, { color: '#0d1f4a', weight: 12, opacity: .95, interactive: false }).addTo(map),
      L_.polyline(line, { color: '#3e6ae1', weight: 7, opacity: 1, interactive: false }).addTo(map)
    ];
  }
  if (nav.active) navTick();
}

function clearRoute() {
  stopNav(true);
  nav.dest = nav.route = null; nav.stops = []; drawStops(); renderStops(); setStopMode(false);
  routeLines.forEach(l => l.remove()); routeLines = [];
  nav.alts = []; drawAlts();
  destMarker?.remove(); destMarker = null;
  $('#routeCard').hidden = true; $('#mapPane').classList.remove('has-card');
  qEl.value = ''; $('#qClear').hidden = true;
}
$('#rcClose').onclick = clearRoute;
$('#rcGo').onclick = () => { if (nav.route) startNav(); else route(); };

// ===================================================================
// Stops along the way
// ===================================================================
function setStopMode(on) {
  if (on) setPlacePick(null);
  nav.adding = on;
  $('#stopMode').hidden = !on;
  qEl.placeholder = on ? 'ค้นหาจุดแวะ' : 'ไปที่ไหน';
  $('#gmPickGo').lastChild.textContent = on ? 'แวะที่นี่' : 'ไปที่นี่';
  if (on) { qEl.value = ''; $('#qClear').hidden = true; }
  else if (nav.dest && !qEl.value) qEl.value = nav.dest.name;
}
$('#stopMode').onclick = () => { setStopMode(false); setPlacePick(null); };
function addStop(d) {
  setStopMode(false); gmClose(); showResults('');
  nav.stops.push({ lat: d.lat, lng: d.lng, name: d.name, sub: d.sub });
  qEl.value = nav.dest.name;
  drawStops(); renderStops();
  toast('เพิ่มจุดแวะ ' + d.name, 2500);
  if (!nav.active) $('#rcMeta').textContent = 'กำลังหาเส้นทาง…';
  route(nav.active);
}
function removeStop(i) {
  nav.stops.splice(i, 1);
  drawStops(); renderStops();
  $('#rcMeta').textContent = 'กำลังหาเส้นทาง…';
  route(nav.active);
}
function renderStops() {
  $('#rcStops').innerHTML = nav.stops.map((s, i) => `<div class="stop"><span class="n">${i + 1}</span>
    <div class="grow"><div class="ellipsis">แวะ ${esc(s.name)}</div></div>
    <button class="icon-btn" data-rmstop="${i}" aria-label="ลบจุดแวะ ${esc(s.name)}">${svg('close')}</button></div>`).join('');
}
$('#rcStops').addEventListener('click', e => { const b = e.target.closest('[data-rmstop]'); if (b) removeStop(+b.dataset.rmstop); });
function drawStops() {
  stopMarkers.forEach(m => m.remove()); stopMarkers = [];
  if (!map) return;
  nav.stops.forEach((s, i) => stopMarkers.push(L_.marker([s.lat, s.lng], { icon: L_.divIcon({ className: '', html: `<div class="stop-pin">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false }).addTo(map)));
}
$('#rcAddStop').onclick = () => {
  openSheet(`<h2>เพิ่มจุดแวะ</h2>
    <button class="set-row ritem" id="asEv"><span class="ic ev-ic" data-i="bolt"></span><div class="grow"><div class="t">ที่ชาร์จ ปั๊ม ร้านอาหาร ระหว่างทาง</div></div></button>
    <button class="set-row ritem" id="asSearch"><span class="ic" data-i="search"></span><div class="grow"><div class="t">ค้นหาสถานที่</div><div class="muted">หรือกดค้างบนแผนที่</div></div></button>
    ${st.recentDest.filter(d => d.name !== nav.dest?.name).slice(0, 5).map((d, i) => `<button class="set-row ritem" data-asrecent="${st.recentDest.indexOf(d)}"><span class="ic" data-i="history"></span><div class="grow"><div class="t ellipsis">${esc(d.name)}</div></div></button>`).join('')}
    <div class="sheet-actions"><button class="btn" data-close>ยกเลิก</button></div>`, s => {
    s.querySelector('#asEv').onclick = () => { closeSheet(); openEv('route'); };
    s.querySelector('#asSearch').onclick = () => { closeSheet(); setStopMode(true); qEl.focus(); };
    s.querySelectorAll('[data-asrecent]').forEach(b => b.onclick = () => { closeSheet(); addStop(st.recentDest[+b.dataset.asrecent]); });
  });
};

// ===================================================================
// Home & work: one tap to navigate, press and hold to change
// ===================================================================
const PLACE = { home: { label: 'บ้าน' }, work: { label: 'ที่ทำงาน' } };
let placePick = null; // while set, the next place chosen (search, map, Google Maps) becomes home/work instead of a destination
function setPlacePick(kind) {
  placePick = kind;
  $('#stopMode').hidden = !kind && !nav.adding;
  $('#stopModeT').textContent = kind ? `เลือกที่ตั้ง${PLACE[kind].label}: ค้นหาหรือกดค้างบนแผนที่` : 'เลือกจุดแวะ: ค้นหาหรือกดค้างบนแผนที่';
  qEl.placeholder = kind ? 'ค้นหา' + PLACE[kind].label : nav.adding ? 'ค้นหาจุดแวะ' : 'ไปที่ไหน';
  $('#gmPickGo').lastChild.textContent = kind ? 'ตั้งเป็น' + PLACE[kind].label : nav.adding ? 'แวะที่นี่' : 'ไปที่นี่';
  if (kind) { qEl.value = ''; $('#qClear').hidden = true; }
  else if (nav.dest && !qEl.value) qEl.value = nav.dest.name;
}
function setPlace(kind, d) {
  st[kind] = d ? { lat: d.lat, lng: d.lng, name: d.name } : null;
  save(); renderQuick();
}
function finishPlace(d) {
  const kind = placePick;
  qEl.value = ''; $('#qClear').hidden = true;
  setPlacePick(null); gmClose(); showResults('');
  setPlace(kind, { ...d, name: Object.values(PLACE).some(p => p.label === d.name) && d.sub ? d.sub : d.name });
  toast(`ตั้ง${PLACE[kind].label}เป็น ${st[kind].name}`, 3000);
}
function goPlace(kind) {
  setPlacePick(null);
  const p = st[kind];
  if (!p) return placeSheet(kind);
  qEl.blur(); showResults('');
  pickDest({ lat: p.lat, lng: p.lng, name: PLACE[kind].label, sub: p.name });
}
function placeSheet(kind, back) {
  const label = PLACE[kind].label, cur = st[kind], cands = [];
  const labels = Object.values(PLACE).map(p => p.label);
  if (here.ll) cands.push({ icon: 'loc', t: 'ตำแหน่งปัจจุบัน', d: { lat: here.ll[0], lng: here.ll[1], name: 'ตำแหน่งที่บันทึกไว้' } });
  if (nav.dest) cands.push({ icon: 'flag', t: nav.dest.name, sub: 'ปลายทางที่เลือกอยู่', d: nav.dest });
  st.recentDest.slice(0, 6).forEach(r => cands.push({ icon: 'history', t: r.name, sub: r.sub, d: r }));
  const done = () => back ? settingsSheet() : closeSheet();
  openSheet(`<h2>${cur ? `${label} · ${esc(cur.name)}` : `ตั้ง${label}`}</h2>
    <button class="set-row ritem" id="pcSearch"><span class="ic" data-i="search"></span><div class="grow"><div class="t">ค้นหาสถานที่</div><div class="muted">หรือกดค้างบนแผนที่</div></div></button>
    ${cands.map((c, i) => `<button class="set-row ritem" data-pc="${i}"><span class="ic" data-i="${c.icon}"></span><div class="grow"><div class="t ellipsis">${esc(c.t)}</div>${c.sub ? `<div class="muted ellipsis">${esc(c.sub)}</div>` : ''}</div></button>`).join('')}
    <div class="sheet-actions">${cur ? '<button class="btn" id="pcDel">ลบ' + label + '</button>' : ''}<button class="btn" id="pcCancel">ยกเลิก</button></div>`, sh => {
    sh.querySelector('#pcCancel').onclick = done;
    sh.querySelector('#pcSearch').onclick = () => { closeSheet(); setPlacePick(kind); qEl.focus(); };
    sh.querySelector('#pcDel')?.addEventListener('click', () => { setPlace(kind, null); done(); });
    sh.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => {
      const d = cands[+b.dataset.pc].d;
      setPlace(kind, { ...d, name: labels.includes(d.name) && d.sub ? d.sub : d.name });
      toast(`ตั้ง${label}แล้ว`, 2000); done();
    });
  });
}
function renderQuick() {
  for (const [id, kind] of [['qHome', 'home'], ['qWork', 'work']]) {
    const b = $('#' + id);
    b.classList.toggle('set', !!st[kind]);
    b.setAttribute('aria-label', st[kind] ? `ไป${PLACE[kind].label}: ${st[kind].name}` : `ตั้ง${PLACE[kind].label}`);
  }
}
for (const [id, kind] of [['qHome', 'home'], ['qWork', 'work']]) {
  const b = $('#' + id); let t, long = false;
  b.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; placeSheet(kind); }, 600); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
  b.addEventListener('click', () => { if (long) { long = false; return; } goPlace(kind); });
}

// ===================================================================
// Backup: one text code carries the settings, apps, home/work and recent places to another device
// ===================================================================
const BACKUP_KEYS = ['headingUp', 'autoZoom', 'ratio', 'swapped', 'stack', 'mode', 'voice', 'evPins', 'avoid', 'recentDest', 'home', 'work', 'apps'];
function backupCode() {
  const o = {};
  BACKUP_KEYS.forEach(k => o[k] = st[k]);
  o.apps = st.apps.map(({ id, name, url, color, icon, letter, logo, logoFull }) => ({ id, name, url, color, icon, letter, logo, logoFull }));
  return 'CS1.' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
// accepts only what the app itself would have written; anything else in the code is dropped
function readBackup(text) {
  const m = String(text).match(/CS1\.([A-Za-z0-9+/=_-]+)/);
  if (!m) throw new Error('รหัสไม่ถูกต้อง');
  let o; try { o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch { throw new Error('อ่านรหัสไม่ได้'); }
  if (!o || typeof o !== 'object') throw new Error('อ่านรหัสไม่ได้');
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const web = v => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && v.length <= 500 ? v : ''; } catch { return ''; } };
  const place = v => v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
    ? { lat: v.lat, lng: v.lng, name: str(v.name, 80) || 'ตำแหน่งที่บันทึกไว้' } : null;
  const out = {};
  if (Number.isFinite(o.ratio)) out.ratio = Math.min(80, Math.max(20, Math.round(o.ratio)));
  for (const k of ['swapped', 'voice', 'evPins', 'headingUp', 'autoZoom']) if (typeof o[k] === 'boolean') out[k] = o[k];
  if (o.stack === null || typeof o.stack === 'boolean') out.stack = o.stack;
  if (['map', 'split', 'media'].includes(o.mode)) out.mode = o.mode;
  if (o.avoid && typeof o.avoid === 'object') out.avoid = { toll: !!o.avoid.toll, motorway: !!o.avoid.motorway, ferry: !!o.avoid.ferry };
  if (Array.isArray(o.recentDest)) out.recentDest = o.recentDest.slice(0, 8).map(r => r && place(r) && { ...place(r), sub: str(r.sub, 120) }).filter(Boolean);
  for (const k of ['home', 'work']) if (k in o) out[k] = place(o[k]);
  if (Array.isArray(o.apps)) {
    const ids = new Set();
    const apps = o.apps.slice(0, 40).map((a, i) => {
      if (!a || !str(a.name, 40).trim()) return null;
      let id = str(a.id, 40).replace(/[^\w-]/g, '') || 'c' + i; while (ids.has(id)) id += 'x'; ids.add(id);
      const r = { id, name: str(a.name, 40).trim(), url: a.url ? web(a.url) : '' };
      if (/^#[0-9a-f]{3,8}$/i.test(a.color)) r.color = a.color;
      if (a.icon && Object.prototype.hasOwnProperty.call(P, a.icon)) r.icon = a.icon;
      if (str(a.letter, 2)) r.letter = str(a.letter, 2);
      if (a.logo && web(a.logo)) { r.logo = a.logo; r.logoFull = !!a.logoFull; }
      return r;
    }).filter(Boolean);
    if (apps.length) out.apps = apps;
  }
  if (!Object.keys(out).length) throw new Error('ไม่พบการตั้งค่าในรหัสนี้');
  return out;
}
function applyBackup(out) {
  Object.assign(st, out);
  if (media.app) closeApp(true);
  save(); applyLayout(); renderApps(); setVoiceIcon(); optsBadge(); renderQuick(); clearPins(); updatePins();
}
function backupSheet() {
  const code = backupCode();
  openSheet(`<h2>สำรอง / ย้ายการตั้งค่า</h2>
    <p class="muted">คัดลอกรหัสนี้ไปวางในอีกเครื่อง จะได้แอป บ้าน/ที่ทำงาน ปลายทางล่าสุด และการตั้งค่าเหมือนกัน</p>
    <textarea id="bkOut" readonly rows="3">${esc(code)}</textarea>
    <div class="sheet-actions" style="margin-top:8px"><button class="btn" id="bkCopy">คัดลอกรหัส</button></div>
    <label class="field">วางรหัสจากอีกเครื่องเพื่อกู้คืน<textarea id="bkIn" rows="3" placeholder="CS1.…" autocapitalize="off" spellcheck="false"></textarea></label>
    <div class="sheet-actions"><button class="btn" id="bkBack">ย้อนกลับ</button><button class="btn primary" id="bkRestore">กู้คืน</button></div>`, sh => {
    sh.querySelector('#bkCopy').onclick = async () => {
      const ta = sh.querySelector('#bkOut');
      try { await navigator.clipboard.writeText(code); } catch { ta.select(); try { document.execCommand('copy'); } catch {} }
      toast('คัดลอกรหัสแล้ว', 2000);
    };
    sh.querySelector('#bkBack').onclick = settingsSheet;
    sh.querySelector('#bkRestore').onclick = () => {
      try { applyBackup(readBackup(sh.querySelector('#bkIn').value)); closeSheet(); toast('กู้คืนการตั้งค่าแล้ว', 3000); }
      catch (e) { toast(e.message, 3500); }
    };
  });
}

// ===================================================================
// EV charging stations (OpenStreetMap via Overpass): near me, or along the route
// ===================================================================
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
// [OSM socket tag, label, DC fast charging]
const SOCKETS = [['type2_combo', 'CCS2', true], ['chademo', 'CHAdeMO', true], ['gb_dc', 'GB/T DC', true], ['type2', 'Type 2', false], ['type2_cable', 'Type 2', false], ['type1', 'Type 1', false], ['gb_ac', 'GB/T AC', false]];
const ev = { open: false, cat: 'ev', where: 'near', dc: false, all: [], markers: [], seq: 0, sel: null };
async function overpass(q) {
  for (const u of OVERPASS) {
    try { return await getJSON(u, 25000, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }); } catch {}
  }
  throw new Error('overpass');
}
const CATS = {
  ev: { label: 'ที่ชาร์จ', icon: 'bolt', sel: '["amenity"="charging_station"]', near: 15000, corridor: 3000, window: Infinity, google: 'สถานีชาร์จรถไฟฟ้า' },
  fuel: { label: 'ปั๊มน้ำมัน', icon: 'fuel', sel: '["amenity"="fuel"]', near: 8000, corridor: 1500, window: 60000, google: 'ปั๊มน้ำมัน' },
  food: { label: 'ร้านอาหาร', icon: 'food', sel: '["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]', near: 2500, corridor: 600, window: 15000, google: 'ร้านอาหาร' },
  toilet: { label: 'ห้องน้ำ', icon: 'wc', sel: '["amenity"="toilets"]', near: 8000, corridor: 1500, window: 60000, google: 'ห้องน้ำสาธารณะ' },
  parking: { label: 'ที่จอดรถ', icon: 'parking', sel: '["amenity"="parking"]["access"!~"^(private|customers|permit)$"]["parking"!~"^(street_side|lane)$"]', near: 2500, corridor: 600, window: 15000, google: 'ที่จอดรถ' }
};
// a few facts worth a chip, from the OpenStreetMap tags
function placeTags(t, cat) {
  const out = [];
  if (t.opening_hours === '24/7') out.push('24 ชม.');
  if (cat === 'fuel') { if (t['fuel:diesel'] === 'yes') out.push('ดีเซล'); if (['fuel:e10', 'fuel:octane_91', 'fuel:octane_95'].some(k => t[k] === 'yes')) out.push('แก๊สโซฮอล์'); }
  if (cat === 'food') (t.cuisine || '').split(';').slice(0, 2).forEach(c => c && out.push(c.replace(/_/g, ' ')));
  if (cat === 'parking') { if (t.fee === 'no') out.push('ฟรี'); else if (t.fee === 'yes') out.push('มีค่าบริการ'); if (t.capacity) out.push(t.capacity + ' คัน'); }
  if (cat === 'toilet' && t.fee === 'yes') out.push('มีค่าบริการ');
  return out;
}
function parseStation(e, cat = 'ev') {
  const t = e.tags || {};
  const sockets = [];
  if (cat === 'ev') for (const [k, label, dc] of SOCKETS) {
    const n = t['socket:' + k];
    if (!n || n === 'no' || n === '0' || sockets.some(s => s.label === label)) continue;
    const out = parseFloat(t['socket:' + k + ':output']);
    sockets.push({ label, dc, kw: isNaN(out) ? null : out });
  }
  return {
    id: e.type + e.id, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, cat,
    name: t['name:th'] || t.name || t.brand || t.operator || (cat === 'ev' ? 'สถานีชาร์จ' : CATS[cat].label),
    op: t.operator || t.brand || '', sockets, tags: placeTags(t, cat), dc: sockets.some(s => s.dc)
  };
}
// distance from a point to the route and how far along the route it sits
function nearRoute(p) {
  const { line, cum } = nav;
  let best = { d: Infinity, along: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const r = projectOnSeg(p, line[i], line[i + 1]);
    if (r.d < best.d) best = { d: r.d, along: cum[i] + r.t * (cum[i + 1] - cum[i]) };
  }
  return best;
}
// Charging stations always on the map (bundled DC list): zoomed in enough, the ones in view
const PIN_ZOOM = 11, PIN_MAX = 100, PIN_MAX_NAV = 40; // fewer while driving: turning the map moves every pin
const pinLayer = map ? L_.layerGroup().addTo(map) : null;
let dcById = new Map(), pinKey = '', pinT;
const clearPins = () => { pinKey = ''; pinLayer?.clearLayers(); };
const stationChips = s => s.sockets.map(k => `<span class="chip${k.dc ? ' ok' : ''}">${esc(k.label)}${k.kw ? ' ' + k.kw + ' kW' : ''}</span>`).join('');
async function updatePins() {
  if (!map) return;
  if (!st.evPins || ev.open || map.getZoom() < PIN_ZOOM) return clearPins();
  const local = await loadDc();
  if (!local.length || ev.open || !st.evPins || map.getZoom() < PIN_ZOOM) return clearPins();
  dcById = new Map(local.map(s => [s.id, s]));
  const b = map.getBounds(), c = map.getCenter();
  const shown = local.filter(s => b.contains([s.lat, s.lng])).map(s => [s, (s.lat - c.lat) ** 2 + (s.lng - c.lng) ** 2])
    .sort((x, y) => x[1] - y[1]).slice(0, nav.active ? PIN_MAX_NAV : PIN_MAX).map(x => x[0]);
  const key = shown.map(s => s.id).join();
  if (key === pinKey) return; // same stations as before: leave the pins alone
  pinKey = key; pinLayer.clearLayers();
  shown.forEach(s => {
    const m = L_.marker([s.lat, s.lng], { icon: L_.divIcon({ className: '', html: `<div class="ev-pin dc sm">${svg('bolt')}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) });
    m.bindPopup(() => `<div class="pp-name">${esc(s.name)}</div><div class="muted">${esc(s.op)}</div><div class="chips">${stationChips(s)}</div>
      <button class="btn primary" data-${nav.dest ? 'pstop' : 'pgo'}="${s.id}">${nav.dest ? 'แวะ' : 'ไปที่นี่'}</button>`, { className: 'ev-popup', closeButton: false, autoPanPadding: [20, 20] });
    pinLayer.addLayer(m);
  });
}
if (map) {
  map.on('moveend', () => { clearTimeout(pinT); pinT = setTimeout(updatePins, 250); });
  if (window.requestIdleCallback) requestIdleCallback(updatePins, { timeout: 2500 }); else setTimeout(updatePins, 1500); // the station list is not needed for the first paint
  $('#map').addEventListener('click', e => {
    const b = e.target.closest('[data-pgo],[data-pstop]'); if (!b) return;
    const s = dcById.get(b.dataset.pgo || b.dataset.pstop); if (!s) return;
    map.closePopup();
    return b.dataset.pstop ? addStop(evAsPlace(s)) : pickDest(evAsPlace(s));
  });
}
function openEv(where, cat) {
  if (cat) ev.cat = cat;
  ev.open = true; clearPins(); ev.where = where === 'route' && nav.route ? 'route' : 'near';
  $('#evCard').hidden = false; $('#mapPane').classList.add('ev-open');
  $('#evWhere [data-where="route"]').disabled = !nav.route;
  $('#evCats').innerHTML = Object.entries(CATS).map(([k, c]) => `<button data-cat="${k}" class="chip-btn${k === ev.cat ? ' on' : ''}">${svg(c.icon)}${c.label}</button>`).join('');
  loadEv();
}
function closeEv() {
  ev.open = false; ev.seq++; updatePins();
  $('#evCard').hidden = true; $('#mapPane').classList.remove('ev-open');
  ev.markers.forEach(m => m.remove()); ev.markers = [];
}
// the part of the route still ahead (within the category's window), thinned to at most 80 points
function routeAhead(window_) {
  const { line, cum } = nav, from = nav.active ? progAlong : 0;
  let i = nav.active ? Math.max(0, nav.seg) : 0, j = i;
  while (j < line.length - 1 && cum[j] - from < window_) j++;
  const stride = Math.max(1, Math.ceil((j - i + 1) / 80)), pts = [];
  for (let k = i; k <= j; k += stride) pts.push(line[k]);
  if (pts[pts.length - 1] !== line[j]) pts.push(line[j]);
  if (pts.length < 2) pts.push(pts[0]);
  return pts;
}
async function loadEv() {
  const cat = CATS[ev.cat];
  $$('#evWhere button').forEach(b => b.classList.toggle('on', b.dataset.where === ev.where));
  $$('#evCats [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === ev.cat));
  $('#evTitle').textContent = cat.label; setIcon($('#evIc'), cat.icon);
  $('#evDc').hidden = ev.cat !== 'ev';
  $('.ev-credit').hidden = ev.cat !== 'ev'; // the DC list credit belongs to chargers only
  $('#evList').innerHTML = `<div class="muted center">กำลังหา${cat.label}…</div>`;
  ev.fitted = false;
  const seq = ++ev.seq, kind = ev.cat;
  const c = here.ll || [map.getCenter().lat, map.getCenter().lng];
  const ahead = ev.where === 'route' ? routeAhead(cat.window) : null;
  const q = ahead
    ? `[out:json][timeout:25];nwr${cat.sel}(around:${cat.corridor},${ahead.map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(',')});out center tags 300;`
    : `[out:json][timeout:25];nwr${cat.sel}(around:${cat.near},${c[0]},${c[1]});out center tags 150;`;
  const from = nav.active ? progAlong : 0;
  const keep = list => {
    if (ahead) {
      list = list.map(s => ({ ...s, ...nearRoute([s.lat, s.lng]) })).filter(s => s.d <= cat.corridor && s.along >= from && s.along <= from + cat.window && (!nav.active || s.along > progAlong));
      list.sort((a, b) => a.along - b.along);
    } else {
      list.forEach(s => s.dist = haversine(c, [s.lat, s.lng]));
      list.sort((a, b) => a.dist - b.dist);
    }
    return list;
  };
  const osmReq = overpass(q).then(j => j.elements.map(e => parseStation(e, kind)).filter(s => s.lat != null), () => null);
  // charging: the bundled DC list shows at once (works offline); OpenStreetMap adds AC chargers and anything newer
  const local = kind === 'ev' ? await loadDc() : [];
  if (seq !== ev.seq) return;
  let box = null;
  if (ahead) { const lats = ahead.map(p => p[0]), lngs = ahead.map(p => p[1]); box = [Math.min(...lats) - .03, Math.min(...lngs) - .03, Math.max(...lats) + .03, Math.max(...lngs) + .03]; }
  const dLat = cat.near / 111000, dLng = cat.near / (111000 * Math.cos(c[0] * Math.PI / 180));
  const near = local.filter(s => box ? s.lat >= box[0] && s.lat <= box[2] && s.lng >= box[1] && s.lng <= box[3] : Math.abs(s.lat - c[0]) <= dLat && Math.abs(s.lng - c[1]) <= dLng);
  const build = osm => {
    // an OpenStreetMap entry within 80 m of a bundled one is the same place
    const extra = (osm || []).filter(o => !near.some(l => Math.abs(l.lat - o.lat) < .0008 && Math.abs(l.lng - o.lng) < .0008 && haversine([l.lat, l.lng], [o.lat, o.lng]) < 80));
    ev.all = keep(near.concat(extra)).slice(0, 60);
    renderEv();
  };
  if (local.length) build(null);
  const osm = await osmReq;
  if (seq !== ev.seq) return;
  if (!local.length && !osm) { $('#evList').innerHTML = `<div class="muted center">หา${cat.label}ไม่ได้ ตรวจสอบอินเทอร์เน็ต หรือค้นใน Google Maps</div>`; return; }
  if (osm || !local.length) build(osm);
}
let dcPromise;
// DC stations compiled by Piyamate Wisanuvej (data/dc-stations.json, built with tools/kml-to-json.py)
function loadDc() {
  return dcPromise || (dcPromise = fetch('data/dc-stations.json').then(r => r.ok ? r.json() : Promise.reject()).then(j => j.s.map((r, i) => ({
    id: 'L' + i, cat: 'ev', tags: [], lat: r[0], lng: r[1], name: r[2] || r[3] || 'สถานีชาร์จ', op: r[4] || '',
    sockets: r[5].map(k => ({ label: k[0], dc: !!k[2], kw: k[1] || null })).concat(r[5].length ? [] : [{ label: 'DC', dc: true, kw: null }]), dc: true
  }))).catch(() => { dcPromise = null; return []; }));
}
function renderEv() {
  const list = ev.all.filter(s => !ev.dc || s.dc);
  ev.markers.forEach(m => m.remove()); ev.markers = [];
  if (map) list.forEach(s => {
    const m = L_.marker([s.lat, s.lng], { icon: L_.divIcon({ className: '', html: `<div class="ev-pin c-${s.cat}${s.dc ? ' dc' : ''}">${svg(CATS[s.cat].icon)}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map);
    m.on('click', () => selectEv(s.id, true)); ev.markers.push(m);
  });
  const canStop = !!nav.dest;
  $('#evList').innerHTML = list.length ? list.map(s => {
    const where = ev.where === 'route'
      ? `ห่างเส้นทาง ${fmtDist(s.d)} · อีก ${fmtDist(Math.max(0, s.along - (nav.active ? progAlong : 0)))}`
      : fmtDist(s.dist);
    const chips = s.sockets.map(k => `<span class="chip${k.dc ? ' ok' : ''}">${esc(k.label)}${k.kw ? ' ' + k.kw + ' kW' : ''}</span>`).join('') + s.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('') || (s.cat === 'ev' ? '<span class="chip">ไม่ระบุหัวชาร์จ</span>' : '');
    return `<div class="ev-item${ev.sel === s.id ? ' on' : ''}" data-ev="${esc(s.id)}">
      <div class="grow"><div class="t ellipsis">${esc(s.name)}</div><div class="muted ellipsis">${esc([s.op !== s.name ? s.op : '', where].filter(Boolean).join(' · '))}</div><div class="chips">${chips}</div></div>
      ${canStop ? `<button class="btn primary" data-evstop="${esc(s.id)}">แวะ</button>` : `<button class="btn primary" data-evgo="${esc(s.id)}">ไปที่นี่</button>`}
    </div>`;
  }).join('') : `<div class="muted center">ไม่พบ${CATS[ev.cat].label}${ev.dc ? 'แบบ DC' : ''}${ev.where === 'route' ? 'ใกล้เส้นทาง' : 'ในรัศมี ' + CATS[ev.cat].near / 1000 + ' กม.'} ข้อมูลอาจไม่ครบ ลองค้นใน Google Maps</div>`;
  // show the nearest stations (and the car) beside the list
  if (map && list.length && !ev.fitted) {
    ev.fitted = true;
    // nearby ones only, so one far-away station does not zoom the map out
    const key = s => ev.where === 'route' ? s.d : s.dist, near = Math.max(3000, key(list[0]) * 3);
    const pts = list.filter(s => key(s) <= near).slice(0, 6).map(s => [s.lat, s.lng]).concat(here.ll ? [here.ll] : []);
    setFollow(false);
    whenMapIdle(() => {
      map.stop(); // an unfinished follow-the-car pan would otherwise undo the fit
      const card = $('#evCard').getBoundingClientRect(), m = $('#map').getBoundingClientRect();
      const beside = card.width < m.width * .6; // wide map: keep pins right of the panel; narrow: above it
      map.fitBounds(L_.latLngBounds(pts), {
        paddingTopLeft: [beside ? card.right - m.left + 30 : 30, 40],
        paddingBottomRight: [40, beside ? 40 : m.bottom - card.top + 30], maxZoom: 16, animate: false
      });
    });
  }
}
function selectEv(id, scroll) {
  ev.sel = id;
  $$('.ev-item').forEach(el => el.classList.toggle('on', el.dataset.ev === id));
  const s = ev.all.find(x => x.id === id);
  if (scroll) $(`.ev-item[data-ev="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  else if (s && map) { setFollow(false); map.panTo([s.lat, s.lng]); }
}
const evAsPlace = s => ({ lat: s.lat, lng: s.lng, name: s.name, sub: s.sockets.map(k => k.label).join(', ') || s.op || CATS[s.cat].label });
$('#evList').addEventListener('click', e => {
  const stop = e.target.closest('[data-evstop]'), go = e.target.closest('[data-evgo]');
  const s = ev.all.find(x => x.id === (stop || go)?.dataset[stop ? 'evstop' : 'evgo']);
  if (s) { closeEv(); return stop ? addStop(evAsPlace(s)) : pickDest(evAsPlace(s)); }
  const it = e.target.closest('[data-ev]'); if (it) selectEv(it.dataset.ev, false);
});
$('#evWhere').addEventListener('click', e => { const b = e.target.closest('[data-where]'); if (b && !b.disabled && b.dataset.where !== ev.where) { ev.where = b.dataset.where; loadEv(); } });
$('#evDc').onclick = () => { ev.dc = !ev.dc; $('#evDc').setAttribute('aria-pressed', ev.dc); renderEv(); };
$('#evX').onclick = closeEv;
$('#evCats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b && b.dataset.cat !== ev.cat) { ev.cat = b.dataset.cat; loadEv(); } });
$('#evGoogle').onclick = () => { closeEv(); gmapsSearch(CATS[ev.cat].google); };
$('#evBtn').onclick = () => openEv(nav.route ? 'route' : 'near');
$('#nfEv').onclick = () => openEv('route');

// ===================================================================
// Turn-by-turn
// ===================================================================
function speak(text) {
  if (!st.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH'; u.rate = 1;
    const v = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('th'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}
function setVoiceIcon() { setIcon($('#nfVoice'), st.voice ? 'vol' : 'mute'); }
$('#nfVoice').onclick = () => { st.voice = !st.voice; save(); setVoiceIcon(); if (!st.voice) window.speechSynthesis?.cancel(); toast(st.voice ? 'เปิดเสียงนำทาง' : 'ปิดเสียงนำทาง', 1500); };

function startNav() {
  gmClose();
  nav.active = true; nav.said = {};
  $('#routeCard').hidden = true; $('#mapPane').classList.remove('has-card');
  $('#mapPane').classList.add('navigating');
  drawAlts();
  $('#navBanner').hidden = $('#navFoot').hidden = $('#compass').hidden = false;
  setVoiceIcon();
  if (st.mode === 'media') setMode('split');
  keepAwake(true);
  if (headingUpOn()) { view.car = carHeading(); turnTo(360 - view.car, true); } // start already facing the way you drive
  drawMe(); // the car turns into an arrow
  setFollow(true);
  navTick();
  const s = nav.steps[nav.step];
  speak('เริ่มนำทาง ' + (s ? `อีก ${sayDist(nav.stepAt[nav.step] - progAlong)} ${instr(s)}` : ''));
}
function stopNav(silent) {
  if (!nav.active) return;
  nav.active = false;
  turnTo(0); drawMe(); // back to north up
  $('#mapPane').classList.remove('navigating');
  $('#navBanner').hidden = $('#navFoot').hidden = $('#compass').hidden = true;
  if (!silent) { $('#routeCard').hidden = false; $('#mapPane').classList.add('has-card'); drawAlts(); }
  keepAwake(false);
  if (reloadPending) location.reload();
}
$('#nfStop').onclick = () => { stopNav(); clearRoute(); };
// all remaining steps, and the whole route at a glance
function stepsSheet() {
  if (!nav.active || !nav.route) return;
  const rows = nav.steps.map((s, i) => [s, i]).filter(([, i]) => i >= nav.step);
  const total = nav.cum[nav.cum.length - 1], remain = Math.max(0, total - progAlong), secs = nav.route.duration * (remain / Math.max(1, total));
  openSheet(`<h2>เส้นทางที่เหลือ</h2>
    <div class="muted st-sum">${fmtDist(remain)} · ${fmtDur(secs)} · ถึง ${fmtClock(new Date(Date.now() + secs * 1000))}</div>
    <div class="sheet-actions" style="justify-content:flex-start;margin:8px 0 4px"><button class="btn" id="stOverview"><span class="ic" data-i="map"></span>ภาพรวมเส้นทาง</button></div>
    ${rows.map(([s, i]) => `<button class="set-row ritem st-row" data-st="${i}"><span class="ic st-ic">${arrowFor(s)}</span><div class="grow"><div class="t">${esc(instr(s))}</div></div><span class="muted">${fmtDist(Math.max(0, nav.stepAt[i] - progAlong))}</span></button>`).join('')}
    <div class="sheet-actions"><button class="btn primary" data-close>ปิด</button></div>`, sh => {
    sh.querySelector('#stOverview').onclick = () => { closeSheet(); overview(); };
    sh.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
      const st_ = nav.steps[+b.dataset.st]; closeSheet();
      setFollow(false); turnTo(0, true);
      map.setView([st_.maneuver.location[1], st_.maneuver.location[0]], 17, { animate: true });
      toast('กดปุ่มตำแหน่งเพื่อกลับไปนำทาง', 2500);
    });
  });
}
function overview() {
  if (!nav.route || !map) return;
  setFollow(false); turnTo(0, true); // north up, the whole way ahead in view, clear of the banner and the bottom card
  const pts = [here.ll, ...nav.line.slice(Math.max(0, nav.seg))].filter(Boolean);
  const bn = $('#navBanner').getBoundingClientRect(), ft = $('#navFoot').getBoundingClientRect(), m = $('#map').getBoundingClientRect();
  map.fitBounds(L_.latLngBounds(pts), { paddingTopLeft: [30, bn.bottom - m.top + 20], paddingBottomRight: [80, m.bottom - ft.top + 20], animate: true });
  toast('กดปุ่มตำแหน่งเพื่อกลับไปนำทาง', 2500);
}
$('#nfSteps').onclick = stepsSheet;
$('#navBanner').onclick = stepsSheet;
// compass: switch between "map turns with the car" and "north always up"
$('#compass').onclick = () => {
  st.headingUp = !st.headingUp; save();
  if (st.headingUp) { view.car = carHeading(); setFollow(true); } else turnTo(0);
  toast(st.headingUp ? 'แผนที่หมุนตามทิศทางรถ' : 'เหนืออยู่ด้านบนเสมอ', 1800);
};

let progAlong = 0;
const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };
const setHtml = (el, h) => { if (el._h !== h || !el.firstChild) { el._h = h; el.innerHTML = h; } };
function navTick() {
  if (!nav.route || !here.ll) return;
  const { line, cum } = nav;
  // snap: search a window ahead of the last segment first, then everything
  let best = { d: Infinity, i: nav.seg, t: 0 };
  const scan = (a, b) => { for (let i = Math.max(0, a); i < Math.min(line.length - 1, b); i++) { const p = projectOnSeg(here.ll, line[i], line[i + 1]); if (p.d < best.d) best = { d: p.d, i, t: p.t }; } };
  scan(nav.seg - 3, nav.seg + 150);
  if (best.d > 60) scan(0, line.length);
  nav.seg = best.i;
  const along = cum[best.i] + best.t * (cum[best.i + 1] - cum[best.i]);
  progAlong = along;
  const total = cum[cum.length - 1], remain = Math.max(0, total - along);

  // off-route → reroute
  const tol = Math.max(40, Math.min(here.acc || 0, 80));
  nav.off = best.d > tol ? nav.off + 1 : 0;
  if (nav.off >= 3 && !nav.routing && Date.now() - nav.lastReroute > 8000) {
    nav.lastReroute = Date.now(); nav.off = 0;
    $('#nbText').textContent = 'กำลังคำนวณเส้นทางใหม่…';
    speak('กำลังคำนวณเส้นทางใหม่');
    route(true);
    return;
  }

  // arrival
  if (remain < 25 || haversine(here.ll, [nav.dest.lat, nav.dest.lng]) < 20) {
    speak('ถึงจุดหมายปลายทางแล้ว');
    toast('ถึงจุดหมายปลายทางแล้ว', 5000);
    stopNav(true); clearRoute();
    return;
  }

  // stops behind us are done: reroutes then skip them
  nav.steps.forEach((s, k) => {
    if (s._wp && !s._passed && nav.stepAt[k] < along - 30) { s._passed = true; nav.stops.shift(); drawStops(); }
  });

  // next maneuver
  let i = 1;
  while (i < nav.steps.length - 1 && nav.stepAt[i] <= along + 8) i++;
  nav.step = i;
  const step = nav.steps[i], dist = nav.stepAt[i] - along;
  setHtml($('#nbArrow'), arrowFor(step));
  setText($('#nbDist'), fmtDist(dist));
  setText($('#nbText'), instr(step));
  view.nextDist = dist;
  const nxt = nav.steps[i + 1];
  const then = nxt && nav.stepAt[i + 1] - nav.stepAt[i] < 250;
  $('#nbThen').hidden = !then;
  if (then) setHtml($('#nbThen'), `จากนั้น ${arrowFor(nxt)} ${esc(instr(nxt))}`);

  // voice prompts at ~1 km, ~300 m and at the turn
  const said = nav.said[i] || (nav.said[i] = {});
  const legLen = nav.stepAt[i] - (nav.stepAt[i - 1] || 0);
  if (dist <= 60 && !said.now) { said.now = said.mid = said.far = 1; speak(instr(step) + (then ? ` จากนั้น ${instr(nxt)}` : '')); }
  else if (dist <= 320 && dist > 120 && !said.mid) { said.mid = said.far = 1; speak(`อีก ${sayDist(dist)} ${instr(step)}`); }
  else if (dist <= 1100 && dist > 700 && legLen > 1500 && !said.far) { said.far = 1; speak(`อีก ${sayDist(dist)} ${instr(step)}`); }

  const secs = nav.route.duration * (remain / Math.max(1, total));
  setText($('#nfEta'), 'ถึง ' + fmtClock(new Date(Date.now() + secs * 1000)));
  setText($('#nfMeta'), `${fmtDur(secs)} · ${fmtDist(remain)}`);
  setText($('#speed b'), String(here.speed != null && here.speed >= 0 ? Math.round(here.speed * 3.6) : '–'));
  if (follow && map) followView(16);
}

// ===================================================================
// Apps side: launcher, app view (native browser view over #paneHost)
// ===================================================================
const media = { app: null, loaded: null, url: '', key: '' };
const PALETTE = ['#3e6ae1', '#8e44ad', '#16a085', '#d35400', '#c0392b', '#2c3e50', '#b8860b', '#1f8a70'];
const appColor = a => a.color || PALETTE[[...a.name].reduce((h, c) => h + c.charCodeAt(0), 0) % PALETTE.length];
const letterOf = a => esc(a.letter || [...a.name][0]?.toUpperCase() || '?');
// a found logo covers the letter; if the image later fails to load, the letter shows again
const appFace = a => a.icon ? svg(a.icon) : letterOf(a) + (a.logo ? `<img class="logo${a.logoFull ? ' full' : ''}" src="${esc(a.logo)}" alt="" referrerpolicy="no-referrer">` : '');
const faceStyle = a => a.logo && !a.logoFull ? 'background:#fff' : `background:${appColor(a)}`;
['#tiles', '#dock'].forEach(sel => $(sel).addEventListener('error', e => { if (e.target.matches?.('img.logo')) e.target.remove(); }, true));

// ---------- Logos for added websites ----------
// 1. the site's own app icon (apple-touch-icon / largest <link rel=icon>), read through the Android app
// 2. Google's favicon service   3. otherwise the coloured letter stays
function imgOk(src, min = 32) {
  return new Promise(res => {
    const i = new Image(), t = setTimeout(() => res(false), 8000);
    i.referrerPolicy = 'no-referrer';
    i.onload = () => { clearTimeout(t); res(i.naturalWidth >= min || /\.svg(\?|$)/i.test(src)); };
    i.onerror = () => { clearTimeout(t); res(false); };
    i.src = src;
  });
}
async function findLogo(url) {
  const origin = new URL(url).origin;
  if (native?.httpGet) {
    try {
      const r = await nativeGet(origin + '/', 10000);
      const base = r.finalUrl || origin + '/', html = (r.body || '').slice(0, 300000);
      const attr = (tag, n) => (tag.match(new RegExp('\\b' + n + '\\s*=\\s*["\']([^"\']+)', 'i')) || [])[1];
      const icons = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0])
        .map(t => ({ rel: (attr(t, 'rel') || '').toLowerCase(), href: attr(t, 'href'), size: parseInt(attr(t, 'sizes') || '', 10) || 0 }))
        .filter(c => c.href && /(^|\s)(apple-touch-icon(-precomposed)?|icon)(\s|$)/.test(c.rel))
        .sort((a, b) => (/apple/.test(b.rel) - /apple/.test(a.rel)) || b.size - a.size);
      const tries = [...icons.map(c => ({ src: new URL(c.href.replace(/&amp;/g, '&'), base).href, full: /apple/.test(c.rel) || c.size >= 120 })),
        { src: origin + '/apple-touch-icon.png', full: true }];
      for (const c of tries) if (await imgOk(c.src, c.full ? 96 : 32)) return c;
    } catch {}
  }
  const g = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=128`;
  if (await imgOk(g, 32)) return { src: g, full: false };
  return null;
}
async function resolveLogo(a) {
  if (!a.url || a.icon || DEFAULT_APPS.some(d => d.id === a.id)) return;
  a.logoTried = Date.now();
  const l = await findLogo(a.url).catch(() => null);
  if (l) { a.logo = l.src; a.logoFull = l.full; }
  save(); renderApps();
}
// apps added earlier: look once, and again a week after a miss
async function resolveMissingLogos() {
  for (const a of st.apps) if (!a.logo && a.url && !a.icon && !(Date.now() - (a.logoTried || 0) < 7 * 864e5)) await resolveLogo(a);
}

function renderApps() {
  $('#tiles').innerHTML = st.apps.map((a, i) => `
    <div class="tile" role="button" tabindex="0" data-app="${i}">
      <button class="del" data-del="${i}" aria-label="ลบ ${esc(a.name)}">${svg('close')}</button>
      <div class="face" style="${faceStyle(a)}">${appFace(a)}</div>
      <span>${esc(a.name)}</span>
    </div>`).join('') +
    `<div class="tile add" role="button" tabindex="0" id="addApp"><div class="face">${svg('add')}</div><span>เพิ่มแอป</span></div>`;
  $('#dock').innerHTML = st.apps.slice(0, 6).map((a, i) =>
    `<button class="dock-app${media.app === a ? ' on' : ''}" data-app="${i}" aria-label="${esc(a.name)}" style="${faceStyle(a)}">${appFace(a)}</button>`).join('');
}
function setEditing(on) {
  $('#home').classList.toggle('editing', on);
  $('#editApps').textContent = on ? 'เสร็จ' : 'แก้ไข';
}
$('#editApps').onclick = () => setEditing(!$('#home').classList.contains('editing'));
$('#tiles').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) return removeApp(+del.dataset.del);
  if (e.target.closest('#addApp')) return addAppSheet();
  const t = e.target.closest('[data-app]');
  if (t && !$('#home').classList.contains('editing')) openApp(st.apps[+t.dataset.app]);
});
$('#tiles').addEventListener('contextmenu', e => { if (e.target.closest('[data-app]')) { e.preventDefault(); setEditing(true); } });
$('#dock').addEventListener('click', e => { const b = e.target.closest('[data-app]'); if (b) openApp(st.apps[+b.dataset.app]); });

function removeApp(i) {
  const [a] = st.apps.splice(i, 1);
  if (media.app === a) closeApp(true);
  save(); renderApps();
  snack(`ลบ ${a.name} แล้ว`, () => { st.apps.splice(Math.min(i, st.apps.length), 0, a); save(); renderApps(); });
}
function addAppSheet() {
  openSheet(`<h2>เพิ่มแอป</h2>
    <label class="field">ชื่อ<input type="text" id="aName" placeholder="เช่น Joox"></label>
    <label class="field">เว็บไซต์<input type="text" id="aUrl" placeholder="joox.com" inputmode="url" autocapitalize="off"></label>
    <div class="sheet-actions"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="aSave">เพิ่ม</button></div>`, s => {
    s.querySelector('#aUrl').focus();
    s.querySelector('#aSave').onclick = () => {
      let url = s.querySelector('#aUrl').value.trim(); if (!url) return toast('ใส่เว็บไซต์ก่อน');
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      let host; try { host = new URL(url).hostname.replace(/^(www|m)\./, ''); } catch { return toast('เว็บไซต์ไม่ถูกต้อง'); }
      const a = { id: 'c' + Date.now().toString(36), name: s.querySelector('#aName').value.trim() || host, url };
      st.apps.push(a);
      save(); renderApps(); closeSheet();
      resolveLogo(a);
    };
  });
}

function openApp(a) {
  if (!a) return;
  if (!native) return toast('เปิดแอปในฝั่งนี้ได้ในแอป Android ของ Car Screen');
  setEditing(false);
  if (st.mode === 'map') setMode('split');
  media.app = a;
  $('#home').hidden = true; $('#appView').hidden = false;
  if (!a.url) { // "เว็บ": start from the address bar
    if (media.loaded !== a.id) { media.url = ''; media.loaded = a.id; nStop(0); }
    $('#addrQ').value = media.url; setTimeout(() => $('#addrQ').focus(), 50);
  } else if (media.loaded !== a.id) { // switching apps loads it; reopening the same app resumes where it was
    media.loaded = a.id; media.url = a.url; $('#addrQ').value = a.url;
    nLoad(0, a.url);
  }
  renderApps(); syncPane();
}
function closeApp(stop) {
  $('#appView').hidden = true; $('#home').hidden = false;
  if (stop) { media.app = media.loaded = null; media.url = ''; try { nStop(0); } catch {} }
  renderApps(); syncPane();
}
$('#appHome').onclick = () => closeApp(false);
$('#appBack').onclick = () => native?.back?.();
$('#appReload').onclick = () => { if (media.url) nLoad(0, media.url); };
$('#addr').onsubmit = e => {
  e.preventDefault();
  const v = $('#addrQ').value.trim(); if (!v) return;
  const isUrl = /^https?:\/\//i.test(v) || (/^[^\s]+\.[a-z]{2,}(\/|$|\?|:)/i.test(v) && !/\s/.test(v));
  const url = isUrl ? (/^https?:\/\//i.test(v) ? v : 'https://' + v) : 'https://www.google.com/search?q=' + encodeURIComponent(v);
  media.url = url; $('#addrQ').value = url; $('#addrQ').blur();
  nLoad(0, url);
};
window.__paneUrl = url => { if (!url || url === 'about:blank') return; media.url = url; if (document.activeElement !== $('#addrQ')) $('#addrQ').value = url; };

// keep the native views exactly over their areas, and out of the way of sheets
function syncPane() {
  if (!native) return;
  const r = $('#paneHost').getBoundingClientRect();
  const show = !!media.app && !$('#appView').hidden && st.mode !== 'map' && $('#sheetWrap').hidden && r.width > 0;
  const key = [r.left, r.top, r.width, r.height].map(Math.round).join() + show;
  if (key === media.key) return;
  media.key = key;
  try { nRect(0, r.left, r.top, r.width, r.height, show); } catch {}
}
// positions are re-sent when the layout changes (requestSync), when the hosts resize, and once a second as a safety net
function syncNative() { syncPane(); syncGm(); }
let syncQ = 0;
function requestSync() { if (native && !syncQ) syncQ = requestAnimationFrame(() => { syncQ = 0; syncNative(); }); }
if (native) {
  if (window.ResizeObserver) { const ro = new ResizeObserver(requestSync); ro.observe($('#paneHost')); ro.observe($('#gmHost')); }
  setInterval(syncNative, 1000);
}

// ===================================================================
// Android app updates: compare the installed APK with dist/version.json
// ===================================================================
const appUpd = { have: 0, latest: null, state: '' };
async function checkAppUpdate(manual) {
  if (!native?.appVersion) return;
  try {
    appUpd.have = native.appVersion();
    appUpd.latest = await getJSON('dist/version.json?t=' + Date.now(), 10000, { cache: 'no-store' });
    const newer = appUpd.latest.versionCode > appUpd.have;
    $('#settingsBtn').classList.toggle('badge', newer);
    if (newer && (manual || store.get('carscreen.updSeen', 0) !== appUpd.latest.versionCode)) {
      store.set('carscreen.updSeen', appUpd.latest.versionCode);
      toast(`มีแอปเวอร์ชันใหม่ ${appUpd.latest.versionName} อัปเดตได้ที่ ตั้งค่า`, 6000);
    } else if (manual) toast('แอปเป็นเวอร์ชันล่าสุดแล้ว', 2500);
  } catch { if (manual) toast('ตรวจหาอัปเดตไม่ได้ ตรวจสอบอินเทอร์เน็ต'); }
  if ($('#appUpd')) { $('#appUpd').outerHTML = appUpdHtml(); paintIcons($('#sheet')); }
}
function appUpdHtml() {
  if (!appUpd.have && native?.appVersion) appUpd.have = native.appVersion();
  const l = appUpd.latest, newer = l && l.versionCode > appUpd.have;
  return `<div id="appUpd" class="set-row">
    <div class="grow"><div class="t">เวอร์ชัน 1.0.${appUpd.have || '?'}</div>
      <div class="muted">${appUpd.state ? esc(appUpd.state) : newer ? `มีเวอร์ชันใหม่ ${esc(l.versionName)}` : l ? 'ล่าสุดแล้ว' : ''}</div></div>
    ${newer ? '<button class="btn primary" id="updGo"><span class="ic" data-i="dl"></span>อัปเดต</button>' : '<button class="btn" id="updCheck">ตรวจหาอัปเดต</button>'}
  </div>`;
}
// progress reported by the app: download → install → confirm → done / error
window.__appUpdate = (state, msg) => {
  appUpd.state = msg;
  if (state === 'error') toast(msg + ' · ติดตั้งเองได้จาก ' + new URL('dist/car-screen.apk', location.href).href, 9000);
  else toast(msg, state === 'confirm' ? 6000 : 3500);
  if ($('#appUpd')) { $('#appUpd').outerHTML = appUpdHtml(); paintIcons($('#sheet')); }
};
document.addEventListener('click', e => {
  if (e.target.closest('#updCheck')) checkAppUpdate(true);
  if (e.target.closest('#updGo') && appUpd.latest) {
    const l = appUpd.latest;
    native.update(new URL(l.url, location.href).href, l.sha256 || '');
    appUpd.state = 'กำลังเริ่ม…'; $('#appUpd').outerHTML = appUpdHtml();
  }
});
if (native?.appVersion) { setTimeout(() => checkAppUpdate(false), 3000); setInterval(() => checkAppUpdate(false), 6 * 3600e3); }

// ===================================================================
// Settings
// ===================================================================
// drop every service worker and cache, then reload from the network
async function repairApp() {
  toast('กำลังซ่อมแอป…');
  try { for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister(); } catch {}
  try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
  location.replace(location.pathname + '?repaired=' + Date.now() + (native ? '&native=1' : ''));
}
function settingsSheet() {
  const layout = st.stack == null ? 'auto' : st.stack ? 'stack' : 'side';
  const segBtn = (v, t) => `<button data-layout="${v}" class="${layout === v ? 'on' : ''}">${t}</button>`;
  const placeRow = k => `<button class="set-row ritem" data-place="${k}"><span class="ic" data-i="${k}"></span><div class="grow"><div class="t">${PLACE[k].label}</div><div class="muted ellipsis">${st[k] ? esc(st[k].name) : 'ยังไม่ได้ตั้ง'}</div></div><span class="muted">${st[k] ? 'แก้ไข' : 'ตั้งค่า'}</span></button>`;
  openSheet(`<h2>ตั้งค่า</h2>
    <h3>การนำทาง</h3>
    ${placeRow('home')}${placeRow('work')}
    <label class="set-row"><span class="t">เสียงนำทาง</span><input type="checkbox" class="toggle" id="sVoice" ${st.voice ? 'checked' : ''}></label>
    <label class="set-row"><span class="t">ซูมตามความเร็วและทางเลี้ยว</span><input type="checkbox" class="toggle" id="sAutoZoom" ${st.autoZoom !== false ? 'checked' : ''}></label>
    <label class="set-row"><span class="t">แสดงที่ชาร์จบนแผนที่</span><input type="checkbox" class="toggle" id="sEvPins" ${st.evPins ? 'checked' : ''}></label>
    <h3>หน้าจอ</h3>
    <div class="set-row"><span class="t">แบ่งจอ</span><div class="seg">${segBtn('auto', 'อัตโนมัติ')}${segBtn('side', 'ซ้าย-ขวา')}${segBtn('stack', 'บน-ล่าง')}</div></div>
    <div class="set-row"><span class="t">สลับฝั่งแผนที่ / แอป</span><button class="btn" id="sSwap">สลับ</button></div>
    <h3>ข้อมูล</h3>
    <div class="set-row"><div class="grow"><div class="t">สำรอง / ย้ายการตั้งค่า</div><div class="muted">คัดลอกไปใช้อีกเครื่อง</div></div><button class="btn" id="sBackup">เปิด</button></div>
    ${native?.appVersion ? appUpdHtml() : ''}
    <div class="adv"><button class="btn small-btn" id="sResetLayout">คืนค่าหน้าจอ</button><button class="btn small-btn" id="sRestoreApps">คืนแอปเริ่มต้น</button><button class="btn small-btn" id="sRepair">ซ่อมแอป</button></div>
    <div class="sheet-actions"><button class="btn primary" data-close>เสร็จ</button></div>`, s => {
    s.querySelectorAll('[data-place]').forEach(b => b.onclick = () => placeSheet(b.dataset.place, true));
    s.querySelector('#sVoice').onchange = e => { st.voice = e.target.checked; save(); setVoiceIcon(); };
    s.querySelector('#sAutoZoom').onchange = e => { st.autoZoom = e.target.checked; save(); };
    s.querySelector('#sEvPins').onchange = e => { st.evPins = e.target.checked; save(); updatePins(); };
    s.querySelectorAll('[data-layout]').forEach(b => b.onclick = () => {
      st.stack = { auto: null, side: false, stack: true }[b.dataset.layout]; save(); applyLayout();
      s.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('on', x === b));
    });
    s.querySelector('#sSwap').onclick = () => { st.swapped = !st.swapped; save(); applyLayout(); };
    s.querySelector('#sBackup').onclick = backupSheet;
    s.querySelector('#sResetLayout').onclick = () => { Object.assign(st, { ratio: DEF.ratio, swapped: false, stack: null, mode: 'split' }); save(); applyLayout(); closeSheet(); };
    s.querySelector('#sRestoreApps').onclick = () => {
      const missing = DEFAULT_APPS.filter(d => !st.apps.some(a => a.id === d.id));
      st.apps.push(...missing.map(a => ({ ...a }))); save(); renderApps();
      toast(missing.length ? `เพิ่มกลับ ${missing.length} แอป` : 'มีแอปเริ่มต้นครบแล้ว', 2500);
    };
    s.querySelector('#sRepair').onclick = repairApp;
  });
}
$('#settingsBtn').onclick = settingsSheet;

// ===================================================================
// Boot
// ===================================================================
// A new release is picked up at launch and then every 20 minutes and whenever the app comes back to the front, because the
// car app can stay open for days. When the new files take over, the page reloads once - but never in the middle of a drive:
// then it waits until navigation ends.
let reloadPending = false;
function onNewVersion() {
  if (nav.active) { reloadPending = true; toast('มีเวอร์ชันใหม่ จะอัปเดตเมื่อจบการนำทาง', 4000); return; }
  location.reload();
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; onNewVersion(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => {
    r.update();
    const check = () => r.update().catch(() => {});
    setInterval(check, 20 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});
}
if (!native) { body.classList.add('no-native'); $('#noNative').hidden = false; }
paintIcons();
applyLayout();
renderApps();
setTimeout(resolveMissingLogos, 4000);
setVoiceIcon();
optsBadge();
renderQuick();
tickClock();
wake();
startGeo();

// exposed for automated tests
window.__car = { st, nav, view, onNewVersion, get reloadPending() { return reloadPending; }, media, gm, ev, instr, setRoute, parseGmaps, fmtDist, sayDist, haversine, here, get map() { return map; } };
})();
