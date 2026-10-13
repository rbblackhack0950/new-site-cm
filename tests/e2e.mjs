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
  { name: 'ถนนเพชรบุรี', geometry: geo([B, C]), maneuver: { type: 'turn', modifier: 'right', location: [B[1], B[0]] }, distance: 650, duration: 110 },
  { name: 'ซอยทดสอบ', geometry: geo([C, D]), maneuver: { type: 'turn', modifier: 'left', location: [C[1], C[0]] }, distance: 665, duration: 110 },
  { name: '', geometry: geo([D, D]), maneuver: { type: 'arrive', location: [D[1], D[0]] }, distance: 0, duration: 0 }
] }] }] };
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
  catch (e) { failed++; if (SHOTS && globalThis.__pg) await globalThis.__pg.screenshot({ path: path.join(SHOTS, 'fail-' + name.replace(/\W+/g, '_').slice(0, 30) + '.png') }).catch(() => {}); console.log('  ✗', name, '\n    ', e.message.split('\n').filter((l, i) => i === 0 || /intercepts|not visible|not stable|outside/.test(l)).slice(0, 3).join('\n     ')); }
}
async function newPage(viewport, extra = {}) {
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
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  globalThis.__pg = page;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => {
    const u = route.request().url(); const hit = k => (counts[k] = (counts[k] || 0) + 1);
    const json = b => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (u.includes('basemaps.cartocdn.com') || u.includes('i.ytimg.com')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.includes('router.project-osrm.org')) { hit('osrm'); return json(ROUTE); }
    if (u.includes('nominatim.openstreetmap.org')) { hit('nominatim'); return json(PLACES); }
    if (u.includes('youtube.com/iframe_api')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: YT_STUB });
    if (u.includes('pipedapi.kavin.rocks')) { hit('piped0'); return route.fulfill({ status: 502, body: 'down' }); }
    if (u.includes('api.piped.private.coffee')) { hit('piped1'); return json(PIPED); }
    if (u.includes('googleapis.com/youtube')) { hit('ytapi'); return json({ items: [{ id: { videoId: 'KKKKKKKKKKK' }, snippet: { title: 'From &amp; API', channelTitle: 'Ch' } }] }); }
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
  await test('distance formatting', () => {
    assert.equal(r.d1, '350 ม.'); assert.equal(r.d2, '1.5 กม.'); assert.equal(r.d3, '23 กม.');
    assert.equal(r.s1, '300 เมตร'); assert.equal(r.s2, '1.5 กิโลเมตร');
  });
  await test('no console errors on load', () => assert.deepEqual(errors, []));
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
  await shot(page, '3-route');
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
  await test('no console errors during navigation', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- YouTube ----------
console.log('YouTube');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  await page.click('.tile:has-text("YouTube")');
  await test('search falls back to a working source and lists videos only', async () => {
    await page.fill('#ytQ', 'เพลงขับรถ'); await page.press('#ytQ', 'Enter');
    await page.waitForSelector('.vitem');
    assert.equal(await page.locator('.vitem').count(), 2);
    assert.equal(counts.piped0, 1); assert.equal(counts.piped1, 1);
    assert.match(await page.textContent('.vitem .dur'), /1:00:05/);
  });
  await shot(page, '5-yt-results');
  await test('tap a result → player loads that video', async () => {
    await page.click('.vitem >> nth=0');
    await page.waitForFunction(() => window.__yt?.calls.length);
    const c = await page.evaluate(() => __yt.calls[0]);
    assert.deepEqual(c, ['new', 'AAAAAAAAAAA', null, 'https://www.youtube-nocookie.com']);
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
  await test('playlist link loads playlist', async () => {
    await page.fill('#ytQ', 'https://www.youtube.com/playlist?list=PLxyz'); await page.press('#ytQ', 'Enter');
    assert.deepEqual(await page.evaluate(() => __yt.calls.at(-1)), ['playlist', 'PLxyz']);
  });
  await test('list toggle shows the queue under the player', async () => {
    await page.click('#ytListBtn');
    assert.ok(await page.locator('#yt').evaluate(e => e.classList.contains('list-open')));
  });
  await shot(page, '6-yt-playing');
  await test('API key search uses YouTube Data API', async () => {
    await page.click('#dockToggle'); await page.click('#settingsBtn');
    await page.fill('#sKey', 'AIzaTEST'); await page.click('#sSave');
    await page.fill('#ytQ', 'news'); await page.press('#ytQ', 'Enter');
    await page.waitForSelector('.vitem:has-text("From & API")');
    assert.equal(counts.ytapi, 1);
  });
  await test('history shows after reload', async () => {
    await page.reload(); await page.waitForFunction(() => window.__car);
    assert.match(await page.textContent('#ytList'), /ดูล่าสุด/);
  });
  await test('no console errors in YouTube', () => assert.deepEqual(errors, []));
  await ctx.close();
}

// ---------- launcher & web ----------
console.log('Apps');
{
  const { page, ctx, errors } = await newPage({ width: 1280, height: 800 });
  await test('Netflix opens in a new window', async () => {
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('.tile:has-text("Netflix")')]);
    assert.match(pop.url(), /netflix\.com/); await pop.close();
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
  await test('PWA: manifest valid and service worker active', async () => {
    const m = await (await page.request.get(BASE + 'manifest.webmanifest')).json();
    assert.equal(m.display, 'fullscreen'); assert.equal(m.icons.length, 2);
    const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
    assert.match(sw, /sw\.js$/);
  });
  await test('no console errors in apps', () => assert.deepEqual(errors, []));
  await ctx.close();
}

await browser.close(); server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
