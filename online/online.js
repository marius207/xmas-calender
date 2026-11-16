/* Downtown online play (client). Loaded lazily by a tiny hook in index.html ONLY when data/online.json has a url.
   Three players max. Shows the other players walking around with a name tag, simple emotes and a text chat.
   Performance rules: at most 2 remote avatars, shared geometry, no allocation per frame, nothing runs before the game starts,
   nothing is sent while the tab is hidden. Protocol: see worker.js. */
export default function init(ONL, cfg) {
  const THREE = ONL.THREE, P = ONL.P, cam = ONL.cam, scene = ONL.scene;
  const NAMES = ['marius', 'chris', 'martin'];
  const ME = String(window.__PLAYER || '').toLowerCase();
  if (!NAMES.includes(ME) || !/^wss?:\/\//.test(cfg.url || '')) return;
  const SEND_DT = 0.16;               /* about 6 messages per second, and only when something moved */
  const EMOTES = [['WAVE', 'waves', 3], ['HA HA', 'laughs', 3], ['DANCE', 'dances', 5], ['OVER HERE', 'points', 3.5]];
  const COLORS = {
    marius: { shirt: 0x15161a, pants: 0x23262e, hair: 0xb5703a, skin: 0xeec3a3 },
    chris: { shirt: 0x2c3a4e, pants: 0x3a3c52, hair: 0x7a4a2a, skin: 0xe4ae86 },
    martin: { shirt: 0x8a2a24, pants: 0x2b3046, hair: 0x6e401e, skin: 0xe9b896 },
  };
  const nice = (n) => n.charAt(0).toUpperCase() + n.slice(1);
  const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

  /* ---------- shared geometry (one set for everybody) ---------- */
  const G = {
    head: new THREE.BoxGeometry(.48, .48, .48), hair: new THREE.BoxGeometry(.5, .2, .5),
    torso: new THREE.BoxGeometry(.48, .72, .24), limb: new THREE.BoxGeometry(.24, .72, .24), face: new THREE.PlaneGeometry(.42, .42),
  };
  const mats = {};              /* per-player materials, made when that player first shows up */
  const faceTex = {};
  function faceFor(name) {
    if (faceTex[name]) return faceTex[name];
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); const col = COLORS[name];
    g.fillStyle = '#' + col.skin.toString(16).padStart(6, '0'); g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#' + col.hair.toString(16).padStart(6, '0'); g.fillRect(0, 0, 32, 7);
    g.fillStyle = '#222'; g.fillRect(8, 14, 4, 4); g.fillRect(20, 14, 4, 4); g.fillRect(12, 24, 8, 2);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    faceTex[name] = t;
    { /* use the real head picture when it loads (all three players have one) */
      new THREE.TextureLoader().load(name + '-head.png', (tx) => { tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false; tx.colorSpace = THREE.SRGBColorSpace; faceTex[name] = tx; if (mats[name]) { mats[name].face.map = tx; mats[name].face.needsUpdate = true; } }, undefined, () => {});
    }
    return faceTex[name];
  }
  function matsFor(name) {
    if (mats[name]) return mats[name];
    const c = COLORS[name], L = (x) => new THREE.MeshLambertMaterial({ color: x });
    return (mats[name] = { skin: L(c.skin), hair: L(c.hair), shirt: L(c.shirt), pants: L(c.pants), face: new THREE.MeshLambertMaterial({ map: faceFor(name) }) });
  }
  function textSprite(txt, w, h, font, fg, bg) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(txt, w / 2, h / 2 + 2); g.fillStyle = fg; g.fillText(txt, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const emoteTex = EMOTES.map((e) => textSprite(e[0], 256, 64, 'bold 40px monospace', '#ffd23f', 'rgba(0,0,0,0)'));

  /* ---------- remote players ---------- */
  const R = {};                 /* name -> avatar */
  function addRemote(name) {
    if (R[name] || name === ME || !NAMES.includes(name) || Object.keys(R).length >= 2) return R[name];
    const m = matsFor(name);
    const g = new THREE.Group(); g.visible = false;
    const hip = new THREE.Group(); hip.position.y = .72; g.add(hip);
    const body = new THREE.Mesh(G.torso, m.shirt); body.position.y = .36; hip.add(body);
    const neck = new THREE.Group(); neck.position.y = .72; hip.add(neck);
    const head = new THREE.Mesh(G.head, m.skin); head.position.y = .24; neck.add(head);
    const hair = new THREE.Mesh(G.hair, m.hair); hair.position.y = .4; head.add(hair);
    if (name === 'marius') { hair.scale.y = .25; hair.position.y = .27; } /* short buzz instead of a tall block */
    const face = new THREE.Mesh(G.face, m.face); face.position.set(0, -.02, .241); head.add(face);
    const arms = [-1, 1].map((s) => { const pv = new THREE.Group(); pv.position.set(s * .36, .66, 0); const a = new THREE.Mesh(G.limb, m.skin); a.position.y = -.3; pv.add(a); const sl = new THREE.Mesh(G.limb, m.shirt); sl.scale.set(1.04, .4, 1.04); sl.position.y = -.08; pv.add(sl); hip.add(pv); return pv; });
    const legs = [-1, 1].map((s) => { const pv = new THREE.Group(); pv.position.set(s * .12, 0, 0); const l = new THREE.Mesh(G.limb, m.pants); l.position.y = -.36; pv.add(l); hip.add(pv); return pv; });
    scene.add(g);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textSprite(name.toUpperCase(), 256, 64, 'bold 44px monospace', '#ffffff', 'rgba(0,0,0,0)'), fog: false, transparent: true }));
    tag.center.set(.5, 0); tag.visible = false; scene.add(tag);
    const em = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTex[0], fog: false, transparent: true }));
    em.center.set(.5, 0); em.visible = false; scene.add(em);
    return (R[name] = { name, g, hip, neck, arms, legs, tag, em, x: 0, y: 0, z: 0, yaw: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, tpitch: 0, a: 0, v: 0, ph: 0, sp: 0, have: false, emote: -1, et: 0, edur: 0, seen: 0 });
  }
  function dropRemote(name) {
    const r = R[name]; if (!r) return;
    scene.remove(r.g); scene.remove(r.tag); scene.remove(r.em); r.tag.material.map.dispose(); r.tag.material.dispose(); r.em.material.dispose();
    delete R[name]; refreshBadge();
  }

  function animate(r, dt, now) {
    if (!r.have) return;
    const k = 1 - Math.exp(-dt * 11);
    const ox = r.x, oz = r.z;
    if (Math.abs(r.tx - r.x) + Math.abs(r.tz - r.z) > 40) { r.x = r.tx; r.y = r.ty; r.z = r.tz; } /* teleport: snap */
    else { r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; }
    let dy = r.tyaw - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw += dy * k;
    const inst = Math.sqrt((r.x - ox) * (r.x - ox) + (r.z - oz) * (r.z - oz)) / Math.max(dt, .001);
    r.sp += (Math.min(inst, 12) - r.sp) * Math.min(1, dt * 8);
    const dx = r.x - cam.position.x, dyy = r.y - cam.position.y, dz = r.z - cam.position.z, d = Math.sqrt(dx * dx + dyy * dyy + dz * dz);
    const g = r.g, vis = r.v === 0 && d < 450;
    g.visible = vis; r.tag.visible = true;
    const emoting = r.emote >= 0 && now - r.et < r.edur;
    if (r.emote >= 0 && !emoting) { r.emote = -1; r.em.visible = false; }
    let bounce = 0;
    if (vis) {
      g.position.set(r.x, r.y, r.z);
      const amp = Math.min(1, r.sp / 4.3); r.ph += dt * r.sp * 2.2; const sw = Math.sin(r.ph) * .9 * amp;
      const hip = r.hip, L = r.legs, A = r.arms;
      hip.rotation.set(0, 0, 0); r.neck.rotation.set(0, 0, 0); A[0].rotation.set(0, 0, 0); A[1].rotation.set(0, 0, 0);
      if (r.a === 2) { g.rotation.y = r.yaw + Math.PI; hip.rotation.x = 1.25; L[0].rotation.x = L[1].rotation.x = 0; }
      else {
        g.rotation.y = r.yaw + Math.PI;
        L[0].rotation.x = sw; L[1].rotation.x = -sw; A[0].rotation.x = -sw; A[1].rotation.x = sw * .6 - .25;
      }
      if (emoting) {
        const t = now - r.et;
        if (r.emote === 0) { A[1].rotation.x = -2.7; A[1].rotation.z = Math.sin(t * 11) * .45; }
        else if (r.emote === 1) { bounce = Math.abs(Math.sin(t * 14)) * .1; r.neck.rotation.x = -.35; hip.rotation.x = -.12; A[0].rotation.x = -.5; A[1].rotation.x = -.5; }
        else if (r.emote === 2) { const s = Math.sin(t * 8); hip.rotation.y = s * .5; bounce = Math.abs(Math.sin(t * 8)) * .12; A[0].rotation.x = -2.4 * (s > 0 ? 1 : .25); A[1].rotation.x = -2.4 * (s > 0 ? .25 : 1); L[0].rotation.x = s * .6; L[1].rotation.x = -s * .6; }
        else { A[1].rotation.x = -1.57; r.neck.rotation.y = .4; }
      }
      hip.position.y = .72 + bounce;
    }
    const base = r.v ? 1.1 : 2.15;
    const sc = Math.max(.5, Math.min(30, d * .04));
    r.tag.position.set(r.x, r.y + base, r.z); r.tag.scale.set(sc * 4, sc, 1);
    if (r.em.visible || emoting) { r.em.visible = emoting; r.em.position.set(r.x, r.y + base + sc * 1.0, r.z); r.em.scale.set(sc * 3.2, sc * .8, 1); }
  }

  /* ---------- screen: badge, chat, emote bar ---------- */
  const css = document.createElement('style');
  css.textContent = '#olHud{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);z-index:4;font-family:var(--label,monospace);color:#fff;pointer-events:none;width:min(360px,calc(100vw - 20px))}' +
    'body.film #olHud{display:none}#olHud .row{display:flex;gap:6px;align-items:center;pointer-events:auto;margin-top:6px}' +
    '#olHud .badge{background:rgba(0,0,0,.6);border:3px solid #000;padding:5px 8px;font-size:12px;white-space:nowrap}' +
    '#olHud button{font:inherit;font-size:11px;background:rgba(60,60,60,.75);color:#fff;border:3px solid #000;padding:5px 8px;cursor:pointer}' +
    '#olHud button:hover{background:rgba(110,110,110,.85)}#olLog{display:flex;flex-direction:column;gap:2px}' +
    '#olLog div{background:rgba(0,0,0,.55);padding:3px 7px;font-size:13px;line-height:1.25;word-break:break-word;transition:opacity 1.5s;text-shadow:1px 1px 0 #000}' +
    '#olLog div.old{opacity:0}#olHud.open #olLog div.old{opacity:1}#olLog b{color:#ffd23f}#olLog i{color:#9fd0ff}' +
    '#olIn{display:none;width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:6px 8px;background:rgba(0,0,0,.8);color:#fff;border:3px solid #fff;outline:none}#olHud.open #olIn{display:block}' +
    '#olEm{display:none}#olEm.on{display:flex}';
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'olHud'; hud.setAttribute('aria-label', 'Online play');
  hud.innerHTML = '<div id="olLog" aria-live="polite"></div><input id="olIn" maxlength="200" autocomplete="off" placeholder="Say something, Enter to send, Esc to cancel"><div class="row"><span class="badge" id="olBadge">ONLINE: connecting...</span><button type="button" id="olChatB" title="Chat (Enter)">CHAT</button><button type="button" id="olEmB" title="Emotes (Z)">EMOTE</button></div><div class="row" id="olEm"></div>';
  document.body.appendChild(hud);
  const $ = (id) => document.getElementById(id), log = $('olLog'), inp = $('olIn'), badge = $('olBadge'), emBar = $('olEm');
  EMOTES.forEach((e, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + ' ' + e[0]; b.onclick = () => { doEmote(i); }; emBar.appendChild(b); });

  let status = 'connecting';
  function refreshBadge() {
    let n = 1; for (const k in R) if (R[k].have) n++;
    badge.textContent = status === 'open' ? 'ONLINE: ' + n + ' here' : status === 'connecting' ? 'ONLINE: connecting...' : status === 'room' ? 'ONLINE: wrong room code' : status === 'other' ? 'ONLINE: open in another tab' : 'ONLINE: reconnecting...';
    badge.style.color = status === 'open' ? '#9dff9d' : '#ffd23f';
  }
  let msgN = 0;
  function say(who, text, mine) { /* textContent only: nothing a player sends can become HTML */
    const d = document.createElement('div'); d.dataset.n = String(++msgN);
    if (who) { const b = document.createElement(mine ? 'i' : 'b'); b.textContent = who.toUpperCase() + ': '; d.appendChild(b); d.appendChild(document.createTextNode(text)); }
    else { const i = document.createElement('i'); i.textContent = text; d.appendChild(i); }
    log.appendChild(d); while (log.children.length > 8) log.removeChild(log.firstChild);
    setTimeout(() => d.classList.add('old'), 12000);
  }
  let chatOpen = false, emOpen = false;
  function openChat() { if (chatOpen) return; chatOpen = true; emBar.classList.remove('on'); emOpen = false; hud.classList.add('open'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (_) {} inp.value = ''; setTimeout(() => inp.focus(), 0); }
  function closeChat() { if (!chatOpen) return; chatOpen = false; hud.classList.remove('open'); inp.blur(); try { if (!ONL.touch && ONL.view && ONL.view.requestPointerLock) { const pr = ONL.view.requestPointerLock(); pr && pr.catch && pr.catch(() => {}); } } catch (_) {} }
  function toggleEm(on) { emOpen = on === undefined ? !emOpen : on; emBar.classList.toggle('on', emOpen); }
  function blocked() { return !ONL.started() || document.body.classList.contains('film') || !document.getElementById('inv').hidden || !document.getElementById('search').hidden; }
  $('olChatB').onclick = () => openChat();
  $('olEmB').onclick = () => toggleEm();
  inp.addEventListener('blur', () => { if (chatOpen) setTimeout(() => { if (chatOpen && document.activeElement !== inp) closeChat(); }, 120); });

  addEventListener('keydown', (e) => {
    if (e.target === inp) {
      e.stopImmediatePropagation();
      if (e.key === 'Enter') { const t = clean(inp.value); if (t) { send({ t: 'chat', m: t }); say(ME, t, true); } closeChat(); e.preventDefault(); }
      else if (e.key === 'Escape') { closeChat(); e.preventDefault(); }
      return;
    }
    const tg = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tg) || e.ctrlKey || e.metaKey || e.altKey || e.repeat || blocked()) return;
    if (e.key === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); openChat(); }
    else if (e.code === 'KeyZ') { e.stopImmediatePropagation(); toggleEm(); }
    else if (emOpen && /^[1-4]$/.test(e.key)) { e.stopImmediatePropagation(); e.preventDefault(); doEmote(+e.key - 1); }
    else if (emOpen && e.key === 'Escape') { toggleEm(false); }
  }, true);

  function doEmote(i) {
    toggleEm(false); send({ t: 'emote', e: i }); say(null, '* You ' + EMOTES[i][1]);
    ONL.toast && ONL.toast('You ' + EMOTES[i][1]);
  }

  /* ---------- network ---------- */
  let handleMsg = () => {}, ws = null, retry = 2000, retryT = 0, pingT = 0, force = true, closedFor = '';
  function send(o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (_) {} } }
  function connect() {
    clearTimeout(retryT); status = 'connecting'; refreshBadge();
    /* came from the lobby on the title screen? then use that very connection (already logged in, no second login) */
    const L = window.__LOBBY && window.__LOBBY.takeOver ? window.__LOBBY.takeOver() : null;
    if (L) ws = L; else { try { ws = new WebSocket(cfg.url); } catch (_) { later(); return; } }
    const mine = ws;
    if (!L) ws.onopen = () => { mine.send(JSON.stringify({ t: 'hello', name: ME, room: cfg.room, where: 'game' })); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (_) { return; } handleMsg(m); };
    handleMsg = (m) => {
      if (m.t === 'pos') { const r = R[m.n] || addRemote(m.n); if (!r) return; r.tx = m.x; r.ty = m.y; r.tz = m.z; r.tyaw = m.yaw + 0; r.tpitch = m.pitch; r.a = m.a | 0; r.v = m.v | 0; r.seen = performance.now(); if (!r.have) { r.have = true; refreshBadge(); r.x = m.x; r.y = m.y; r.z = m.z; r.yaw = m.yaw; } }
      else if (m.t === 'hi') { status = 'open'; retry = 2000; for (const n of m.players) { const sv = m.states && m.states[n]; if (!sv || sv.where === 'game') addRemote(n); } force = true; say(null, m.players.length ? 'Online: ' + m.players.map(nice).join(' and ') + (m.players.length > 1 ? ' are' : ' is') + ' here.' : 'You are online. Nobody else is here yet.'); refreshBadge(); }
      else if (m.t === 'join') { if (m.where === 'lobby' || m.where === 'title') { say(null, nice(m.n) + ' is in the lobby.'); } else { addRemote(m.n); force = true; say(null, nice(m.n) + ' joined.'); } refreshBadge(); }
      else if (m.t === 'who') { if (m.where === 'game') { if (!R[m.n]) say(null, nice(m.n) + ' joined.'); addRemote(m.n); force = true; } else if (R[m.n]) dropRemote(m.n); refreshBadge(); }
      else if (m.t === 'leave') { dropRemote(m.n); say(null, nice(m.n) + ' left.'); }
      else if (m.t === 'chat') { say(m.n, clean(m.m)); }
      else if (m.t === 'emote') { const r = R[m.n]; const i = m.e | 0; if (i < 0 || i > 3) return;
        if (r) { r.emote = i; r.et = performance.now() / 1000; r.edur = EMOTES[i][2]; r.em.material.map = emoteTex[i]; r.em.visible = true; } say(null, nice(m.n) + ' ' + EMOTES[i][1] + '.'); }
      else if (m.t === 'book') { try { window.dispatchEvent(new CustomEvent('vbook-in', { detail: { n: String(m.n || ''), id: String(m.id || ''), text: String(m.text || ''), ts: +m.ts || 0, d: String(m.d || ''), day: m.day | 0 } })); } catch (_) {} }
      else if (m.t === 'ev') { try { onEv(m); } catch (_) {} }
      else if (m.t === 'bad') { closedFor = m.why; }
    };
    ws.onclose = () => {
      if (ws !== mine) return; ws = null;
      for (const n of Object.keys(R)) dropRemote(n);
      if (closedFor === 'room' || closedFor === 'name') { status = 'room'; refreshBadge(); say(null, 'Online: the room code in data/online.json does not match the server.'); return; }
      if (closedFor === 'other') { status = 'other'; refreshBadge(); return; }
      status = 'retry'; refreshBadge(); later();
    };
    ws.onerror = () => {};
    if (L) { send({ t: 'state', where: 'game', ready: false }); send({ t: 'roster' }); }
  }
  function later() { clearTimeout(retryT); retryT = setTimeout(() => { if (!document.hidden) connect(); else later(); }, retry); retry = Math.min(30000, retry * 2); }
  addEventListener('pagehide', () => { send({ t: 'bye' }); });

  /* ---------- per frame (called from the game's frame loop, after it has moved everything) ---------- */
  let started = false, acc = 0, sx = 1e9, sy = 0, sz = 0, syaw = 0, spit = 0, sa = -1, sv = -1, tPing = 0;
  window.__ONF = function (dt, t) {
    if (!started) { if (!ONL.started()) return; started = true; connect(); }
    if (R.marius || R.chris || R.martin) { const now = performance.now() / 1000; for (const n in R) animate(R[n], dt, now); }
    /* send our own position: about 6 times a second, only if we moved, never from a hidden tab */
    acc += dt; if (acc < SEND_DT) return; acc = 0;
    if (!ws || ws.readyState !== 1 || status !== 'open' || document.hidden) return;
    const D = P.driving; let x = P.x, y = P.y, z = P.z, yaw = P.yaw, v = 0;
    if (D) { v = 1; if (typeof D.x === 'number' && typeof D.z === 'number') { x = D.x; y = D.y || y; z = D.z; } }
    const a = P.glide ? 2 : P.fly ? 1 : 0;
    const moved = Math.abs(x - sx) + Math.abs(y - sy) + Math.abs(z - sz) > .04 || Math.abs(yaw - syaw) > .02 || Math.abs(P.pitch - spit) > .03 || a !== sa || v !== sv;
    if (moved || force) {
      force = false; sx = x; sy = y; sz = z; syaw = yaw; spit = P.pitch; sa = a; sv = v;
      const q = (n) => Math.round(n * 100) / 100;
      ws.send(JSON.stringify({ t: 'pos', x: q(x), y: q(y), z: q(z), yaw: q(yaw), pitch: q(P.pitch), a, v }));
    } else if (t - tPing > 25) { tPing = t; ws.send('p'); }
  };

  /* ---------- shared big moments (job onlinemp): siren, northern lights, witch visit, one shared clock ----------
     Message: ev{k,seed,ts,d}. One source of truth: whoever starts a moment first broadcasts; a duplicate inside its window is ignored.
     Everything is dropped during cutscenes/intro/hidden tab (and on phones before the intro was seen). Nothing here runs when online is off. */
  const W = window, LSg = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const T0 = performance.now(), seen = {};          /* k -> last time (ms) we handled/sent it */
  const age = () => (performance.now() - T0) / 1000;
  const fresh = (k, win) => { const n = performance.now(); if (seen[k] && n - seen[k] < win) return false; seen[k] = n; return true; };
  function evOk() {
    try {
      if (!ONL.started() || document.hidden || status !== 'open') return false;
      if (W.__INTRO_ON || (W.__OPENING && W.__OPENING.on) || W.__CINE_MUTE || W.__ITEMGET_ON || W.__BOSS_ON) return false;
      if (ONL.touch && LSg('kv-intro-seen') !== '1') return false;
      if (document.body.classList.contains('film') && !W.__ONLINE_DEVFORCE) { /* film mode is allowed for sound, not for the rest */ }
      return true;
    } catch (_) { return false; }
  }
  const evSend = (k, d, seed) => send({ t: 'ev', k, seed: (seed === undefined ? (Math.random() * 4294967295) >>> 0 : seed), ts: Date.now(), d: d || {} });
  const SH = () => W.__SHELTER, SI = () => W.__SIRENS, NL = () => W.__NORDLYS, WF = () => W.__WITCHFIRE, TD = () => W.__TOD;
  const DAY = () => +W.__DAY || 0;
  const SHARED = { siren: { sent: 0, got: 0 }, wf: { sent: 0, got: 0, far: 0 }, nl: { sent: 0, got: 0 }, clk: { sent: 0, got: 0, adopted: 0 }, dropped: 0, last: '' };

  /* --- air-raid siren: the starter sends the clip + the hatch; the others play the same clip now and open the same hatch --- */
  let remoteSiren = 0, sirenOff = null;
  function hookSiren() {
    const S = SI(); if (sirenOff || !S || !S.on) return !!sirenOff;
    sirenOff = S.on('start', (c) => {
      if (Date.now() < remoteSiren) return;                  /* this one came from somebody else */
      if (!fresh('siren', 30000)) return;
      setTimeout(() => { const h = SH(); evSend('siren', { i: c.clip, p: c.pole, h: h && h.openIdx >= 0 ? h.openIdx : -1 }); SHARED.siren.sent++; }, 0);
    });
    return true;
  }
  function sirenIn(m) {
    const S = SI(), d = m.d || {}; if (!S || !S.play || !S.enabled) return;
    if (!fresh('siren', 30000)) { SHARED.dropped++; return; }
    if (!evOk()) { SHARED.dropped++; return; }
    const st = S.state(); if (st.playing || (st.sinceLast !== null && st.sinceLast < 240)) { SHARED.dropped++; return; }  /* own cooldown: never farmed */
    remoteSiren = Date.now() + 6000; SHARED.siren.got++;
    const i = ((d.i | 0) % 4 + 4) % 4, h = d.h | 0;
    S.play(i).then((ok) => {
      if (!ok) return;
      try { const sh = SH(); if (sh && sh.built && sh.enabled && h >= 0 && sh.hatches[h] && sh.openIdx !== h) sh.open(h); } catch (_) {}
      say(null, 'The siren is going off for ' + nice(m.n) + ' too.');
    });
  }

  /* --- one shared clock: the player who has been online longest is the clock; the others follow (so the same nights, the same northern lights, the same dusk) --- */
  let clkT = 0;
  function sendClock() { const T = TD(); if (!T || !evOk()) return; evSend('clk', { h: +T.h.toFixed(4), d: T.d | 0, sp: T.speed, a: +age().toFixed(1) }); SHARED.clk.sent++; }
  function clockIn(m) {
    const T = TD(), d = m.d || {}; if (!T || typeof d.h !== 'number' || !isFinite(d.h)) return; SHARED.clk.got++;
    if (!ONL.started() || W.__INTRO_ON || T.paused || T.urlForced || T.speed !== d.sp) return;
    const mine = age(), theirs = +d.a || 0;
    if (theirs < mine || (theirs === mine && m.n > ME)) return;       /* the older player wins; ties go to the first name */
    const lat = Math.max(0, Math.min(3, (Date.now() - (m.ts || Date.now())) / 1000)) * T.speed / 60;
    let h = d.h + lat, dd = d.d | 0; if (h >= 24) { h -= 24; dd++; }
    const diff = (dd * 24 + h) - (T.d * 24 + T.h);
    if (Math.abs(diff) < .1) return;
    try { T.d = dd; T.h = h; if (T.set) T.set(h); } catch (_) { return; }
    SHARED.clk.adopted++; SHARED.last = 'clock from ' + m.n;
  }

  /* --- northern lights: same nights come from the shared clock. A whistler who calls the red fingers makes everybody's sky lean in; only the whistler is hunted --- */
  let nlStage = 0, nlRemote = { n: '', s: 0, until: 0 }, nlK = 0;
  function nlPoll() {
    const n = NL(); if (!n || typeof n.stage !== 'number') return;
    if (n.stage !== nlStage) { nlStage = n.stage; if (nlStage >= 1 && evOk()) { evSend('nl', { s: nlStage }); SHARED.nl.sent++; } }
  }
  function nlIn(m) {
    const n = NL(), d = m.d || {}; if (!n) return; SHARED.nl.got++;
    if (!evOk() || !n.tonight || !n.tonight()) { SHARED.dropped++; return; }
    nlRemote = { n: m.n, s: Math.max(1, Math.min(2, d.s | 0)), until: performance.now() + (d.s >= 2 ? 22000 : 9000) };
    say(null, nice(m.n) + ' whistled at the northern lights. The sky is listening.');
  }
  function nlFrame() {
    requestAnimationFrame(nlFrame);
    const n = NL(); if (!n) return;
    const on = performance.now() < nlRemote.until && n.stage === 0 && n.k > .3;
    nlK += ((on ? nlRemote.s : 0) - nlK) * .04;
    if (nlK > .01 && n.stage === 0) { W.__NORDK = (W.__NORDK || 0) * (1 + .5 * nlK); W.__NORDS = (W.__NORDS || 1) * (1 - .06 * nlK); }
  }
  requestAnimationFrame(nlFrame);

  /* --- witch visit: whoever she visits broadcasts. Players within 150 m get her too (their own visit, their own daily cap, all safety gates); far players hear a distant cackle. Before day 12 only --- */
  let wfPh = 'idle', wfSkipUntil = 0;
  function wfPoll() {
    const w = WF(); if (!w) return; const ph = w.ph;
    if (ph === 'visit' && wfPh !== 'visit' && Date.now() > wfSkipUntil && evOk() && DAY() < 12 && fresh('wf', 60000)) { evSend('wf', { x: Math.round(P.x), z: Math.round(P.z) }); SHARED.wf.sent++; }
    wfPh = ph;
  }
  function cackle() { try { const a = new Audio('voice/witch_cackle_' + (1 + ((Math.random() * 3) | 0)) + '.mp4'); a.volume = .12; a.play().catch(() => {}); } catch (_) {} }
  function wfIn(m) {
    const w = WF(), d = m.d || {}; if (!w || DAY() >= 12) return; SHARED.wf.got++;
    if (!fresh('wf', 60000) || !evOk()) { SHARED.dropped++; return; }
    const r = R[m.n], okd = isFinite(d.x) && isFinite(d.z), sx = okd ? +d.x : (r && r.have ? r.tx : 1e9), sz = okd ? +d.z : (r && r.have ? r.tz : 1e9), dist = Math.hypot(P.x - sx, P.z - sz);
    if (!(dist < 150)) { SHARED.wf.far++; cackle(); say(null, 'Far away, somebody hears a cackle.'); return; }
    const st = typeof w.state === 'function' ? w.state() : w.state; if (!st) return; if (st.today >= st.cap) { SHARED.dropped++; return; }     /* daily cap: a shared visit counts and never goes over */
    wfSkipUntil = Date.now() + 5000;
    if (w.visit() === 'ok') { try { w.test.setCount(st.today + 1); } catch (_) {} wfPh = 'visit'; say(null, 'The witch is after ' + nice(m.n) + ' and you.'); }
  }

  function onEv(m) {
    if (m.k === 'siren') sirenIn(m); else if (m.k === 'clk') clockIn(m); else if (m.k === 'nl') nlIn(m); else if (m.k === 'wf') wfIn(m);
  }
  setInterval(() => { try { hookSiren(); nlPoll(); wfPoll(); if (status === 'open' && Object.keys(R).length) { if (++clkT >= 20) { clkT = 0; sendClock(); } } else clkT = 18; } catch (_) {} }, 500);
  /* dev helpers (tests): fire each moment from this page */
  const dev = {
    siren: (i) => { const S = SI(); return S.play(i == null ? 1 : i); },
    witch: () => { const w = WF(); wfSkipUntil = 0; return w.visit(); },
    nordlys: (s) => { evSend('nl', { s: s || 2 }); SHARED.nl.sent++; },
    clock: () => sendClock(), fresh: () => { for (const k in seen) delete seen[k]; }, shared: SHARED,
    force: (k, d) => evSend(k, d), feed: (m) => handleMsg(m),
  };
  window.__ONLINE = { dev, SHARED,  R, get status() { return status; }, send, say, names: () => Object.keys(R), emote: doEmote, ws: () => ws };
}
