/* ============================================================================
   FOREWORD · mesh.js
   The panel inside the app window.

   The reference paints this surface with a live <canvas>, not an image and not
   CSS — which is why it drifts from blue through violet and green instead of
   sitting on one colour. Measured, not guessed: the element is a CANVAS,
   722x664, with no background-image and no CSS animation on it.

   So this is a canvas too: a handful of very large soft blobs on slow
   independent paths, each cycling hue at its own rate. Drawn with wide radial
   gradients rather than a blur filter, because blur on a 700px canvas every
   frame is expensive and looks the same.
   ========================================================================== */
(function (root) {
  'use strict';

  function hsl(h, s, l, a) {
    return 'hsla(' + ((h % 360) + 360) % 360 + ',' + s + '%,' + l + '%,' + a + ')';
  }

  /* Each blob carries its own drift path and its own hue speed, so the
     composite never repeats on a visible cycle. */
  var BLOBS = [
    { r: 0.92, hue: 214, hs: 5.5,  ax: 0.30, ay: 0.22, fx: 0.07,  fy: 0.05,  ph: 0.0, s: 74, l: 62, a: 0.95 },
    { r: 0.78, hue: 268, hs: 7.0,  ax: 0.26, ay: 0.26, fx: 0.053, fy: 0.081, ph: 1.7, s: 70, l: 66, a: 0.80 },
    { r: 0.70, hue: 158, hs: 6.0,  ax: 0.32, ay: 0.20, fx: 0.091, fy: 0.062, ph: 3.1, s: 58, l: 70, a: 0.70 },
    { r: 0.62, hue: 326, hs: 8.5,  ax: 0.24, ay: 0.28, fx: 0.067, fy: 0.099, ph: 4.4, s: 72, l: 68, a: 0.62 },
    { r: 0.50, hue: 196, hs: 4.5,  ax: 0.20, ay: 0.18, fx: 0.117, fy: 0.073, ph: 5.6, s: 40, l: 92, a: 0.85 }
  ];

  function start(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = null, running = false;
    /* A hue offset the page can steer. Each sample project in the hero
       carries its own tint, and the panel eases toward it rather than
       cutting, the way the reference's surface changes with its preview. */
    var offset = 0, target = 0;

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function frame(t) {
      var w = canvas.width, h = canvas.height;
      var s = t / 1000;
      var d = Math.max(w, h);
      offset += (target - offset) * 0.035;

      // the ground the blobs sit on: near-white, faintly warm at the top
      ctx.fillStyle = '#F2F5FF';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'multiply';
      for (var i = 0; i < BLOBS.length; i++) {
        var b = BLOBS[i];
        var cx = w * (0.5 + b.ax * Math.sin(s * b.fx + b.ph));
        var cy = h * (0.5 + b.ay * Math.cos(s * b.fy * 1.31 + b.ph));
        var rad = d * b.r;
        var hue = b.hue + offset + Math.sin(s * b.hs * 0.02 + b.ph) * 46;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, hsl(hue, b.s, b.l, b.a));
        g.addColorStop(0.45, hsl(hue + 14, b.s, b.l + 8, b.a * 0.45));
        g.addColorStop(1, hsl(hue + 28, b.s, 100, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';

      /* A soft sheen across the top so the panel reads as a lit surface rather
         than a flat field of colour. */
      var sh = ctx.createLinearGradient(0, 0, w * 0.4, h);
      sh.addColorStop(0, 'rgba(255,255,255,0.55)');
      sh.addColorStop(0.42, 'rgba(255,255,255,0.10)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, w, h);

      if (running) raf = requestAnimationFrame(frame);
    }

    size();
    if (reduced) {
      frame(4200);
      return {
        stop: function () {},
        resize: function () { size(); frame(4200); },
        tint: function (deg) { target = offset = deg; frame(4200); }
      };
    }

    running = true;
    raf = requestAnimationFrame(frame);

    /* Stop painting when the panel is off screen. A gradient loop running
       behind six sections of scroll is pure heat for nothing. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
          else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
        });
      }, { rootMargin: '120px' }).observe(canvas);
    }

    return {
      stop: function () { running = false; cancelAnimationFrame(raf); },
      resize: size,
      tint: function (deg) { target = deg; }
    };
  }

  root.Mesh = { start: start };
})(typeof window !== 'undefined' ? window : globalThis);
