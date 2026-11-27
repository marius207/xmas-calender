/* KVENT card art: one cheap, deterministic chunky pixel portrait per card (28x32 px canvas, drawn once, cached as a data URL).
   Same chunky/dark-outline look as Rusty and the witch. No images, no 3D, no per-frame cost. */
(function(root){
'use strict';
const W=28,H=32,cache={};
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed||1;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function hex(c){c=c.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
function sh(c,k){const[r,g,b]=hex(c);const f=v=>Math.max(0,Math.min(255,Math.round(v)));return'#'+[r,g,b].map(v=>f(k>=0?v+(255-v)*k:v*(1+k)).toString(16).padStart(2,'0')).join('');}
const BGW={town:['#8a7c60','#463c2a'],rod:['#8a3a2a','#3f1a14'],blaa:['#4f747a','#233a3f'],natt:['#4a3a5c','#191220'],neutral:['#947a48','#45341c'],fjord:['#4a7585','#1d3541']};
const BG={town:['#5a6f9a','#2f3b5e'],rod:['#7a3a2e','#3d1d1c'],blaa:['#3d5f9e','#1c2f58'],natt:['#3c4a3c','#171c22'],neutral:['#8a7a50','#3d3524'],fjord:['#3a6f8a','#16303f']};
function draw(card){
  const a=card.art||['person',{}],k=a[0],o=a[1]||{};const R=rng(hash(card.id));
  const S=document.createElement('canvas');S.width=W;S.height=H;const g=S.getContext('2d');
  const r=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x|0,y|0,w|0,h|0);};
  const px=(x,y,c)=>r(x,y,1,1,c);
  const disc=(cx,cy,rd,c)=>{for(let y=-rd;y<=rd;y++)for(let x=-rd;x<=rd;x++)if(x*x+y*y<=rd*rd+rd*.6)px(cx+x,cy+y,c);};
  const eyes=(x1,x2,y,c)=>{px(x1,y,c||'#14101c');px(x2,y,c||'#14101c');};
  const SK=o.skin||'#e6bf9a';
  const F={
  person(){ // human
    const coat=o.coat||'#486',hair=o.hair||'#543';
    r(6,17,3,9,sh(coat,-.15));r(19,17,3,9,sh(coat,-.15));r(5,25,4,3,SK);r(19,25,4,3,SK);              // arms+hands
    r(8,16,12,12,coat);r(8,16,12,2,sh(coat,.15));r(13,18,2,10,sh(coat,-.2));                         // body
    r(9,27,4,4,'#2a2a38');r(15,27,4,4,'#2a2a38');r(8,30,5,2,'#17141c');r(15,30,5,2,'#17141c');
    if(o.apron)r(10,19,8,9,'#eee');if(o.shawl){r(8,16,12,4,'#a98');r(9,20,3,5,'#a98');}
    const hs=o.kid?-1:0;r(10,6+hs+1,8,9,SK);r(10,14+hs,8,1,sh(SK,-.12));                              // head
    if(o.hat!=='cap'||true){r(9,6+hs,10,3,hair);r(9,7+hs,2,6,hair);r(17,7+hs,2,6,hair);}
    eyes(12,16,10+hs);px(13,13+hs,sh(SK,-.3));px(14,13+hs,sh(SK,-.3));
    if(o.beard){r(10,12+hs,8,5,o.beard);r(12,12+hs,4,1,SK);}if(o.mustache)r(11,12+hs,6,1,'#222');
    if(o.glasses){r(11,9+hs,3,3,'#9ad');r(15,9+hs,3,3,'#9ad');px(12,10+hs,'#14101c');px(16,10+hs,'#14101c');r(14,10+hs,1,1,'#14101c');}
    if(o.curlers){r(9,6,2,3,'#f9a');r(17,6,2,3,'#f9a');}if(o.goggles){r(10,9+hs,8,2,'#444');r(11,9+hs,2,2,'#cde');r(15,9+hs,2,2,'#cde');}
    const hc=o.hatc||'#c0392b',h=o.hat;
    if(h==='beanie'){r(9,3+hs,10,5,hc);r(9,7+hs,10,1,sh(hc,.3));r(13,1+hs,3,3,'#fff');}
    else if(h==='cap'){r(9,4+hs,10,4,hc);r(8,7+hs,11,2,sh(hc,-.25));}
    else if(h==='police'){r(9,3+hs,10,5,hc);r(8,7+hs,12,2,'#111');r(13,4+hs,2,2,'#e8b100');}
    else if(h==='helmet'){r(9,3+hs,10,5,hc);r(8,7+hs,12,2,sh(hc,-.2));r(13,4+hs,2,2,'#c0392b');}
    else if(h==='chef'){r(9,1+hs,10,7,hc);r(8,3+hs,12,3,hc);}
    else if(h==='nurse'){r(10,4+hs,8,4,hc);r(13,5+hs,2,2,'#d22');}
    else if(h==='straw'){r(6,6+hs,16,2,hc);r(10,3+hs,8,4,hc);}
    else if(h==='top'){r(7,6+hs,14,2,hc);r(10,0+hs,8,7,hc);r(10,5+hs,8,1,'#c33');}
    if(o.spark){px(4,10,'#ffd84a');px(24,8,'#ffd84a');px(23,12,'#ff9a3a');}
  },
  nisse(){
    const hat=o.hat||'#c0392b',beard=o.beard||'#eee',big=o.big,sm=o.small;const top=sm?4:1;
    r(8,21,12,9,sh(hat,-.1));r(8,21,12,2,sh(hat,.2));r(12,23,4,7,sh(hat,-.3));r(9,29,4,3,'#2a2420');r(15,29,4,3,'#2a2420');           // robe + boots
    r(6,22,3,6,sh(hat,-.25));r(19,22,3,6,sh(hat,-.25));r(6,27,3,2,SK);r(19,27,3,2,SK);
    r(11,12,6,8,SK);                                                                                                                       // face
    if(o.fem){r(9,13,2,10,'#d9a05a');r(17,13,2,10,'#d9a05a');}
    r(10,15,8,(o.long?12:7),beard);r(12,15,4,1,sh(beard,-.15));r(11,17,6,1,sh(beard,-.1));
    px(12,13,'#14101c');px(15,13,'#14101c');r(13,14,2,2,'#e8837a');                                                                        // eyes + red nose
    r(9,10+(sm?1:0),10,3,sh(hat,-.15));                                                                                                     // brim
    for(let i=0;i<9-top;i++){const w=Math.max(2,10-Math.floor(i*1.0));r(14-Math.floor(w/2),top+1+i,w,1,i%3===0?sh(hat,.12):hat);}
    r(13,top,3,2,sh(hat,.3));
    if(o.big){r(6,22,3,3,hat);r(19,22,3,3,hat);}
    if(o.crown){r(10,top+8,8,2,'#ffd84a');px(10,top+7,'#ffd84a');px(13,top+7,'#ffd84a');px(17,top+7,'#ffd84a');}
    if(o.pipe){r(17,16,3,1,'#5a3b1c');r(19,14,2,2,'#6a4a2c');px(20,12,'#bbb');px(21,10,'#999');}
    if(o.lantern){r(3,22,3,4,'#ffd84a');r(3,21,3,1,'#222');r(3,26,3,1,'#222');}
    if(o.bow){r(22,18,1,9,'#5a3b1c');px(21,18,'#5a3b1c');px(21,26,'#5a3b1c');r(21,19,1,7,'#ccc');}
    if(o.shield){disc(4,24,3,'#8a8a8a');px(4,24,'#ddd');}
    if(o.fiddle){r(2,23,4,5,'#a0652b');r(4,18,1,5,'#5a3b1c');}
    if(o.bowl){r(2,26,5,3,'#ddd');r(3,25,3,1,'#c9a34a');}
    if(o.pick){r(23,20,1,8,'#6a4a2c');r(21,19,5,2,'#999');}
    if(o.stamp){r(2,22,4,3,'#a22');r(3,25,2,3,'#6a4a2c');}
    if(o.needle){r(23,20,1,9,'#ddd');px(23,20,'#f66');}
    if(o.tie){r(13,21,2,5,'#d22');}
    if(o.glasses){r(11,12,3,3,'#9ad');r(15,12,3,3,'#9ad');px(12,13,'#14101c');px(16,13,'#14101c');}
    if(o.helmet){r(10,top+8,8,3,'#888');}
    if(o.book){r(2,24,5,4,'#6a3a2a');r(3,25,3,2,'#eee');}
    if(o.pen){r(22,20,1,8,'#e8b100');}
    if(o.sneak||o.mask){r(11,12,6,2,'#223');px(12,12,'#fff');px(15,12,'#fff');}
    if(o.spark){px(3,12,'#ffd84a');px(25,10,'#ffd84a');px(24,16,'#ff9a3a');}
    if(o.mask===undefined&&o.round){r(7,24,14,3,sh(hat,-.1));}
  },
  troll(){
    const c=o.ice?'#9fc4e6':(o.hag?'#7a8a62':'#6e7d8d'),d=sh(c,-.25),l=sh(c,.2);
    r(4,16,20,13,c);r(4,16,20,2,l);r(2,18,3,9,d);r(23,18,3,9,d);r(1,25,4,3,c);r(23,25,4,3,c);r(7,27,5,4,d);r(16,27,5,4,d);    // body+arms+legs
    r(8,5,12,12,c);r(8,5,12,2,l);r(7,8,2,4,d);r(19,8,2,4,d);                                                                    // head+ears
    r(9,9,10,2,d);px(11,10,'#ffd84a');px(16,10,'#ffd84a');r(12,12,5,3,sh(c,.1));px(13,14,d);px(15,14,d);                         // brow, eyes, nose
    r(9,15,10,2,d);px(10,14,'#eee');px(18,14,'#eee');px(11,15,'#eee');px(17,15,'#eee');
    if(o.hag){r(6,4,16,3,'#9a9a9a');r(6,6,3,10,'#9a9a9a');r(19,6,3,10,'#9a9a9a');r(9,17,10,10,'#6a3a5a');}
    if(o.crown){r(8,2,12,2,'#ffd84a');px(8,1,'#ffd84a');px(13,1,'#ffd84a');px(19,1,'#ffd84a');}
    if(o.ice){px(10,18,'#fff');px(18,22,'#fff');px(7,20,'#fff');}
    for(let i=0;i<6;i++)px(6+((R()*16)|0),18+((R()*9)|0),l);
  },
  ghost(){
    const c=o.col||'#aac4cc';
    for(let y=4;y<27;y++){const w=y<10?6+((y-4)*1):12;const x0=14-Math.floor(w/2);for(let x=0;x<w;x++){px(x0+x,y,(y+x)%7===0?sh(c,.25):c);}}
    for(let x=0;x<12;x++){const h=((x*5)%4);r(8+x,27,1,h+1,c);}
    r(10,10,3,4,'#14101c');r(16,10,3,4,'#14101c');px(11,11,'#cfe');px(17,11,'#cfe');r(12,17,5,3,'#14101c');
    if(o.mare){r(9,2,2,4,'#463'); r(18,2,2,4,'#463');}
    if(o.fog){for(let i=0;i<10;i++)r((R()*20)|0,(R()*26)|0,5,1,'rgba(255,255,255,.35)');}
  },
  beast(){
    const c=o.fur||'#6a5a4a',d=sh(c,-.25),l=sh(c,.2);const kind=o.kind||'wolf';
    r(6,14,16,15,c);r(6,14,16,2,l);r(7,26,5,5,d);r(16,26,5,5,d);                                                     // body+paws
    r(7,5,14,12,c);r(7,5,14,2,l);
    if(kind==='cat'){r(7,2,3,4,c);r(18,2,3,4,c);px(8,3,'#e9a');px(19,3,'#e9a');r(11,13,6,3,sh(c,.35));px(13,13,'#e9a');}
    else if(kind==='goat'){r(6,0,2,6,'#ddd');r(20,0,2,6,'#ddd');r(5,0,2,2,'#bbb');r(21,0,2,2,'#bbb');r(12,14,4,5,'#eee');}
    else{r(7,2,3,4,c);r(18,2,3,4,c);r(10,12,8,6,sh(c,.15));px(13,13,'#111');px(14,13,'#111');r(11,17,6,1,'#eee');px(12,16,'#fff');px(16,16,'#fff');}
    const ec=o.grim?'#ff3a2a':'#ffd84a';px(10,9,ec);px(11,9,ec);px(16,9,ec);px(17,9,ec);
    if(o.grim){r(9,22,10,2,'#555');}
  },
  owl(){
    const c=o.rokk?'#7a7468':'#8a6f4a',d=sh(c,-.25),l=sh(c,.25);const big=o.rokk;
    r(big?3:6,big?9:11,big?22:16,big?20:18,c);r(big?3:6,big?9:11,big?22:16,2,l);r(8,6,12,6,c);r(8,4,3,3,c);r(17,4,3,3,c);
    disc(11,10,3,'#fff6c8');disc(17,10,3,'#fff6c8');px(11,10,'#111');px(17,10,'#111');px(14,12,'#e8a100');px(14,13,'#e8a100');
    for(let y=16;y<27;y+=3)for(let x=9;x<20;x+=3)px(x,y,d);
    if(big){r(2,12,5,10,d);r(21,12,5,10,d);}
    r(10,28,3,2,'#e8a100');r(15,28,3,2,'#e8a100');
  },
  log(){
    r(4,6,20,22,'#7a4a24');r(5,5,18,1,'#7a4a24');disc(14,16,10,'#8e5a2c');disc(14,16,7,'#c89a5c');disc(14,16,4,'#a87a42');disc(14,16,1,'#7a4a24');
    r(5,26,18,3,'#5a3418');px(5,10,'#4a2a12');px(22,12,'#4a2a12');
    r(10,13,2,3,'#14101c');r(17,13,2,3,'#14101c');r(12,19,5,1,'#14101c');px(11,18,'#14101c');px(17,18,'#14101c');
    r(2,14,2,4,'#3a8a3a');r(24,10,2,3,'#3a8a3a');
  },
  lantern(){
    if(o.wisp){const R2=rng(5);for(let i=0;i<14;i++)px(6+((R2()*16)|0),14+((R2()*14)|0),i%3?'#3a9a8a':'#6adac0');disc(14,10,5,'#bff');disc(14,10,3,'#fff');disc(14,10,6,'rgba(120,255,230,.0)');px(12,10,'#14101c');px(16,10,'#14101c');return;}
    r(13,2,2,4,'#333');r(10,5,8,2,'#333');r(9,7,10,16,'#cfa24a');r(10,8,8,14,'#ffd84a');r(12,10,4,10,'#fff3a0');r(9,23,10,3,'#333');r(8,26,12,2,'#6a4a2c');
    px(12,12,'#14101c');px(16,12,'#14101c');r(13,16,2,1,'#14101c');r(11,7,1,15,'#333');r(17,7,1,15,'#333');
    px(4,6,'#ffe9a0');px(23,9,'#ffe9a0');px(22,20,'#ffe9a0');px(5,19,'#ffe9a0');
  },
  witch(){
    const hat='#2a1a3a';
    r(8,15,12,14,'#2a2a44');r(6,16,3,10,'#222238');r(19,16,3,10,'#222238');r(5,25,3,3,'#7ab26a');r(20,25,3,3,'#7ab26a');
    r(9,28,4,3,'#111');r(15,28,4,3,'#111');
    r(10,8,8,8,'#7ab26a');r(9,10,2,8,'#1a1420');r(17,10,2,8,'#1a1420');px(12,11,'#ffd84a');px(16,11,'#ffd84a');r(13,12,2,3,'#5a9a4a');px(14,15,'#14101c');r(12,15,5,1,'#14101c');
    r(6,7,16,2,hat);r(9,3,10,5,hat);r(11,0,6,4,hat);r(9,6,10,1,'#7a4aa8');px(15,6,'#ffd84a');
    px(25,10,'#7affc0');px(3,14,'#7affc0');
  },
  vehicle(){
    const c=o.col||'#e8a100';
    if(o.bus){r(1,10,26,14,c);r(1,10,26,2,sh(c,.25));for(let i=0;i<5;i++)r(3+i*5,13,4,5,'#bdf');r(24,13,3,8,'#bdf');}
    else if(o.sport){r(2,15,24,8,c);r(7,10,14,6,c);r(9,11,4,4,'#bdf');r(15,11,4,4,'#bdf');px(25,18,'#ffd84a');r(2,21,24,1,'#555');px(2,17,'#f33');}
    else{r(3,13,20,10,c);r(3,13,20,2,sh(c,.25));r(14,8,8,6,c);r(16,9,5,4,'#bdf');px(24,17,'#ffd84a');r(23,15,3,7,'#999');
      if(o.plow){r(22,10,5,16,'#c0392b');r(22,10,5,2,'#e66');px(1,16,'#f33');}r(12,6,4,2,'#fa3');px(13,5,'#ffd84a');}
    disc(7,26,3,'#222');disc(7,26,1,'#888');disc(20,26,3,'#222');disc(20,26,1,'#888');
    for(let i=0;i<10;i++)px(2+((R()*24)|0),((o.sport?14:12)+(R()*10))|0,'#fff');
  },
  kiosk(){
    r(5,13,18,15,'#d9b86a');r(4,9,20,5,'#c0392b');for(let x=4;x<24;x+=4)r(x,9,2,5,'#fff');r(7,16,14,6,'#2a1a10');r(8,17,12,4,'#ffd8a0');
    r(2,26,24,4,'#555');r(12,3,4,6,'#c0392b');r(8,5,12,3,'#ffd84a');px(14,6,'#222');r(9,23,4,3,'#9a3a1a');
    px(5,5,'#aaa');px(7,3,'#999');px(6,1,'#888');
  },
  snowman(){
    const c=o.blue?'#cfe4ff':'#f4f8ff';
    disc(14,24,6,c);disc(14,15,5,c);disc(14,8,4,c);r(10,4,8,2,'#222');r(11,0,6,5,'#222');
    px(12,7,'#14101c');px(16,7,'#14101c');r(14,9,5,1,'#f08a20');px(11,12,'#111');px(15,16,'#111');px(15,21,'#111');r(5,15,5,1,'#6a4a2c');r(19,13,5,1,'#6a4a2c');
    r(10,12,9,2,o.blue?'#2a5db0':'#c0392b');
  },
  mitten(){
    r(7,14,14,15,'#c0392b');r(3,17,5,8,'#c0392b');r(7,8,10,8,'#c0392b');r(7,26,14,4,'#f1f1f1');
    for(let y=12;y<26;y+=3)for(let x=9;x<19;x+=3)px(x+(y%2),y,'#f1f1f1');px(12,11,'#f1f1f1');px(14,10,'#f1f1f1');
    px(2,29,'#9cf');px(25,6,'#9cf');
  },
  tin(){
    disc(14,19,10,'#8a2a2a');r(5,10,18,4,'#c0392b');r(4,12,20,3,'#a33');r(5,22,18,5,'#7a1f1f');disc(14,19,6,'#f0d8a8');
    r(10,16,8,1,'#a33');r(10,19,8,1,'#a33');r(10,22,6,1,'#a33');px(14,9,'#ddd');r(12,8,5,2,'#ddd');
  },
  draugr(){
    const c=o.col||'#6a7a5a',d=sh(c,-.3),l=sh(c,.2);
    r(6,16,16,13,'#3d4a44');r(6,16,16,2,'#4c5a52');for(let i=0;i<5;i++)r(7+i*3,25+(i%2),2,4+(i%2),'#2d3834');
    r(2,18,4,10,c);r(22,18,4,10,c);r(9,27,3,4,c);r(16,27,3,4,c);
    r(8,5,12,12,c);r(8,5,12,2,l);r(10,9,4,4,'#14101c');r(15,9,4,4,'#14101c');px(12,11,'#6fffd0');px(17,11,'#6fffd0');r(13,13,2,2,d);r(11,15,7,1,d);for(let x=11;x<18;x+=2)r(x,14,1,2,'#d8d8c8');
    if(o.captain){r(6,2,16,4,'#222');r(9,0,10,3,'#222');r(13,1,2,1,'#ffd84a');for(let i=0;i<6;i++)px(6+i*4,31,'#4aa8c0');r(6,8,2,10,'#3a8aa0');}
    if(o.hollow){r(10,18,8,8,'#14101c');r(12,20,2,2,'#6fffd0');}
    if(o.rider){r(2,22,24,8,'#1a1a24');r(22,16,5,8,'#1a1a24');px(25,18,'#f33');}
  },
  hulder(){
    r(8,14,12,15,'#2d6a3a');for(let y=15;y<29;y+=2)r(9+(y%4),y,2,1,'#3d8a4a');r(6,16,3,9,'#f1d4b8');r(19,16,3,9,'#f1d4b8');
    r(10,6,8,9,'#f4d9bc');r(8,6,12,3,'#c0722a');r(7,8,3,18,'#c0722a');r(18,8,3,18,'#c0722a');px(12,10,'#14101c');px(16,10,'#14101c');r(13,12,2,1,'#c85a5a');
    r(22,24,4,2,'#6a4a2c');r(24,26,3,5,'#6a4a2c');r(24,30,3,2,'#222');
    r(9,28,4,3,'#f1d4b8');r(15,28,4,3,'#f1d4b8');px(11,8,'#f66');
  },
  tall(){
    r(11,0,6,6,'#cfcfd8');r(12,2,1,1,'#14101c');r(15,2,1,1,'#14101c');r(12,4,4,1,'#14101c');
    r(10,6,8,22,'#16161c');r(2,8,8,2,'#16161c');r(18,8,8,2,'#16161c');r(0,9,3,14,'#16161c');r(25,9,3,14,'#16161c');
    r(10,28,3,4,'#111');r(15,28,3,4,'#111');r(13,8,2,16,'#24242c');r(9,6,10,1,'#222');
  },
  worm(){
    const c='#5a8a4a',l=sh(c,.25),d=sh(c,-.3);
    for(let t=0;t<40;t++){const x=14+Math.sin(t/5.5)*9,y=30-t*0.6;disc(Math.round(x),Math.round(y),3,t%4<2?c:sh(c,-.08));}
    r(18,2,9,6,c);r(18,2,9,2,l);px(20,4,'#ffd84a');px(24,4,'#ffd84a');r(26,6,2,1,'#c33');r(19,7,7,1,'#fff');
    for(let t=3;t<40;t+=3){const x=14+Math.sin(t/5.5)*9,y=30-t*0.6;px(Math.round(x),Math.round(y)+2,d);}
  },
  nokken(){
    const c=o.fossegrim?'#5a8aa0':'#4a8a64',d=sh(c,-.3);
    for(let x=0;x<28;x+=2){r(x,28,2,1,'#6fd0e6');r(x+1,29,2,1,'#3a8ab0');r(x,30,3,2,'#2a6a9a');}
    r(8,14,12,14,c);r(4,16,5,8,c);r(19,16,5,8,c);r(9,5,10,10,c);r(9,5,10,2,sh(c,.25));
    r(10,8,3,2,'#ffd84a');r(15,8,3,2,'#ffd84a');px(11,8,'#111');px(16,8,'#111');r(11,12,7,1,d);for(let x=9;x<19;x+=2)px(x,4,sh(c,.4));
    r(2,13,9,3,'#a0652b');r(4,10,3,3,'#a0652b');r(0,20,10,1,'#c9a34a');if(o.fossegrim){r(11,16,6,6,'#bfe0f0');r(12,17,4,4,'#fff');}
  },
  gnome(){
    const c=o.col||'#788';
    r(8,16,12,13,sh(c,-.1));r(10,6,8,10,c);r(7,2,14,6,sh(c,-.25));r(9,0,10,3,sh(c,-.25));px(12,10,'#ffd84a');px(16,10,'#ffd84a');r(12,13,5,1,'#14101c');r(13,11,3,2,sh(c,.2));
    r(5,18,3,8,c);r(20,18,3,8,c);r(9,28,4,3,'#333');r(15,28,4,3,'#333');
  },
  spider(){
    const c='#2d2a38';
    disc(14,19,6,c);disc(14,11,4,c);r(11,9,2,2,'#f33');r(16,9,2,2,'#f33');px(10,8,'#f33');px(19,8,'#f33');
    for(let i=0;i<4;i++){const y=13+i*3;for(let x=0;x<9;x++){px(4+x*(i%2?1:1),y-Math.floor(Math.abs(x-4)/2)+(i<2?-2:1),c);px(24-x,y-Math.floor(Math.abs(x-4)/2)+(i<2?-2:1),c);}}
    r(10,17,8,2,'#c33');r(11,22,6,2,'#c33');if(true){r(11,3,6,2,'#ffd84a');r(10,2,2,2,'#ffd84a');r(14,2,2,2,'#ffd84a');r(17,2,1,2,'#ffd84a');}
  },
  bat(){
    const c='#3a2f4a';
    r(11,10,6,10,c);r(11,6,6,6,c);r(11,4,2,3,c);r(15,4,2,3,c);px(12,8,'#f33');px(15,8,'#f33');px(13,11,'#fff');px(15,11,'#fff');
    for(let i=0;i<10;i++){r(10-i,9+Math.floor(i/2),1,7-Math.floor(i/2)+(i%2),c);r(17+i,9+Math.floor(i/2),1,7-Math.floor(i/2)+(i%2),c);}
  },
  golem(){
    const c=o.col||'#6f86b8';
    r(7,3,14,9,c);r(4,12,20,16,c);r(2,14,3,12,sh(c,-.2));r(23,14,3,12,sh(c,-.2));r(7,27,5,4,sh(c,-.3));r(16,27,5,4,sh(c,-.3));
    for(let y=14;y<27;y+=4)for(let x=6;x<22;x+=7){r(x,y,6,3,sh(c,.2));r(x+2,y+1,2,1,'#222');}
    r(10,6,3,3,'#ffd84a');r(16,6,3,3,'#ffd84a');r(11,10,7,1,'#222');
  },
  machine(){
    const c=o.col||'#6a7a9a';
    r(4,12,20,16,c);r(4,12,20,2,sh(c,.25));r(7,6,14,7,sh(c,-.15));r(9,16,10,3,'#222');r(8,22,4,3,'#ffd84a');r(16,22,4,3,'#d33');
    if(o.press){r(12,0,4,8,'#aaa');r(8,5,12,3,'#ccc');r(10,10,8,2,'#aa2a2a');}else{r(10,8,8,1,'#eee');r(11,9,6,3,'#eee');}
    r(5,28,5,3,'#222');r(18,28,5,3,'#222');
  },
  bellcart(){
    const c=o.col||'#c0392b';
    r(3,20,22,5,'#6a4a2c');r(3,20,22,1,'#8a6a4c');disc(8,27,4,'#222');disc(8,27,2,'#777');disc(20,27,4,'#222');disc(20,27,2,'#777');
    if(o.pot){disc(14,15,6,'#333');r(8,10,12,3,'#444');px(12,6,'#ccc');px(15,5,'#ccc');px(14,3,'#bbb');r(10,12,8,2,'#3a9a3a');}
    else if(o.sling){r(13,4,2,16,'#6a4a2c');r(8,4,12,2,'#6a4a2c');r(6,2,3,3,'#888');r(8,5,1,6,'#a85');}
    else{r(11,4,6,3,'#c9a34a');r(9,7,10,9,'#e8c34a');r(8,14,12,3,'#c9a34a');px(14,17,'#555');r(6,12,2,8,c);}
  },
  frost(){
    const c='#dff0ff';
    r(13,2,2,28,c);r(2,15,24,2,c);for(let i=0;i<10;i++){px(5+i,6+i,c);px(22-i,6+i,c);px(5+i,25-i,c);px(22-i,25-i,c);}
    for(let k=0;k<4;k++){const x=[13,13,2,25][k],y=[4,27,16,16][k];r(x-2,y,6,1,c);}
    disc(14,16,2,'#fff');for(let i=0;i<14;i++)px((R()*28)|0,(R()*32)|0,'#fff');
  },
  fog(){
    for(let y=4;y<30;y+=5){for(let x=-4;x<30;x+=7){r(x+((y*3)%6),y,9,3,y%10===4?'#cfd8de':'#a8b4bc');}}
    r(9,14,3,3,'#fff6a0');r(17,14,3,3,'#fff6a0');px(10,15,'#111');px(18,15,'#111');
  },
  rain(){
    disc(9,10,5,'#7e8ca0');disc(16,8,6,'#7e8ca0');disc(22,11,4,'#7e8ca0');r(5,10,20,5,'#7e8ca0');r(5,14,20,1,'#667488');
    for(let i=0;i<22;i++){const x=3+((i*7)%24),y=18+((i*5)%12);r(x,y,1,3,'#7ac0ff');}
  },
  thaw(){
    disc(14,10,6,'#ffd84a');disc(14,10,4,'#fff3a0');for(let i=0;i<8;i++){const a=i*Math.PI/4;r(Math.round(14+Math.cos(a)*9),Math.round(10+Math.sin(a)*9),2,2,'#ffd84a');}
    for(let x=4;x<26;x+=5){const h=5+((x*3)%7);r(x,19,3,h,'#bfe6ff');px(x+1,19+h,'#7ac0ff');}r(2,29,24,2,'#5a9ad0');
  },
  horn(){
    for(let i=0;i<16;i++){const x=4+i,y=24-Math.round(Math.pow(i/16,1.6)*16);const w=2+Math.floor(i/2.2);r(x,y-Math.floor(w/2),2,w,i%4<2?'#e8c34a':'#c9a34a');}
    r(21,2,6,12,'#e8c34a');r(21,2,6,2,'#fff3a0');r(3,24,4,4,'#6a4a2c');px(2,10,'#ffd84a');px(25,17,'#ffd84a');px(5,6,'#ffd84a');
  },
  fire(){
    const f=[['#d33',12],['#f80',9],['#fc3',6],['#ffe',3]];
    for(const[c,w]of f){const h=(w*2.1)|0;for(let y=0;y<h;y++){const ww=Math.max(2,Math.round(w*Math.sin(Math.PI*(y/h)*.9+.3)));r(14-ww+((y%3)-1)*(w>6?1:0),29-y-(12-w),ww*2,1,c);}}
    px(8,6,'#f80');px(20,4,'#fc3');px(19,10,'#f80');
  },
  dummy(){
    r(10,4,8,8,'#d8b872');px(12,7,'#14101c');px(16,7,'#14101c');r(12,10,5,1,'#14101c');r(9,3,10,2,'#a77a3a');
    r(12,12,4,12,'#c9a35a');r(3,13,22,3,'#c9a35a');r(10,24,3,6,'#b0894a');r(15,24,3,6,'#b0894a');
    for(let i=0;i<8;i++){px(3+((i*3)%22),12+(i%3),'#ffe19a');}r(13,14,2,2,'#a33');
  }};
  (F[k]||F.person)();
  // outline pass
  const id=g.getImageData(0,0,W,H),d=id.data;const A=(x,y)=>x<0||y<0||x>=W||y>=H?0:d[(y*W+x)*4+3];const out=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!A(x,y)&&(A(x-1,y)||A(x+1,y)||A(x,y-1)||A(x,y+1)))out.push([x,y]);
  const C=document.createElement('canvas');C.width=W;C.height=H;const c=C.getContext('2d');
  const wd=(typeof document!=='undefined'&&document.documentElement.dataset.theme!=='blue');const[b0,b1]=(wd?BGW:BG)[card.faction]||BG.neutral;const gr=c.createLinearGradient(0,0,0,H);gr.addColorStop(0,b0);gr.addColorStop(1,b1);c.fillStyle=gr;c.fillRect(0,0,W,H);
  const R2=rng(hash(card.id+'bg'));for(let i=0;i<14;i++){c.fillStyle='rgba(255,255,255,'+(0.12+R2()*.25).toFixed(2)+')';c.fillRect((R2()*W)|0,(R2()*H)|0,1,1);}
  c.fillStyle='rgba(0,0,0,.28)';c.fillRect(0,H-3,W,3);
  c.drawImage(S,0,0);c.fillStyle='#14101c';for(const[x,y]of out)c.fillRect(x,y,1,1);
  return C.toDataURL('image/png');
}
function art(card){const k=card.id+((typeof document!=='undefined'&&document.documentElement.dataset.theme==='blue')?'|b':'|w');return cache[k]||(cache[k]=draw(card));}
root.KventArt={art,W,H,draw};
})(typeof self!=='undefined'?self:this);
