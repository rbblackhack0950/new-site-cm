/* Car Screen — split screen map navigation + media, for phones and tablets. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const app = $('#app'), root = document.documentElement, body = document.body;

// ===================================================================
// Storage & settings
// ===================================================================
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEF = { ratio: 50, swapped: false, stack: null, mode: 'split', voice: true, autoNext: true, ytKey: '', ytClientId: '', navGoogle: false, longdoKey: '', avoid: { toll: false, motorway: false, ferry: false }, custom: [], extSeen: [], recentDest: [], ytHistory: [], lastView: 'home' };
const st = Object.assign({}, DEF, store.get('carscreen', {}));
const save = () => store.set('carscreen', st);

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
  list: 'M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z',
  map: 'm20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z',
  split: 'M3 5v14h18V5zm8 12H5V7h6zm8 0h-6V7h6z',
  stack: 'M3 3v18h18V3zm16 16H5v-6h14zm0-8H5V5h14z',
  play: 'M8 5v14l11-7z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99zM21 9l-3.99-4v3H10v2h7.01v3z',
  fs: 'M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z',
  fsx: 'M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z',
  dl: 'M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z',
  tune: 'M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4',
  more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  place: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5',
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
// Toast, sheet, idle auto-hide, wake lock
// ===================================================================
let toastT;
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms);
}
function openSheet(html, bind) {
  const s = $('#sheet'); s.innerHTML = html; paintIcons(s);
  $('#sheetWrap').hidden = false; bind?.(s);
  s.querySelector('[data-close]')?.addEventListener('click', closeSheet);
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
    $('#dockBar').hidden = true;
  }, 4500);
}
['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, wake, { passive: true, capture: true }));
$$('.reveal').forEach(r => r.addEventListener('pointerdown', wake));

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
const wantAwake = () => nav.active || yt.playing;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake()) keepAwake(true); });

// ===================================================================
// Layout: split / map / media, swap, orientation, divider
// ===================================================================
const isStack = () => st.stack ?? (innerHeight > innerWidth);
function applyLayout() {
  app.classList.toggle('stack', isStack());
  app.classList.toggle('swapped', st.swapped);
  ['map', 'split', 'media'].forEach(m => app.classList.toggle('mode-' + m, st.mode === m));
  $$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
  setIcon($('#orient'), isStack() ? 'split' : 'stack');
  root.style.setProperty('--ratio', st.ratio);
  placeDock();
  map && setTimeout(() => map.invalidateSize(), 60);
}
// the menu handle sits on the divider in split mode, bottom-centre otherwise
function placeDock() {
  const d = $('#dock'), split = st.mode === 'split';
  d.classList.toggle('on-divider', split); d.classList.toggle('vertical', split && !isStack());
  // at the far end of the divider so it never covers the drag grip in the middle
  if (split) {
    const r = div.getBoundingClientRect(), v = !isStack();
    d.style.left = (v ? r.left + r.width / 2 : r.right - 44) + 'px';
    d.style.top = (v ? r.bottom - 44 : r.top + r.height / 2) + 'px';
  }
  else { d.style.left = '50%'; d.style.top = ''; }
}
addEventListener('resize', applyLayout);
$$('.seg button').forEach(b => b.onclick = () => { st.mode = b.dataset.mode; save(); applyLayout(); });
$('#swap').onclick = () => { st.swapped = !st.swapped; save(); applyLayout(); };
$('#orient').onclick = () => { st.stack = !isStack(); save(); applyLayout(); };
$('#dockToggle').onclick = () => {
  const bar = $('#dockBar'); bar.hidden = !bar.hidden;
  if (bar.hidden) return;
  // keep the menu fully on screen wherever the handle sits
  bar.style.setProperty('--shift', '0px');
  const r = bar.getBoundingClientRect(), pad = 8;
  const dx = r.left < pad ? pad - r.left : r.right > innerWidth - pad ? innerWidth - pad - r.right : 0;
  bar.style.setProperty('--shift', dx + 'px');
};
document.addEventListener('pointerdown', e => { if (!e.target.closest('#dock')) $('#dockBar').hidden = true; });

const div = $('#divider');
div.addEventListener('pointerdown', e => {
  e.preventDefault(); div.setPointerCapture(e.pointerId);
  app.classList.add('drag'); div.classList.add('drag');
  const move = ev => {
    const r = app.getBoundingClientRect();
    let p = isStack() ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
    if (st.swapped) p = 1 - p;
    st.ratio = Math.round(Math.min(80, Math.max(20, p * 100)));
    root.style.setProperty('--ratio', st.ratio);
    placeDock();
  };
  const up = () => {
    div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); div.removeEventListener('pointercancel', up);
    app.classList.remove('drag'); div.classList.remove('drag'); save(); map?.invalidateSize();
  };
  div.addEventListener('pointermove', move); div.addEventListener('pointerup', up); div.addEventListener('pointercancel', up);
});
div.addEventListener('dblclick', () => { st.ratio = 50; save(); applyLayout(); });

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
$('#fs').onclick = async () => {
  try {
    if (fsEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
  } catch { toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ ลองติดตั้งเป็นแอปแทน'); }
};
const fsChange = () => setIcon($('#fs'), fsEl() ? 'fsx' : 'fs');
document.addEventListener('fullscreenchange', fsChange);
document.addEventListener('webkitfullscreenchange', fsChange);

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
const REFOLLOW_MS = 8000;
const AVOID = ['toll', 'motorway', 'ferry'];
const AVOID_TXT = { toll: 'ทางเสียค่าผ่านทาง', motorway: 'ทางด่วน', ferry: 'เรือข้ามฟาก' };
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const NOMI = 'https://nominatim.openstreetmap.org/';
let map = null;
const L_ = window.L;
const here = { ll: null, acc: null, heading: null, speed: null, prev: null };
let meMarker, destMarker, routeLines = [], altLines = [], follow = true;

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
} else {
  $('#map').innerHTML = '<div class="empty">โหลดแผนที่ไม่ได้</div>';
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
  if (!meMarker) meMarker = L_.marker(here.ll, { icon: L_.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
  else { meMarker.setLatLng(here.ll); meMarker.setIcon(L_.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] })); }
}

let geoId = null, geoAsked = false;
function startGeo(user) {
  if (!navigator.geolocation) return toast('อุปกรณ์นี้ไม่รองรับ GPS');
  if (geoId != null) { if (user && !here.ll) toast('กำลังหาตำแหน่ง…'); return; }
  geoAsked = true;
  geoId = navigator.geolocation.watchPosition(onPos, err => {
    geoId != null && navigator.geolocation.clearWatch(geoId); geoId = null;
    if (user || nav.active) toast(err.code === 1 ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ตำแหน่งในการตั้งค่าเบราว์เซอร์' : 'หาตำแหน่งไม่ได้ ลองอีกครั้ง');
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
}
function onPos(p) {
  const ll = [p.coords.latitude, p.coords.longitude];
  const first = !here.ll;
  if (here.ll && haversine(here.ll, ll) > 3) here.heading = bearing(here.ll, ll);
  if (p.coords.heading != null && !isNaN(p.coords.heading) && (p.coords.speed || 0) > 1) here.heading = p.coords.heading;
  here.prev = here.ll; here.ll = ll; here.acc = p.coords.accuracy; here.speed = p.coords.speed;
  drawMe();
  if (first && follow && !nav.route) map?.setView(ll, 15);
  else if (follow && map) map.panTo(ll, { animate: true, duration: .5 });
  if (nav.active) navTick();
}

// ---------- Search ----------
async function getJSON(url, ms = 8000, opts = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const qEl = $('#q'), resEl = $('#results');
function showResults(html) { resEl.innerHTML = html; resEl.hidden = !html; paintIcons(resEl); }
function renderRecent() {
  if (!st.recentDest.length) return showResults('');
  showResults('<div class="label">ล่าสุด</div>' + st.recentDest.map((d, i) =>
    `<button class="ritem" data-recent="${i}"><span class="ic" data-i="history"></span><div class="grow"><div class="title">${esc(d.name)}</div><div class="sub title">${esc(d.sub || '')}</div></div></button>`).join(''));
}
qEl.addEventListener('focus', () => { if (!qEl.value) renderRecent(); });
qEl.addEventListener('input', () => { $('#qClear').hidden = !qEl.value; if (!qEl.value) renderRecent(); });
$('#qClear').onclick = () => { qEl.value = ''; $('#qClear').hidden = true; showResults(''); qEl.focus(); };
document.addEventListener('pointerdown', e => {
  if (!resEl.hidden && !e.target.closest('#results,#search')) showResults('');
});
let searchSeq = 0;
// ---------- Place search ----------
// Longdo Map (Thai company, far more Thai places than OpenStreetMap) when a free key is set,
// OpenStreetMap (Nominatim) always, merged nearest-first without duplicates.
const LONGDO = 'https://search.longdo.com/mapsearch/json/search?';
// Google Maps links: full links carry coordinates; short maps.app.goo.gl links are resolved by the Android app
function parseGmaps(url) {
  const n = '(-?\\d{1,3}\\.\\d+)';
  const m = url.match(new RegExp('!3d' + n + '!4d' + n)) || url.match(new RegExp('[?&](?:q|ll|query|destination|daddr)=' + n + '(?:,|%2C)\\+?' + n))
    || url.match(new RegExp('@' + n + ',' + n));
  if (!m) return null;
  const name = decodeURIComponent((url.match(/\/place\/([^/@?]+)/) || [])[1] || '').replace(/\+/g, ' ');
  return { lat: +m[1], lng: +m[2], name: name || 'ตำแหน่งจาก Google Maps', sub: `${(+m[1]).toFixed(5)}, ${(+m[2]).toFixed(5)}` };
}
// GET through the Android app when the browser is not allowed to (CORS) or a redirect must be followed
let httpSeq = 0; const httpWait = {};
window.__http = (id, status, finalUrl, body) => { httpWait[id]?.({ status, finalUrl, body }); delete httpWait[id]; };
function nativeGet(url, ms = 12000) {
  if (!native?.httpGet) return Promise.reject(new Error('no-native'));
  return new Promise((res, rej) => {
    const id = ++httpSeq; httpWait[id] = res; native.httpGet(id, url);
    setTimeout(() => { if (httpWait[id]) { delete httpWait[id]; rej(new Error('timeout')); } }, ms);
  });
}
async function getJSONany(url) {
  try { return await getJSON(url); }
  catch (e) {
    if (!native?.httpGet) throw e;
    const r = await nativeGet(url);
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return JSON.parse(r.body);
  }
}
async function searchLongdo(q, c) {
  const p = new URLSearchParams({ keyword: q, key: st.longdoKey, limit: 15, span: '200km' });
  if (c) { p.set('lat', c[0]); p.set('lon', c[1]); }
  const j = await getJSONany(LONGDO + p);
  return (j.data || []).filter(x => x.lat != null && x.lon != null && x.name)
    .map(x => ({ lat: +x.lat, lng: +x.lon, name: String(x.name).replace(/<[^>]*>/g, ''), sub: (x.address || '').replace(/<[^>]*>/g, ''), src: 'longdo' }));
}
async function searchOSM(q, c) {
  const p = new URLSearchParams({ q, format: 'jsonv2', limit: 8, 'accept-language': 'th,en', addressdetails: 0 });
  if (c) { p.set('viewbox', [c[1] - .6, c[0] + .6, c[1] + .6, c[0] - .6].join(',')); p.set('bounded', 0); }
  const list = await getJSON(NOMI + 'search?' + p);
  return list.map(r => {
    const parts = r.display_name.split(', ');
    return { lat: +r.lat, lng: +r.lon, name: r.name || parts[0], sub: parts.slice(1, 4).join(', '), src: 'osm' };
  });
}
$('#search').onsubmit = async e => {
  e.preventDefault();
  const q = qEl.value.trim(); if (!q) return;
  const coord = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coord) { qEl.blur(); return pickDest({ lat: +coord[1], lng: +coord[2], name: q, sub: 'พิกัด' }); }
  if (/^(https?:\/\/)?([a-z]+\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(q)) return openGmapsLink(q);
  const seq = ++searchSeq;
  showResults('<div class="label">กำลังค้นหา…</div>');
  const c = here.ll || (map ? [map.getCenter().lat, map.getCenter().lng] : null);
  const jobs = [st.longdoKey ? searchLongdo(q, c) : null, searchOSM(q, c)].filter(Boolean);
  const done = await Promise.allSettled(jobs);
  if (seq !== searchSeq) return;
  const items = [];
  for (const r of done) if (r.status === 'fulfilled') for (const it of r.value)
    if (!items.some(x => haversine([x.lat, x.lng], [it.lat, it.lng]) < 60 && x.name === it.name)) items.push(it);
  if (c) { items.forEach(i => i.d = haversine(c, [i.lat, i.lng])); items.sort((a, b) => a.d - b.d); }
  if (!items.length) {
    const failed = done.every(r => r.status === 'rejected');
    return showResults(`<div class="label">${failed ? 'ค้นหาไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง' : 'ไม่พบสถานที่'}</div>
      <div class="label">${st.longdoKey ? '' : 'ใส่ Longdo Map key ในตั้งค่าเพื่อให้หาสถานที่ในไทยเจอมากขึ้น · '}หรือค้นใน Google Maps แล้วแชร์ลิงก์มาวางที่ช่องค้นหา</div>`);
  }
  resEl._items = items.slice(0, 15);
  showResults(resEl._items.map((it, i) =>
    `<button class="ritem" data-res="${i}"><span class="ic" data-i="place"></span><div class="grow"><div class="title">${esc(it.name)}</div><div class="sub title">${esc(it.sub)}</div></div>${it.d != null ? `<span class="dist">${fmtDist(it.d)}</span>` : ''}</button>`).join(''));
};
async function openGmapsLink(q) {
  qEl.blur();
  const url = /^https?:/i.test(q) ? q : 'https://' + q;
  let d = parseGmaps(url);
  if (!d) {
    showResults('<div class="label">กำลังเปิดลิงก์ Google Maps…</div>');
    try { const r = await nativeGet(url); d = parseGmaps(r.finalUrl || '') || parseGmaps(r.body || ''); } catch {}
  }
  if (!d) return showResults(`<div class="label">${native?.httpGet ? 'อ่านตำแหน่งจากลิงก์นี้ไม่ได้' : 'ลิงก์แบบย่อ (maps.app.goo.gl) เปิดได้ในแอป Android เท่านั้น บนเว็บให้เปิดลิงก์ใน Google Maps แล้วคัดลอกลิงก์เต็มจากแถบที่อยู่มาวาง'}</div>`);
  pickDest(d);
}
resEl.addEventListener('click', e => {
  const b = e.target.closest('.ritem'); if (!b) return;
  const d = b.dataset.res != null ? resEl._items[+b.dataset.res] : st.recentDest[+b.dataset.recent];
  qEl.blur(); pickDest(d);
});

// ---------- Destination & route ----------
const nav = { dest: null, route: null, active: false, line: [], cum: [], stepAt: [], seg: 0, step: 1, said: {}, off: 0, lastReroute: 0, routing: false };

function pickDest(d) {
  showResults(''); qEl.value = d.name; $('#qClear').hidden = false;
  nav.dest = d;
  st.recentDest = [d, ...st.recentDest.filter(x => Math.abs(x.lat - d.lat) + Math.abs(x.lng - d.lng) > 1e-5)].slice(0, 8).map(({ lat, lng, name, sub }) => ({ lat, lng, name, sub }));
  save();
  if (map) {
    destMarker?.remove();
    destMarker = L_.marker([d.lat, d.lng], { icon: L_.divIcon({ className: '', html: `<div class="pin">${svg('pin')}</div>`, iconSize: [30, 40], iconAnchor: [15, 40] }) }).addTo(map);
  }
  $('#rcName').textContent = d.name;
  $('#rcMeta').textContent = 'กำลังหาเส้นทาง…';
  $('#routeCard').hidden = false; $('#mapPane').classList.add('has-card');
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
  const alts = nav.alts || [];
  const r = nav.route;
  $('#rcMeta').textContent = `${fmtDist(r.distance)} · ${fmtDur(r.duration)}` + (AVOID.some(k => st.avoid[k]) ? ' · เลี่ยง' + AVOID.filter(k => st.avoid[k]).map(k => AVOID_TXT[k]).join(', ') : '');
  $('#rcAlts').innerHTML = alts.map((a, i) => `<button class="alt${i === nav.altIdx ? ' on' : ''}" data-alt="${i}">
      <b>${fmtDur(a.duration)}</b><span class="sub">${fmtDist(a.distance)}${i === 0 && alts.length > 1 ? ' · เร็วที่สุด' : ''}</span>${routeChips(a)}</button>`).join('');
  drawAlts();
}
function drawAlts() {
  altLines.forEach(l => l.remove()); altLines = [];
  if (!map || nav.active) return;
  (nav.alts || []).forEach((a, i) => {
    if (i === nav.altIdx) return;
    const l = L_.polyline(routeLine(a).line, { color: '#7d8796', weight: 7, opacity: .75 }).addTo(map);
    l.on('click', () => pickAlt(i)); l.bringToBack(); altLines.push(l);
  });
}
function pickAlt(i) { nav.altIdx = i; setRoute(nav.alts[i]); renderAlts(); }
$('#rcAlts').addEventListener('click', e => { const b = e.target.closest('[data-alt]'); if (b) pickAlt(+b.dataset.alt); });

function routeOptsSheet() {
  openSheet(`<h2>ตัวเลือกเส้นทาง</h2>
    <label class="switch">เลี่ยงทางที่เสียค่าผ่านทาง<input type="checkbox" id="oToll" ${st.avoid.toll ? 'checked' : ''}></label>
    <label class="switch">เลี่ยงทางด่วน / มอเตอร์เวย์<input type="checkbox" id="oMotorway" ${st.avoid.motorway ? 'checked' : ''}></label>
    <label class="switch">เลี่ยงเรือข้ามฟาก<input type="checkbox" id="oFerry" ${st.avoid.ferry ? 'checked' : ''}></label>
    <div class="row"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="oSave">ใช้</button></div>`, s => {
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
      L_.polyline(line, { color: '#0b2a55', weight: 11, opacity: .9, interactive: false }).addTo(map),
      L_.polyline(line, { color: '#5b9dff', weight: 7, opacity: 1, interactive: false }).addTo(map)
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
// Google Maps navigation. In the Android app it opens in the other half of the screen (split screen)
// with the same avoid options, and Car Screen switches to the media side only.
function googleNav() {
  const d = nav.dest; if (!d) return;
  if (native?.mapsAdjacent) {
    const avoid = [st.avoid.toll && 't', st.avoid.motorway && 'h', st.avoid.ferry && 'f'].filter(Boolean).join('');
    native.mapsAdjacent(`google.navigation:q=${d.lat},${d.lng}&mode=d${avoid ? '&avoid=' + avoid : ''}`);
    st.mode = 'media'; save(); applyLayout();
    toast('เปิด Google Maps นำทางแล้ว ถ้ายังไม่แยกจอ: ปัดขึ้นค้าง → แตะไอคอน Car Screen → แยกหน้าจอ', 7000);
    return;
  }
  openExternal(`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=driving&dir_action=navigate`);
}
$('#rcGmaps').onclick = googleNav;
$('#rcGo').onclick = () => { if (native && st.navGoogle) return googleNav(); if (nav.route) startNav(); else route(); };

// ---------- Turn-by-turn ----------
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
$('#nfVoice').onclick = () => { st.voice = !st.voice; save(); setVoiceIcon(); if (!st.voice) speechSynthesis?.cancel(); toast(st.voice ? 'เปิดเสียงนำทาง' : 'ปิดเสียงนำทาง', 1500); };

function startNav() {
  nav.active = true; nav.said = {};
  $('#routeCard').hidden = true; $('#mapPane').classList.remove('has-card');
  $('#mapPane').classList.add('navigating');
  drawAlts();
  $('#navBanner').hidden = $('#navFoot').hidden = $('#speed').hidden = false;
  setVoiceIcon();
  if (st.mode === 'media') { st.mode = 'split'; applyLayout(); }
  keepAwake(true);
  setFollow(true);
  navTick();
  const s = nav.steps[nav.step];
  speak('เริ่มนำทาง ' + (s ? `อีก ${sayDist(nav.stepAt[nav.step] - progress())} ${instr(s)}` : ''));
}
function stopNav(silent) {
  if (!nav.active) return;
  nav.active = false;
  $('#mapPane').classList.remove('navigating');
  $('#navBanner').hidden = $('#navFoot').hidden = $('#speed').hidden = true;
  if (!silent) { $('#routeCard').hidden = false; $('#mapPane').classList.add('has-card'); drawAlts(); }
  if (!wantAwake()) keepAwake(false);
}
$('#nfStop').onclick = () => { stopNav(); clearRoute(); };

let progAlong = 0;
const progress = () => progAlong;
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

  // footer
  const secs = nav.route.duration * (remain / Math.max(1, total));
  $('#nfEta').textContent = 'ถึง ' + fmtClock(new Date(Date.now() + secs * 1000));
  $('#nfMeta').textContent = `${fmtDur(secs)} · ${fmtDist(remain)}`;
  $('#speed b').textContent = here.speed != null && here.speed >= 0 ? Math.round(here.speed * 3.6) : '–';
  if (follow && map) map.setView(here.ll, Math.max(map.getZoom(), 16), { animate: true });
}

// ===================================================================
// Media: launcher
// ===================================================================
const APPS = [
  { id: 'youtube', name: 'YouTube', color: '#ff0033', icon: 'play', view: 'yt' },
  { id: 'web', name: 'เว็บ', color: '#3a4250', icon: 'globe', view: 'web' },
  { id: 'netflix', name: 'Netflix', color: '#e50914', letter: 'N', url: 'https://www.netflix.com/browse', ext: true },
  { id: 'ytmusic', name: 'YT Music', color: '#c4102b', letter: '♪', url: 'https://music.youtube.com', ext: true },
  { id: 'spotify', name: 'Spotify', color: '#1db954', letter: 'S', url: 'https://open.spotify.com', ext: true },
  { id: 'gmaps', name: 'Google Maps', color: '#1a73e8', icon: 'map', url: 'https://www.google.com/maps', ext: true }
];
// a real link click: works under popup blockers and never navigates the app itself away
// ---------- Android app (android/): a native browser view laid over the media pane ----------
// Inside the app, window.CarScreenNative exists and any site (m.youtube.com, Netflix, Facebook)
// can be shown in the pane, because the "no embedding" rule only applies to pages inside pages.
const native = window.CarScreenNative || null;
let paneUrl = '', paneKey = '';
function paneLoad(url) {
  paneUrl = url;
  $('#webFrame').removeAttribute('src'); $('#webFrame').dataset.url = url;
  $('#webQ').value = url; webMsg('');
  native.load(url); syncPane();
}
// keep the native view exactly over the pane, and out of the way of menus and sheets
function syncPane() {
  if (!native) return;
  const r = $('#webFrame').getBoundingClientRect();
  const show = !!paneUrl && !$('#web').hidden && st.mode !== 'map' && $('#sheetWrap').hidden && $('#dockBar').hidden && r.width > 0;
  const key = [r.left, r.top, r.width, r.height].map(Math.round).join() + show;
  if (key === paneKey) return;
  paneKey = key;
  try { native.rect(r.left, r.top, r.width, r.height, show); } catch {}
}
window.__paneUrl = url => { if (!url || url === 'about:blank') return; paneUrl = url; $('#webQ').value = url; $('#webFrame').dataset.url = url; };
if (native) { body.classList.add('native'); setInterval(syncPane, 120); }

// ---------- Android app updates: compare the installed APK with dist/version.json ----------
// (the screens and features load from the web, so they update by themselves; this is for the APK shell)
const appUpd = { have: 0, latest: null, state: '' };
async function checkAppUpdate(manual) {
  if (!native?.appVersion) return;
  try {
    appUpd.have = native.appVersion();
    appUpd.latest = await getJSON('dist/version.json?t=' + Date.now(), 10000, { cache: 'no-store' });
    const newer = appUpd.latest.versionCode > appUpd.have;
    $('#dockToggle').classList.toggle('badge', newer);
    if (newer && (manual || store.get('carscreen.updSeen', 0) !== appUpd.latest.versionCode)) {
      store.set('carscreen.updSeen', appUpd.latest.versionCode);
      toast(`มีแอปเวอร์ชันใหม่ ${appUpd.latest.versionName} อัปเดตได้ที่ เมนู ⋯ → ตั้งค่า`, 6000);
    } else if (manual) toast('แอปเป็นเวอร์ชันล่าสุดแล้ว', 2500);
  } catch { if (manual) toast('ตรวจหาอัปเดตไม่ได้ ตรวจสอบอินเทอร์เน็ต'); }
  if (!$('#sheetWrap').hidden && $('#appUpd')) $('#appUpd').outerHTML = appUpdHtml();
}
function appUpdHtml() {
  const l = appUpd.latest, newer = l && l.versionCode > appUpd.have;
  return `<div id="appUpd" class="upd">
    <div class="sub">แอป Android เวอร์ชัน 1.0.${appUpd.have || '?'}${newer ? ` · มีเวอร์ชันใหม่ <b>${esc(l.versionName)}</b>` : l ? ' · ล่าสุดแล้ว' : ''}</div>
    ${appUpd.state ? `<div class="sub">${esc(appUpd.state)}</div>` : ''}
    <div class="row">${newer ? '<button class="btn primary" id="updGo"><span class="ic" data-i="dl"></span>อัปเดตแอป</button>' : '<button class="btn" id="updCheck">ตรวจหาอัปเดต</button>'}</div>
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

function openExternal(url) {
  if (native) return native.external(url);
  const a = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' });
  document.body.append(a); a.click(); a.remove();
}
// On Android a plain link to netflix.com or youtube.com is handed to the installed app.
// An explicit Chrome intent keeps it a website (falls back to the normal link without Chrome).
const isAndroid = /android/i.test(navigator.userAgent);
const webUrl = (url, android = isAndroid) => android
  ? `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
  : url;
function openWeb(url) {
  if (native) { showView('web'); return loadWeb(url); }
  if (isAndroid) location.href = webUrl(url); // launches Chrome; this page stays put
  else openExternal(url);
}
// Netflix, Spotify and similar refuse to run inside another page, so they open as a website in the browser
function openExtApp(a) {
  if (native) { showView('web'); return loadWeb(a.url); }
  if (st.extSeen?.includes(a.id || a.url)) return openWeb(a.url);
  openSheet(`<h2>${esc(a.name)} จะเปิดเป็นเว็บไซต์ในเบราว์เซอร์</h2>
    <div class="sub">${esc(a.name)} ไม่ยอมให้เว็บอื่นแสดงผลข้างใน จึงแสดงในฝั่งนี้ไม่ได้ Car Screen จะเปิดเว็บ ${esc(a.name)} ใน Chrome แทนการเปิดแอป</div>
    ${a.id === 'netflix' ? '<div class="sub"><b>ถ้า Netflix บอกให้ใช้แอป:</b> ใน Chrome แตะเมนู ⋮ → ติ๊ก “เว็บไซต์เวอร์ชันเดสก์ท็อป”</div>' : ''}
    <div class="sub"><b>ดูคู่กับแผนที่บน Android:</b> กดปุ่มแอปล่าสุด → แตะไอคอน Car Screen → แยกหน้าจอ → เลือก Chrome แล้วตั้ง Car Screen เป็น “แผนที่เต็มจอ” ในเมนู ⋯</div>
    <div class="row"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="extGo"><span class="ic" data-i="open"></span>เปิดเว็บ ${esc(a.name)}</button></div>`, s => {
    s.querySelector('#extGo').onclick = () => {
      st.extSeen = [...(st.extSeen || []), a.id || a.url]; save();
      closeSheet(); openWeb(a.url);
    };
  });
}
function renderTiles() {
  const all = [...APPS, ...st.custom.map((c, i) => ({ ...c, customIdx: i, color: '#2b3340', letter: (c.name[0] || '?').toUpperCase() }))];
  $('#tiles').innerHTML = all.map((a, i) => `
    <button class="tile" data-tile="${i}" ${a.customIdx != null ? `data-custom="${a.customIdx}"` : ''}>
      <div class="face" style="background:${a.color}">${a.icon ? svg(a.icon) : esc(a.letter)}</div>
      <span>${esc(a.name)}</span>
      ${a.ext && (!native || a.id === 'gmaps') ? `<i class="ext">${svg('open')}</i>` : ''}
    </button>`).join('') + `
    <button class="tile" id="addTile"><div class="face" style="background:transparent;border:2px dashed rgba(255,255,255,.2)">${svg('add')}</div><span>เพิ่ม</span></button>`;
  $('#tiles')._all = all;
}
$('#tiles').addEventListener('click', e => {
  const t = e.target.closest('.tile'); if (!t) return;
  if (t.id === 'addTile') return addAppSheet();
  const a = $('#tiles')._all[+t.dataset.tile];
  // in the Android app YouTube is the real m.youtube.com, with your account, Shorts and comments
  if (native?.mapsAdjacent && a.id === 'gmaps') { native.mapsAdjacent('https://www.google.com/maps'); st.mode = 'media'; save(); applyLayout(); return; }
  if (native && a.id === 'youtube') { showView('web'); return loadWeb('https://m.youtube.com'); }
  if (a.view) return showView(a.view);
  if (a.ext) return openExtApp(a);
  showView('web'); loadWeb(a.url);
});
$('#tiles').addEventListener('contextmenu', e => {
  const t = e.target.closest('[data-custom]'); if (!t) return;
  e.preventDefault();
  const c = st.custom[+t.dataset.custom];
  openSheet(`<h2>ลบ “${esc(c.name)}”?</h2><div class="row"><button class="btn" data-close>ยกเลิก</button><button class="btn danger" id="del">ลบ</button></div>`, s => {
    s.querySelector('#del').onclick = () => { st.custom.splice(+t.dataset.custom, 1); save(); renderTiles(); closeSheet(); };
  });
});
function addAppSheet() {
  openSheet(`<h2>เพิ่มแอป</h2>
    <label>ชื่อ<input type="text" id="aName" placeholder="เช่น Joox"></label>
    <label>ลิงก์<input type="url" id="aUrl" placeholder="https://…" inputmode="url" autocapitalize="off"></label>
    <label class="switch">เปิดในหน้าต่างใหม่ (สำหรับเว็บที่ไม่ยอมแสดงในจอแบ่ง)<input type="checkbox" id="aExt"></label>
    <div class="sub">กดค้างที่ไอคอนเพื่อลบ</div>
    <div class="row"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="aSave">เพิ่ม</button></div>`, s => {
    s.querySelector('#aUrl').focus();
    s.querySelector('#aSave').onclick = () => {
      let url = s.querySelector('#aUrl').value.trim(); if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      let host; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return toast('ลิงก์ไม่ถูกต้อง'); }
      st.custom.push({ name: s.querySelector('#aName').value.trim() || host, url, ext: s.querySelector('#aExt').checked });
      save(); renderTiles(); closeSheet();
    };
  });
}
function showView(v) {
  ['home', 'yt', 'web'].forEach(id => $('#' + id).hidden = id !== v);
  st.lastView = v; save();
  if (v === 'yt') ytShowIdle();
  if (v === 'web' && !$('#webFrame').getAttribute('src') && !paneUrl && $('#webMsg').hidden) { webHome(); setTimeout(() => $('#webQ').focus(), 50); }
  if (v !== 'yt') { yt.player?.pauseVideo?.(); setTheater(false); }
}
$$('.homeBtn').forEach(b => b.onclick = () => showView('home'));

// ---------- Web view ----------
// Sites known to refuse being shown inside another page (X-Frame-Options / CSP frame-ancestors).
// Showing them would only give a blank pane, so offer to open them in Chrome straight away.
const NO_FRAME = /(^|\.)(facebook|instagram|threads|tiktok|twitter|x|netflix|spotify|line|linkedin|reddit|github|amazon|shopee|lazada|discord|whatsapp|chatgpt|openai|claude|pantip|apple|microsoft|live|office|bing|duckduckgo|yahoo)\.[a-z.]+$|^(mail|drive|docs|news|maps)\.google\.|^(www\.)?google\.[a-z.]+$/i;
// Google search pages may be shown inside other pages when they carry igu=1
const googleSearch = q => 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(q);
function webMsg(html) { const m = $('#webMsg'); m.hidden = !html; m.innerHTML = html || ''; paintIcons(m); }
function loadWeb(input) {
  input = (input || '').trim(); if (!input) return;
  const v = ytParse(input);
  if (v && !native) { showView('yt'); return ytPlayParsed(v); }
  // words rather than an address: search Google inside the pane
  const looksLikeUrl = /^https?:\/\//i.test(input) || (/^[^\s]+\.[a-z]{2,}(\/|$|\?|:)/i.test(input) && !/\s/.test(input));
  const url = looksLikeUrl ? (/^https?:\/\//i.test(input) ? input : 'https://' + input) : googleSearch(input);
  if (native) return paneLoad(url.replace('?igu=1&', '?'));
  let host = ''; try { host = new URL(url).hostname; } catch {}
  $('#webQ').value = looksLikeUrl ? url : input; $('#webQ').blur();
  if (NO_FRAME.test(host) && !/[?&]igu=1/.test(url)) {
    $('#webFrame').removeAttribute('src'); $('#webFrame').dataset.url = url;
    $('#toast').hidden = true;
    webMsg(`<h3>${esc(host.replace(/^www\./, ''))} ไม่ยอมแสดงในจอแบ่ง</h3>
      <div class="sub">เว็บนี้ตั้งค่าห้ามแสดงผลอยู่ในเว็บอื่น เบราว์เซอร์ทุกตัวจึงแสดงในฝั่งนี้ไม่ได้</div>
      <div class="row"><button class="btn primary" id="webOpen"><span class="ic" data-i="open"></span>เปิดใน Chrome</button></div>
      <div class="sub">ดูคู่กับแผนที่บน Android: ใช้ “แยกหน้าจอ” ของระบบกับ Chrome แล้วตั้ง Car Screen เป็น “แผนที่เต็มจอ”</div>`);
    $('#webOpen').onclick = () => openWeb(url);
    return;
  }
  webMsg('');
  $('#webFrame').src = url; $('#webFrame').dataset.url = url;
  toast('ถ้าหน้าว่าง แปลว่าเว็บนี้ไม่ยอมแสดงในจอแบ่ง กด ↗ เพื่อเปิดใน Chrome', 5000);
}
function webHome() {
  webMsg(`<h3>เปิดเว็บในจอแบ่ง</h3>
    <div class="sub">พิมพ์ที่อยู่เว็บ หรือพิมพ์คำค้นหาเพื่อค้นใน Google ได้เลย</div>
    <div class="row"><button class="btn" data-web="https://www.google.com/search?igu=1">Google</button><button class="btn" data-web="https://th.m.wikipedia.org">Wikipedia</button></div>
    <div class="sub">เว็บใหญ่หลายแห่ง (Facebook, TikTok, Netflix, Shopee ฯลฯ) ไม่ยอมแสดงในเว็บอื่น จะเปิดใน Chrome แทน</div>`);
}
$('#webMsg').addEventListener('click', e => { const b = e.target.closest('[data-web]'); if (b) loadWeb(b.dataset.web); });
$('#webForm').onsubmit = e => { e.preventDefault(); loadWeb($('#webQ').value.trim()); };
$('#webPop').onclick = () => { const u = $('#webFrame').dataset.url || $('#webQ').value.trim(); if (!u) return; const url = /^https?:/i.test(u) ? u : googleSearch(u); native ? openExternal(url) : openWeb(url); };

// ===================================================================
// YouTube
// ===================================================================
const PIPED = ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee', 'https://pipedapi.adminforge.de'];
const INVID = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be', 'https://invidious.f5.si'];
const yt = { player: null, apiReady: null, queue: [], idx: -1, playing: false, cur: null };

function ytParse(input) {
  input = (input || '').trim();
  if (/^[\w-]{11}$/.test(input)) return { id: input };
  let u; try { u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input); } catch { return null; }
  if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(u.hostname)) return null;
  const list = u.searchParams.get('list') || null;
  let id = u.hostname.endsWith('youtu.be') ? u.pathname.slice(1, 12) : u.searchParams.get('v');
  if (!id) id = (u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/) || [])[1];
  const t = u.searchParams.get('t') || u.searchParams.get('start');
  const start = t ? (/^\d+$/.test(t) ? +t : (+(t.match(/(\d+)h/) || [0, 0])[1] * 3600 + +(t.match(/(\d+)m/) || [0, 0])[1] * 60 + +(t.match(/(\d+)s/) || [0, 0])[1])) : 0;
  if (id && !/^[\w-]{11}$/.test(id)) id = null;
  if (!id && !list) return null;
  return { id: id || null, list, start };
}
const fmtSecs = s => { if (!s) return ''; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

// try each public Piped/Invidious server, starting with the one that worked last time
async function viaPublic(piped, invid) {
  const tries = [...PIPED.map(b => () => piped(b)), ...INVID.map(b => () => invid(b))];
  const first = store.get('carscreen.ytsrc', 0);
  const order = tries.map((_, i) => i).sort((a, b) => (a === first ? -1 : b === first ? 1 : a - b));
  for (const i of order) {
    try {
      const r = (await tries[i]()).filter(x => x.id);
      if (r.length) { store.set('carscreen.ytsrc', i); return r; }
    } catch {}
  }
  throw new Error('no-source');
}
const pipedItems = list => (list || []).filter(x => x.url && (x.type || 'stream') === 'stream')
  .map(x => ({ id: (x.url.match(/v=([\w-]{11})/) || [])[1], title: x.title, author: x.uploaderName, dur: x.duration }));
const invItems = list => (list || []).filter(x => x.videoId && (x.type || 'video') === 'video')
  .map(x => ({ id: x.videoId, title: x.title, author: x.author, dur: x.lengthSeconds }));

async function ytSearch(q) {
  if (st.ytKey || ytSignedIn()) {
    const j = await ytApi('search', { part: 'snippet', type: 'video', maxResults: 25, q, videoEmbeddable: 'true', regionCode: 'TH', relevanceLanguage: 'th' });
    return j.items.filter(x => x.id?.videoId).map(x => ({ id: x.id.videoId, title: decode(x.snippet.title), author: decode(x.snippet.channelTitle) }));
  }
  const enc = encodeURIComponent(q);
  return viaPublic(
    async b => pipedItems((await getJSON(`${b}/search?q=${enc}&filter=videos`, 7000)).items),
    async b => invItems(await getJSON(`${b}/api/v1/search?q=${enc}&type=video`, 7000)));
}
// videos YouTube shows next to this one (the official API no longer offers this, so public servers only)
const ytRelated = id => viaPublic(
  async b => pipedItems((await getJSON(`${b}/streams/${id}`, 8000)).relatedStreams),
  async b => invItems((await getJSON(`${b}/api/v1/videos/${id}?fields=recommendedVideos`, 8000)).recommendedVideos));
async function ytTrending() {
  if (st.ytKey || ytSignedIn()) {
    const j = await ytApi('videos', { part: 'snippet,contentDetails', chart: 'mostPopular', regionCode: 'TH', maxResults: 30 });
    return j.items.map(x => ({ id: x.id, title: x.snippet.title, author: x.snippet.channelTitle, dur: isoSecs(x.contentDetails.duration) }));
  }
  return viaPublic(
    async b => pipedItems(await getJSON(`${b}/trending?region=TH`, 8000)),
    async b => invItems(await getJSON(`${b}/api/v1/trending?region=TH`, 8000)));
}
// "แนะนำ": related to what you watched lately, mixed with new uploads from subscriptions and trending in Thailand
async function ytRecommended() {
  if (yt.rec && Date.now() - yt.rec.at < 10 * 60e3) return yt.rec.items;
  const seeds = st.ytHistory.filter(v => v.id).slice(0, 2).map(v => v.id);
  const jobs = [...seeds.map(id => ytRelated(id)), ytSignedIn() ? ytSubsFeed() : null, ytTrending()].filter(Boolean);
  const lists = (await Promise.allSettled(jobs)).filter(r => r.status === 'fulfilled').map(r => r.value);
  const seen = new Set(st.ytHistory.slice(0, 15).map(v => v.id)), out = [];
  // interleave so every source shows up near the top
  for (let i = 0; out.length < 60 && lists.some(l => i < l.length); i++)
    for (const l of lists) { const v = l[i]; if (v && !seen.has(v.id)) { seen.add(v.id); out.push(v); } }
  if (!out.length) throw new Error('no-source');
  yt.rec = { at: Date.now(), items: out };
  return out;
}

function vItem(v, i, on) {
  return `<button class="vitem${on ? ' on' : ''}" data-v="${i}">
    <div class="th"><img loading="lazy" alt="" src="${esc(v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`)}">${v.dur ? `<span class="dur">${fmtSecs(v.dur)}</span>` : v.count != null ? `<span class="dur">${v.count} วิดีโอ</span>` : ''}</div>
    <div class="grow"><div class="t">${esc(v.title || 'วิดีโอ YouTube')}</div><div class="sub title">${esc(v.author || '')}</div></div></button>`;
}
function renderList(items, label) {
  const l = $('#ytList');
  l._items = items;
  l.innerHTML = (label ? `<div class="label sub" style="padding:6px 6px 2px">${esc(label)}</div>` : '') +
    items.map((v, i) => vItem(v, i, yt.cur && v.id === yt.cur.id)).join('');
}
function ytShowIdle() {
  if (yt.cur || $('#ytList')._items?.length) return;
  ytTab(yt.tab || 'rec');
}
// ---------- Home tabs: recent, and with a Google sign-in: subscriptions, liked, playlists ----------
const TABS = { rec: 'แนะนำ', recent: 'ล่าสุด', subs: 'ติดตาม', liked: 'ชอบ', lists: 'เพลย์ลิสต์' };
function tabsBar(active) {
  return `<div class="chips">${Object.entries(TABS).map(([k, t]) => `<button class="chip-btn${k === active ? ' on' : ''}" data-tab="${k}">${t}</button>`).join('')}
    <button class="chip-btn acct" data-tab="account">${svg('person')}${ytSignedIn() ? 'บัญชี' : 'เข้าสู่ระบบ'}</button></div>`;
}
async function ytTab(tab) {
  yt.tab = tab;
  const l = $('#ytList');
  const head = tabsBar(tab);
  const show = (items, empty) => {
    l._items = items;
    l.innerHTML = head + (items.length ? items.map((v, i) => vItem(v, i, yt.cur && v.id && v.id === yt.cur.id)).join('') : `<div class="empty">${empty}</div>`);
  };
  if (tab === 'recent') return show(st.ytHistory, `${svg('play', ' style="width:48px;height:48px;color:#ff0033"')}<div>ค้นหาวิดีโอ หรือวางลิงก์ YouTube ในช่องด้านบน</div>`);
  if (tab === 'rec') {
    l._items = []; l.innerHTML = head + '<div class="empty">กำลังโหลดวิดีโอแนะนำ…</div>';
    try { const items = await ytRecommended(); if (yt.tab === tab) show(items, ''); }
    catch { if (yt.tab === tab) { l._items = []; l.innerHTML = head + `<div class="empty"><div>โหลดวิดีโอแนะนำไม่ได้ในตอนนี้</div><div class="sub">เข้าสู่ระบบหรือใส่ API key ในตั้งค่าเพื่อให้โหลดได้เสถียร</div><button class="btn" data-tab="rec">ลองอีกครั้ง</button></div>`; } }
    return;
  }
  if (!ytSignedIn() && !st.ytClientId) {
    l._items = [];
    l.innerHTML = head + `<div class="empty"><div>เข้าสู่ระบบด้วย Google เพื่อดูช่องที่ติดตาม วิดีโอที่ชอบ และเพลย์ลิสต์ของคุณ</div><button class="btn primary" data-tab="account">ตั้งค่าบัญชี</button></div>`;
    return;
  }
  l._items = []; l.innerHTML = head + '<div class="empty">กำลังโหลด…</div>';
  try {
    const items = tab === 'subs' ? await ytSubsFeed() : tab === 'liked' ? await ytLiked() : await ytPlaylists();
    if (yt.tab === tab) show(items, 'ยังไม่มีรายการ');
  } catch (e) {
    if (yt.tab === tab) { l._items = []; l.innerHTML = head + `<div class="empty"><div>โหลดไม่ได้ ${e?.message === 'auth' ? '(ยังไม่ได้เข้าสู่ระบบ)' : ''}</div><button class="btn" data-tab="${tab}">ลองอีกครั้ง</button></div>`; }
  }
}
$('#ytForm').onsubmit = async e => {
  e.preventDefault();
  const q = $('#ytQ').value.trim(); if (!q) return;
  $('#ytQ').blur();
  const parsed = ytParse(q);
  if (parsed) { $('#ytQ').value = ''; return ytPlayParsed(parsed); }
  openList(true);
  $('#ytList').innerHTML = '<div class="empty">กำลังค้นหา…</div>';
  try {
    const items = await ytSearch(q);
    yt.queue = items; yt.idx = -1;
    renderList(items);
  } catch {
    $('#ytList').innerHTML = `<div class="empty"><div>ค้นหาไม่ได้ในตอนนี้${st.ytKey ? ' (ตรวจสอบ API key)' : ''}</div>
      <div class="sub">วางลิงก์วิดีโอแทนได้ หรือใส่ YouTube API key ในตั้งค่าเพื่อให้ค้นหาได้เสถียร</div>
      <div class="row"><button class="btn" id="ytOpenSearch"><span class="ic" data-i="open"></span>ค้นใน YouTube</button><button class="btn" id="ytKeyBtn">ตั้งค่า</button></div></div>`;
    paintIcons($('#ytList'));
    $('#ytOpenSearch').onclick = () => openWeb('https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
    $('#ytKeyBtn').onclick = settingsSheet;
  }
};
$('#ytList').addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) return t.dataset.tab === 'account' ? accountSheet() : ytTab(t.dataset.tab);
  const b = e.target.closest('.vitem'); if (!b) return;
  const items = $('#ytList')._items, v = items[+b.dataset.v];
  if (!v.id) { yt.queue = []; yt.idx = -1; return ytPlay(v); } // a playlist
  yt.queue = items.filter(x => x.id); yt.idx = yt.queue.indexOf(v);
  ytPlay(v);
});
$('#ytQ').addEventListener('input', () => { if (!$('#ytQ').value && !yt.cur) { $('#ytList')._items = []; ytTab(yt.tab || 'rec'); } });
function openList(on) { $('#yt').classList.toggle('list-open', on); }
$('#ytListBtn').onclick = () => openList(!$('#yt').classList.contains('list-open'));
// video fills its own pane; the way back is in the ⋯ menu on the divider so nothing covers the player
function setTheater(on) {
  $('#yt').classList.toggle('theater', on);
  $('#ytFsExit').hidden = !on;
  if (on) toast('ออกจากเต็มจอ: แตะ ⋯ ที่แถบกลาง', 2500);
}
$('#ytFs').onclick = () => setTheater(true);
$('#ytFsExit').onclick = () => { setTheater(false); $('#dockBar').hidden = true; };

function loadYTApi() {
  if (yt.apiReady) return yt.apiReady;
  yt.apiReady = new Promise((res, rej) => {
    if (window.YT?.Player) return res();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = rej;
    document.head.append(s);
    setTimeout(() => rej(new Error('timeout')), 10000);
  }).catch(e => { yt.apiReady = null; throw e; });
  return yt.apiReady;
}

function ytPlayParsed(p) {
  if (p.id) {
    const v = { id: p.id, title: '', author: '', start: p.start, list: p.list };
    yt.queue = [v]; yt.idx = 0; ytPlay(v);
  } else ytPlay({ list: p.list, title: 'เพลย์ลิสต์' });
}

async function ytPlay(v) {
  yt.cur = v;
  $('#yt').classList.add('playing'); $('#ytStage').hidden = false; $('#ytErr').hidden = true; $('#ytListBtn').hidden = $('#ytFs').hidden = false;
  if (yt.queue.length > 1) renderList(yt.queue); else openList(false);
  if (v.id) addHistory(v);
  // near the end of the list: fetch what plays next so the list shows it and autoplay continues
  if (v.id && yt.idx >= yt.queue.length - 2) extendQueue();
  // fs: 0 removes YouTube's own fullscreen, which would cover the map; #ytFs fills the pane instead
  const vars = { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 0, origin: location.origin, start: v.start || 0 };
  try {
    await loadYTApi();
    if (yt.player && yt.player.loadVideoById) {
      if (v.id && !v.list) yt.player.loadVideoById({ videoId: v.id, startSeconds: v.start || 0 });
      else yt.player.loadPlaylist({ list: v.list, listType: 'playlist' });
      return;
    }
    $('#ytHost').innerHTML = '<div id="ytPlayer"></div>';
    yt.player = new YT.Player('ytPlayer', {
      host: 'https://www.youtube.com', // youtube.com (not -nocookie) so a signed-in account, Premium and history apply
      videoId: v.id || undefined,
      playerVars: v.list ? { ...vars, listType: 'playlist', list: v.list } : vars,
      events: {
        onStateChange: e => {
          yt.playing = e.data === 1;
          if (yt.playing) keepAwake(true); else if (!wantAwake()) keepAwake(false);
          if (e.data === 0 && st.autoNext) ytNext();
          if (e.data === 1) refreshTitle();
        },
        onError: e => ytError(e.data)
      }
    });
  } catch {
    // IFrame API unavailable: plain embed still plays
    yt.player = null;
    const q = new URLSearchParams({ autoplay: 1, playsinline: 1, rel: 0, fs: 0 });
    if (v.list) q.set('list', v.list);
    if (v.start) q.set('start', v.start);
    $('#ytHost').innerHTML = `<iframe src="https://www.youtube.com/embed/${v.id || 'videoseries'}?${q}" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }
}
function refreshTitle() {
  const d = yt.player?.getVideoData?.(); if (!d || !yt.cur) return;
  if (!yt.cur.title && d.title) {
    yt.cur.title = d.title; yt.cur.author = d.author; addHistory(yt.cur);
    if (!$('#yt').classList.contains('list-open')) return;
    renderList(yt.queue);
  }
}
async function ytNext() {
  if (!(yt.idx >= 0 && yt.idx < yt.queue.length - 1)) await extendQueue();
  if (yt.idx >= 0 && yt.idx < yt.queue.length - 1) { yt.idx++; ytPlay(yt.queue[yt.idx]); }
}
// add videos related to the current one to the end of the queue ("ถัดไป")
async function extendQueue() {
  const cur = yt.cur; if (!cur?.id) return;
  try {
    const rel = (await ytRelated(cur.id)).filter(v => !yt.queue.some(q => q.id === v.id)).slice(0, 15);
    if (yt.cur !== cur || !rel.length) return;
    if (!yt.queue.includes(cur)) { yt.queue = [cur]; yt.idx = 0; }
    yt.queue = [...yt.queue, ...rel];
    renderList(yt.queue, 'กำลังเล่นและถัดไป');
    $('#ytErrNext').hidden = $('#ytErr').hidden;
  } catch {}
}
function ytError(code) {
  const embedOff = [101, 150, 152, 153].includes(code);
  $('#ytErrMsg').textContent = embedOff ? 'เจ้าของวิดีโอไม่อนุญาตให้เล่นนอก YouTube' : code === 100 ? 'ไม่พบวิดีโอนี้ (อาจถูกลบหรือเป็นส่วนตัว)' : 'เล่นวิดีโอนี้ไม่ได้';
  $('#ytErrNext').hidden = !(yt.idx >= 0 && yt.idx < yt.queue.length - 1);
  $('#ytErr').hidden = false;
}
$('#ytErrOpen').onclick = () => { const v = yt.cur; if (v) openWeb(v.id ? `https://www.youtube.com/watch?v=${v.id}` : `https://www.youtube.com/playlist?list=${v.list}`); };
$('#ytErrNext').onclick = ytNext;
function addHistory(v) {
  st.ytHistory = [{ id: v.id, title: v.title, author: v.author }, ...st.ytHistory.filter(x => x.id !== v.id)].slice(0, 30);
  save();
}

// ===================================================================
// YouTube account
//  - Player: the embed runs on youtube.com, so signing in to youtube.com in this browser
//    gives the player your account (Premium without ads, watch history).
//  - Lists: Google sign-in (OAuth client ID) reads subscriptions, likes and playlists.
// ===================================================================
const yta = Object.assign({ token: null, exp: 0 }, store.get('carscreen.ytauth', {}));
const ytSignedIn = () => !!yta.token && Date.now() < yta.exp;
let gisReady = null;
function loadGIS() {
  if (gisReady) return gisReady;
  gisReady = new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisReady = null; rej(new Error('gis')); };
    document.head.append(s);
  });
  return gisReady;
}
async function ytLogin(prompt = '') {
  if (!st.ytClientId) throw new Error('auth');
  await loadGIS();
  return new Promise((res, rej) => {
    google.accounts.oauth2.initTokenClient({
      client_id: st.ytClientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      prompt,
      callback: r => {
        if (r.error) return rej(new Error('auth'));
        yta.token = r.access_token; yta.exp = Date.now() + (r.expires_in - 60) * 1000;
        store.set('carscreen.ytauth', { token: yta.token, exp: yta.exp });
        res();
      },
      error_callback: () => rej(new Error('auth'))
    }).requestAccessToken();
  });
}
function ytLogout() {
  if (yta.token && window.google?.accounts?.oauth2) try { google.accounts.oauth2.revoke(yta.token); } catch {}
  yta.token = null; yta.exp = 0; store.set('carscreen.ytauth', {});
}
async function ytApi(path, params) {
  const p = new URLSearchParams(params), opts = {};
  if (ytSignedIn() || (!st.ytKey && st.ytClientId)) {
    if (!ytSignedIn()) await ytLogin();
    opts.headers = { Authorization: 'Bearer ' + yta.token };
  } else if (st.ytKey) p.set('key', st.ytKey);
  else throw new Error('auth');
  return getJSON(`https://www.googleapis.com/youtube/v3/${path}?${p}`, 10000, opts);
}
const isoSecs = d => { const m = (d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const thumbOf = sn => sn?.thumbnails?.medium?.url || sn?.thumbnails?.default?.url;
async function ytSubsFeed() {
  const subs = await ytApi('subscriptions', { part: 'snippet', mine: 'true', maxResults: 50, order: 'relevance' });
  const ids = subs.items.map(s => s.snippet.resourceId.channelId).slice(0, 20);
  if (!ids.length) return [];
  const ch = await ytApi('channels', { part: 'contentDetails', id: ids.join(','), maxResults: 50 });
  const uploads = ch.items.map(c => c.contentDetails.relatedPlaylists.uploads);
  const lists = await Promise.all(uploads.map(pl => ytApi('playlistItems', { part: 'snippet,contentDetails', playlistId: pl, maxResults: 4 }).catch(() => ({ items: [] }))));
  return lists.flatMap(l => l.items)
    .map(x => ({ id: x.contentDetails.videoId, title: x.snippet.title, author: x.snippet.videoOwnerChannelTitle || x.snippet.channelTitle, at: x.contentDetails.videoPublishedAt || x.snippet.publishedAt }))
    .filter(x => x.id).sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 40);
}
async function ytLiked() {
  const j = await ytApi('videos', { part: 'snippet,contentDetails', myRating: 'like', maxResults: 30 });
  return j.items.map(x => ({ id: x.id, title: x.snippet.title, author: x.snippet.channelTitle, dur: isoSecs(x.contentDetails.duration) }));
}
async function ytPlaylists() {
  const j = await ytApi('playlists', { part: 'snippet,contentDetails', mine: 'true', maxResults: 30 });
  return j.items.map(x => ({ list: x.id, title: x.snippet.title, author: 'เพลย์ลิสต์', thumb: thumbOf(x.snippet), count: x.contentDetails.itemCount }));
}
function accountSheet() {
  const origin = location.origin;
  openSheet(`<h2>บัญชี YouTube</h2>
    <div class="sub"><b>1. ใช้บัญชีในตัวเล่นวิดีโอ</b> (YouTube Premium ไม่มีโฆษณา, บันทึกประวัติการดู) เข้าสู่ระบบ youtube.com ใน Chrome ครั้งเดียว แล้วกลับมาที่นี่</div>
    <button class="btn" id="accWeb"><span class="ic" data-i="open"></span>เข้าสู่ระบบ youtube.com</button>
    <div class="sub"><b>2. ดูช่องที่ติดตาม วิดีโอที่ชอบ เพลย์ลิสต์</b> และค้นหาได้เสถียร ต้องใช้ Google OAuth Client ID (ตั้งครั้งเดียว ฟรี)</div>
    <label>Google OAuth Client ID<input type="text" id="accCid" value="${esc(st.ytClientId)}" placeholder="xxxx.apps.googleusercontent.com" autocapitalize="off" autocomplete="off"></label>
    <div class="sub">วิธีสร้าง: Google Cloud Console → เปิด “YouTube Data API v3” → OAuth consent screen (External, เพิ่มอีเมลคุณเป็น Test user) → Credentials → Create OAuth client ID → Web application → Authorized JavaScript origins ใส่ <b>${esc(origin)}</b></div>
    <div class="sub">สถานะ: ${ytSignedIn() ? 'เข้าสู่ระบบแล้ว' : 'ยังไม่ได้เข้าสู่ระบบ'}</div>
    <div class="row">${ytSignedIn() ? '<button class="btn" id="accOut">ออกจากระบบ</button>' : '<button class="btn" data-close>ปิด</button>'}<button class="btn primary" id="accIn">เข้าสู่ระบบด้วย Google</button></div>`, s => {
    s.querySelector('#accWeb').onclick = () => openWeb('https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://www.youtube.com/'));
    s.querySelector('#accOut')?.addEventListener('click', () => { ytLogout(); closeSheet(); ytTab('recent'); toast('ออกจากระบบแล้ว', 1500); });
    s.querySelector('#accCid').addEventListener('change', e => { st.ytClientId = e.target.value.trim(); save(); if (st.ytClientId) loadGIS().catch(() => {}); });
    s.querySelector('#accIn').onclick = async () => {
      st.ytClientId = s.querySelector('#accCid').value.trim(); save();
      if (!st.ytClientId) return toast('ใส่ Client ID ก่อน');
      try { await ytLogin('select_account'); closeSheet(); toast('เข้าสู่ระบบแล้ว', 1500); ytTab('subs'); }
      catch { toast('เข้าสู่ระบบไม่สำเร็จ ตรวจสอบ Client ID และ Authorized JavaScript origins', 6000); }
    };
  });
}

// ===================================================================
// Settings & install
// ===================================================================
// drop every service worker and cache, then reload from the network
async function repairApp() {
  toast('กำลังซ่อมแอป…');
  try { for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister(); } catch {}
  try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
  location.replace(location.pathname + '?repaired=' + Date.now());
}
function settingsSheet() {
  openSheet(`<h2>ตั้งค่า</h2>
    <label>Longdo Map key (ไม่บังคับ ช่วยให้หาสถานที่ในไทยเจอมากขึ้น)<input type="text" id="sLongdo" value="${esc(st.longdoKey)}" placeholder="รหัส 32 ตัวอักษร" autocapitalize="off" autocomplete="off"></label>
    <div class="sub">ขอฟรีที่ map.longdo.com → เข้าสู่ระบบ → My Longdo Map → Longdo Map API → ใส่โดเมน <b>${esc(location.hostname)}</b></div>
    <label class="switch">เสียงนำทาง<input type="checkbox" id="sVoice" ${st.voice ? 'checked' : ''}></label>
    ${native?.mapsAdjacent ? `<label class="switch">ปุ่ม “เริ่มนำทาง” ใช้ Google Maps (เปิดแยกจอข้างๆ)<input type="checkbox" id="sGnav" ${st.navGoogle ? 'checked' : ''}></label>` : ''}
    <label class="switch">เล่นวิดีโอถัดไปอัตโนมัติ<input type="checkbox" id="sNext" ${st.autoNext ? 'checked' : ''}></label>
    <label>YouTube API key (ไม่บังคับ ช่วยให้ค้นหาเสถียร)<input type="password" id="sKey" value="${esc(st.ytKey)}" placeholder="AIza…" autocapitalize="off" autocomplete="off"></label>
    <div class="sub">สร้างฟรีที่ Google Cloud Console → เปิด “YouTube Data API v3” → Credentials → API key</div>
    ${native?.appVersion ? appUpdHtml() : ''}
    ${native ? '' : `<div class="sub"><b>แอป Android:</b> เปิดได้ทุกเว็บในฝั่งแอป รวมถึง m.youtube.com, Netflix, Facebook</div>
    <a class="btn" id="sApk" href="dist/car-screen.apk" download="car-screen.apk"><span class="ic" data-i="dl"></span>ดาวน์โหลดแอป Android (APK)</a>`}
    <div class="sub">แอปที่ติดตั้งเปิดไม่ขึ้นหรือไม่อัปเดต: กด “ซ่อมแอป” เพื่อล้างแคชแล้วโหลดใหม่ (การตั้งค่าและประวัติยังอยู่)</div>
    <div class="row"><button class="btn" id="sRepair">ซ่อมแอป</button><button class="btn" id="sReset">รีเซ็ตหน้าจอ</button><button class="btn primary" id="sSave">บันทึก</button></div>`, s => {
    s.querySelector('#sRepair').onclick = repairApp;
    s.querySelector('#sSave').onclick = () => {
      st.voice = s.querySelector('#sVoice').checked; st.autoNext = s.querySelector('#sNext').checked; st.ytKey = s.querySelector('#sKey').value.trim();
      st.longdoKey = s.querySelector('#sLongdo').value.trim();
      if (s.querySelector('#sGnav')) st.navGoogle = s.querySelector('#sGnav').checked;
      save(); setVoiceIcon(); closeSheet(); toast('บันทึกแล้ว', 1500);
    };
    s.querySelector('#sReset').onclick = () => { Object.assign(st, { ratio: 50, swapped: false, stack: null, mode: 'split' }); save(); applyLayout(); closeSheet(); };
  });
}
$('#settingsBtn').onclick = settingsSheet;

let installEv = null;
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; $('#install').hidden = false; });
addEventListener('appinstalled', () => { installEv = null; $('#install').hidden = true; toast('ติดตั้งแล้ว เปิดได้จากหน้าจอหลัก'); });
if (!standalone && !native && /iphone|ipad|ipod/i.test(navigator.userAgent)) $('#install').hidden = false;
$('#install').onclick = async () => {
  if (installEv) { installEv.prompt(); await installEv.userChoice; installEv = null; $('#install').hidden = true; }
  else toast('Safari: กดปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”', 6000);
};
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // when an updated service worker takes over, reload once so the new version shows right away
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}

// ===================================================================
// Boot
// ===================================================================
paintIcons();
applyLayout();
renderTiles();
showView(st.lastView === 'web' ? 'home' : st.lastView);
setVoiceIcon();
optsBadge();
if (st.ytClientId) loadGIS().catch(() => {});
wake();
startGeo();

// exposed for automated tests
window.__car = { st, nav, yt, instr, setRoute, webUrl, NO_FRAME, parseGmaps, isoSecs, ytParse, fmtDist, sayDist, haversine, here, get map() { return map; } };
})();
