// End-to-end test: real Chromium, every external service and the Android app (window.CarScreenNative) faked.
// Run: npm test   (SHOTS=dir to save screenshots)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(process.execPath, '../../lib/node_modules/playwright')); }
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8765, BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS;

// ---------- fixtures ----------
const A = [13.7460, 100.5340], B = [13.7500, 100.5340], C = [13.7500, 100.5400], D = [13.7560, 100.5400];
const geo = pts => ({ type: 'LineString', coordinates: pts.map(p => [p[1], p[0]]) });
const ROUTE = { code: 'Ok', routes: [{ distance: 1760, duration: 300, legs: [{ steps: [
  { name: 'ถนนพญาไท', geometry: geo([A, B]), maneuver: { type: 'depart', location: [A[1], A[0]] }, distance: 445, duration: 80 },
  { name: 'ถนนเพชรบุรี', geometry: geo([B, C]), maneuver: { type: 'turn', modifier: 'right', location: [B[1], B[0]] }, distance: 650, duration: 110, intersections: [{ classes: ['toll', 'motorway'] }] },
  { name: 'ซอยทดสอบ', geometry: geo([C, D]), maneuver: { type: 'turn', modifier: 'left', location: [C[1], C[0]] }, distance: 665, duration: 110 },
  { name: '', geometry: geo([D, D]), maneuver: { type: 'arrive', location: [D[1], D[0]] }, distance: 0, duration: 0 }
] }] }] };
// slower alternative without tolls: west, north, then east to D
const P1 = [13.7460, 100.5300], P2 = [13.7560, 100.5300];
const ALT = { distance: 2500, duration: 420, legs: [{ steps: [
  { name: 'ซอยเลี่ยง', geometry: geo([A, P1]), maneuver: { type: 'depart', location: [A[1], A[0]] }, distance: 430 },
  { name: 'ถนนบรรทัดทอง', geometry: geo([P1, P2]), maneuver: { type: 'turn', modifier: 'right', location: [P1[1], P1[0]] }, distance: 1110 },
  { name: 'ถนนพระราม 1', geometry: geo([P2, D]), maneuver: { type: 'turn', modifier: 'right', location: [P2[1], P2[0]] }, distance: 960 },
  { name: '', geometry: geo([D, D]), maneuver: { type: 'arrive', location: [D[1], D[0]] }, distance: 0 }
] }] };
// the same trip with a stop at B: two legs
const ROUTE_STOP = { code: 'Ok', routes: [{ distance: 1760, duration: 300, legs: [
  { steps: [
    { name: 'ถนนพญาไท', geometry: geo([A, B]), maneuver: { type: 'depart', location: [A[1], A[0]] }, distance: 445 },
    { name: '', geometry: geo([B, B]), maneuver: { type: 'arrive', location: [B[1], B[0]] }, distance: 0 }] },
  { steps: [
    { name: 'ถนนเพชรบุรี', geometry: geo([B, C]), maneuver: { type: 'depart', location: [B[1], B[0]] }, distance: 650 },
    { name: 'ซอยทดสอบ', geometry: geo([C, D]), maneuver: { type: 'turn', modifier: 'left', location: [C[1], C[0]] }, distance: 665 },
    { name: '', geometry: geo([D, D]), maneuver: { type: 'arrive', location: [D[1], D[0]] }, distance: 0 }] }
] }] };
// charging stations: fast DC at B (on the route), AC near C (on the route), one far away
const STATIONS = { elements: [
  { type: 'node', id: 1, lat: 13.7500, lon: 100.5340, tags: { amenity: 'charging_station', name: 'PEA VOLTA สามย่าน', operator: 'PEA', 'socket:type2_combo': '2', 'socket:type2_combo:output': '120 kW', 'socket:type2': '2' } },
  { type: 'way', id: 2, center: { lat: 13.7490, lon: 100.5402 }, tags: { amenity: 'charging_station', name: 'EA Anywhere', 'socket:type2': '4', 'socket:type2:output': '22 kW' } },
  { type: 'node', id: 3, lat: 13.9000, lon: 100.7000, tags: { amenity: 'charging_station', name: 'Far Station', 'socket:type2_combo': '1' } }
] };
// bundled DC list: the same PEA station as OpenStreetMap's (must not show twice) and one only this list knows
const DC = { s: [
  [13.75005, 100.53402, 'PEA VOLTA สามย่าน', '', 'PEA', [['CCS2', 120, 1], ['Type 2', 0, 0]]],
  [13.7440, 100.5330, 'Local DC', 'Local DC', 'PTT', [['CCS2', 150, 1]]]
] };
// fuel stations: one on the route at B, one far away
const FUEL = { elements: [
  { type: 'node', id: 11, lat: 13.7500, lon: 100.5345, tags: { amenity: 'fuel', name: 'ปตท. สามย่าน', brand: 'PTT', opening_hours: '24/7', 'fuel:diesel': 'yes', 'fuel:octane_95': 'yes' } },
  { type: 'node', id: 12, lat: 13.9500, lon: 100.7000, tags: { amenity: 'fuel', name: 'Shell ไกล' } }
] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PLACE_URL = 'https://www.google.com/maps/place/%E0%B8%9B%E0%B9%89%E0%B8%B2%E0%B9%81%E0%B8%94%E0%B8%87/@13.75,100.53,17z/data=!4m6!3m5!1s0x1:0x2!8m2!3d13.756!4d100.54';

// The Android app's bridge, recording every call. `version` picks the API generation:
// 21 = two browser views (paneLoad/paneRect/paneStop), 20 = media side only (load/rect/stop).
function fakeApp(version) {
  window.__native = [];
  const rec = (...a) => __native.push(a);
  const n = {
    version: () => '1', appVersion: () => window.__appVer ?? version, inSplitScreen: () => false,
    load: u => rec('load', u), rect: (x, y, w, h, s) => rec('rect', Math.round(x), Math.round(y), Math.round(w), Math.round(h), s),
    stop: () => rec('stop'), back: () => rec('back'), external: u => rec('external', u),
    update: (u, h) => rec('update', u, h),
    // the app fetching pages for the web side: short Google Maps links and websites' HTML (for logos)
    httpGet: (id, u) => {
      rec('http', u);
      const reply = (...a) => setTimeout(() => __http(id, ...a), 10);
      if (u.includes('maps.app.goo.gl')) return reply(200, 'https://www.google.com/maps/place/Wat+Arun/@13.74,100.48,17z/data=!3d13.7437!4d100.4888', '');
      if (u === 'https://joox.com/') return reply(200, 'https://www.joox.com/', '<html><head><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" sizes="180x180" href="/touch-icon.png"></head></html>');
      if (u.startsWith('https://plain.example') || u.startsWith('https://nologo.example')) return reply(200, u, '<html><head><title>x</title></head></html>');
      reply(404, u, '');
    }
  };
  if (version >= 21) Object.assign(n, {
    paneLoad: (id, u) => rec('paneLoad', id, u),
    paneRect: (id, x, y, w, h, s) => rec('paneRect', id, Math.round(x), Math.round(y), Math.round(w), Math.round(h), s),
    paneStop: id => rec('paneStop', id)
  });
  window.CarScreenNative = n;
}

// ---------- harness ----------
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await pw.chromium.launch();
let failed = 0, passed = 0;
const counts = {};
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; if (SHOTS && globalThis.__pg) await globalThis.__pg.screenshot({ path: path.join(SHOTS, 'fail-' + name.replace(/\W+/g, '_').slice(0, 30) + '.png') }).catch(() => {}); console.log('  ✗', name, '\n    ', e.message.split('\n').filter((l, i) => i < 8 || /intercepts|not visible|not stable|outside/.test(l)).slice(0, 8).join('\n     ')); }
}
// app: 21 (default), 20 (older app) or 0 (plain browser, no app)
async function newPage(viewport, { app = 21, ...extra } = {}) {
  const ctx = await browser.newContext({ viewport, geolocation: { latitude: A[0], longitude: A[1], accuracy: 8 }, permissions: ['geolocation'], locale: 'th-TH', ...extra });
  // headless Chromium does not push setGeolocation() changes to watchPosition, so drive GPS from the test
  await ctx.addInitScript(([lat, lng]) => {
    const cbs = [];
    const mk = (lat, lng, speed = null) => ({ coords: { latitude: lat, longitude: lng, accuracy: 8, speed, heading: null }, timestamp: Date.now() });
    let last = mk(lat, lng);
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition(ok) { cbs.push(ok); setTimeout(() => ok(last), 50); return cbs.length; },
      clearWatch() {}, getCurrentPosition(ok) { setTimeout(() => ok(last), 50); }
    } });
    window.__setPos = (lat, lng, speed) => { last = mk(lat, lng, speed); cbs.forEach(f => f(last)); };
  }, A);
  if (app) await ctx.addInitScript(fakeApp, app);
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  globalThis.__pg = page;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // the service worker would answer this file itself, bypassing ctx.route, so swap it in at fetch()
  await ctx.addInitScript(dc => { const f = window.fetch; window.fetch = (u, o) => /dc-stations\.json/.test(String(u)) ? Promise.resolve(new Response(JSON.stringify(dc), { headers: { 'content-type': 'application/json' } })) : f.call(window, u, o); }, DC);
  await ctx.route(/^https?:\/\/(?!localhost)/, route => {
    const u = route.request().url(); const hit = k => (counts[k] = (counts[k] || 0) + 1);
    const json = b => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (u.includes('tile.openstreetmap.org')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    const svgIcon = n => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><rect width="${n}" height="${n}" fill="#0a84ff"/></svg>` });
    if (u === 'https://www.joox.com/touch-icon.png') return svgIcon(180);
    if (u.includes('t1.gstatic.com/faviconV2') && u.includes('plain.example')) return svgIcon(64);
    if (u.includes('router.project-osrm.org') && counts.osrmDown) { hit('osrmDownHit'); return route.fulfill({ status: 503, body: 'down' }); }
    if (u.includes('router.project-osrm.org') || u.includes('routing.openstreetmap.de')) {
      hit(u.includes('routing.openstreetmap.de') ? 'osrmBackup' : 'osrm'); const ex = new URL(u).searchParams.get('exclude');
      (counts.osrmUrls = counts.osrmUrls || []).push(u);
      if (new URL(u).pathname.split(';').length === 3) return json(ROUTE_STOP);
      if (ex) (counts.exclude = counts.exclude || []).push(ex);
      if (ex && ex.includes(',')) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'InvalidValue' }) });
      return json(ex === 'toll' ? { code: 'Ok', routes: [ALT] } : { code: 'Ok', routes: [ROUTE.routes[0], ALT] });
    }
    if (u.includes('overpass-api.de')) { hit('overpass0'); return route.fulfill({ status: 504, body: 'busy' }); }
    if (u.includes('overpass.kumi.systems')) { hit('overpass1'); const q = decodeURIComponent((route.request().postData() || '').replace(/^data=/, '')); (counts.overpassQ = counts.overpassQ || []).push(q); return json(q.includes('"amenity"="fuel"') ? FUEL : STATIONS); }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__car && window.__car.here.ll);
  const calls = kind => page.evaluate(k => __native.filter(c => c[0] === k), kind);
  const last = async (kind, id) => (await calls(kind)).filter(c => id == null || c[1] === id).at(-1);
  return { page, ctx, errors, calls, last };
}
const shot = (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, name + '.png') });
const vis = (page, sel) => page.locator(sel).isVisible();
const box = (page, sel) => page.locator(sel).boundingBox();

// ---------- units ----------
console.log('Units');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  const r = await page.evaluate(() => {
    const { instr, fmtDist, sayDist, parseGmaps } = window.__car;
    return {
      i1: instr({ name: 'ถนนสุขุมวิท', maneuver: { type: 'turn', modifier: 'left' } }),
      i2: instr({ name: '', maneuver: { type: 'roundabout', exit: 2 } }),
      i3: instr({ name: '', maneuver: { type: 'arrive' } }),
      i4: instr({ name: '', maneuver: { type: 'fork', modifier: 'slight right' } }),
      i5: instr({ name: '', maneuver: { type: 'continue', modifier: 'uturn' } }),
      d1: fmtDist(347), d2: fmtDist(1530), d3: fmtDist(23456), s1: sayDist(312), s2: sayDist(1500),
      g1: parseGmaps('https://www.google.com/maps/place/Siam+Paragon/@13.7462,100.5347,17z/data=!3m1!4b1!3d13.746289!4d100.534878'),
      g2: parseGmaps('https://maps.google.com/?q=13.7563,100.5018'),
      g3: parseGmaps('https://maps.app.goo.gl/AbCdEf')
    };
  });
  await test('Thai turn instructions', () => {
    assert.equal(r.i1, 'เลี้ยวซ้าย เข้าสู่ถนนสุขุมวิท'); assert.equal(r.i2, 'เข้าวงเวียน ออกทางออกที่ 2');
    assert.equal(r.i3, 'ถึงจุดหมายปลายทาง'); assert.equal(r.i4, 'ที่ทางแยก ชิดขวา'); assert.equal(r.i5, 'กลับรถ');
  });
  await test('distance formatting', () => {
    assert.equal(r.d1, '350 ม.'); assert.equal(r.d2, '1.5 กม.'); assert.equal(r.d3, '23 กม.');
    assert.equal(r.s1, '300 เมตร'); assert.equal(r.s2, '1.5 กิโลเมตร');
  });
  await test('Google Maps links: exact pin, q=, short links need the app', () => {
    assert.deepEqual([r.g1.lat, r.g1.lng, r.g1.name], [13.746289, 100.534878, 'Siam Paragon']);
    assert.deepEqual([r.g2.lat, r.g2.lng], [13.7563, 100.5018]);
    assert.equal(r.g3, null);
  });
  await test('removed features are gone', async () => {
    for (const sel of ['#yt', '#ytQ', '#install', '#rcGmaps', '#sLongdo', '#web', '#dockToggle', '#swap', '#appOut', 'link[rel=manifest]']) assert.equal(await page.locator(sel).count(), 0, sel);
    assert.equal(await page.evaluate(() => Object.keys(__car.st).filter(k => /yt|longdo|navGoogle|custom|extSeen/i.test(k)).length), 0, 'old settings cleaned up');
  });
  await test('no console errors on load', () => assert.deepEqual(errors, []));
  await test('start-up notice stays hidden when the app runs', async () => { await page.waitForTimeout(3000); assert.equal(await page.locator('#bootFail').count(), 0); });
  await ctx.close();
}

// ---------- start-up problems ----------
console.log('Startup problems');
{
  const open = async (opts, appJs) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
    if (appJs) await ctx.route(/app\.js$/, appJs);
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 404, body: '' }));
    const page = await ctx.newPage(); await page.goto(BASE);
    return { ctx, page };
  };
  {
    const { ctx, page } = await open({}, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'let x = a?.b ?? ;' }));
    await test('a start-up error shows the real error, not "too old" (after one automatic repair)', async () => {
      await page.waitForSelector('#bootFail', { timeout: 12000 });
      const t = await page.textContent('#bootFail');
      assert.match(t, /เกิดข้อผิดพลาดตอนเปิดแอป/); assert.doesNotMatch(t, /เก่าเกินไป/); assert.match(t, /ข้อผิดพลาด: .*app\.js:1/);
    });
    await ctx.close();
  }
  {
    const ua = 'Mozilla/5.0 (Linux; Android 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Mobile Safari/537.36';
    const { ctx, page } = await open({ userAgent: ua }, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'let x = a?.b ?? ;' }));
    await test('an engine older than Chrome 85 is named as the cause', async () => {
      await page.waitForSelector('#bootFail', { timeout: 5000 });
      assert.match(await page.textContent('#bootFail'), /เวอร์ชัน 69 เก่าเกินไป/);
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await open({}, async r => { await new Promise(res => setTimeout(res, 8000)); await r.continue(); });
    await test('a slow connection is not reported as a failure', async () => {
      await page.waitForTimeout(7000);
      assert.equal(await page.locator('#bootFail').count(), 0);
      await page.waitForFunction(() => window.__car, null, { timeout: 10000 });
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await open({});
    await test('second launch starts from stored files, even offline', async () => {
      await page.waitForFunction(() => window.__car);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.waitForFunction(() => navigator.serviceWorker.controller || (location.reload(), false), null, { timeout: 8000 }).catch(() => {});
      await page.waitForFunction(() => window.__car && navigator.serviceWorker.controller, null, { timeout: 8000 });
      await ctx.setOffline(true); await page.reload();
      await page.waitForFunction(() => window.__car, null, { timeout: 5000 });
      await ctx.setOffline(false);
    });
    await ctx.close();
  }
}

// ---------- layout ----------
console.log('Layout');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  await test('landscape: map and apps side by side, map a little wider, bar below', async () => {
    const m = await box(page, '#mapPane'), d = await box(page, '#mediaPane'), b = await box(page, '#bar');
    assert.ok(m.x < d.x && Math.abs(m.y - d.y) < 2, 'side by side');
    assert.ok(m.width > d.width, 'map wider');
    assert.ok(b.y >= m.y + m.height, 'bar under the panes');
    assert.equal(await page.locator('#dock .dock-app').count(), 5, 'app shortcuts in the bar');
  });
  await test('app logos sit in the exact middle of the screen, in every layout', async () => {
    for (const [w, h] of [[1280, 800], [1000, 600], [1920, 720]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(100);
      const d = await box(page, '#dock');
      assert.ok(Math.abs(d.x + d.width / 2 - w / 2) <= 1.5, `${w}px: logos centre ${d.x + d.width / 2}`);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });
  await shot(page, '1-home');
  await test('search and recenter fade when idle and return on touch', async () => {
    await page.waitForFunction(() => document.body.classList.contains('idle'), null, { timeout: 7000 });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#search').evaluate(e => getComputedStyle(e).opacity), '0');
    await page.mouse.click(300, 400);
    assert.equal(await page.evaluate(() => document.body.classList.contains('idle')), false);
  });
  await test('bar buttons: map only, apps only, split; swap is in settings', async () => {
    await page.click('#bar [data-mode="map"]'); assert.equal(await vis(page, '#mediaPane'), false);
    await page.click('#bar [data-mode="media"]'); assert.equal(await vis(page, '#mapPane'), false);
    await page.click('#bar [data-mode="split"]');
    await page.click('#settingsBtn'); await page.click('#sSwap'); await page.click('#sheet [data-close]');
    assert.ok((await box(page, '#mediaPane')).x < (await box(page, '#mapPane')).x, 'swapped');
    await page.click('#settingsBtn'); await page.click('#sSwap'); await page.click('#sheet [data-close]');
  });
  await test('drag the divider to resize; remembered after reload', async () => {
    const d = await box(page, '#divider');
    await page.mouse.move(d.x + d.width / 2, d.y + 100); await page.mouse.down();
    await page.mouse.move(1280 * 0.7, d.y + 100, { steps: 5 }); await page.mouse.up();
    assert.ok((await box(page, '#mapPane')).width > 800);
    const ratio = await page.evaluate(() => __car.st.ratio);
    await page.reload(); await page.waitForFunction(() => window.__car);
    assert.equal(await page.evaluate(() => __car.st.ratio), ratio);
  });
  await test('no console errors in layout', () => assert.deepEqual(errors, []));
  await ctx.close();

  const ph = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await test('phone portrait: map above apps, nothing wider than the screen', async () => {
    const m = await box(ph.page, '#mapPane'), d = await box(ph.page, '#mediaPane');
    assert.ok(m.y < d.y && Math.abs(m.x - d.x) < 2, 'stacked');
    assert.equal(await ph.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const b = await box(ph.page, '#bar');
    assert.ok(b.x >= 0 && b.x + b.width <= 390);
  });
  await shot(ph.page, '2-phone');
  await ph.ctx.close();
}

// ---------- search & navigation ----------
console.log('Search & navigation');
{
  const { page, ctx, errors, calls, last } = await newPage({ width: 1280, height: 800 });
  const setPos = async (p, speed = 12) => { await page.evaluate(([a, b, s]) => __setPos(a, b, s), [p[0], p[1], speed]); await page.waitForTimeout(120); };
  await page.evaluate(() => { window.__said = []; speechSynthesis.speak = u => window.__said.push(u.text); });
  await test('typing a place opens Google Maps as a tab over the map', async () => {
    await page.fill('#q', 'ร้านข้าวมันไก่'); await page.press('#q', 'Enter');
    const l = await last('paneLoad', 1);
    assert.match(l[2], /^https:\/\/www\.google\.com\/maps\/search\/%E0%B8%A3.*\/@[\d.]+,[\d.]+,14z$/);
    assert.ok(await vis(page, '#gmPanel'));
    await page.waitForTimeout(300);
    const r = await last('paneRect', 1), h = await box(page, '#gmHost'), m = await box(page, '#mapPane');
    assert.deepEqual(r.slice(2, 6), [h.x, h.y, h.width, h.height].map(Math.round), 'browser view sits on #gmHost');
    assert.ok(h.x + h.width <= m.x + m.width + 1, 'inside the map side');
    assert.equal(r[6], true);
  });
  await test('tabs switch between the map and Google Maps', async () => {
    await page.click('#gmToMap'); await page.waitForTimeout(250);
    assert.equal((await last('paneRect', 1))[6], false);
    assert.ok(await vis(page, '#gmTab'));
    await page.click('#gmTab'); await page.waitForTimeout(250);
    assert.equal((await last('paneRect', 1))[6], true);
  });
  await test('choosing a place → ไปที่นี่ closes Google Maps and shows routes', async () => {
    await page.evaluate(() => __gmUrl('https://www.google.com/maps/search/x/@13.7,100.5,14z'));
    assert.equal(await vis(page, '#gmPick'), false, 'search pages are not places');
    await page.evaluate(u => __gmUrl(u), PLACE_URL);
    assert.equal(await page.textContent('#gmPickName'), 'ป้าแดง');
    await shot(page, '3-gmaps-tab');
    await page.click('#gmPickGo');
    assert.deepEqual(await last('paneStop', 1), ['paneStop', 1]);
    assert.equal(await vis(page, '#gmPanel'), false);
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    assert.equal(await page.textContent('#rcName'), 'ป้าแดง');
    assert.match(await page.textContent('#rcMeta'), /1\.8 กม\. · 5 นาที/);
    const line = await page.locator('.leaflet-overlay-pane path').last().boundingBox();
    assert.ok(line && line.height > 100, 'route drawn');
  });
  await test('alternative routes with toll badges, selectable', async () => {
    assert.equal(await page.locator('.alt').count(), 2);
    assert.match(await page.textContent('.alt >> nth=0'), /เสียค่าผ่านทาง.*ทางด่วน/s);
    assert.match(await page.textContent('.alt >> nth=1'), /ไม่มีค่าผ่านทาง/);
    await page.click('.alt >> nth=1');
    assert.equal(await page.evaluate(() => __car.nav.route.distance), 2500);
    await page.click('.alt >> nth=0');
  });
  await shot(page, '4-route');
  await test('route options: avoid tolls + highways, falls back when the server cannot do both', async () => {
    await page.click('#rcOpts');
    await page.check('#oToll'); await page.check('#oMotorway'); await page.click('#oSave');
    await page.waitForFunction(() => __car.nav.route?.distance === 2500);
    assert.deepEqual(counts.exclude.slice(-2), ['toll,motorway', 'toll']);
    assert.match(await page.textContent('#toast'), /เลี่ยงทางด่วนไม่ได้/);
    assert.ok(await page.locator('#rcOpts.on').count());
    await page.click('#rcOpts'); await page.uncheck('#oToll'); await page.uncheck('#oMotorway'); await page.click('#oSave');
    await page.waitForFunction(() => __car.nav.route?.distance === 1760);
  });
  await test('start navigation → banner, ETA, voice', async () => {
    await page.click('#rcGo');
    assert.ok(await vis(page, '#navBanner'));
    assert.equal(await page.textContent('#nbText'), 'เลี้ยวขวา เข้าสู่ถนนเพชรบุรี');
    assert.match(await page.textContent('#nfEta'), /^ถึง \d{2}:\d{2}/);
    assert.match((await page.evaluate(() => __said)).join('|'), /เริ่มนำทาง/);
  });
  await test('driving updates distance, speaks, moves to the next turn', async () => {
    await setPos([13.7480, 100.5340]);
    assert.match(await page.textContent('#nbDist'), /2[0-9]0 ม\./);
    assert.match((await page.evaluate(() => __said)).join('|'), /อีก 200 เมตร เลี้ยวขวา/);
    await setPos([13.7500, 100.5360]);
    assert.equal(await page.textContent('#nbText'), 'เลี้ยวซ้าย เข้าสู่ซอยทดสอบ');
  });
  await shot(page, '5-navigating');
  await test('going off-route reroutes; arriving ends navigation', async () => {
    const before = counts.osrm;
    for (const lng of [100.5300, 100.5299, 100.5298, 100.5297]) await setPos([13.7520, lng]);
    await page.waitForTimeout(400);
    assert.ok(counts.osrm > before);
    await setPos([13.7500, 100.5380]); await setPos([13.7540, 100.5400]); await setPos([13.7559, 100.5400]);
    await page.waitForSelector('#navBanner', { state: 'hidden' });
    assert.match(await page.textContent('#toast'), /ถึงจุดหมาย/);
  });
  await test('picking a recent place closes an open Google Maps tab', async () => {
    await page.mouse.click(600, 600);
    await page.fill('#q', 'กาแฟ'); await page.press('#q', 'Enter');
    await page.click('#gmToMap');
    const n = (await calls('paneStop')).length;
    await page.fill('#q', ''); await page.click('#q'); await page.waitForSelector('#results [data-recent]');
    await page.click('#results [data-recent]');
    assert.equal((await calls('paneStop')).length, n + 1, 'picking a recent place closes it');
    assert.equal(await vis(page, '#gmTab'), false);
  });
  await test('pasting a Google Maps link, short link (resolved by the app) and coordinates', async () => {
    await page.click('#rcClose');
    await page.fill('#q', 'https://www.google.com/maps/place/Siam+Paragon/@13.7462,100.5347,17z/data=!3d13.746289!4d100.534878'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'Siam Paragon');
    await page.fill('#q', 'https://maps.app.goo.gl/AbCdEf'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'Wat Arun');
    await page.fill('#q', '13.75, 100.5'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => __car.nav.dest?.lat === 13.75);
  });
  await test('long-press on the map sets a destination', async () => {
    await page.click('#rcClose');
    await page.mouse.click(200, 500, { button: 'right' });
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'ตำแหน่งที่เลือก');
  });
  await test('no console errors in navigation', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- charging stations & stops ----------
console.log('Charging & stops');
{
  const { page, ctx, errors, last } = await newPage({ width: 1280, height: 800 });
  const setPos = async (p, speed = 12) => { await page.evaluate(([a, b, s]) => __setPos(a, b, s), [p[0], p[1], speed]); await page.waitForTimeout(120); };
  const coordsIn = u => new URL(u).pathname.split('/').pop().split(';').length;
  await page.evaluate(() => { window.__said = []; speechSynthesis.speak = u => window.__said.push(u.text); });
  await test('charging stations are on the map without pressing ⚡; tap one to go or stop there', async () => {
    await page.waitForFunction(() => document.querySelectorAll('.ev-pin.sm').length >= 1);
    assert.equal(await page.locator('.ev-pin.sm').count(), 2, 'both bundled stations in view');
    await page.locator('.ev-pin.sm').nth(0).click();
    assert.match(await page.textContent('.ev-popup'), /CCS2.*ไปที่นี่/s);
    await shot(page, '09-ev-pins');
    await page.click('.ev-popup [data-pgo]');
    await page.waitForFunction(() => /Local DC|PEA/.test(document.querySelector('#rcName').textContent));
    await page.click('#rcClose');
    await page.waitForFunction(() => document.querySelectorAll('.ev-pin.sm').length === 2);
  });
  await test('⚡ near me: stations nearest first, with plugs and power; second server used when the first is busy', async () => {
    await page.click('#evBtn');
    await page.waitForFunction(() => document.querySelectorAll('.ev-item').length === 4); // bundled list first, OpenStreetMap joins
    assert.deepEqual(await page.$$eval('.ev-item .t', e => e.map(x => x.textContent)), ['Local DC', 'PEA VOLTA สามย่าน', 'EA Anywhere', 'Far Station'], 'bundled + OpenStreetMap, the duplicate once');
    assert.match(await page.textContent('.ev-item >> nth=1'), /CCS2 120 kW.*Type 2/s);
    assert.match(counts.overpassQ.at(-1), /around:15000,13\.746,100\.534/);
    assert.ok(counts.overpass0 >= 1 && counts.overpass1 >= 1);
    assert.equal(await page.locator('.ev-pin').count(), 4, 'pins on the map');
    await page.waitForTimeout(400);
    const card = await box(page, '#evCard'), mapBox = await box(page, '#map');
    for (const i of [0, 1]) { // the two nearby stations are in view and not under the panel
      const p = await page.locator('.ev-pin').nth(i).boundingBox();
      const inMap = p.x > mapBox.x && p.x + p.width < mapBox.x + mapBox.width && p.y > mapBox.y && p.y + p.height < mapBox.y + mapBox.height;
      const clear = p.x > card.x + card.width || p.y + p.height < card.y;
      assert.ok(inMap && clear, `pin ${i} visible at ${p.x},${p.y} card ${JSON.stringify(card)} map ${JSON.stringify(mapBox)}`);
    }
    await shot(page, '10-ev-near');
  });
  await test('bundled list works when OpenStreetMap is down', async () => {
    await page.evaluate(() => { window.__fetch = window.fetch; window.fetch = (u, o) => /overpass/.test(u) ? Promise.reject(new Error('down')) : window.__fetch(u, o); });
    await page.click('#evX'); await page.click('#evBtn');
    await page.waitForSelector('.ev-item');
    assert.deepEqual(await page.$$eval('.ev-item .t', e => e.map(x => x.textContent)), ['Local DC', 'PEA VOLTA สามย่าน']);
    await page.evaluate(() => { window.fetch = window.__fetch; });
    await page.click('#evX'); await page.click('#evBtn');
    await page.waitForFunction(() => document.querySelectorAll('.ev-item').length === 4);
  });
  await test('pins can be turned off in settings', async () => {
    await page.click('#evX');
    await page.click('#settingsBtn'); await page.uncheck('#sEvPins'); await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#sheetWrap [data-close]')?.click());
    await page.waitForFunction(() => document.querySelectorAll('.ev-pin.sm').length === 0);
    await page.click('#settingsBtn'); await page.check('#sEvPins'); await page.evaluate(() => document.querySelector('#sheetWrap [data-close]')?.click());
    await page.waitForFunction(() => document.querySelectorAll('.ev-pin.sm').length === 2);
    await page.click('#evBtn'); await page.waitForFunction(() => document.querySelectorAll('.ev-item').length === 4);
  });
  await test('fast DC filter', async () => {
    await page.click('#evDc');
    assert.deepEqual(await page.$$eval('.ev-item .t', e => e.map(x => x.textContent)), ['Local DC', 'PEA VOLTA สามย่าน', 'Far Station']);
    await page.click('#evDc');
  });
  await test('ไปที่นี่ on a station sets it as the destination', async () => {
    await page.click('.ev-item:has-text("EA Anywhere") [data-evgo]');
    assert.equal(await vis(page, '#evCard'), false);
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'EA Anywhere');
    await page.click('#rcClose');
  });
  await test('along the route: only stations near it, in driving order; แวะ adds a stop', async () => {
    await page.fill('#q', '13.756, 100.54'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    await page.click('#evBtn');
    await page.waitForSelector('#evWhere [data-where="route"].on');
    await page.waitForFunction(() => document.querySelectorAll('.ev-item').length === 3);
    assert.deepEqual(await page.$$eval('.ev-item .t', e => e.map(x => x.textContent)), ['Local DC', 'PEA VOLTA สามย่าน', 'EA Anywhere']);
    assert.match(await page.textContent('.ev-item >> nth=0'), /ห่างเส้นทาง/);
    await page.click('.ev-item:has-text("PEA") [data-evstop]');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    assert.equal(coordsIn(counts.osrmUrls.at(-1)), 3, 'route goes through the stop');
    assert.match(await page.textContent('#rcStops'), /แวะ PEA VOLTA สามย่าน/);
    assert.equal(await page.locator('.stop-pin').count(), 1);
    assert.equal(await page.evaluate(() => __car.nav.dest.lat), 13.756, 'destination unchanged');
    await shot(page, '11-stop');
  });
  await test('navigating: "ถึงจุดแวะ", the stop is dropped once passed, reroutes skip it', async () => {
    await page.click('#rcGo');
    assert.equal(await page.textContent('#nbText'), 'ถึงจุดแวะ PEA VOLTA สามย่าน');
    await setPos([13.7497, 100.5340]);
    assert.match((await page.evaluate(() => __said)).at(-1), /ถึงจุดแวะ PEA/);
    await setPos([13.7500, 100.5360]);
    assert.equal(await page.evaluate(() => __car.nav.stops.length), 0);
    assert.equal(await page.textContent('#nbText'), 'เลี้ยวซ้าย เข้าสู่ซอยทดสอบ');
    for (const lng of [100.5300, 100.5299, 100.5298, 100.5297]) await setPos([13.7520, lng]);
    await page.waitForTimeout(400);
    assert.equal(coordsIn(counts.osrmUrls.at(-1)), 2, 'reroute without the passed stop');
  });
  await test('⚡ while navigating shows stations ahead', async () => {
    await setPos([13.7500, 100.5380]);
    await page.click('#nfEv');
    await page.waitForSelector('.ev-item');
    assert.deepEqual(await page.$$eval('.ev-item .t', e => e.map(x => x.textContent)), ['EA Anywhere'], 'stations behind are left out');
    await page.click('#evX');
    await page.click('#nfStop');
  });
  await test('add a stop by search; remove a stop', async () => {
    await page.fill('#q', '13.756, 100.54'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    await page.click('#rcAddStop'); await page.click('#asSearch');
    assert.ok(await vis(page, '#stopMode'));
    assert.equal(await page.getAttribute('#q', 'placeholder'), 'ค้นหาจุดแวะ');
    await page.fill('#q', 'ร้านกาแฟ'); await page.press('#q', 'Enter');
    assert.match((await last('paneLoad', 1))[2], /google\.com\/maps\/search/);
    assert.match(await page.textContent('#gmPickGo'), /แวะที่นี่/);
    await page.evaluate(() => __gmUrl('https://www.google.com/maps/place/Cafe/@13.75,100.534,17z/data=!3d13.75!4d100.534'));
    await page.click('#gmPickGo');
    await page.waitForFunction(() => __car.nav.stops.length === 1);
    assert.equal(await page.evaluate(() => __car.nav.dest.lat), 13.756);
    assert.equal(await vis(page, '#stopMode'), false);
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    await page.click('#rcStops [data-rmstop]');
    await page.waitForFunction(() => __car.nav.stops.length === 0);
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    assert.equal(coordsIn(counts.osrmUrls.at(-1)), 2);
  });
  await test('ไม่เจอ? opens Google Maps searching for chargers', async () => {
    await page.click('#evBtn'); await page.click('#evGoogle');
    assert.match((await last('paneLoad', 1))[2], /maps\/search\/%E0%B8%AA%E0%B8%96%E0%B8%B2%E0%B8%99%E0%B8%B5/);
    await page.click('#gmX');
  });
  await test('no console errors with charging and stops', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- driving view ----------
console.log('Driving view');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  const setPos = async (p, speed = 12) => { await page.evaluate(([a, b, s]) => __setPos(a, b, s), [p[0], p[1], speed]); await page.waitForTimeout(150); };
  const settled = () => page.waitForFunction(() => !__car.view.raf, null, { timeout: 4000 });
  // where the road ahead is on the screen, relative to the car
  const ahead = () => page.evaluate(() => {
    const { nav, map, here } = __car, i = nav.seg; let j = i + 1;
    while (j < nav.line.length - 1 && nav.cum[j] - nav.cum[i] < 40) j++;
    const a = map.latLngToContainerPoint(here.ll), b = map.latLngToContainerPoint(nav.line[j]);
    return { dx: b.x - a.x, dy: b.y - a.y };
  });
  await page.fill('#q', '13.756, 100.54'); await page.press('#q', 'Enter');
  await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
  await page.click('#rcGo');
  await settled(); await page.waitForTimeout(700); // zoom and pan animations
  await test('while navigating the map turns so the road ahead points up', async () => {
    const r = await ahead();
    assert.ok(r.dy < -15 && Math.abs(r.dx) < Math.abs(r.dy) * .35, `ahead is at ${JSON.stringify(r)}`);
    assert.ok(await vis(page, '#compass'));
  });
  await test('the car is an arrow, low on the map, pointing up the screen', async () => {
    assert.ok(await page.locator('.me.nav .car').count());
    const car = await box(page, '.me .car'), m = await box(page, '#map');
    const rel = (car.y + car.height / 2 - m.y) / m.height;
    assert.ok(rel > .62 && rel < .8, 'low on the map, clear of the bottom card: ' + rel.toFixed(2));
    const rot = await page.locator('.me .car').evaluate(e => e.style.transform);
    assert.ok(Math.abs(parseFloat(rot.replace(/[^-\d.]/g, ''))) < 30, 'points up: ' + rot);
    await shot(page, '12-driving');
  });
  await test('the view keeps turning with the road', async () => {
    const before = await page.evaluate(() => __car.view.shown);
    for (const p of [[13.7500, 100.5360], [13.7500, 100.5395], [13.7520, 100.5400]]) await setPos(p);
    await settled(); await page.waitForTimeout(500);
    const after = await page.evaluate(() => __car.view.shown);
    assert.ok(Math.abs(((after - before + 540) % 360) - 180) > 20, `turned from ${before} to ${after}`);
    const r = await ahead();
    assert.ok(r.dy < -10, `still pointing up: ${JSON.stringify(r)}`);
  });
  await test('zoom follows speed: out when fast, in for a turn, and a manual zoom is left alone', async () => {
    const zoom = () => page.evaluate(() => __car.map.getZoom());
    const at = m => page.evaluate(d => { const { nav } = __car, D = nav.stepAt[nav.step] - d; let i = 0; while (i < nav.line.length - 2 && nav.cum[i + 1] < D) i++; const f = (D - nav.cum[i]) / (nav.cum[i + 1] - nav.cum[i]); return [nav.line[i][0] + (nav.line[i + 1][0] - nav.line[i][0]) * f, nav.line[i][1] + (nav.line[i + 1][1] - nav.line[i][1]) * f]; }, m); // a point d metres before the next turn
    const go = async (p, kmh) => { await page.evaluate(() => { __car.view.zoomAt = 0; __car.view.manualUntil = 0; }); await setPos(p, kmh / 3.6); await page.waitForTimeout(700); };
    await go([13.746, 100.534], 100); assert.equal(await zoom(), 15, 'fast: far out');
    await go([13.746, 100.534], 55); assert.equal(await zoom(), 16, 'town speed');
    await go([13.746, 100.534], 15); assert.equal(await zoom(), 17, 'slow: close');
    await go(await at(120), 20); assert.equal(await zoom(), 18, 'turn ahead: closer still');
    await page.evaluate(() => __car.map.setZoom(13)); await page.waitForTimeout(500);
    await page.evaluate(() => { __car.view.zoomAt = 0; }); await setPos([13.746, 100.534], 15); await page.waitForTimeout(600);
    assert.equal(await zoom(), 13, 'the driver\'s own zoom stays for a while');
    await page.evaluate(() => { __car.view.manualUntil = 0; __car.st.autoZoom = false; });
    await setPos([13.746, 100.534], 100); await page.waitForTimeout(700);
    assert.ok(await zoom() >= 16, 'automatic zoom can be turned off');
    await page.evaluate(() => { __car.st.autoZoom = true; });
  });
  await test('route steps: the whole way ahead in a list, nearest first', async () => {
    await page.click('#nfSteps');
    assert.match(await page.textContent('#sheet h2'), /เส้นทางที่เหลือ/);
    const rows = await page.$$eval('#sheet .st-row .t', e => e.map(x => x.textContent));
    assert.equal(rows.length, await page.evaluate(() => __car.nav.steps.length - __car.nav.step));
    assert.equal(rows[0], await page.textContent('#nbText'), 'first row is the next turn');
    assert.match(rows.at(-1), /ถึงจุดหมาย/);
    await shot(page, '13-steps');
  });
  await test('overview shows the whole route, north up; the location button returns to driving', async () => {
    await page.click('#stOverview');
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => { const { map, nav, here, view } = __car, s = map.getSize();
      return { follow: document.querySelector('#recenter').classList.contains('off'), shown: view.shown, inside: nav.line.concat([here.ll]).every(p => { const c = map.latLngToContainerPoint(p); return c.x >= 0 && c.y >= 0 && c.x <= s.x && c.y <= s.y; }) }; });
    assert.equal(r.follow, true, 'following is off'); assert.equal(Math.round(r.shown) % 360, 0); assert.ok(r.inside, 'all of the route is in view');
    await shot(page, '14-overview');
    await page.click('#recenter'); await settled(); await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => document.querySelector('#recenter').classList.contains('off')), false);
  });
  await test('tapping a step looks at that turn', async () => {
    await page.click('#navBanner');
    const idx = +await page.getAttribute('#sheet .st-row >> nth=1', 'data-st');
    await page.click('#sheet .st-row >> nth=1'); await page.waitForTimeout(500);
    const r = await page.evaluate(i => { const { map, nav, here } = __car, st = nav.steps[i], c = map.getCenter();
      return { off: document.querySelector('#recenter').classList.contains('off'), d: __car.haversine([c.lat, c.lng], [st.maneuver.location[1], st.maneuver.location[0]]) }; }, idx);
    assert.equal(r.off, true); assert.ok(r.d < 40, 'centred on the step: ' + r.d);
    await page.click('#recenter'); await settled(); await page.waitForTimeout(600);
  });
  await test('search along the route: categories, in driving order; แวะ adds the stop', async () => {
    await page.click('#nfEv');
    assert.equal(await page.locator('#evCats [data-cat]').count(), 5);
    await page.click('#evCats [data-cat="fuel"]');
    await page.waitForFunction(() => /ปตท/.test(document.querySelector('#evList').textContent));
    assert.deepEqual(await page.$$eval('.ev-item .t', e => e.map(x => x.textContent)), ['ปตท. สามย่าน'], 'the far one is left out');
    const item = await page.textContent('.ev-item');
    assert.match(item, /24 ชม\./); assert.match(item, /ดีเซล/); assert.match(item, /ห่างเส้นทาง/);
    assert.equal(await vis(page, '#evDc'), false, 'DC filter only for chargers');
    assert.match(counts.overpassQ.at(-1), /"amenity"="fuel"\]\(around:1500,13\.74\d+,100\.53\d+,/);
    assert.ok(await page.locator('.ev-pin.c-fuel').count());
    await shot(page, '15-along-route');
    await page.click('.ev-item [data-evstop]');
    await page.waitForFunction(() => __car.nav.stops.length === 1 && __car.nav.stops[0].name === 'ปตท. สามย่าน');
    assert.equal(new URL(counts.osrmUrls.at(-1)).pathname.split('/').pop().split(';').length, 3, 'rerouted through the stop');
  });
  await test('panel, turn banner and trip bar never overlap, even with a long list, and the panel can be closed', async () => {
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const [w, h] of [[1280, 800], [1000, 560], [1920, 720]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(200);
      await page.click('#nfEv'); await page.waitForSelector('#evCats [data-cat]');
      await page.evaluate(() => { document.querySelector('#evList').innerHTML = Array.from({ length: 30 }, (_, i) => `<div class="ev-item"><div class="grow"><div class="t">สถานี ${i}</div><div class="muted">รายละเอียด</div><div class="chips"><span class="chip">CCS2</span></div></div><button class="btn primary">แวะ</button></div>`).join(''); });
      const [bn, card, ft, m] = [await box(page, '#navBanner'), await box(page, '#evCard'), await box(page, '#navFoot'), await box(page, '#mapPane')];
      assert.ok(!overlap(bn, card) && !overlap(card, ft) && !overlap(bn, ft), `${w}x${h}: banner ${bn.y}-${bn.y + bn.height}, card ${card.y}-${card.y + card.height}, bar ${ft.y}-${ft.y + ft.height}`);
      assert.ok(card.y >= m.y && card.y + card.height <= m.y + m.height, 'panel inside the map');
      const x = await box(page, '#evX');
      assert.equal(await page.evaluate(([cx, cy]) => document.elementFromPoint(cx, cy).closest('#evX') !== null, [x.x + x.width / 2, x.y + x.height / 2]), true, 'the close button is the topmost thing there');
      await shot(page, `16-panel-${w}`);
      await page.click('#evX'); assert.equal(await vis(page, '#evCard'), false);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });
  await test('categories switch: the chargers list comes back with its DC filter', async () => {
    await page.click('#nfEv'); await page.click('#evCats [data-cat="ev"]');
    await page.waitForFunction(() => document.querySelectorAll('.ev-item').length >= 1);
    assert.equal(await vis(page, '#evDc'), true);
    await page.click('#evX');
  });
  await test('compass: north up on demand, and back', async () => {
    await page.click('#compass'); await settled();
    assert.equal(Math.round(await page.evaluate(() => __car.view.shown)) % 360, 0);
    assert.equal(await page.evaluate(() => __car.st.headingUp), false);
    await page.click('#compass'); await settled();
    assert.equal(await page.evaluate(() => __car.st.headingUp), true);
    const v = await page.evaluate(() => ({ shown: __car.view.shown, car: __car.view.car }));
    assert.ok(Math.abs(((v.shown - (360 - v.car) + 540) % 360) - 180) < 4, 'turned to the heading ' + JSON.stringify(v));
  });
  await test('stopping navigation turns the map back to north up', async () => {
    await page.click('#nfStop'); await settled();
    assert.equal(Math.round(await page.evaluate(() => __car.view.shown)) % 360, 0);
    assert.equal(await page.locator('.me.nav').count(), 0, 'dot again');
    assert.equal(await vis(page, '#compass'), false);
  });
  await test('no console errors in the driving view', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- places, backup, routing fallback ----------
console.log('Home, work, backup & routing');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  const sheetClose = async () => { if (await vis(page, '#sheetWrap')) await page.mouse.click(4, 4); }; // tapping outside the sheet
  await test('home and work buttons ask for a place the first time', async () => {
    assert.ok(await vis(page, '#qHome') && await vis(page, '#qWork'));
    await page.click('#qHome');
    assert.match(await page.textContent('#sheet h2'), /ตั้งบ้าน/);
    assert.match(await page.textContent('#sheet'), /ตำแหน่งปัจจุบัน/);
  });
  await test('choose a place; then one tap navigates there', async () => {
    await page.click('#sheet [data-pc="0"]');
    assert.equal(await vis(page, '#sheetWrap'), false);
    assert.ok(await page.evaluate(() => __car.st.home && Math.abs(__car.st.home.lat - 13.746) < 1e-3));
    assert.ok(await page.locator('#qHome.set').count());
    await page.click('#qHome');
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'บ้าน');
    await page.waitForFunction(() => /กม\.|ม\./.test(document.querySelector('#rcMeta').textContent));
    await page.click('#rcClose');
  });
  await test('work: pick by searching, the place is saved instead of navigated to', async () => {
    await page.click('#qWork'); await page.click('#pcSearch');
    assert.ok(await vis(page, '#stopMode'));
    assert.equal(await page.getAttribute('#q', 'placeholder'), 'ค้นหาที่ทำงาน');
    await page.fill('#q', '13.756, 100.54'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => __car.st.work);
    assert.equal(await page.evaluate(() => __car.st.work.lat), 13.756);
    assert.equal(await vis(page, '#routeCard'), false, 'not navigating');
    assert.equal(await vis(page, '#stopMode'), false);
    assert.equal(await page.getAttribute('#q', 'placeholder'), 'ไปที่ไหน');
  });
  await test('press and hold changes or deletes; settings list both', async () => {
    const b = await box(page, '#qWork');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up();
    assert.match(await page.textContent('#sheet h2'), /ที่ทำงาน ·/);
    await page.click('#pcDel');
    assert.equal(await page.evaluate(() => __car.st.work), null);
    await page.click('#settingsBtn');
    assert.match(await page.textContent('#sheet'), /บ้าน[\s\S]*ยังไม่ได้ตั้ง|ที่ทำงาน[\s\S]*ยังไม่ได้ตั้ง/);
    await page.click('#sheet [data-place="work"]'); await page.click('#pcCancel'); // back to settings
    assert.match(await page.textContent('#sheet h2'), /ตั้งค่า/);
    await sheetClose();
  });
  await test('backup code restores apps, home and settings on another device', async () => {
    const code = await page.evaluate(() => { document.querySelector('#settingsBtn').click(); document.querySelector('#sBackup').click(); return document.querySelector('#bkOut').value; });
    assert.match(code, /^CS1\./);
    await sheetClose();
    // wreck the state, then restore
    await page.evaluate(() => { __car.st.apps.splice(0, 3); __car.st.home = null; __car.st.voice = false; __car.st.ratio = 30; });
    await page.click('#settingsBtn'); await page.click('#sBackup');
    await page.fill('#bkIn', 'ข้อความ ' + code + ' จบ'); await page.click('#bkRestore');
    const r = await page.evaluate(() => ({ apps: __car.st.apps.length, home: !!__car.st.home, voice: __car.st.voice, ratio: __car.st.ratio }));
    assert.deepEqual(r, { apps: 5, home: true, voice: true, ratio: 55 });
    assert.equal(await page.locator('#dock .dock-app').count(), 5, 'bar updated');
  });
  await test('a bad or hostile code is refused or cleaned', async () => {
    await page.click('#settingsBtn'); await page.click('#sBackup');
    await page.fill('#bkIn', 'hello'); await page.click('#bkRestore');
    assert.match(await page.textContent('#toast'), /รหัสไม่ถูกต้อง/);
    const evil = 'CS1.' + Buffer.from(JSON.stringify({ ratio: 999, mode: 'x', apps: [{ id: 'a', name: 'ดี', url: 'javascript:alert(1)', logo: 'javascript:1', color: 'red' }, { name: '<b>x</b>', url: 'https://ok.example' }, { url: 'https://noname.example' }], home: { lat: 'a', lng: 1 } })).toString('base64');
    await page.fill('#bkIn', evil); await page.click('#bkRestore');
    const r = await page.evaluate(() => ({ ratio: __car.st.ratio, mode: __car.st.mode, apps: __car.st.apps }));
    assert.equal(r.ratio, 80); assert.equal(r.mode, 'split');
    assert.deepEqual(r.apps.map(a => [a.name, a.url, a.logo, a.color]), [['ดี', '', undefined, undefined], ['<b>x</b>', 'https://ok.example', undefined, undefined]]);
    assert.equal(await page.locator('#dock b').count(), 0, 'names are escaped');
    await page.evaluate(() => { __car.st.apps.splice(0); });
    await page.click('#settingsBtn'); await page.click('#sRestoreApps'); await sheetClose();
  });
  await test('routing: when the main server is down the backup one answers, and is tried first next time', async () => {
    counts.osrmDown = true; const before = counts.osrmBackup || 0;
    await page.fill('#q', '13.756, 100.54'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    assert.ok(counts.osrmDownHit >= 1 && counts.osrmBackup > before);
    counts.osrmDownHit = 0; await page.click('#rcClose');
    await page.fill('#q', '13.756, 100.541'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    assert.equal(counts.osrmDownHit || 0, 0, 'backup remembered');
    counts.osrmDown = false; await page.click('#rcClose');
  });
  await test('an idle page does not poll the layout', async () => {
    await page.evaluate(() => { window.__gbr = 0; const f = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { window.__gbr++; return f.call(this); }; });
    await page.waitForTimeout(2500);
    const n = await page.evaluate(() => window.__gbr);
    assert.ok(n <= 12, 'layout reads in 2.5 s: ' + n);
  });
  await test('no console errors with places and backup', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- apps side ----------
console.log('Apps');
{
  const { page, ctx, errors, calls, last } = await newPage({ width: 1280, height: 800 });
  await test('default apps: YouTube, Netflix, YT Music, Spotify, เว็บ', async () => {
    assert.deepEqual(await page.$$eval('#tiles .tile:not(.add) span', s => s.map(x => x.textContent)), ['YouTube', 'Netflix', 'YT Music', 'Spotify', 'เว็บ']);
  });
  await test('YouTube opens the real m.youtube.com over the apps side', async () => {
    await page.click('#tiles .tile:has-text("YouTube")');
    assert.deepEqual(await last('paneLoad', 0), ['paneLoad', 0, 'https://m.youtube.com']);
    await page.waitForTimeout(300);
    const r = await last('paneRect', 0), h = await box(page, '#paneHost');
    assert.deepEqual(r.slice(2, 6), [h.x, h.y, h.width, h.height].map(Math.round));
    assert.equal(r[6], true);
    assert.ok(await page.locator('#dock .dock-app.on').count(), 'shortcut marked active');
  });
  await shot(page, '6-app-open');
  await test('back to the app grid hides it; reopening resumes without reloading', async () => {
    const n = (await calls('paneLoad')).length;
    await page.click('#appHome'); await page.waitForTimeout(250);
    assert.equal((await last('paneRect', 0))[6], false);
    await page.click('#dock .dock-app >> nth=0'); await page.waitForTimeout(250);
    assert.equal((await calls('paneLoad')).length, n, 'not reloaded');
    assert.equal((await last('paneRect', 0))[6], true);
  });
  await test('address bar: page URL shows; words search Google; back, reload, open outside', async () => {
    await page.evaluate(() => __paneUrl('https://m.youtube.com/watch?v=abc'));
    assert.equal(await page.inputValue('#addrQ'), 'https://m.youtube.com/watch?v=abc');
    await page.fill('#addrQ', 'ร้านกาแฟ'); await page.press('#addrQ', 'Enter');
    assert.deepEqual(await last('paneLoad', 0), ['paneLoad', 0, 'https://www.google.com/search?q=' + encodeURIComponent('ร้านกาแฟ')]);
    await page.click('#appBack'); assert.ok(await last('back'));
  });
  await test('Netflix loads in the pane (no app, no Chrome)', async () => {
    await page.click('#appHome');
    const ext = (await calls('external')).length;
    await page.click('#tiles .tile:has-text("Netflix")');
    assert.deepEqual(await last('paneLoad', 0), ['paneLoad', 0, 'https://www.netflix.com/browse']);
    assert.equal((await calls('external')).length, ext, 'nothing opened outside');
    await page.click('#appHome');
  });
  await test('edit: delete any app, undo, delete the open app closes it', async () => {
    await page.click('#editApps');
    assert.ok(await page.locator('#home.editing').count());
    await page.click('#tiles .tile:has-text("YT Music") .del');
    assert.equal(await page.locator('#tiles .tile:has-text("YT Music")').count(), 0);
    assert.match(await page.textContent('#snackText'), /ลบ YT Music แล้ว/);
    await page.click('#snackUndo');
    assert.equal(await page.locator('#tiles .tile:has-text("YT Music")').count(), 1, 'undo puts it back');
    await page.click('#tiles .tile:has-text("Netflix") .del');
    assert.deepEqual(await last('paneStop', 0), ['paneStop', 0], 'open app closed');
    assert.equal(await page.locator('#dock .dock-app[aria-label="Netflix"]').count(), 0, 'gone from the bar too');
    await page.click('#editApps');
  });
  await shot(page, '7-edit');
  await test('add an app; restore default apps from settings', async () => {
    await page.click('#addApp');
    await page.fill('#aName', 'Joox'); await page.fill('#aUrl', 'joox.com'); await page.click('#aSave');
    await page.click('#tiles .tile:has-text("Joox")');
    assert.deepEqual(await last('paneLoad', 0), ['paneLoad', 0, 'https://joox.com']);
    await page.click('#appHome');
    await page.click('#settingsBtn'); await page.click('#sRestoreApps');
    assert.match(await page.textContent('#toast'), /เพิ่มกลับ 1 แอป/);
    await page.click('#sheet [data-close]');
    assert.equal(await page.locator('#tiles .tile:has-text("Netflix")').count(), 1);
  });
  await test('added websites get their logo: app icon first, then favicon, else the letter', async () => {
    await page.waitForSelector('#tiles .tile:has-text("Joox") img.logo.full');
    assert.equal(await page.getAttribute('#tiles .tile:has-text("Joox") img.logo', 'src'), 'https://www.joox.com/touch-icon.png');
    for (const [n, u] of [['Plain', 'plain.example'], ['NoLogo', 'nologo.example']]) {
      await page.click('#addApp'); await page.fill('#aName', n); await page.fill('#aUrl', u); await page.click('#aSave');
    }
    await page.waitForSelector('#tiles .tile:has-text("Plain") img.logo:not(.full)');
    assert.match(await page.getAttribute('#tiles .tile:has-text("Plain") img.logo', 'src'), /t1\.gstatic\.com\/faviconV2.*plain\.example/);
    await page.waitForFunction(() => [...document.querySelectorAll('#tiles .tile')].find(t => /Plain/.test(t.textContent)).querySelector('.face') && getComputedStyle([...document.querySelectorAll('#tiles .tile')].find(t => /Plain/.test(t.textContent)).querySelector('.face')).backgroundColor === 'rgb(255, 255, 255)', null, { timeout: 3000 }); // small icons sit on white
    await page.waitForFunction(() => __car.st.apps.find(a => a.name === 'NoLogo')?.logoTried);
    assert.equal(await page.locator('#tiles .tile:has-text("NoLogo") img').count(), 0);
    assert.equal((await page.textContent('#tiles .tile:has-text("NoLogo") .face')).trim(), 'N', 'letter stays');
    await shot(page, '9-logos');
  });
  await test('apps survive a reload', async () => {
    await page.reload(); await page.waitForFunction(() => window.__car);
    assert.equal(await page.locator('#tiles .tile:has-text("Joox")').count(), 1);
    assert.equal(await page.locator('#tiles .tile:has-text("Joox") img.logo').count(), 1, 'logo remembered');
  });
  await test('no console errors on the apps side', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- settings ----------
console.log('Settings');
{
  const { page, ctx, errors, last } = await newPage({ width: 1280, height: 800 });
  await page.evaluate(() => { window.__appVer = 1; });
  await test('settings: voice, split direction, layout reset', async () => {
    await page.click('#settingsBtn');
    await page.click('#sheet [data-layout="stack"]');
    assert.ok(await page.locator('#app.stack').count());
    await page.click('#sheet [data-layout="auto"]');
    await page.locator('#sVoice').uncheck();
    assert.equal(await page.evaluate(() => __car.st.voice), false);
    await page.locator('#sVoice').check();
    await shot(page, '8-settings');
    await page.click('#sheet [data-close]');
  });
  await test('app update: newer APK offered and downloaded with its checksum', async () => {
    await page.waitForTimeout(3300);
    const v = JSON.parse(await (await page.request.get(BASE + 'dist/version.json')).text());
    assert.ok(await page.locator('#settingsBtn.badge').count(), 'gear shows a dot');
    await page.click('#settingsBtn');
    assert.match(await page.textContent('#appUpd'), new RegExp('มีเวอร์ชันใหม่ ' + v.versionName.replace(/\./g, '\\.')));
    await page.click('#updGo');
    assert.deepEqual(await last('update'), ['update', BASE + 'dist/car-screen.apk', v.sha256]);
    await page.evaluate(() => __appUpdate('error', 'ดาวน์โหลดไม่สำเร็จ (HTTP 500)'));
    assert.match(await page.textContent('#toast'), /ติดตั้งเองได้จาก .*car-screen\.apk/);
  });
  await test('repair clears caches and reloads, keeping settings', async () => {
    await page.evaluate(() => caches.open('junk').then(c => c.put('/x', new Response('x'))));
    await Promise.all([page.waitForURL(/repaired=/), page.click('#sRepair')]);
    await page.waitForFunction(() => window.__car);
    assert.equal(await page.evaluate(async () => (await caches.keys()).includes('junk')), false);
    assert.equal(await page.evaluate(() => __car.st.ratio), 55);
  });
  await test('no console errors in settings', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- older app & plain browser ----------
console.log('Mixed releases');
{
  await test('page and script from different releases: repairs itself once, then explains', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    let appHits = 0, caches = 0;
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 404, body: '' }));
    await page.route('**/app.js*', async r => { appHits++; const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()).replace(/const BUILD = \d+;/, 'const BUILD = 1;') }); });
    await page.goto(BASE);
    await page.waitForFunction(() => document.getElementById('bootFail'), null, { timeout: 15000 });
    assert.ok(appHits >= 2, 'reloaded once by itself: ' + appHits);
    assert.match(await page.textContent('#bootFail'), /คนละเวอร์ชัน/);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('carRepaired')), '1');
    await ctx.close();
  });
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const BUILD = (\d+)/)[1], html = readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/__want = (\d+)/)[1];
  await test('index.html and app.js name the same build', () => assert.equal(src, html));
}

console.log('Older app / browser');
{
  const { page, ctx, errors, last } = await newPage({ width: 1280, height: 800 }, { app: 20 });
  await test('app 1.0.20: apps still open (old bridge), search asks to update', async () => {
    await page.click('#tiles .tile:has-text("YouTube")');
    assert.deepEqual(await last('load'), ['load', 'https://m.youtube.com']);
    await page.fill('#q', 'กาแฟ'); await page.press('#q', 'Enter');
    assert.match(await page.textContent('#toast'), /อัปเดตแอป/);
  });
  await test('no console errors with the older app', () => assert.deepEqual(errors, []));
  await ctx.close();
}
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 }, { app: 0 });
  await test('plain browser: map works, apps side points to the Android app', async () => {
    assert.ok(await vis(page, '#noNative'));
    await page.click('#tiles .tile:has-text("YouTube")');
    assert.match(await page.textContent('#toast'), /แอป Android/);
  });
  await test('no console errors in a plain browser', () => assert.deepEqual(errors, []));
  await ctx.close();
}

await browser.close(); server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
