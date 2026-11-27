/* KVENT animations (job kventanim): Witcher-3-Gwent-style motion, plain DOM + CSS transforms/opacity + Web Animations (FLIP-style flights).
   Purely cosmetic: it only READS the DOM before/after each render() and the engine events; it never touches game state, G.busy or input.
   Hooks (ui.js): render() calls KUI.anim.before()/after(); afterAct() calls KUI.anim.events(S.ev); startMatch() calls KUI.anim.matchStart().
   Speed: button "Anim" in the top bar cycles normal / fast / off (saved in localStorage kvent.animspeed). prefers-reduced-motion => off unless the player chose a speed.
   Any click / key / touch finishes every running animation instantly. Nothing blocks input (ghosts are pointer-events:none). No filters, no audio. */
(function(){
'use strict';
const KUI=window.KUI;if(!KUI)return;
const $=KUI.$,$$=KUI.$$,G=KUI.G,LS=KUI.LS;
const MUL={normal:1,fast:.5,off:0},ORDER=['normal','fast','off'];
const RM=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
let mode=LS.get('kvent.animspeed',null);
function mul(){if(mode&&MUL[mode]!=null)return MUL[mode];return RM.matches?0:1;}
const A=KUI.anim={mul,get mode(){return mode||(RM.matches?'off':'normal');}};
/* ---------- CSS ---------- */
const css=`
#kvfx{position:fixed;inset:0;pointer-events:none;z-index:36;overflow:hidden}
#kvfx *{pointer-events:none}
.kvg{will-change:transform,opacity}
.kvhorn,.kvthaw{position:absolute;inset:0;overflow:hidden;border-radius:8px;pointer-events:none;z-index:4}
.kvhorn i{position:absolute;top:0;bottom:0;left:0;width:38%;background:linear-gradient(90deg,transparent,rgba(255,226,120,.85) 45%,rgba(255,250,210,.95) 55%,transparent);will-change:transform}
.rb.kva .wxo{background:none!important;overflow:hidden;border-radius:8px}
.kvw{position:absolute;display:block;pointer-events:none;will-change:transform}
.kvfrost{inset:0;background:linear-gradient(180deg,rgba(210,240,255,.42),rgba(210,240,255,.07) 35% 65%,rgba(210,240,255,.42));box-shadow:inset 0 0 16px 3px rgba(230,248,255,.75);animation:kvtw 2.6s ease-in-out infinite alternate;will-change:opacity}
@keyframes kvtw{from{opacity:.62}to{opacity:1}}
.kvsnow{left:0;top:-60px;right:-60px;bottom:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cg fill='%23fff' fill-opacity='.88'%3E%3Ccircle cx='8' cy='12' r='1.7'/%3E%3Ccircle cx='34' cy='6' r='1.1'/%3E%3Ccircle cx='50' cy='30' r='1.9'/%3E%3Ccircle cx='20' cy='44' r='1.3'/%3E%3Ccircle cx='42' cy='54' r='1'/%3E%3C/g%3E%3C/svg%3E");animation:kvsnow 5.5s linear infinite}
@keyframes kvsnow{to{transform:translate(-60px,60px)}}
.kvfog{top:0;bottom:0;left:0;width:200%;background:radial-gradient(ellipse 32% 62% at 25% 55%,rgba(228,234,240,.68),transparent 72%),radial-gradient(ellipse 26% 50% at 75% 38%,rgba(228,234,240,.52),transparent 72%);background-size:50% 100%;animation:kvfog 17s linear infinite}
.kvfog.b{top:18%;opacity:.65;animation-duration:26s;animation-direction:reverse}
@keyframes kvfog{to{transform:translateX(-50%)}}
.kvrain{left:0;right:0;top:-40px;bottom:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='40'%3E%3Cg stroke='%239ccbff' stroke-opacity='.85' stroke-width='1.4' stroke-linecap='round'%3E%3Cline x1='6' y1='2' x2='3' y2='14'/%3E%3Cline x1='18' y1='22' x2='15' y2='34'/%3E%3C/g%3E%3C/svg%3E");animation:kvrain .55s linear infinite;background-color:rgba(70,110,180,.12)}
@keyframes kvrain{to{transform:translateY(40px)}}
.kvthawin{position:absolute;inset:0;will-change:transform}
.kvwarm{position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,214,140,.75),transparent);will-change:transform}
.kvflame{position:absolute;left:-8%;right:-8%;bottom:-6%;height:78%;pointer-events:none;background:radial-gradient(ellipse 45% 70% at 28% 100%,#ffe27a 0,#ff8a1f 45%,rgba(220,50,10,0) 75%),radial-gradient(ellipse 40% 85% at 70% 100%,#ffd05a 0,#ff6a14 48%,rgba(200,40,10,0) 76%);transform-origin:50% 100%;animation:kvfl .16s ease-in-out infinite alternate;will-change:transform}
@keyframes kvfl{from{transform:scale(1,.82) skewX(-4deg)}to{transform:scale(1.08,1.12) skewX(4deg)}}
.kvchar{position:absolute;inset:0;background:#0b0705;opacity:0;pointer-events:none}
.kvcrack{position:absolute;inset:0;width:100%;height:100%}
#kvcoin{position:fixed;left:50%;top:30%;width:92px;height:92px;margin:-46px 0 0 -46px;z-index:45;perspective:600px;pointer-events:none}
#kvcoin .cn{position:absolute;inset:0;transform-style:preserve-3d}
#kvcoin .fc{position:absolute;inset:0;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-items:center;font-size:44px;font-weight:900;color:#5a3a06;background:radial-gradient(circle at 34% 28%,#fff3b0,#f2c230 45%,#b57d10 85%);border:4px solid #8a5a0a;box-shadow:0 4px 14px rgba(0,0,0,.55),inset 0 0 0 4px rgba(255,235,150,.55)}
#kvcoin .fc.bk{transform:rotateY(180deg);background:radial-gradient(circle at 34% 28%,#e9eef5,#aab6c8 45%,#6c7a92 85%);border-color:#4b5870;color:#27324a}
#kvcoin .lb{position:absolute;left:50%;top:112px;transform:translateX(-50%);white-space:nowrap;background:rgba(10,8,20,.82);color:#ffe9a8;font-weight:800;padding:4px 12px;border-radius:999px;border:2px solid #f2c230;opacity:0}
.kvscore{display:inline-block}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
/* ---------- registry ---------- */
const act=new Set();
function reg(cleanup){const o={done:false,anims:[],fin(){if(o.done)return;o.done=true;act.delete(o);for(const a of o.anims){try{a.cancel();}catch(e){}}try{cleanup&&cleanup();}catch(e){}}};
  act.add(o);o.t=setTimeout(o.fin,3500);return o;}
function finishAll(){for(const o of [...act])o.fin();}
A.finishAll=finishAll;
function go(o){const p=o.anims.map(a=>a.finished.catch(()=>{}));Promise.all(p).then(o.fin);}
function an(o,el,kf,opt){const a=el.animate(kf,opt);o.anims.push(a);return a;}
let fxl=null;function layer(){if(!fxl||!fxl.isConnected){fxl=document.createElement('div');fxl.id='kvfx';document.body.appendChild(fxl);}return fxl;}
const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height};};
const cx=r=>r.left+r.width/2,cy=r=>r.top+r.height/2;
function ghost(src,r,extra){const g=src.cloneNode(true);g.classList.remove('new','tgt','sel','kf','hl','dim');g.classList.add('kvg');g.removeAttribute('data-fk');g.removeAttribute('draggable');g.onclick=null;
  g.style.cssText='--cw:'+r.width+'px;position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;margin:0;transform-origin:0 0;'+(extra||'');layer().appendChild(g);return g;}
const T=(dx,dy,s,rot)=>'translate('+dx+'px,'+dy+'px) scale('+s+')'+(rot?' rotate('+rot+'deg)':'');
const EASE='cubic-bezier(.2,.85,.25,1)';
/* ---------- snapshot before render ---------- */
let P=null,EV=[];
A.events=function(ev){EV=(ev||[]).slice();};

let P0=null,EV0=[],T0=0;
A.before=function(){finishAll();if(mul()===0){P=null;return;}
  /* afterAct() renders twice in a row (render + refresh): the second render reuses the first snapshot so the same animations simply restart on the fresh DOM */
  if(P0&&performance.now()-T0<150){P=P0;EV=EV0;return;}
  const p={hand:new Map(),cards:new Map(),rows:{},nums:new Map()};
  for(const e of $$('#hand .kc'))if(e.dataset.uid!=null)p.hand.set(e.dataset.uid,{el:e,r:rect(e)});
  for(const rb of $$('#board .rb')){const key=rb.dataset.side+rb.dataset.row;const m=rb.className.match(/wx-(\w+)/);
    p.rows[key]={horned:rb.classList.contains('horned'),wx:m?m[1]:null};
    for(const e of $$('.ru .kc,.hs .kc',rb))if(e.dataset.uid!=null){const pw=$('.pw',e);p.cards.set(e.dataset.uid,{el:e,r:rect(e),side:rb.dataset.side,pw:pw?pw.textContent:null,hs:!!e.closest('.hs')});}
    const b=$('.rs b',rb);if(b)p.nums.set('r'+key,b.textContent);}
  for(const s of ['#pOpp','#pMe']){const t=$(s+' .tot');if(t)p.nums.set(s,t.textContent);p[s]=$$(s+' .hearts>.gem').length;}
  P=p;};
/* ---------- after render ---------- */
A.after=function(){const ev=EV;EV=[];const p=P;P=null;P0=p;EV0=ev;T0=performance.now();
  if(ev.some(e=>e.t==='round')&&G.S&&G.S.round===1&&G.S.log.some(x=>/^Coin toss/.test(x)))setTimeout(A.matchStart,0);
  try{weatherLayers(p);if(!p||mul()===0)return;
    const nfl=flights(p,ev);gone(p,ev);horn(p);buffs(p);ticks(p,nfl);gems(p);}catch(e){try{console.warn('kvent anim',e);}catch(x){}}};
/* ---- weather overlays (always present when the row has weather; the creep-in/thaw only when animating) ---- */
function wxHTML(k){const d=()=>'animation-delay:-'+Math.floor(performance.now()%20000)+'ms';
  if(k==='frost')return '<i class="kvw kvfrost"></i><i class="kvw kvsnow" style="'+d()+'"></i>';
  if(k==='fog')return '<i class="kvw kvfog" style="'+d()+'"></i><i class="kvw kvfog b" style="'+d()+'"></i>';
  return '<i class="kvw kvrain" style="'+d()+'"></i>';}
function weatherLayers(p){const m=mul(),k=1;
  for(const rb of $$('#board .rb')){const c=rb.className.match(/wx-(\w+)/),key=rb.dataset.side+rb.dataset.row,was=p&&p.rows[key]?p.rows[key].wx:null;
    if(c&&m>0){const w=$('.wxo',rb);if(!w)continue;rb.classList.add('kva');w.innerHTML=wxHTML(c[1]);
      if(p&&was!==c[1]){const o=reg(null);an(o,w,[{clipPath:'inset(0 100% 0 0)',opacity:.2},{clipPath:'inset(0 0 0 0)',opacity:1}],{duration:650*m,easing:'ease-out'});go(o);}}
    else if(!c&&was&&m>0){const wrap=document.createElement('div');wrap.className='kvthaw';wrap.innerHTML='<div class="kvthawin">'+wxHTML(was)+'</div><i class="kvwarm"></i>';rb.appendChild(wrap);
      const o=reg(()=>wrap.remove());const W=rb.clientWidth;
      an(o,$('.kvthawin',wrap),[{transform:'translateX(0)',opacity:1},{transform:'translateX('+(W*1.05)+'px)',opacity:0}],{duration:700*m,easing:'ease-in',fill:'forwards'});
      an(o,$('.kvwarm',wrap),[{transform:'translateX(-100%)',opacity:1},{transform:'translateX('+(W*3.4)+'px)',opacity:0}],{duration:700*m,easing:'ease-in',fill:'forwards'});go(o);}}}
/* ---- flights: hand -> row slot, AI plays from the enemy panel, spy slide, medic from the discard, muster cascade, specials to the board centre ---- */
function srcRect(side,p,uid){const h=p.hand.get(String(uid));if(h&&String(side)===String(G.view))return h.r;const el=$(String(side)===String(G.view)?'#pMe':'#pOpp');const r=rect(el);return{left:r.left+r.width/2-20,top:r.top+r.height/2-28,width:40,height:56};}
function discRect(side){const el=String(side)===String(G.view)?$('#btnDisc'):$('#pOpp');const r=rect(el);return{left:r.left+r.width/2-20,top:r.top+r.height/2-28,width:40,height:56};}
function flights(p,ev){const m=mul();let n=0;const S=G.S;const played=new Map();for(const e of ev)if(e.t==='play')played.set(String(e.uid),e);
  const medic=ev.some(e=>e.t==='medic');
  const fresh=$$('#board .ru .kc,#board .hs .kc').filter(e=>e.dataset.uid!=null&&!p.cards.has(e.dataset.uid));
  const main=[],rest=[];for(const e of fresh)(played.has(e.dataset.uid)?main:rest).push(e);
  const mainR=[];
  for(const e of main){const pe=played.get(e.dataset.uid),side=pe.p;const sr=srcRect(side,p,e.dataset.uid),dr=rect(e);mainR.push(dr);
    const spy=pe.kind==='spy';fly(e,sr,dr,{dur:(spy?520:380)*m,delay:0,glow:spy?'#a77bff':null,tilt:spy?-7:0,lift:true});n++;}
  const base=main.length?330*m:0;
  const step=Math.min(80*m,420*m/Math.max(1,rest.length));
  rest.forEach((e,i)=>{const dr=rect(e);const side=e.closest('.rb')?e.closest('.rb').dataset.side:G.view;
    if(medic){const sr=discRect(side);fly(e,sr,dr,{dur:560*m,delay:i*step,glow:'#7dff9a',grow:true});}
    else if(mainR.length){fly(e,mainR[0],dr,{dur:360*m,delay:base+i*step,glow:'#ffd84a'});}
    else{const o=reg(null);an(o,e,[{transform:'scale(.6)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:280*m,delay:i*step,easing:EASE,fill:'backwards'});go(o);}
    n++;});
  /* specials that leave no card on the board: weather / scorch / clear / decoy-like: fly to the centre of the board and dissolve */
  for(const [uid,pe] of played){if(fresh.some(e=>e.dataset.uid===uid))continue;if(['unit','muster','spy','medic','bond','morale','horn'].includes(pe.kind)&&!/^(frost|fog|rain|clear|scorch)/.test(pe.kind))continue;
    const h=p.hand.get(uid);let sr,node=null;
    if(h&&pe.p===G.view){sr=h.r;node=h.el;}else{const c=findCard(S,uid);if(!c)continue;node=KUI.cardEl({id:c.id,uid:c.uid});const r0=rect($(pe.p===G.view?'#pMe':'#pOpp'));sr={left:r0.left+r0.width/2-30,top:r0.top+r0.height/2-42,width:60,height:84};}
    const b=rect($('#board'));const w=sr.width;const k=1.25,ex=cx(b)-w*k/2,ey=cy(b)-sr.height*k/2;
    const g=ghost(node,sr,'z-index:2;');const col=/scorch/.test(pe.kind)?'#ff7a1a':(pe.kind==='clear'?'#ffd68a':'#8fd0ff');g.style.boxShadow='0 0 18px 6px '+col;
    const o=reg(()=>g.remove());
    an(o,g,[{transform:'none',opacity:1},{transform:T(ex-sr.left,ey-sr.top,k),opacity:1,offset:.55},{transform:T(ex-sr.left,ey-sr.top,k*1.4),opacity:1,offset:.75},{transform:T(ex-sr.left,ey-sr.top,k*1.9),opacity:0}],{duration:760*m,easing:'ease-out',fill:'forwards'});go(o);n++;}
  return n;}
function findCard(S,uid){for(const q of S.players){const c=q.discard.find(x=>String(x.uid)===String(uid))||q.hand.find(x=>String(x.uid)===String(uid));if(c)return c;}return S.weatherCards.find(x=>String(x.uid)===String(uid))||null;}
function fly(e,sr,dr,o){const m=1;const g=ghost(e,dr,'z-index:3;');e.style.visibility='hidden';e.classList.remove('new');
  const s=sr.width/dr.width,dx=sr.left-dr.left,dy=sr.top-dr.top;
  const od=reg(()=>{g.remove();e.style.visibility='';if(e.isConnected)try{e.animate([{transform:'scale(1.09)'},{transform:'none'}],{duration:130});}catch(x){}});
  const from=o.grow?T(dx+sr.width*.2,dy+sr.height*.2,s*.6):T(dx,dy,s);
  const kf=[{transform:from,opacity:o.grow?0:1,boxShadow:o.glow?'0 0 14px 5px '+o.glow:'0 8px 18px rgba(0,0,0,.55)'},{transform:o.tilt?T(dx*.45,dy*.45-14,Math.max(s,1)*1.05,o.tilt):T(dx*.3,dy*.3-(o.lift?16:0),(s+1)/2*1.04),opacity:1,offset:.55,boxShadow:o.glow?'0 0 16px 6px '+o.glow:'0 10px 20px rgba(0,0,0,.5)'},{transform:'none',opacity:1,boxShadow:'0 2px 6px rgba(0,0,0,.45)'}];
  an(od,g,kf,{duration:Math.max(1,o.dur),delay:o.delay||0,easing:EASE,fill:'both'});go(od);}
/* ---- cards that vanished: blaze (burn), returned to a hand (decoy), or swept to the discard pile (round end) ---- */
function gone(p,ev){const m=mul();const now=new Set($$('#board .kc').map(e=>e.dataset.uid));const burn=new Set();for(const e of ev)if(e.t==='scorch')for(const u of e.uids)burn.add(String(u));
  const handNow=new Map($$('#hand .kc').map(e=>[e.dataset.uid,e]));let sw=0;const lost=[];
  for(const [uid,c] of p.cards)if(!now.has(uid))lost.push([uid,c]);
  const sweepN=lost.filter(([u])=>!burn.has(u)).length,step=Math.min(45*m,420*m/Math.max(1,sweepN));
  for(const [uid,c] of lost){const dst=discRect(c.side);
    if(burn.has(uid)){const g=ghost(c.el,c.r,'z-index:3;');const fl=document.createElement('i');fl.className='kvflame';const ch=document.createElement('i');ch.className='kvchar';g.appendChild(ch);g.appendChild(fl);fl.style.opacity='0';
      const o=reg(()=>g.remove());const D=1100*m,dl=380*m;
      an(o,g,[{transform:'none',opacity:1,boxShadow:'0 0 0 0 #ff8a1f',offset:0},{transform:'scale(1.06)',opacity:1,boxShadow:'0 0 16px 7px #ff8a1f',offset:.22},{transform:'scale(1.04)',opacity:1,boxShadow:'0 0 18px 8px #ff5a10',offset:.62},{transform:T(dst.left-c.r.left,dst.top-c.r.top,.45,8),opacity:0,boxShadow:'0 0 6px 2px #5a1a08'}],{duration:D,delay:dl,easing:'ease-in',fill:'both'});
      an(o,fl,[{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.6},{opacity:0}],{duration:D,delay:dl,fill:'both'});
      an(o,ch,[{opacity:0},{opacity:.15,offset:.2},{opacity:.85,offset:.6},{opacity:.9}],{duration:D,delay:dl,fill:'both'});go(o);continue;}
    const hn=handNow.get(uid);const to=hn?rect(hn):dst;
    if(hn){hn.style.visibility='hidden';}
    const g=ghost(c.el,c.r,'z-index:2;');const o=reg(()=>{g.remove();if(hn)hn.style.visibility='';});
    const dx=to.left-c.r.left,dy=to.top-c.r.top,s=to.width/c.r.width;
    if(hn)an(o,g,[{transform:'none',opacity:1},{transform:T(dx,dy,s),opacity:1}],{duration:380*m,easing:EASE,fill:'both'});
    else{const sd=sw++*step;an(o,g,[{transform:'none',opacity:1},{transform:T(dx*.15,dy*.15,1,-2),opacity:1,offset:.2},{transform:T(dx,dy,.5,10),opacity:0}],{duration:520*m,delay:sd,easing:'cubic-bezier(.5,0,.8,.5)',fill:'both'});}
    go(o);}}
/* ---- horn: golden flash across the row ---- */
function horn(p){const m=mul();for(const rb of $$('#board .rb.horned')){const key=rb.dataset.side+rb.dataset.row;if(p.rows[key]&&p.rows[key].horned)continue;
  const wrap=document.createElement('div');wrap.className='kvhorn';wrap.innerHTML='<i></i>';rb.appendChild(wrap);const W=rb.clientWidth;const o=reg(()=>wrap.remove());
  an(o,$('i',wrap),[{transform:'translateX(-100%)',opacity:1},{transform:'translateX('+(W/.38)+'px)',opacity:.9}],{duration:650*m,easing:'ease-in-out',fill:'forwards'});
  an(o,rb,[{boxShadow:'0 0 0 0 rgba(255,216,74,0)'},{boxShadow:'0 0 14px 4px rgba(255,216,74,.8)',offset:.4},{boxShadow:'0 0 0 0 rgba(255,216,74,0)'}],{duration:700*m});go(o);}}
/* ---- Tight Bond / Cheer / Horn: cards whose power went up pulse green; weather drops flash red ---- */
function buffs(p){const m=mul();let i=0;for(const [uid,c] of p.cards){const e=$('#board .kc[data-uid="'+uid+'"]');if(!e||c.hs)continue;const pw=$('.pw',e);if(!pw||c.pw==null)continue;const a=parseInt(c.pw,10),b=parseInt(pw.textContent,10);if(isNaN(a)||isNaN(b)||a===b)continue;
    const up=b>a,col=up?'rgba(120,255,150,.95)':'rgba(255,90,70,.9)';const o=reg(null);const d=Math.min(i++*40,240)*m;
    an(o,e,up?[{transform:'none',boxShadow:'0 0 0 0 '+col},{transform:'scale(1.12)',boxShadow:'0 0 12px 5px '+col,offset:.35},{transform:'none',boxShadow:'0 0 0 0 '+col}]:[{transform:'none',boxShadow:'0 0 0 0 '+col},{transform:'translateX(-2px)',boxShadow:'0 0 8px 3px '+col,offset:.2},{transform:'translateX(2px)',offset:.4},{transform:'none',boxShadow:'0 0 0 0 '+col}],{duration:(up?520:380)*m,delay:d,easing:'ease-out'});
    an(o,pw,[{transform:'scale(1)'},{transform:'scale(1.5)',offset:.4},{transform:'scale(1)'}],{duration:520*m,delay:d});go(o);}}
/* ---- numbers tick up/down with a colour flash ---- */
function ticks(p,nfl){const m=mul();const dl=nfl?300*m:0;
  const list=[];for(const rb of $$('#board .rb')){const b=$('.rs b',rb);if(b)list.push(['r'+rb.dataset.side+rb.dataset.row,b]);}for(const s of ['#pOpp','#pMe']){const t=$(s+' .tot');if(t)list.push([s,t]);}
  for(const [k,el] of list){const o=p.nums.get(k);if(o==null||o===el.textContent)continue;const a=parseInt(o,10),b=parseInt(el.textContent,10);if(isNaN(a)||isNaN(b))continue;tick(el,a,b,dl,380*m);}}
function tick(el,from,to,delay,dur){const col=to>from?'#2fd06b':'#ff6a5a';const ob=reg(()=>{el.textContent=to;el.style.color='';});el.textContent=from;el.style.color=col;
  an(ob,el,[{transform:'scale(1)'},{transform:'scale(1.4)',offset:.3},{transform:'scale(1)'}],{duration:dur+250,delay,easing:'ease-out'});
  const t0=performance.now()+delay,hold=260;
  (function step(){if(ob.done)return;const t=performance.now()-t0;if(t<0){requestAnimationFrame(step);return;}
    if(t>=dur+hold){ob.fin();return;}if(t<dur){const x=t/dur;el.textContent=Math.round(from+(to-from)*(1-(1-x)*(1-x)));}else el.textContent=to;requestAnimationFrame(step);})();}
/* ---- round gems crack and fall ---- */
function gems(p){const m=mul();for(const s of ['#pOpp','#pMe']){const before=p[s],nowN=$$(s+' .hearts>.gem').length;if(before==null||nowN>=before)continue;
  const lost=$(s+' .hearts .x .gem');if(!lost)continue;const r=rect(lost);
  const mk=clip=>{const h=document.createElement('div');h.className='hearts kvg';h.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;margin:0;letter-spacing:0;font-size:0;line-height:0;'+(clip?'clip-path:'+clip+';':'');
    h.innerHTML='<i class="gem" style="display:block;width:'+r.width+'px;height:'+r.height+'px"></i>';layer().appendChild(h);return h;};
  const L=mk('polygon(0 0,56% 0,42% 50%,58% 100%,0 100%)'),R=mk('polygon(56% 0,100% 0,100% 100%,58% 100%,42% 50%)');
  const crack=document.createElementNS('http://www.w3.org/2000/svg','svg');crack.setAttribute('class','kvcrack');crack.setAttribute('viewBox','0 0 10 10');crack.setAttribute('preserveAspectRatio','none');crack.innerHTML='<polyline points="5.6,0 4.2,3.4 5.8,5 4.2,10" fill="none" stroke="#fff6d8" stroke-width="1.2"/>';
  const cr=document.createElement('div');cr.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';cr.appendChild(crack);layer().appendChild(cr);
  const o=reg(()=>{L.remove();R.remove();cr.remove();});const D=900*m;
  const shake=[{transform:'none',offset:0},{transform:'translateX(-1.5px) scale(1.18)',offset:.12},{transform:'translateX(1.5px) scale(1.18)',offset:.22},{transform:'translateX(-1px) scale(1.18)',offset:.32},{transform:'scale(1.12)',offset:.42}];
  L.style.transformOrigin=R.style.transformOrigin='50% 50%';
  an(o,L,shake.concat([{transform:'translate(-7px,26px) rotate(-34deg) scale(1)',opacity:0,offset:1}]),{duration:D,easing:'ease-in',fill:'both'});
  an(o,R,shake.concat([{transform:'translate(8px,30px) rotate(38deg) scale(1)',opacity:0,offset:1}]),{duration:D,easing:'ease-in',fill:'both'});
  an(o,cr,[{opacity:0,transform:'none'},{opacity:1,offset:.14,transform:'scale(1.18)'},{opacity:1,offset:.42,transform:'scale(1.12)'},{opacity:0,offset:.55,transform:'scale(1.12)'},{opacity:0}],{duration:D,fill:'both'});go(o);}}
/* ---------- coin flip at match start ---------- */
A.matchStart=function(){const m=mul();if(!m||G.tut||$('#kvcoin'))return;const S=G.S;if(!S||S.round!==1)return;if(!S.log.some(x=>/^Coin toss/.test(x)))return;
  const you=S.first===G.view,nm=you?'You start':S.players[S.first].name+' starts';
  const c=document.createElement('div');c.id='kvcoin';c.innerHTML='<div class="cn"><div class="fc">❄</div><div class="fc bk">★</div></div><div class="lb"></div>';$('.lb',c).textContent=nm;document.body.appendChild(c);
  const o=reg(()=>c.remove());const cn=$('.cn',c);const turns=you?1800:1980;
  an(o,cn,[{transform:'rotateY(0deg)'},{transform:'rotateY('+turns+'deg)'}],{duration:1100*m,easing:'cubic-bezier(.2,.6,.3,1)',fill:'forwards'});
  an(o,c,[{transform:'translateY(60px) scale(.5)',opacity:0,offset:0},{transform:'translateY(-90px) scale(1.15)',opacity:1,offset:.45},{transform:'translateY(0) scale(1)',opacity:1,offset:.9},{transform:'translateY(0) scale(1)',opacity:1,offset:1}],{duration:1100*m,easing:'ease-out',fill:'forwards'});
  const lb=$('.lb',c);an(o,lb,[{opacity:0},{opacity:1}],{duration:250*m,delay:1000*m,fill:'forwards'});
  const fade=an(o,c,[{opacity:1},{opacity:0}],{duration:350*m,delay:1900*m,fill:'forwards'});o.anims.push(fade);go(o);};
/* ---------- speed button + skip ---------- */
function btn(){const t=$('#topbar');if(!t||$('#btnAnim'))return;const b=document.createElement('button');b.id='btnAnim';b.title='Card animation speed (click anywhere to skip an animation)';
  const lab=()=>{b.textContent='Anim: '+A.mode;};lab();b.onclick=()=>{const i=ORDER.indexOf(A.mode);mode=ORDER[(i+1)%3];LS.set('kvent.animspeed',mode);finishAll();lab();};
  const mu=$('#btnMute');t.insertBefore(b,mu||null);}
btn();
for(const ev of ['pointerdown','keydown','touchstart'])document.addEventListener(ev,()=>{if(act.size)finishAll();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishAll();});
A.setMode=m=>{mode=ORDER.includes(m)?m:null;if(mode)LS.set('kvent.animspeed',mode);const b=$('#btnAnim');if(b)b.textContent='Anim: '+A.mode;};
})();
