/* KVENT wood theme (job kventskin): theme switch + procedural wood textures, generated ONCE (canvas -> data URL -> CSS variables).
   Theme is saved in localStorage 'kvent.theme' ('wood' default | 'blue' = the original look). The html element gets data-theme and, for wood, class "wd".
   Loaded in <head> BEFORE the page paints, so there is no flash. No images, no animation, no filters: textures are made once (~40 ms) and cached in sessionStorage. */
(function(){
'use strict';
var de=document.documentElement,KEY='kvent.theme',TEX='kvent.woodtex.v3';
function get(){try{var v=localStorage.getItem(KEY);return v==='blue'?'blue':'wood';}catch(e){return 'wood';}}
function apply(t){de.dataset.theme=t;de.classList.toggle('wd',t==='wood');if(t==='wood')ensureTex();
  var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='wood'?'#2a170b':'#0d1020';}
function set(t){t=t==='blue'?'blue':'wood';try{localStorage.setItem(KEY,t);}catch(e){}apply(t);}
window.KventTheme={get:get,set:set,toggle:function(){set(get()==='wood'?'blue':'wood');}};
/* ---------- procedural wood ---------- */
function vnoise(seed,px,py){/* periodic value noise (tiles seamlessly) */
  function h(x,y){x=((x%px)+px)%px;y=((y%py)+py)%py;var n=Math.imul(x*374761393+y*668265263+seed*2246822519|0,1274126177);n^=n>>>13;n=Math.imul(n,1103515245);return((n^(n>>>16))>>>0)/4294967296;}
  return function(x,y){var x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a=h(x0,y0),b=h(x0+1,y0),c=h(x0,y0+1),d=h(x0+1,y0+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};}
function lumMap(W,H,planks,seed){/* returns Float32Array of 0..1 grain brightness + plank index per row band */
  var L=new Float32Array(W*H),ph=H/planks,w1=vnoise(seed,3,planks*2),w2=vnoise(seed+7,6,planks*10),f1=vnoise(seed+3,12,planks*60),f2=vnoise(seed+5,48,planks*120),pores=vnoise(seed+9,96,planks*40);
  var knots=[];for(var p=0;p<planks;p++){var r=((p*7919+seed*131)%97)/97;knots.push([W*(.2+.6*r),p*ph+ph*(.3+.4*(((p*31+seed)%13)/13))]);}
  for(var y=0;y<H;y++){var p=Math.floor(y/ph),yy=y-p*ph,edge=Math.min(yy,ph-1-yy);
    for(var x=0;x<W;x++){
      var u=x/W,v=y/H,warp=(w1(u*3+p*1.3,v*planks*2)-.5)*2.4+(w2(u*6,v*planks*10)-.5)*.7;
      var kx=knots[p][0],ky=knots[p][1],dx=(x-kx)/(W*.16),dy=(y-ky)/(ph*.34),kd=dx*dx+dy*dy,kn=kd<2.2?Math.exp(-kd*1.3)*1.9:0;
      var rings=.5+.5*Math.sin((v*planks*9+warp+kn*1.6)*6.2831853);
      var fib=f1(u*12,v*planks*60+warp*3)*.6+f2(u*48,v*planks*120)*.4;
      var pore=pores(u*96,v*planks*40)>.93?.7:1;
      var l=.30+rings*.30+(fib-.5)*.55;l*=pore;l-=kn*.12;
      if(edge<1.6)l*=.35;else if(edge<3)l*=.8;   /* seam between planks */
      L[y*W+x]=Math.max(0,Math.min(1,l))+0*p;}}
  return {L:L,ph:ph};}
function colorize(W,H,planks,map,lo,hi,tints){var c=document.createElement('canvas');c.width=W;c.height=H;var g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data,ph=map.ph;
  for(var y=0;y<H;y++){var t=tints[Math.floor(y/ph)%tints.length];for(var x=0;x<W;x++){var l=map.L[y*W+x],i=(y*W+x)*4;
    for(var k=0;k<3;k++){d[i+k]=Math.max(0,Math.min(255,(lo[k]+(hi[k]-lo[k])*l)*t));}d[i+3]=255;}}
  g.putImageData(im,0,0);
  /* seam highlights */
  g.fillStyle='rgba(255,220,160,.10)';for(var p=1;p<planks;p++)g.fillRect(0,Math.round(p*ph)+1,W,1);
  return c.toDataURL('image/jpeg',.82);}
function leather(){var S=128,c=document.createElement('canvas');c.width=c.height=S;var g=c.getContext('2d'),im=g.createImageData(S,S),d=im.data,n1=vnoise(21,32,32),n2=vnoise(22,64,64);
  for(var y=0;y<S;y++)for(var x=0;x<S;x++){var v=n1(x/4,y/4)*.55+n2(x/2,y/2)*.45,i=(y*S+x)*4,s=.55+v*.7;d[i]=64*s;d[i+1]=30*s;d[i+2]=22*s;d[i+3]=255;}
  g.putImageData(im,0,0);return c.toDataURL('image/jpeg',.85);}
function ensureTex(){if(de.dataset.tex==='1')return;var t=null;try{t=JSON.parse(sessionStorage.getItem(TEX)||'null');}catch(e){}
  if(!t){try{var W=512,H=512,m=lumMap(W,H,4,11);
      t={walnut:colorize(W,H,4,m,[26,13,6],[104,64,32],[1,.9,1.06,.95]),oak:colorize(W,H,4,m,[88,56,28],[196,142,78],[1,.92,1.06,.97]),leather:leather()};
      try{sessionStorage.setItem(TEX,JSON.stringify(t));}catch(e){}}catch(e){return;}}
  de.style.setProperty('--tex-walnut','url('+t.walnut+')');de.style.setProperty('--tex-oak','url('+t.oak+')');de.style.setProperty('--tex-leather','url('+t.leather+')');de.dataset.tex='1';}
apply(get());
if(de.classList.contains('wd')&&document.readyState==='loading'){/* textures are ready before first paint of the body */}
})();
