/* KVENT online client (job cardgame): challenge Marius / Chris / Martin, a match list, async play-by-mail. Works in the browser (window.KventNet) and in node.
   - Relays: LoopbackRelay (the real server code, RelayCore, in this page: with a localStorage db two profiles in ONE browser can mail each other; with a memory db it is the two-client test)
             HttpRelay (fetch to a deployed relay/worker.js; NOT deployed yet, needs Marius's approval).
   - Client: challenge() -> refresh() shows incoming / outgoing / active -> accept()/decline(). Both sides build the SAME match (id, seed = mix(hostSeed, guestSalt), both decks, fixed start rule),
     so only moves travel. session() wires a live match (NetTransport polls while the screen is open); pull()/push() are the play-by-mail path (sync once on open, nothing is time based).
   See NETPLAY.md. No secrets live in this file: the shared key (if any) is typed in the Online settings and kept in localStorage 'kvent.relay'. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./kvent.js'),require('./match.js'),require('./relay/core.js'));else root.KventNet=factory(root.Kvent,root.KventMatch,root.KventRelayCore);})(typeof self!=='undefined'?self:this,function(K,M,RC){
'use strict';
/* ---------- databases for the loopback relay ---------- */
class MemDB{constructor(){this.m=new Map();}async get(k){const v=this.m.get(k);return v===undefined?null:JSON.parse(v);}async set(k,v){this.m.set(k,JSON.stringify(v));}}
class LocalDB{constructor(ls,prefix){this.ls=ls;this.p=prefix||'kvent.relay.db.';}async get(k){try{const v=this.ls.getItem(this.p+k);return v==null?null:JSON.parse(v);}catch(e){return null;}}async set(k,v){try{this.ls.setItem(this.p+k,JSON.stringify(v));}catch(e){}}}
/* ---------- relays: same async surface, return the parsed json ({ok,...}) ---------- */
class RelayBase{
  async ping(){return this.call('GET','/kvent/ping');}
  async challenge(b){return this.call('POST','/kvent/challenge',b);}
  async accept(b){return this.call('POST','/kvent/accept',b);}
  async decline(b){return this.call('POST','/kvent/decline',b);}
  async inbox(user){return this.call('GET','/kvent/inbox',{user});}
  async match(id){return this.call('GET','/kvent/match',{id});}
  async move(m){return this.call('POST','/kvent/move',{id:m.id,n:m.n,action:m.action,by:m.by});}
  async poll(id,since){return this.call('GET','/kvent/poll',{id,since});}}
class LoopbackRelay extends RelayBase{constructor(core,opt){super();this.core=core||new RC.RelayCore(new MemDB());this.down=false;this.delay=(opt&&opt.delay)||0;this.calls=0;}
  async call(method,path,args){this.calls++;if(this.down)throw new Error('relay down');if(this.delay)await new Promise(r=>setTimeout(r,this.delay));
    const r=method==='GET'?await this.core.handle('GET',path,args,null):await this.core.handle('POST',path,null,args);return JSON.parse(JSON.stringify(r.json));}}
class HttpRelay extends RelayBase{constructor(base,key,fetchFn){super();this.base=String(base||'').replace(/\/+$/,'');this.key=key||'';this.f=fetchFn||(typeof fetch!=='undefined'?fetch.bind(root_()):null);}
  async call(method,path,args){if(!this.f)throw new Error('no fetch');const h={'content-type':'application/json'};if(this.key)h['x-kvent-key']=this.key;
    let url=this.base+path,init={method,headers:h};
    if(method==='GET'){const q=Object.keys(args||{}).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(args[k])).join('&');if(q)url+='?'+q;}else init.body=JSON.stringify(args||{});
    const ctl=typeof AbortController!=='undefined'?new AbortController():null;const tmo=ctl?setTimeout(()=>{try{ctl.abort();}catch(e){}},12000):0;if(ctl)init.signal=ctl.signal;let r;try{r=await this.f(url,init);}finally{if(tmo)clearTimeout(tmo);}let j;try{j=await r.json();}catch(e){j={ok:false,error:'bad reply ('+r.status+')'};}return j;}}
function root_(){return typeof self!=='undefined'?self:globalThis;}
/* ---------- the client ---------- */
const DECK=d=>({faction:d.faction,leader:d.leader,cards:d.cards.slice()});
class Client{
  /* o: {relay, me, store:{get(id)->json|null,set(id,json),all()->{id:json}}, rand, rule} */
  constructor(o){this.relay=o.relay;this.me=o.me;this.store=o.store;this.rand=o.rand||Math.random;this.rule=o.rule||'winner';this.live=new Map();}
  newId(){return'k'+Math.floor(this.rand()*1e9).toString(36)+Date.now().toString(36).slice(-4);}
  async challenge(to,deck,title){const id=this.newId(),hostSeed=String(this.rand())+'|'+Date.now();
    const r=await this.relay.challenge({id,from:this.me,to,rule:this.rule,hostSeed,hostDeck:DECK(deck),title:title||(this.me+' vs '+to)});
    if(!r.ok)return{ok:false,error:r.error};return{ok:true,id};}
  build(s){ // s = relay summary of an ACTIVE match -> identical match object on both sides
    const pl=[Object.assign({name:s.from,kind:'human'},DECK(s.hostDeck)),Object.assign({name:s.to,kind:'human'},DECK(s.guestDeck))];
    return M.create({id:s.id,hostSeed:s.hostSeed,guestSalt:s.salt,startRule:s.rule,players:pl,meta:{title:s.title||(s.from+' vs '+s.to),created:s.created,online:{id:s.id,host:s.from,guest:s.to}}});}
  async accept(id,deck){const m=await this.relay.match(id);if(!m.ok)return{ok:false,error:m.error};const salt='s'+Math.floor(this.rand()*1e9).toString(36);
    const r=await this.relay.accept({id,by:this.me,guestDeck:DECK(deck),salt});if(!r.ok)return{ok:false,error:r.error};
    const mt=this.build(r.match);this.save(mt);return{ok:true,id,mt};}
  async decline(id){const r=await this.relay.decline({id,by:this.me});return{ok:!!r.ok,error:r.error};}
  save(mt){this.store.set(mt.header.id,mt.toJSON());}
  load(id){const j=this.store.get(id);if(!j)return null;const r=M.replay(j);return r.ok?r.match:null;}
  seatOf(mt){const o=(mt.header.meta||{}).online;return o&&o.host===this.me?0:1;}
  /* refresh: ask the relay; builds local matches for accepted challenges; returns the lists the UI shows */
  async refresh(){const r=await this.relay.inbox(this.me);if(!r.ok)return{ok:false,error:r.error,incoming:[],outgoing:[],active:[],done:[],declined:[]};
    const out={ok:true,incoming:[],outgoing:[],active:[],done:[],declined:[]};
    for(const s of r.matches){
      if(s.status==='pending')(s.to===this.me?out.incoming:out.outgoing).push(s);
      else if(s.status==='declined')out.declined.push(s);
      else if(s.status==='active'){let mt=this.load(s.id);if(!mt){mt=this.build(s);this.save(mt);}
        if(mt.S.phase!=='over'){try{const y=await this.sync(s.id);if(y.ok&&y.mt)mt=y.mt;}catch(e){}}/*kvfriend: up to date, and send moves made offline*/
        const rec={s,mt,seat:this.seatOf(mt),moves:s.moves,mine:false,over:mt.S.phase==='over'};
        const w=mt.who();rec.mine=!rec.over&&w===rec.seat;(rec.over?out.done:out.active).push(rec);}}
    return out;}
  /* play-by-mail: bring the local copy up to date with the relay (remote moves) and send any local moves the relay lacks */
  async sync(id){const mt0=this.load(id);if(!mt0)return{ok:false,error:'no local copy'};const mt=mt0,seat=this.seatOf(mt);let got=0,sent=0;
    for(let g=0;g<4;g++){const r=await this.relay.poll(id,mt.log.length);if(!r.ok)return{ok:false,error:r.error};
      let prog=0;for(const m of r.moves){if(m.n!==mt.log.length)continue;if(m.action.p===seat){/* relay has OUR move we do not (lost local state): accept it */}
        const x=mt.apply(m.action);if(!x.ok)return{ok:false,error:'remote move rejected: '+x.err};got++;prog++;}
      if(!prog)break;}
    // local moves the relay does not know (made offline)
    const mi=await this.relay.match(id);const all=mi.ok?mi.match.moves|0:0;
    for(let n=all;n<mt.log.length;n++){const a=mt.log[n];if(a.p!==seat)break;const r=await this.relay.move({id,n,action:a,by:this.me});if(!r.ok&&!r.dup)break;sent++;}
    this.save(mt);return{ok:true,got,sent,mt,over:mt.S.phase==='over'};}
  /* live session for the UI: seats = [Local|Net, Net|Local]; the caller keeps mt (it is the Session's match). */
  session(mt,store){const seat=this.seatOf(mt),id=mt.header.id;
    const remote=1-seat;const net=new M.NetTransport(this.relay,id,remote,{by:this.me,pollMs:(this.pollMs||2500)});
    const seats=[null,null];seats[seat]=new M.HotseatTransport();seats[remote]=net;
    return new M.Session(mt,seats,store||(m=>this.save(m)));}}
return{MemDB,LocalDB,LoopbackRelay,HttpRelay,RelayBase,Client,RelayCore:RC&&RC.RelayCore};
});
