/* ============================================================================
   FOREWORD · ridge.js
   Three mountain ridges, drawn rather than photographed.

   The reference layers three wide, short ridge images behind its hero. We take
   the composition — three planes, atmospheric perspective, the near one almost
   black — and draw our own, because their images are theirs.

   Atmospheric perspective is the whole trick: a far ridge is not just smaller,
   it is LIGHTER and LOWER IN CONTRAST, because there is more air between it
   and you. Drawing three silhouettes in the same dark grey reads as cardboard.
   ========================================================================== */
(function (root) {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 1-D value noise, summed over octaves. A ridge line is a 1-D problem: one
     height per column of pixels. */
  function makeLine(seed) {
    const r = rng(seed);
    const p = new Float32Array(1024);
    for (let i = 0; i < p.length; i++) p[i] = r();
    const smooth = (t) => t * t * (3 - 2 * t);
    const at = (i) => p[i & 1023];
    function noise(x) {
      const xi = Math.floor(x), xf = x - xi;
      return at(xi) * (1 - smooth(xf)) + at(xi + 1) * smooth(xf);
    }
    return function fbm(x, oct, ridged) {
      let amp = 1, f = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        let n = noise(x * f);
        if (ridged) n = 1 - Math.abs(n - 0.5) * 2;   // sharp peaks, soft valleys
        sum += amp * n; norm += amp;
        amp *= 0.5; f *= 2.07;
      }
      return sum / norm;
    };
  }

  /*  spec: { seed, scale, oct, ridged, peak, base, fill, haze, hazeH }
      peak / base are fractions of canvas height: where the highest peak sits
      and where the silhouette's floor is.                                    */
  function renderRidge(canvas, spec) {
    spec = spec || {};
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const fbm = makeLine(spec.seed || 1);
    const scale = spec.scale || 3.2;
    const oct = spec.oct || 5;
    const peak = spec.peak == null ? 0.14 : spec.peak;
    const base = spec.base == null ? 1 : spec.base;

    // the silhouette, sampled per pixel column
    const ys = new Float32Array(w + 1);
    for (let x = 0; x <= w; x++) {
      const n = fbm((x / w) * scale, oct, spec.ridged !== false);
      ys[x] = (peak + (1 - n) * (base - peak) * (spec.relief == null ? 0.62 : spec.relief)) * h;
    }

    // haze sitting ON the ridge line, which is what sells distance
    if (spec.haze) {
      const hz = ctx.createLinearGradient(0, peak * h - (spec.hazeH || 90), 0, base * h);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(1, spec.haze);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x++) ctx.lineTo(x, ys[x] - (spec.hazeH || 90));
      ctx.lineTo(w, h); ctx.closePath();
      ctx.clip();
      ctx.fillStyle = hz;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // the body
    const g = ctx.createLinearGradient(0, peak * h, 0, h);
    g.addColorStop(0, spec.fillTop || '#2A3138');
    g.addColorStop(1, spec.fill || '#12161A');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x++) ctx.lineTo(x, ys[x]);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // a hairline of light catching the top edge, only on the far ridges
    if (spec.rim) {
      ctx.strokeStyle = spec.rim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) x === 0 ? ctx.moveTo(x, ys[x]) : ctx.lineTo(x, ys[x]);
      ctx.stroke();
    }
    return canvas;
  }

  root.Ridge = { renderRidge, rng };
})(typeof window !== 'undefined' ? window : globalThis);
