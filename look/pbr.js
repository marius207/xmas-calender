/* Downtown Adventure - procedural PBR atlas for the REALISTIC look: albedo / normal / occlusion-roughness-metal maps built from the 16 px tile atlas.
   Pure data (no three.js) so it can run in a Web Worker (pbr-worker.js) or on the main thread. */
/* =================== procedural PBR atlas (look 4) =================== */
const TILE = {snow: 0, road: 1, path: 2, ice: 3, park: 4, nesgata: 5, bridge: 6, stone: 7, wWhite: 8, wRed: 9, wYellow: 10, wBlue: 11, wGreen: 12, wPlaster: 13, wBrick: 14, wChurch: 15, roof: 16, snowTop: 17, log: 18, leaves: 19, plank: 20, grass: 21, wGarage: 22, dirt: 23, roofRed: 24, dome: 25, snowSide: 26, water: 27, forest: 28, iceBlk: 30, glassLit: 31, glassDark: 32, shopLit: 33, doorBot: 34, doorTop: 35, wGrey: 36, wBeige: 37, wDark: 38, wBrown: 39, roofGrey: 40, glass: 41, wool: 42, hedge: 43, stoneCairn: 44, castle: 45, castleTop: 47, turf: 48, clay: 52, grassSnow: 53, floorPlank: 64, floorTile: 65, fridge: 67, counter: 68, oven: 71, pew: 74, mirror: 77, pave: 80, kerb: 81, FARWATER: 62};
const KIND = {}; // tile -> category
for (const t of [8, 9, 10, 11, 12, 15, 20, 22, 36, 37, 38, 39, 64, 74, 6, 68, 34, 35]) KIND[t] = 'wood';
KIND[14] = 'brick'; KIND[13] = 'plaster';
for (const t of [16, 24, 40]) KIND[t] = 'roof';
for (const t of [0, 17, 26, 53, 42]) KIND[t] = 'snow';
for (const t of [3, 30]) KIND[t] = 'ice';
for (const t of [7, 44, 45, 47]) KIND[t] = 'stone';
KIND[1] = 'asphalt'; KIND[5] = 'cobble'; KIND[4] = 'slab'; KIND[80] = 'slab'; KIND[81] = 'slab'; KIND[2] = 'path'; KIND[65] = 'slab';
for (const t of [19, 28, 43, 21, 48]) KIND[t] = 'foliage';
for (const t of [25, 67, 71]) KIND[t] = 'metal';
for (const t of [41, 31, 32, 77]) KIND[t] = 'glass';
for (const t of [27, 62]) KIND[t] = 'water';
KIND[18] = 'log'; KIND[23] = 'dirt'; KIND[52] = 'dirt';

export function buildPBR(srcData, sw, sh) {
  const T = 64, COLS = 8, ROWS = 32, W = COLS * T, H = ROWS * T;
  const src = srcData;
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, y, per, seed) => { // tileable value noise with period 'per' (in cells)
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (i, j) => hash(((i % per) + per) % per + seed * 131, ((j % per) + per) % per + seed * 17);
    return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy;
  };
  const fbm = (u, v, base, seed, ax = 1, ay = 1) => { let a = 0, amp = .55, s = 0; for (let o = 0; o < 4; o++) { const per = base * (1 << o); a += amp * vnoise(u * per * ax, v * per * ay, per, seed + o); s += amp; amp *= .5; } return a / s; };
  const albO = new Uint8ClampedArray(W * H * 4), nrmO = new Uint8ClampedArray(W * H * 4), ormO = new Uint8ClampedArray(W * H * 4);
  const hgt = new Float32Array(T * T);
  const sampleSrc = (t, fx, fy) => { // sharp-bilinear sample of the 16px tile, fx,fy in 0..16
    const x = Math.min(15.999, Math.max(0, fx)), y = Math.min(15.999, Math.max(0, fy));
    let ix = Math.floor(x - .5), iy = Math.floor(y - .5), tx = x - .5 - ix, ty = y - .5 - iy;
    const sm = v => Math.min(1, Math.max(0, (v - .3) / .4)); tx = sm(tx); ty = sm(ty);
    const tc = t % 8, tr = Math.floor(t / 8); const out = [0, 0, 0];
    const px = (a, b) => { a = Math.min(15, Math.max(0, a)); b = Math.min(15, Math.max(0, b)); const o = ((tr * 16 + b) * sw + tc * 16 + a) * 4; return [src[o], src[o + 1], src[o + 2]]; };
    const c00 = px(ix, iy), c10 = px(ix + 1, iy), c01 = px(ix, iy + 1), c11 = px(ix + 1, iy + 1);
    for (let k = 0; k < 3; k++) out[k] = (c00[k] * (1 - tx) + c10[k] * tx) * (1 - ty) + (c01[k] * (1 - tx) + c11[k] * tx) * ty;
    return out;
  };
  const NT = 88; /* tiles beyond 88 are not used by the game: skip them (flat, not computed) */
  for (let t = 0; t < COLS * ROWS; t++) {
    if (t >= NT) { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const o = (((Math.floor(t / COLS)) * T + y) * W + (t % COLS) * T + x) * 4; nrmO[o] = 128; nrmO[o + 1] = 128; nrmO[o + 2] = 255; nrmO[o + 3] = 255; ormO[o] = 255; ormO[o + 1] = 217; ormO[o + 2] = 0; ormO[o + 3] = 255; const c = sampleSrc(t, (x + .5) / T * 16, (y + .5) / T * 16); albO[o] = c[0]; albO[o + 1] = c[1]; albO[o + 2] = c[2]; albO[o + 3] = 255; } continue; }
    const tc = t % COLS, tr = Math.floor(t / COLS), kind = KIND[t] || 'plain';
    const lum = new Float32Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = sampleSrc(t, (x + .5) / T * 16, (y + .5) / T * 16);
      lum[y * T + x] = (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255;
    }
    // height field
    let strength = 1.4, rough = .85, metal = 0, detail = .08, cav = 1, inv = 1;
    if (kind === 'brick') { inv = -1; strength = 3.2; rough = .88; detail = .22; }
    else if (kind === 'wood') { strength = 2.2; rough = .72; detail = .1; }
    else if (kind === 'roof') { strength = 3.0; rough = .65; detail = .1; }
    else if (kind === 'snow') { strength = 1.1; rough = .5; detail = .18; }
    else if (kind === 'ice') { strength = .5; rough = .08; detail = .03; }
    else if (kind === 'stone') { strength = 3.0; rough = .85; detail = .24; }
    else if (kind === 'asphalt') { strength = 1.8; rough = .86; detail = .22; }
    else if (kind === 'cobble') { strength = 4.2; rough = .72; detail = .18; }
    else if (kind === 'slab') { strength = 2.2; rough = .7; detail = .1; }
    else if (kind === 'path') { strength = 2.2; rough = .9; detail = .2; }
    else if (kind === 'foliage') { strength = 2.4; rough = .95; detail = .35; }
    else if (kind === 'metal') { strength = 1.0; rough = .32; metal = .85; detail = .05; }
    else if (kind === 'glass') { strength = .15; rough = .04; detail = .0; }
    else if (kind === 'water') { strength = .4; rough = .03; detail = .02; }
    else if (kind === 'plaster') { strength = .8; rough = .92; detail = .12; }
    else if (kind === 'log') { strength = 2.2; rough = .8; detail = .12; }
    else if (kind === 'dirt') { strength = 1.6; rough = .95; detail = .25; }
    else { strength = 1.0; rough = .8; detail = .05; }
    // blur lum a little (rounded cobbles / pillowy snow)
    const blur = (a, r) => { const o = new Float32Array(T * T); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let s = 0, n = 0; for (let j = -r; j <= r; j++)for (let i = -r; i <= r; i++) { s += a[((y + j + T) % T) * T + ((x + i + T) % T)]; n++; } o[y * T + x] = s / n; } return o; };
    const bl = kind === 'cobble' ? blur(lum, 2) : kind === 'snow' ? blur(lum, 3) : (kind === 'brick' || kind === 'stone') ? blur(lum, 1) : lum;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const u = x / T, v = y / T;
      let h = bl[y * T + x] * inv;
      if (kind === 'wood') h += (fbm(u, v, 2, t, 8, 1) - .5) * 1.4; // grain along the board
      else if (kind === 'snow') h = h * .3 + (fbm(u, v, 3, t) - .5) * 1.8;
      else if (kind === 'asphalt' || kind === 'dirt' || kind === 'path') h = h * .5 + (fbm(u, v, 12, t) - .5) * 1.6;
      else if (kind === 'cobble') h += (fbm(u, v, 8, t) - .5) * .5;
      else if (kind === 'foliage') h = h * .5 + (fbm(u, v, 6, t) - .5) * 2;
      else if (kind === 'brick' || kind === 'stone') h += (fbm(u, v, 10, t) - .5) * .6;
      else if (kind === 'roof') h += (fbm(u, v, 6, t) - .5) * .3;
      else if (kind === 'plaster') h = (fbm(u, v, 9, t) - .5) * 1.2;
      else if (kind === 'slab') h += (fbm(u, v, 10, t) - .5) * .5;
      hgt[y * T + x] = h;
    }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const at = (i, j) => hgt[((j + T) % T) * T + ((i + T) % T)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * 3.5, dy = (at(x, y + 1) - at(x, y - 1)) * strength * 3.5;
      let nx = -dx, ny = -dy, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
      const o = ((tr * T + y) * W + tc * T + x) * 4;
      nrmO[o] = (nx * .5 + .5) * 255; nrmO[o + 1] = (ny * .5 + .5) * 255; nrmO[o + 2] = (nz * .5 + .5) * 255; nrmO[o + 3] = 255;
      // cavity: low height relative to neighbourhood darkens
      let m = 0; for (let j = -2; j <= 2; j++)for (let i = -2; i <= 2; i++)m += at(x + i, y + j); m /= 25;
      const cavity = Math.min(1, Math.max(0, .85 + (at(x, y) - m) * 2.2 * (kind === 'glass' || kind === 'water' ? 0 : 1)));
      const rn = rough + (fbm(u(x), v(y), 7, t + 5) - .5) * detail * 1.5;
      ormO[o] = cavity * 255; ormO[o + 1] = Math.min(255, Math.max(8, rn * 255)); ormO[o + 2] = metal * 255; ormO[o + 3] = 255;
      const c = sampleSrc(t, (x + .5) / T * 16, (y + .5) / T * 16);
      const gn = 1 + (fbm(u(x), v(y), 14, t + 9) - .5) * detail * 2.2;
      albO[o] = Math.min(255, c[0] * gn); albO[o + 1] = Math.min(255, c[1] * gn); albO[o + 2] = Math.min(255, c[2] * gn); albO[o + 3] = 255;
    }
    function u(x) { return x / T; } function v(y) { return y / T; }
  }
  return {alb: albO, nrm: nrmO, orm: ormO, W, H};
}
