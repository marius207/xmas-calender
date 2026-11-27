/* KVENT relay core (job cardgame): the whole server side of online / play-by-mail Kvent, as ONE pure async class with no platform calls.
   It stores and forwards; it never needs to understand the rules (clients replay + verify every move with the engine).
   Used by: (1) KventNet.LoopbackRelay in the browser/node (local two-client test, "mail" between two profiles in one browser),
            (2) relay/worker.js (Cloudflare Worker, built by relay/build_worker.py by inlining this file). NOT deployed: needs Marius's approval.
   db interface (async): get(key)->object|null, set(key,object). Routes are listed in NETPLAY.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KventRelayCore=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const VER=1,MAX_MOVES=2000,MAX_CARDS=80;
const clean=a=>{const o={p:a.p,t:a.t};for(const k of['card','row','target','uids','who'])if(a[k]!==undefined&&a[k]!==null)o[k]=a[k];return o;};
class RelayCore{
  constructor(db,opt){this.db=db;opt=opt||{};this.users=opt.users||['Marius','Chris','Martin'];this.now=opt.now||(()=>Date.now());}
  ok(json,status){return{status:status||200,json:Object.assign({ok:true,v:VER},json||{})};}
  err(status,msg,extra){return{status,json:Object.assign({ok:false,v:VER,error:msg},extra||{})};}
  user(n){n=String(n||'').trim();return this.users.find(u=>u.toLowerCase()===n.toLowerCase())||null;}
  deckOk(d){return d&&typeof d.faction==='string'&&typeof d.leader==='string'&&Array.isArray(d.cards)&&d.cards.length<=MAX_CARDS&&d.cards.every(x=>typeof x==='string'&&x.length<24);}
  async index(u){return(await this.db.get('u:'+u))||{ids:[]};}
  async link(u,id){const ix=await this.index(u);if(!ix.ids.includes(id)){ix.ids.push(id);if(ix.ids.length>200)ix.ids.shift();await this.db.set('u:'+u,ix);}}
  summary(m){return{id:m.id,from:m.from,to:m.to,status:m.status,moves:m.moves.length,updated:m.updated,created:m.created,title:m.title||'',rule:m.rule,hostSeed:m.hostSeed,hostDeck:m.hostDeck,salt:m.salt||null,guestDeck:m.guestDeck||null};}
  async handle(method,path,q,body){q=q||{};body=body||{};
    try{
      if(method==='GET'&&path==='/kvent/ping')return this.ok({users:this.users});
      if(method==='POST'&&path==='/kvent/challenge'){
        const from=this.user(body.from),to=this.user(body.to),id=String(body.id||'');
        if(!from||!to||from===to)return this.err(400,'bad players');if(!/^[a-z0-9_-]{4,40}$/i.test(id))return this.err(400,'bad id');
        if(!this.deckOk(body.hostDeck))return this.err(400,'bad deck');
        const ex=await this.db.get('m:'+id);if(ex)return this.err(409,'exists',{match:this.summary(ex)});
        const t=this.now(),m={id,from,to,status:'pending',rule:String(body.rule||'winner'),hostSeed:String(body.hostSeed||'0').slice(0,40),hostDeck:{faction:body.hostDeck.faction,leader:body.hostDeck.leader,cards:body.hostDeck.cards},title:String(body.title||'').slice(0,80),moves:[],created:t,updated:t};
        await this.db.set('m:'+id,m);await this.link(from,id);await this.link(to,id);return this.ok({match:this.summary(m)});}
      if(method==='POST'&&(path==='/kvent/accept'||path==='/kvent/decline')){
        const m=await this.db.get('m:'+String(body.id||''));if(!m)return this.err(404,'no such match');const by=this.user(body.by);if(by!==m.to)return this.err(403,'not your challenge');
        if(m.status!=='pending')return this.err(409,'already '+m.status,{match:this.summary(m)});
        if(path==='/kvent/decline'){m.status='declined';}
        else{if(!this.deckOk(body.guestDeck))return this.err(400,'bad deck');m.status='active';m.salt=String(body.salt||'0').slice(0,40);m.guestDeck={faction:body.guestDeck.faction,leader:body.guestDeck.leader,cards:body.guestDeck.cards};}
        m.updated=this.now();await this.db.set('m:'+m.id,m);return this.ok({match:this.summary(m)});}
      if(method==='GET'&&path==='/kvent/inbox'){
        const u=this.user(q.user);if(!u)return this.err(400,'unknown user');const ix=await this.index(u),out=[];
        for(const id of ix.ids){const m=await this.db.get('m:'+id);if(m)out.push(this.summary(m));}
        out.sort((a,b)=>b.updated-a.updated);return this.ok({user:u,matches:out});}
      if(method==='GET'&&path==='/kvent/match'){const m=await this.db.get('m:'+String(q.id||''));if(!m)return this.err(404,'no such match');return this.ok({match:this.summary(m)});}
      if(method==='POST'&&path==='/kvent/move'){
        const m=await this.db.get('m:'+String(body.id||''));if(!m)return this.err(404,'no such match');if(m.status!=='active')return this.err(409,'match is '+m.status);
        const n=body.n|0,a=body.action;if(!a||(a.p!==0&&a.p!==1)||typeof a.t!=='string')return this.err(400,'bad action');
        const who=this.user(body.by);if(who!==m.from&&who!==m.to)return this.err(403,'not in this match');
        const seat=who===m.from?0:1;if(a.p!==seat)return this.err(403,'wrong seat');
        if(n<m.moves.length){return JSON.stringify(m.moves[n])===JSON.stringify(clean(a))?this.ok({dup:true,have:m.moves.length}):this.err(409,'conflict',{have:m.moves.length});}
        if(n>m.moves.length)return this.err(409,'gap',{have:m.moves.length});
        if(m.moves.length>=MAX_MOVES)return this.err(409,'too long');
        m.moves.push(clean(a));m.updated=this.now();await this.db.set('m:'+m.id,m);return this.ok({have:m.moves.length});}
      if(method==='GET'&&path==='/kvent/poll'){
        const m=await this.db.get('m:'+String(q.id||''));if(!m)return this.err(404,'no such match');const since=Math.max(0,q.since|0);
        return this.ok({have:m.moves.length,status:m.status,moves:m.moves.slice(since).map((action,i)=>({n:since+i,action}))});}
      return this.err(404,'no such route');
    }catch(e){return this.err(500,'server error: '+(e&&e.message||e));}}}
return{RelayCore,VER};
});
