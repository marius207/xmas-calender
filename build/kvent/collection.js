/* KVENT collection + card packs (job cardgame). Pure data logic, no DOM: works in the browser (window.KventColl) and in node.
   Model (stored per player in localStorage 'kvent.coll.v1.<player>', same key the older prototype used, so nothing is lost):
     { cards:{id:extraCopies}, wins:{oppId:n}, packs:[{id,kind,seed,from}], kr:n (stand-alone play money only), sold:n, opened:n, totalWins:n, v:2 }
   - Everybody STARTS with the five ready-made decks (all their cards + default leaders). Packs add EXTRA copies/cards on top of that.
   - Deck limit for a card = min(card.copies, owned). A card you already own at its deck limit is a DUPLICATE: it is sold at once for kroner (trade-in value by rarity).
     So nothing is ever wasted or useless (the "items must make sense" rule), and packs lean toward cards you do not have yet.
   - Packs are earned (first win over every townsperson, clan chiefs give clan packs, the witch a boss pack, every 3rd win a plain pack, now and then a single card)
     or bought for kroner (plain pack, clan packs from the chiefs with a discount for clan friends). Each pack has its own seed, so opening is deterministic. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./kvent.js'),require('./match.js'));else root.KventColl=factory(root.Kvent,root.KventMatch);})(typeof self!=='undefined'?self:this,function(K,M){
'use strict';
const FACS=['town','rod','blaa','natt','fjord'];
const PACKS={
  std:{name:'Kvent pack',no:'Kvent-pakke',n:5,price:60,bias:null,desc:'5 cards from any faction.'},
  clan_rod:{name:'Rødnisser clan pack',no:'Rødnisser-klanpakke',n:5,price:90,bias:'rod',desc:'5 cards, mostly Rødnisser (red hats).',clan:'red'},
  clan_blaa:{name:'Blånisser clan pack',no:'Blånisser-klanpakke',n:5,price:90,bias:'blaa',desc:'5 cards, mostly Blånisser (blue hats).',clan:'blue'},
  night:{name:'Night pack',no:'Nattpakke',n:5,price:90,bias:'natt',desc:'5 cards, mostly creatures of the night.',price_hidden:true},
  boss:{name:'Boss pack',no:'Sjefspakke',n:5,price:0,bias:null,desc:'5 cards with a guaranteed Legend.',boss:true},
  one:{name:'Single card',no:'Enkeltkort',n:1,price:0,bias:null,desc:'1 card.'}};
const SELL={common:6,uncommon:12,rare:25,legend:60,leader:40};
function mulberry(seed){let a=(seed>>>0)||1;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function rarity(d){if(!d)return'common';if(d.type==='leader')return'leader';if(d.hero)return'legend';
  if(d.type!=='unit')return(d.eff==='horn'||d.eff==='scorch')?'rare':'uncommon';
  const a=d.abil||'';if(d.power>=8||a==='spy'||a==='medic'||a==='horn'||a.startsWith('scorch'))return'rare';
  if(a||d.power>=6)return'uncommon';return'common';}
let STARTER=null;
function starter(){if(STARTER)return STARTER;const D=K.db(),S={};
  for(const f of FACS){const c={};for(const id of M.readyDeck(f))c[id]=(c[id]||0)+1;for(const id in c)S[id]=Math.max(S[id]||0,c[id]);S[M.LEADERS[f]]=1;}
  return STARTER=S;}
function norm(C){C=C&&typeof C==='object'?C:{};C.cards=C.cards||{};C.wins=C.wins||{};C.packs=Array.isArray(C.packs)?C.packs:[];
  if(typeof C.kr!=='number')C.kr=C.kr==null?250:+C.kr||0;C.sold=C.sold|0;C.opened=C.opened|0;C.totalWins=Math.max(C.totalWins|0,Object.values(C.wins).reduce((a,b)=>a+(b|0),0));C.v=2;C.pid=C.pid|0;return C;}
function owned(C,id){return(starter()[id]||0)+((C&&C.cards&&C.cards[id])|0);}
function limit(C,id){const d=K.db()[id];if(!d)return 0;return Math.min(d.copies||1,owned(C,id));}
function missing(C){const D=K.db();let n=0;for(const id in D){const d=D[id];if(d.type==='leader'?!owned(C,id):owned(C,id)<(d.copies||1))n++;}return n;}
function totals(C){const D=K.db();let have=0,all=0;for(const id in D){const d=D[id];const need=d.type==='leader'?1:(d.copies||1);all+=need;have+=Math.min(need,owned(C,id));}return{have,all};}
/* ---------- making and opening packs ---------- */
function newPack(C,kind,from,salt){if(!PACKS[kind])kind='std';C.pid=(C.pid|0)+1;const seed=(((Date.now()%1e9)|0)^(C.pid*2654435761)^(salt|0))>>>0;const p={id:'p'+C.pid.toString(36)+seed.toString(36),kind,seed,from:from||''};C.packs.push(p);return p;}
function pool(){return Object.values(K.db());}
function pickCard(rnd,C,kind,slotRar,taken){const P=PACKS[kind],all=pool();
  const w=d=>{let x=1;if(P.bias&&d.faction===P.bias)x*=5;else if(P.bias&&d.faction==='neutral')x*=1.2;
    const o=owned(C,d.id)+(taken[d.id]||0),lim=d.type==='leader'?1:(d.copies||1);x*=o===0?3:(o<lim?1.2:.25);return x;};
  let cand=all.filter(d=>slotRar.includes(rarity(d)));if(!cand.length)cand=all;
  let tot=0;for(const d of cand)tot+=w(d);let r=rnd()*tot;for(const d of cand){r-=w(d);if(r<=0)return d;}return cand[cand.length-1];}
function slotsFor(rnd,kind,n){const P=PACKS[kind];if(n===1){const r=rnd();return[r<.55?['common']:r<.85?['uncommon']:r<.97?['rare']:['legend','leader']];}
  const S=[['common','uncommon'],['common','uncommon'],['common','uncommon'],['uncommon','rare']];
  const r=rnd();S.push(P.boss?['legend']:r<.10?['legend']:r<.18?['leader']:r<.60?['rare']:['uncommon','rare']);return S.slice(0,n);}
/* open: mutates C. Returns {cards:[{id,rarity,isNew,copy,sold}], kr:<kroner from duplicates>} */
function openPack(C,pk){C=norm(C);const i=C.packs.findIndex(p=>p.id===pk.id);if(i<0)return null;C.packs.splice(i,1);
  const rnd=mulberry(pk.seed),P=PACKS[pk.kind]||PACKS.std,slots=slotsFor(rnd,pk.kind,P.n),taken={},out=[];let kr=0;
  for(const sl of slots){const d=pickCard(rnd,C,pk.kind,sl,taken);const r=rarity(d);const o=owned(C,d.id),lim=d.type==='leader'?1:(d.copies||1);
    if(o<lim){C.cards[d.id]=(C.cards[d.id]|0)+1;taken[d.id]=0;out.push({id:d.id,rarity:r,isNew:o===0&&!(starter()[d.id]),copy:o>0,sold:0});}
    else{const v=SELL[r]||6;kr+=v;out.push({id:d.id,rarity:r,isNew:false,copy:false,sold:v});}}
  C.opened++;C.sold+=kr;if(kr)C.kr+=kr;return{cards:out,kr,kind:pk.kind};}
/* ---------- rewards for beating a character ---------- */
function reward(C,opp,won,ctx){C=norm(C);ctx=ctx||{};const R={kr:0,packs:[],first:false,note:''};if(!won||!opp)return R;
  const n=C.wins[opp.id]=(C.wins[opp.id]|0)+1;C.totalWins++;const first=n===1;R.first=first;
  let kr=first?100*(opp.level||1)+(opp.boss?200:0):20*(opp.level||1);
  if(ctx.friend)kr=Math.round(kr*1.5);                 // clan friends of the chief pay more
  R.kr=kr;
  if(first)R.packs.push(newPack(C,opp.pack||'std',opp.id,n));
  else{if(C.totalWins%3===0)R.packs.push(newPack(C,opp.pack&&opp.pack!=='boss'?opp.pack:'std',opp.id,n));
       else if(((C.pid*7+C.totalWins*13)%10)<3)R.packs.push(newPack(C,'one',opp.id,n));}
  return R;}
function priceOf(kind,ctx){const P=PACKS[kind];if(!P||!P.price)return 0;let p=P.price;if(ctx&&ctx.friend&&P.clan)p=Math.round(p*.75);return p;}
return{PACKS,SELL,FACS,rarity,starter,norm,owned,limit,missing,totals,newPack,openPack,reward,priceOf,mulberry};
});
