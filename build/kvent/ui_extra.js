/* KVENT prototype: deck builder + step-by-step tutorial */
(function(){
'use strict';
const U=window.KUI,K=U.K,M=U.M,$=U.$,$$=U.$$,LS=U.LS,esc=U.esc,G=U.G;
const FN={town:'Town Folk',rod:'Rødnisser',blaa:'Blånisser',natt:'Night Creatures',fjord:'Fjord Folk',neutral:'Neutral'};
/* ================= DECK BUILDER ================= */
const B={f:'town',leader:null,counts:{},src:'all',type:'all',q:''};
function loadDeck(f){const d=LS.get('kvent.decks.v1',{})[f];B.f=f;B.counts={};if(d){B.leader=d.leader;for(const id of d.cards)B.counts[id]=(B.counts[id]||0)+1;}else{B.leader=M.LEADERS[f];for(const id of M.readyDeck(f))B.counts[id]=(B.counts[id]||0)+1;}}
function deckList(){const a=[];for(const[id,n]of Object.entries(B.counts))for(let i=0;i<n;i++)a.push(id);return a;}
U.builder=function(){const v=$('#v-builder');if(!B.leader)loadDeck(B.f);
  v.innerHTML='<div class="wrap"><div class="row" style="justify-content:space-between"><h2>Deck builder</h2><div class="row"><button id="bpacks">Card packs</button><button id="bback">Back</button></div></div><p class="sub">Classic rules: at least 22 unit cards, at most 10 special cards (weather, horn, blaze, dummy), exactly one leader. Click a card to add it, click it in the list to remove it.</p>'+
  '<div class="row" id="bf"></div><div class="row" style="margin-top:8px">Leader: <span id="bl" class="row"></span></div>'+
  '<div class="bgrid"><div><div class="row"><select id="bsrc"><option value="all">Faction + neutral</option><option value="faction">Faction only</option><option value="neutral">Neutral only</option></select><select id="btype"><option value="all">All types</option><option value="unit">Units</option><option value="special">Specials</option></select><input id="bq" placeholder="search name or ability" size="18"></div><div id="coll"></div></div>'+
  '<div class="tile"><h3>Your deck</h3><div id="bstat" class="sub"></div><div id="berr" class="err"></div><div class="row" style="margin:8px 0"><button class="pri" id="bsave">Save</button><button id="bready">Ready deck</button><button id="bclear">Clear</button><button id="bplay">Save &amp; play</button></div><div id="dl"></div></div></div></div>';
  $('#bback').onclick=()=>{U.showView('menu');U.menu();};$('#bpacks').onclick=()=>U.go('packs');
  $('#bf').innerHTML=['town','rod','blaa','natt','fjord'].map(f=>'<button data-f="'+f+'" class="'+(f===B.f?'pri':'')+'">'+FN[f]+'</button>').join('');
  $$('#bf button').forEach(b=>b.onclick=()=>{loadDeck(b.dataset.f);U.builder();});
  $('#bsrc').value=B.src;$('#btype').value=B.type;$('#bq').value=B.q;
  $('#bsrc').onchange=e=>{B.src=e.target.value;coll();};$('#btype').onchange=e=>{B.type=e.target.value;coll();};$('#bq').oninput=e=>{B.q=e.target.value;coll();};
  const lds=Object.values(K.db()).filter(c=>c.type==='leader'&&c.faction===B.f);const bl=$('#bl');
  for(const l of lds){const w=document.createElement('div');w.style.cssText='--cw:70px;position:relative';const e=U.cardEl({id:l.id});e.dataset.fk='L'+l.id;const lown=U.ownLimit?U.ownLimit(l.id):1;if(!lown)e.classList.add('unowned');if(B.leader===l.id)e.classList.add('sel');e.onclick=()=>{if(!lown)return U.toast('Leader not in your collection yet. Open card packs.',2800);B.leader=l.id;U.builder();};w.appendChild(e);bl.appendChild(w);}
  $('#bsave').onclick=()=>save(false);$('#bplay').onclick=()=>save(true);
  $('#bready').onclick=()=>{B.counts={};for(const id of M.readyDeck(B.f))B.counts[id]=(B.counts[id]||0)+1;B.leader=M.LEADERS[B.f];U.builder();};
  $('#bclear').onclick=()=>{B.counts={};coll();list();};
  coll();list();};
function coll(){const c=$('#coll');c.innerHTML='';const q=B.q.toLowerCase();const T=K.meta().terms;
  const arr=Object.values(K.db()).filter(d=>d.type!=='leader'&&(B.src==='all'?(d.faction===B.f||d.faction==='neutral'):B.src==='faction'?d.faction===B.f:d.faction==='neutral')&&(B.type==='all'||(B.type==='unit'?d.type==='unit':d.type!=='unit'))&&(!q||(d.name+' '+(d.abil||'')+' '+(d.text||'')).toLowerCase().includes(q)));
  arr.sort((a,b)=>(a.faction===b.faction?0:a.faction==='neutral'?1:-1)||(a.type==='unit'?0:1)-(b.type==='unit'?0:1)||b.power-a.power);
  for(const d of arr){const w=document.createElement('div');w.className='cw';const e=U.cardEl({id:d.id});e.dataset.fk='C'+d.id;const n=B.counts[d.id]||0;const own=U.ownLimit?U.ownLimit(d.id):d.copies;if(!own)e.classList.add('unowned');
    e.onclick=()=>{if(!own)return U.toast('Not in your collection yet. Open card packs to find it.',2800);if((B.counts[d.id]||0)>=own)return U.toast(own<d.copies?'You only own '+own+' of '+d.name:'Max '+d.copies+' copies of '+d.name);B.counts[d.id]=(B.counts[d.id]||0)+1;U.snd('select');coll();list();};
    w.appendChild(e);if(!own)w.insertAdjacentHTML('beforeend','<span class="cnt lock">locked</span>');else if(n)w.insertAdjacentHTML('beforeend','<span class="cnt">'+n+'/'+own+'</span>');else if(own>1)w.insertAdjacentHTML('beforeend','<span class="cnt" style="background:#556">x'+own+'</span>');if(U.ownedCount&&U.ownedCount(d.id)>(d.copies||1)*0&&((U.loadColl().cards||{})[d.id]>0))w.insertAdjacentHTML('beforeend','<span class="cnt" style="background:#1f9d55;right:auto;left:-2px" title="from a card pack">PACK</span>');c.appendChild(w);}}
function list(){const D=K.db();const cards=deckList();const v=K.validateDeck({faction:B.f,leader:B.leader,cards});const dl=$('#dl');
  const ids=Object.keys(B.counts).filter(i=>B.counts[i]>0).sort((a,b)=>(D[a].type==='unit'?0:1)-(D[b].type==='unit'?0:1)||D[b].power-D[a].power);
  dl.innerHTML=ids.map(id=>'<div class="dr" data-id="'+id+'" data-fk="D'+id+'"><b>'+B.counts[id]+'x</b><span>'+esc(D[id].name)+'</span><span>'+(D[id].type==='unit'?D[id].power:'special')+'</span></div>').join('')||'<div class="sub">empty</div>';
  $$('.dr',dl).forEach(r=>r.onclick=()=>{const id=r.dataset.id;B.counts[id]--;if(B.counts[id]<=0)delete B.counts[id];coll();list();});
  let pw=0;for(const id of cards)if(D[id].type==='unit')pw+=D[id].power;
  $('#bstat').innerHTML='Units <b class="'+(v.units>=22?'good':'')+'">'+v.units+'/22+</b> · Specials <b class="'+(v.specials<=10?'good':'')+'">'+v.specials+'/10</b> · Legends '+cards.filter(i=>D[i].hero).length+' · total unit power '+pw;
  $('#berr').innerHTML=v.errors.map(esc).join('<br>');return v;}
function save(play){const cards=deckList();const v=K.validateDeck({faction:B.f,leader:B.leader,cards});if(!v.ok)return U.toast('Not saved: '+v.errors[0],3500);
  const all=LS.get('kvent.decks.v1',{});all[B.f]={leader:B.leader,cards};LS.set('kvent.decks.v1',all);U.toast('Deck saved');
  if(play){const qq=new URLSearchParams(location.search);const pool=U.OPP.filter(o=>!U.gate||U.gate(o).ok);const fx=U.OPP.find(o=>o.id===qq.get('opponent'));const opp=(fx&&(!U.gate||U.gate(fx).ok))?fx:(pool.length?pool[Math.floor(Math.random()*pool.length)]:U.OPP[0]);if(U.gateBlocks&&U.gateBlocks(opp))return;U.startMatch(U.newAIMatch(qq.get('player')||LS.get('kvent.profile','Marius'),{faction:B.f,leader:B.leader,cards},opp));}}
/* ================= TUTORIAL ================= */
function sc(f){const S=K.scenario({names:['You','Opponent'],factions:[f||'town','town']});return S;}
function oppPass(S){S.players[1].passed=true;}
const STEPS=[
 {title:'The goal',try:false,hl:['.rb .rs b','#pMe .tot','#pOpp .tot','.hearts'],
  setup(){const S=sc();K.put(S,0,'close','n_rusty');K.put(S,0,'close','t_even');K.put(S,0,'ranged','t_torill');K.put(S,1,'close','t_gunnar');K.put(S,1,'siege','t_sven');K.give(S,0,'t_knut');K.give(S,0,'t_mads');K.give(S,0,'w_frost');return S;},
  text:'Each side has <b>three rows</b>: <b>Street</b> (classic: Close Combat), <b>Rooftops</b> (Ranged) and <b>Workshop</b> (Siege). Every unit card has a power number. The circle at the start of a row is that row\'s score; the big number in the side panel is your <b>total</b> (here 17 against 12).<br><br>The round goes to whoever has the <b>higher total when both players have passed</b>. The loser of a round loses a heart; lose both hearts and the match is gone. So it is <b>best of 3 rounds</b>: win two. Equal totals: <b>both lose a heart</b> (only the Blånisser win ties).'},
 {title:'Your hand, redraws and rounds',try:false,hl:['#hand','#pMe .sub'],
  setup(){const S=sc();K.put(S,0,'close','n_rusty');K.put(S,1,'close','t_gunnar');for(const id of['t_knut','t_mads','t_torill','t_even'])K.give(S,0,id);return S;},
  text:'At the start you get <b>10 cards</b> and may <b>redraw 2</b> of them, once. After that <b>nobody draws new cards</b>: your hand has to last all three rounds (only faction powers can give you cards). That is why you should not spend everything in round 1.<br><br>When a round ends, <b>every card on the board goes to the discard pile</b> (the Night Creatures keep one random unit). The next round is started by <b>the winner of the last round</b> (the first round by a coin toss; you can change this rule on the menu). A deck has at least <b>22 units</b>, at most <b>10 specials</b> and exactly <b>one leader</b>.'},
 {title:'Your turn: play a card or pass',try:true,hl:['#hand','#btnPass'],
  setup(){const S=sc();K.put(S,0,'close','n_rusty');K.put(S,1,'close','t_gunnar');K.put(S,1,'close','t_even');oppPass(S);K.give(S,0,'t_knut');K.give(S,0,'t_mads');K.give(S,0,'t_torill');return S;},
  text:'On your turn you play <b>one card</b> from your hand onto its row, or you <b>pass</b>. A pass ends the round for you: you cannot play again, but the opponent may keep playing. When both have passed, the round is scored.<br><br><b>Try it:</b> the opponent already passed with <b>13</b>. Click a card (the right row lights up), then click the row (or click the card again). Get above 13, then press <b>Pass</b> (twice, it asks to confirm).',
  hint(S){const a=K.total(S,0),b=K.total(S,1);return a>b?'You lead '+a+' : '+b+'. Now press Pass to take the round.':'You have '+a+' against '+b+'. Play another card.';},
  fail:'You passed while behind, so the opponent won the round. In a real match you would concede like this on purpose to save cards. Try again.'},
 {title:'Weather hits everyone',try:true,hl:['#hand','#wxBox'],
  setup(){const S=sc();K.put(S,0,'close','t_bjorn');K.put(S,0,'ranged','t_mads');K.put(S,0,'siege','t_sven');K.put(S,1,'close','t_gunnar');K.put(S,1,'close','t_even');K.put(S,1,'close','t_knut');K.put(S,1,'ranged','t_torill');oppPass(S);K.give(S,0,'w_frost');K.give(S,0,'t_gunnar');return S;},
  text:'Special cards are not units. <b>Snowstorm</b> (classic: Biting Frost) makes every non-Legend unit on <b>both</b> Streets worth just 1. Fog does the same to the Rooftops, Rain to the Workshops, and Thaw cancels all weather. Gold-framed <b>Legends</b> ignore it.<br><br><b>Try it:</b> the opponent passed with a mighty Street, <b>22</b> in total, and you only have <b>14</b>. A plain unit is not enough. Which card turns it around?',
  hint(S){const a=K.total(S,0),b=K.total(S,1);return a>b?'You lead '+a+' : '+b+'. Pass to win!':'You have '+a+' against '+b+'. Think about the other card.';},
  fail:'Not enough. Playing the 6-power unit only makes 20 against 22. The Snowstorm shrinks their big Street (and your tiny one) to 1 per unit. Try again.'},
 {title:'Card abilities',try:false,hl:['.rb[data-side="0"][data-row="close"]'],
  setup(){const S=sc();for(let i=0;i<3;i++)K.put(S,0,'close','t_brann');K.put(S,0,'siege','t_kiosk');K.put(S,0,'siege','t_sven');K.put(S,1,'close','t_gunnar');return S;},
  text:'Abilities are printed on the cards (hover or long-press a card to read it). Classic name in brackets:<br><ul style="margin:6px 0;padding-left:18px"><li><b>Pals</b> (Tight Bond): same-name units in a row multiply each other. Three Fire Brigades: 12+12+12 = 36 here!</li><li><b>Cheer</b> (Morale Boost): +1 to every other unit in the row.</li><li><b>Gang</b> (Muster): pulls every card of the same gang from your deck and hand.</li><li><b>Healer</b> (Medic): bring a unit back from your discard pile.</li><li><b>Turncoat</b> (Spy): plays on the OPPONENT\'s side, but you draw 2 cards.</li><li><b>Yule Horn</b> (Commander\'s Horn): doubles a whole row. <b>Blaze</b> (Scorch): burns the strongest unit(s).</li><li><b>Dummy</b> (Decoy): swap it with one of YOUR units on the board (not a Legend); the unit returns to your hand. It even works on a Turncoat standing on your side: you take it and can play it again.</li><li><b>Legend</b> (Hero): gold frame, immune to weather, Horn, Blaze, Dummy and Healers.</li></ul>Weather sets a row to 1 for <b>both</b> sides. A Yule Horn doubles one row (one horn per row). Blaze (special) burns the strongest unit(s) on the whole board, ties included, yours too. A Turncoat is scored by the opponent and ends in <b>the graveyard of the side it stood on</b>. Agile units choose Street or Rooftops when played, and stay there.'},
 {title:'Factions and leaders',try:false,hl:['#btnLeader','#pMe .lead'],
  setup(){const S=sc();K.put(S,0,'close','n_rusty');K.put(S,1,'close','t_gunnar');K.give(S,0,'t_knut');return S;},
  text:'Every deck has <b>one Leader</b>. Its power works <b>once per match</b> and costs your turn (button at the bottom right; the ability is written next to the leader and on its card). There are 18 leader powers: clear weather, play a weather card from your deck, double a row, burn an enemy row (if it has 10 or more), look at 3 enemy cards, take a card from a discard pile, cancel the enemy leader, discard 2 and pick 1 from the deck, and more.<br><br>Each faction also has a <b>passive</b>: Town Folk draw a card after winning a round, Rødnisser decide who starts round 1, Blånisser win ties, Night Creatures keep a unit after each round, Fjord Folk bring 2 units back from the discard pile in round 3.'},
 {title:'Try Pals',try:true,hl:['#hand'],
  setup(){const S=sc();K.put(S,0,'siege','t_sven');for(const id of['n_rusty','t_even','t_gunnar','t_knut'])K.put(S,1,'close',id);K.put(S,1,'ranged','t_mads');K.put(S,1,'ranged','t_torill');oppPass(S);for(let i=0;i<3;i++)K.give(S,0,'t_brann');K.give(S,0,'t_bokbuss');K.give(S,0,'t_kiosk');return S;},
  text:'<b>Final try:</b> the opponent passed with <b>33</b>. You have 6, and a hand of Fire Brigades (4 each), a Book Bus (5) and a Hot Dog Stand (1, gives Cheer). Find the play that wins. Remember: you can keep playing cards because the opponent has passed.',
  hint(S){const a=K.total(S,0),b=K.total(S,1);return a>b?'You lead '+a+' : '+b+'. Pass!':'You have '+a+' against '+b+'.';},
  fail:'Not quite. The three Fire Brigades are worth 4, then 16, then 36 together: Pals multiply. Try again.',done:'That is the game! You now know the rules. Next: the rules card for leaders and factions, the deck builder, or just play a quick match.'}
];
let coachEl=null;
U.tutStart=function(){const t=G.tut={i:0,locked:true,result:null,hint:''};if(G.sess)G.sess.stop();G.sess=null;G.mt=null;G.view=0;G.hot=false;G.covered=false;U.showView('game');load(0);};
function load(i){const t=G.tut,st=STEPS[i];t.i=i;t.result=null;t.hint='';t.locked=!st.try;G.snap=null;G.sel=null;G.S=st.setup();G.S.ev.length=0;G.fkey=null;U.render();}
U.tutExit=function(){if(coachEl){coachEl.remove();coachEl=null;}$('#gameGrid').classList.remove('tut');G.tut=null;G.S=null;U.showView('menu');U.menu();};
U.tutAfter=function(a){const t=G.tut;if(!t)return;const st=STEPS[t.i];if(!st.try)return;const S=G.S;
  if(S.history.length){const ok=S.lastRound.winner===0;t.result={ok};t.locked=true;t.hint=ok?'You won the round '+S.lastRound.t[0]+' : '+S.lastRound.t[1]+'!':st.fail;}
  else t.hint=st.hint(S);};
U.tutRender=function(){const t=G.tut;if(!t)return;const st=STEPS[t.i];const narrow=window.innerWidth<=900;
  if(!coachEl){coachEl=document.createElement('div');coachEl.id='coach';}
  $('#gameGrid').classList.add('tut');
  const host=narrow?document.body:$('#right');if(coachEl.parentNode!==host)host.insertBefore(coachEl,narrow?null:host.firstChild);
  coachEl.style.cssText=narrow?'position:fixed;left:6px;right:6px;bottom:6px;top:auto;transform:none;width:auto;max-height:44vh;overflow:auto;font-size:13px':'position:static;transform:none;width:auto;max-height:calc(100vh - 290px);overflow:auto;font-size:12.5px';
  const last=t.i===STEPS.length-1;const canNext=!st.try||(t.result&&t.result.ok);
  coachEl.innerHTML='<h3>'+(t.i+1)+'/'+STEPS.length+': '+esc(st.title)+'</h3><div class="dots">'+STEPS.map((x,i)=>'<span class="'+(i<=t.i?'on':'')+'"></span>').join('')+'</div><div style="margin-top:6px">'+st.text+'</div>'+
   (t.hint?'<p class="'+(t.result?(t.result.ok?'ok':'bad'):'')+'" style="margin:8px 0">'+esc(t.hint)+(t.result&&t.result.ok&&last?'<br>'+esc(st.done):'')+'</p>':'')+
   '<div class="row" style="margin-top:8px">'+(t.i>0?'<button data-fk="tb">Back</button>':'')+(st.try&&t.result&&!t.result.ok?'<button class="pri" data-fk="tr">Try again</button>':'')+(st.try&&!t.result?'<button data-fk="tr">Reset</button>':'')+'<button class="pri" data-fk="tn"'+(canNext?'':' disabled')+'>'+(last?'Finish':'Next')+'</button><button data-fk="tx">Quit tutorial</button></div>';
  const g=n=>coachEl.querySelector('[data-fk="'+n+'"]');
  if(g('tb'))g('tb').onclick=()=>load(t.i-1);if(g('tr'))g('tr').onclick=()=>load(t.i);
  g('tn').onclick=()=>{if(last){U.tutExit();}else load(t.i+1);};g('tx').onclick=U.tutExit;
  $$('.hl').forEach(e=>e.classList.remove('hl'));for(const s of st.hl||[])$$(s).forEach(e=>e.classList.add('hl'));};
const css=document.createElement('style');css.textContent='#gameGrid.tut{grid-template-columns:168px minmax(0,1fr) 340px}#gameGrid.tut #log{display:none}#gameGrid.tut #zoom{min-height:0;--cw:64px;font-size:11.5px}@media (max-width:900px){#gameGrid.tut{grid-template-columns:104px minmax(0,1fr)}}';document.head.appendChild(css);
const old=U.showView;U.showView=function(id){if(id!=='game'&&coachEl){coachEl.remove();coachEl=null;}return old(id);};
})();
