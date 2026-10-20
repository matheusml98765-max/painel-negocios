  // ===================== CALENDARIO =====================
  // Todos os dias do mes: quanto vendeu, quanto lucrou e a margem. Clicar num dia abre tudo dele.

  var NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function resumoDia(dia) {
    var r = calcVendasDoDia(dia);
    var ads = r.ads && r.comLucro ? r.ads : 0;
    var brutoLucro = r.vendas.reduce(function (s, v) { return s + (v.lucro !== null ? v.valor : 0); }, 0);
    var plat = { ml: { n: 0, v: 0 }, shopee: { n: 0, v: 0 } }, unidades = 0, prod = {};
    r.vendas.forEach(function (v) {
      var p = plat[v.plataforma] || plat.ml; p.n++; p.v += v.valor;
      (v.t.itens || []).forEach(function (i) {
        var q = Number(i.quantidade) || 1; unidades += q;
        var k = String(i.titulo || i.item_id || '?'); prod[k] = (prod[k] || 0) + q;
      });
    });
    var canc = (state.transacoes || []).filter(function (t) { return t.tipo === 'cancelamento' && t.data === dia; });
    return {
      dia: dia, r: r, vendas: r.vendas.length, bruto: r.bruto, liquido: r.liquido, lucro: r.comLucro ? r.lucro - ads : null, ads: r.ads,
      margem: brutoLucro > 0 ? (r.lucro - ads) / brutoLucro : null, plat: plat, unidades: unidades,
      top: Object.keys(prod).map(function (k) { return [k, prod[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5),
      cancelamentos: canc.length, valorCancelado: canc.reduce(function (s, t) { return s + (Number(t.valor) || 0); }, 0)
    };
  }

  function calcCalendario(mes) {
    var ult = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate(), dias = [], tot = { bruto: 0, lucro: 0, vendas: 0, brutoLucro: 0 };
    for (var d = 1; d <= ult; d++) {
      var x = resumoDia(mes + '-' + String(d).padStart(2, '0'));
      dias.push(x);
      tot.bruto += x.bruto; tot.vendas += x.vendas;
      if (x.lucro !== null) { tot.lucro += x.lucro; tot.brutoLucro += x.r.vendas.reduce(function (s, v) { return s + (v.lucro !== null ? v.valor : 0); }, 0); }
    }
    var comVenda = dias.filter(function (x) { return x.vendas; });
    var melhor = comVenda.slice().sort(function (a, b) { return (b.lucro || 0) - (a.lucro || 0); })[0] || null;
    return { mes: mes, dias: dias, tot: tot, margem: tot.brutoLucro ? tot.lucro / tot.brutoLucro : null, melhor: melhor, diasComVenda: comVenda.length };
  }

  function renderCalendarioTab(wrap) {
    var hoje = isoHoje(0);
    var mes = state.calMes || hoje.slice(0, 7);
    var c = calcCalendario(mes);
    var card = el('div', { class: 'pml-card' });
    var nomeMes = NOMES_MES[Number(mes.slice(5, 7)) - 1] + ' de ' + mes.slice(0, 4);
    card.appendChild(el('div', { class: 'cal-cab' }, [
      el('button', { class: 'pml-btn secondary', text: '‹', title: 'Mês anterior', onclick: function () { state.calMes = somaMes(mes, -1); state.calDia = null; render(); } }),
      el('p', { class: 'pml-section-title', style: 'margin:0;', text: nomeMes }),
      el('button', { class: 'pml-btn secondary', text: '›', title: 'Próximo mês', style: mes >= hoje.slice(0, 7) ? 'opacity:.4;' : '', onclick: function () { if (mes < hoje.slice(0, 7)) { state.calMes = somaMes(mes, 1); state.calDia = null; render(); } } })
    ]));
    card.appendChild(el('div', { class: 'pml-metrics', style: 'margin:12px 0;' }, [
      metricaFicha('Vendido no mês', fmtMoney(c.tot.bruto), c.tot.vendas + ' vendas em ' + c.diasComVenda + ' dia(s)'),
      metricaFicha('Lucro dos dias', fmtMoney(c.tot.lucro), 'depois de taxas, imposto, custo e Ads da Shopee', c.tot.lucro >= 0 ? 'pos' : 'neg'),
      metricaFicha('Margem do mês', c.margem === null ? '—' : fmtPct(c.margem), 'lucro ÷ faturamento'),
      metricaFicha('Melhor dia', c.melhor ? c.melhor.dia.slice(8) + '/' + mes.slice(5) : '—', c.melhor ? 'lucro ' + fmtMoney(c.melhor.lucro || 0) + ' · ' + c.melhor.vendas + ' vendas' : '')
    ]));
    var grade = el('div', { class: 'cal-grade' });
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(function (n) { grade.appendChild(el('div', { class: 'cal-sem', text: n })); });
    var primeiro = new Date(mes + '-01T12:00:00').getDay();
    for (var i = 0; i < primeiro; i++) grade.appendChild(el('div', { class: 'cal-vazio' }));
    var maxLucro = Math.max.apply(null, c.dias.map(function (x) { return Math.abs(x.lucro || 0); }).concat([1]));
    c.dias.forEach(function (x) {
      var futuro = x.dia > hoje, sel = state.calDia === x.dia;
      var forca = x.lucro ? Math.min(1, Math.abs(x.lucro) / maxLucro) : 0;
      var fundo = x.lucro > 0 ? 'background: color-mix(in srgb, var(--good) ' + Math.round(6 + forca * 26) + '%, var(--surface));'
        : x.lucro < 0 ? 'background: color-mix(in srgb, var(--bad) ' + Math.round(8 + forca * 22) + '%, var(--surface));' : '';
      grade.appendChild(el('button', { class: 'cal-dia' + (sel ? ' sel' : '') + (x.dia === hoje ? ' hoje' : '') + (futuro ? ' futuro' : ''), style: fundo,
        onclick: function () { if (!futuro) { state.calDia = sel ? null : x.dia; render(); } } }, [
        el('div', { class: 'cal-num', text: String(Number(x.dia.slice(8))) }),
        x.vendas ? el('div', { class: 'cal-vend', text: fmtMoney(x.bruto) }) : null,
        x.vendas ? el('div', { class: 'cal-luc', text: x.lucro === null ? 'sem custo' : fmtMoney(x.lucro) }) : null,
        x.margem !== null ? el('div', { class: 'cal-mg', text: fmtPct(x.margem) }) : null
      ].filter(Boolean)));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [grade]));
    card.appendChild(el('p', { class: 'pml-note', text: 'Cada dia: vendido · lucro · margem. Verde = lucro (mais forte, mais lucro); vermelho = prejuízo. Clique num dia para ver tudo dele. O Ads da Shopee entra no dia em que foi gasto; o Ads do ML, a antecipação e o Full ficam no mês (aba Relatório).' }));
    wrap.appendChild(card);
    if (state.calDia && state.calDia.slice(0, 7) === mes) renderDiaCalendario(wrap, resumoDia(state.calDia));
  }

  function renderDiaCalendario(wrap, x) {
    var r = x.r, d = x.dia.split('-');
    var nome = new Date(x.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: nome.charAt(0).toUpperCase() + nome.slice(1) })]);
    card.appendChild(el('div', { class: 'pml-metrics', style: 'margin-bottom:12px;' }, [
      metricaFicha('Vendido', fmtMoney(x.bruto), x.vendas + ' vendas · ' + x.unidades + ' unidade(s)'),
      metricaFicha('Cai na conta', fmtMoney(x.liquido), 'taxas e frete ' + fmtMoney(x.bruto - x.liquido) + (r.semTaxas ? ' · ' + r.semTaxas + ' sem taxas ainda' : ''), 'pos'),
      metricaFicha('Imposto + custo', fmtMoney(r.imposto + r.custo), 'imposto ' + fmtMoney(r.imposto) + ' · produtos ' + fmtMoney(r.custo)),
      metricaFicha('Lucro', x.lucro === null ? '—' : fmtMoney(x.lucro), x.ads ? 'já tirando ' + fmtMoney(x.ads) + ' de Ads da Shopee' : 'sem Ads da Shopee nesse dia', x.lucro !== null && x.lucro < 0 ? 'neg' : 'pos'),
      metricaFicha('Margem', x.margem === null ? '—' : fmtPct(x.margem), 'lucro ÷ faturamento'),
      metricaFicha('Ticket médio', x.vendas ? fmtMoney(x.bruto / x.vendas) : '—', 'ML ' + x.plat.ml.n + ' (' + fmtMoney(x.plat.ml.v) + ') · Shopee ' + x.plat.shopee.n + ' (' + fmtMoney(x.plat.shopee.v) + ')')
    ]));
    var extras = [];
    if (x.cancelamentos) extras.push(x.cancelamentos + ' cancelamento(s), ' + fmtMoney(x.valorCancelado));
    if (r.semCusto) extras.push(r.semCusto + ' venda(s) sem custo cadastrado ficaram fora do lucro');
    if (x.top.length) extras.push('Mais vendidos: ' + x.top.map(function (p) { return p[1] + '× ' + p[0].slice(0, 35); }).join(' · '));
    if (extras.length) card.appendChild(el('p', { class: 'pml-margin', style: 'margin:0 0 10px;', text: extras.join('  |  ') }));
    if (r.vendas.length) {
      var t = el('table', { class: 'pml-table' });
      t.appendChild(el('tr', {}, ['Hora', 'Produto', 'Loja', 'Vendido', 'Cai na conta', 'Custo', 'Lucro', 'Margem'].map(function (h, i) { return el('th', { class: i > 2 ? 'num' : '', text: h }); })));
      r.vendas.forEach(function (v) {
        var hora = v.t.dataHora ? new Date(v.t.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        t.appendChild(el('tr', {}, [el('td', { text: hora }), el('td', { text: ((v.t.itens || [])[0] || {}).titulo ? String(v.t.itens[0].titulo).slice(0, 45) + (v.t.itens.length > 1 ? ' +' + (v.t.itens.length - 1) : '') : '—' }),
          el('td', { text: v.plataforma === 'shopee' ? 'Shopee' : 'ML' }), el('td', { class: 'num', text: fmtMoney(v.valor) }),
          el('td', { class: 'num', text: v.liquido === null ? '—' : fmtMoney(v.liquido) }), el('td', { class: 'num', text: v.faltaCusto.length ? 'sem custo' : fmtMoney(v.custo) }),
          el('td', { class: 'num', style: v.lucro !== null && v.lucro < 0 ? 'color:var(--bad); font-weight:700;' : 'font-weight:600;', text: v.lucro === null ? '—' : fmtMoney(v.lucro) }),
          el('td', { class: 'num', text: v.lucro === null || !v.valor ? '—' : fmtPct(v.lucro / v.valor) })]));
      });
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    } else card.appendChild(el('div', { class: 'pml-empty', text: 'Nenhuma venda nesse dia.' }));
    wrap.appendChild(card);
  }

  // Calendario pequeno para escolher um dia (Vendas uma por uma). Dias com venda ganham um ponto.
  function miniCalendario(sel, mes, aoEscolher, aoMudarMes) {
    var hoje = isoHoje(0), vendas = {};
    (state.transacoes || []).forEach(function (t) { if (t.tipo === 'venda' && t.data && t.data.slice(0, 7) === mes) vendas[t.data] = (vendas[t.data] || 0) + (Number(t.valor) || 0); });
    var max = Math.max.apply(null, Object.keys(vendas).map(function (k) { return vendas[k]; }).concat([1]));
    var caixa = el('div', { class: 'mini-cal' }, [el('div', { class: 'mini-cal-cab' }, [
      el('button', { class: 'pml-btn secondary', text: '‹', title: 'Mês anterior', onclick: function () { aoMudarMes(somaMes(mes, -1)); } }),
      el('strong', { text: NOMES_MES[Number(mes.slice(5, 7)) - 1] + ' ' + mes.slice(0, 4) }),
      el('button', { class: 'pml-btn secondary', text: '›', title: 'Próximo mês', style: mes >= hoje.slice(0, 7) ? 'opacity:.35;' : '', onclick: function () { if (mes < hoje.slice(0, 7)) aoMudarMes(somaMes(mes, 1)); } })
    ])]);
    var g = el('div', { class: 'mini-cal-grade' });
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(function (n) { g.appendChild(el('span', { class: 'mini-cal-sem', text: n })); });
    var primeiro = new Date(mes + '-01T12:00:00').getDay(), ult = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
    for (var i = 0; i < primeiro; i++) g.appendChild(el('span'));
    for (var d = 1; d <= ult; d++) (function (dia) {
      var futuro = dia > hoje, v = vendas[dia] || 0;
      g.appendChild(el('button', { class: 'mini-cal-dia' + (dia === sel ? ' sel' : '') + (dia === hoje ? ' hoje' : '') + (futuro ? ' futuro' : ''),
        title: v ? fmtMoney(v) + ' vendidos' : 'sem vendas', style: v ? 'background: color-mix(in srgb, var(--accent) ' + Math.round(8 + v / max * 30) + '%, var(--surface));' : '',
        onclick: function () { if (!futuro) aoEscolher(dia); } }, [el('span', { text: String(Number(dia.slice(8))) })]));
    })(mes + '-' + String(d).padStart(2, '0'));
    caixa.appendChild(g);
    caixa.appendChild(el('div', { class: 'pml-margin', style: 'margin-top:6px;', text: 'Mais forte = vendeu mais. Clique num dia para ver as vendas dele.' }));
    return caixa;
  }
