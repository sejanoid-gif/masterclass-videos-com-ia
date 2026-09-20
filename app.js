/* ============================================================================
   ESTILO TECH APPLE · app.js

   O comportamento do modelo. Cada número aqui foi medido numa página real,
   não escolhido no olho; o que cada um significa está em STYLE.md, seção
   "Movimento". Mudar um valor muda o estilo, então mude com intenção:

   1. The far and mid hills lag the scroll by a FRACTION of it, 31% and 17%,
      and so does the window, by 20%: it sinks into the hero while the near
      foliage, which travels 1:1 like the copy, stays planted on the hero's
      foot and climbs over the window's lower edge.
   2. Scroll glides: a Lenis-style lerp of 0.1 driving the native scroll.
   3. The hero preview trades places every 4.1s, rising 24px as it arrives, and
      the panel under it shifts hue with it.
   4. The intro holds one statement lit and the rest at a quarter.
   5. The tour advances every 8s while on screen, with a progress line on the
      active tab, and crossfades in 0.6s.
   6. The deck: as each card arrives, the one under it sinks to 90%, rises
      24px and fades, across one card pitch centred on the moment the new card
      sticks.
   7. The closing dunes rise 64px into place as the section settles.

   And one thing that is this page's own: in the last deck card the draft
   types itself under the visitor's scroll, the block menu opens, and a quote
   from the interview drops in.
   ========================================================================== */
(function () {
  'use strict';

  var R = window.Ridge, M = window.Mesh;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var phone = function () { return window.innerWidth <= 809; };

  /* Scroll consumers register here and run once per frame, off one listener. */
  var onFrame = [];
  function tick() {
    var y = window.scrollY, vh = window.innerHeight;
    for (var i = 0; i < onFrame.length; i++) onFrame[i](y, vh);
  }
  var ticking = false;
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; tick(); }); }
  }

  function fitCanvas(canvas) {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.min(Math.round(Math.max(1, r.width) * dpr), 2400);
    var h = Math.max(1, Math.round(Math.max(1, r.height) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return canvas;
  }

  /* ── 1. the hills ─────────────────────────────────────────────────────
     Drawn live until the photographs arrive. tools/ingest.mjs marks each
     plate "supplied" in assets/PLATES.json; a supplied plate replaces its
     canvas and takes the reference's own band positions. */
  var RIDGES = [
    { id: '#ridgeFar', plate: 'hill-far', spec: {
      /* flat on purpose: the backstop that stops bare sky showing */
      seed: 24, scale: 2.6, oct: 5, relief: 0.20, peak: 0.08,
      fillTop: '#333C46', fill: '#242B33',
      haze: 'rgba(150, 128, 128, 0.24)', hazeH: 40,
      rim: 'rgba(214, 170, 162, 0.32)' } },
    { id: '#ridgeMid', plate: 'hill-mid', spec: {
      seed: 91, scale: 3.4, oct: 5, relief: 0.52, peak: 0.12,
      fillTop: '#20272E', fill: '#171D23',
      haze: 'rgba(120, 100, 104, 0.30)', hazeH: 34,
      rim: 'rgba(190, 150, 146, 0.26)' } },
    { id: '#ridgeNear', plate: 'hill-near', spec: {
      seed: 57, scale: 4.6, oct: 6, relief: 0.72, peak: 0.16,
      fillTop: '#0C0F13', fill: '#05070A',
      haze: 'rgba(60, 50, 54, 0.22)', hazeH: 22 } }
  ];
  function paintRidges() {
    if (!R) return;
    RIDGES.forEach(function (r) {
      var c = $(r.id);
      if (c && !c.parentElement.classList.contains('ridge--photo')) R.renderRidge(fitCanvas(c), r.spec);
    });
  }
  function usePhotoRidges() {
    if (!window.fetch) return;
    fetch('assets/PLATES.json', { cache: 'no-store' }).then(function (res) {
      return res.ok ? res.json() : {};
    }).then(function (ledger) {
      RIDGES.forEach(function (r) {
        var e = ledger[r.plate];
        if (!e || (e.status || e) !== 'supplied') return;
        var c = $(r.id);
        if (!c) return;
        var img = new Image();
        img.className = 'ridge__img';
        img.alt = '';
        img.decoding = 'async';
        img.onload = function () {
          c.parentElement.classList.add('ridge--photo');
          c.replaceWith(img);
        };
        img.src = 'assets/' + r.plate + '.webp?v=' + (e.sha || '');
      });
    }).catch(function () { /* the drawn hills stay */ });
  }

  var hero = $('.hero');
  var LAG = [
    { el: $('.ridge--far'),  k: 0.31 },
    { el: $('.ridge--mid'),  k: 0.17 },
    { el: $('.app--hero'),   k: 0.20 }
  ].filter(function (l) { return l.el; });
  var lagY = -1;
  function heroLag(y) {
    if (y === lagY) return;
    lagY = y;
    if (hero && y > hero.offsetHeight + 200) return;
    for (var i = 0; i < LAG.length; i++) {
      LAG[i].el.style.transform = 'translate3d(0,' + (y * LAG[i].k).toFixed(1) + 'px,0)';
    }
  }

  /* ── 2. the glide ─────────────────────────────────────────────────────
     Lenis 1.3.19 on the reference, lerp 0.1, smoothWheel, no snap. Hold a
     target, walk toward it 10% per frame, drive the NATIVE scroll with it, so
     the engine, anchors, the scrollbar and find-in-page all keep working. */
  var glideTo = null;
  function glide(lerp) {
    var target = window.scrollY, current = target, running = false;
    var maxY = function () { return document.documentElement.scrollHeight - window.innerHeight; };

    function step() {
      current += (target - current) * lerp;
      if (Math.abs(target - current) < 0.4) { current = target; running = false; }
      window.scrollTo({ top: current, behavior: 'instant' });
      if (running) requestAnimationFrame(step);
    }
    function run() { if (!running) { running = true; current = window.scrollY; requestAnimationFrame(step); } }

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented) return;
      // a wheel over something that scrolls on its own is left alone
      var el = e.target;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return;
        el = el.parentElement;
      }
      e.preventDefault();
      var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!running) target = window.scrollY;
      target = clamp(target + d, 0, maxY());
      run();
    }, { passive: false });

    /* Keyboard, touch and the scrollbar scroll natively; adopt their position. */
    window.addEventListener('scroll', function () {
      if (!running) { target = window.scrollY; current = target; }
    }, { passive: true });

    glideTo = function (y) { target = clamp(y, 0, maxY()); run(); };
  }

  /* In-page links glide too, the way the reference's do. Focus follows. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var dest = id === 'top' ? document.body : document.getElementById(id);
    if (!dest) return;
    closeMenu();
    if (!glideTo) return;
    e.preventDefault();
    var y = id === 'top' ? 0 : dest.getBoundingClientRect().top + window.scrollY - 84;
    glideTo(y);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    var focusTarget = id === 'top' ? $('.nav__mark') : dest;
    if (focusTarget !== document.body) {
      if (!focusTarget.hasAttribute('tabindex') && !/^(A|BUTTON)$/.test(focusTarget.tagName)) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
  });

  /* ── the menu (tablet and phone) ───────────────────────────────────── */
  var burger = $('.nav__burger'), panel = $('#navPanel');
  function closeMenu() {
    if (!burger || burger.getAttribute('aria-expanded') !== 'true') return;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    panel.hidden = true;
  }
  if (burger && panel) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      panel.hidden = !open;
      if (open) { var first = $('a', panel); if (first) first.focus(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { closeMenu(); burger.focus(); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('#nav')) closeMenu();
    });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1280) closeMenu(); });
  }

  /* ── 3. the hero preview rotor ─────────────────────────────────────── */
  var mesh = M && $('#mesh') ? M.start($('#mesh')) : null;
  (function rotor() {
    var box = $('[data-rotor]');
    if (!box) return;
    var items = $$('.preview', box);
    var at = 0, timer = null, visible = true;
    function show(n) {
      var prev = items[at];
      at = (n + items.length) % items.length;
      var next = items[at];
      if (prev !== next) {
        prev.classList.remove('is-on');
        prev.classList.add('is-off');
        setTimeout(function () { prev.classList.remove('is-off'); }, 400);
      }
      next.classList.add('is-on');
      if (mesh && mesh.tint) mesh.tint(parseFloat(next.getAttribute('data-tint')) || 0);
    }
    function start() { if (!timer && !REDUCED && visible && !document.hidden) timer = setInterval(function () { show(at + 1); }, 4100); }
    function stop() { clearInterval(timer); timer = null; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(box);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    start();
  })();

  /* ── 4. the intro: one statement lit ───────────────────────────────────
     Measured: a statement lights as its centre passes a line at about 52% of
     the viewport and hands over to the next the same way. Nothing is lit
     before the first reaches the line or after the last has cleared it. */
  var introPs = $$('.intro__p');
  function introLight(y, vh) {
    if (!introPs.length) return;
    var focus = vh * 0.52, best = -1, bestD = Infinity;
    var first = introPs[0].getBoundingClientRect();
    var last = introPs[introPs.length - 1].getBoundingClientRect();
    if (first.top < focus && last.bottom > focus - vh * 0.1) {
      for (var i = 0; i < introPs.length; i++) {
        var r = introPs[i].getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - focus);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    for (var j = 0; j < introPs.length; j++) introPs[j].classList.toggle('is-lit', j === best);
  }

  /* ── fitting fixed-size mocks into fluid frames ────────────────────────
     A mock is authored at one width and scaled to cover its frame, the way a
     screenshot with object-fit: cover would be. */
  var fits = $$('.fit');
  function fitAll() {
    fits.forEach(function (f) {
      var box = f.parentElement;
      var dw = parseFloat(f.getAttribute('data-fit')) || 1080;
      var dh = f.offsetHeight || dw;
      var W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) return;
      var k = Math.max(W / dw, H / dh);
      var top = f.classList.contains('fit--top');
      var x = (W - dw * k) / 2, yy = top ? Math.min(0, (H - dh * k) / 2) : (H - dh * k) / 2;
      f.style.transform = 'translate(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    });
  }
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function () { fitAll(); });
    fits.forEach(function (f) { ro.observe(f.parentElement); });
  }

  /* ── 5. the tour ────────────────────────────────────────────────────── */
  (function tour() {
    var tabs = $$('.tour__tablist .tab');
    var slides = $$('.tour__media .slide');
    var caps = $$('.tour__caption [data-cap]');
    var name = $('[data-tour-name]');
    var media = $('[data-tour]');
    if (!tabs.length || !slides.length) return;
    var at = 0, DUR = 8000, t0 = 0, elapsed = 0, raf = null;
    var inView = false, held = false;

    function go(n, fromUser) {
      at = (n + slides.length) % slides.length;
      tabs.forEach(function (t, i) {
        var on = i === at;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.style.setProperty('--prog', '0');
      });
      slides.forEach(function (s, i) {
        var on = i === at;
        s.classList.toggle('is-on', on);
        s.hidden = !on;
        if (on) { var img = $('img', s); if (img) img.loading = 'eager'; }
      });
      caps.forEach(function (c, i) { c.classList.toggle('is-on', i === at); });
      if (name) name.textContent = tabs[at].textContent.trim();
      elapsed = 0; t0 = performance.now();
      if (fromUser) fitAll();
    }

    function loop(now) {
      raf = null;
      if (!running()) return;
      elapsed += now - t0; t0 = now;
      var p = clamp(elapsed / DUR, 0, 1);
      tabs[at].style.setProperty('--prog', p.toFixed(4));
      if (p >= 1) go(at + 1);
      raf = requestAnimationFrame(loop);
    }
    function running() { return inView && !held && !REDUCED && !document.hidden; }
    function resume() { if (running() && !raf) { t0 = performance.now(); raf = requestAnimationFrame(loop); } }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { go(i, true); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowRight') n = at + 1; else if (k === 'ArrowLeft') n = at - 1;
        else if (k === 'Home') n = 0; else if (k === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        go(n, true);
        tabs[at].focus();
      });
    });
    var prev = $('[data-tour-prev]'), next = $('[data-tour-next]');
    if (prev) prev.addEventListener('click', function () { go(at - 1, true); });
    if (next) next.addEventListener('click', function () { go(at + 1, true); });

    var section = $('#features');
    section.addEventListener('pointerenter', function () { if (FINE) { held = true; } });
    section.addEventListener('pointerleave', function () { held = false; resume(); });
    section.addEventListener('focusin', function () { held = true; });
    section.addEventListener('focusout', function (e) { if (!section.contains(e.relatedTarget)) { held = false; resume(); } });
    document.addEventListener('visibilitychange', resume);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; resume(); }, { threshold: 0.35 }).observe(media);
    }
    go(0);
  })();

  /* ── 6. the deck, and the draft that writes itself ──────────────────── */
  var deck = $('[data-deck]');
  var cards = $$('[data-card]');
  var draft = $('[data-draft]');
  var typeEl = draft && $('[data-type]', draft);
  var FULL = typeEl ? typeEl.textContent : '';
  var menu = draft && $('[data-menu]', draft);
  var menuItems = menu ? $$('.menu__i', menu) : [];
  var pickIdx = menu ? menuItems.indexOf($('[data-menu-pick]', menu)) : -1;
  var quote = draft && $('[data-quote]', draft);
  var slash = draft && $('.ed__slash', draft);
  var lastDraft = -1;

  function renderDraft(q) {
    if (!typeEl) return;
    var qq = Math.round(q * 200) / 200;
    if (qq === lastDraft) return;
    lastDraft = qq;
    var typed = clamp(q / 0.55, 0, 1);
    var n = Math.round(FULL.length * typed);
    // never break a word mid-way at rest; the caret sits after whole words
    typeEl.textContent = FULL.slice(0, n);
    var menuOpen = q >= 0.6 && q < 0.86;
    slash.classList.toggle('is-typed', q >= 0.58 && q < 0.86);
    menu.classList.toggle('is-open', menuOpen);
    var hot = -1;
    if (menuOpen) hot = Math.min(pickIdx, Math.floor(clamp((q - 0.64) / 0.16, 0, 1) * (pickIdx + 1)));
    menuItems.forEach(function (m, i) { m.classList.toggle('is-hot', i === hot); });
    quote.classList.toggle('is-in', q >= 0.86);
  }

  function deckFrame(y, vh) {
    if (!deck) return;
    var state = [];
    var stacked = !phone() && !REDUCED;
    if (stacked && cards.length > 1) {
      var h = cards[0].offsetHeight;
      var gap = parseFloat(getComputedStyle(cards[0]).marginBottom) || 48;
      var pitch = h + gap;
      var stickTop = parseFloat(getComputedStyle(cards[0]).top) || 120;
      var base = cards[0].parentElement.getBoundingClientRect().top + y;
      for (var i = 0; i < cards.length - 1; i++) {
        var nextStick = base + (i + 1) * pitch - stickTop;
        var p = clamp((y - (nextStick - pitch / 2)) / pitch, 0, 1);
        var inner = cards[i].firstElementChild;
        inner.style.transform = p ? 'translate3d(0,' + (-24 * p).toFixed(2) + 'px,0) scale(' + (1 - 0.1 * p).toFixed(4) + ')' : '';
        inner.style.opacity = p ? (1 - p).toFixed(3) : '';
        state.push(p.toFixed(2));
      }
    } else {
      cards.forEach(function (c) { c.firstElementChild.style.transform = ''; c.firstElementChild.style.opacity = ''; });
    }

    // the signature: card 3's approach drives the draft
    if (draft) {
      var q = 1;
      if (!REDUCED) {
        var top = draft.getBoundingClientRect().top;
        var end = stacked ? parseFloat(getComputedStyle(draft).top) || 120 : vh * 0.12;
        var start = vh * 0.92;
        q = clamp((start - top) / (start - end), 0, 1);
      }
      renderDraft(q);
      state.push('d' + q.toFixed(2));
    }
    /* The harness reads this as the deck's rendered state. It exists only while
       the deck is on screen: outside it the page is ordinary flow, which the
       harness exempts, and a global attribute would take that exemption away.
       Card tops are part of the state because a card sliding up to its pin is
       motion the sink values alone do not show. */
    var dr = deck.getBoundingClientRect();
    if (dr.bottom > 0 && dr.top < vh) {
      var tops = cards.map(function (c) { return Math.round(c.getBoundingClientRect().top / 10) * 10; });
      deck.setAttribute('data-sc-verify-state', tops.join(',') + ' ' + state.join(' '));
    } else if (deck.hasAttribute('data-sc-verify-state')) {
      deck.removeAttribute('data-sc-verify-state');
    }
  }

  /* Ad performance: the period buttons recompute the table from data. */
  (function receipts() {
    var body = $('[data-rc-body]');
    if (!body) return;
    var sub = $('[data-rc-sub]');
    var DATA = {
      '7':   { label: 'Últimos 7 dias', readers: 12, reach: [1, 0.92, 0.83, 0.67, 0.58] },
      '30':  { label: 'Últimos 30 dias', readers: 38, reach: [1, 0.86, 0.82, 0.63, 0.55] },
      'all': { label: 'Tudo', readers: 117, reach: [1, 0.81, 0.74, 0.57, 0.49] }
    };
    var rows = $$('tr', body);
    var btns = $$('[data-rc]');
    function set(key) {
      var d = DATA[key];
      btns.forEach(function (b) {
        var on = b.getAttribute('data-rc') === key;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      rows.forEach(function (r, i) {
        var v = d.reach[i];
        r.querySelector('.rc__bar i').style.setProperty('--v', v);
        r.lastElementChild.textContent = String(Math.round(d.readers * v));
      });
      // the hook people drop at hardest is the one worth a look
      var worst = 1, drop = 0;
      for (var i = 1; i < d.reach.length; i++) {
        var dd = d.reach[i - 1] - d.reach[i];
        if (dd > drop) { drop = dd; worst = i; }
      }
      rows.forEach(function (r, i) { r.classList.toggle('is-hot', i === worst); });
      if (sub) sub.textContent = d.label + ' · dados de exemplo';
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-rc')); }); });
    set('30');
  })();

  /* ── questions: topic tabs and one open answer at a time ────────────── */
  (function faq() {
    var tabs = $$('.faq__tabs .tab');
    var panels = $$('.faq__main .qas');
    function show(n, focus) {
      tabs.forEach(function (t, i) {
        var on = i === n;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p, i) {
        var on = i === n;
        if (on && p.hidden) { p.hidden = false; p.classList.remove('is-in'); void p.offsetWidth; p.classList.add('is-in'); }
        else if (!on) p.hidden = true;
      });
      if (focus) tabs[n].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var cur = tabs.indexOf(document.activeElement), n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (cur + 1) % tabs.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (cur - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        show(n, true);
      });
    });
    $$('.qa').forEach(function (qa) {
      var btn = $('button', qa);
      var ans = $('.qa__a', qa);
      var id = 'qa-' + Math.random().toString(36).slice(2, 8);
      ans.id = id;
      btn.setAttribute('aria-controls', id);
      btn.addEventListener('click', function () {
        var open = !qa.classList.contains('is-open');
        $$('.qa', qa.parentElement).forEach(function (o) {
          o.classList.remove('is-open');
          $('button', o).setAttribute('aria-expanded', 'false');
        });
        qa.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  })();

  /* ── 7. the dunes ─────────────────────────────────────────────────────
     Measured: 64px of rise between the section's top sitting 190px below the
     top of the viewport and 90px above it, eased at both ends. */
  var dunes = $('[data-dunes]');
  var closeSec = $('#start');
  function dunesFrame(y) {
    if (!dunes || !closeSec) return;
    if (REDUCED) { dunes.style.transform = 'translate3d(0,-64px,0)'; return; }
    var top = closeSec.getBoundingClientRect().top + y;
    var maxY = document.documentElement.scrollHeight - window.innerHeight;
    var from = top - 190, to = Math.min(top + 90, maxY - 1);
    var p = clamp((y - from) / Math.max(1, to - from), 0, 1);
    var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    dunes.style.transform = 'translate3d(0,' + (-64 * e).toFixed(2) + 'px,0)';
  }

  /* ── the pointer rim: the light follows the cursor over a surface ────── */
  if (FINE && !REDUCED) {
    var hoverEl = null, px = 0, py = 0, pending = false;
    document.addEventListener('pointermove', function (e) {
      hoverEl = e.target.closest && e.target.closest('.rim, .card__in');
      if (!hoverEl) return;
      px = e.clientX; py = e.clientY;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        if (!hoverEl) return;
        var r = hoverEl.getBoundingClientRect();
        hoverEl.style.setProperty('--mx', (px - r.left).toFixed(0) + 'px');
        hoverEl.style.setProperty('--my', (py - r.top).toFixed(0) + 'px');
      });
    }, { passive: true });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  paintRidges();
  usePhotoRidges();
  if (!REDUCED) {
    onFrame.push(heroLag);
    glide(0.1);
  }
  /* Below 1280 the bar fills once the hero copy reaches it: the line is the
     hero's own top padding, so it moves with the layout. */
  var navEl = $('.nav'), navLine = 0, navOn = null;
  function navFill(y) {
    if (!navLine && hero) navLine = parseFloat(getComputedStyle(hero).paddingTop) - 1;
    var on = y >= navLine;
    if (on !== navOn && navEl) { navOn = on; navEl.classList.toggle('is-filled', on); }
  }
  onFrame.push(introLight, deckFrame, dunesFrame, navFill);
  window.addEventListener('scroll', onScroll, { passive: true });

  window.ScrollCraft.mount(document.body);
  fitAll();
  tick();

  function relayout() { fitAll(); tick(); window.dispatchEvent(new Event('resize')); }
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitAll(); tick(); });

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      paintRidges();
      if (mesh && mesh.resize) mesh.resize();
      lagY = -1; lastDraft = -1; navLine = 0;
      fitAll(); tick();
    }, 180);
  });
})();
