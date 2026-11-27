/* KVENT AI: classic card-game heuristics on top of cheap look-ahead (clone the state, apply one action, compare totals).
   Rules of thumb it follows: do not overcommit in round 1, pass when comfortably ahead, concede a round it cannot afford,
   play weak cards first, save heroes/medics/horns, spies early, weather/scorch/horn only when the simulation says it pays. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./kvent.js'));else root.KventAI=factory(root.Kvent);})(typeof self!=='undefined'?self:this,function(K){
'use strict';
function value(c){ // how much the AI "pays" for spending this card
  if(c.type==='unit'){let v=c.power;if(c.hero)v=c.power+3;if(c.abil==='medic')v+=4;if(c.abil==='spy')v=Math.max(2,c.power*0.5);if(c.abil==='bond'||c.abil==='muster')v+=1;if(c.abil==='horn')v+=3;if(c.abil==='morale')v+=1.5;if(c.abil&&c.abil.startsWith('scorch_'))v+=3;return v;}
  switch(c.eff){case'horn':return 8;case'scorch':return 7;case'decoy':return 3;case'clear':return 2;default:return 4;}}
function mulligan(S,p){const h=S.players[p].hand.slice();h.sort((a,b)=>value(a)-value(b));
  const out=[];for(const c of h){if(out.length>=2)break;const weak=(c.type==='unit'&&c.power<=2&&!c.abil&&!c.hero)||c.eff==='clear'||c.eff==='decoy';if(weak)out.push(c.uid);}return out;}
function chooseFirst(S,p){return 1-p;}
function findCard(S,uid){for(const q of[0,1])for(const z of['hand','deck','discard']){const c=S.players[q][z].find(x=>x.uid===uid);if(c)return c;}return null;}
function bestResolve(S,p,pd){ // pick the option with the best simulated outcome
  let best=null,bv=-1e9;
  for(const uid of pd.options){let v;const c=findCard(S,uid);
    if(pd.kind==='raise'||pd.kind==='recall')v=c?value(c):0;
    else if(pd.kind==='cull')v=c?-value(c):0;            // throw away the weakest card
    else if(pd.kind==='cullpick')v=c?value(c):0;          // take the strongest card
    else{const C=K.clone(S);K.act(C,p,{t:'resolve',uid});v=(K.total(C,p)-K.total(C,1-p))+(c&&c.abil==='spy'?6:0)+(c&&c.abil==='medic'?2:0)+(c?c.power*0.05:0);}
    if(v>bv){bv=v;best=uid;}}
  return best;}
function simulate(S,p,a){const C=K.clone(S);const r=K.act(C,p,a);if(!r.ok)return null;let g=0;
  while(C.pending&&g++<6){const uid=bestResolve(C,C.pending.player,C.pending);K.act(C,C.pending.player,{t:'resolve',uid});}
  return C;}
function describe(S,p){const me=S.players[p],op=S.players[1-p];const mt=K.total(S,p),ot=K.total(S,1-p);
  return{me,op,mt,ot,lead:mt-ot,round:S.round,mHand:me.hand.length,oHand:op.hand.length,
    mustWin:me.lives<=1,matchPoint:op.lives<=1};}
function roundWorth(d){if(d.mustWin)return 999;if(d.matchPoint)return 60;return d.round===1?14:22;}
const PERS={greedy:{lamMul:.75,passAdj:3,concedeAdj:8,bluff:0},cautious:{lamMul:1.35,passAdj:-2,concedeAdj:-3,bluff:0},bluffer:{lamMul:1,passAdj:0,concedeAdj:0,bluff:.25},balanced:{lamMul:1,passAdj:0,concedeAdj:0,bluff:0},
  /* cardgame: personalities of the new townspeople. scholar = patient and thrifty; haggler = bluffs and sells hard; brute = never concedes, throws power; witch = the hard boss (spends little, passes late, rarely bluffs) */
  scholar:{lamMul:1.2,passAdj:-1,concedeAdj:-1,bluff:0},haggler:{lamMul:1,passAdj:1,concedeAdj:2,bluff:.35},brute:{lamMul:.6,passAdj:4,concedeAdj:12,bluff:0},witch:{lamMul:1.1,passAdj:1,concedeAdj:-1,bluff:.1,hard:1}};
function act(S,p,pers){pers=typeof pers==='string'?PERS[pers]||PERS.balanced:(pers||PERS.balanced);const d=describe(S,p),me=d.me,op=d.op;const legal=K.legal(S,p);
  const pass={t:'pass'};
  // evaluate all non-pass actions
  const evals=[];
  for(const a of legal){if(a.t==='pass')continue;const C=simulate(S,p,a);if(!C)continue;
    const card=a.uid?me.hand.find(c=>c.uid===a.uid):null;
    let cost=card?value(card):2;let gain=(K.total(C,p)-K.total(C,1-p))-d.lead;
    if(card&&card.abil==='spy'){const deck=me.deck.length;gain+=Math.min(2,deck)*(d.round===1?3.6:3);}
    if(card&&card.eff==='decoy'){const t=[].concat(...K.ROWS.map(r=>me.rows[r].units)).find(u=>u.uid===a.target);if(t){const eff=(K.rowPowers(S,p,K.ROWS.find(r=>me.rows[r].units.includes(t)))[me.rows[K.ROWS.find(r=>me.rows[r].units.includes(t))].units.indexOf(t)]);gain=(t.abil==='medic'||t.abil==='spy'?value(t)-eff:Math.max(0,t.power-eff)-1)+(d.round>1?1:0);}}
    if(a.t==='leader'){cost=2;const L=K.leaderDef(S,p).leader;if(L==='peek')gain=d.round===1&&d.mHand>=8?1.5:-9;if(L==='raise'){const o=K.pickOptions(S,1-p);gain=d.round>=2&&o.length?Math.max(...o.map(value))-3:-9;}
      if(L==='recall'){const o=K.pickOptions(S,p);gain=d.round>=2&&o.length?Math.max(...o.map(value))-3:-9;}
      if(L==='cull'){const lowest=me.hand.slice().sort((x,y)=>value(x)-value(y)).slice(0,2);const best=me.deck.length?Math.max(...me.deck.map(value)):0;gain=d.round>=2&&lowest.length?best-lowest.reduce((a,c)=>a+value(c),0)*0.7:-9;if(gain<3)gain=-9;}
      if(L==='cancel'){gain=K.leaderReady(S,1-p)&&(d.round>=2||d.oHand<=8)?6:-9;}
      if(L==='reshuffle'){const diff=me.discard.length-op.discard.length;gain=d.round>=2&&me.discard.length>=3&&diff>=-1?me.discard.length*1.1-op.discard.length*0.6:-9;}
      if(L==='weather_any'&&gain<=0)gain=-9;}
    evals.push({a,card,cost,gain,C});}
  const lam=(d.mustWin?0.55:(d.round===1?1.2:0.95))*pers.lamMul;
  for(const e of evals){e.score=e.gain-lam*e.cost*(e.card&&e.card.hero&&!d.mustWin&&d.round<3?1.25:1);}
  const bySc=evals.slice().sort((x,y)=>y.score-x.score);
  const cheapest=(arr)=>arr.slice().sort((x,y)=>x.cost-y.cost||y.gain-x.gain)[0];
  // ---- the opponent already passed ----
  if(op.passed){
    if(d.lead>0)return pass;
    const deficit=-d.lead;const win=evals.filter(e=>e.gain>deficit).sort((x,y)=>x.cost-y.cost||y.gain-x.gain);
    if(win.length&&(win[0].cost<=roundWorth(d)||d.mustWin))return win[0].a;
    // multi-step plan with a greedy loop
    let C=S,spent=0,first=null,g=0,cur=S;const sim=K.clone(S);let ok=false;
    while(g++<8){const ds=describe(cur,p);if(ds.lead>0){ok=true;break;}
      let best=null;for(const a of K.legal(cur,p)){if(a.t==='pass')continue;const X=simulate(cur,p,a);if(!X)continue;const cd=a.uid?cur.players[p].hand.find(c=>c.uid===a.uid):null;const cs=cd?value(cd):2;const gn=K.total(X,p)-K.total(X,1-p)-ds.lead;if(gn<=0)continue;const sc=gn/(cs+1);if(!best||sc>best.sc)best={a,X,cs,sc};}
      if(!best)break;if(!first)first=best.a;spent+=best.cs;cur=best.X;
      // after our simulated action the opponent turn is skipped because they passed -> still our turn
    }
    if(ok&&first&&(spent<=roundWorth(d)||d.mustWin))return first;
    return pass;}
  // ---- the opponent is still playing ----
  const potential=d.oHand*6.5;
  if(d.lead>0){
    if(d.mustWin){if(d.lead>potential*0.9&&d.lead>=12)return pass;}
    else if(d.mHand<=d.oHand+1&&d.lead>=(d.round===1?8:10)+pers.passAdj)return pass;
    else if(pers.bluff&&!d.mustWin&&d.lead>=3&&Math.random()<pers.bluff)return pass;
    else if(d.lead>=16&&d.mHand<=d.oHand+3)return pass;}
  else{ // behind: concede when it is clearly not worth it
    const deficit=-d.lead;
    if(!d.mustWin&&deficit>=14+pers.concedeAdj&&d.mHand<=d.oHand+1&&(d.round===1||me.lives>op.lives||deficit>=22))return pass;
    if(!d.mustWin&&deficit>=30+pers.concedeAdj)return pass;
  }
  if(!evals.length)return pass;
  // special bonus moves
  const big=bySc.find(e=>e.card&&(e.card.type==='weather'||e.card.eff==='horn'||e.card.eff==='scorch')&&e.gain>=(d.mustWin?4:6));
  if(big)return big.a;
  const lead=bySc.find(e=>e.a.t==='leader'&&e.gain>=(d.mustWin?3:6));
  if(lead)return lead.a;
  const peek=bySc.find(e=>e.a.t==='leader'&&e.gain>0&&e.gain<5);if(peek&&d.round===1)return peek.a;
  const raise=bySc.find(e=>e.a.t==='leader'&&e.gain>=3&&e.gain<6);if(raise)return raise.a;
  // otherwise: unit with the best (gain - cost) efficiency; never throw away specials with no gain
  const units=evals.filter(e=>e.card&&e.card.type==='unit');
  const dec=bySc.find(e=>e.card&&e.card.eff==='decoy'&&e.gain>=2.5);if(dec)return dec.a;
  if(units.length){ // prefer a spy early
    const spy=units.filter(e=>e.card.abil==='spy'&&me.deck.length>=2&&d.round<=2).sort((x,y)=>x.card.power-y.card.power)[0];if(spy&&d.lead<=12)return spy.a;
    const med=units.filter(e=>e.card.abil==='medic'&&e.gain>=4).sort((x,y)=>y.gain-x.gain)[0];if(med&&!d.mustWin)return med.a;
    const u=units.slice().sort((x,y)=>y.score-x.score)[0];
    // if we are already ahead and it only burns a card: pass instead
    if(d.lead>=4&&u.score<-1&&d.mHand<=d.oHand+2)return pass;
    return u.a;}
  return pass;}
function resolve(S,p){const pd=S.pending;if(!pd)return null;if(pd.kind==='first')return{first:chooseFirst(S,p)};return{uid:bestResolve(S,p,pd)};}
return{PERS,act,resolve,mulligan,chooseFirst,value,bestResolve};
});
