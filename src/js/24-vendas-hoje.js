  // ===================== VENDAS DO DIA, UMA POR UMA =====================
  // Cada venda com o que a plataforma cobrou, o frete, o que cai na conta, o imposto, o custo
  // do produto (pela ordem das compras) e o lucro. Ads entra no total do dia, nao por venda.

  var REPO_AUTOMACAO = 'matheusml98765-max/automacao-mercado-livre';

  function calcVendasDoDia(dia) {
    var imp = (Number(state.configLucro.imposto) || 0) / 100;
    var r = { vendas: [], bruto: 0, liquido: 0, imposto: 0, custo: 0, lucro: 0, semTaxas: 0, semCusto: 0, comLucro: 0 };
    (state.transacoes || []).forEach(function (t) {
      if (t.tipo !== 'venda' || t.data !== dia) return;
      var c = custosDaVenda(t);
      var valor = Number(t.valor) || 0;
      var v = { t: t, valor: valor, plataforma: c ? c.plataforma : (String(t.origemId || '').indexOf('shopee') !== -1 ? 'shopee' : 'ml'), taxas: null, frete: null, liquido: null, imposto: valor * imp, custo: 0, lucro: null, faltaCusto: [] };
      (t.itens || []).forEach(function (i) {
        var cu = custoDoItem(i.item_id, t.data);
        if (cu) v.custo += cu.valor * (Number(i.quantidade) || 1); else v.faltaCusto.push(i.titulo || i.item_id);
      });
      if (c) { v.taxas = c.comissao; v.frete = c.frete; v.liquido = c.liquido; }
      if (c && !v.faltaCusto.length) v.lucro = v.liquido - v.imposto - v.custo;
      r.bruto += valor;
      if (c) r.liquido += v.liquido; else r.semTaxas++;
      if (v.faltaCusto.length) r.semCusto++;
      if (v.lucro !== null) { r.lucro += v.lucro; r.comLucro++; }
      r.imposto += v.imposto; r.custo += v.custo;
      r.vendas.push(v);
    });
    r.vendas.sort(function (a, b) { return String(b.t.dataHora || '').localeCompare(String(a.t.dataHora || '')); });
    var a = state.adsShopee && Array.isArray(state.adsShopee.dias) ? state.adsShopee.dias.find(function (x) { return x.data === dia; }) : null;
    r.ads = a ? Number(a.gasto) || 0 : null;
    return r;
  }

  function tokenAtualizar() { try { return localStorage.getItem('pml_ml-gh-token') || ''; } catch (e) { return ''; } }

  // Pede uma execucao da automacao agora e vai buscando os dados novos por ate 4 minutos
  async function atualizarAgora() {
    var tk = tokenAtualizar();
    if (!tk) { state.pedirTokenAtualizar = true; render(); return; }
    state.atualizandoAgora = 'Pedindo a atualização...'; render();
    try {
      var resp = await fetch('https://api.github.com/repos/' + REPO_AUTOMACAO + '/actions/workflows/atualizar.yml/dispatches', {
        method: 'POST', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tk, 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ ref: 'main' })
      });
      if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
        state.atualizandoAgora = null; state.pedirTokenAtualizar = true;
        state.erroToken = 'O GitHub recusou esse token (venceu ou não tem permissão de Actions). Cole um novo.';
        render(); return;
      }
    } catch (e) { state.atualizandoAgora = null; state.errorMsg = 'Não consegui falar com o GitHub agora.'; render(); return; }
    var antes = state.statusAuto && state.statusAuto.atualizado_em;
    for (var i = 0; i < 12; i++) {
      state.atualizandoAgora = 'Buscando as vendas nas plataformas... (' + (i * 20) + ' s)'; render();
      await new Promise(function (ok) { setTimeout(ok, 20000); });
      await sincronizarGist(true);
      if (state.gistUrlShopee) await sincronizarGistShopee(true);
      if (state.statusAuto && state.statusAuto.atualizado_em && state.statusAuto.atualizado_em !== antes) break;
    }
    state.atualizandoAgora = null; render();
  }

  function blocoTokenAtualizar() {
    var inp = el('input', { type: 'password', placeholder: 'github_pat_...', autocomplete: 'off', style: 'min-width:260px;' });
    return el('div', { class: 'pml-dica', style: 'margin-top:10px;' }, [
      el('div', { html: '<b>Para atualizar na hora</b>, cole aqui o mesmo token do GitHub que está no cron-job.org (o que só tem permissão de Actions). Ele fica guardado só neste navegador.' + (state.erroToken ? '<br><b style="color:var(--bad)">' + state.erroToken + '</b>' : '') }),
      el('div', { style: 'display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;' }, [inp, el('button', { class: 'pml-btn', text: 'Salvar e atualizar', onclick: function () {
        if (!inp.value.trim()) return;
        try { localStorage.setItem('pml_ml-gh-token', inp.value.trim()); } catch (e) {}
        state.pedirTokenAtualizar = false; state.erroToken = '';
        atualizarAgora();
      } }), el('button', { class: 'pml-btn secondary', text: 'Agora não', onclick: function () { state.pedirTokenAtualizar = false; render(); } })])
    ]);
  }

  function renderVendasDoDia(grid) {
    var hoje = isoHoje(0), ontem = isoHoje(-1);
    var dia = state.diaVendas === ontem ? ontem : hoje;
    var r = calcVendasDoDia(dia);
    var bloco = el('section', { class: 'ini-bloco ini-c12' });
    var horas = horasDesdeAtualizacaoAutomacao();
    var quando = state.statusAuto && state.statusAuto.atualizado_em ? new Date(state.statusAuto.atualizado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
    bloco.appendChild(el('div', { class: 'cab' }, [
      el('h3', { text: 'Vendas ' + (dia === hoje ? 'de hoje' : 'de ontem') + ', uma por uma' }),
      el('div', { style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;' }, [
        el('span', { class: 'pml-margin', text: quando ? 'buscado nas plataformas às ' + quando + (horas !== null && horas < 1.5 ? ' · próxima em até 1 h' : '') : '' }),
        el('button', { class: 'pml-btn secondary', style: 'padding:5px 10px; font-size:12px;', text: dia === hoje ? 'Ver ontem' : 'Ver hoje', onclick: function () { state.diaVendas = dia === hoje ? ontem : hoje; render(); } }),
        el('button', { class: 'pml-btn', style: 'padding:5px 10px; font-size:12px;' + (state.atualizandoAgora ? ' opacity:.7; cursor:wait;' : ''), text: state.atualizandoAgora ? '⏳ ' + state.atualizandoAgora : '↻ Atualizar agora', onclick: function () { if (!state.atualizandoAgora) atualizarAgora(); } })
      ])
    ]));
    if (state.pedirTokenAtualizar) bloco.appendChild(blocoTokenAtualizar());

    var lucroDia = r.lucro - (r.ads && r.semCusto < r.vendas.length ? r.ads : 0);
    // Margem sobre o faturamento: lucro / vendido, so das vendas que ja tem lucro calculado
    var brutoComLucro = r.vendas.reduce(function (s, v) { return s + (v.lucro !== null ? v.valor : 0); }, 0);
    var margemDia = brutoComLucro > 0 ? lucroDia / brutoComLucro : null;
    bloco.appendChild(el('div', { class: 'pml-metrics', style: 'margin:10px 0;' }, [
      metricaFicha('Vendido', fmtMoney(r.bruto), r.vendas.length + (r.vendas.length === 1 ? ' venda' : ' vendas')),
      metricaFicha('Cai na sua conta', fmtMoney(r.liquido), r.semTaxas ? r.semTaxas + ' venda(s) com as taxas ainda chegando' : 'depois de comissão, taxas e frete', 'pos'),
      metricaFicha('Imposto + custo dos produtos', fmtMoney(r.imposto + r.custo), 'imposto ' + fmtMoney(r.imposto) + ' · produtos ' + fmtMoney(r.custo)),
      metricaFicha('Lucro', r.comLucro ? fmtMoney(lucroDia) : '—', !r.comLucro ? 'falta custo ou taxa das vendas' : (r.comLucro < r.vendas.length ? 'de ' + r.comLucro + ' das ' + r.vendas.length + ' vendas' : 'de todas as vendas') + (r.ads ? ', já tirando ' + fmtMoney(r.ads) + ' de Ads da Shopee' : ''), lucroDia >= 0 ? 'pos' : 'neg'),
      metricaFicha('Margem do dia', margemDia === null ? '—' : fmtPct(margemDia), margemDia === null ? 'falta custo ou taxa das vendas' : 'lucro ÷ faturamento' + (brutoComLucro < r.bruto - 0.01 ? ' (' + fmtMoney(brutoComLucro) + ' das vendas com lucro)' : ' (' + fmtMoney(r.bruto) + ')'), margemDia !== null && margemDia < 0 ? 'neg' : 'pos')
    ]));
    if (!r.vendas.length) { bloco.appendChild(el('div', { class: 'pml-empty', text: 'Nenhuma venda ' + (dia === hoje ? 'hoje' : 'ontem') + ' até a última atualização.' })); grid.appendChild(bloco); return; }
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Hora', 'Onde', 'Produto', 'Venda', 'Taxas', 'Frete', 'Cai na conta', 'Imposto', 'Custo', 'Lucro'].map(function (h, i) { return el('th', { class: i > 2 ? 'num' : '', text: h }); })));
    r.vendas.forEach(function (v) {
      var hora = v.t.dataHora ? new Date(v.t.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
      var prod = (v.t.itens || []).map(function (i) { return (Number(i.quantidade) > 1 ? i.quantidade + '× ' : '') + (i.titulo || i.item_id); }).join(' + ') || (v.t.descricao || '');
      t.appendChild(el('tr', {}, [
        el('td', { text: hora }),
        el('td', { text: v.plataforma === 'shopee' ? 'Shopee' : 'ML' }),
        el('td', { style: 'max-width:320px;', text: prod }),
        el('td', { class: 'num', text: fmtMoney(v.valor) }),
        el('td', { class: 'num', text: v.taxas === null ? 'chegando' : fmtMoney(v.taxas) }),
        el('td', { class: 'num', text: v.frete === null ? '—' : fmtMoney(v.frete) }),
        el('td', { class: 'num', text: v.liquido === null ? '—' : fmtMoney(v.liquido) }),
        el('td', { class: 'num', text: fmtMoney(v.imposto) }),
        el('td', { class: 'num', style: v.faltaCusto.length ? 'color:var(--warn);' : '', text: v.faltaCusto.length ? 'sem custo' : fmtMoney(v.custo) }),
        el('td', { class: 'num', style: 'font-weight:700; color:' + (v.lucro === null ? 'var(--muted)' : v.lucro >= 0 ? 'var(--good)' : 'var(--bad)'), text: v.lucro === null ? '—' : fmtMoney(v.lucro) })
      ]));
    });
    bloco.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    bloco.appendChild(el('p', { class: 'pml-note', text: 'As vendas chegam pela automação de hora em hora (6h às 23h) ou na hora pelo botão Atualizar agora. Na Shopee, as taxas de um pedido às vezes só aparecem depois que ele é enviado. "Sem custo": cadastre o custo do produto na aba Lucro real ou na Calculadora 3D.' }));
    grid.appendChild(bloco);
  }

  // Com o painel aberto, busca os dados novos sozinho a cada 10 minutos. A aba escondida nao busca;
  // quando o vendedor volta para ela (ex.: painel aberto desde a manha), busca na hora se passou de 5 min.
  var ultimaBuscaAuto = Date.now();
  function buscarSeVelho(minutos) {
    if (document.visibilityState === 'hidden' || state.sincronizando || state.atualizandoAgora) return;
    if (Date.now() - ultimaBuscaAuto < minutos * 60 * 1000) return;
    ultimaBuscaAuto = Date.now();
    if (state.gistUrl) sincronizarGist(true);
    if (state.gistUrlShopee) sincronizarGistShopee(true);
  }
  if (typeof setInterval === 'function' && typeof document !== 'undefined' && document.addEventListener) {
    setInterval(function () { buscarSeVelho(10); }, 60 * 1000);
    document.addEventListener('visibilitychange', function () { buscarSeVelho(5); });
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('focus', function () { buscarSeVelho(5); });
  }
