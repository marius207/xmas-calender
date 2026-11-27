/* KVENT match layer: a match is { id, ver, seed, players:[{name,faction,leader,cards,kind}], log:[actions] }.
   State is a pure function of (seed, decks, log): replay(header, log) rebuilds and VERIFIES it (every action is validated by the engine).
   Dependency-free; works in browser (window.KventMatch) and node. Transports (Local/Hot-seat, AI, Net stub) live here too. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./kvent.js'),require('./ai.js'));else root.KventMatch=factory(root.Kvent,root.KventAI);})(typeof self!=='undefined'?self:this,function(K,AI){
'use strict';
const VER=1;
function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
/* Trusted-friends model: seed = hash(hostSeed + guestSalt). The host proposes a seed, the guest adds a salt when accepting, so neither side alone picks the shuffle.
   Both clients derive identical shuffles; each UI only shows its own hand. (A cheating client could peek - fine among friends, see NETPLAY.md.) */
function mixSeed(hostSeed,guestSalt){return(hash32(hostSeed+'|'+guestSalt)|0)||1;}
/* Ready-made decks: 25-30 cards with 5 specials (Horn, Scorch, Decoy, Snowstorm, Fog); classic decks were ~37-40, ours are lean on purpose.
   Units: faction units + the signature neutrals; opponent extras are always kept, the weakest plain (no ability, no Legend) faction units are cut down to UNITS_TARGET. */
const UNITS_TARGET=23;
function readyDeck(faction,extras){const D=K.db();const cnt={};const base=[];const ext=[];const spec=[];
  const push=(arr,id)=>{const c=D[id];if(!c)return;cnt[id]=(cnt[id]||0)+1;if(cnt[id]<=c.copies)arr.push(id);};
  for(const c of Object.values(D))if(c.faction===faction&&c.type==='unit')for(let i=0;i<c.copies;i++)push(base,c.id);
  for(const id of['n_lykta','n_rusty','n_kare','n_troll'])push(base,id);
  for(const id of extras||[])push(ext,id);
  const pw=id=>D[id].power;
  let units=base.length+ext.length;
  const cut=base.map((id,i)=>({id,i})).filter(x=>{const c=D[x.id];return!c.abil&&!c.hero&&c.type==='unit';}).sort((a,b)=>pw(a.id)-pw(b.id)||b.i-a.i);
  const drop=new Set();for(const x of cut){if(units<=UNITS_TARGET)break;drop.add(x.i);units--;}
  const cut2=base.map((id,i)=>({id,i})).filter(x=>{const c=D[x.id];return!drop.has(x.i)&&!c.hero&&c.abil!=='spy'&&c.abil!=='medic';}).sort((a,b)=>pw(a.id)-pw(b.id)||b.i-a.i);
  for(const x of cut2){if(units<=UNITS_TARGET+1)break;drop.add(x.i);units--;}
  const outU=base.filter((id,i)=>!drop.has(i)).concat(ext);
  for(const id of['horn','scorch','decoy','w_frost','w_fog'])push(spec,id);
  return outU.concat(spec);}
const LEADERS={town:'t_l1',rod:'r_l1',blaa:'b_l1',natt:'m_l1',fjord:'f_l1'};
let DEFAULT_RULE=null;function setDefaultRule(r){DEFAULT_RULE=r||null;}
function deckFor(faction,leader,cards){return{faction,leader:leader||LEADERS[faction],cards:cards||readyDeck(faction)};}
function make(header,S,log){return{header,S,log:log||[],listeners:[],
  /* action: {p,t:'mulligan'|'first'|'play'|'leader'|'pass'|'resolve', card, row, target, uids, who} */
  apply(a){const r=applyTo(S,a);if(r.ok){this.log.push(clean(a));this.listeners.forEach(f=>f(a,this));}return r;},
  on(f){this.listeners.push(f);},
  who(){ // whose input is needed now, or -1
    if(S.phase==='over')return-1;if(S.phase==='mulligan')return S.players[0].mull?(S.players[1].mull?-1:1):0;
    if(S.pending)return S.pending.player;return S.phase==='play'?S.turn:-1;},
  toJSON(){return{id:header.id,ver:VER,seed:header.seed,players:header.players,log:this.log,meta:header.meta||null,rule:header.rule||null};}};}
function clean(a){const o={p:a.p,t:a.t};for(const k of['card','row','target','uids','who'])if(a[k]!==undefined&&a[k]!==null)o[k]=a[k];return o;}
function applyTo(S,a){
  if(!a||(a.p!==0&&a.p!==1))return{ok:false,err:'bad player'};
  switch(a.t){
    case'mulligan':{if(S.phase!=='mulligan')return{ok:false,err:'not in redraw phase'};return K.mulligan(S,a.p,a.uids||[]);}
    case'first':return K.chooseFirst(S,a.p,a.who);
    case'play':return K.act(S,a.p,{t:'play',uid:a.card,row:a.row,target:a.target});
    case'leader':return K.act(S,a.p,{t:'leader',target:a.target});
    case'pass':return K.act(S,a.p,{t:'pass'});
    case'resolve':return K.act(S,a.p,{t:'resolve',uid:a.card,row:a.row});
    default:return{ok:false,err:'unknown action type'};}}
function create(o){const seed=o.seed||mixSeed(o.hostSeed||String(Date.now()),o.guestSalt||'0');
  const players=o.players.map(p=>({name:p.name,faction:p.faction,leader:p.leader,cards:p.cards,kind:p.kind||'human',personality:p.personality||null,opp:p.opp||null}));
  const rule=o.startRule||DEFAULT_RULE||null;const S=K.newGame({seed,decks:players,startRule:rule});return make({id:o.id||('m'+(hash32(seed+players[0].name+players[1].name+Date.now())).toString(36)),seed,players,meta:o.meta||null,rule},S);}
function replay(m){ // m = JSON from toJSON(); returns {ok,match,error,at}
  if(m.ver!==VER)return{ok:false,error:'version mismatch'};
  for(let i=0;i<2;i++){const d=m.players[i];const v=K.validateDeck(d);if(!v.ok)return{ok:false,error:'illegal deck for player '+(i+1)+': '+v.errors[0],at:-1};}
  const S=K.newGame({seed:m.seed,decks:m.players,startRule:m.rule||null});const mt=make({id:m.id,seed:m.seed,players:m.players,meta:m.meta,rule:m.rule||null},S,[]);
  for(let i=0;i<m.log.length;i++){const a=m.log[i];
    const w=mt.who();if(w>=0&&a.p!==w)return{ok:false,error:'action '+i+' by wrong player',at:i};
    const r=mt.apply(a);if(!r.ok)return{ok:false,error:'illegal action '+i+': '+r.err,at:i};}
  return{ok:true,match:mt};}
/* share code: short text to paste in chat (play-by-mail). KV1. + base64url(json) */
function toCode(mt){const j=JSON.stringify(mt.toJSON());let b;if(typeof btoa==='function')b=btoa(unescape(encodeURIComponent(j)));else b=Buffer.from(j,'utf8').toString('base64');return'KV1.'+b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromCode(code){try{let b=String(code).trim();if(!b.startsWith('KV1.'))return{ok:false,error:'not a KV1 code'};b=b.slice(4).replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';
    const j=typeof atob==='function'?decodeURIComponent(escape(atob(b))):Buffer.from(b,'base64').toString('utf8');return replay(JSON.parse(j));}catch(e){return{ok:false,error:'bad code'};}}
/* ---------- Transports ---------- */
/* Transport {send(action), onAction(cb), status}. send = tell this seat about an action that was applied (so a network transport can forward it);
   onAction(cb) = this seat calls cb(action) when it wants to act (an AI after thinking, a remote friend when their move arrives). */
class Transport{constructor(){this.status='ready';this.cb=null;}send(a){}onAction(cb){this.cb=cb;}notify(mt){}}
class LocalTransport extends Transport{constructor(label){super();this.label=label||'local';}} // UI seat: UI calls session.dispatch directly
class HotseatTransport extends LocalTransport{constructor(){super('hotseat');}}
class AITransport extends Transport{constructor(seat,pers,delay){super();this.seat=seat;this.pers=pers||'balanced';this.delay=delay==null?900:delay;this.t=null;this.label='ai';}
  notify(mt){const S=mt.S,p=this.seat;if(mt.who()!==p||this.t)return;
    this.t=setTimeout(()=>{this.t=null;if(mt.who()!==p||!this.cb)return;this.cb(this.decide(mt));},this.delay);}
  decide(mt){const S=mt.S,p=this.seat;
    if(S.phase==='mulligan')return{p,t:'mulligan',uids:AI.mulligan(S,p)};
    if(S.pending){const pd=S.pending;if(pd.kind==='first')return{p,t:'first',who:AI.chooseFirst(S,p)};return{p,t:'resolve',card:AI.resolve(S,p).uid};}
    const a=AI.act(S,p,this.pers);if(a.t==='play')return{p,t:'play',card:a.uid,row:a.row,target:a.target};return{p,t:a.t};}}
/* NetTransport (job cardgame): the seat it is bound to is the REMOTE player's seat. send(a) = a local action was applied -> forward to the relay (queued, retried);
   pull() = fetch the remote player's moves from the relay and feed them to the session in order (log index n must equal our log length: stale/duplicate ignored, gaps wait).
   relay = any object with async move({id,n,action,by}) and poll(id,since) (KventNet.LoopbackRelay / HttpRelay). Nothing is time based: poll only when the screen is open, or once on open (play-by-mail). */
class NetTransport extends Transport{constructor(relay,matchId,seat,opt){super();opt=opt||{};this.relay=relay;this.matchId=matchId;this.seat=seat;this.by=opt.by||null;this.pollMs=opt.pollMs||2500;this.status='idle';this.outbox=[];this.mt=null;this.timer=null;this.flushing=false;this.label='net';this.errors=0;this.stopped=false;this.onStatus=opt.onStatus||null;}
  attach(mt){this.mt=mt;return this;}
  setStatus(s){if(this.status!==s){this.status=s;if(this.onStatus)try{this.onStatus(s);}catch(e){}}}
  send(a){const n=this.mt?this.mt.log.length-1:this.outbox.length;this.outbox.push({id:this.matchId,n,action:clean(a),by:this.by});this.flush();}
  notify(mt){if(!this.mt)this.mt=mt;}
  async flush(){if(this.flushing||this.stopped)return;this.flushing=true;
    try{while(this.outbox.length&&!this.stopped){const m=this.outbox[0];let r;
        try{r=await this.relay.move(m);}catch(e){this.errors++;this.setStatus('offline');break;}
        if(r&&(r.ok||(r.json&&r.json.ok))){this.outbox.shift();this.setStatus('online');}
        else{const j=(r&&r.json)||r||{};if(j.have!==undefined&&j.have>m.n){this.outbox.shift();}   // the relay already has that move (or a conflicting one: a pull will sort it out)
          else{this.errors++;this.setStatus('error');break;}}}}
    finally{this.flushing=false;}}
  receive(msg){if(!this.mt||!this.cb||!msg||!msg.action)return false;if(msg.n<this.mt.log.length)return false;if(msg.n>this.mt.log.length)return false;
    if(msg.action.p!==this.seat)return false;this.cb(msg.action);return true;}
  async pull(){if(!this.mt||this.stopped)return 0;let got=0;
    try{const r=await this.relay.poll(this.matchId,this.mt.log.length);const j=(r&&r.json)||r;this.setStatus('online');
      if(j&&j.moves)for(const m of j.moves){if(m.n===this.mt.log.length&&this.receive(m))got++;else if(m.n<this.mt.log.length)continue;else break;}}
    catch(e){this.errors++;this.setStatus('offline');}
    return got;}
  start(){this.stopped=false;if(this.timer)return;const tick=async()=>{await this.pull();await this.flush();};tick();this.timer=setInterval(tick,this.pollMs);}
  stop(){this.stopped=true;if(this.timer){clearInterval(this.timer);this.timer=null;}}}
/* Session = match + one transport per seat. Every action from any seat goes through the engine, then is forwarded to the other transports. */
class Session{constructor(mt,seats,store){this.mt=mt;this.seats=seats;this.store=store||null;this.hooks=[];
    seats.forEach((t,i)=>{t.onAction(a=>this.dispatch(Object.assign({},a,{p:i})));});}
  dispatch(a){const r=this.mt.apply(a);if(!r.ok)return r;if(this.store)this.store(this.mt);
    this.seats.forEach((t,i)=>{if(i!==a.p)t.send(a);});this.hooks.forEach(f=>f(a,this));
    this.seats.forEach(t=>t.notify(this.mt));return r;}
  start(){this.seats.forEach(t=>{if(t.attach)t.attach(this.mt);if(t.start&&t.label==='net')t.start();t.notify(this.mt);});}
  onChange(f){this.hooks.push(f);}
  stop(){this.seats.forEach(t=>{if(t.t){clearTimeout(t.t);t.t=null;}if(t.stop&&t.label==='net')t.stop();});}}
return{setDefaultRule,UNITS_TARGET,VER,mixSeed,hash32,readyDeck,deckFor,LEADERS,create,replay,toCode,fromCode,make,applyTo,Transport,LocalTransport,HotseatTransport,AITransport,NetTransport,Session};
});
