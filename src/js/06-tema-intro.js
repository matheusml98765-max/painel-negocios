  // ===================== TEMA, INTRO E INICIO =====================

  var NOME_DONO = 'Matheus';
  var NOME_LOJA = 'Top Brasil Shop';
  var graficosAtivos = [];

  function temaAtual() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function aplicarTema(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('pml_tema', t); } catch (e) {}
  }
  (function () {
    var salvo = null;
    try { salvo = localStorage.getItem('pml_tema'); } catch (e) {}
    aplicarTema(salvo === 'light' ? 'light' : 'dark');
  })();

  function saudacao(d) {
    var h = (d || new Date()).getHours();
    if (h >= 5 && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function cssVar(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }

  function hojeStr(offsetDias) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDias || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function plataformaDe(t) {
    var o = t.origemId || '';
    if (o.indexOf('api-ml-') === 0 || o.indexOf('ml-') === 0) return 'ml';
    if (o.indexOf('shopee') !== -1) return 'shopee';
    if (o.indexOf('tiktok') !== -1) return 'tiktok';
    return 'outro';
  }
  var NOMES_PLAT = { ml: 'Mercado Livre', shopee: 'Shopee', tiktok: 'TikTok Shop', outro: 'Outros' };

  // ---------- Intro ----------
  function mostrarIntro() {
    var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var intro = document.createElement('div');
    intro.id = 'intro';
    intro.setAttribute('role', 'dialog');
    intro.setAttribute('aria-label', 'Boas-vindas');
    var canvas = document.createElement('canvas');
    intro.appendChild(canvas);
    var texto = document.createElement('div');
    texto.className = 'intro-texto';
    texto.innerHTML = '<div class="intro-ola"></div><div class="intro-sub"></div>';
    texto.querySelector('.intro-ola').textContent = saudacao() + ', ' + NOME_DONO;
    texto.querySelector('.intro-sub').textContent = 'Seu painel da ' + NOME_LOJA + ' está pronto.';
    intro.appendChild(texto);
    var pular = document.createElement('button');
    pular.className = 'intro-pular';
    pular.textContent = 'Pular';
    intro.appendChild(pular);
    document.body.appendChild(intro);

    var encerrado = false;
    var raf = null;
    function encerrar() {
      if (encerrado) return;
      encerrado = true;
      intro.classList.add('saindo');
      setTimeout(function () { if (raf) cancelAnimationFrame(raf); intro.remove(); }, 950);
      document.removeEventListener('keydown', encerrar);
    }
    intro.addEventListener('click', encerrar);
    document.addEventListener('keydown', encerrar);

    if (reduzir) {
      intro.classList.add('mostrar-texto');
      setTimeout(encerrar, 1800);
      return;
    }

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H;
    function medir() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    medir();

    // Pontos do nome da loja: desenha o texto fora da tela e amostra os pixels
    var off = document.createElement('canvas');
    var oc = off.getContext('2d');
    var cores = ['#9466FF', '#7A5CFF', '#4F6BFF', '#3D8BFF', '#22B8F0'];
    var particulas = [], ox = 0, oy = 0, passo = 4;
    function construirAlvos() {
      var maxLarg = Math.min(W * 0.86, 1150);
      var tam = 160;
      oc.font = '800 ' + tam + 'px Sora, Manrope, sans-serif';
      var larg = oc.measureText('TOP BRASIL SHOP').width;
      tam = Math.max(26, Math.min(150, tam * maxLarg / larg));
      off.width = Math.ceil(maxLarg + 40); off.height = Math.ceil(tam * 1.5);
      oc.clearRect(0, 0, off.width, off.height);
      oc.fillStyle = '#fff'; oc.textAlign = 'center'; oc.textBaseline = 'middle';
      oc.font = '800 ' + tam + 'px Sora, Manrope, sans-serif';
      oc.fillText('TOP BRASIL SHOP', off.width / 2, off.height / 2);
      var dados = oc.getImageData(0, 0, off.width, off.height).data;
      passo = Math.max(3, Math.round(tam / 24));
      var alvos = [];
      for (var y = 0; y < off.height; y += passo) {
        for (var x = 0; x < off.width; x += passo) {
          if (dados[(y * off.width + x) * 4 + 3] > 140) alvos.push([x, y]);
        }
      }
      ox = (W - off.width) / 2; oy = H * 0.40 - off.height / 2;
      particulas = alvos.map(function (a) {
        var ang = Math.random() * Math.PI * 2;
        var raio = Math.max(W, H) * (0.6 + Math.random() * 0.6);
        var pos = a[0] / off.width;
        return {
          x: W / 2 + Math.cos(ang) * raio, y: H / 2 + Math.sin(ang) * raio,
          tx: ox + a[0], ty: oy + a[1],
          atraso: pos * 520 + Math.random() * 380,
          cor: cores[Math.min(cores.length - 1, Math.floor(pos * cores.length))],
          r: passo * (0.30 + Math.random() * 0.16),
          fase: Math.random() * Math.PI * 2
        };
      });
    }
    var estrelas = [];
    for (var s = 0; s < 160; s++) estrelas.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), v: 0.05 + Math.random() * 0.25 });

    var inicio = performance.now();
    var DUR = 1700;
    function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

    function quadro(agora) {
      var t = agora - inicio;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(7,5,26,0.34)';
      ctx.fillRect(0, 0, W, H);

      // brilho de fundo
      var g = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, Math.max(W, H) * 0.6);
      g.addColorStop(0, 'rgba(109,61,240,' + (0.10 + 0.06 * Math.sin(t / 900)) + ')');
      g.addColorStop(1, 'rgba(7,5,26,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // estrelas
      for (var i = 0; i < estrelas.length; i++) {
        var e = estrelas[i];
        e.y -= e.v; if (e.y < 0) { e.y = H; e.x = Math.random() * W; }
        ctx.fillStyle = 'rgba(180,170,255,' + (0.15 + e.z * 0.45) + ')';
        ctx.fillRect(e.x, e.y, 1 + e.z, 1 + e.z);
      }

      ctx.globalCompositeOperation = 'lighter';
      var tvar = t - (DUR + 700);
      for (var k = 0; k < particulas.length; k++) {
        var p = particulas[k];
        var prog = Math.max(0, Math.min(1, (t - p.atraso) / DUR));
        var ep = easeOut(prog);
        var tremor = prog >= 1 ? Math.sin(t / 380 + p.fase) * 0.7 : 0;
        var px = p.x + (p.tx - p.x) * ep + tremor;
        var py = p.y + (p.ty - p.y) * ep + Math.cos(t / 420 + p.fase) * (prog >= 1 ? 0.7 : 0);
        var brilho = 0;
        if (tvar > 0 && tvar < 1200) { var dx = Math.abs(px - (ox - 150 + (off.width + 300) * (tvar / 1200))); if (dx < 110) brilho = 1 - dx / 110; }
        ctx.fillStyle = brilho > 0.35 ? '#FFFFFF' : p.cor;
        ctx.globalAlpha = Math.min(1, 0.25 + 0.55 * ep + brilho * 0.5);
        ctx.beginPath(); ctx.arc(px, py, p.r * (1.6 - 0.6 * ep) * (1 + brilho * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (t > DUR + 500 && !intro.classList.contains('mostrar-texto')) intro.classList.add('mostrar-texto');
      if (t > DUR + 3300) encerrar();
      if (!encerrado || t < DUR + 4300) raf = requestAnimationFrame(quadro);
    }
    // espera a fonte carregar para o nome sair na fonte certa
    var comecou = false;
    var comecar = function () { if (comecou) return; comecou = true; construirAlvos(); inicio = performance.now(); raf = requestAnimationFrame(quadro); };
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 80px Sora').then(comecar, comecar);
      setTimeout(comecar, 900);
    } else { comecar(); }
    window.addEventListener('resize', medir);
  }

  // ---------- Graficos ----------
  function destruirGraficos() {
    graficosAtivos.forEach(function (g) { try { g.destroy(); } catch (e) {} });
    graficosAtivos = [];
  }

  function opcoesBaseGrafico() {
    var ink = cssVar('--ink'), muted = cssVar('--muted'), line = cssVar('--line'), surface = cssVar('--surface');
    return {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surface, titleColor: ink, bodyColor: ink, borderColor: line, borderWidth: 1,
          padding: 12, cornerRadius: 10, boxPadding: 4, usePointStyle: true,
          titleFont: { family: 'Sora', weight: '700', size: 13 }, bodyFont: { family: 'Manrope', size: 13 },
          callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fmtMoney(c.parsed.y !== undefined ? c.parsed.y : c.parsed); } }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { color: line }, ticks: { color: muted, font: { family: 'Manrope', size: 11 }, maxRotation: 0, autoSkipPadding: 12 } },
        y: { grid: { color: line, drawTicks: false }, border: { display: false }, ticks: { color: muted, font: { family: 'Manrope', size: 11 }, padding: 8, callback: function (v) { return 'R$ ' + (v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : v); } } }
      }
    };
  }

  function novoGrafico(canvas, config) {
    if (typeof Chart === 'undefined') {
      canvas.parentNode.appendChild(el('div', { class: 'pml-empty', text: 'Não consegui carregar os gráficos. Confira sua internet e recarregue a página.' }));
      canvas.remove();
      return null;
    }
    var g = new Chart(canvas.getContext('2d'), config);
    graficosAtivos.push(g);
    return g;
  }

  // ---------- Dados do inicio ----------
  function dadosInicio() {
    var hoje = hojeStr(0), ontem = hojeStr(-1);
    var inicio30 = hojeStr(-29);
    var mesAtual = hoje.slice(0, 7);
    var r = { hoje: { total: 0, pedidos: 0, plat: {} }, ontem: { total: 0 }, mes: { total: 0, pedidos: 0 }, dias: {}, plat30: {}, total30: 0 };
    for (var i = 0; i < 30; i++) r.dias[hojeStr(-29 + i)] = { ml: 0, shopee: 0, tiktok: 0, outro: 0 };
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda') return;
      var v = Number(t.valor) || 0;
      var p = plataformaDe(t);
      if (t.data === hoje) { r.hoje.total += v; r.hoje.pedidos++; r.hoje.plat[p] = (r.hoje.plat[p] || 0) + v; }
      if (t.data === ontem) r.ontem.total += v;
      if ((t.data || '').slice(0, 7) === mesAtual) { r.mes.total += v; r.mes.pedidos++; }
      if (t.data >= inicio30 && r.dias[t.data]) { r.dias[t.data][p] += v; r.plat30[p] = (r.plat30[p] || 0) + v; r.total30 += v; }
    });
    return r;
  }

