/* KVENT rules engine (own original game; rules mirror the classic 2015 card game so players that know it feel at home).
   Pure logic, no DOM. Works in the browser (window.Kvent) and in node (require). State is plain JSON so the AI can clone it. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Kvent=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const ROWS=['close','ranged','siege'];
const WROW={frost:'close',fog:'ranged',rain:'siege'};
let DB={},META={};
function setDB(j){DB={};for(const c of j.cards)DB[c.id]=c;META=j;return DB;}
const def=id=>DB[id];
/* ---- rng ---- */
function rnd(S){S.seed=(S.seed+0x6D2B79F5)|0;let t=Math.imul(S.seed^(S.seed>>>15),1|S.seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}
function shuffle(S,a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd(S)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function inst(S,id,owner){const c=DB[id];if(!c)throw new Error('unknown card '+id);return{uid:++S.uid,id,owner,name:c.name,type:c.type,power:c.power,row:c.row,abil:c.abil,hero:!!c.hero,group:c.group,eff:c.eff||null,decoy:false};}
const emptyRows=()=>({close:{units:[],horn:null},ranged:{units:[],horn:null},siege:{units:[],horn:null}});
function newPlayer(d){return{faction:d.faction,leader:{id:d.leader,used:false,disabled:false},deck:[],hand:[],discard:[],rows:emptyRows(),lives:2,passed:false,wins:0,name:d.name||'',mull:false};}
function blank(seed){return{seed:seed|0||1,uid:0,players:[],weather:{frost:false,fog:false,rain:false},weatherCards:[],round:1,turn:0,first:0,startRule:null,startedRound:0,phase:'mulligan',pending:null,log:[],ev:[],history:[],winner:null,peeks:[[],[]],lastRound:null,sim:false};}
function logp(S,s){if(S.sim)return;S.log.push(s);if(S.log.length>60)S.log.shift();}
function evt(S,e){if(S.sim)return;S.ev.push(e);}
/* ---- deck rules ---- */
function validateDeck(d){const err=[];let units=0,spec=0;const cnt={};
  const L=DB[d.leader];if(!L||L.type!=='leader'||L.faction!==d.faction)err.push('Pick a leader of your faction.');
  for(const id of d.cards){const c=DB[id];if(!c){err.push('Unknown card '+id);continue;}
    if(c.type==='leader'){err.push('Leaders are not deck cards.');continue;}
    if(c.faction!==d.faction&&c.faction!=='neutral')err.push(c.name+' does not belong to this faction.');
    cnt[id]=(cnt[id]||0)+1;if(cnt[id]>c.copies)err.push('Too many copies of '+c.name+' (max '+c.copies+').');
    if(c.type==='unit')units++;else spec++;}
  if(units<22)err.push('Need at least 22 unit cards (have '+units+').');
  if(spec>10)err.push('At most 10 special cards (have '+spec+').');
  return{ok:!err.length,errors:err,units,specials:spec};}
/* ---- new game ---- */
function startRuleOf(S){const r=S.startRule||((META.settings||{}).startRule)||'winner';return r;}
function newGame(o){const S=blank(o.seed||((Math.random()*2**31)|0)||1);S.startRule=(o.startRule&&['winner','loser','alternate','toss'].includes(o.startRule))?o.startRule:null;
  for(let i=0;i<2;i++){const d=o.decks[i];const P=newPlayer(d);P.name=d.name||('Player '+(i+1));S.players.push(P);
    for(const id of d.cards)P.deck.push(inst(S,id,i));shuffle(S,P.deck);
    const n=10+((DB[d.leader]||{}).leader==='extra'?1:0);for(let k=0;k<n;k++)draw(S,i);}
  logp(S,'The cards are dealt. Redraw up to 2 cards.');evt(S,{t:'deal'});return S;}
function draw(S,p,n){const P=S.players[p];n=n||1;let got=0;for(let i=0;i<n;i++){const c=P.deck.pop();if(!c)break;P.hand.push(c);got++;}return got;}
function findIn(a,uid){return a.findIndex(c=>c.uid===uid);}
function mulligan(S,p,uids){const P=S.players[p];if(S.phase!=='mulligan'||P.mull)return{ok:false,err:'no mulligan'};
  uids=(uids||[]).slice(0,2);const out=[];
  for(const u of uids){const i=findIn(P.hand,u);if(i<0)continue;out.push(P.hand.splice(i,1)[0]);}
  const n=out.length;for(let k=0;k<n;k++)draw(S,p);P.deck.push(...out);shuffle(S,P.deck);
  P.mull=true;logp(S,P.name+' redraws '+n+' card'+(n===1?'':'s')+'.');
  if(S.players[0].mull&&S.players[1].mull)beginPlay(S);return{ok:true};}
function passiveOf(S,p){const f=S.players[p].faction;return(META.mapping[f]||{}).passive;}
function beginPlay(S){const a=passiveOf(S,0)==='first',b=passiveOf(S,1)==='first';
  if(a!==b){S.phase='first';S.pending={kind:'first',player:a?0:1};logp(S,S.players[S.pending.player].name+' (Rødnisser) decides who starts.');}
  else{S.first=rnd(S)<.5?0:1;startRound(S,S.first);logp(S,'Coin toss: '+S.players[S.first].name+' starts.');}}
function chooseFirst(S,p,who){if(!S.pending||S.pending.kind!=='first'||S.pending.player!==p)return{ok:false,err:'not now'};
  S.pending=null;S.first=who;startRound(S,who);logp(S,S.players[who].name+' starts.');return{ok:true};}
function startRound(S,first){S.phase='play';S.turn=first;S.startedRound=first;evt(S,{t:'round',n:S.round});}
/* ---- scoring ---- */
function weatherOn(S,row){return(row==='close'&&S.weather.frost)||(row==='ranged'&&S.weather.fog)||(row==='siege'&&S.weather.rain);}
function leaderIs(S,p,k){const P=S.players[p];const L=DB[P.leader.id];return!!L&&L.leader===k&&!P.leader.disabled;}
function rowPowers(S,p,row){const R=S.players[p].rows[row],U=R.units,wx=weatherOn(S,row);const bond={};let morale=0,horns=0;
  for(const u of U){if(u.decoy)continue;if(u.abil==='bond')bond[u.group]=(bond[u.group]||0)+1;if(u.abil==='morale')morale++;if(u.abil==='horn')horns++;}
  const half=leaderIs(S,p,'halfwx');
  return U.map(u=>{if(u.decoy)return 0;if(u.hero)return u.power;let v=wx?(half?Math.max(1,Math.ceil(u.power/2)):1):u.power;if(u.abil==='bond')v*=bond[u.group];
    v+=morale-(u.abil==='morale'?1:0);
    const h=!!R.horn||(horns-(u.abil==='horn'?1:0))>0;return h?v*2:v;});}
function rowTotal(S,p,row){let s=0;for(const v of rowPowers(S,p,row))s+=v;return s;}
function total(S,p){let s=0;for(const r of ROWS)s+=rowTotal(S,p,r);return s;}
function allUnits(S,filter){const out=[];for(let p=0;p<2;p++)for(const r of ROWS){const pw=rowPowers(S,p,r);S.players[p].rows[r].units.forEach((u,i)=>{if(!filter||filter(u))out.push({u,p,row:r,pw:pw[i]});});}return out;}
/* ---- moving cards ---- */
function toDiscard(S,c){c.decoy=false;S.players[c.owner].discard.push(c);}
function removeFromBoard(S,p,row,u){const a=S.players[p].rows[row].units;const i=a.indexOf(u);if(i>=0)a.splice(i,1);}
function burn(S,list){for(const e of list){removeFromBoard(S,e.p,e.row,e.u);toDiscard(S,e.u);logp(S,e.u.name+' burns up.');}if(list.length)evt(S,{t:'scorch',uids:list.map(e=>e.u.uid)});}
function scorchAll(S){const L=allUnits(S,u=>!u.hero&&!u.decoy);if(!L.length)return 0;const m=Math.max(...L.map(e=>e.pw));const k=L.filter(e=>e.pw===m);burn(S,k);return k.length;}
function scorchRow(S,target,row){if(rowTotal(S,target,row)<10)return 0;const pw=rowPowers(S,target,row);const L=[];S.players[target].rows[row].units.forEach((u,i)=>{if(!u.hero&&!u.decoy)L.push({u,p:target,row,pw:pw[i]});});if(!L.length)return 0;const m=Math.max(...L.map(e=>e.pw));const k=L.filter(e=>e.pw===m);burn(S,k);return k.length;}
function medicOptions(S,p){return S.players[p].discard.filter(c=>c.type==='unit'&&!c.hero);}
function pickOptions(S,p){return S.players[p].discard.filter(c=>c.type!=='leader');}
function bestAgileRow(S,p,u){// choose the better of close/ranged for an agile unit
  let best='close',bv=-1e9;for(const r of['close','ranged']){const R=S.players[p].rows[r];let v=weatherOn(S,r)?(leaderIs(S,p,'halfwx')?Math.max(1,Math.ceil(u.power/2)):1):u.power;if(R.horn)v*=2;v+=R.units.filter(x=>x.abil==='morale').length;if(u.abil==='bond')v*=1+R.units.filter(x=>x.abil==='bond'&&x.group===u.group).length;if(v>bv){bv=v;best=r;}}return best;}
/* place a unit; side = whose board it lands on */
function placeUnit(S,p,c,row,how){how=how||{};const spy=c.abil==='spy';const side=spy?1-p:p;
  if(c.row==='agile'){if(row!=='close'&&row!=='ranged')row=bestAgileRow(S,side,c);}else row=c.row;
  c.owner=side;S.players[side].rows[row].units.push(c);evt(S,{t:'place',uid:c.uid,side,row});
  if(how.muster)return;
  if(spy){const n=draw(S,p,2);logp(S,S.players[p].name+' turns '+c.name+' on '+S.players[1-p].name+' and draws '+n+'.');evt(S,{t:'spy'});}
  if(c.abil==='muster'&&c.group){let n=0;const P=S.players[p];
    for(const src of[P.deck,P.hand]){for(let i=src.length-1;i>=0;i--){const x=src[i];if(x.type==='unit'&&x.abil==='muster'&&x.group===c.group){src.splice(i,1);placeUnit(S,p,x,x.row,{muster:true});n++;}}}
    if(n)logp(S,'The gang answers: '+n+' more '+c.name+(n>1?'s':'')+' arrive.');}
  if(c.abil&&c.abil.startsWith('scorch_')){const r=c.abil.slice(7);const k=scorchRow(S,1-p,r);if(k)logp(S,c.name+' blazes the enemy '+r+': '+k+' unit(s) burn.');}
  if(c.abil==='medic'&&!how.noMedic){const o=medicOptions(S,p);if(o.length)S.pending={kind:'medic',player:p,options:o.map(x=>x.uid),next:null};}
}
function clearWeather(S){S.weather={frost:false,fog:false,rain:false};for(const c of S.weatherCards)toDiscard(S,c);S.weatherCards=[];evt(S,{t:'weather',kind:'clear'});}
function setWeather(S,eff,card){if(eff==='clear'){clearWeather(S);if(card)toDiscard(S,card);return;}
  if(S.weather[eff]){if(card)toDiscard(S,card);}else{S.weather[eff]=true;if(card)S.weatherCards.push(card);}evt(S,{t:'weather',kind:eff});}
/* ---- leaders ---- */
function leaderDef(S,p){return DB[S.players[p].leader.id];}
const ACTIVE_NO=['extra','halfwx'];
function leaderReady(S,p){const P=S.players[p];if(P.leader.used||P.leader.disabled)return false;return!ACTIVE_NO.includes(leaderDef(S,p).leader);}
function deckWeather(S,p){return S.players[p].deck.filter(c=>c.type==='weather'&&c.eff!=='clear');}
function leaderUsable(S,p){const P=S.players[p];if(P.leader.used||P.leader.disabled)return false;const L=leaderDef(S,p).leader;
  if(ACTIVE_NO.includes(L))return false;
  if(L.endsWith('_from_deck')){const e=L.split('_')[0];return P.deck.some(c=>c.eff===e);}
  if(L==='weather_any')return deckWeather(S,p).length>0;
  if(L.startsWith('horn_'))return!P.rows[L.slice(5)].horn;
  if(L==='raise')return pickOptions(S,1-p).length>0;
  if(L==='recall')return pickOptions(S,p).length>0;
  if(L==='peek')return S.players[1-p].hand.length>0;
  if(L==='cull')return P.hand.length>=1&&P.deck.length>=1;
  if(L==='cancel')return leaderReady(S,1-p);
  if(L==='reshuffle')return S.players[0].discard.length+S.players[1].discard.length>0;
  return true;}
function useLeader(S,p,a){const P=S.players[p],L=leaderDef(S,p).leader;if(!leaderUsable(S,p))return{ok:false,err:'leader not usable'};
  P.leader.used=true;logp(S,P.name+' uses the leader: '+leaderDef(S,p).name+'.');evt(S,{t:'leader',p});
  if(L==='clear')clearWeather(S);
  else if(L.endsWith('_from_deck')){const e=L.split('_')[0];const i=P.deck.findIndex(c=>c.eff===e);const c=P.deck.splice(i,1)[0];setWeather(S,e,c);}
  else if(L==='weather_any'){const o=deckWeather(S,p);const x=a&&a.target?o.find(c=>c.uid===a.target):null;if(x)playFromDeck(S,p,x.uid);else S.pending={kind:'wxpick',player:p,options:o.map(c=>c.uid)};}
  else if(L.startsWith('horn_')){P.rows[L.slice(5)].horn={uid:++S.uid,id:'leader_horn',name:'Leader Horn',owner:p,type:'special',eff:'horn'};evt(S,{t:'horn'});}
  else if(L.startsWith('scorch_')){scorchRow(S,1-p,L.slice(7));}
  else if(L==='peek'){const h=S.players[1-p].hand.slice();shuffle(S,h);S.peeks[p]=h.slice(0,3).map(c=>c.name);logp(S,P.name+' peeks: '+S.peeks[p].join(', ')+'.');}
  else if(L==='raise'||L==='recall'){const src=L==='raise'?1-p:p;const o=pickOptions(S,src);if(a&&a.target){const x=o.find(c=>c.uid===a.target);if(x)raise(S,p,x.uid,src);}else S.pending={kind:L,player:p,options:o.map(c=>c.uid)};}
  else if(L==='cull'){S.pending={kind:'cull',player:p,need:Math.min(2,P.hand.length),options:P.hand.map(c=>c.uid)};}
  else if(L==='cancel'){S.players[1-p].leader.disabled=true;logp(S,S.players[1-p].name+"'s leader is cancelled.");}
  else if(L==='reshuffle'){for(let q=0;q<2;q++){const Q=S.players[q];for(const c of Q.discard.splice(0)){const d=DB[c.id];c.power=d.power;c.decoy=false;c.owner=q;Q.deck.push(c);}shuffle(S,Q.deck);}logp(S,'Both discard piles are shuffled back into the decks.');}
  return{ok:true};}
function playFromDeck(S,p,uid){const P=S.players[p];const i=findIn(P.deck,uid);if(i<0)return;const c=P.deck.splice(i,1)[0];setWeather(S,c.eff,c);}
function raise(S,p,uid,src){const d=S.players[src===undefined?1-p:src].discard;const i=findIn(d,uid);if(i<0)return;const c=d.splice(i,1)[0];c.owner=p;c.decoy=false;S.players[p].hand.push(c);}
/* ---- actions ---- */
function legal(S,p){const P=S.players[p],acts=[];
  for(const c of P.hand){
    if(c.type==='unit'){for(const r of(c.row==='agile'?['close','ranged']:[c.row]))acts.push({t:'play',uid:c.uid,row:r});}
    else if(c.type==='weather')acts.push({t:'play',uid:c.uid});
    else if(c.eff==='scorch')acts.push({t:'play',uid:c.uid});
    else if(c.eff==='horn'){for(const r of ROWS)if(!P.rows[r].horn)acts.push({t:'play',uid:c.uid,row:r});}
    else if(c.eff==='decoy'){for(const r of ROWS)for(const u of P.rows[r].units)if(!u.hero&&!u.decoy)acts.push({t:'play',uid:c.uid,target:u.uid});}}
  if(leaderUsable(S,p))acts.push({t:'leader'});
  acts.push({t:'pass'});return acts;}
function act(S,p,a){
  if(S.phase==='over')return{ok:false,err:'game over'};
  if(S.pending){if(S.pending.player!==p||a.t!=='resolve')return{ok:false,err:'waiting for a choice'};return resolve(S,p,a);}
  if(S.phase!=='play'||S.turn!==p)return{ok:false,err:'not your turn'};
  const P=S.players[p];
  if(a.t==='pass'){P.passed=true;logp(S,P.name+' passes.');evt(S,{t:'pass',p});return finish(S,p);}
  if(a.t==='leader'){const r=useLeader(S,p,a);if(!r.ok)return r;return finish(S,p);}
  if(a.t!=='play')return{ok:false,err:'bad action'};
  const i=findIn(P.hand,a.uid);if(i<0)return{ok:false,err:'card not in hand'};const c=P.hand[i];
  if(c.type==='unit'){const rs=c.row==='agile'?['close','ranged']:[c.row];if(!rs.includes(a.row||rs[0]))return{ok:false,err:'wrong row'};
    P.hand.splice(i,1);logp(S,P.name+' plays '+c.name+'.');placeUnit(S,p,c,a.row||rs[0]);}
  else if(c.type==='weather'){P.hand.splice(i,1);logp(S,P.name+' plays '+c.name+'.');setWeather(S,c.eff,c);}
  else if(c.eff==='scorch'){P.hand.splice(i,1);logp(S,P.name+' plays Brann!');const n=scorchAll(S);toDiscard(S,c);if(!n)logp(S,'Nothing to burn.');}
  else if(c.eff==='horn'){if(!ROWS.includes(a.row)||P.rows[a.row].horn)return{ok:false,err:'row has a horn'};P.hand.splice(i,1);P.rows[a.row].horn=c;logp(S,P.name+' blows the Yule Horn on '+a.row+'.');evt(S,{t:'horn'});}
  else if(c.eff==='decoy'){let tgt=null,row=null;for(const r of ROWS){const u=P.rows[r].units.find(x=>x.uid===a.target);if(u){tgt=u;row=r;}}
    if(!tgt||tgt.hero||tgt.decoy)return{ok:false,err:'bad decoy target'};
    P.hand.splice(i,1);const k=P.rows[row].units.indexOf(tgt);c.decoy=true;c.power=0;P.rows[row].units[k]=c;tgt.owner=p;P.hand.push(tgt);logp(S,P.name+' swaps '+tgt.name+' for a Dummy.');}
  else return{ok:false,err:'cannot play'};
  evt(S,{t:'play',p,uid:c.uid,kind:c.type==='unit'?(c.abil||'unit'):c.eff});
  return finish(S,p);}
function resolve(S,p,a){const pd=S.pending;
  if(pd.kind==='medic'){let uid=a.uid;if(!uid||!pd.options.includes(uid))uid=null;
    S.pending=null;
    if(uid){const P=S.players[p];const i=findIn(P.discard,uid);const c=P.discard.splice(i,1)[0];logp(S,P.name+' revives '+c.name+'.');evt(S,{t:'medic'});placeUnit(S,p,c,a.row||c.row);}
    if(S.pending)return{ok:true};return finish(S,p);}
  if(pd.kind==='raise'||pd.kind==='recall'){let uid=a.uid;S.pending=null;if(uid&&pd.options.includes(uid)){raise(S,p,uid,pd.kind==='raise'?1-p:p);}return finish(S,p);}
  if(pd.kind==='wxpick'){const uid=a.uid;if(!uid||!pd.options.includes(uid))return{ok:false,err:'pick a weather card'};S.pending=null;playFromDeck(S,p,uid);return finish(S,p);}
  if(pd.kind==='cull'){const uid=a.uid;if(!uid||!pd.options.includes(uid))return{ok:false,err:'pick a card to discard'};const P=S.players[p];const i=findIn(P.hand,uid);const c=P.hand.splice(i,1)[0];toDiscard(S,c);logp(S,P.name+' discards '+c.name+'.');
    const need=pd.need-1;if(need>0)S.pending={kind:'cull',player:p,need,options:P.hand.map(x=>x.uid)};else S.pending={kind:'cullpick',player:p,options:P.deck.map(x=>x.uid)};
    return S.pending?{ok:true}:finish(S,p);}
  if(pd.kind==='cullpick'){const uid=a.uid;if(!uid||!pd.options.includes(uid))return{ok:false,err:'pick a card from the deck'};const P=S.players[p];const i=findIn(P.deck,uid);P.hand.push(P.deck.splice(i,1)[0]);S.pending=null;return finish(S,p);}
  return{ok:false,err:'bad resolve'};}
function finish(S,p){// end of an action: turn passes on
  if(S.pending)return{ok:true,pending:S.pending};
  const P=S.players;
  for(let i=0;i<2;i++)if(!P[i].passed&&!P[i].hand.length&&!leaderUsable(S,i)){P[i].passed=true;logp(S,P[i].name+' has no cards left and passes.');}
  if(P[0].passed&&P[1].passed){endRound(S);return{ok:true,roundEnd:true};}
  const o=1-p;if(!P[o].passed)S.turn=o;else S.turn=p;
  return{ok:true};}
function endRound(S){const P=S.players,t=[total(S,0),total(S,1)];let w=-1;
  if(t[0]>t[1])w=0;else if(t[1]>t[0])w=1;else{const a=passiveOf(S,0)==='ties',b=passiveOf(S,1)==='ties';if(a&&!b)w=0;else if(b&&!a)w=1;}
  const kept=[];const snap=S.sim?null:{rows:[JSON.parse(JSON.stringify(P[0].rows)),JSON.parse(JSON.stringify(P[1].rows))],weather:Object.assign({},S.weather)};
  if(w<0){P[0].lives--;P[1].lives--;}else{P[1-w].lives--;P[w].wins++;}
  logp(S,'Round '+S.round+': '+t[0]+' - '+t[1]+(w<0?'. A draw, both lose a life.':'. '+P[w].name+' wins the round.'));
  // Night Creatures: keep a random unit
  const keepers=[];for(let i=0;i<2;i++)if(passiveOf(S,i)==='keep'){const L=[];for(const r of ROWS)for(const u of P[i].rows[r].units)if(!u.decoy)L.push({u,r});if(L.length){const k=L[Math.floor(rnd(S)*L.length)];keepers.push({p:i,u:k.u,r:k.r});kept.push(k.u.name);}}
  for(let i=0;i<2;i++)for(const r of ROWS){const R=P[i].rows[r];for(const u of R.units.slice()){if(keepers.some(k=>k.u===u))continue;toDiscard(S,u);}
    R.units=R.units.filter(u=>keepers.some(k=>k.u===u));if(R.horn){if(R.horn.id!=='leader_horn')toDiscard(S,R.horn);R.horn=null;}}
  clearWeather(S);
  if(w>=0&&passiveOf(S,w)==='draw'){draw(S,w);logp(S,P[w].name+' draws a card (Town Folk).');}
  for(const x of P)x.passed=false;S.peeks=[[],[]];
  S.lastRound={round:S.round,t,winner:w,kept,snap};S.history.push(S.lastRound);evt(S,{t:'roundEnd',winner:w,totals:t});
  if(P[0].lives<=0||P[1].lives<=0){S.phase='over';S.winner=(P[0].lives<=0&&P[1].lives<=0)?-1:(P[0].lives<=0?1:0);logp(S,S.winner<0?'The match is a draw.':P[S.winner].name+' wins the match!');evt(S,{t:'over',winner:S.winner});return;}
  S.round++;
  for(let i=0;i<2;i++)if(S.round===3&&passiveOf(S,i)==='revive')reviveTwo(S,i);
  startRound(S,nextStarter(S,w));}
/* who starts rounds 2 and 3: S.startRule / settings.startRule: winner | loser | alternate | toss (tie: the player who did NOT start swaps in, as alternate) */
function nextStarter(S,w){const r=startRuleOf(S),prev=S.startedRound;if(r==='toss')return rnd(S)<.5?0:1;if(r==='alternate'||w<0)return 1-prev;return r==='loser'?1-w:w;}
/* Fjord Folk passive: 2 random non-Legend, non-Turncoat units from the discard pile return to the board at the start of round 3 */
function reviveTwo(S,p){const P=S.players[p];const pool=P.discard.filter(c=>c.type==='unit'&&!c.hero&&c.abil!=='spy');shuffle(S,pool);const pick=pool.slice(0,2);
  for(const c of pick){P.discard.splice(findIn(P.discard,c.uid),1);placeUnit(S,p,c,c.row,{muster:true});}
  if(pick.length)logp(S,P.name+': '+pick.map(c=>c.name).join(' and ')+' return from the discard pile (Fjord Folk).');}
/* ---- helpers for tests / tutorial / AI ---- */
function clone(S){const c=JSON.parse(JSON.stringify(S));c.sim=true;c.log=[];c.ev=[];return c;}
function put(S,p,row,id,o){const c=inst(S,id,p);if(o)Object.assign(c,o);S.players[p].rows[row].units.push(c);return c;}
function give(S,p,id,where){const c=inst(S,id,p);S.players[p][where||'hand'].push(c);return c;}
function scenario(o){const S=blank(o&&o.seed||7);S.phase='play';for(let i=0;i<2;i++){const f=(o&&o.factions&&o.factions[i])||'town';S.players.push(newPlayer({faction:f,leader:(o&&o.leaders&&o.leaders[i])||({town:'t_l1',rod:'r_l1',blaa:'b_l1',natt:'m_l1',fjord:'f_l1'})[f]}));S.players[i].name=(o&&o.names&&o.names[i])||('Player '+(i+1));}return S;}
return{ROWS,WROW,setDB,def,db:()=>DB,meta:()=>META,newGame,mulligan,chooseFirst,legal,act,total,rowTotal,rowPowers,allUnits,validateDeck,clone,put,give,scenario,inst,leaderUsable,leaderDef,medicOptions,weatherOn,rnd,shuffle,draw,startRound,bestAgileRow,passiveOf,leaderReady,leaderIs,pickOptions,deckWeather,startRuleOf,nextStarter};
});
