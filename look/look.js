/* Downtown Adventure - LOOK module (lazy: only fetched the first time CINEMATIC or REALISTIC is chosen).
   window.__LOOK (a small stub in index.html) owns the toggle/UI; this file fills in L.apply(n), L.render() and L.patchVox().
   n: 1 = TODAY (nothing here runs), 2 = CINEMATIC light, 3 = REALISTIC materials.
   Real-time WebGL2 through three.js: HDR scene target with depth (MSAA), SSAO, screen-space reflections on wet ground / ice / glass,
   analytic light-shaft scattering, a bloom pyramid, depth of field, ACES grade, and per-material shader patches (PBR atlas for REALISTIC).
   Everything is undone by L.apply(1): materials, lights, shadows, sky, aurora and the render path go back to exactly what TODAY uses. */
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const L = window.__LOOK;
const Q = new URLSearchParams(location.search);
const ctx = () => window.__LCTX;
const REAL = () => L.n === 3;
L.opt = {focus: 0, ap: 1, exposure: 1, bloom: 1, ao: 1, grain: 1, dof: 1, ssr: 1, shafts: 1};
L.M = {calls: [], tris: [], rjs: [], frames: 0};
const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
L.stats = () => ({look: L.n, pbrMs: L.pbrMs || null, calls: med(L.M.calls), tris: med(L.M.tris), renderJsMs: med(L.M.rjs), n: L.M.calls.length});
L.resetM = () => { L.M.calls = []; L.M.tris = []; L.M.rjs = []; };

const GLSL_NOISE = `
float lk_h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float lk_vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lk_h21(i),lk_h21(i+vec2(1,0)),f.x),mix(lk_h21(i+vec2(0,1)),lk_h21(i+vec2(1,1)),f.x),f.y);}
float lk_fbm(vec2 p){return lk_vn(p)*.55+lk_vn(p*2.07+3.1)*.3+lk_vn(p*4.3+7.7)*.15;}
`;


/* =================== PBR atlas (REALISTIC): built in a Web Worker, falls back to the main thread =================== */
let PBR = null, pbrP = null;
function mkTex(data, W, H, srgb) { const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.flipY = false; tex.anisotropy = 8; if (srgb) tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; return tex; }
function atlasCanvas() { const m = (window.__VOXM || []).find(x => x[2] && x[2].atlas); return m ? m[2].atlas.value.image : null; }
function ensurePBR() {
  if (PBR) return Promise.resolve(PBR);
  if (pbrP) return pbrP;
  const cv = atlasCanvas(); if (!cv) return Promise.reject(new Error('no atlas'));
  const sw = cv.width, sh = cv.height; const px = cv.getContext('2d').getImageData(0, 0, sw, sh).data;
  const t0 = performance.now();
  const done = o => { PBR = {alb: mkTex(o.alb, o.W, o.H, true), nrm: mkTex(o.nrm, o.W, o.H, false), orm: mkTex(o.orm, o.W, o.H, false)}; L.pbrMs = performance.now() - t0; return PBR; };
  const mainThread = async () => { const mod = await import('./pbr.js'); return done(mod.buildPBR(px, sw, sh)); };
  pbrP = new Promise((res, rej) => {
    let w = null;
    try { w = new Worker(new URL('./pbr-worker.js', import.meta.url), {type: 'module'}); } catch (e) { w = null; }
    if (!w) { mainThread().then(res, rej); return; }
    w.onmessage = e => { w.terminate(); if (e.data.error) mainThread().then(res, rej); else res(done(e.data)); };
    w.onerror = () => { try { w.terminate(); } catch (_) { } mainThread().then(res, rej); };
    w.postMessage({data: px, w: sw, h: sh});
  });
  return pbrP;
}

/* =================== voxel material patch (runs inside voxMat's onBeforeCompile; only does anything in CINEMATIC / REALISTIC) =================== */
const TL = (...a) => '(' + a.map(t => `abs(vTile-${t}.)<.5`).join('||') + ')';
L.patchVox = (sh, m, opts) => {
  const N = L.n; if (N < 2) return;
  const R = N === 3;
  const far = (opts.scale || 1) > 1.5;
  let fs = sh.fragmentShader;
  const hdr = `${GLSL_NOISE}
uniform float uLT;uniform float uSpk;uniform sampler2D uNrm;uniform sampler2D uOrm;uniform sampler2D uAlb;
`;
  fs = fs.replace('#include <common>', '#include <common>\n' + hdr);
  let afterMap = '';
  const cls = `
        float lkDist=length(cameraPosition-vW);
        bool isRoadT=${TL(1, 5, 4, 80, 81)};
        bool isSnowT=${TL(0, 17, 53, 26, 42)};
        bool isWaterT=${TL(27, 62)};
        bool isIceT=${TL(3, 30)};
        bool isGlassT=${TL(41, 31, 32)};
        bool isMetalT=${TL(25, 67, 71)};
        bool topF=vNW.y>.5;
        float wetLK=0.;
`;
  if (R) afterMap += 'texC=texture2D(uAlb,auv).rgb;';
  fs = fs.replace('diffuseColor.rgb*=texC;', afterMap + 'if(abs(vTile-27.)<.5||abs(vTile-62.)<.5)texC=mix(vec3(.012,.05,.075),vec3(.03,.11,.15),lk_fbm(vW.xz*.04));\ndiffuseColor.rgb*=texC;\n' + cls + `
        float lumT=dot(texC,vec3(.299,.587,.114));
        ${far ? '' : `
        {float pud=smoothstep(.38,.72,lk_fbm(vW.xz*.33));
         if(isRoadT&&topF)wetLK=mix(.34,.95,pud)*(1.-smoothstep(.5,.8,lumT))*${R ? '1.' : '.9'};
         if(isIceT)wetLK=.55;if(isGlassT)wetLK=.7;
        }`}
        if(isWaterT)wetLK=1.;
        ${R ? 'float ormAO=texture2D(uOrm,auv).r;diffuseColor.rgb*=mix(1.,ormAO,.85);' : ''}
`);
  fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + (R ? `roughnessFactor=texture2D(uOrm,auv).g;` : `if(isSnowT)roughnessFactor=.6;`) + `
        roughnessFactor=mix(roughnessFactor,isWaterT?.025:.07,wetLK*${R ? '.88' : '.8'});
        if(isGlassT)roughnessFactor=.04;`);
  fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + (R ? 'metalnessFactor=texture2D(uOrm,auv).b;' : ''));
  fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + `
        {vec3 Tw,Bw;if(abs(vNW.y)>.5){Tw=vec3(1,0,0);Bw=vec3(0,0,1);}else if(abs(vNW.x)>.5){Tw=vec3(0,0,1);Bw=vec3(0,-1,0);}else{Tw=vec3(1,0,0);Bw=vec3(0,-1,0);}
         vec3 Nm=vNW;
         ${R && !far ? `{vec3 nt=texture2D(uNrm,auv).xyz*2.-1.;float ns=1.-smoothstep(18.,70.,lkDist);Nm=normalize(vNW*mix(1.,nt.z,ns)+(Tw*nt.x+Bw*nt.y)*ns);}` : ''}
         ${!far ? `{vec2 c2=f*2.-1.;Nm=normalize(Nm+(Tw*pow(abs(c2.x),3.)*sign(c2.x)+Bw*pow(abs(c2.y),3.)*sign(c2.y))*.${R ? '10' : '06'});}` : ''}
         if(isWaterT){vec2 w=vW.xz*.9+vec2(uLT*.15,uLT*.11);float e=.02;float a=lk_fbm(w),b=lk_fbm(w+vec2(e,0.)),c=lk_fbm(w+vec2(0.,e));Nm=normalize(Nm+vec3(a-b,0.,a-c)*${R ? '1.1' : '.7'});}
         normal=normalize((viewMatrix*vec4(Nm,0.)).xyz);}
`);
  fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + `
        ${far ? '' : `
        if(isSnowT&&topF){vec3 cell=floor(vW*vec3(70.,1.,70.));float s1=lk_h21(cell.xz+cell.y*3.7);vec3 vd=normalize(cameraPosition-vW);float ph=dot(vd,vec3(lk_h21(cell.xz+1.3),lk_h21(cell.xz+5.1),lk_h21(cell.xz+9.7))-.5)*60.+s1*40.;float gl=smoothstep(.975,1.,s1)*pow(max(sin(ph),0.),10.);gl*=smoothstep(60.,10.,lkDist)*uSpk;totalEmissiveRadiance+=vec3(.85,.95,1.2)*gl*${R ? '9.' : '7.5'};}
        ${R ? 'if(isSnowT){totalEmissiveRadiance+=texC*vec3(.05,.09,.15)*.75;}' : ''}`}
        ${TL(31, 33, 76)}?totalEmissiveRadiance+=texC*.3:vec3(0.);
`);
  fs = fs.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.a=1.-clamp(wetLK,0.,.98);');
  sh.fragmentShader = fs;
  sh.uniforms.uLT = L.uLT || (L.uLT = {value: 0}); sh.uniforms.uSpk = window.__TODSPK || (window.__TODSPK = {value: 1});
  if (R && PBR) { sh.uniforms.uNrm = {value: PBR.nrm}; sh.uniforms.uOrm = {value: PBR.orm}; sh.uniforms.uAlb = {value: PBR.alb}; }
  else { sh.uniforms.uNrm = {value: null}; sh.uniforms.uOrm = {value: null}; sh.uniforms.uAlb = {value: null}; }
};

/* =================== material conversion (in place: Lambert <-> Standard, undone exactly by apply(1)) =================== */
const CONV = new Set();           /* every material we have turned into a Standard one */
function toStd(m, rough, env) {
  if (!m.userData) m.userData = {};
  if (!m.userData.lkStd) {
    m.userData.lkStd = {had: {rough: 'roughness' in m, metal: 'metalness' in m, env: 'envMapIntensity' in m}};
    m.isMeshLambertMaterial = false; m.isMeshStandardMaterial = true;
    Object.defineProperty(m, 'type', {value: 'MeshStandardMaterial', configurable: true, writable: true, enumerable: false});   /* three 0.170: type is a read-only getter on the class; an own property shadows it so the renderer picks the Standard shader */
  }
  m.roughness = rough; m.metalness = 0; m.envMapIntensity = env;
  CONV.add(m);
  m.dispose(); m.needsUpdate = true;       /* dispose = drop the cached programs/uniforms of the old kind; the next render rebuilds them */
}
function toLambert(m) {
  const u = m.userData && m.userData.lkStd; if (!u) return;
  m.isMeshLambertMaterial = true; delete m.isMeshStandardMaterial; delete m.type;
  delete m.roughness; delete m.metalness; delete m.envMapIntensity;
  delete m.userData.lkStd; CONV.delete(m);
  m.dispose(); m.needsUpdate = true;
}
function convertScene() {   /* REALISTIC: props, cars, characters get PBR parameters too (skip anything with its own shader patch) */
  const {scene} = ctx(); let n = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (!m || !m.isMeshLambertMaterial || CONV.has(m) || (m.userData && m.userData.lkSkip)) continue;
      if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') || m.isShaderMaterial) continue;
      const hex = m.color ? m.color.getHSL({h: 0, s: 0, l: 0}).l : .5;
      toStd(m, m.transparent ? .15 : (hex > .75 ? .55 : .78), .8); n++;
    }
  });
  return n;
}
let scanT = 0;

/* =================== world state: shadows / env map / sky / aurora (saved, restored by apply(1)) =================== */
const SV = {};
function envMap() {
  if (S.env) return S.env;
  const {r} = ctx();
  const skyScene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vD;void main(){float y=vD.y;vec3 hor=vec3(.10,.17,.32)*1.4,zen=vec3(.01,.025,.09);vec3 c=mix(hor,zen,smoothstep(-.05,.6,y));vec3 md=normalize(vec3(-.45,.55,-.7));float m=max(dot(vD,md),0.);c+=vec3(.9,1.0,1.4)*pow(m,200.)*30.+vec3(.1,.14,.25)*pow(m,8.);float au=smoothstep(.12,.3,y)*smoothstep(.7,.3,y);c+=vec3(.06,.5,.3)*au*.9+vec3(.3,.12,.5)*smoothstep(.3,.5,y)*smoothstep(.7,.45,y)*.5;gl_FragColor=vec4(c,1.);}'});
  skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
  const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(skyScene, 0, .1, 200); pm.dispose();
  S.env = env.texture; return S.env;
}
function findAurora() { const {scene} = ctx(); let a = null; scene.traverse(o => { if (!a && o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.rib) a = o.material; }); return a; }
function shadowSize() { const g = window.__PERF ? window.__PERF.level : 'high'; return (g === 'med' || ctx().TOUCH) ? 2048 : 4096; }
function applyWorld(n) {
  const {scene, moon, cam} = ctx();
  if (n > 1) {
    if (!SV.on) {
      SV.on = true;
      SV.shadow = {w: moon.shadow.mapSize.x, radius: moon.shadow.radius, bias: moon.shadow.bias, nb: moon.shadow.normalBias};
      SV.near = cam.near; SV.env = scene.environment; SV.envI = scene.environmentIntensity;
      const sk = window.__sky; if (sk) SV.sky = sk.material.fragmentShader;
      const au = findAurora(); if (au) { SV.au = au; SV.auFs = au.fragmentShader; }
    }
    S.shadowSz = shadowSize(); S.shadowCur = 0;
    moon.shadow.radius = 2.5; moon.shadow.bias = -.0004; moon.shadow.normalBias = .035;
    scene.environment = envMap(); scene.environmentIntensity = REAL() ? .9 : .45;
    cam.near = .25; cam.updateProjectionMatrix();
    if (SV.au) { SV.au.fragmentShader = SV.auFs.replace('gl_FragColor=vec4(col*a*.85*(1.0+thr*.35)*k,clamp(a*.5*k,0.,.62))', 'gl_FragColor=vec4(col*a*' + (REAL() ? '1.25' : '1.3') + '*(1.0+thr*.35)*k,clamp(a*.5*k,0.,.62))'); SV.au.needsUpdate = true; }
    const sk = window.__sky;
    if (sk) {
      if (n === 2 && !window.__SKYU) sk.material.fragmentShader = 'uniform float thr;varying vec3 vD;void main(){float y=vD.y;vec3 hor=vec3(.13,.20,.38),zen=vec3(.006,.014,.055);vec3 c=mix(hor,zen,smoothstep(-.04,.5,y));float g=exp(-abs(y)*9.)*.35;c+=vec3(.35,.22,.2)*g*.35;vec3 md=normalize(vec3(-.45,.55,-.7));float m=max(dot(vD,md),0.);c+=vec3(.9,.95,1.2)*pow(m,900.)*14.+vec3(.28,.34,.5)*pow(m,60.)+vec3(.06,.09,.16)*pow(m,6.);c=mix(c,c*vec3(.6,.16,.18),thr);gl_FragColor=vec4(c,1.);}';
      else sk.material.fragmentShader = SV.sky;
      sk.material.needsUpdate = true;
    }
  } else if (SV.on) {
    SV.on = false;
    moon.shadow.mapSize.set(SV.shadow.w, SV.shadow.w); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
    moon.shadow.radius = SV.shadow.radius; moon.shadow.bias = SV.shadow.bias; moon.shadow.normalBias = SV.shadow.nb;
    scene.environment = SV.env; scene.environmentIntensity = SV.envI;
    cam.near = SV.near; cam.updateProjectionMatrix();
    if (SV.au) { SV.au.fragmentShader = SV.auFs; SV.au.needsUpdate = true; }
    const sk = window.__sky; if (sk && SV.sky) { sk.material.fragmentShader = SV.sky; sk.material.needsUpdate = true; }
    ctx().r.shadowMap.needsUpdate = true;
  }
}
function applyShadowSize() {
  const {moon, r} = ctx(); const want = S.shadowSz = shadowSize();
  if (S.shadowCur !== want) { moon.shadow.mapSize.set(want, want); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } S.shadowCur = want; r.shadowMap.needsUpdate = true; }
}

/* ---------- switching ---------- */
L.apply = async function (n, quiet) {
  if (n === L.n) return true;
  if (n > 1) {
    const c = ctx(); if (!c) return false;
    if (!S.q) build();
    if (n === 3) { await ensurePBR(); }
  }
  const prev = L.n; L.n = n;
  const reg = window.__VOXM || [];
  if (n === 1) {
    for (const m of [...CONV]) toLambert(m);
    for (const e of reg) toLambert(e[0]);
    applyWorld(1);
    ctx().r.info.autoReset = true;
    scanT = 0;
  } else {
    for (const e of reg) { toStd(e[0], .92, REAL() ? 1 : .6); }
    if (REAL()) convertScene(); else for (const m of [...CONV]) toLambert(m);
    applyWorld(n);
    scanT = 0;
  }
  S.fr = 0; S.mon.settle = 3; S.mon.acc = 0; S.mon.nf = 0;
  return true;
};

/* =================== the pipeline =================== */
const S = L.S = {q: false, env: null, w: 0, h: 0, fr: 0, rt: {}, mat: {}, focus: 30, shadowSz: 4096, shadowCur: 0, mon: {last: 0, acc: 0, nf: 0, settle: 3}};
const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const COMMON_FS = `
precision highp float;
varying vec2 vUv;
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
vec3 toLin(vec3 c){return pow(c,vec3(2.2));}
vec3 toSRGB(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
`;
const DEPTH_FS = `
uniform sampler2D tDepth;uniform mat4 uInvProj;uniform mat4 uProj;uniform vec2 uRes;
vec3 vpos(vec2 uv){float d=texture2D(tDepth,uv).x;vec4 c=uInvProj*vec4(uv*2.-1.,d*2.-1.,1.);return c.xyz/c.w;}
vec3 vnorm(vec2 uv,vec3 P){vec2 px=1./uRes;vec3 pl=vpos(uv-vec2(px.x,0.)),pr=vpos(uv+vec2(px.x,0.)),pu=vpos(uv+vec2(0.,px.y)),pd=vpos(uv-vec2(0.,px.y));
 vec3 dx=abs(pr.z-P.z)<abs(P.z-pl.z)?pr-P:P-pl;vec3 dy=abs(pu.z-P.z)<abs(P.z-pd.z)?pu-P:P-pd;return normalize(cross(dx,dy));}
`;
const mkMat = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({vertexShader: VS, fragmentShader: COMMON_FS + fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra});


const AO_FS = DEPTH_FS + `
uniform vec3 uK[12];uniform float uR;uniform float uInt;uniform float uFar;
void main(){
 float d0=texture2D(tDepth,vUv).x;if(d0>=.99999){gl_FragColor=vec4(1.);return;}
 vec3 P=vpos(vUv);if(-P.z>uFar){gl_FragColor=vec4(1.);return;}
 vec3 N=vnorm(vUv,P);
 float a=ign(gl_FragCoord.xy)*6.2831853;vec3 rv=vec3(cos(a),sin(a),0.);
 vec3 T=normalize(rv-N*dot(rv,N));vec3 B=cross(N,T);
 float occ=0.;float R=uR*(1.+(-P.z)*.004);
 for(int i=0;i<12;i++){vec3 k=uK[i];vec3 S=P+(T*k.x+B*k.y+N*k.z)*R;vec4 c=uProj*vec4(S,1.);vec2 uv=c.xy/c.w*.5+.5;
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)continue;vec3 Q=vpos(uv);float diff=Q.z-S.z;
  float rc=smoothstep(0.,1.,R/max(abs(P.z-Q.z),.001));occ+=(diff>.03*R?1.:0.)*rc;}
 float ao=1.-occ/12.*uInt;
 float fade=1.-smoothstep(uFar*.55,uFar,-P.z);
 gl_FragColor=vec4(mix(1.,clamp(ao,0.,1.),fade),0.,0.,1.);}
`;
const BLUR_FS = DEPTH_FS + `
uniform sampler2D tAO;uniform vec2 uDir;
void main(){float c=texture2D(tDepth,vUv).x;float zc=vpos(vUv).z;float s=texture2D(tAO,vUv).x,w=1.;
 for(int i=1;i<=4;i++){for(int sg=-1;sg<=1;sg+=2){vec2 uv=vUv+uDir*float(i*sg);float z=vpos(uv).z;float wt=exp(-abs(z-zc)*2.5/max(-zc*.05,.05))*(1.-float(i)*.16);s+=texture2D(tAO,uv).x*wt;w+=wt;}}
 gl_FragColor=vec4(s/w,0.,0.,1.);}
`;

const COMP_FS = DEPTH_FS + `
uniform sampler2D tColor;uniform sampler2D tAO;uniform mat4 uView;uniform mat4 uViewInv;uniform vec3 uCam;uniform float uNear;uniform float uFar;
uniform vec4 uLamp[10];uniform vec3 uLampC[10];uniform int uNL;uniform float uShaft;uniform float uSSR;uniform vec3 uSkyH;uniform vec3 uSkyZ;uniform vec3 uFogC;uniform float uFogD;uniform float uAOon;
uniform vec3 uMoonDir;
vec3 skyAt(vec3 d){float y=clamp(d.y,-.2,1.);vec3 c=mix(uSkyH,uSkyZ,smoothstep(-.05,.55,y));float m=max(dot(d,uMoonDir),0.);c+=vec3(.5,.58,.8)*pow(m,120.)*3.+vec3(.1,.14,.25)*pow(m,8.);
 float au=smoothstep(.1,.35,y)*smoothstep(.75,.35,y);c+=vec3(.05,.45,.28)*au*1.5+vec3(.22,.08,.35)*smoothstep(.3,.5,y)*smoothstep(.75,.45,y)*.9;return c;}
vec3 ssr(vec3 P,vec3 N,vec3 V,float rough,float dither,out float conf){
 vec3 R=normalize(reflect(-V,N));conf=0.;
 float t=.35+dither*.25;vec3 hit=vec3(0.);bool found=false;vec2 huv=vec2(0.);
 float stepL=.25;
 for(int i=0;i<56;i++){vec3 S=P+R*t;vec4 c=uProj*vec4(S,1.);if(c.w<=0.)break;vec2 uv=c.xy/c.w*.5+.5;if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)break;
  float d=texture2D(tDepth,uv).x;if(d>=.99999){t+=stepL;stepL*=1.12;continue;}
  vec3 Q=vpos(uv);float diff=Q.z-S.z; // >0: surface is in front of the ray
  if(diff>0.&&diff<max(.35,stepL*1.6)){ // refine
    float lo=t-stepL,hi=t;for(int j=0;j<6;j++){float mid=(lo+hi)*.5;vec3 S2=P+R*mid;vec4 c2=uProj*vec4(S2,1.);vec2 uv2=c2.xy/c2.w*.5+.5;float z2=vpos(uv2).z;if(z2-S2.z>0.)hi=mid;else lo=mid;}
    vec3 S3=P+R*hi;vec4 c3=uProj*vec4(S3,1.);huv=c3.xy/c3.w*.5+.5;found=true;break;}
  t+=stepL;stepL*=1.12;}
 vec3 col;
 if(found){vec2 e=min(huv,1.-huv);float ef=smoothstep(0.,.08,min(e.x,e.y));col=texture2D(tColor,huv).rgb;conf=ef;}
 else{vec3 Rw=normalize((uViewInv*vec4(R,0.)).xyz);col=skyAt(Rw);conf=Rw.y>-.05?.85:0.;}
 return col;}
void main(){
 vec4 sc=texture2D(tColor,vUv);vec3 col=sc.rgb;float d0=texture2D(tDepth,vUv).x;
 vec3 P=vpos(vUv);float dist=length(P);
 float wet=clamp(1.-sc.a,0.,1.);
 if(d0<.99999){
  float ao=texture2D(tAO,vUv).x;ao=mix(1.,ao,uAOon);col*=mix(ao,1.,smoothstep(1.,3.,lum(col)));
  if(wet>.02&&uSSR>0.){vec3 N=vnorm(vUv,P);vec3 V=normalize(-P);float nv=clamp(dot(N,V),0.,1.);float F=.03+.97*pow(1.-nv,5.);
   float dither=ign(gl_FragCoord.xy+17.);float conf;vec3 rc=ssr(P,N,V,.1,dither,conf);
   float k=clamp(F*1.0+.18*wet,0.,1.)*wet*conf*uSSR;col=mix(col,rc,clamp(k*(.75+.5*wet),0.,.92));
   // wet surfaces also darken the diffuse
   col*=1.-.25*wet;}
 }
 // fog + analytic single-scattering from lamps (ray integral of 1/(d^2+r0^2))
 {vec4 wp4=uViewInv*vec4(P,1.);vec3 dirW=normalize((uViewInv*vec4(normalize(P),0.)).xyz);float T=min(d0>=.99999?400.:dist,260.);
  vec3 sc3=vec3(0.);
  for(int i=0;i<10;i++){if(i>=uNL)break;vec3 Lp=uLamp[i].xyz-uCam;float b=dot(dirW,Lp);float c=dot(Lp,Lp);float r0=uLamp[i].w;float h=sqrt(max(c-b*b,0.)+r0*r0);
   float I=(atan((T-b)/h)-atan(-b/h))/h;sc3+=uLampC[i]*I;}
  float hz=exp(-max(uCam.y+dirW.y*T*.5-uFogC.x*0.,0.)*.0);
  col+=sc3*uShaft;
  float fo=1.-exp(-dist*uFogD);if(d0>=.99999)fo=0.;col=mix(col,uFogC,fo*.0);}
 gl_FragColor=vec4(col,1.);}
`;

const DOWN_FS = `uniform sampler2D tSrc;uniform vec2 uTexel;uniform float uFirst;uniform float uThr;
vec3 kar(vec3 c){float w=1./(1.+lum(c)*.25);return c*w;}
vec3 pre(vec3 c){float l=lum(c);float kn=uThr*.5;float s=clamp(l-uThr+kn,0.,2.*kn);s=s*s/(4.*kn+1e-4);float w=max(s,l-uThr)/max(l,1e-4);return c*max(w,0.);}
void main(){vec2 t=uTexel;vec3 a=texture2D(tSrc,vUv+t*vec2(-1.,-1.)).rgb,b=texture2D(tSrc,vUv+t*vec2(1.,-1.)).rgb,c=texture2D(tSrc,vUv+t*vec2(-1.,1.)).rgb,d=texture2D(tSrc,vUv+t*vec2(1.,1.)).rgb;
 vec3 e=texture2D(tSrc,vUv).rgb;
 vec3 o;if(uFirst>.5){a=pre(a);b=pre(b);c=pre(c);d=pre(d);e=pre(e);}
 o=(a+b+c+d)*.125+e*.5;
 gl_FragColor=vec4(o,1.);}`;
const UP_FS = `uniform sampler2D tSrc;uniform vec2 uTexel;uniform float uW;
void main(){vec2 t=uTexel;vec3 s=texture2D(tSrc,vUv).rgb*4.;s+=texture2D(tSrc,vUv+t*vec2(1,0)).rgb*2.+texture2D(tSrc,vUv-t*vec2(1,0)).rgb*2.+texture2D(tSrc,vUv+t*vec2(0,1)).rgb*2.+texture2D(tSrc,vUv-t*vec2(0,1)).rgb*2.;
 s+=texture2D(tSrc,vUv+t).rgb+texture2D(tSrc,vUv-t).rgb+texture2D(tSrc,vUv+t*vec2(1,-1)).rgb+texture2D(tSrc,vUv+t*vec2(-1,1)).rgb;gl_FragColor=vec4(s/16.*uW,1.);}`;
const FOCUS_FS = DEPTH_FS + `void main(){float z=0.;float w=0.;for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){vec2 uv=vec2(.5)+vec2(float(i),float(j))*.012;float d=texture2D(tDepth,uv).x;if(d<.99999){z+=-vpos(uv).z;w+=1.;}}
 gl_FragColor=vec4(w>0.?z/w:300.,0.,0.,1.);}`;

const FINAL_FS = DEPTH_FS + `
uniform sampler2D tColor;uniform sampler2D tBloom;uniform float uBloom;uniform float uExp;uniform float uFocus;uniform float uAp;uniform float uGrain;uniform float uSeed;uniform float uVig;uniform float uSat;uniform float uDark;uniform float uFade;uniform float uDarkExp;uniform float uDofOn;
vec3 aces(vec3 x){const float a=2.51,b=.03,c=2.43,d=.59,e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);}
void main(){
 float d0=texture2D(tDepth,vUv).x;
 vec3 col=texture2D(tColor,vUv).rgb;
 if(uDofOn>.5){
 float z=d0>=.99999?1e4:-vpos(vUv).z;
 float coc=clamp(uAp*abs(1./uFocus-1./z)*60.,0.,16.)*(uRes.y/1080.);
 if(coc>.7){vec3 acc=col;float ws=1.;float rot=ign(gl_FragCoord.xy)*6.2831;
  for(int i=0;i<28;i++){float fi=float(i)+.5;float r=sqrt(fi/28.);float a=fi*2.39996+rot;vec2 o=vec2(cos(a),sin(a))*r*coc/uRes;vec2 uv=vUv+o;
   float dz=texture2D(tDepth,uv).x;float zz=dz>=.99999?1e4:-vpos(uv).z;float cc=clamp(uAp*abs(1./uFocus-1./zz)*60.,0.,16.)*(uRes.y/1080.);
   float wt=(zz<z)?clamp(cc/(r*coc+.001),0.,1.):1.;acc+=texture2D(tColor,uv).rgb*wt;ws+=wt;}
  col=acc/ws;}}
 col+=texture2D(tBloom,vUv).rgb*uBloom;
 col*=uExp;
 float l=lum(col);
 col=mix(col*vec3(.80,.97,1.14),col*vec3(1.14,1.0,.80),smoothstep(.03,.55,l)); // teal shadows, warm lights
 if(uDark>.001){ /* Threshold World: the same blood-red grade the plain game uses (kept in step with window.__gradeP) */
  vec3 o=col;float L=lum(o);float g=pow(L,1.45)*.8;vec3 dk=vec3(g*.78,g*.66,g*.68);float gx=max(0.,o.g-max(o.r,o.b));
  dk+=vec3(1.25,.08,.04)*(gx*2.2+smoothstep(.8,1.6,L)*1.3+smoothstep(.05,.5,o.r-o.b)*L*1.4);
  dk*=mix(.45,1.,smoothstep(1.15,.3,length(vUv-.5)*1.4));col=mix(col,dk*uDarkExp,uDark);}
 col=aces(col*.92);
 float g=lum(col);col=mix(vec3(g),col,uSat);
 col=pow(max(col,0.),vec3(1.04));  /* saturation > 1 can push a channel below 0: pow(neg) = NaN = black */
 vec2 q=vUv-.5;col*=1.-uVig*smoothstep(.25,.95,length(q*vec2(1.,.9)))*1.0;
 float n=ign(gl_FragCoord.xy+uSeed*61.)+ign(gl_FragCoord.xy*1.37+uSeed*17.)-1.;col+=n*.022*uGrain*(1.-.6*lum(col));
 col*=uFade;
 gl_FragColor=vec4(toSRGB(max(col,0.)),1.);}
`;

/* =================== main render =================== */
function build() {
  const {r, TOUCH} = ctx();
  S.q = true; S.TOUCH = !!TOUCH;
  S.quad = new FullScreenQuad(null);
  const kernel = []; for (let i = 0; i < 12; i++) { const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * .9 + .1; const v = new THREE.Vector3(x, y, z).normalize(); let s = (i + 1) / 12; s = .15 + .85 * s * s; kernel.push(v.multiplyScalar(s)); }
  const U = v => ({value: v});
  S.mat.ao = mkMat(AO_FS, {tDepth: U(null), uInvProj: U(new THREE.Matrix4()), uProj: U(new THREE.Matrix4()), uRes: U(new THREE.Vector2()), uK: U(kernel), uR: U(1.4), uInt: U(1.6), uFar: U(220)});
  S.mat.blur = mkMat(BLUR_FS, {tDepth: U(null), tAO: U(null), uInvProj: U(new THREE.Matrix4()), uProj: U(new THREE.Matrix4()), uRes: U(new THREE.Vector2()), uDir: U(new THREE.Vector2())});
  const lampArr = Array.from({length: 10}, () => new THREE.Vector4()), lampC = Array.from({length: 10}, () => new THREE.Vector3());
  S.mat.comp = mkMat(COMP_FS, {tColor: U(null), tDepth: U(null), tAO: U(null), uInvProj: U(new THREE.Matrix4()), uProj: U(new THREE.Matrix4()), uRes: U(new THREE.Vector2()), uView: U(new THREE.Matrix4()), uViewInv: U(new THREE.Matrix4()), uCam: U(new THREE.Vector3()), uNear: U(.25), uFar: U(12000), uLamp: U(lampArr), uLampC: U(lampC), uNL: U(0), uShaft: U(1), uSSR: U(1), uSkyH: U(new THREE.Vector3(.02, .045, .11)), uSkyZ: U(new THREE.Vector3(.003, .008, .03)), uFogC: U(new THREE.Vector3()), uFogD: U(0), uAOon: U(1), uMoonDir: U(new THREE.Vector3(-.45, .55, -.7).normalize())});
  S.lampArr = lampArr; S.lampC = lampC; S.lampN = 0;
  S.mat.down = mkMat(DOWN_FS, {tSrc: U(null), uTexel: U(new THREE.Vector2()), uFirst: U(0), uThr: U(.9)});
  S.mat.up = mkMat(UP_FS, {tSrc: U(null), uTexel: U(new THREE.Vector2()), uW: U(1)}, {blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true});
  S.mat.focus = mkMat(FOCUS_FS, {tDepth: U(null), uInvProj: U(new THREE.Matrix4()), uProj: U(new THREE.Matrix4()), uRes: U(new THREE.Vector2())});
  S.mat.final = mkMat(FINAL_FS, {tColor: U(null), tBloom: U(null), tDepth: U(null), uInvProj: U(new THREE.Matrix4()), uProj: U(new THREE.Matrix4()), uRes: U(new THREE.Vector2()), uBloom: U(.5), uExp: U(1), uFocus: U(30), uAp: U(1), uGrain: U(1), uSeed: U(0), uVig: U(.35), uSat: U(1.05), uDark: U(0), uFade: U(1), uDarkExp: U(1), uDofOn: U(1)});
  S.focusRT = new THREE.WebGLRenderTarget(1, 1, {type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, format: THREE.RGBAFormat}); S.focusBuf = new Float32Array(4);
  S.res = new THREE.Vector2(); S.v2 = new THREE.Vector2(); S.v2b = new THREE.Vector2();
  S.rig = {hc: new THREE.Color(), hg: new THREE.Color(), mc: new THREE.Color(), pc: [], pi: [], pd: [], tmp: new THREE.Color(), cc: new THREE.Color()};
  S.lampT = 0;
  resize(true);
}
function resize(force) {
  const {r} = ctx(); const sz = r.getDrawingBufferSize(S.v2b); const w = sz.x, h = sz.y;
  if (!force && S.w === w && S.h === h) return; S.w = w; S.h = h;
  const dispose = o => { if (o) { o.dispose(); if (o.depthTexture) o.depthTexture.dispose(); } };
  for (const k in S.rt) { if (Array.isArray(S.rt[k])) S.rt[k].forEach(dispose); else dispose(S.rt[k]); }
  const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, Object.assign({type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, format: THREE.RGBAFormat}, o));
  const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType; dt.format = THREE.DepthFormat; dt.minFilter = dt.magFilter = THREE.NearestFilter;
  S.rt.scene = mk(w, h, {depthBuffer: true, depthTexture: dt, samples: S.TOUCH ? 2 : 4});
  const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
  S.rt.ao = mk(hw, hh, {type: THREE.UnsignedByteType}); S.rt.ao2 = mk(hw, hh, {type: THREE.UnsignedByteType});
  S.rt.comp = mk(w, h);
  S.rt.bloom = []; let bw = w >> 1, bh = h >> 1; for (let i = 0; i < 6; i++) { S.rt.bloom.push(mk(Math.max(2, bw), Math.max(2, bh))); bw >>= 1; bh >>= 1; }
}
function fsq(mat, target) { const {r} = ctx(); S.quad.material = mat; r.setRenderTarget(target); S.quad.render(r); }

const _lampOut = [];
function lampsFor(cam) {
  const C = window.__CINE; const arr = _lampOut; arr.length = 0;
  const cx = cam.position.x, cz = cam.position.z;
  try {
    const wl = C.world.lamps; const gat = C.gAt;
    const cand = [];
    for (const l of wl) { const dx = l[0] - cx, dz = l[1] - cz; const d2 = dx * dx + dz * dz; if (d2 < 110 * 110) cand.push([d2, l[0], l[1]]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(9, cand.length); i++) { const c = cand[i]; arr.push([c[1], gat(c[1], c[2]) + 4.6, c[2], 1.1, 1.0]); }
    arr.push([C.TX, gat(C.TX, C.TZ) + 10, C.TZ, 2.2, 3.5]);   /* the Christmas tree star */
  } catch (e) { }
  return arr.slice(0, 10);
}

const WARM = 0xffe2b8, WARM2 = 0xffb468;
function rigOn(normal, indoor) {   /* look lighting for the HDR pass; saved here, put back by rigOff so the game never sees our values */
  const {hemi, moon, lightPool} = ctx(); const R = S.rig; R.on = normal;
  if (!normal) return;
  if (hemi) { R.hi = hemi.intensity; R.hc.copy(hemi.color); R.hg.copy(hemi.groundColor); hemi.color.setHex(0x6a8fd0); hemi.groundColor.setHex(0x1c2a44); hemi.intensity = indoor ? R.hi : (REAL() ? .92 : .88); const TD = window.__TOD && window.__TOD.look; if (TD && TD.k > .001) { hemi.color.copy(TD.hc); if (!indoor) hemi.intensity *= TD.hi; } }
  if (moon) { R.mi = moon.intensity; R.mc.copy(moon.color); moon.color.setHex(0xaec6ff); moon.intensity = REAL() ? 1.35 : 1.3; const TD = window.__TOD && window.__TOD.look; if (TD && TD.k > .001) { moon.color.copy(TD.mc); moon.intensity *= TD.mi; } }
  const lp = lightPool || [];
  for (let i = 0; i < lp.length; i++) { const l = lp[i]; R.pi[i] = l.intensity; R.pd[i] = l.distance; R.pc[i] = l.color.getHex(); if (l.intensity > 0) { l.intensity *= 2.7; l.distance *= 1.2; if (R.pc[i] === WARM) l.color.setHex(WARM2); } }
}
function rigOff() {
  const R = S.rig; if (!R.on) return; R.on = false;
  const {hemi, moon, lightPool} = ctx();
  if (hemi) { hemi.intensity = R.hi; hemi.color.copy(R.hc); hemi.groundColor.copy(R.hg); }
  if (moon) { moon.intensity = R.mi; moon.color.copy(R.mc); }
  const lp = lightPool || [];
  for (let i = 0; i < lp.length; i++) { const l = lp[i]; l.intensity = R.pi[i]; l.distance = R.pd[i]; l.color.setHex(R.pc[i]); }
}

L.render = (dt, t) => {
  if (L.n < 2 || !S.q || !SV.on) return false;
  try { return renderHeavy(dt, t); }
  catch (e) {   /* anything unexpected in the heavy path: put everything back and let the plain game draw this frame */
    try { rigOff(); const {r} = ctx(); r.setRenderTarget(null); } catch (_) { }
    if (!L._err) { L._err = 1; console.warn('look: render failed, back to TODAY', e); }
    try { L.set(1, {auto: true, error: true}); } catch (_) { }
    return false;
  }
};
function renderHeavy(dt, t) {
  const c = ctx(); const {r, scene, cam, hemi} = c;
  const M = L.M; const ts0 = performance.now();
  if (S.fr > 0) { const inf = r.info; if (inf.render.calls) { M.calls.push(inf.render.calls); M.tris.push(inf.render.triangles); if (M.calls.length > 200) { M.calls.shift(); M.tris.shift(); } } }
  r.info.autoReset = false; r.info.reset(); M.frames++;
  /* ---- frame-time watch: 5 s of slow frames in a heavy look -> the next lighter look (never raises by itself) ---- */
  {const K = S.mon; const dtr = K.last ? (ts0 - K.last) / 1000 : 0; K.last = ts0;
   if (document.hidden || dtr > 2.5 || window.__INTRO_ON) { K.acc = K.nf = 0; K.settle = Math.max(K.settle, 3); }
   else if (K.settle > 0) K.settle -= dtr;
   else { K.acc += Math.min(dtr, .25); K.nf++; if (K.acc >= 5) { const mean = K.acc / K.nf; K.acc = K.nf = 0; L.meanFrame = mean; if (mean > .042 && !L.noAuto) { L.set(L.n - 1, {auto: true, mean}); return false; } } }}
  if (L.uLT) L.uLT.value = t;
  resize(); applyShadowSize();
  cam.near = .25; if (cam.projectionMatrix.elements[14] === 0) { }
  const w = S.w, h = S.h, o = L.opt;
  const gl = window.__gradeU; const dark = gl && gl.dark ? gl.dark.value : 0, fade = gl && gl.fade ? gl.fade.value : 1;
  const hi = hemi ? hemi.intensity : 1.15;
  const normal = !!hemi && hi > .9 && hi < 1.9 && dark < .05;
  const indoors = !!(window.__CINE && c.indoorLight && c.indoorLight.visible);
  const lvl = window.__PERF ? window.__PERF.level : 'high';
  const lite = !!window.__INTRO_ON || lvl === 'med' || c.TOUCH;
  const film = document.body.classList.contains('film');
  cam.updateMatrixWorld();
  const tr0 = performance.now();
  /* ---- 1. scene to HDR target (MSAA + depth texture) ---- */
  let hall = false; try { const X = window.__BOWLX; hall = !!(X && (X.on || (X.inHall && X.inHall()))); } catch (_) { }
  rigOn(normal, indoors || hall);
  const envBase = scene.environmentIntensity; scene.environmentIntensity = !normal ? 0 : ((indoors || hall) ? envBase * .4 : envBase);   /* no sky light underground, in the dark world or (much less) indoors */
  const prevTM = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
  r.getClearColor(S.rig.cc); const ca = r.getClearAlpha();
  r.setRenderTarget(S.rt.scene); r.setClearColor(scene.background ? scene.background : 0x000000, 1); r.clear(); r.render(scene, cam);
  r.setClearColor(S.rig.cc, ca);
  r.toneMapping = prevTM;
  rigOff(); scene.environmentIntensity = envBase;
  const depth = S.rt.scene.depthTexture;
  const set = (m, k, v) => { if (m.uniforms[k]) m.uniforms[k].value = v; };
  S.res.set(w, h);
  const common = m => { set(m, 'tDepth', depth); set(m, 'uInvProj', cam.projectionMatrixInverse); set(m, 'uProj', cam.projectionMatrix); set(m, 'uRes', S.res); };
  /* ---- 2. SSAO (half res) + blur ---- */
  const useAO = !(window.__INTRO_ON && lvl === 'low');
  if (useAO) {
    const A = S.mat.ao; common(A); set(A, 'uR', 1.5); set(A, 'uInt', 1.9 * o.ao); fsq(A, S.rt.ao);
    const B = S.mat.blur; common(B); set(B, 'tAO', S.rt.ao.texture); S.v2.set(1.5 / (w >> 1), 0); set(B, 'uDir', S.v2); fsq(B, S.rt.ao2);
    set(B, 'tAO', S.rt.ao2.texture); S.v2.set(0, 1.5 / (h >> 1)); set(B, 'uDir', S.v2); fsq(B, S.rt.ao);
  }
  /* ---- 3. composite: ao, ssr (wet ground), analytic light shafts ---- */
  const C = S.mat.comp; common(C);
  set(C, 'tColor', S.rt.scene.texture); set(C, 'tAO', S.rt.ao.texture); set(C, 'uView', cam.matrixWorldInverse); set(C, 'uViewInv', cam.matrixWorld); set(C, 'uCam', cam.position);
  set(C, 'uSSR', (normal && !lite) ? o.ssr : 0); set(C, 'uAOon', useAO ? 1 : 0);
  if (S.fr % 6 === 0 || !S.lampN) {
    const lamps = lampsFor(cam); S.lampArr.forEach(v => v.set(0, 0, 0, 1)); lamps.forEach((l, i) => { S.lampArr[i].set(l[0], l[1], l[2], l[3]); S.lampC[i].set(1.0, .62, .3).multiplyScalar(.1 * l[4]); }); S.lampN = lamps.length;
  }
  set(C, 'uNL', S.lampN); set(C, 'uShaft', (normal && !indoors) ? .55 * o.shafts : 0);
  fsq(C, S.rt.comp);
  /* ---- 4. bloom pyramid (HDR) ---- */
  const Bm = S.rt.bloom; const D = S.mat.down, Up = S.mat.up;
  set(D, 'uThr', 1.0);
  let src = S.rt.comp.texture, sw = w, sh = h;
  for (let i = 0; i < Bm.length; i++) { set(D, 'tSrc', src); S.v2.set(1 / sw, 1 / sh); set(D, 'uTexel', S.v2); set(D, 'uFirst', i === 0 ? 1 : 0); fsq(D, Bm[i]); src = Bm[i].texture; sw = Bm[i].width; sh = Bm[i].height; }
  const wts = [1.0, .9, .8, .7, .6];
  for (let i = Bm.length - 1; i >= 1; i--) { set(Up, 'tSrc', Bm[i].texture); S.v2.set(1 / Bm[i].width, 1 / Bm[i].height); set(Up, 'uTexel', S.v2); set(Up, 'uW', wts[Math.min(i - 1, 4)]); S.quad.material = Up; r.setRenderTarget(Bm[i - 1]); S.quad.render(r); }
  /* ---- 5. focus distance (auto focus on the centre, read back without stalling) ---- */
  const dofOn = !lite && normal && o.dof > 0;
  if (dofOn && S.fr % 8 === 0 && !S.focusBusy) {
    const F = S.mat.focus; common(F); fsq(F, S.focusRT);
    const apply = () => { const fz = S.focusBuf[0]; if (fz > 0 && isFinite(fz)) S.focus += (Math.min(fz, 400) - S.focus) * (S.fr < 16 ? 1 : .5); };
    if (r.readRenderTargetPixelsAsync) { S.focusBusy = true; r.readRenderTargetPixelsAsync(S.focusRT, 0, 0, 1, 1, S.focusBuf).then(() => { S.focusBusy = false; apply(); }).catch(() => { S.focusBusy = false; }); }
    else { r.readRenderTargetPixels(S.focusRT, 0, 0, 1, 1, S.focusBuf); apply(); }
  }
  S.fr++;
  const focus = o.focus > 0 ? o.focus : S.focus;
  /* ---- 6. final: depth of field, bloom, grade (+ the Threshold red grade), tone map, vignette, grain ---- */
  const F = S.mat.final; common(F);
  set(F, 'tColor', S.rt.comp.texture); set(F, 'tBloom', Bm[0].texture); set(F, 'uBloom', (REAL() ? .5 : .62) * o.bloom); set(F, 'uExp', (REAL() ? .9 : .95) * o.exposure);
  set(F, 'uFocus', focus); set(F, 'uAp', (focus < 40 ? 1.0 : .35) * o.dof * o.ap * (film ? 1 : .5)); set(F, 'uDofOn', dofOn ? 1 : 0); set(F, 'uGrain', o.grain); set(F, 'uSeed', (S.fr % 24)); set(F, 'uVig', .42); set(F, 'uSat', REAL() ? 1.02 : 1.1);
  set(F, 'uDark', dark); set(F, 'uFade', fade); set(F, 'uDarkExp', L.darkExp || 1.5);
  if (window.__LENS && window.__LENS.active && window.__LENS.active() && window.__LENS.blit) { if (!S.rt.lens) S.rt.lens = new THREE.WebGLRenderTarget(S.w, S.h); if (S.rt.lens.width !== S.w || S.rt.lens.height !== S.h) S.rt.lens.setSize(S.w, S.h); fsq(F, S.rt.lens); window.__LENS.blit(S.rt.lens.texture); } else fsq(F, null);
  r.setRenderTarget(null);
  const te = performance.now(); M.rjs.push(te - tr0); if (M.rjs.length > 200) M.rjs.shift();
  return true;
}
