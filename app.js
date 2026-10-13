/* Car Screen — split screen map navigation + apps, built for the Car Screen Android app (android/). */
(() => {
'use strict';
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
const DEF = { ratio: 55, swapped: false, stack: null, mode: 'split', voice: true, avoid: { toll: false, motorway: false, ferry: false }, recentDest: [], apps: null };
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
  $('#sheetWrap').hidden = false; bind?.(s);
  s.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheet));
}
const closeSheet = () => { $('#sheetWrap').hidden = true; $('#sheet').innerHTML = ''; };
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
}
function setMode(m) { st.mode = m; save(); applyLayout(); }
addEventListener('resize', applyLayout);
$$('#bar .seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#swap').onclick = () => { st.swapped = !st.swapped; save(); applyLayout(); };

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
  };
  const up = () => {
    div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); div.removeEventListener('pointercancel', up);
    div.classList.remove('drag'); save(); map?.invalidateSize();
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
    case 'arrive': return 'ถึงจุดหมายปลายทาง';
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
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const REFOLLOW_MS = 8000;
const AVOID = ['toll', 'motorway', 'ferry'];
const AVOID_TXT = { toll: 'ทางเสียค่าผ่านทาง', motorway: 'ทางด่วน', ferry: 'เรือข้ามฟาก' };
let map = null;
const L_ = window.L;
const here = { ll: null, acc: null, heading: null, speed: null };
let meMarker, destMarker, routeLines = [], altLines = [], follow = true;
const nav = { dest: null, route: null, active: false, line: [], cum: [], stepAt: [], seg: 0, step: 1, said: {}, off: 0, lastReroute: 0, routing: false };

if (L_) {
  map = L_.map('map', { zoomControl: false, attributionControl: true, tapHold: true }).setView(store.get('carscreen.view', [13.7563, 100.5018]), 13);
  L_.tileLayer(TILE, { maxZoom: 19, className: 'dark-tiles', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  map.attributionControl.setPrefix(false);
  // panning pauses follow mode; while navigating it snaps back after a few seconds
  let refollowT;
  map.on('dragstart', () => {
    setFollow(false); clearTimeout(refollowT);
    if (nav.active) refollowT = setTimeout(() => nav.active && !follow && setFollow(true), REFOLLOW_MS);
  });
  map.on('moveend', () => store.set('carscreen.view', [map.getCenter().lat, map.getCenter().lng]));
  map.on('contextmenu', e => pickDest({ lat: e.latlng.lat, lng: e.latlng.lng, name: 'ตำแหน่งที่เลือก', sub: `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}` }));
}

function setFollow(on) {
  follow = on;
  $('#recenter').classList.toggle('off', !on);
  if (on && here.ll && map) map.setView(here.ll, nav.active ? 17 : Math.max(map.getZoom(), 15), { animate: true });
}
$('#recenter').onclick = () => { if (!here.ll) startGeo(true); setFollow(true); };

function drawMe() {
  if (!map || !here.ll) return;
  const html = `<div class="me${here.heading != null ? ' dir' : ''}"><b style="transform:rotate(${here.heading || 0}deg)"></b><i></i></div>`;
  const icon = L_.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] });
  if (!meMarker) meMarker = L_.marker(here.ll, { icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
  else { meMarker.setLatLng(here.ll); meMarker.setIcon(icon); }
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
  else if (follow && map) map.panTo(ll, { animate: true, duration: .5 });
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
  gmClose(); showResults('');
  qEl.value = d.name; $('#qClear').hidden = false;
  nav.dest = d;
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
  const from = here.ll, to = [nav.dest.lat, nav.dest.lng];
  const base = `${OSRM}${from[1]},${from[0]};${to[1]},${to[0]}?overview=false&steps=true&geometries=geojson&alternatives=${reroute ? 'false' : 3}`;
  const want = AVOID.filter(k => st.avoid[k]);
  // the public OSRM server may only accept one class per request: try all, then one at a time, then none
  const tries = [want, ...(want.length > 1 ? want.map(k => [k]) : []), ...(want.length ? [[]] : [])];
  try {
    let j, used, last;
    for (const ex of tries) {
      try {
        j = await getJSON(base + (ex.length ? '&exclude=' + ex.join(',') : ''), 12000);
        if (j.code === 'Ok' && j.routes?.length) { used = ex; break; }
        last = new Error(j.code);
      } catch (e) { last = e; }
    }
    if (!used) throw last;
    const missed = want.filter(k => !used.includes(k));
    if (missed.length && !reroute) toast('เลี่ยง' + missed.map(k => AVOID_TXT[k]).join(' และ') + 'ไม่ได้ในเส้นทางนี้', 5000);
    nav.alts = reroute ? [] : j.routes;
    nav.altIdx = 0;
    setRoute(j.routes[0]);
    if (!reroute) {
      renderAlts();
      map?.fitBounds(L_.latLngBounds(j.routes.flatMap(r => routeLine(r).line)), { padding: [60, 60] });
      setFollow(false);
    }
  } catch (err) {
    if (reroute) toast('คำนวณเส้นทางใหม่ไม่ได้');
    else $('#rcMeta').textContent = err?.message === 'NoRoute' ? 'ไม่พบเส้นทางขับรถไปจุดนี้' : 'หาเส้นทางไม่ได้ ตรวจสอบอินเทอร์เน็ต';
  } finally { nav.routing = false; }
}

function routeLine(r) {
  const line = [], stepAt = [], steps = [];
  r.legs[0].steps.forEach(s => {
    const pts = s.geometry.coordinates.map(c => [c[1], c[0]]);
    if (line.length && pts.length) pts.shift();
    // "exit the roundabout" only repeats the roundabout instruction, so keep its road but not the prompt
    if (!/^exit (roundabout|rotary)$/.test(s.maneuver.type)) { steps.push(s); stepAt.push(Math.max(0, line.length - 1)); }
    line.push(...pts);
  });
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
  nav.dest = nav.route = null;
  routeLines.forEach(l => l.remove()); routeLines = [];
  nav.alts = []; drawAlts();
  destMarker?.remove(); destMarker = null;
  $('#routeCard').hidden = true; $('#mapPane').classList.remove('has-card');
  qEl.value = ''; $('#qClear').hidden = true;
}
$('#rcClose').onclick = clearRoute;
$('#rcGo').onclick = () => { if (nav.route) startNav(); else route(); };

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
  $('#navBanner').hidden = $('#navFoot').hidden = false;
  setVoiceIcon();
  if (st.mode === 'media') setMode('split');
  keepAwake(true);
  setFollow(true);
  navTick();
  const s = nav.steps[nav.step];
  speak('เริ่มนำทาง ' + (s ? `อีก ${sayDist(nav.stepAt[nav.step] - progAlong)} ${instr(s)}` : ''));
}
function stopNav(silent) {
  if (!nav.active) return;
  nav.active = false;
  $('#mapPane').classList.remove('navigating');
  $('#navBanner').hidden = $('#navFoot').hidden = true;
  if (!silent) { $('#routeCard').hidden = false; $('#mapPane').classList.add('has-card'); drawAlts(); }
  keepAwake(false);
}
$('#nfStop').onclick = () => { stopNav(); clearRoute(); };

let progAlong = 0;
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

  // next maneuver
  let i = 1;
  while (i < nav.steps.length - 1 && nav.stepAt[i] <= along + 8) i++;
  nav.step = i;
  const step = nav.steps[i], dist = nav.stepAt[i] - along;
  $('#nbArrow').innerHTML = arrowFor(step);
  $('#nbDist').textContent = fmtDist(dist);
  $('#nbText').textContent = instr(step);
  const nxt = nav.steps[i + 1];
  const then = nxt && nav.stepAt[i + 1] - nav.stepAt[i] < 250;
  $('#nbThen').hidden = !then;
  if (then) $('#nbThen').innerHTML = `จากนั้น ${arrowFor(nxt)} ${esc(instr(nxt))}`;

  // voice prompts at ~1 km, ~300 m and at the turn
  const said = nav.said[i] || (nav.said[i] = {});
  const legLen = nav.stepAt[i] - (nav.stepAt[i - 1] || 0);
  if (dist <= 60 && !said.now) { said.now = said.mid = said.far = 1; speak(instr(step) + (then ? ` จากนั้น ${instr(nxt)}` : '')); }
  else if (dist <= 320 && dist > 120 && !said.mid) { said.mid = said.far = 1; speak(`อีก ${sayDist(dist)} ${instr(step)}`); }
  else if (dist <= 1100 && dist > 700 && legLen > 1500 && !said.far) { said.far = 1; speak(`อีก ${sayDist(dist)} ${instr(step)}`); }

  const secs = nav.route.duration * (remain / Math.max(1, total));
  $('#nfEta').textContent = 'ถึง ' + fmtClock(new Date(Date.now() + secs * 1000));
  $('#nfMeta').textContent = `${fmtDur(secs)} · ${fmtDist(remain)}`;
  $('#speed b').textContent = here.speed != null && here.speed >= 0 ? Math.round(here.speed * 3.6) : '–';
  if (follow && map) map.setView(here.ll, Math.max(map.getZoom(), 16), { animate: true });
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
$('#appOut').onclick = () => { if (media.url) native?.external(media.url); };
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
if (native) setInterval(() => { syncPane(); syncGm(); }, 120);

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
  openSheet(`<h2>ตั้งค่า</h2>
    <h3>การนำทาง</h3>
    <label class="set-row"><span class="t">เสียงนำทาง</span><input type="checkbox" class="toggle" id="sVoice" ${st.voice ? 'checked' : ''}></label>
    <h3>หน้าจอ</h3>
    <div class="set-row"><span class="t">แบ่งจอ</span><div class="seg">${segBtn('auto', 'อัตโนมัติ')}${segBtn('side', 'ซ้าย-ขวา')}${segBtn('stack', 'บน-ล่าง')}</div></div>
    <div class="set-row"><span class="t">ขนาดและตำแหน่งจอ</span><button class="btn" id="sResetLayout">คืนค่า</button></div>
    <h3>แอป</h3>
    <div class="set-row"><div class="grow"><div class="t">แอปเริ่มต้น</div><div class="muted">เพิ่มแอปที่ลบไปกลับมา</div></div><button class="btn" id="sRestoreApps">คืนค่า</button></div>
    ${native?.appVersion ? `<h3>Car Screen สำหรับ Android</h3>${appUpdHtml()}` : ''}
    <div class="set-row"><div class="grow"><div class="t">ซ่อมแอป</div><div class="muted">ล้างไฟล์ที่เก็บไว้แล้วโหลดใหม่ ใช้เมื่อเปิดไม่ขึ้นหรือค้าง</div></div><button class="btn" id="sRepair">ซ่อม</button></div>
    <div class="sheet-actions"><button class="btn primary" data-close>เสร็จ</button></div>`, s => {
    s.querySelector('#sVoice').onchange = e => { st.voice = e.target.checked; save(); setVoiceIcon(); };
    s.querySelectorAll('[data-layout]').forEach(b => b.onclick = () => {
      st.stack = { auto: null, side: false, stack: true }[b.dataset.layout]; save(); applyLayout();
      s.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('on', x === b));
    });
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
// When an updated service worker takes over, reload once so the new version shows right away
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
if (!native) { body.classList.add('no-native'); $('#noNative').hidden = false; }
paintIcons();
applyLayout();
renderApps();
setTimeout(resolveMissingLogos, 4000);
setVoiceIcon();
optsBadge();
tickClock();
wake();
startGeo();

// exposed for automated tests
window.__car = { st, nav, media, gm, instr, setRoute, parseGmaps, fmtDist, sayDist, haversine, here, get map() { return map; } };
})();
