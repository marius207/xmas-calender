/* Downtown online lobby: a waiting room on the title screen, before the world is built.
   Classic script (not a module), loaded by a tiny snippet in index.html only when data/online.json has a server address.
   It opens the presence connection to the relay (protocol: worker.js). When PLAY is pressed the same websocket is handed to online.js
   (window.__LOBBY.takeOver()), so there is no second login and no duplicate avatar. Static overlay: no per-frame work at all. */
(function () {
  'use strict';
  var cfg = window.__ONLINE_CFG; if (!cfg || !cfg.url || !cfg.room) return;
  var NAMES = ['marius', 'chris', 'martin'];
  var PHOTO = { chris: 'chris-head.png', martin: 'martin-head.png', marius: 'marius-head.png' };
  var ME = '', ws = null, authed = false, owned = false, connT = 0, pingT = 0, others = {}, myReady = false, goFlag = false, ctx = null;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var nice = function (n) { return n.charAt(0).toUpperCase() + n.slice(1); };
  var clean = function (s) { return String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200); };

  /* ---------- screen ---------- */
  var css = el('style'); css.id = 'lobbyCss';
  css.textContent =
    '#lobby{z-index:6}#lobby .card{max-width:640px;width:100%}#lobby h1{font-size:clamp(34px,6vw,56px)}' +
    '.lbSlots{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
    '.lbSlot{width:150px;display:grid;gap:6px;justify-items:center;background:#2b2118;border:3px solid #000;box-shadow:inset 0 0 0 3px #6b4426;padding:12px 8px;transition:filter .3s,opacity .3s}' +
    '.lbSlot img,.lbSlot .mf{width:80px;height:80px;image-rendering:pixelated;border:3px solid #000;box-sizing:border-box}' +
    '.lbSlot .mf{display:grid;place-items:center;background:#1d4f91;font:700 44px var(--display);color:var(--gold);text-shadow:3px 3px 0 #000}' +
    '.lbSlot b{font-family:var(--display);font-size:22px;letter-spacing:.04em}.lbSlot span{font-family:var(--label);font-size:11px;min-height:1.3em;color:#e6d2b5}' +
    '.lbSlot.wait{filter:grayscale(1) brightness(.6);opacity:.55}.lbSlot.wait span{color:#999}' +
    '.lbSlot.here{box-shadow:inset 0 0 0 3px var(--gold),0 0 18px rgba(255,210,63,.35);background:#3d2e1c}' +
    '.lbSlot.game{box-shadow:inset 0 0 0 3px var(--ice,#9fd0ff),0 0 18px rgba(120,190,255,.3);background:#1f2d40}' +
    '.lbSlot.rdy span{color:#9dff9d}.lbSlot.me b::after{content:" (you)";font-size:12px;color:var(--mute)}' +
    '#lbLog{width:100%;max-width:520px;min-height:74px;max-height:110px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;text-align:left;font-size:14px}' +
    '#lbLog div{background:rgba(0,0,0,.45);padding:2px 8px;word-break:break-word}#lbLog i{color:#9fd0ff}#lbLog b{color:#ffd23f}' +
    '#lbIn{width:100%;max-width:520px;box-sizing:border-box;font:15px var(--body);padding:8px 10px;background:#11131c;color:#fff;border:3px solid #000;box-shadow:inset 0 0 0 2px var(--edge,#555)}' +
    '.lbBtns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}.go.alt{background:#2a5a9a}.go.alt.on{background:#3aa04a}' +
    '.go.pulse{animation:lbp .7s infinite alternate}@keyframes lbp{to{filter:brightness(1.5)}}' +
    '#playOnline{margin-top:-4px}#playOnline[disabled]{background:#555;cursor:not-allowed}#lbMsg{min-height:1.4em}';
  document.head.appendChild(css);

  var lobby = el('div', 'screen'); lobby.id = 'lobby'; lobby.hidden = true; lobby.setAttribute('role', 'dialog'); lobby.setAttribute('aria-label', 'Online lobby');
  var card = el('div', 'card'); lobby.appendChild(card);
  card.appendChild(el('small', '', 'DERP STUDIOS PRESENTS · DOWNTOWN ADVENTURE'));
  card.appendChild(el('h1', '', 'Lobby'));
  var msg = el('p', '', 'Connecting…'); msg.id = 'lbMsg'; card.appendChild(msg);
  var slotsBox = el('div', 'lbSlots'); card.appendChild(slotsBox);
  var slots = {};
  NAMES.forEach(function (n) {
    var s = el('div', 'lbSlot wait');
    if (PHOTO[n]) { var im = el('img'); im.src = PHOTO[n]; im.alt = ''; s.appendChild(im); } else { var mf = el('span', 'mf', 'M'); mf.setAttribute('aria-hidden', 'true'); s.appendChild(mf); }
    var b = el('b', '', n.toUpperCase()), st = el('span', '', 'WAITING'); s.appendChild(b); s.appendChild(st); slotsBox.appendChild(s); slots[n] = { box: s, st: st };
  });
  var log = el('div'); log.id = 'lbLog'; log.setAttribute('aria-live', 'polite'); card.appendChild(log);
  var inp = el('input'); inp.id = 'lbIn'; inp.maxLength = 200; inp.placeholder = 'Say something to the others, Enter to send'; inp.autocomplete = 'off'; card.appendChild(inp);
  var btns = el('div', 'lbBtns'); card.appendChild(btns);
  var bReady = el('button', 'go alt', 'READY'); bReady.type = 'button'; bReady.id = 'lbReady';
  var bPlay = el('button', 'go', 'PLAY'); bPlay.type = 'button'; bPlay.id = 'lbPlay';
  var bBack = el('button', 'go alt', 'BACK'); bBack.type = 'button'; bBack.id = 'lbBack';
  btns.appendChild(bReady); btns.appendChild(bPlay); btns.appendChild(bBack);
  document.body.appendChild(lobby);

  /* ---------- helpers ---------- */
  function say(who, text) {
    var d = el('div');
    if (who) { d.appendChild(el('b', '', who.toUpperCase() + ': ')); d.appendChild(document.createTextNode(text)); } else d.appendChild(el('i', '', text));
    log.appendChild(d); while (log.children.length > 6) log.removeChild(log.firstChild);
  }
  function beep(f1, f2) {
    try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f1; o.frequency.setValueAtTime(f2, ctx.currentTime + .09); g.gain.value = .05; g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .25); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .26); } catch (e) {}
  }
  function send(o) { if (ws && ws.readyState === 1 && !owned) { try { ws.send(JSON.stringify(o)); } catch (e) {} } }
  function where(n) { return n === ME ? 'lobby' : (others[n] ? others[n].where : null); }

  function render() {
    var present = 0, ready = 0, inGame = 0;
    NAMES.forEach(function (n) {
      var s = slots[n], me = n === ME, o = me ? { where: 'lobby', ready: myReady } : others[n];
      s.box.className = 'lbSlot' + (me ? ' me' : '');
      if (!o) { s.box.classList.add('wait'); s.st.textContent = 'WAITING'; return; }
      if (o.where === 'game') { s.box.classList.add('game'); s.st.textContent = 'IN GAME'; inGame++; return; }
      if (o.where === 'title') { s.box.classList.add('game'); s.st.textContent = 'STARTING'; return; }
      s.box.classList.add('here'); present++; if (o.ready) { s.box.classList.add('rdy'); s.st.textContent = 'HERE ✓ READY'; ready++; } else s.st.textContent = 'HERE';
    });
    var together = present >= 2 && ready === present;
    bPlay.textContent = goFlag ? 'PLAY NOW' : together ? 'START TOGETHER' : inGame ? 'JOIN GAME' : 'PLAY';
    bPlay.classList.toggle('pulse', goFlag || together);
    bReady.textContent = myReady ? 'READY ✓' : 'READY'; bReady.classList.toggle('on', myReady);
    var n = Object.keys(others).length;
    msg.textContent = !authed ? 'Connecting…' : n === 0 ? 'Waiting for friends. You can press PLAY any time.' : inGame ? 'Someone is already in the game. Press JOIN GAME to walk to them.' : together ? 'Everybody is ready. Start together!' : 'Friends are here. Press READY, then PLAY.';
  }

  /* ---------- connection ---------- */
  function connect() {
    authed = false; owned = false; others = {}; myReady = false; goFlag = false; render();
    clearTimeout(connT); connT = setTimeout(function () { if (!authed) fail('Cannot reach the online server.'); }, 7000);
    try { ws = new WebSocket(cfg.url); } catch (e) { fail('Cannot reach the online server.'); return; }
    var mine = ws;
    ws.onopen = function () { mine.send(JSON.stringify({ t: 'hello', name: ME, room: cfg.room, where: 'lobby' })); };
    ws.onmessage = function (ev) {
      if (owned || ws !== mine) return;
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hi') {
        authed = true; clearTimeout(connT); others = {};
        (m.players || []).forEach(function (n) { var s = (m.states && m.states[n]) || {}; others[n] = { where: s.where || 'game', ready: !!s.ready }; });
        var names = Object.keys(others); say(null, names.length ? 'Here: ' + names.map(nice).join(', ') + '.' : 'You are in the lobby.'); render();
        clearInterval(pingT); pingT = setInterval(function () { if (ws && ws.readyState === 1 && !owned) ws.send('p'); }, 25000);
      } else if (m.t === 'join') { others[m.n] = { where: m.where || 'game', ready: !!m.ready }; say(null, nice(m.n) + ' joined the ' + (m.where === 'game' ? 'game' : 'lobby') + '.'); beep(520, 780); render(); }
      else if (m.t === 'who') { if (others[m.n]) { var was = others[m.n].where; others[m.n] = { where: m.where, ready: !!m.ready }; if (was !== m.where && m.where === 'game') say(null, nice(m.n) + ' is in the game.'); } render(); }
      else if (m.t === 'leave') { delete others[m.n]; say(null, nice(m.n) + ' left.'); beep(420, 300); render(); }
      else if (m.t === 'chat') { say(m.n, clean(m.m)); }
      else if (m.t === 'go') { goFlag = true; say(null, nice(m.n) + ' says: START TOGETHER! Press PLAY.'); beep(660, 990); render(); }
      else if (m.t === 'bad') { fail(m.why === 'other' ? 'You are already online in another tab.' : m.why === 'room' ? 'Wrong room code in data/online.json.' : 'The server does not know this player.'); }
    };
    ws.onclose = function () { if (owned || ws !== mine) return; clearInterval(pingT); if (!authed) fail('Cannot reach the online server.'); else { authed = false; say(null, 'Connection lost.'); msg.textContent = 'Connection lost. Press BACK and try again.'; } };
    ws.onerror = function () {};
  }
  function disconnect() { clearTimeout(connT); clearInterval(pingT); var w = ws; ws = null; authed = false; if (w && !owned) { try { w.send(JSON.stringify({ t: 'bye' })); } catch (e) {} try { w.close(); } catch (e) {} } }
  function fail(text) { disconnect(); closeLobby(); offlineBtn(text); }

  /* ---------- title screen button ---------- */
  var play = null;
  function offlineBtn(text) {
    if (!play) return; play.textContent = 'Offline'; play.disabled = true; play.title = text || '';
    setTimeout(function () { if (play) { play.textContent = 'PLAY ONLINE'; play.disabled = false; play.title = ''; } }, 20000);
  }
  function openLobby() { var intro = document.getElementById('intro'); lobby.hidden = false; if (intro) intro.hidden = true; log.textContent = ''; inp.value = ''; connect(); setTimeout(function () { try { bPlay.focus(); } catch (e) {} }, 0); }
  function closeLobby() { lobby.hidden = true; var intro = document.getElementById('intro'); if (intro) intro.hidden = false; }
  function doPlay() {
    var together = bPlay.textContent === 'START TOGETHER';
    if (together) send({ t: 'go' });
    send({ t: 'state', where: 'title', ready: myReady });
    lobby.hidden = true; var intro = document.getElementById('intro'); if (intro) intro.hidden = false; window.__LOBBY.playing = true;
    if (play) { play.hidden = true; }
    var st = document.getElementById('start');
    var note = document.getElementById('lbNote') || (function () { var d = el('div'); d.id = 'lbNote'; d.style.cssText = 'font-family:var(--label);font-size:12px;color:#9dff9d'; if (st && st.parentNode) st.parentNode.insertBefore(d, st.nextSibling); return d; })();
    note.textContent = 'ONLINE: you are in. Press START when the town is built.';
    if (st && !st.disabled) st.click();   /* the town is already built: start right away (this is still inside the click) */
  }
  bPlay.onclick = doPlay;
  bReady.onclick = function () { myReady = !myReady; send({ t: 'state', ready: myReady }); render(); };
  bBack.onclick = function () { disconnect(); closeLobby(); };
  /* typing in the chat line must not reach the game's own keys (T = search, and so on): handled here in the capture phase */
  addEventListener('keydown', function (e) {
    if (e.target !== inp) return;
    e.stopImmediatePropagation();
    if (e.key === 'Enter') { var t = clean(inp.value); if (t) { send({ t: 'chat', m: t }); say(ME, t); } inp.value = ''; e.preventDefault(); }
  }, true);
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lobby.hidden) { bBack.click(); e.stopImmediatePropagation(); } }, true);

  window.__LOBBY = {
    cfg: cfg, playing: false,
    active: function () { return !!(ws && ws.readyState === 1 && authed && !owned); },
    /* online.js calls this once the world is built: it gets the very same connection (already logged in) */
    takeOver: function () { if (!this.active()) return null; owned = true; clearInterval(pingT); var w = ws; w.onmessage = null; w.onclose = null; return w; },
    open: openLobby, state: function () { return { me: ME, ready: myReady, others: others, go: goFlag }; },
  };

  /* wait for the login, then put the button next to START */
  var ready = window.__LOGIN_READY || Promise.resolve(window.__PLAYER);
  ready.then(function (name) {
    ME = String(name || window.__PLAYER || '').toLowerCase(); if (NAMES.indexOf(ME) < 0) return;
    var st = document.getElementById('start'); if (!st || !st.parentNode) return;
    play = el('button', 'go alt', 'PLAY ONLINE'); play.type = 'button'; play.id = 'playOnline';
    play.onclick = function () { if (play.disabled) return; try { beep(440, 660); } catch (e) {} openLobby(); };
    st.parentNode.insertBefore(play, st.nextSibling);
  });
})();
