(() => {
  const $ = s => document.querySelector(s);
  const app = $('#app'), root = document.documentElement;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const st = Object.assign({ ratio: 50, swapped: false, stack: null, custom: [] }, store.get('cs', {}));
  const save = () => store.set('cs', st);

  // ---------- Layout ----------
  const autoStack = () => st.stack ?? (innerHeight > innerWidth);
  function applyLayout() {
    app.classList.toggle('stack', autoStack());
    app.classList.toggle('swapped', st.swapped);
    root.style.setProperty('--ratio', st.ratio);
    $('#ratio').textContent = st.ratio + '/' + (100 - st.ratio);
  }
  addEventListener('resize', applyLayout);
  $('#swap').onclick = () => { st.swapped = !st.swapped; save(); applyLayout(); };
  $('#layout').onclick = () => { st.stack = !autoStack(); save(); applyLayout(); };
  $('#ratio').onclick = () => { const r = [50, 66, 33]; st.ratio = r[(r.indexOf(st.ratio) + 1) % r.length]; save(); applyLayout(); };
  document.querySelectorAll('[data-max]').forEach(b => b.onclick = () => {
    const c = 'max-' + b.dataset.max, on = !app.classList.contains(c);
    app.classList.remove('max-paneA', 'max-paneB');
    if (on) app.classList.add(c);
  });
  $('#fs').onclick = () => {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen();
    else (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
  };
  document.addEventListener('fullscreenchange', () => document.body.classList.toggle('fsmode', !!document.fullscreenElement));

  // drag divider
  const div = $('#divider');
  div.addEventListener('pointerdown', e => {
    div.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = app.getBoundingClientRect(), v = autoStack();
      let p = v ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
      if (st.swapped) p = 1 - p;
      st.ratio = Math.round(Math.min(80, Math.max(20, p * 100)));
      applyLayout();
    };
    const up = () => { div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); save(); fix(false); };
    fix(true);
    div.addEventListener('pointermove', move); div.addEventListener('pointerup', up);
  });
  const fix = off => document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = off ? 'none' : '');

  // ---------- Map ----------
  const mapFrame = $('#mapFrame');
  const mapUrl = p => 'https://maps.google.com/maps?output=embed&hl=th&' + new URLSearchParams(p);
  let here = null;
  const showMap = p => mapFrame.src = mapUrl(p);
  function locate(cb) {
    navigator.geolocation?.getCurrentPosition(
      pos => { here = `${pos.coords.latitude},${pos.coords.longitude}`; cb?.(here); },
      () => alert('ไม่สามารถอ่านตำแหน่งได้ (ต้องเปิด HTTPS และอนุญาตตำแหน่ง)'),
      { enableHighAccuracy: true, timeout: 10000 });
  }
  $('#locate').onclick = () => locate(h => showMap({ q: h, z: 16 }));
  $('#mapForm').onsubmit = e => {
    e.preventDefault();
    const q = $('#mapQ').value.trim();
    if (!q) return;
    if (e.submitter?.dataset.act === 'route') {
      const go = h => showMap({ saddr: h, daddr: q, dirflg: 'd' });
      here ? go(here) : locate(go);
    } else showMap({ q });
  };
  showMap({ q: 'Bangkok' });
  locate(h => showMap({ q: h, z: 15 }));

  // ---------- App view ----------
  const frame = $('#appFrame'), notice = $('#notice');
  let current = null;
  const BUILTIN = [
    { name: 'YouTube', icon: '▶️', url: 'https://www.youtube.com', embed: true },
    { name: 'Netflix', icon: '🎬', url: 'https://www.netflix.com/browse', noframe: true },
    { name: 'Spotify', icon: '🎵', url: 'https://open.spotify.com', noframe: true },
    { name: 'Twitch', icon: '🟣', url: 'https://www.twitch.tv', noframe: true }
  ];

  function ytEmbed(input) {
    let u; try { u = new URL(input); } catch { return /^[\w-]{11}$/.test(input) ? `https://www.youtube-nocookie.com/embed/${input}?autoplay=1` : null; }
    if (!/(^|\.)youtu(\.be|be\.com|be-nocookie\.com)$/.test(u.hostname)) return null;
    const list = u.searchParams.get('list');
    let id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/) || [])[1];
    const q = new URLSearchParams({ autoplay: 1, playsinline: 1, rel: 0 });
    if (list) { q.set('list', list); if (!id) return `https://www.youtube-nocookie.com/embed/videoseries?${q}`; }
    return id ? `https://www.youtube-nocookie.com/embed/${id}?${q}` : null;
  }
  const say = (html, btn) => {
    notice.hidden = !html; notice.innerHTML = html || '';
    if (btn) { const b = document.createElement('button'); b.textContent = btn.t; b.onclick = btn.f; notice.append(document.createElement('br'), b); }
  };
  const pop = url => window.open(url, 'carapp', 'popup,width=900,height=600') || window.open(url, '_blank');

  function openUrl(raw) {
    raw = raw.trim(); if (!raw) return;
    const yt = ytEmbed(raw);
    if (yt) { current = raw; frame.src = yt; return say(''); }
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    current = raw; frame.src = raw;
    say('ถ้าหน้าจอว่าง แปลว่าเว็บนี้ไม่อนุญาตให้ฝัง', { t: 'เปิดในหน้าต่างใหม่ ↗', f: () => pop(raw) });
  }
  function openApp(a) {
    document.querySelectorAll('#apps button').forEach(b => b.classList.toggle('on', b.dataset.name === a.name));
    if (a.noframe) {
      current = a.url; frame.removeAttribute('src');
      frame.srcdoc = '<body style="margin:0;background:#141a22;color:#8a97a6;font:15px system-ui;display:grid;place-items:center;height:100vh;text-align:center;padding:20px">' + a.name + ' ไม่อนุญาตให้ฝังในเว็บอื่น<br>กดปุ่มด้านล่างเพื่อเปิดในหน้าต่างแยก</body>';
      return say(`${a.name} บล็อกการฝัง (X-Frame-Options) และ DRM ใช้ไม่ได้ใน iframe`, { t: `เปิด ${a.name} ↗`, f: () => pop(a.url) });
    }
    frame.removeAttribute('srcdoc'); current = a.url;
    if (a.embed) {
      frame.srcdoc = '<body style="margin:0;background:#141a22;color:#8a97a6;font:15px system-ui;display:grid;place-items:center;height:100vh;text-align:center;padding:20px">วางลิงก์วิดีโอ/เพลย์ลิสต์ YouTube ในช่องด้านบน<br>แล้วกด “เปิด” เพื่อเล่นในหน้านี้</body>';
      $('#urlQ').focus(); return say('');
    }
    openUrl(a.url);
  }
  function renderDock() {
    const box = $('#apps'); box.innerHTML = '';
    [...BUILTIN, ...st.custom].forEach(a => {
      const b = document.createElement('button');
      b.dataset.name = a.name; b.textContent = (a.icon || '🌐') + ' ' + a.name;
      b.onclick = () => openApp(a);
      if (a.custom) b.oncontextmenu = e => { e.preventDefault(); if (confirm(`ลบ ${a.name}?`)) { st.custom = st.custom.filter(x => x !== a); save(); renderDock(); } };
      box.append(b);
    });
    const add = document.createElement('button'); add.textContent = '＋';
    add.onclick = () => {
      const url = prompt('URL ของแอป/เว็บ'); if (!url) return;
      const full = /^https?:\/\//i.test(url) ? url : 'https://' + url;
      let name; try { name = new URL(full).hostname.replace(/^www\./, ''); } catch { return alert('URL ไม่ถูกต้อง'); }
      st.custom.push({ name, url: full, custom: true }); save(); renderDock();
    };
    box.append(add);
  }
  $('#urlForm').onsubmit = e => { e.preventDefault(); openUrl($('#urlQ').value); };
  $('#popout').onclick = () => current && pop(current);

  // ---------- Install (PWA) ----------
  const inst = $('#install');
  let promptEv = null;
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEv = e; inst.hidden = false; });
  addEventListener('appinstalled', () => { inst.hidden = true; promptEv = null; });
  if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) inst.hidden = false;
  inst.onclick = async () => {
    if (promptEv) { promptEv.prompt(); await promptEv.userChoice; promptEv = null; inst.hidden = true; }
    else say('iPhone/iPad: กดปุ่มแชร์ (⬆) ใน Safari แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”');
  };
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  applyLayout(); renderDock(); openApp(BUILTIN[0]);
})();
