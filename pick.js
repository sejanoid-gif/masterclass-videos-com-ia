/* ============================================================================
   MASTERCLASS DE VÍDEOS COM IA · pick.js

   O preço não está escrito em lugar nenhum da página: ele fica atrás de três
   cartas, no bloco "Sua vaga". A pessoa escolhe uma, as três viram, o confete
   estoura e o bloco do pagamento aparece com o valor.

   As três viram: a escolhida abre "Desconto liberado" e as outras duas abrem
   "Desconto não liberado". Isso é decisão do dono da página, tomada depois de
   o risco ser apontado, e vale registrar o que ela significa: o desconto sai
   igual em qualquer carta, então o "não liberado" das outras duas é encenação,
   não o que o código faz. É o ponto em que a página deixa de só encenar e
   passa a afirmar algo que não é verdade, que é onde mora o risco de
   publicidade enganosa (CDC art. 37). Se um dia isso for revertido, a versão
   honesta com a mesma emoção é: as outras duas ficam fechadas, e nada se
   afirma sobre elas.

   Quem tranca o bloco da oferta é este script, não o HTML: sem JavaScript a
   página continua mostrando o preço normalmente, em vez de esconder o valor
   de quem está decidindo comprar.

   O confete é um <canvas> temporário: 140 pedaços com gravidade, arrasto e
   rotação própria, que some sozinho em 2,6s. Nada disso roda para quem pediu
   menos movimento.
   ========================================================================== */
(function () {
  'use strict';

  var pick = document.querySelector('[data-pick]');
  var offer = document.querySelector('.offer');
  if (!pick || !offer) return;

  var cards = [].slice.call(pick.querySelectorAll('[data-pick-card]'));
  var head = pick.querySelector('.pick__h');
  var note = pick.querySelector('[data-pick-note]');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var done = false;

  /* o jogo só existe com script, e é o script que tranca a oferta: sem ele a
     página mostra o preço normalmente, em vez de esconder o valor de quem
     está decidindo comprar */
  var offerFoot = document.querySelector('.offer__foot');
  pick.classList.add('is-live');
  offer.classList.add('is-locked');
  if (offerFoot) offerFoot.classList.add('is-locked');

  /* O verso de cada carta é a mesma malha viva do painel do topo, com um
     deslocamento de matiz por carta para as três nunca ficarem iguais. O
     is-live vem antes daqui de propósito: sem largura medida o canvas nasce
     de 1px.

     Os deslocamentos eram -54 e +98: com a malha na série quente, +98 jogaria
     a terceira carta em verde outra vez. Encolhidos, as três continuam
     distintas — escarlate, terracota, mostarda —, e as três continuam da
     mesma família. */
  var TINTS = [0, -18, 10];
  var meshes = [];
  if (window.Mesh) {
    cards.forEach(function (card, i) {
      var cv = card.querySelector('.pcard__mesh');
      if (!cv) return;
      var m = window.Mesh.start(cv);
      if (m && m.tint) m.tint(TINTS[i % TINTS.length]);
      meshes[i] = m;
    });
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        meshes.forEach(function (m) { if (m && m.resize) m.resize(); });
      }, 180);
    });
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () { choose(card); });
  });

  /* A sequência, em quatro tempos: a carta escolhida cresce e acende, vira
     devagar, o confete sai quando a frente já está à vista, e só então o
     bloco do pagamento aparece. As outras duas recuam fechadas. */
  function choose(card) {
    if (done) return;
    done = true;

    cards.forEach(function (c) {
      c.setAttribute('aria-disabled', 'true');
      c.tabIndex = -1;
    });
    pick.classList.add('is-done');

    var TURN = reduced ? 0 : 1500;      // o tempo da sequência da escolhida
    var label = card.querySelector('[data-pick-label]');
    if (label) label.textContent = 'Desconto liberado';
    card.classList.add('is-open', 'is-chosen');

    /* as outras duas viram logo atrás, uma de cada vez */
    var others = cards.filter(function (c) { return c !== card; });
    others.forEach(function (c, k) {
      var l = c.querySelector('[data-pick-label]');
      if (l) l.textContent = 'Desconto não liberado';
      setTimeout(function () {
        c.classList.add('is-open', 'is-miss');
      }, reduced ? 0 : TURN * 0.72 + k * 190);
    });

    /* a malha de cada verso pode parar assim que ele deixa de aparecer */
    setTimeout(function () {
      meshes.forEach(function (m) { if (m && m.stop) m.stop(); });
    }, reduced ? 0 : TURN + 900);

    /* o confete estoura no ponto em que a frente já está de frente */
    setTimeout(function () { if (!reduced) burst(card); }, TURN * 0.7);

    setTimeout(function () {
      if (head) head.textContent = 'Pronto. O seu desconto está liberado.';
      if (note) note.textContent = 'O bloco do pagamento abriu logo abaixo.';
      reveal();
    }, reduced ? 80 : TURN + 900);
  }

  function reveal() {
    offer.classList.remove('is-locked');
    if (offerFoot) offerFoot.classList.remove('is-locked');
    if (!reduced) {
      offer.classList.add('is-opening');
      setTimeout(function () { offer.classList.remove('is-opening'); }, 1400);
    }
    /* o valor é o que precisa estar na tela: a página desliza até ele ficar
       um pouco acima do meio, e as cartas continuam à vista logo acima */
    var price = offer.querySelector('.offer__price') || offer;
    var box = price.getBoundingClientRect();
    var mid = box.top + box.height / 2;
    if (mid > window.innerHeight * 0.66) {
      window.scrollBy({ top: mid - window.innerHeight * 0.52, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  /* ── o confete ──────────────────────────────────────────────────────────
     Sai do meio da carta escolhida, num leque para cima, e cai. */
  /* Quatro cores da marca e quatro da malha. As quatro da malha eram o
     arco-íris (214, 268, 158, 326) e voltavam em azul e verde justo no
     instante mais visto da página. Trocadas pela série quente, a variedade
     que o confete precisa vem da LUZ, não da matiz: terracota, mostarda,
     escarlate fundo e pêssego claro. */
  var COLORS = ['#C6674B', '#D8825F', '#EBE4D4', '#F2C6B4',
                'hsl(16,74%,70%)', 'hsl(38,72%,64%)', 'hsl(4,58%,52%)', 'hsl(26,68%,80%)'];

  function burst(card) {
    var box = card.getBoundingClientRect();
    var cx = box.left + box.width / 2, cy = box.top + box.height / 2;

    var canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();

    var bits = [];
    for (var i = 0; i < 140; i++) {
      /* leque de 200° virado para cima, com força variável */
      var a = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI * 1.1);
      var v = 7 + Math.random() * 11;
      bits.push({
        x: cx + (Math.random() - 0.5) * box.width * 0.5,
        y: cy + (Math.random() - 0.5) * 14,
        vx: Math.cos(a) * v * (0.7 + Math.random() * 0.6),
        vy: Math.sin(a) * v,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.36,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        round: Math.random() < 0.22
      });
    }

    var t0 = performance.now(), LIFE = 2600, raf = null;
    function frame(t) {
      var age = t - t0;
      if (age >= LIFE) { cancelAnimationFrame(raf); canvas.remove(); return; }
      var fade = age > LIFE * 0.62 ? 1 - (age - LIFE * 0.62) / (LIFE * 0.38) : 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = fade;
      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        b.vy += 0.34;            // gravidade
        b.vx *= 0.992;           // arrasto
        b.vy *= 0.994;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vrot;
        if (b.y > window.innerHeight + 40) continue;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        if (b.round) {
          ctx.beginPath();
          ctx.arc(0, 0, b.w * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          /* a altura oscila: o pedaço gira no eixo e some de perfil */
          ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.rot * 0.9)));
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', size);
  }
})();
