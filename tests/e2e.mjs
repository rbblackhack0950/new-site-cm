// End-to-end test: real Chromium, every external service mocked.
// Run: npm test   (SHOTS=dir to save screenshots)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

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
const GIS_STUB = `window.google = { accounts: { oauth2: {
  initTokenClient(o) { return { requestAccessToken() { window.__gis = (window.__gis || 0) + 1; setTimeout(() => o.callback({ access_token: 'TOK', expires_in: 3600 }), 0); } }; },
  revoke() {} } } };`;
const PLACES = [{ lat: String(D[0]), lon: String(D[1]), name: 'เซ็นทรัลเวิลด์', display_name: 'เซ็นทรัลเวิลด์, ถนนราชดำริ, ปทุมวัน, กรุงเทพมหานคร' }];
const PIPED = { items: [
  { type: 'stream', url: '/watch?v=AAAAAAAAAAA', title: 'เพลงชิลขับรถ', uploaderName: 'Chill TH', duration: 3605 },
  { type: 'stream', url: '/watch?v=BBBBBBBBBBB', title: 'Lofi drive', uploaderName: 'Lofi', duration: 245 },
  { type: 'channel', url: '/channel/x', name: 'not a video' }
] };
const YT_STUB = `
window.__yt = { players: [], calls: [] };
window.YT = { PlayerState: { ENDED: 0, PLAYING: 1 }, Player: class {
  constructor(id, o) { this.o = o; __yt.players.push(this); __yt.calls.push(['new', o.videoId, o.playerVars.list || null, o.host]);
    const f = document.createElement('iframe'); f.id = id; document.getElementById(id).replaceWith(f); }
  loadVideoById(x) { __yt.calls.push(['load', x.videoId]); }
  loadPlaylist(x) { __yt.calls.push(['playlist', x.list]); }
  pauseVideo() { __yt.calls.push(['pause']); }
  getVideoData() { return { title: 'stub title', author: 'stub' }; }
} };
setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0);`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

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
async function newPage(viewport, extra = {}, init = null) {
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
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  globalThis.__pg = page;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => {
    const u = route.request().url(); const hit = k => (counts[k] = (counts[k] || 0) + 1);
    const json = b => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (u.includes('tile.openstreetmap.org') || u.includes('i.ytimg.com')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.includes('router.project-osrm.org')) {
      hit('osrm'); const ex = new URL(u).searchParams.get('exclude');
      if (ex) (counts.exclude = counts.exclude || []).push(ex);
      if (ex && ex.includes(',')) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'InvalidValue' }) });
      return json(ex === 'toll' ? { code: 'Ok', routes: [ALT] } : { code: 'Ok', routes: [ROUTE.routes[0], ALT] });
    }
    if (u.includes('accounts.google.com/gsi/client')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: GIS_STUB });
    if (u.includes('nominatim.openstreetmap.org')) { hit('nominatim'); return json(PLACES); }
    if (u.includes('search.longdo.com')) { hit('longdo'); return json({ meta: {}, data: [
      { type: 'poi', id: 'A1', name: 'ร้านกาแฟลับ ซอยสรณคมน์', lat: 13.7470, lon: 100.5345, address: 'ถนนสรณคมน์ กรุงเทพฯ' },
      { type: 'poi', id: 'A2', name: 'เซ็นทรัลเวิลด์', lat: 13.7560, lon: 100.5400, address: 'ราชดำริ' }] }); }
    if (u.includes('youtube.com/iframe_api')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: YT_STUB });
    if (u.includes('pipedapi.kavin.rocks')) { hit('piped0'); return route.fulfill({ status: 502, body: 'down' }); }
    if (u.includes('api.piped.private.coffee')) {
      hit('piped1'); const p = new URL(u).pathname;
      if (p.startsWith('/streams/')) { hit('related'); return json({ relatedStreams: [
        { type: 'stream', url: '/watch?v=RRRRRRRRRR1', title: 'Related one', uploaderName: 'R', duration: 200 },
        { type: 'stream', url: '/watch?v=RRRRRRRRRR2', title: 'Related two', uploaderName: 'R', duration: 210 }] }); }
      if (p === '/trending') { hit('trending'); return json([
        { type: 'stream', url: '/watch?v=TTTTTTTTTT1', title: 'Trend one', uploaderName: 'T', duration: 300 },
        { type: 'stream', url: '/watch?v=TTTTTTTTTT2', title: 'Trend two', uploaderName: 'T', duration: 310 }]); }
      return json(PIPED);
    }
    if (u.includes('googleapis.com/youtube')) {
      const auth = route.request().headers().authorization, p = new URL(u).pathname.split('/').pop();
      if (auth) { if (auth !== 'Bearer TOK') return route.fulfill({ status: 401, body: '' }); hit('bearer'); }
      if (p === 'search') { hit(auth ? 'ytsearchBearer' : 'ytapi'); return json({ items: [{ id: { videoId: 'KKKKKKKKKKK' }, snippet: { title: auth ? 'Signed-in result' : 'From &amp; API', channelTitle: 'Ch' } }] }); }
      if (p === 'subscriptions') return json({ items: [{ snippet: { resourceId: { channelId: 'C1' } } }] });
      if (p === 'channels') return json({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] });
      if (p === 'playlistItems') return json({ items: [{ snippet: { title: 'New upload', channelTitle: 'Ch1' }, contentDetails: { videoId: 'SSSSSSSSSSS', videoPublishedAt: '2026-10-01T00:00:00Z' } }] });
      if (p === 'videos') return json({ items: [{ id: 'LLLLLLLLLLL', snippet: { title: 'Liked one', channelTitle: 'X' }, contentDetails: { duration: 'PT3M5S' } }] });
      if (p === 'playlists') return json({ items: [{ id: 'PLmine', snippet: { title: 'Road trip', thumbnails: { medium: { url: 'https://i.ytimg.com/x.jpg' } } }, contentDetails: { itemCount: 12 } }] });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__car && window.__car.here.ll);
  return { page, ctx, errors };
}
const shot = (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, name + '.png') });
const vis = (page, sel) => page.locator(sel).isVisible();

// ---------- unit-ish ----------
console.log('Units');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  const r = await page.evaluate(() => {
    const { ytParse, instr, fmtDist, sayDist } = window.__car;
    return {
      a: ytParse('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'),
      b: ytParse('https://youtu.be/dQw4w9WgXcQ?si=abc'),
      c: ytParse('https://m.youtube.com/shorts/dQw4w9WgXcQ'),
      d: ytParse('https://www.youtube.com/playlist?list=PL123'),
      e: ytParse('dQw4w9WgXcQ'),
      f: ytParse('https://example.com/watch?v=dQw4w9WgXcQ'),
      g: ytParse('ร้านกาแฟ'),
      h: ytParse('youtube.com/watch?v=dQw4w9WgXcQ&list=PL9'),
      i1: instr({ name: 'ถนนสุขุมวิท', maneuver: { type: 'turn', modifier: 'left' } }),
      i2: instr({ name: '', maneuver: { type: 'roundabout', exit: 2 } }),
      i3: instr({ name: '', maneuver: { type: 'arrive' } }),
      i4: instr({ name: '', maneuver: { type: 'fork', modifier: 'slight right' } }),
      i5: instr({ name: '', maneuver: { type: 'continue', modifier: 'uturn' } }),
      w1: window.__car.webUrl('https://www.netflix.com/browse', true), w2: window.__car.webUrl('https://www.netflix.com/browse', false),
      iso: window.__car.isoSecs('PT1H2M5S'),
      d1: fmtDist(347), d2: fmtDist(1530), d3: fmtDist(23456), s1: sayDist(312), s2: sayDist(1500)
    };
  });
  await test('YouTube link parsing', () => {
    assert.deepEqual(r.a, { id: 'dQw4w9WgXcQ', list: null, start: 90 });
    assert.equal(r.b.id, 'dQw4w9WgXcQ'); assert.equal(r.c.id, 'dQw4w9WgXcQ');
    assert.deepEqual([r.d.id, r.d.list], [null, 'PL123']);
    assert.equal(r.e.id, 'dQw4w9WgXcQ'); assert.equal(r.f, null); assert.equal(r.g, null);
    assert.equal(r.h.list, 'PL9');
  });
  await test('Thai turn instructions', () => {
    assert.equal(r.i1, 'เลี้ยวซ้าย เข้าสู่ถนนสุขุมวิท'); assert.equal(r.i2, 'เข้าวงเวียน ออกทางออกที่ 2');
    assert.equal(r.i3, 'ถึงจุดหมายปลายทาง'); assert.equal(r.i4, 'ที่ทางแยก ชิดขวา'); assert.equal(r.i5, 'กลับรถ');
  });
  await test('Netflix opens as a website in Chrome on Android, not the app', () => {
    assert.match(r.w1, /^intent:\/\/www\.netflix\.com\/browse#Intent;scheme=https;package=com\.android\.chrome;S\.browser_fallback_url=https%3A%2F%2Fwww\.netflix\.com%2Fbrowse;end$/);
    assert.equal(r.w2, 'https://www.netflix.com/browse');
    assert.equal(r.iso, 3725);
  });
  await test('distance formatting', () => {
    assert.equal(r.d1, '350 ม.'); assert.equal(r.d2, '1.5 กม.'); assert.equal(r.d3, '23 กม.');
    assert.equal(r.s1, '300 เมตร'); assert.equal(r.s2, '1.5 กิโลเมตร');
  });
  await test('no console errors on load', () => assert.deepEqual(errors, []));
  await test('startup check stays hidden when the app runs', async () => { await page.waitForTimeout(6500); assert.equal(await page.locator('#bootFail').count(), 0); });
  await ctx.close();
}

// ---------- layout ----------
console.log('Layout');
{
  const { page, ctx } = await newPage({ width: 1280, height: 800 });
  const box = s => page.locator(s).boundingBox();
  await test('landscape tablet: side by side 50/50', async () => {
    const m = await box('#mapPane'), d = await box('#mediaPane');
    assert.ok(m.x < d.x && Math.abs(m.y - d.y) < 2, 'side by side');
    assert.ok(Math.abs(m.width - d.width) < 4, `equal widths ${m.width} vs ${d.width}`);
  });
  await shot(page, '1-home-landscape');
  await test('controls auto-hide when idle and come back on touch', async () => {
    await page.waitForFunction(() => document.body.classList.contains('idle'), null, { timeout: 7000 });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#search').evaluate(e => getComputedStyle(e).opacity), '0');
    await page.mouse.click(300, 400);
    assert.equal(await page.evaluate(() => document.body.classList.contains('idle')), false);
  });
  await test('drag divider resizes panes', async () => {
    const d = await box('#divider');
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2); await page.mouse.down();
    await page.mouse.move(1280 * 0.7, 400, { steps: 5 }); await page.mouse.up();
    const m = await box('#mapPane');
    assert.ok(m.width > 800, 'map grew to ' + m.width);
    assert.equal(await page.evaluate(() => window.__car.st.ratio), 70);
  });
  await test('menu: swap, map-only, media-only, split', async () => {
    await page.click('#dockToggle'); assert.ok(await vis(page, '#dockBar'));
    await page.click('#swap');
    assert.ok((await box('#mediaPane')).x < (await box('#mapPane')).x, 'swapped');
    await page.click('[data-mode="map"]'); assert.equal(await vis(page, '#mediaPane'), false);
    await page.click('[data-mode="media"]'); assert.equal(await vis(page, '#mapPane'), false);
    await page.click('[data-mode="split"]'); await page.click('#swap');
    assert.ok(await vis(page, '#mapPane') && await vis(page, '#mediaPane'));
    await page.mouse.click(5, 5); assert.equal(await vis(page, '#dockBar'), false, 'menu closes on outside tap');
  });
  await test('layout persists after reload', async () => {
    await page.reload(); await page.waitForFunction(() => window.__car);
    assert.equal(await page.evaluate(() => window.__car.st.ratio), 70);
  });
  await ctx.close();

  const ph = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await test('portrait phone: stacked, no horizontal overflow', async () => {
    const m = await ph.page.locator('#mapPane').boundingBox(), d = await ph.page.locator('#mediaPane').boundingBox();
    assert.ok(m.y < d.y && Math.abs(m.x - d.x) < 2, 'stacked');
    assert.equal(await ph.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await test('portrait phone: menu fits on screen', async () => {
    await ph.page.tap('#dockToggle');
    const b = await ph.page.locator('#dockBar').boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= 390, `bar x=${b.x} w=${b.width}`);
    await ph.page.tap('#dockToggle');
  });
  await shot(ph.page, '2-phone');
  await ph.ctx.close();
}

// ---------- navigation ----------
console.log('Navigation');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  const setPos = async (p, speed = 12) => { await page.evaluate(([a, b, s]) => __setPos(a, b, s), [p[0], p[1], speed]); await page.waitForTimeout(120); };
  await page.evaluate(() => { window.__said = []; speechSynthesis.speak = u => window.__said.push(u.text); });
  await test('search shows results with distance', async () => {
    await page.fill('#q', 'เซ็นทรัลเวิลด์'); await page.press('#q', 'Enter');
    await page.waitForSelector('#results .ritem');
    assert.match(await page.textContent('#results'), /เซ็นทรัลเวิลด์.*กม\./s);
  });
  await test('pick result → route card with distance & time', async () => {
    await page.click('#results .ritem');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    assert.match(await page.textContent('#rcMeta'), /1\.8 กม\. · 5 นาที/);
    assert.equal(counts.osrm, 1);
    const line = await page.locator('.leaflet-overlay-pane path').last().boundingBox();
    assert.ok(line && line.height > 100, 'route line drawn on the map, height ' + line?.height);
  });
  await test('alternative routes listed with toll badges and selectable', async () => {
    assert.equal(await page.locator('.alt').count(), 2);
    assert.match(await page.textContent('.alt >> nth=0'), /เสียค่าผ่านทาง.*ทางด่วน/s);
    assert.match(await page.textContent('.alt >> nth=1'), /ไม่มีค่าผ่านทาง/);
    await page.click('.alt >> nth=1');
    assert.equal(await page.evaluate(() => __car.nav.route.distance), 2500);
    assert.match(await page.textContent('#rcMeta'), /2\.5 กม\. · 7 นาที/);
    await page.click('.alt >> nth=0');
  });
  await shot(page, '3-route');
  await test('route options: avoid tolls + highways, falls back when the server cannot do both', async () => {
    await page.click('#rcOpts');
    await page.check('#oToll'); await page.check('#oMotorway'); await page.click('#oSave');
    await page.waitForFunction(() => __car.nav.route?.distance === 2500);
    assert.deepEqual(counts.exclude.slice(-2), ['toll,motorway', 'toll']);
    assert.match(await page.textContent('#toast'), /เลี่ยงทางด่วนไม่ได้/);
    assert.match(await page.textContent('#rcMeta'), /เลี่ยงทางเสียค่าผ่านทาง, ทางด่วน/);
    assert.ok(await page.locator('#rcOpts.on').count(), 'options button shows active');
    await shot(page, '3b-route-options');
    await page.click('#rcOpts'); await page.uncheck('#oToll'); await page.uncheck('#oMotorway'); await page.click('#oSave');
    await page.waitForFunction(() => __car.nav.route?.distance === 1760);
  });
  await test('start navigation → banner shows first turn', async () => {
    await page.click('#rcGo');
    assert.ok(await vis(page, '#navBanner'));
    assert.equal(await page.textContent('#nbText'), 'เลี้ยวขวา เข้าสู่ถนนเพชรบุรี');
    assert.match(await page.textContent('#nbDist'), /4[45]0 ม\./);
    assert.match(await page.textContent('#nfEta'), /^ถึง \d{2}:\d{2}/);
    assert.match((await page.evaluate(() => __said)).join('|'), /เริ่มนำทาง/);
  });
  await test('driving toward the turn updates distance and speaks', async () => {
    await setPos([13.7480, 100.5340]);
    assert.match(await page.textContent('#nbDist'), /2[0-9]0 ม\./);
    assert.match((await page.evaluate(() => __said)).join('|'), /อีก 200 เมตร เลี้ยวขวา/);
    await setPos([13.7497, 100.5340]);
    assert.match((await page.evaluate(() => __said)).at(-1), /^เลี้ยวขวา เข้าสู่ถนนเพชรบุรี/);
  });
  await shot(page, '4-navigating');
  await test('after the turn the next maneuver shows', async () => {
    await setPos([13.7500, 100.5360]);
    assert.equal(await page.textContent('#nbText'), 'เลี้ยวซ้าย เข้าสู่ซอยทดสอบ');
  });
  await test('panning the map during navigation snaps back to the car', async () => {
    await page.mouse.move(300, 450); await page.mouse.down(); await page.mouse.move(150, 300, { steps: 5 }); await page.mouse.up();
    assert.ok(await page.locator('#recenter.off').count(), 'follow paused after pan');
    await page.waitForSelector('#recenter:not(.off)', { timeout: 10000 });
  });
  await test('going off-route triggers reroute', async () => {
    const before = counts.osrm;
    for (const lng of [100.5300, 100.5299, 100.5298, 100.5297]) await setPos([13.7520, lng]);
    await page.waitForTimeout(400);
    assert.ok(counts.osrm > before, 'osrm called again');
    await setPos([13.7500, 100.5380]);
  });
  await test('arriving ends navigation', async () => {
    await setPos([13.7540, 100.5400]); await setPos([13.7559, 100.5400]);
    await page.waitForSelector('#navBanner', { state: 'hidden' });
    assert.match(await page.textContent('#toast'), /ถึงจุดหมาย/);
  });
  await test('recent destinations appear on focus', async () => {
    await page.mouse.click(600, 600); // tap to bring the auto-hidden controls back
    await page.click('#q');
    await page.waitForSelector('#results [data-recent]');
    await page.keyboard.press('Escape'); await page.mouse.click(600, 600);
  });
  await test('Google Maps hand-off opens directions', async () => {
    await page.click('#q'); await page.click('#results [data-recent]');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#rcGmaps')]);
    assert.match(pop.url(), /google\.com\/maps\/dir\/\?api=1&destination=13\.756,100\.54/);
    await pop.close();
  });
  await test('long-press on map sets destination', async () => {
    await page.click('#rcClose');
    await page.mouse.click(200, 500, { button: 'right' });
    await page.waitForFunction(() => /กม\.|ม\./.test(document.querySelector('#rcMeta').textContent));
    assert.equal(await page.textContent('#rcName'), 'ตำแหน่งที่เลือก');
  });
  await test('roundabout exit is not announced twice', async () => {
    const types = await page.evaluate(() => {
      const g = (a, b) => ({ type: 'LineString', coordinates: [a, b] });
      const st = (type, a, b, extra = {}) => ({ name: 'ถนนสรณคมน์', geometry: g(a, b), maneuver: { type, location: a, ...extra } });
      __car.setRoute({ distance: 900, duration: 120, legs: [{ steps: [
        st('depart', [100.60, 13.90], [100.60, 13.903]),
        st('roundabout', [100.60, 13.903], [100.601, 13.904], { exit: 6 }),
        st('exit roundabout', [100.601, 13.904], [100.602, 13.908]),
        st('arrive', [100.602, 13.908], [100.602, 13.908])
      ] }] });
      return __car.nav.steps.map(s => s.maneuver.type);
    });
    assert.deepEqual(types, ['depart', 'roundabout', 'arrive']);
  });
  await test('Longdo Map key adds Thai places, merged with OSM without duplicates', async () => {
    await page.click('#rcClose').catch(() => {});
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    await page.fill('#sLongdo', 'abc123'); await page.click('#sSave');
    await page.mouse.click(600, 600);
    await page.fill('#q', 'กาแฟ'); await page.press('#q', 'Enter');
    await page.waitForSelector('#results .ritem:has-text("ร้านกาแฟลับ")');
    assert.equal(await page.locator('#results .ritem:has-text("เซ็นทรัลเวิลด์")').count(), 1, 'same place from both sources listed once');
    const order = await page.$$eval('#results .ritem .dist', els => els.map(e => /กม/.test(e.textContent) ? parseFloat(e.textContent) * 1000 : parseFloat(e.textContent)));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), 'nearest first');
    await page.keyboard.press('Escape'); await page.mouse.click(600, 600);
  });
  await test('pasting a Google Maps link sets the destination', async () => {
    const r = await page.evaluate(() => [
      __car.parseGmaps('https://www.google.com/maps/place/Siam+Paragon/@13.7462,100.5347,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d13.746289!4d100.534878'),
      __car.parseGmaps('https://maps.google.com/?q=13.7563,100.5018'),
      __car.parseGmaps('https://www.google.com/maps/@13.7,100.5,15z'),
      __car.parseGmaps('https://maps.app.goo.gl/AbCdEf')]);
    assert.deepEqual([r[0].lat, r[0].lng, r[0].name], [13.746289, 100.534878, 'Siam Paragon'], 'exact pin (!3d!4d) wins over map centre');
    assert.deepEqual([r[1].lat, r[1].lng], [13.7563, 100.5018]);
    assert.deepEqual([r[2].lat, r[2].lng], [13.7, 100.5]);
    assert.equal(r[3], null, 'short links need resolving');
    await page.fill('#q', 'https://www.google.com/maps/place/Siam+Paragon/@13.7462,100.5347,17z/data=!3d13.746289!4d100.534878'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'Siam Paragon');
  });
  await test('no console errors during navigation', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- YouTube ----------
console.log('YouTube');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  await page.click('.tile:has-text("YouTube")');
  await test('YouTube opens on recommendations (trending in Thailand when nothing watched yet)', async () => {
    await page.waitForSelector('.vitem:has-text("Trend one")');
    assert.ok(await page.locator('[data-tab="rec"].on').count());
    assert.equal(counts.trending, 1);
  });
  await test('search falls back to a working source and lists videos only', async () => {
    await page.fill('#ytQ', 'เพลงขับรถ'); await page.press('#ytQ', 'Enter');
    await page.waitForSelector('.vitem');
    assert.equal(await page.locator('.vitem').count(), 2);
    assert.ok(counts.piped0 >= 1 && counts.piped1 >= 1, 'first server down, second used');
    assert.match(await page.textContent('.vitem .dur'), /1:00:05/);
  });
  await shot(page, '5-yt-results');
  await test('tap a result → player loads that video', async () => {
    await page.click('.vitem >> nth=0');
    await page.waitForFunction(() => window.__yt?.calls.length);
    const c = await page.evaluate(() => __yt.calls[0]);
    assert.deepEqual(c, ['new', 'AAAAAAAAAAA', null, 'https://www.youtube.com']);
    assert.equal(await page.evaluate(() => __yt.players[0].o.playerVars.fs), 0, "YouTube's own fullscreen is off");
    assert.ok(await page.locator('#ytHost iframe').isVisible());
  });
  await test('video end → next video plays automatically', async () => {
    await page.evaluate(() => __yt.players[0].o.events.onStateChange({ data: 0 }));
    assert.deepEqual(await page.evaluate(() => __yt.calls.at(-1)), ['load', 'BBBBBBBBBBB']);
  });
  await test('blocked video → message and open-in-YouTube button', async () => {
    await page.evaluate(() => __yt.players[0].o.events.onError({ data: 150 }));
    assert.ok(await vis(page, '#ytErr'));
    assert.match(await page.textContent('#ytErrMsg'), /ไม่อนุญาต/);
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#ytErrOpen')]);
    assert.match(pop.url(), /youtube\.com\/watch\?v=BBBBBBBBBBB/); await pop.close();
  });
  await test('paste a link plays it directly', async () => {
    await page.fill('#ytQ', 'https://youtu.be/dQw4w9WgXcQ'); await page.press('#ytQ', 'Enter');
    assert.deepEqual(await page.evaluate(() => __yt.calls.at(-1)), ['load', 'dQw4w9WgXcQ']);
    assert.equal(await vis(page, '#ytErr'), false);
  });
  await test('after the last video, related videos play next', async () => {
    await page.waitForFunction(() => __car.yt.queue.some(v => v.id === 'RRRRRRRRRR1'));
    assert.match(await page.textContent('#ytList'), /Related one/);
    await page.evaluate(() => __yt.players[0].o.events.onStateChange({ data: 0 }));
    assert.deepEqual(await page.evaluate(() => __yt.calls.at(-1)), ['load', 'RRRRRRRRRR1']);
  });
  await test('playlist link loads playlist', async () => {
    await page.fill('#ytQ', 'https://www.youtube.com/playlist?list=PLxyz'); await page.press('#ytQ', 'Enter');
    assert.deepEqual(await page.evaluate(() => __yt.calls.at(-1)), ['playlist', 'PLxyz']);
  });
  await test('list toggle shows the queue under the player', async () => {
    await page.click('#ytListBtn');
    assert.ok(await page.locator('#yt').evaluate(e => e.classList.contains('list-open')));
  });
  await shot(page, '6-yt-playing');
  await test('while playing, nothing of ours sits on top of the video', async () => {
    const form = await page.locator('#ytForm').boundingBox(), stage = await page.locator('#ytStage').boundingBox();
    assert.ok(stage.y >= form.y + form.height - 1, `bar above player (bar ends ${form.y + form.height}, video starts ${stage.y})`);
    await page.waitForFunction(() => document.body.classList.contains('idle'), null, { timeout: 7000 });
    const top = await page.evaluate(() => { const r = document.querySelector('#ytStage').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width - 30, r.y + 10).closest('#ytHost') !== null; });
    assert.ok(top, 'top-right corner of the video is the video itself, even when idle');
    await page.mouse.click(300, 400);
  });
  await test('fullscreen button fills only the video pane, map stays visible, nothing covers it', async () => {
    await page.click('#ytFs');
    const stage = await page.locator('#ytStage').boundingBox(), pane = await page.locator('#mediaPane').boundingBox();
    assert.ok(Math.abs(stage.height - pane.height) < 2 && Math.abs(stage.width - pane.width) < 2, 'video fills its pane');
    assert.ok(await vis(page, '#mapPane'), 'map still on screen');
    assert.equal(await vis(page, '#ytForm'), false, 'search bar removed');
    for (const [fx, fy] of [[.95, .03], [.5, .03], [.05, .97], [.95, .97], [.5, .5]]) {
      const ok = await page.evaluate(([fx, fy]) => { const r = document.querySelector('#ytStage').getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width * fx, r.y + r.height * fy).closest('#ytHost'); }, [fx, fy]);
      assert.ok(ok, `video uncovered at ${fx},${fy}`);
    }
    await shot(page, '7-yt-pane-full');
    await page.click('#dockToggle'); await page.click('#ytFsExit');
    assert.equal(await page.locator('#yt.theater').count(), 0);
    assert.ok(await vis(page, '#ytForm'));
  });
  await test('video frames are not allowed to go fullscreen over the map', async () => {
    assert.doesNotMatch(await page.getAttribute('#webFrame', 'allow'), /fullscreen/);
  });
  await test('API key search uses YouTube Data API', async () => {
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    await page.fill('#sKey', 'AIzaTEST'); await page.click('#sSave');
    await page.fill('#ytQ', 'news'); await page.press('#ytQ', 'Enter');
    await page.waitForSelector('.vitem:has-text("From & API")');
    assert.equal(counts.ytapi, 1);
  });
  await test('history shows after reload', async () => {
    await page.reload(); await page.waitForFunction(() => window.__car);
    // "Related one" was watched in the previous test, so only "Related two" should be suggested;
    // an API key is set by now, so trending comes from the API's mostPopular chart (mocked as "Liked one")
    await page.waitForSelector('.vitem:has-text("Related two")');
    const txt = await page.textContent('#ytList');
    assert.match(txt, /Liked one/, 'recommendations mix related and trending');
    assert.doesNotMatch(txt, /Related one|Lofi drive/, 'already-watched videos are left out');
    await page.click('[data-tab="recent"]');
    assert.ok(await page.locator('#ytList .vitem').count() >= 2, 'watched videos listed');
    await shot(page, '9-yt-recommended');
    await page.click('[data-tab="rec"]');
  });
  await test('YouTube sign-in: subscriptions, liked videos, playlists', async () => {
    await page.click('[data-tab="subs"]');
    assert.match(await page.textContent('#ytList'), /เข้าสู่ระบบด้วย Google/);
    await page.click('#ytList .btn[data-tab="account"]');
    await page.fill('#accCid', 'test.apps.googleusercontent.com'); await page.click('#accIn');
    await page.waitForSelector('.vitem:has-text("New upload")');
    assert.equal(await page.evaluate(() => window.__gis), 1);
    await page.click('[data-tab="liked"]'); await page.waitForSelector('.vitem:has-text("Liked one")');
    assert.match(await page.textContent('.vitem .dur'), /3:05/);
    await page.click('[data-tab="lists"]'); await page.waitForSelector('.vitem:has-text("Road trip")');
    await shot(page, '8-yt-account');
    await page.click('.vitem:has-text("Road trip")');
    await page.waitForFunction(() => window.__yt?.calls.length);
    assert.ok((await page.evaluate(() => __yt.calls.at(-1))).includes('PLmine'), 'playlist plays');
    assert.ok(counts.bearer >= 5, 'requests carry the account token');
  });
  await test('signed-in search uses the account (no API key needed)', async () => {
    await page.evaluate(() => { __car.st.ytKey = ''; });
    await page.fill('#ytQ', 'drive'); await page.press('#ytQ', 'Enter');
    await page.waitForSelector('.vitem:has-text("Signed-in result")');
    assert.equal(counts.ytsearchBearer, 1);
  });
  await test('no console errors in YouTube', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- launcher & web ----------
console.log('Apps');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  await test('Netflix opens in a new window', async () => {
    await page.click('.tile:has-text("Netflix")');
    assert.match(await page.textContent('#sheet'), /เปิดเป็นเว็บไซต์/, 'explains it opens as a website');
    assert.match(await page.textContent('#sheet'), /เวอร์ชันเดสก์ท็อป/);
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#extGo')]);
    assert.match(pop.url(), /netflix\.com/); await pop.close();
    const [pop2] = await Promise.all([ctx.waitForEvent('page'), page.click('.tile:has-text("Netflix")')]);
    assert.match(pop2.url(), /netflix\.com/, 'second time opens directly'); await pop2.close();
  });
  await test('add a custom app, open it inside, then delete it', async () => {
    await page.click('#addTile');
    await page.fill('#aName', 'Test'); await page.fill('#aUrl', 'localhost:8765/README.md'); await page.click('#aSave');
    assert.ok(await vis(page, '.tile:has-text("Test")'));
    await page.click('.tile:has-text("Test")');
    assert.match(await page.getAttribute('#webFrame', 'src'), /README\.md/);
    await page.click('#web .homeBtn');
    await page.click('.tile:has-text("Test")', { button: 'right' }); await page.click('#del');
    assert.equal(await page.locator('.tile:has-text("Test")').count(), 0);
  });
  await test('web view: YouTube links are routed to the player', async () => {
    await page.click('.tile:has-text("เว็บ")');
    await page.fill('#webQ', 'youtube.com/watch?v=dQw4w9WgXcQ'); await page.press('#webQ', 'Enter');
    assert.ok(await vis(page, '#yt'));
  });
  await test('web view: words search Google inside the pane', async () => {
    await page.click('#yt .homeBtn'); await page.click('.tile:has-text("เว็บ")');
    await page.fill('#webQ', 'ร้านกาแฟ ใกล้ฉัน'); await page.press('#webQ', 'Enter');
    assert.equal(await page.getAttribute('#webFrame', 'src'), 'https://www.google.com/search?igu=1&q=' + encodeURIComponent('ร้านกาแฟ ใกล้ฉัน'));
    assert.equal(await vis(page, '#webMsg'), false);
  });
  await test('web view: sites that refuse split screen get an open-in-Chrome card, not a blank pane', async () => {
    await page.fill('#webQ', 'facebook.com'); await page.press('#webQ', 'Enter');
    assert.ok(await vis(page, '#webMsg'));
    assert.match(await page.textContent('#webMsg'), /facebook\.com ไม่ยอมแสดงในจอแบ่ง/);
    assert.equal(await page.getAttribute('#webFrame', 'src'), null);
    await shot(page, '10-web-blocked');
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#webOpen')]);
    assert.match(pop.url(), /facebook\.com/); await pop.close();
    const r = await page.evaluate(() => ['m.facebook.com', 'www.tiktok.com', 'shopee.co.th', 'www.google.com', 'th.m.wikipedia.org', 'www.sanook.com', 'online.example.com'].map(h => __car.NO_FRAME.test(h)));
    assert.deepEqual(r, [true, true, true, true, false, false, false]);
  });
  await test('PWA: manifest valid and service worker active', async () => {
    const m = await (await page.request.get(BASE + 'manifest.webmanifest')).json();
    assert.equal(m.id, './?app=car-screen-2', 'new app id so a broken old install does not block a fresh one');
    assert.equal(m.display, 'standalone'); assert.deepEqual(m.display_override, ['fullscreen', 'standalone']);
    assert.deepEqual(m.icons.map(i => i.purpose), ['any', 'any', 'maskable', 'maskable']);
    for (const i of m.icons) assert.equal((await page.request.get(BASE + i.src)).status(), 200);
    assert.equal((await page.request.get(BASE + '?source=pwa')).status(), 200, 'start_url loads');
    const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
    assert.match(sw, /sw\.js$/);
  });
  await test('settings offer the Android app download, and the file is served', async () => {
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    assert.equal(await page.getAttribute('#sApk', 'href'), 'dist/car-screen.apk');
    const r = await page.request.get(BASE + 'dist/car-screen.apk');
    assert.equal(r.status(), 200);
    assert.equal((await r.body()).subarray(0, 2).toString(), 'PK', 'it is a zip/APK');
    await page.click('#sheet [data-close], #sheet .btn:has-text("รีเซ็ตหน้าจอ")');
  });
  await test('repair app clears caches and reloads, keeping settings', async () => {
    await page.evaluate(() => caches.open('junk').then(c => c.put('/x', new Response('x'))));
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    await Promise.all([page.waitForURL(/repaired=/), page.click('#sRepair')]);
    await page.waitForFunction(() => window.__car);
    assert.equal(await page.evaluate(async () => (await caches.keys()).includes('junk')), false);
    assert.ok(await page.evaluate(() => __car.st.extSeen.includes('netflix')), 'settings kept');
  });
  await test('no console errors in apps', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- engine too old to run app.js ----------
console.log('Old browser engine');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/app\.js$/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'let x = a?.b ?? ;' }));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  await page.goto(BASE);
  await test('a startup failure shows the WebView version instead of a blank screen', async () => {
    await page.waitForSelector('#bootFail', { timeout: 9000 });
    assert.match(await page.textContent('#bootFail'), /เวอร์ชัน \d+/);
  });
  await ctx.close();
}

// ---------- Android app bridge (native side faked) ----------
console.log('Android app');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 }, {}, () => {
    window.__native = [];
    window.CarScreenNative = {
      version: () => '1',
      load: u => __native.push(['load', u]),
      rect: (x, y, w, h, show) => __native.push(['rect', Math.round(x), Math.round(y), Math.round(w), Math.round(h), show]),
      back: () => __native.push(['back']), stop: () => __native.push(['stop']),
      external: u => __native.push(['external', u]),
      mapsAdjacent: u => __native.push(['maps', u]),
      inSplitScreen: () => false,
      appVersion: () => 1,
      httpGet: (id, u) => { __native.push(['http', u]); setTimeout(() => __http(id, 200, 'https://www.google.com/maps/place/Wat+Arun/@13.74,100.48,17z/data=!3d13.7437!4d100.4888', ''), 10); },
      update: (u, h) => __native.push(['update', u, h])
    };
  });
  const last = kind => page.evaluate(k => __native.filter(c => c[0] === k).at(-1), kind);
  await test('in the app, only Google Maps is marked as opening outside', async () => {
    assert.equal(await page.locator('.tile:has-text("Netflix") .ext').count(), 0);
    assert.equal(await page.locator('.tile:has-text("Google Maps") .ext').count(), 1);
  });
  await test('YouTube tile opens the real m.youtube.com in the pane', async () => {
    await page.click('.tile:has-text("YouTube")');
    assert.deepEqual(await last('load'), ['load', 'https://m.youtube.com']);
    await page.waitForFunction(() => __native.some(c => c[0] === 'rect' && c[5] === true));
    const r = await last('rect'), f = await page.locator('#webFrame').boundingBox();
    assert.deepEqual(r.slice(1, 5), [f.x, f.y, f.width, f.height].map(Math.round), 'native view sits exactly over the pane');
  });
  await test('pane follows the divider and hides under menus', async () => {
    const d = await page.locator('#divider').boundingBox();
    await page.mouse.move(d.x + d.width / 2, d.y + 100); await page.mouse.down(); await page.mouse.move(400, d.y + 100, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(300);
    const f = await page.locator('#webFrame').boundingBox();
    assert.equal((await last('rect'))[1], Math.round(f.x));
    await page.click('#dockToggle'); await page.waitForTimeout(300);
    assert.equal((await last('rect'))[5], false, 'hidden while the menu is open');
    await page.mouse.click(5, 400); await page.waitForTimeout(300);
    assert.equal((await last('rect'))[5], true);
  });
  await test('Netflix and Facebook load in the pane, no "open in Chrome"', async () => {
    await page.click('#web .homeBtn'); await page.waitForTimeout(250);
    assert.equal((await last('rect'))[5], false, 'hidden on the app grid');
    await page.click('.tile:has-text("Netflix")');
    assert.deepEqual(await last('load'), ['load', 'https://www.netflix.com/browse']);
    assert.equal(await vis(page, '#sheetWrap'), false);
    await page.fill('#webQ', 'facebook.com'); await page.press('#webQ', 'Enter');
    assert.deepEqual(await last('load'), ['load', 'https://facebook.com']);
    assert.equal(await vis(page, '#webMsg'), false);
  });
  await test('page URL from the pane shows in the address bar; ↗ and Maps open outside', async () => {
    await page.evaluate(() => __paneUrl('https://m.facebook.com/home.php'));
    assert.equal(await page.inputValue('#webQ'), 'https://m.facebook.com/home.php');
    await page.click('#webPop');
    assert.deepEqual(await last('external'), ['external', 'https://m.facebook.com/home.php']);
  });
  await test('Google Maps navigation opens beside Car Screen with the avoid options', async () => {
    await page.click('#web .homeBtn');
    await page.click('[data-mode="split"]').catch(() => {});
    await page.fill('#q', 'เซ็นทรัลเวิลด์'); await page.press('#q', 'Enter');
    await page.click('#results .ritem');
    await page.waitForFunction(() => /กม\./.test(document.querySelector('#rcMeta').textContent));
    await page.click('#rcOpts'); await page.check('#oToll'); await page.click('#oSave');
    await page.waitForFunction(() => /เลี่ยง/.test(document.querySelector('#rcMeta').textContent));
    await page.click('#rcGmaps');
    assert.deepEqual(await last('maps'), ['maps', 'google.navigation:q=13.756,100.54&mode=d&avoid=t']);
    assert.equal(await page.evaluate(() => __car.st.mode), 'media', 'Car Screen keeps only the media side');
    await page.click('#dockToggle'); await page.click('[data-mode="split"]'); await page.mouse.click(5, 400);
  });
  await test('setting: “เริ่มนำทาง” can use Google Maps', async () => {
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    await page.check('#sGnav'); await page.click('#sSave');
    const n = await page.evaluate(() => __native.filter(c => c[0] === 'maps').length);
    await page.click('#rcGo');
    assert.equal(await page.evaluate(() => __native.filter(c => c[0] === 'maps').length), n + 1);
    assert.equal(await vis(page, '#navBanner'), false, 'built-in navigation not started');
  });
  await test('Google Maps tile opens the Maps app beside Car Screen', async () => {
    await page.click('#dockToggle'); await page.click('[data-mode="split"]'); await page.mouse.click(5, 400);
    await page.click('.tile:has-text("Google Maps")');
    assert.deepEqual(await last('maps'), ['maps', 'https://www.google.com/maps']);
  });
  await test('app update: newer APK offered, downloaded with its checksum, progress shown', async () => {
    const v = JSON.parse(await (await page.request.get(BASE + 'dist/version.json')).text());
    assert.ok(v.versionCode > 1 && /^[0-9a-f]{64}$/.test(v.sha256), 'version.json published with checksum');
    assert.ok(await page.locator('#dockToggle.badge').count(), 'menu handle shows a dot');
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    assert.match(await page.textContent('#appUpd'), new RegExp('มีเวอร์ชันใหม่ ' + v.versionName.replace(/\./g, '\\.')));
    await page.click('#updGo');
    assert.deepEqual(await last('update'), ['update', BASE + 'dist/car-screen.apk', v.sha256]);
    await page.evaluate(() => __appUpdate('confirm', 'กด “ติดตั้ง” เพื่อยืนยันการอัปเดต'));
    assert.match(await page.textContent('#appUpd'), /ยืนยันการอัปเดต/);
    await page.evaluate(() => __appUpdate('error', 'ดาวน์โหลดไม่สำเร็จ (HTTP 500)'));
    assert.match(await page.textContent('#toast'), /ติดตั้งเองได้จาก .*car-screen\.apk/);
    await page.mouse.click(5, 5);
  });
  await test('short Google Maps links (maps.app.goo.gl) are resolved by the app', async () => {
    await page.click('#dockToggle'); await page.click('[data-mode="split"]'); await page.mouse.click(300, 400);
    await page.fill('#q', 'https://maps.app.goo.gl/AbCdEf'); await page.press('#q', 'Enter');
    await page.waitForFunction(() => document.querySelector('#rcName').textContent === 'Wat Arun');
    assert.deepEqual(await last('http'), ['http', 'https://maps.app.goo.gl/AbCdEf']);
  });
  await test('no console errors in the Android app mode', () => assert.deepEqual(errors, []));
  await ctx.close();
}

await browser.close(); server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
