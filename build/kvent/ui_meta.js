/* KVENT meta layer (job cardgame): opponents' lines + standing, card packs + opening ceremony, collection limits, ladder, online (Friends) UI, host bridge to the game.
   Loaded after ui.js / ui_extra.js. Everything here is DOM + localStorage in the iframe; no per-frame work. Pure data logic lives in collection.js / net.js. */
(function(){
'use strict';
const U=window.KUI,K=U.K,M=U.M,$=U.$,$$=U.$$,LS=U.LS,esc=U.esc,G=U.G,Q=new URLSearchParams(location.search),EMBED=U.EMBED;
const CO=window.KventColl,NET=window.KventNet,ART=window.KventArt;
const FN={town:'Town Folk',rod:'Rødnisser',blaa:'Blånisser',natt:'Night Creatures',fjord:'Fjord Folk',neutral:'Neutral'};
const FACS=['town','rod','blaa','natt','fjord'];
const FRIENDS=['Marius','Chris','Martin'];
const lang=()=>LS.get('kvent.lang','en')==='no'?1:0;
const player=()=>Q.get('player')||LS.get('kvent.profile','Marius');
const collKey=()=>'kvent.coll.v1.'+player();
const getC=()=>CO.norm(LS.get(collKey(),{cards:{},wins:{}}));
const putC=C=>LS.set(collKey(),C);
const OPP=()=>U.OPP||[];const oppById=id=>OPP().find(o=>o.id===id);
/* ------------------------------------------------------------------ css (phone sizes, packs, ladder, speech bubble) */
{const st=document.createElement('style');st.textContent=`
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.tabs button{padding:8px 14px}
.portrait{width:56px;height:64px;image-rendering:pixelated;border-radius:8px;border:2px solid var(--acc);background:#222;flex:none}.portrait.sm{width:34px;height:39px;border-width:1px;border-radius:5px}
.oppcard{display:flex;gap:12px;align-items:center}.oppcard .sub{margin:0}
.warn{color:var(--no);font-weight:700}.okc{color:var(--ok);font-weight:700}
.bar{height:8px;background:var(--chip);border-radius:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--acc)}
#oppSay{position:fixed;left:50%;top:46px;transform:translateX(-50%);z-index:30;max-width:70%;display:none;align-items:center;gap:8px;background:#fff;color:#1a1420;border:3px solid #111;border-radius:12px;padding:5px 12px 6px 6px;font:700 13px/1.25 system-ui;box-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none}#oppSay.on{display:flex;animation:pop .3s}
#oppSay b{display:block;font-size:10px;color:#b4640a}
.packrow{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}.packbox{width:116px;text-align:center}.packbox img.pk{width:84px;height:108px;image-rendering:pixelated;cursor:pointer;filter:drop-shadow(0 4px 4px rgba(0,0,0,.4));transition:transform .15s}.packbox img.pk:hover{transform:translateY(-4px) rotate(-2deg)}
.packbox .sub{font-size:12px}
.pkstage{display:flex;flex-direction:column;align-items:center;gap:10px;min-height:260px;justify-content:center}
.pkbig{width:150px;height:192px;image-rendering:pixelated;cursor:pointer;animation:pkbob 1.3s ease-in-out infinite;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))}.pkbig.tear{animation:pktear .55s forwards}
@keyframes pkbob{50%{transform:translateY(-8px) rotate(2deg)}}@keyframes pktear{0%{transform:scale(1)}30%{transform:scale(1.15) rotate(-6deg)}60%{transform:scale(1.25) rotate(5deg)}100%{transform:scale(1.9);opacity:0;filter:brightness(3)}}
.pcards{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}.pcard{--cw:86px;width:var(--cw);height:calc(var(--cw)*1.4 + 20px);perspective:700px;cursor:pointer;position:relative}
.pcard .in{position:absolute;inset:0 0 20px 0;transform-style:preserve-3d;transition:transform .5s}.pcard.flip .in{transform:rotateY(180deg)}
.pcard .fr,.pcard .bk{position:absolute;inset:0;backface-visibility:hidden}.pcard .bk{transform:rotateY(0)}.pcard .fr{transform:rotateY(180deg)}
.pcard .bk .kc{--cw:inherit}.pcard .tag{position:absolute;left:0;right:0;bottom:0;height:20px;text-align:center;font-size:11px;font-weight:800;opacity:0;transition:opacity .3s .35s}.pcard.flip .tag{opacity:1}
.pcard.r-rare.flip{filter:drop-shadow(0 0 7px #4aa8ff)}.pcard.r-legend.flip{filter:drop-shadow(0 0 10px #ffd84a)}.pcard.r-leader.flip{filter:drop-shadow(0 0 9px #c07aff)}
.tag.new{color:#ffd84a}.tag.cp{color:var(--ok)}.tag.sold{color:var(--dim)}
.lrow{display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid var(--line)}.lrow .nm{flex:1;min-width:0}.lrow .rec{font-weight:800;white-space:nowrap}
.lrow.locked{opacity:.55}.tier{margin:16px 0 4px;font-weight:800;color:var(--acc)}
.chip2{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;background:var(--chip);margin-left:4px}
.chip2.f{background:#1f9d55;color:#fff}.chip2.h{background:#c0392b;color:#fff}.chip2.b{background:#b4640a;color:#fff}
.onl .tile{margin-top:8px}.onl input[type=text],.onl input[type=password]{min-width:0}
.mrowo{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.mrowo .t{flex:1;min-width:140px}
.cnt.lock{background:#555}
.kc.unowned{filter:grayscale(1) brightness(.55)}
@media (max-width:900px) and (orientation:landscape),(max-height:520px){
 .wrap{padding:8px 10px 30px}.logo{font-size:30px}.tile{padding:8px}.grid4{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
 button,select,input{padding:8px 12px;min-height:40px}
 #oppSay{top:30px;font-size:11px;padding:3px 8px 4px 4px}#oppSay .portrait{width:24px;height:28px}
 .pcard{--cw:64px}.packbox{width:96px}.pkbig{width:96px;height:123px}.pkstage{min-height:170px}
}
@media (max-width:600px){
 .wrap{padding:10px 10px 40px}.logo{font-size:34px}.lrow{flex-wrap:wrap}.pcard{--cw:78px}.pcards{gap:6px}.tabs button{flex:1 1 44%}
}
`;document.head.appendChild(st);}
/* ------------------------------------------------------------------ host bridge (the game page owns the kroner) */
const Host={cash:null,rep:parseRep(Q.get('rep')),rid:0,pending:new Map(),friends:Q.get('friends')};
function parseRep(s){const r={red:0,blue:0};if(s)for(const p of String(s).split(',')){const[k,v]=p.split(':');if(k in r)r[k]=+v||0;}return r;}
Host.ask=function(type,data){return new Promise(res=>{if(!EMBED||parent===window)return res(null);const rid=++Host.rid;Host.pending.set(rid,res);
  try{parent.postMessage(Object.assign({kventEmbed:1,type,rid},data||{}),location.origin);}catch(e){Host.pending.delete(rid);return res(null);}
  setTimeout(()=>{if(Host.pending.delete(rid))res(null);},2500);});};
addEventListener('message',e=>{try{const d=e.data;if(!d||d.kventHost!==1||e.source!==parent)return;if(d.cash!=null)Host.cash=d.cash;if(d.rep)Host.rep=d.rep;
  const r=Host.pending.get(d.rid);if(r){Host.pending.delete(d.rid);r(d);}}catch(er){}});
async function cash(){if(!EMBED)return getC().kr;const r=await Host.ask('kvent-cash');return r&&r.cash!=null?r.cash:(Host.cash!=null?Host.cash:0);}
async function spend(kr){if(!kr)return true;if(!EMBED){const C=getC();if(C.kr<kr)return false;C.kr-=kr;putC(C);return true;}const r=await Host.ask('kvent-spend',{kr});return!!(r&&r.ok);}
function credit(kr){if(kr&&EMBED)Host.ask('kvent-credit',{kr});}
U.Host=Host;U.lang=lang;
/* ------------------------------------------------------------------ lines, standing, gates */
U.lineText=function(o,key){if(!o)return'';if(key==='draw')return lang()?'Uavgjort. Ingen forteller det.':'A draw. Nobody tells.';const l=(o.lines&&o.lines[key])||null;return l?l[lang()]||l[0]:(o[key]||'');};
function standing(o){if(!o||!o.clan)return'neutral';const r=Host.rep||{},mine=r[o.clan]|0,rival=r[o.rival]|0;if(rival>=3&&mine<3)return'shun';if(mine<0)return'hostile';if(mine>=3)return'friend';return'neutral';}
U.standing=standing;
const distinctWins=()=>Object.values(getC().wins).filter(n=>n>0).length;
const unlockAll=()=>Q.get('unlock')==='1'||LS.get('kvent.unlockAll',false);   // dev: skips the 'beat N players' lock only (clan standing still applies)
function gate(o){if(!o)return{ok:true};
  const need=(o.unlock&&o.unlock.wins)||0,have=distinctWins();
  if(have<need&&!unlockAll()){const l=o.lines&&o.lines.refuse&&!o.clan?o.lines.refuse:null;return{ok:false,why:'locked',need,have,text:l?l[lang()]:(lang()?'Slå '+need+' spillere først (du har '+have+').':'Beat '+need+' players first (you have '+have+').')};}
  const st=standing(o);if(st==='shun'||st==='hostile'){const l=o.lines[st==='shun'?'shun':'refuse'];return{ok:false,why:st,text:l?l[lang()]:''};}
  return{ok:true,st};}
U.gate=gate;U.gateBlocks=o=>{const g=gate(o);if(!g.ok)U.toast(g.text,3800);return!g.ok;};
U.escalation=o=>{if(!o||!o.escalate)return[];const n=Math.min(o.escalate.length,getC().wins[o.id]|0);return o.escalate.slice(0,n);};
const portraitSrc=o=>{try{return ART.art(U.DB[o.portrait]||U.DB.n_kare);}catch(e){return'';}};
U.portraitSrc=portraitSrc;
const recOf=id=>{let r={};try{r=JSON.parse(localStorage.getItem('kvent.rec.v1.'+player())||'{}')[id]||{};}catch(e){}const cw=(getC().wins||{})[id]|0;return{w:Math.max(r.w|0,cw),l:r.l|0,d:r.d|0};};
/* ------------------------------------------------------------------ rewards (replaces the old direct-card reward) */
U.reward=function(oppId,won){const o=oppById(oppId),C=getC(),R=CO.reward(C,o,won,{friend:standing(o)==='friend'});if(!EMBED)C.kr+=R.kr;putC(C);return{kr:R.kr,packs:R.packs,cards:R.packs.map(p=>p.id),first:R.first};};
/* ------------------------------------------------------------------ the opponent speech bubble in the game */
let sayT=0;
U.say=function(key){try{if(!G.mt||G.tut)return;const pl=G.mt.header.players;const ai=pl.find(p=>p.kind==='ai');if(!ai)return;const o=oppById(ai.opp);if(!o)return;const t=U.lineText(o,key);if(!t)return;
  let b=$('#oppSay');if(!b){b=document.createElement('div');b.id='oppSay';document.body.appendChild(b);}
  b.innerHTML='<img class="portrait sm" src="'+portraitSrc(o)+'" alt=""><div><b>'+esc(o.name)+'</b>'+esc(t)+'</div>';b.classList.remove('on');void b.offsetWidth;b.classList.add('on');clearTimeout(sayT);sayT=setTimeout(()=>b.classList.remove('on'),3400);}catch(e){}};
/* ------------------------------------------------------------------ pixel pack art */
const PK={std:['#3b5fa8','#f5c542','snow'],clan_rod:['#b8372a','#ffd9a0','hat'],clan_blaa:['#2a52a8','#cfe0ff','hat'],night:['#35254f','#9be8c2','moon'],boss:['#1c1424','#ffd84a','star'],one:['#5a6a4a','#f2e6c0','snow']};
const packCache={};
function packArt(kind){if(packCache[kind])return packCache[kind];const[c1,c2,g]=PK[kind]||PK.std;const W=28,H=36,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const r=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(a,b,w,h);};
  r(2,3,24,31,'#14101c');r(3,4,22,29,c1);r(3,4,22,3,c2);r(3,29,22,3,c2);r(5,9,18,18,'rgba(0,0,0,.25)');r(4,2,20,2,'#14101c');for(let i=0;i<7;i++)r(3+i*3+(i%2),1,2,2,'#14101c');
  const cx=14,cy=18;
  if(g==='snow'){for(const[dx,dy]of[[0,0],[0,-1],[0,1],[0,-2],[0,2],[-1,0],[1,0],[-2,0],[2,0],[-1,-1],[1,1],[-1,1],[1,-1],[-2,-2],[2,2],[-2,2],[2,-2]])r(cx+dx,cy+dy,1,1,c2);}
  else if(g==='hat'){r(10,21,9,3,c2);r(11,16,7,5,c2);r(12,12,5,4,c2);r(13,9,3,3,c2);r(15,8,3,2,c2);r(18,8,2,2,'#fff');r(10,24,9,1,'#fff');}
  else if(g==='moon'){for(let yy=-5;yy<=5;yy++)for(let xx=-5;xx<=5;xx++){const d=xx*xx+yy*yy;if(d<=26&&((xx+2)*(xx+2)+yy*yy)>16)r(cx+xx,cy+yy,1,1,c2);}}
  else{for(const[dx,dy]of[[0,-6],[0,-5],[0,-4],[-1,-3],[1,-3],[-5,-2],[-4,-2],[-3,-2],[-2,-2],[2,-2],[3,-2],[4,-2],[5,-2],[-3,-1],[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],[3,-1],[-2,0],[-1,0],[0,0],[1,0],[2,0],[-2,1],[-1,1],[1,1],[2,1],[-3,2],[-2,2],[2,2],[3,2]])r(cx+dx,cy+dy+1,1,1,c2);}
  r(5,31,18,1,'rgba(255,255,255,.35)');
  return packCache[kind]=cv.toDataURL('image/png');}
/* ------------------------------------------------------------------ views: packs, ladder */
function ensureView(id){let s=$('#v-'+id);if(!s){s=document.createElement('section');s.className='view';s.id='v-'+id;$('#app').appendChild(s);}return s;}
function tabs(active){const n=getC().packs.length;return'<div class="tabs"><button data-go="menu">Menu</button><button data-go="packs" class="'+(active==='packs'?'pri':'')+'">Card packs'+(n?' ('+n+')':'')+'</button><button data-go="builder">My cards &amp; decks</button><button data-go="ladder" class="'+(active==='ladder'?'pri':'')+'">Ladder</button><button data-go="hub">Friends &amp; online</button></div>';}
function wireTabs(v){$$('[data-go]',v).forEach(b=>b.onclick=()=>go(b.dataset.go));}
function go(id){if(id==='menu'){U.showView('menu');U.menu();}else if(id==='builder'){U.showView('builder');U.builder();}else if(id==='hub'){U.showView('hub');U.hub();}else if(id==='packs')U.packs();else if(id==='ladder')U.ladder();}
U.go=go;
U.packs=async function(){const v=ensureView('packs');U.showView('packs');const C=getC();const kr=await cash();const T=CO.totals(C);const st=standing(oppById(Q.get('opponent')));
  const op=oppById(Q.get('opponent'));
  const shop=[{k:'std',where:''}];
  const clan=op&&op.clan&&gate(op).ok?op.pack:null;
  if(clan)shop.push({k:clan,where:op.name});
  const prog=FACS.map(f=>{let have=0,all=0;for(const d of Object.values(K.db())){if(d.faction!==f)continue;const need=d.type==='leader'?1:(d.copies||1);all+=need;have+=Math.min(need,CO.owned(C,d.id));}return'<div style="margin:5px 0"><div class="row" style="justify-content:space-between"><span>'+FN[f]+'</span><span class="sub">'+have+' / '+all+'</span></div><div class="bar"><i style="width:'+Math.round(100*have/all)+'%"></i></div></div>';}).join('');
  v.innerHTML='<div class="wrap">'+tabs('packs')+'<div class="row" style="justify-content:space-between"><h2>Card packs</h2><div><b>'+kr+' kr</b> <span class="sub">'+(EMBED?'in your wallet':'play money (kroner in the game)')+'</span></div></div>'+
   '<p class="sub">Win matches to earn packs, or buy them. Cards you already own the maximum of are sold on the spot ("Duplicate"), so nothing is wasted. Your five ready-made decks are always yours.</p>'+
   '<h3 style="margin-top:14px">Unopened packs</h3>'+(C.packs.length?'<div class="packrow">'+C.packs.map(p=>'<div class="packbox"><img class="pk" data-open="'+p.id+'" data-fk="pk'+p.id+'" src="'+packArt(p.kind)+'" alt="'+esc(CO.PACKS[p.kind].name)+'" tabindex="0"><div class="sub"><b>'+esc(CO.PACKS[p.kind].name)+'</b><br>'+(p.from?'from '+esc((oppById(p.from)||{name:p.from}).name):'')+'</div></div>').join('')+'</div>':'<div class="sub">None. Beat someone at Kvent, or buy one below.</div>')+
   (C.packs.length>1?'<div class="row" style="margin-top:10px"><button class="pri" id="openall" data-fk="openall">Open all ('+C.packs.length+')</button></div>':'')+
   '<h3 style="margin-top:18px">Buy</h3><div class="packrow">'+shop.map(s=>{const P=CO.PACKS[s.k],price=CO.priceOf(s.k,{friend:st==='friend'});return'<div class="packbox"><img class="pk" src="'+packArt(s.k)+'" alt=""><div class="sub"><b>'+esc(P.name)+'</b><br>'+esc(P.desc)+(s.where?'<br>from '+esc(s.where):'')+'</div><button class="pri" data-buy="'+s.k+'" data-fk="buy'+s.k+'" '+(kr<price?'disabled':'')+'>'+price+' kr</button></div>';}).join('')+
   (op&&op.clan&&!clan?'<div class="sub" style="max-width:260px">'+esc(op.name)+' sells clan packs once you are on good terms.</div>':(!op||!op.clan?'<div class="sub" style="max-width:260px">Clan packs (Rødnisser / Blånisser) are sold by the clan chiefs in their caves, cheaper if you are a friend of the clan.</div>':''))+'</div>'+
   '<h3 style="margin-top:18px">Collection '+T.have+' / '+T.all+'</h3>'+prog+'</div>';
  wireTabs(v);
  $$('[data-open]',v).forEach(b=>{b.onclick=()=>ceremony([C.packs.find(p=>p.id===b.dataset.open)]);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')b.click();};});
  const oa=$('#openall',v);if(oa)oa.onclick=()=>ceremony(C.packs.slice());
  $$('[data-buy]',v).forEach(b=>b.onclick=async()=>{const k=b.dataset.buy,price=CO.priceOf(k,{friend:st==='friend'});b.disabled=true;if(!await spend(price)){U.toast('Not enough kroner');return U.packs();}
    const C2=getC();CO.newPack(C2,k,op?op.id:'',7);putC(C2);U.snd('select');U.toast('Bought: '+CO.PACKS[k].name);U.packs();});};
function ceremony(list){list=list.filter(Boolean);if(!list.length)return;let idx=0;const sum={n:0,newc:0,sold:0,kr:0};
  const next=()=>{if(idx>=list.length)return done();const pk=list[idx++];stage1(pk);};
  const done=()=>{U.closeModal();U.packs();};
  function stage1(pk){const P=CO.PACKS[pk.kind];const box=U.openModal('<div class="pkstage"><h2>'+esc(P.name)+'</h2><img class="pkbig" id="pkbig" src="'+packArt(pk.kind)+'" alt=""><div class="sub">Tap the pack to open it</div><button class="pri" id="pktear" data-fk="pktear">Open</button><button data-fk="dx" id="pkx">Later</button></div>','pack');
    const tear=()=>{const img=$('#pkbig',box);if(!img||img.classList.contains('tear'))return;img.classList.add('tear');U.snd('horn',.5);setTimeout(()=>stage2(pk),520);};
    $('#pkbig',box).onclick=tear;$('#pktear',box).onclick=tear;$('#pkx',box).onclick=done;}
  function stage2(pk){const C=getC();const res=CO.openPack(C,pk);if(!res){return next();}putC(C);if(res.kr)credit(res.kr);sum.n+=res.cards.length;sum.kr+=res.kr;res.cards.forEach(c=>{if(c.isNew)sum.newc++;});
    const P=CO.PACKS[pk.kind];let flipped=0;
    const html='<div class="pkstage"><h2>'+esc(P.name)+'</h2><div class="pcards">'+res.cards.map((c,i)=>'<div class="pcard r-'+c.rarity+'" data-i="'+i+'" data-fk="pc'+i+'"><div class="in"><div class="bk" id="bk'+i+'"></div><div class="fr" id="fr'+i+'"></div></div><div class="tag '+(c.sold?'sold':c.isNew?'new':'cp')+'">'+(c.sold?'Duplicate: sold '+c.sold+' kr':c.isNew?'NEW!':c.copy?'+1 copy':'Added')+'</div></div>').join('')+'</div><div class="row"><button id="flipall" data-fk="flipall">Flip all</button><button class="pri" id="pkdone" data-fk="dx">'+(idx<list.length?'Next pack':'Done')+'</button></div><div class="sub" id="pksum"></div></div>';
    const box=U.openModal(html,'pack');
    res.cards.forEach((c,i)=>{const bk=$('#bk'+i,box),fr=$('#fr'+i,box);bk.appendChild(U.cardEl({id:'w_frost'}));$('.kc',bk).classList.add('back');fr.appendChild(U.cardEl({id:c.id}));});
    const sumEl=$('#pksum',box);const upd=()=>{if(flipped===res.cards.length){const nw=res.cards.filter(c=>c.isNew).length,sd=res.cards.filter(c=>c.sold).length;sumEl.textContent=(nw?nw+' new. ':'')+(sd?sd+' duplicate'+(sd>1?'s':'')+' sold for '+res.kr+' kr. ':'')+'Collection '+CO.totals(getC()).have+' / '+CO.totals(getC()).all+'.';}};
    const flip=i=>{const el=$('.pcard[data-i="'+i+'"]',box);if(!el||el.classList.contains('flip'))return;el.classList.add('flip');flipped++;const c=res.cards[i];U.snd(c.rarity==='legend'||c.rarity==='leader'?'matchwin':c.rarity==='rare'?'win':'select',.5);upd();};
    $$('.pcard',box).forEach(el=>el.onclick=()=>flip(+el.dataset.i));
    $('#flipall',box).onclick=()=>{res.cards.forEach((c,i)=>setTimeout(()=>flip(i),i*180));};
    $('#pkdone',box).onclick=()=>{if(idx<list.length)next();else done();};}
  next();}
/* ------- ladder ------- */
U.ladder=function(){const v=ensureView('ladder');U.showView('ladder');const C=getC();const wins=distinctWins();
  const rows=OPP().filter(o=>!o.dev||true);const byTier={};rows.forEach(o=>(byTier[o.tier||1]=byTier[o.tier||1]||[]).push(o));
  const tn={1:'Tier 1: the regulars',2:'Tier 2: the shops',3:'Tier 3: caves and chiefs',4:'Tier 4: the boss'};
  const here=Q.get('opponent');
  const row=o=>{const g=gate(o),R=recOf(o.id),st=standing(o);let badge='';
    if(!g.ok)badge='<span class="chip2 h">'+(g.why==='locked'?'Locked: beat '+g.need:g.why==='shun'?'Shunned':'Unwelcome')+'</span>';else if(R.w)badge='<span class="chip2 f">Beaten</span>';else badge='<span class="chip2 b">Ready</span>';
    if(o.clan)badge+='<span class="chip2'+(st==='friend'?' f':st==='neutral'?'':' h')+'">'+(st==='friend'?'Clan friend':st==='neutral'?'Clan: neutral':st==='shun'?'Clan: rival friend':'Clan: unwelcome')+'</span>';
    const ai=o.personality+' · '+'★'.repeat(o.level||1);
    return'<div class="lrow'+(g.ok?'':' locked')+'"><img class="portrait sm" src="'+portraitSrc(o)+'" alt=""><div class="nm"><b>'+esc(o.name)+'</b> '+badge+'<div class="sub">'+esc(o.place)+' · '+FN[o.faction]+' · '+esc(ai)+'</div></div><div class="rec">'+R.w+' - '+R.l+(R.d?' - '+R.d:'')+'</div>'+
      (EMBED?(here===o.id?'<span class="chip2 b">you are here</span>':''):(g.ok?'<button class="pri" data-pl="'+o.id+'">Play</button>':''))+'</div>';};
  let tw=0,tl=0;rows.forEach(o=>{const R=recOf(o.id);tw+=R.w;tl+=R.l;});
  const fr=C.friends||{};
  v.innerHTML='<div class="wrap">'+tabs('ladder')+'<div class="row" style="justify-content:space-between"><h2>Ladder</h2><div class="sub">Players beaten: <b>'+wins+' / '+rows.length+'</b> · record '+tw+' - '+tl+'</div></div>'+
   Object.keys(byTier).sort().map(t=>'<div class="tier">'+esc(tn[t]||'Tier '+t)+'</div><div class="tile" style="padding:2px 8px">'+byTier[t].map(row).join('')+'</div>').join('')+
   '<div class="tier">Friends (online and hot-seat)</div><div class="tile" style="padding:2px 8px">'+FRIENDS.filter(f=>f.toLowerCase()!==player().toLowerCase()).map(f=>{const r=fr[f]||{w:0,l:0,d:0};return'<div class="lrow"><div class="nm"><b>'+f+'</b></div><div class="rec">'+r.w+' - '+r.l+(r.d?' - '+r.d:'')+'</div></div>';}).join('')+'</div></div>';
  wireTabs(v);$$('[data-pl]',v).forEach(b=>b.onclick=()=>{const o=oppById(b.dataset.pl);const f=LS.get('kvent.myfaction','town');U.startMatch(U.newAIMatch(player(),U.deckOf?U.deckOf(f,true):M.deckFor(f),o));});};
U.recOf=recOf;U.distinctWins=distinctWins;
/* ------------------------------------------------------------------ menu extras */
U.menuExtra=function(v){const wrap=v.querySelector('.wrap');if(!wrap)return;
  const C=getC();const nb=C.packs.length;
  const oid=Q.get('opponent'),o=oppById(oid);
  if(EMBED&&o){const first=wrap.querySelector('.tile');if(first&&first.textContent.indexOf(o.name)>=0)first.remove();
    const g=gate(o),st=standing(o);const txt=g.ok?(st==='friend'&&o.lines.friend?U.lineText(o,'friend'):U.lineText(o,'greet')):g.text;
    wrap.insertAdjacentHTML('afterbegin','<div class="tile oppcard" style="margin-bottom:10px;border-color:var(--acc)"><img class="portrait" src="'+portraitSrc(o)+'" alt=""><div><b>'+esc(o.name)+'</b> <span class="sub">('+esc(o.place)+')</span>'+(o.boss?' <span class="pill">BOSS</span>':'')+(o.clan?' <span class="chip2 '+(st==='friend'?'f':st==='neutral'?'':'h')+'">'+(st==='friend'?'clan friend':st==='neutral'?'clan: neutral':st==='shun'?'rival friend':'unwelcome')+'</span>':'')+'<br><i>&ldquo;'+esc(txt)+'&rdquo;</i>'+(g.ok&&o.escalate&&(C.wins[o.id]|0)?'<div class="sub">She is on plate '+((C.wins[o.id]|0)+1)+' of cookies. Her deck gets stronger every time you beat her.</div>':'')+'</div></div>');
    if(!g.ok)$$('#qf button',v).forEach(b=>{b.disabled=true;});}
  const row=document.createElement('div');row.className='tabs';row.innerHTML='<button data-go="packs" class="pri" data-fk="mpacks">Card packs'+(nb?' ('+nb+' to open)':'')+'</button><button data-go="builder" data-fk="mcards">My cards &amp; decks</button><button data-go="ladder" data-fk="mladder">Ladder</button>'+
    '<button id="mlang" data-fk="mlang" title="Language of the opponents\' lines">Lines: '+(lang()?'Norsk':'English')+'</button>';
  const logo=wrap.querySelector('.row');if(logo)logo.insertAdjacentElement('afterend',row);else wrap.prepend(row);
  wireTabs(row);const ml=$('#mlang',row);ml.onclick=()=>{LS.set('kvent.lang',lang()?'en':'no');U.menu();};
  const sel=$('#qopp',v);if(sel&&!EMBED){sel.innerHTML='<option value="">Random townsperson</option>'+OPP().map(x=>{const g=gate(x);return'<option value="'+x.id+'"'+(g.ok?'':' disabled')+'>'+esc(x.name)+' ('+esc(x.place)+')'+(g.ok?'':' - locked')+'</option>';}).join('');}
  const mh=$('#mHub',v);if(mh)mh.innerHTML='Friends &amp; online, townspeople, hot-seat';};
U.hubExtra=function(v){/* lock gated townspeople, then the online section */
  $$('[data-opp]',v).forEach(b=>{const o=oppById(b.dataset.opp);const g=gate(o);if(!g.ok){b.disabled=true;b.textContent='Locked';b.title=g.text;}
    else{const h=b.cloneNode(true);b.replaceWith(h);h.onclick=()=>{const f=$('#myf').value;LS.set('kvent.myfaction',f);U.startMatch(U.newAIMatch(player(),U.deckOf($('#myf').value,$('#usesaved').checked),o));};}});
  onlineUI(v);};
/* ------------------------------------------------------------------ online: friends, challenges, match list */
let client=null,relayKey='';
function relayCfg(){return LS.get('kvent.relay',{mode:'local',url:'',key:''});}
function mkRelay(){const c=relayCfg();if(c.mode==='online'&&c.url)return new NET.HttpRelay(c.url,c.key);return new NET.LoopbackRelay(new (window.KventRelayCore.RelayCore)(new NET.LocalDB(localStorage)));}
const mstore={get:id=>{const r=(LS.get('kvent.matches',{})||{})[id];return r?r.json:null;},set:(id,j)=>{const all=LS.get('kvent.matches',{})||{};const meta=j.meta||{};all[id]={json:j,updated:Date.now()};LS.set('kvent.matches',all);},all:()=>LS.get('kvent.matches',{})};
function getClient(){const c=relayCfg();const key=player()+'|'+c.mode+'|'+c.url+'|'+c.key;if(!client||relayKey!==key){relayKey=key;client=new NET.Client({relay:mkRelay(),me:player(),store:mstore});}return client;}
const isFriendName=n=>FRIENDS.some(f=>f.toLowerCase()===String(n).toLowerCase());
function myName(){const f=FRIENDS.find(x=>x.toLowerCase()===player().toLowerCase());return f||null;}
U.netSeat=mt=>{const o=(mt.header.meta||{}).online;return o&&o.host===myName()?0:1;};
U.netSession=function(mt,store){const c=getClient();c.pollMs=2500;return c.session(mt,store);};
U.openOnline=async function(id){const c=getClient();U.toast('Syncing...',1200);const r=await c.sync(id);if(!r.ok){U.toast('Sync failed: '+r.error+'. Playing from your saved copy.',3500);}
  const mt=c.load(id);if(!mt)return U.toast('Match not found');U.startMatch(mt);};
let onlTimer=0;
function onlineUI(v){const host=$('#onl',v);if(!host)return;host.className='onl';const me=myName();const c=relayCfg();
  const deck=f=>U.savedDeck(f)||M.deckFor(f);
  const fsel=id=>'<select id="'+id+'">'+FACS.map(f=>'<option value="'+f+'"'+(f===LS.get('kvent.myfaction','town')?' selected':'')+'>'+FN[f]+'</option>').join('')+'</select>';
  host.innerHTML=(me?'':'<p class="warn">Online play is for Marius, Chris and Martin. You are "'+esc(player())+'".</p>')+
   '<div class="row sub"><label>Mail via <select id="rmode"><option value="local"'+(c.mode!=='online'?' selected':'')+'>this browser only (test / two profiles)</option><option value="online"'+(c.mode==='online'?' selected':'')+'>online relay</option></select></label>'+
   '<span id="rcfg" style="display:'+(c.mode==='online'?'inline':'none')+'"><input id="rurl" type="text" placeholder="relay URL (https://...)" size="26" value="'+esc(c.url||'')+'"> <input id="rkey" type="password" placeholder="shared key" size="10" value="'+esc(c.key||'')+'"></span><button id="rsave">Save</button><button id="rping">Test</button><span id="rstat" class="sub"></span></div>'+
   '<div class="row" style="margin-top:8px"><span class="sub">Your deck:</span>'+fsel('ofac')+(FRIENDS.filter(f=>f!==me).map(f=>'<button class="pri" data-och="'+f+'" data-fk="och'+f+'" '+(me?'':'disabled')+'>Challenge '+f+'</button>').join(''))+'<button id="orefresh" data-fk="orefresh">Refresh</button></div>'+
   '<div id="olists"></div>';
  const st=t=>{const e=$('#rstat',host);if(e)e.textContent=t;};
  $('#rmode',host).onchange=e=>{$('#rcfg',host).style.display=e.target.value==='online'?'inline':'none';};
  $('#rsave',host).onclick=()=>{LS.set('kvent.relay',{mode:$('#rmode',host).value,url:$('#rurl',host).value.trim(),key:$('#rkey',host).value});client=null;st('Saved.');refresh();};
  $('#rping',host).onclick=async()=>{st('Testing...');try{const r=await mkRelayFromForm(host).ping();st(r&&r.ok?'Relay answers.':'Relay said: '+(r&&r.error));}catch(e){st('Cannot reach the relay.');}};
  const chs=$$('[data-och]',host);chs.forEach(b=>b.onclick=async()=>{const f=$('#ofac',host).value;LS.set('kvent.myfaction',f);b.disabled=true;try{const r=await getClient().challenge(b.dataset.och,{faction:f,leader:(U.savedDeck(f)||M.deckFor(f)).leader,cards:(U.savedDeck(f)||M.deckFor(f)).cards},me+' vs '+b.dataset.och);
      U.toast(r.ok?'Challenge sent to '+b.dataset.och:'Failed: '+r.error,2800);}catch(e){U.toast('Relay not reachable',2800);}b.disabled=false;refresh();});
  $('#orefresh',host).onclick=()=>refresh();
  async function refresh(){const L=$('#olists',host);if(!L||!me){return;}let r;try{r=await getClient().refresh();}catch(e){L.innerHTML='<p class="warn">Cannot reach the relay ('+esc(e.message)+'). Local games still work.</p>';return;}
    if(!r.ok){L.innerHTML='<p class="warn">'+esc(r.error)+'</p>';return;}
    const side=s=>s.from===me?s.to:s.from;
    const mrow=(t,btns)=>'<div class="mrowo"><span class="t">'+t+'</span>'+btns+'</div>';
    const inc=r.incoming.map(s=>mrow('<b>'+esc(s.from)+'</b> challenges you <span class="chip2">'+FN[s.hostDeck.faction]+'</span>','<select id="acf_'+s.id+'">'+FACS.map(f=>'<option value="'+f+'">'+FN[f]+'</option>').join('')+'</select><button class="pri" data-acc="'+s.id+'" data-fk="acc'+s.id+'">Accept</button><button data-dec="'+s.id+'" data-fk="dec'+s.id+'">Decline</button>')).join('');
    const out=r.outgoing.map(s=>mrow('Waiting for <b>'+esc(s.to)+'</b> to accept','<span class="sub">sent</span>')).join('');
    const act=r.active.map(a=>mrow('<b>vs '+esc(side(a.s))+'</b> · round '+Math.min(3,a.mt.S.round)+' · '+a.mt.S.players.map(p=>p.wins).join(':')+' · '+(a.mine?'<span class="okc">your move</span>':'waiting for '+esc(side(a.s))),'<button class="pri" data-oo="'+a.s.id+'" data-fk="oo'+a.s.id+'">'+(a.mine?'Play':'Open')+'</button><button data-os="'+a.s.id+'" data-fk="os'+a.s.id+'">Sync</button>')).join('');
    const dn=r.done.map(a=>mrow('vs '+esc(side(a.s))+' · '+(a.mt.S.winner<0?'draw':(a.mt.S.winner===a.seat?'you won':'you lost')),'<button data-oo="'+a.s.id+'" data-fk="od'+a.s.id+'">View</button>')).join('');
    L.innerHTML=(inc?'<h4>Challenges for you</h4>'+inc:'')+(act?'<h4>Your online matches</h4>'+act:'')+(out?'<h4>Sent</h4>'+out:'')+(dn?'<h4>Finished</h4>'+dn:'')+((inc||act||out||dn)?'':'<div class="sub" style="margin-top:8px">No online matches yet. Challenge Chris or Martin above (they answer from their own game: nothing is time based, you can play a move now and they answer later).</div>');
    $$('[data-acc]',L).forEach(b=>b.onclick=async()=>{const f=$('#acf_'+b.dataset.acc,L).value;b.disabled=true;const x=await getClient().accept(b.dataset.acc,{faction:f,leader:(U.savedDeck(f)||M.deckFor(f)).leader,cards:(U.savedDeck(f)||M.deckFor(f)).cards});U.toast(x.ok?'Accepted. Match created.':'Failed: '+x.error,2800);refresh();});
    $$('[data-dec]',L).forEach(b=>b.onclick=async()=>{await getClient().decline(b.dataset.dec);refresh();});
    $$('[data-oo]',L).forEach(b=>b.onclick=()=>U.openOnline(b.dataset.oo));
    $$('[data-os]',L).forEach(b=>b.onclick=async()=>{b.disabled=true;const x=await getClient().sync(b.dataset.os);U.toast(x.ok?(x.got?'Got '+x.got+' new move'+(x.got>1?'s':''):'Up to date'):x.error,2200);refresh();});}
  function mkRelayFromForm(h){const m=$('#rmode',h).value;if(m==='online')return new NET.HttpRelay($('#rurl',h).value.trim(),$('#rkey',h).value);return mkRelay();}
  refresh();clearInterval(onlTimer);onlTimer=setInterval(()=>{if(!document.body.contains(host)||!$('#v-hub').classList.contains('on')){clearInterval(onlTimer);return;}refresh();},7000);}
/* ------------------------------------------------------------------ builder ownership (called by ui_extra) */
U.ownLimit=function(id){const d=K.db()[id];if(!d)return 0;return CO.limit(getC(),id);};
U.ownedCount=id=>CO.owned(getC(),id);
/* ------------------------------------------------------------------ boot: open straight on a view (phone app buttons use ?view=packs|builder|ladder|hub) */
U.boot=function(){const w=Q.get('view');if(!w)return;setTimeout(()=>{try{U.go(w);}catch(e){}},0);};
/* friend results: ui.js calls this when an online/hot-seat match against a friend ends */
U.friendResult=function(name,won,draw){const C=getC();C.friends=C.friends||{};const r=C.friends[name]||(C.friends[name]={w:0,l:0,d:0});if(draw)r.d++;else if(won)r.w++;else r.l++;putC(C);};
})();
