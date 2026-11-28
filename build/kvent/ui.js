/* KVENT prototype UI: menu, hub (challenges/matches/ladder), game board, input (mouse/touch/keyboard/gamepad), sound. */
(function(){
'use strict';
const K=Kvent,AI=KventAI,M=KventMatch,ART=KventArt;
const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)];
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KUI=window.KUI={K,AI,M,ART,$,$$,LS,esc};
/* kventgame: embed mode (the game opens this page in an overlay iframe: ?embed=1&opponent=<id>&deck=<faction>&player=<name>) */
const Q=new URLSearchParams(location.search),EMBED=Q.get('embed')==='1';KUI.EMBED=EMBED;
const toParent=m=>{try{if(EMBED&&parent!==window)parent.postMessage(Object.assign({kventEmbed:1},m),location.origin);}catch(e){}};
function collKey(){return 'kvent.coll.v1.'+(Q.get('player')||LS.get('kvent.profile','Marius'));}
KUI.saveColl=C=>LS.set(collKey(),C);KUI.CO=window.KventColl;
function loadColl(){return LS.get(collKey(),{cards:{},wins:{}});}KUI.loadColl=loadColl;
if(EMBED)document.documentElement.classList.add('embed');
let DB={},META={},OPP=[];
const G=KUI.G={mt:null,S:null,sess:null,view:0,hot:false,sel:null,busy:false,snap:null,covered:false,tut:null,lastNew:new Set(),fkey:null,passArm:0,openKey:null,overShown:false,rematch:null};
const FN={town:'Town Folk',rod:'Rødnisser',blaa:'Blånisser',natt:'Night Creatures',fjord:'Fjord Folk',neutral:'Neutral'};
const ROWN={close:'Street',ranged:'Rooftops',siege:'Workshop'},ROWS3=['close','ranged','siege'];
const ROWT={close:'St',ranged:'Ro',siege:'Wk',agile:'St/Ro'};
const AB={spy:'Turncoat',medic:'Healer',bond:'Pals',morale:'Cheer',muster:'Gang',horn:'Horn',scorch_close:'Blaze',scorch_ranged:'Blaze',scorch_siege:'Blaze'};
const ABS={spy:'SPY',medic:'MED',bond:'PAL',morale:'+1',muster:'GANG',horn:'HORN',scorch_close:'BLZ',scorch_ranged:'BLZ',scorch_siege:'BLZ'};
const SPSYM={frost:'❄',fog:'☁',rain:'☂',clear:'☀',horn:'♪',scorch:'♨',decoy:'⇄'};
/* ---------- sound ---------- */
let muted=LS.get('kvent.mute',false);const SND={};
function snd(n,v){if(muted)return;try{const a=SND[n]||(SND[n]=new Audio('../../sfx/kvent/'+n+'.mp3'));a.volume=v||.5;a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
function syncMute(){const b=$('#btnMute');if(b)b.textContent=muted?'Sound off':'Sound on';}
KUI.snd=snd;
/* ---------- helpers ---------- */
function toast(t,ms){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',ms||2200);}KUI.toast=toast;
function showView(id){for(const s of $$('section.view'))s.classList.toggle('on',s.id==='v-'+id);G.fkey=null;window.scrollTo(0,0);closeModal();hideBanner();$('#cover').classList.remove('on');}KUI.showView=showView;
function curView(){const s=$('section.view.on');return s?s.id.slice(2):'menu';}
function defOf(c){return DB[c.id]||c;}
function chips(d){const a=[];if(d.hero)a.push('★ Legend');if(d.abil&&AB[d.abil])a.push(AB[d.abil]);if(d.row==='agile')a.push('Agile');return a.join(' · ');}
function cardEl(c,o){o=o||{};const d=defOf(c);const e=document.createElement('div');
  e.className='kc f-'+d.faction+(d.hero?' hero':'')+(d.type!=='unit'&&d.type!=='leader'?' sp':'');e.dataset.id=c.id;if(c.uid!=null)e.dataset.uid=c.uid;
  if(o.back){e.className+=' back';return e;}
  let pw,cls='';if(d.type==='unit'){pw=o.pw!=null?o.pw:(c.decoy?0:d.power);if(o.pw!=null&&!d.hero&&o.pw>d.power)cls='up';else if(o.pw!=null&&!d.hero&&o.pw<d.power)cls='dn';}else if(d.type==='leader')pw='L';else pw=SPSYM[d.eff]||'?';
  if(c.decoy){e.dataset.id='decoy';}
  const dd=c.decoy?DB.decoy:d;
  const tag=o.board?(d.abil&&ABS[d.abil]||''):(d.type==='unit'?ROWT[d.row]:(d.type==='leader'?'Leader':''));
  e.innerHTML='<img alt="" src="'+ART.art(dd)+'"><div class="pw '+cls+'">'+pw+'</div>'+(tag?'<div class="rw">'+tag+'</div>':'')+'<div class="nm">'+esc(dd.name)+(o.board?'':(chips(dd)?'<small>'+esc(chips(dd))+'</small>':''))+'</div>';
  return e;}
KUI.cardEl=cardEl;
function zoomHTML(d){const big=cardEl({id:d.id});const t=d.type==='unit'?(d.hero?'Legend':'Unit')+' · '+(d.row==='agile'?'Street or Rooftops':ROWN[d.row])+' · power '+d.power:(d.type==='leader'?(['extra','halfwx'].includes(d.leader)?'Leader · passive':'Leader · once per match'):d.type==='weather'?'Weather':'Special');
  return{big,html:'<div class="tx"><b>'+esc(d.name)+'</b> <span class="pill">'+esc(FN[d.faction]||'')+'</span><div class="sub">'+t+'</div><div class="ln">'+esc(d.line||'')+'</div><div style="margin-top:4px">'+esc(d.text||'')+'</div></div>'};}
function zoomDefault(){const z=$('#zoom');if(z&&!z.firstChild)z.innerHTML='<div class="sub" style="margin:auto">Hover (or long-press) any card to read it here.</div>';}
function setZoom(id){const d=DB[id];if(!d)return;const z=$('#zoom');const x=zoomHTML(d);z.innerHTML='';z.appendChild(x.big);z.insertAdjacentHTML('beforeend',x.html);}
function lightbox(id){const d=DB[id];if(!d)return;const x=zoomHTML(d);const lb=$('#lb');lb.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:10px;max-width:92vw;color:#fff"><div id="lbc"></div><div style="background:var(--card);color:var(--ink);border-radius:12px;padding:10px 14px;max-width:420px">'+x.html+'</div></div>';$('#lbc',lb).appendChild(x.big);lb.classList.add('on');}
function closeLB(){$('#lb').classList.remove('on');}
$('#lb').addEventListener('click',closeLB);
document.addEventListener('mouseover',e=>{const k=e.target.closest&&e.target.closest('.kc[data-id]');if(k&&!k.classList.contains('back')&&k.dataset.id!=='decoy_x')setZoom(k.dataset.id);});
let lp=null;document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const k=e.target.closest&&e.target.closest('.kc[data-id]');if(!k||k.classList.contains('back'))return;lp=setTimeout(()=>{lp=null;lightbox(k.dataset.id);},450);});
for(const ev of['pointerup','pointercancel','pointermove'])document.addEventListener(ev,()=>{if(lp){clearTimeout(lp);lp=null;}});
/* ---------- modal / banner ---------- */
function openModal(html,key){const m=$('#modal');$('.box',m).innerHTML=html;m.classList.add('on');G.openKey=key||'x';return $('.box',m);}
function closeModal(){$('#modal').classList.remove('on');G.openKey=null;}
KUI.openModal=openModal;KUI.closeModal=closeModal;
function showBanner(h,p){const b=$('#banner');$('div',b).innerHTML='<h2>'+esc(h)+'</h2><p>'+esc(p||'')+'</p>';b.classList.add('on');}
function hideBanner(){$('#banner').classList.remove('on');}
KUI.showBanner=showBanner;KUI.hideBanner=hideBanner;
/* ---------- persistence ---------- */
function loadMatches(){return LS.get('kvent.matches',{});}
function store(mt){const all=loadMatches();const meta=mt.header.meta||{};meta.updated=Date.now();mt.header.meta=meta;all[mt.header.id]={json:mt.toJSON(),updated:meta.updated};LS.set('kvent.matches',all);}
function profile(){return Q.get('player')||LS.get('kvent.profile','Marius');}
function savedDeck(f){const d=LS.get('kvent.decks.v1',{})[f];if(!d)return null;const full={faction:f,leader:d.leader,cards:d.cards};return K.validateDeck(full).ok?full:null;}
KUI.savedDeck=savedDeck;
/* ---------- starting matches ---------- */
function deckOf(faction,useSaved){return(useSaved&&savedDeck(faction))||M.deckFor(faction);}
KUI.deckOf=deckOf;
function newAIMatch(myName,myDeck,opp,seedExtra){const od={faction:opp.faction,leader:opp.leader,cards:M.readyDeck(opp.faction,(opp.extras||[]).concat(KUI.escalation?KUI.escalation(opp):[]))};
  return M.create({hostSeed:String(Math.random())+Date.now(),guestSalt:seedExtra||opp.id,players:[Object.assign({name:myName,kind:'human'},myDeck),Object.assign({name:opp.name,kind:'ai',personality:opp.personality,opp:opp.id},od)],meta:{title:myName+' vs '+opp.name,opp:opp.id,created:Date.now()}});}
KUI.newAIMatch=newAIMatch;
function isHuman(i){return G.mt.header.players[i].kind!=='ai';}
function whoNow(){const S=G.S;if(G.mt)return G.mt.who();if(S.phase==='over')return-1;if(S.pending)return S.pending.player;return S.phase==='play'?S.turn:-1;}
function startMatch(mt){stopSession();G.mt=mt;G.S=mt.S;G.tut=null;G.sel=null;G.busy=false;G.snap=null;G.overShown=false;G.fkey=null;
  const pl=mt.header.players;const hum=pl.map((p,i)=>p.kind!=='ai'?i:-1).filter(i=>i>=0);const onl=(mt.header.meta||{}).online;G.online=onl||null;G.hot=hum.length>1&&!onl;
  const seats=pl.map((p,i)=>p.kind==='ai'?new M.AITransport(i,p.personality||'balanced',850):new M.HotseatTransport());
  G.sess=onl&&KUI.netSession?KUI.netSession(mt,store):new M.Session(mt,seats,store);G.sess.onChange(a=>afterAct(a));
  G.view=onl&&KUI.netSeat?KUI.netSeat(mt):(G.hot?(mt.who()>=0?mt.who():0):hum[0]);G.covered=false;
  G.rematch={players:pl,title:(mt.header.meta||{}).title,opp:(mt.header.meta||{}).opp};
  store(mt);showView('game');$('#roundInfo').textContent='';
  snd('deal');G.sess.start();render();refresh();if(KUI.say&&!onl)setTimeout(()=>KUI.say('greet'),700);}
KUI.startMatch=startMatch;
function stopSession(){if(G.sess)G.sess.stop();G.sess=null;}
function openSaved(id){const rec=loadMatches()[id];if(!rec)return toast('Match not found');const r=M.replay(rec.json);if(!r.ok)return toast('Match log failed verification: '+r.error,4000);if((r.match.header.meta||{}).online&&KUI.openOnline)return KUI.openOnline(id);startMatch(r.match);}
KUI.openSaved=openSaved;
/* ---------- acting ---------- */
function doAct(a){a=Object.assign({p:G.view},a);let r;G.sel=null;
  if(G.tut)r=M.applyTo(G.S,a);else r=G.sess.dispatch(a);
  if(!r.ok){toast(r.err||'Illegal move');return r;}
  G.sel=null;if(G.tut){afterAct(a);}return r;}
KUI.doAct=doAct;
function afterAct(a){const S=G.S;G.passArm=0;try{if(KUI.anim)KUI.anim.events(S.ev);}catch(e){}
  for(const e of S.ev){
    if(e.t==='place'){G.lastNew.add(e.uid);snd(e.row==='x'?'play':'play',.45);}
    else if(e.t==='pass'){snd('pass');if(KUI.say&&!G.hot&&!G.online&&e.p!==G.view)KUI.say('pass');}
    else if(e.t==='weather')snd(e.kind==='clear'?'clear':e.kind);
    else if(e.t==='horn')snd('horn');
    else if(e.t==='scorch')snd('scorch');
    else if(e.t==='spy')snd('spy');
    else if(e.t==='medic')snd('medic');
    else if(e.t==='roundEnd')roundBanner(e);
    else if(e.t==='over'){}
  }
  S.ev.length=0;
  if(G.tut&&KUI.tutAfter)KUI.tutAfter(a);
  render();refresh();}
function roundBanner(e){const S=G.S,V=G.view;G.snap=S.lastRound.snap;if(G.tut)return;
  const t=e.totals;let h,sub=(t[V]+'  :  '+t[1-V]);const names=S.players.map(p=>p.name);
  if(e.winner<0)h='Round drawn';else if(G.hot)h=names[e.winner]+' wins the round';else h=e.winner===V?'Round won':'Round lost';
  if(!G.hot)snd(e.winner===V?'win':(e.winner<0?'pass':'lose'));else snd('win');
  if(S.lastRound.kept&&S.lastRound.kept.length)sub+='   ·   stays on the board: '+S.lastRound.kept.join(', ');
  if(KUI.say&&!G.hot&&!G.online&&e.winner>=0)KUI.say(e.winner===V?'rlose':'rwin');
  G.busy=true;showBanner(h,sub);setTimeout(()=>{G.busy=false;G.snap=null;hideBanner();render();refresh();},S.phase==='over'?2200:2800);}
function canAct(){const S=G.S;if(!S||G.busy||G.covered)return false;if(G.tut&&G.tut.locked)return false;return S.phase==='play'&&!S.pending&&S.turn===G.view&&(G.tut||isHuman(G.view));}
function refresh(){
  if(G.tut){render();return;}
  const S=G.S;if(!S||curView()!=='game')return;
  render();if(G.busy)return;
  if(S.phase==='over'){showOver();return;}
  const w=G.mt.who();if(w<0)return;
  if(G.hot&&w!==G.view){showCover(w);return;}
  if(G.covered)return;
  if(!isHuman(w))return;
  if(S.phase==='mulligan'&&w===G.view){if(G.openKey!=='mull')openMulligan();return;}
  if(S.pending&&S.pending.player===G.view){const pd=S.pending;const k='pk:'+pd.kind+pd.options.join();if(G.openKey!==k){if(pd.kind==='first')openFirst();else openPicker(pd,k);}return;}
}
function showCover(w){if(G.covered&&$('#cover').classList.contains('on'))return;closeModal();G.covered=true;const n=G.S.players[w].name;const c=$('#cover');
  c.innerHTML='<div class="tile" style="max-width:420px"><h2>Pass the controller</h2><p>Hands are hidden. Hand the screen to <b>'+esc(n)+'</b>.</p><button class="pri" data-fk="cover" id="coverGo">I am '+esc(n)+' - show my cards</button></div>';
  c.classList.add('on');render();$('#coverGo').onclick=()=>{G.view=w;G.covered=false;c.classList.remove('on');G.fkey=null;render();refresh();};}
/* ---------- prompts ---------- */
function openMulligan(){const S=G.S;const hand=S.players[G.view].hand.slice();let pick=new Set();
  const box=openModal('<h2>Opening hand</h2><p class="sub">Tap up to 2 cards you want to replace (classic rule: 2 redraws). Then confirm.</p><div class="cards" id="mc"></div><div class="row" style="justify-content:center"><button class="pri" id="mgo" data-fk="mgo"></button></div>','mull');
  const mc=$('#mc',box),go=$('#mgo',box);
  const draw=()=>{mc.innerHTML='';hand.forEach((c,i)=>{const e=cardEl(c);e.dataset.fk='mc'+i;if(pick.has(c.uid))e.classList.add('sel');e.onclick=()=>{if(pick.has(c.uid))pick.delete(c.uid);else if(pick.size<2)pick.add(c.uid);else toast('Only 2 redraws');snd('select');draw();};mc.appendChild(e);});go.textContent=pick.size?'Redraw '+pick.size+' card'+(pick.size>1?'s':''):'Keep this hand';};
  draw();go.onclick=()=>{closeModal();doAct({t:'mulligan',uids:[...pick]});};}
function openFirst(){const S=G.S;const box=openModal('<h2>Rødnisser: you decide</h2><p class="sub">The red-hat clan chooses who plays first in round 1 (classic Scoia\'tael trait).</p><div class="row" style="justify-content:center"><button class="pri" data-fk="f1" id="f1">I start</button><button data-fk="f2" id="f2">'+esc(S.players[1-G.view].name)+' starts</button></div>','first');
  $('#f1',box).onclick=()=>{closeModal();doAct({t:'first',who:G.view});};$('#f2',box).onclick=()=>{closeModal();doAct({t:'first',who:1-G.view});};}
const PICK={medic:['Healer: bring a unit back from your discard pile','discard',0,1],raise:['Take a card from the opponent\'s discard pile','odiscard',0,1],recall:['Take a card back from your discard pile','discard',0,1],cull:['Discard a card from your hand (leader: discard 2, then take 1 from the deck)','hand',1,0],cullpick:['Now take ONE card of your choice from your deck','deck',1,0],wxpick:['Play a weather card of your choice from your deck','deck',1,0]};
function openPicker(pd,key){const S=G.S;const pk=PICK[pd.kind]||PICK.medic;const src=pk[1]==='odiscard'?S.players[1-G.view].discard:S.players[G.view][pk[1]];const req=pk[2];
  const box=openModal('<h2>'+pk[0]+'</h2><div class="cards" id="pc"></div>'+(req?'':'<div class="row" style="justify-content:center"><button data-fk="skip" id="pskip">Skip</button></div>'),key);
  const pc=$('#pc',box);src.filter(c=>pd.options.includes(c.uid)).forEach((c,i)=>{const e=cardEl(c);e.dataset.fk='pc'+i;e.onclick=()=>{closeModal();doAct({t:'resolve',card:c.uid});};pc.appendChild(e);});
  const sk=$('#pskip',box);if(sk)sk.onclick=()=>{closeModal();doAct({t:'resolve'});};}
function kventReward(oppId,won){/* kventgame: coins + cards for beating a townsperson. First win = a pack of 3 unowned cards; later wins = 1 card now and then. Stored per player. */
  const o=OPP.find(x=>x.id===oppId);if(!o||!won)return{kr:0,cards:[]};const C=loadColl();C.wins[oppId]=(C.wins[oppId]||0)+1;const first=C.wins[oppId]===1;
  const kr=first?100*(o.level||1)+(o.boss?200:0):20*(o.level||1);
  const pool=Object.values(DB).filter(d=>d.type!=='leader'&&d.type!=='weather'&&(d.faction===o.faction||d.faction==='neutral')&&!(C.cards[d.id]>0));
  const n=first?3:(Math.random()<.34?1:0);const got=[];
  for(let i=0;i<n&&pool.length;i++){const k=Math.floor(Math.random()*pool.length);const d=pool.splice(k,1)[0];C.cards[d.id]=(C.cards[d.id]||0)+1;got.push(d.id);}
  LS.set(collKey(),C);return{kr,cards:got,first};}KUI.kventReward=kventReward;
function showOver(){if(G.overShown)return;G.overShown=true;const S=G.S,V=G.view;const w=S.winner;const hist=S.history.map(h=>h.t[V]+' : '+h.t[1-V]+(h.winner<0?' (draw)':h.winner===V?' (won)':' (lost)')).join('<br>');
  let h=w<0?'A draw':G.hot?S.players[w].name+' wins the match!':(w===V?'You win the match!':'You lose the match');snd(w===V?'matchwin':(w<0?'pass':'matchlose'));
  const code=M.toCode(G.mt);
  const oppId=(G.mt.header.meta||{}).opp,onl=G.online;let rw=null,rwHtml='',packBtn=false,gg=null;
  const rounds=S.history.map(x=>[x.t[V],x.t[1-V],x.winner<0?0:(x.winner===V?1:-1)]);
  if(oppId&&!G.hot&&!onl){const wonIt=w===V,o=OPP.find(x=>x.id===oppId);const pdm=LS.get('kvent.paid.v1',null)||{},again=!!pdm[G.mt.header.id];rw=(wonIt&&!again)?KUI.reward(oppId,true):{kr:0,cards:[],packs:[]};if(!again){try{const ks=Object.keys(pdm);if(ks.length>300)delete pdm[ks[0]];pdm[G.mt.header.id]=1;LS.set('kvent.paid.v1',pdm);}catch(e){}}
    const line=o?(wonIt?KUI.lineText(o,'lose'):(w<0?KUI.lineText(o,'draw'):KUI.lineText(o,'win'))):'';packBtn=!!(rw.packs&&rw.packs.length);
    rwHtml=(o?'<p><img class="portrait sm" src="'+KUI.portraitSrc(o)+'" alt=""> <b>'+esc(o.name)+':</b> <i>&ldquo;'+esc(line)+'&rdquo;</i></p>':'')+(wonIt?'<p class="good"><b>+'+rw.kr+' kr</b>'+(packBtn?' and '+rw.packs.length+' card pack'+(rw.packs.length>1?'s':'')+': '+rw.packs.map(p=>esc(KUI.CO.PACKS[p.kind].name)).join(', '):'')+'</p>':'');
    gg={opponent:oppId};
    if(EMBED&&!again)toParent({type:'kvent-result',won:wonIt,draw:w<0,opponent:oppId,rounds,kr:rw.kr,cards:rw.cards,packs:rw.packs.length,first:!!rw.first,line,matchId:G.mt.header.id});}
  else if(onl){const fn=S.players[1-V].name;{const pdm=LS.get('kvent.paid.v1',null)||{};if(!pdm[G.mt.header.id]){pdm[G.mt.header.id]=1;try{LS.set('kvent.paid.v1',pdm);}catch(e){}KUI.friendResult(fn,w===V,w<0);}}/*kvfriend: counted once*/gg={opponent:'friend:'+fn,friend:fn};rwHtml='<p class="sub">Saved to your friends ladder ('+esc(fn)+').</p>';
    if(EMBED)toParent({type:'kvent-result',won:w===V,draw:w<0,opponent:'friend:'+fn,friend:fn,rounds,kr:0,cards:[],packs:0,line:'',matchId:G.mt.header.id});}
  const box=openModal('<h2>'+esc(h)+'</h2><p class="sub">Rounds ('+esc(S.players[V].name)+' : '+esc(S.players[1-V].name)+')</p><p>'+hist+'</p>'+rwHtml+'<div class="row" style="justify-content:center">'+(onl?'':'<button class="pri" data-fk="o1" id="o1">Rematch</button>')+''+(EMBED?'<button data-fk="o4" id="o4">Back to the game</button>':'')+'<button data-fk="o2" id="o2">Menu</button><button data-fk="o3" id="o3">Copy match code</button>'+(gg?'<button data-fk="o5" id="o5">Good game!</button>':'')+(packBtn?'<button class="pri" data-fk="o6" id="o6">Open my pack</button>':'')+'</div><p class="sub">The code replays and verifies this exact match (all moves are in it).</p>','over');
  if(EMBED&&$('#o4',box))$('#o4',box).onclick=()=>toParent({type:'kvent-close'});
  if($('#o1',box))$('#o1',box).onclick=()=>{const r=G.rematch;const mk=M.create({hostSeed:String(Math.random())+Date.now(),guestSalt:'rematch',players:r.players.map(p=>({name:p.name,faction:p.faction,leader:p.leader,cards:p.cards,kind:p.kind,personality:p.personality,opp:p.opp})),meta:{title:r.title,opp:r.opp,created:Date.now()}});startMatch(mk);};
  $('#o2',box).onclick=()=>{stopSession();showView('menu');KUI.menu();};
  $('#o3',box).onclick=()=>{try{navigator.clipboard.writeText(code);toast('Match code copied');}catch(e){toast('Copy failed');}};
  if($('#o5',box))$('#o5',box).onclick=()=>{const b=$('#o5',box);b.disabled=true;toast(KUI.lang&&KUI.lang()?'Takk for spillet!':'Good game!',1800);toParent(Object.assign({type:'kvent-gg',won:w===V,matchId:G.mt.header.id},gg));};
  if($('#o6',box))$('#o6',box).onclick=()=>{closeModal();KUI.go('packs');};}
/* ---------- render ---------- */
function rowsOf(p){return G.snap?G.snap.rows[p]:G.S.players[p].rows;}
function viewS(){return G.snap?{players:[Object.assign({},G.S.players[0],{rows:G.snap.rows[0]}),Object.assign({},G.S.players[1],{rows:G.snap.rows[1]})],weather:G.snap.weather}:G.S;}/*cardgame: keep the leader etc. in the round-end snapshot (rowPowers needs it; it threw and skipped the next AI move)*/
function render(){const S=G.S;if(!S||curView()!=='game')return;try{if(KUI.anim)KUI.anim.before();}catch(e){if(!KUI.aw){KUI.aw=1;try{console.warn('kvent anim',e);}catch(_){}}}const V=G.view,O=1-V,VS=viewS();
  const sel=G.sel?optsFor(G.sel):[];const dropRows=new Set(sel.filter(a=>a.row).map(a=>a.row)),tgts=new Set(sel.filter(a=>a.target).map(a=>a.target));
  const dropAll=sel.length===1&&!sel[0].row&&!sel[0].target;
  const b=$('#board');b.innerHTML='';b.classList.toggle('dropall',dropAll);
  const order=[[O,'siege'],[O,'ranged'],[O,'close'],null,[V,'close'],[V,'ranged'],[V,'siege']];
  for(const it of order){if(!it){const s=document.createElement('div');s.className='sepline';b.appendChild(s);continue;}
    const[p,r]=it;const R=rowsOf(p)[r];const pw=K.rowPowers(VS,p,r);const tot=pw.reduce((a,x)=>a+x,0);
    const rb=document.createElement('div');rb.className='rb'+(R.horn?' horned':'')+(K.weatherOn(VS,r)?' wx-'+({close:'frost',ranged:'fog',siege:'rain'}[r]):'');rb.dataset.side=p;rb.dataset.row=r;
    const mine=p===V;if(mine&&dropRows.has(r)){rb.classList.add('drop');rb.dataset.fk='row:'+r;rb.onclick=()=>{const a=sel.find(x=>x.row===r);if(a)doAct({t:'play',card:G.sel,row:r});};}
    rb.innerHTML='<div class="rs"><b>'+tot+'</b>'+ROWN[r]+'</div><div class="hs">'+(R.horn?'':'Horn')+'</div><div class="ru"></div><div class="wxo"></div>';
    if(R.horn){const he=cardEl(R.horn.id==='leader_horn'?{id:'horn'}:R.horn,{board:true});$('.hs',rb).appendChild(he);}
    const ru=$('.ru',rb);R.units.forEach((u,i)=>{const e=cardEl(u,{board:true,pw:pw[i]});e.dataset.fk='b:'+u.uid;if(G.lastNew.has(u.uid))e.classList.add('new');
      if(mine&&tgts.has(u.uid)){e.classList.add('tgt');e.onclick=ev=>{ev.stopPropagation();doAct({t:'play',card:G.sel,target:u.uid});};}
      ru.appendChild(e);});
    b.appendChild(rb);}
  G.lastNew.clear();
  b.onclick=ev=>{if(dropAll&&(ev.target===b||ev.target.classList.contains('sepline')||ev.target.closest('.rb')))doAct({t:'play',card:G.sel});};
  panel('#pOpp',O);panel('#pMe',V);
  $('#wxBox').innerHTML=ROWS3.map(r=>'<span class="'+(K.weatherOn(VS,r)?'on':'')+'">'+ROWN[r]+(K.weatherOn(VS,r)?' ('+{close:'Snowstorm',ranged:'Fog',siege:'Rain'}[r]+')':'')+'</span>').join('');
  // hand
  const h=$('#hand');h.innerHTML='';const hand=S.players[V].hand.slice();
  if(G.covered){hand.forEach(()=>h.appendChild(cardEl({id:'n_chris'},{back:true})));}
  else{const to=c=>c.type==='unit'?0:c.type==='weather'?1:2;hand.sort((a,b2)=>to(a)-to(b2)||(a.row||'').localeCompare(b2.row||'')||a.power-b2.power||a.uid-b2.uid);
    for(const c of hand){const e=cardEl(c);e.dataset.fk='h:'+c.uid;if(G.sel===c.uid)e.classList.add('sel');e.draggable=canAct();
      e.onclick=()=>onHandClick(c.uid);e.ondragstart=ev=>{if(!canAct()){ev.preventDefault();return;}select(c.uid,true);try{ev.dataTransfer.setData('text','x');}catch(x){}};h.appendChild(e);}}
  requestAnimationFrame(()=>{const kids=h.children;if(kids.length>1){const cw=kids[0].getBoundingClientRect().width;const need=kids.length*cw+(kids.length-1)*4;const W=h.clientWidth;h.style.setProperty('--ov',need>W?(-(need-W)/(kids.length-1)-0)+'px':'4px');}});
  b.ondragover=ev=>{if(G.sel)ev.preventDefault();};
  $$('.rb.drop').forEach(r=>{r.ondragover=ev=>ev.preventDefault();r.ondrop=ev=>{ev.preventDefault();r.click();};});
  b.ondrop=ev=>{if(dropAll){ev.preventDefault();doAct({t:'play',card:G.sel});}};
  // buttons
  const my=canAct();const L=K.leaderDef(S,V);const pl=S.players[V];
  const lb=$('#btnLeader');lb.textContent='Leader: '+L.name.split(',')[0].replace(/^(The |Mayor |Constable |Principal |Mother |Chieftain |Chief Auditor |Director |Commissioner )/,m=>m);lb.title=L.text;lb.disabled=!(my&&K.leaderUsable(S,V));lb.dataset.fk='btn:leader';
  lb.textContent=pl.leader.used?'Leader (used)':(pl.leader.disabled?'Leader (cancelled)':(['extra','halfwx'].includes(L.leader)?'Leader (passive)':'Leader: '+L.name));lb.title=L.name+': '+L.text;
  {let lt=$('#leadtxt');if(!lt){lt=document.createElement('div');lt.id='leadtxt';lt.style.cssText='font-size:11px;line-height:1.25;opacity:.85;max-width:190px;text-align:center';lb.parentNode.insertBefore(lt,lb);}lt.textContent=L.text+(pl.leader.used?' (used)':pl.leader.disabled?' (cancelled)':'');}
  const pb=$('#btnPass');pb.disabled=!my;pb.dataset.fk='btn:pass';pb.textContent=G.passArm?'Really pass?':'Pass';$('#btnDisc').dataset.fk='btn:disc';
  $('#btnMenu').dataset.fk='btn:menu';
  let ti='';if(S.phase==='over')ti='Match over';else if(G.covered)ti='';else if(S.phase==='mulligan')ti='Choose your redraws';else if(S.pending)ti=S.pending.player===V?'Make your choice':S.players[S.pending.player].name+' is choosing...';else if(S.turn===V)ti='Your turn'+(S.players[V].passed?'':'');else ti=S.players[S.turn].name+(isHumanSafe(S.turn)?"'s turn":' is thinking...');
  if(S.phase==='play'&&pl.passed&&S.turn!==V)ti='You passed. '+S.players[S.turn].name+' plays on...';
  $('#turnInfo').textContent=ti;$('#roundInfo').textContent='Round '+Math.min(S.round,3)+' · best of 3';
  $('#pOpp').classList.toggle('turn',S.phase==='play'&&S.turn===O);$('#pMe').classList.toggle('turn',S.phase==='play'&&S.turn===V);
  const lg=$('#log');lg.innerHTML=S.log.slice(-14).reverse().map(x=>'<div>'+esc(x)+'</div>').join('');
  zoomDefault();if(KUI.tutRender)KUI.tutRender();
  applyFocus();try{if(KUI.anim)KUI.anim.after();}catch(e){if(!KUI.aw){KUI.aw=1;try{console.warn('kvent anim',e);}catch(_){}}}}
KUI.render=render;KUI.refresh=refresh;
function isHumanSafe(i){return G.mt?isHuman(i):i===G.view;}
function panel(sel,p){const S=G.S,P=S.players[p],VS=viewS();$(sel).dataset.f=S.players[p].faction;const tot=K.total(VS,p);const f=K.meta().mapping[P.faction];const L=K.leaderDef(S,p);
  const lc=cardEl({id:L.id});
  $(sel).innerHTML='<div class="nmr">'+esc(P.name)+'</div><div class="sub">'+FN[P.faction]+'</div><div class="hearts">'+'<i class="gem"></i>'.repeat(Math.max(0,P.lives))+'<span class="x">'+'<i class="gem"></i>'.repeat(Math.max(0,2-P.lives))+'</span></div><div class="tot">'+tot+'</div><div class="sub">hand '+P.hand.length+' · deck '+P.deck.length+' '+(P.passed?'<span class="pb">PASSED</span>':'')+'</div><div class="lead"></div><div class="sub" title="'+esc(f.text)+'" style="margin-top:4px">'+esc(f.text)+'</div>';
  const ld=$('.lead',$(sel));if(P.leader.used)lc.classList.add('dim');ld.appendChild(lc);ld.insertAdjacentHTML('beforeend','<span class="sub"><b>'+esc(L.name)+'</b><br>'+(P.leader.used?'used. ':P.leader.disabled?'cancelled. ':(['extra','halfwx'].includes(L.leader)?'passive: ':'ready: '))+esc(L.text)+'</span>');}
/* hand interaction */
function optsFor(uid){return K.legal(G.S,G.view).filter(a=>a.uid===uid).map(a=>({t:a.t,uid:a.uid,row:a.row,target:a.target}));}
function select(uid,silent){G.sel=uid;if(!silent)snd('select');render();}
function onHandClick(uid){if(!canAct()){const c=G.S.players[G.view].hand.find(x=>x.uid===uid);if(c)setZoom(c.id);return;}
  if(G.sel===uid){const o=optsFor(uid);if(o.length===1){doAct({t:'play',card:uid,row:o[0].row,target:o[0].target});}else{G.sel=null;render();}return;}
  select(uid);}
$('#btnPass').onclick=()=>{if(!canAct())return;if(G.passArm){G.passArm=0;doAct({t:'pass'});}else{G.passArm=1;render();clearTimeout(G.passT);G.passT=setTimeout(()=>{G.passArm=0;render();},2600);}};
$('#btnLeader').onclick=()=>{if(canAct()&&K.leaderUsable(G.S,G.view))doAct({t:'leader'});};
$('#btnMute').onclick=()=>{muted=!muted;LS.set('kvent.mute',muted);syncMute();};
$('#btnMenu').onclick=()=>{if(G.tut){KUI.tutExit&&KUI.tutExit();return;}stopSession();showView('menu');menu();};
$('#btnDisc').onclick=()=>{const S=G.S,V=G.view;const mk=(p)=>'<h3>'+esc(S.players[p].name)+' ('+S.players[p].discard.length+')</h3><div class="cards" id="dc'+p+'"></div>';const box=openModal('<h2>Discard piles</h2>'+mk(V)+mk(1-V)+'<div class="row" style="justify-content:center"><button data-fk="dx" id="dx">Close</button></div>','disc');
  for(const p of[V,1-V]){const c=$('#dc'+p,box);S.players[p].discard.forEach((d,i)=>{const e=cardEl(d);e.dataset.fk='d'+p+'_'+i;c.appendChild(e);});if(!S.players[p].discard.length)c.innerHTML='<span class="sub">empty</span>';}
  $('#dx',box).onclick=closeModal;};
/* ---------- focus / navigation ---------- */
function visible(e){const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';}
function focusables(){
  if($('#modal').classList.contains('on'))return $$('#modal [data-fk]').filter(visible);
  if($('#cover').classList.contains('on'))return $$('#cover [data-fk]');
  if($('#lb').classList.contains('on'))return[];
  const v=curView();
  if(v==='game'){let l=[];
    if(G.sel){l=$$('.rb.drop,.kc.tgt');if(!l.length){l=$$('#hand .kc.sel');if($('#board').classList.contains('dropall'))l=l.concat([$('.rb[data-side="'+G.view+'"][data-row="close"]')]);}
      else l=l.concat($$('#hand .kc.sel'));return l.filter(visible);}
    l=$$('#hand .kc,#acts button,#topbar button,#board .kc').filter(visible);if(G.tut)l=l.concat($$('#coach button'));return l.filter(visible);}
  return $$('#v-'+v+' button,#v-'+v+' select,#v-'+v+' input,#v-'+v+' a,#v-'+v+' .kc,#v-'+v+' [data-fk]').filter(visible);}
function keyOf(e){return e.dataset.fk||('i'+Math.round(e.getBoundingClientRect().left)+'_'+Math.round(e.getBoundingClientRect().top));}
function applyFocus(){$$('.kf').forEach(e=>e.classList.remove('kf'));if(!G.fkey)return;const l=focusables();const e=l.find(x=>keyOf(x)===G.fkey);if(e){e.classList.add('kf');try{e.scrollIntoView({block:'nearest',inline:'nearest'});}catch(x){}if(e.dataset.id&&!e.classList.contains('back'))setZoom(e.dataset.id);}}
function moveFocus(dx,dy){const l=focusables();if(!l.length)return;let cur=l.find(x=>keyOf(x)===G.fkey);
  if(!cur){const first=(curView()==='game'&&!G.sel)?(l.find(x=>x.closest('#hand'))||l[0]):l[0];G.fkey=keyOf(first);first.dataset.fk=first.dataset.fk||G.fkey;applyFocus();return;}
  const cr=cur.getBoundingClientRect(),cx=cr.left+cr.width/2,cy=cr.top+cr.height/2;let best=null,bs=1e9;
  for(const e of l){if(e===cur)continue;const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;const ddx=x-cx,ddy=y-cy;
    const prim=dx?ddx*dx:ddy*dy;if(prim<=2)continue;const orth=dx?Math.abs(ddy):Math.abs(ddx);const s=prim+orth*2.2;if(s<bs){bs=s;best=e;}}
  if(best){best.dataset.fk=best.dataset.fk||keyOf(best);G.fkey=keyOf(best);applyFocus();snd('select',.15);}}
function activate(){const l=focusables();const e=l.find(x=>keyOf(x)===G.fkey);if(!e){moveFocus(1,0);return;}
  if(e.tagName==='SELECT'||e.tagName==='INPUT'){e.focus();return;}e.click();}
function back(){if($('#lb').classList.contains('on')){closeLB();return;}
  if($('#modal').classList.contains('on')){const x=$('#modal [data-fk="dx"],#modal [data-fk="skip"]');if(x)x.click();return;}
  if(curView()==='game'){if(G.sel){G.sel=null;render();return;}if(canAct())$('#btnPass').click();return;}
  if(curView()!=='menu'){showView('menu');menu();return;}
  if(EMBED)toParent({type:'kvent-close'});}
function zoomKey(){if($('#lb').classList.contains('on')){closeLB();return;}const l=focusables();const e=l.find(x=>keyOf(x)===G.fkey);if(e&&e.dataset.id)lightbox(e.dataset.id);}
document.addEventListener('keydown',e=>{if(e.target.matches&&e.target.matches('input,textarea,select')&&!['Escape'].includes(e.key))return;
  const k=e.key;const map={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(map[k]){e.preventDefault();moveFocus(...map[k]);}
  else if(k==='Enter'||k===' '){if(e.target.tagName==='BUTTON'&&!G.fkey)return;e.preventDefault();activate();}
  else if(k==='Escape'||k==='Backspace'){e.preventDefault();back();}
  else if(curView()==='game'&&!e.ctrlKey&&!e.metaKey){if(k==='p'||k==='P')$('#btnPass').click();else if(k==='l'||k==='L')$('#btnLeader').click();else if(k==='z'||k==='Z')zoomKey();else if(k==='m'||k==='M')$('#btnMute').click();}});
/* gamepad (PS5: 0 Cross, 1 Circle, 2 Square, 3 Triangle, 12-15 D-pad) */
let gpPrev={},gpRep=0,gpOn=false;
const gpWarned=new Set();
function gpLoop(){requestAnimationFrame(gpLoop);try{gpStep();}catch(e){const m=String(e&&e.message||e);if(!gpWarned.has(m)){gpWarned.add(m);try{console.warn('kvent gamepad',e);}catch(_){}}}}
function gpStep(){let pads=navigator.getGamepads?navigator.getGamepads():[];let p=null;for(const x of pads)if(x&&x.connected){p=x;break;}
  if(!p&&EMBED&&parent!==window){try{pads=parent.navigator.getGamepads();for(const x of pads)if(x&&x.connected){p=x;break;}}catch(e){}}/* kventgame: the pad may only be visible to the top page */
  if(p){const b=i=>p.buttons[i]&&p.buttons[i].pressed;const now={x:b(0),o:b(1),s:b(2),t:b(3),u:b(12)||p.axes[1]<-.6,d:b(13)||p.axes[1]>.6,l:b(14)||p.axes[0]<-.6,r:b(15)||p.axes[0]>.6};const T=performance.now();
    const prevS=gpPrev;gpPrev=now;const edge=k=>now[k]&&!prevS[k];const dirs=['u','d','l','r'];const anyDir=dirs.some(k=>now[k]);
    if(anyDir&&(dirs.some(k=>edge(k))||T>gpRep)){gpRep=T+(dirs.some(k=>edge(k))?320:130);if(now.u)moveFocus(0,-1);else if(now.d)moveFocus(0,1);else if(now.l)moveFocus(-1,0);else if(now.r)moveFocus(1,0);}
    if(edge('x'))activate();if(edge('o'))back();if(edge('s'))zoomKey();if(edge('t')&&curView()==='game')$('#btnLeader').click();}
}
window.addEventListener('gamepadconnected',()=>{if(!gpOn){gpOn=true;toast('Gamepad connected: D-pad move, Cross select, Circle back/pass, Square zoom, Triangle leader',3500);}});
requestAnimationFrame(gpLoop);
/* ---------- menu ---------- */
const RULES=[['winner','The winner of the last round (classic)'],['loser','The loser of the last round'],['alternate','Take turns'],['toss','Coin toss every round']];
function applyRule(){const r=LS.get('kvent.startRule',null);M.setDefaultRule(RULES.some(x=>x[0]===r)?r:null);}
function menu(){applyRule();const v=$('#v-menu');const t=K.meta().mapping;
  v.innerHTML='<div class="wrap"><div class="row" style="justify-content:space-between"><div><div class="logo">KVENT</div><div class="sub">A round-based card duel of snow, nisser and bad ideas. '+(EMBED?'':'Prototype (not in the game yet).')+'</div></div><div class="row"><button id="mtheme" title="Switch the look of the board">Theme</button><button id="mmute">Sound</button></div></div>'+
  '<div class="row" style="margin:14px 0"><button class="pri" id="mTut">Learn to play (tutorial)</button><a href="rules.html" target="_blank"><button>One-page rules card</button></a><button id="mBuild">Deck builder</button><button id="mHub">Challenges, townspeople &amp; hot-seat</button></div>'+
  '<div class="row sub" style="margin:6px 0" title="Who starts rounds 2 and 3. The classic card game: the winner of the last round starts. Change it here if you remember it differently.">Who starts rounds 2 and 3: <select id="mrule">'+RULES.map(r=>'<option value="'+r[0]+'">'+r[1]+'</option>').join('')+'</select> <span class="sub">(applies to new matches)</span></div>'+
  '<h3>Quick play: pick a faction (ready-made deck)</h3><div class="row sub" style="margin:6px 0">Opponent: <select id="qopp"><option value="">Random townsperson</option>'+OPP.map(o=>'<option value="'+o.id+'">'+esc(o.name)+' ('+esc(o.place)+')</option>').join('')+'</select></div><div class="grid4" id="qf"></div>'+
  '<p class="sub" style="margin-top:18px">30-second version: you and the opponent each play ONE card per turn onto three rows. Highest total at the end of the round wins it; win 2 of 3 rounds. You get 10 cards at the start and no new ones later. Pass when you are ahead and save your good cards. Click a card, then click the glowing row.</p></div>';
  const qf=$('#qf');for(const f of['town','rod','blaa','natt','fjord']){const L=M.LEADERS[f];const d=document.createElement('div');d.className='tile';const u=savedDeck(f);
    d.innerHTML='<div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:10px"><div class="lc" style="--cw:78px"></div><div><h3>'+FN[f]+'</h3><div class="sub">'+esc(t[f].text)+'</div><div class="sub">(classic: '+esc(t[f].classic)+')</div></div></div><div class="row" style="margin-top:8px"><button class="pri" data-fk="q'+f+'">Play ready deck</button>'+(u?'<button data-fk="s'+f+'">My saved deck</button>':'')+'</div>';
    $('.lc',d).appendChild(cardEl({id:L}));const bs=$$('button',d);bs[0].onclick=()=>quick(f,false);if(u)bs[1].onclick=()=>quick(f,true);qf.appendChild(d);}
  if(EMBED){const oid=Q.get('opponent'),o=OPP.find(x=>x.id===oid);if(o){$('#qopp').value=o.id;$('#qopp').disabled=true;v.querySelector('.wrap').insertAdjacentHTML('afterbegin','<div class="tile" style="margin-bottom:10px;border-color:var(--acc)"><b>'+esc(o.name)+'</b> <span class="sub">('+esc(o.place)+')</span><br><i>&ldquo;'+esc(o.greet)+'&rdquo;</i></div>');}}
  {const sel=$('#mrule');sel.value=LS.get('kvent.startRule',null)||(K.meta().settings||{}).startRule||'winner';sel.onchange=()=>{LS.set('kvent.startRule',sel.value);applyRule();toast('Saved: '+sel.options[sel.selectedIndex].text,2500);};}
  $('#mTut').onclick=()=>KUI.tutStart();$('#mBuild').onclick=()=>{showView('builder');KUI.builder();};$('#mHub').onclick=()=>{showView('hub');hub();};
  const th=window.KventTheme;if(th){const sy=()=>{$('#mtheme').textContent='Theme: '+(th.get()==='wood'?'Wood':'Original blue');};sy();$('#mtheme').onclick=()=>{th.set(th.get()==='wood'?'blue':'wood');menu();};}
  $('#mmute').onclick=()=>{muted=!muted;LS.set('kvent.mute',muted);$('#mmute').textContent=muted?'Sound off':'Sound on';};$('#mmute').textContent=muted?'Sound off':'Sound on';if(KUI.menuExtra)KUI.menuExtra(v);}
KUI.menu=menu;
function quick(f,saved){const sel=$('#qopp').value;const opp=sel?OPP.find(o=>o.id===sel):(()=>{const a=OPP.filter(o=>!KUI.gate||KUI.gate(o).ok);return a[Math.floor(Math.random()*a.length)]||OPP[0];})();if(KUI.gateBlocks&&KUI.gateBlocks(opp))return;LS.set('kvent.myfaction',f);startMatch(newAIMatch(profile(),deckOf(f,saved),opp));}
/* ---------- hub: townspeople, challenges, hot-seat, matches, ladder ---------- */
const FRIENDS=['Marius','Chris','Martin'];
function matchInfo(id,rec){const r=M.replay(rec.json);if(!r.ok)return{id,bad:r.error};const mt=r.match,S=mt.S,pl=mt.header.players;return{id,mt,title:(mt.header.meta||{}).title||pl[0].name+' vs '+pl[1].name,over:S.phase==='over',winner:S.winner,who:mt.who(),players:pl,updated:rec.updated,round:S.round,wins:[S.players[0].wins,S.players[1].wins]};}
function hub(){const v=$('#v-hub');const me=profile();const mats=Object.entries(loadMatches()).map(([id,r])=>matchInfo(id,r)).sort((a,b)=>(b.updated||0)-(a.updated||0));
  const inv=LS.get('kvent.invites',[]);
  const fsel=id=>'<select id="'+id+'">'+['town','rod','blaa','natt','fjord'].map(f=>'<option value="'+f+'">'+FN[f]+'</option>').join('')+'</select>';
  const sec=(t,html)=>'<h3 style="margin-top:18px">'+t+'</h3>'+html;
  const mrow=m=>{if(m.bad)return'<tr><td colspan="3" class="err">Broken match '+m.id+': '+esc(m.bad)+'</td><td><button data-del="'+m.id+'">Delete</button></td></tr>';
    let st;if(m.over)st=m.winner<0?'Draw':m.players[m.winner].name+' won';else{const w=m.who;st=w<0?'':(m.players[w].kind==='ai'?'Your move':(m.players[w].name===me?'Waiting for you':'Waiting for '+m.players[w].name));}
    return'<tr><td>'+esc(m.title)+'</td><td>Round '+Math.min(m.round,3)+' · '+m.wins.join(':')+'</td><td>'+esc(st)+'</td><td><button data-open="'+m.id+'">'+(m.over?'View':'Open')+'</button> <button data-del="'+m.id+'">Delete</button></td></tr>';};
  const mine=m=>!m.bad&&!m.over&&m.who>=0&&(m.players[m.who].kind==='ai'||m.players[m.who].name===me);
  const act=mats.filter(m=>!m.over),fin=mats.filter(m=>m.over&&!m.bad);
  const tbl=(L)=>L.length?'<table class="t">'+L.map(mrow).join('')+'</table>':'<div class="sub">none</div>';
  v.innerHTML='<div class="wrap"><div class="row" style="justify-content:space-between"><h2>Challenges &amp; matches</h2><div class="row"><span class="sub">I am</span><select id="prof">'+FRIENDS.map(f=>'<option'+(f===me?' selected':'')+'>'+f+'</option>').join('')+'</select><button id="hback">Back</button></div></div>'+
  '<p class="sub">Online and play-by-mail: challenge Chris or Martin, play a move, close the game, they answer whenever they like. The online relay is built in, so just challenge your friend. Every match can also be exported as a code.</p>'+
  sec('Waiting for you',tbl(act.filter(mine)))+sec('Waiting for others',tbl(act.filter(m=>!mine(m))))+
  sec('Play a townsperson',  '<div class="row sub">Your faction: '+fsel('myf')+' <label><input type="checkbox" id="usesaved"> use my saved deck</label></div><div class="grid4">'+OPP.map(o=>'<div class="tile"><b>'+esc(o.name)+'</b>'+(o.boss?' <span class="pill">BOSS</span>':'')+'<div class="sub">'+esc(o.place)+' · '+FN[o.faction]+' · '+esc(o.personality)+'</div><div class="sub"><i>"'+esc(o.greet)+'"</i></div><button class="pri" style="margin-top:6px" data-opp="'+o.id+'">Play</button></div>').join('')+'</div>')+
  sec('Friends: online / play-by-mail','<div id="onl"></div>')+
  sec('Hot-seat: two people, one screen','<div class="row"><input id="hn1" value="'+esc(me)+'" size="9"> '+fsel('hf1')+' <b>vs</b> <input id="hn2" value="'+esc(FRIENDS.find(f=>f!==me))+'" size="9"> '+fsel('hf2')+' <button class="pri" id="hstart">Start (cards hidden between turns)</button></div>')+
  sec('Finished matches',tbl(fin))+
  sec('Import a match','<div class="row"><input id="imp" placeholder="paste a KV1.… match code" size="50"><button id="impgo">Import &amp; verify</button></div>')+
  sec('Ladder','<div id="lad"></div>')+'</div>';
  $('#hback').onclick=()=>{showView('menu');menu();};
  $('#prof').onchange=e=>{LS.set('kvent.profile',e.target.value);hub();};
  $('#hf2').value='rod';
  $$('[data-open]',v).forEach(b=>b.onclick=()=>openSaved(b.dataset.open));
  $$('[data-del]',v).forEach(b=>b.onclick=()=>{const a=loadMatches();delete a[b.dataset.del];LS.set('kvent.matches',a);hub();});
  $$('[data-opp]',v).forEach(b=>b.onclick=()=>{const o=OPP.find(x=>x.id===b.dataset.opp);startMatch(newAIMatch(me,deckOf($('#myf').value,$('#usesaved').checked),o));});
  $$('[data-ch]',v).forEach(b=>b.onclick=()=>{const l=LS.get('kvent.invites',[]);l.push({id:'i'+Date.now().toString(36),from:me,to:b.dataset.ch,faction:$('#chf').value,seed:String(Math.random()),created:Date.now(),status:'pending'});LS.set('kvent.invites',l);hub();});
  $$('[data-acc]',v).forEach(b=>b.onclick=()=>{const l=LS.get('kvent.invites',[]);const i=l.find(x=>x.id===b.dataset.acc);const f=$('#af_'+i.id).value;i.status='accepted';LS.set('kvent.invites',l);
    const mk=M.create({hostSeed:i.seed,guestSalt:'salt'+Math.random(),players:[Object.assign({name:i.from,kind:'human'},deckOf(i.faction,true)),Object.assign({name:i.to,kind:'human'},deckOf(f,true))],meta:{title:i.from+' vs '+i.to,created:Date.now()}});store(mk);toast('Challenge accepted. Match created.');hub();});
  $$('[data-dec]',v).forEach(b=>b.onclick=()=>{const l=LS.get('kvent.invites',[]);const i=l.find(x=>x.id===b.dataset.dec);i.status='declined';LS.set('kvent.invites',l);hub();});
  $$('[data-clr]',v).forEach(b=>b.onclick=()=>{LS.set('kvent.invites',LS.get('kvent.invites',[]).filter(x=>x.id!==b.dataset.clr));hub();});
  $('#hstart').onclick=()=>{const n1=$('#hn1').value||'Player 1',n2=$('#hn2').value||'Player 2';startMatch(M.create({hostSeed:String(Math.random())+Date.now(),guestSalt:'hot',players:[Object.assign({name:n1,kind:'human'},deckOf($('#hf1').value,true)),Object.assign({name:n2,kind:'human'},deckOf($('#hf2').value,true))],meta:{title:n1+' vs '+n2+' (hot-seat)',created:Date.now()}}));};
  $('#impgo').onclick=()=>{const r=M.fromCode($('#imp').value);if(!r.ok)return toast('Import failed: '+r.error,4000);store(r.match);toast('Match imported and verified');hub();};
  ladder(fin);if(KUI.hubExtra)KUI.hubExtra(v);}
function invRow(i,me){const st=i.status;let h='<div class="tile" style="margin-top:8px"><b>'+esc(i.from)+'</b> challenged <b>'+esc(i.to)+'</b> <span class="pill">'+FN[i.faction]+'</span> <span class="pill">'+st+'</span> ';
  if(st==='pending'){h+='<div class="row" style="margin-top:6px"><span class="sub">'+esc(i.to)+' answers with</span><select id="af_'+i.id+'">'+['town','rod','blaa','natt','fjord'].map(f=>'<option value="'+f+'">'+FN[f]+'</option>').join('')+'</select><button class="pri" data-acc="'+i.id+'">'+(i.to===me?'Accept':'(mock) '+esc(i.to)+' accepts')+'</button><button data-dec="'+i.id+'">'+(i.to===me?'Decline':'(mock) declines')+'</button></div>';}
  else h+='<button data-clr="'+i.id+'">Clear</button>';return h+'</div>';}
function ladder(fin){const T={};for(const m of fin){m.players.forEach((p,i)=>{const t=T[p.name]||(T[p.name]={n:p.name,w:0,l:0,d:0,ai:p.kind==='ai'});if(m.winner<0)t.d++;else if(m.winner===i)t.w++;else t.l++;});}
  const rows=Object.values(T).sort((a,b)=>(b.w-b.l)-(a.w-a.l)||b.w-a.w);
  $('#lad').innerHTML=rows.length?'<table class="t"><tr><th>#</th><th>Player</th><th>Won</th><th>Lost</th><th>Drawn</th></tr>'+rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.n)+(r.ai?' <span class="pill">town</span>':'')+'</td><td>'+r.w+'</td><td>'+r.l+'</td><td>'+r.d+'</td></tr>').join('')+'</table>':'<div class="sub">No finished matches yet. Win one!</div>';}
KUI.hub=hub;KUI.OPPF=()=>OPP;
/* ---------- boot ---------- */
KUI.ready=Promise.all([fetch('cards.json').then(r=>r.json()),fetch('opponents.json').then(r=>r.json())]).then(([c,o])=>{K.setDB(c);DB=K.db();META=c;OPP=o.opponents;KUI.OPP=OPP;KUI.DB=DB;syncMute();menu();
  const q=new URLSearchParams(location.search);if(q.get('tutorial'))KUI.tutStart&&KUI.tutStart();
  if(EMBED){const f=Q.get('deck'),o=OPP.find(x=>x.id===Q.get('opponent'));if(f&&['town','rod','blaa','natt','fjord'].includes(f)&&o)startMatch(newAIMatch(profile(),deckOf(f,true),o));toParent({type:'kvent-ready'});}if(KUI.boot)KUI.boot();}).catch(e=>{document.body.insertAdjacentHTML('afterbegin','<p style="padding:20px;color:#c0392b">Could not load cards.json. Open this page through the game server (localhost:8770/build/kvent/prototype.html). '+esc(e.message)+'</p>');});
})();
