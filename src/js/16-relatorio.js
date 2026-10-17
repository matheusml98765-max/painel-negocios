  // ===================== RELATORIO DO MES =====================
  // Nota da loja, problemas e oportunidades em R$ e plano para os proximos 30 dias.

  function intervaloMes(mes) {
    var p = mes.split('-'), ano = Number(p[0]), m = Number(p[1]);
    var fim = new Date(ano, m, 0).getDate();
    return { de: mes + '-01', ate: mes + '-' + String(fim).padStart(2, '0'), diasNoMes: fim };
  }

  function mesAnteriorDe(mes) {
    var p = mes.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 2, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function mesesComVendas() {
    var m = {};
    state.transacoes.forEach(function (t) { if (t.tipo === 'venda' && t.data) m[t.data.slice(0, 7)] = true; });
    return Object.keys(m).sort().reverse();
  }

  function curto(t) {
    t = String(t || '');
    if (t.length <= 48) return t;
    return t.slice(0, 48).replace(/\s+\S*$/, '') + '…';
  }

  function vendasDoMes(mes) {
    var r = { total: 0, pedidos: 0, plat: {} };
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || (t.data || '').slice(0, 7) !== mes) return;
      var v = Number(t.valor) || 0, p = plataformaDe(t);
      r.total += v; r.pedidos++; r.plat[p] = (r.plat[p] || 0) + v;
    });
    return r;
  }

  function calcRelatorioMes(mes, agora) {
    agora = agora || new Date();
    var iv = intervaloMes(mes);
    var hoje = isoDia(agora);
    var emAndamento = hoje >= iv.de && hoje <= iv.ate;
    var vendas = vendasDoMes(mes);
    var anterior = vendasDoMes(mesAnteriorDe(mes));
    // So compara com o mes anterior se os dados cobrem o mes anterior inteiro
    var primeiraVenda = state.transacoes.reduce(function (m, t) { return t.tipo === 'venda' && t.data && t.data < m ? t.data : m; }, '9999');
    anterior.completo = primeiraVenda <= mesAnteriorDe(mes) + '-01';
    if (!anterior.completo) anterior.total = 0;
    var proj = emAndamento ? calcProjecaoMes(vendas.total, agora).projecao : vendas.total;
    var imp = (Number(state.configLucro.imposto) || 0) / 100;
    var alvo = (Number(state.configLucro.margemAlvo) || 0) / 100;
    var linhas = calcLucroPorProduto(0, 'todas', iv).linhas;
    var tot = linhas.reduce(function (a, g) {
      a.receita += g.receita;
      if (g.lucro !== null) { a.lucro += g.lucro; a.receitaComCusto += g.receita; } else { a.receitaSemCusto += g.receita; a.semCusto.push(g); }
      if (g.lucro !== null && g.lucro < 0) a.prejuizo.push(g);
      return a;
    }, { receita: 0, lucro: 0, receitaComCusto: 0, receitaSemCusto: 0, semCusto: [], prejuizo: [] });
    var ads = (state.adsShopee && state.adsShopee.dias || []).reduce(function (a, d) {
      if (d.data >= iv.de && d.data <= iv.ate) { a.gasto += Number(d.gasto) || 0; a.vendas += Number(d.vendas_ads) || 0; a.dias++; }
      return a;
    }, { gasto: 0, vendas: 0, dias: 0 });
    // Ads proporcional a parte das vendas que tem custo (o resto nao entra no lucro)
    var lucroAposAds = tot.lucro - ads.gasto * (tot.receita ? tot.receitaComCusto / tot.receita : 0);
    var margem = tot.receitaComCusto ? lucroAposAds / tot.receitaComCusto : null;

    // ---- Problemas e oportunidades (em R$ por mes) ----
    var itens = [];
    tot.prejuizo.forEach(function (g) {
      itens.push({ valor: -g.lucro, tipo: 'prejuizo', texto: '<b>' + g.titulo + '</b> deu ' + fmtMoney(-g.lucro) + ' de prejuízo (' + g.unidades + ' un.).', acao: 'Suba o preço de ' + curto(g.titulo) + ' ou pague no máximo ' + fmtMoney(Math.max(0, g.maxCompra || 0)) + ' na próxima compra.' });
    });
    var adsProd = calcAdsPorProduto();
    if (adsProd) adsProd.linhas.filter(function (a) { return a.decisao === 'pausar'; }).forEach(function (a) {
      itens.push({ valor: a.gasto, tipo: 'ads', texto: 'Shopee Ads de <b>' + a.titulo + '</b> gastou ' + fmtMoney(a.gasto) + ' nos últimos ' + adsProd.dias + ' dias, com o Ads levando ' + fmtPct(a.acos) + ' de cada venda (margem ' + fmtPct(a.margem) + ').', acao: 'Pause ou baixe o lance do Ads de ' + curto(a.titulo) + '.' });
    });
    var fat = state.faturamento && (state.faturamento.periodos || []).find(function (p) { return String(p.chave || '').slice(0, 7) === mes; });
    if (fat) {
      var antecip = (fat.linhas || []).filter(function (l) { return l.categoria === 'Antecipação'; }).reduce(function (s, l) { return s + l.valor; }, 0);
      if (antecip > 0) itens.push({ valor: antecip, tipo: 'antecipacao', texto: 'Na fatura ' + fat.chave.slice(0, 7) + ' do ML você pagou <b>' + fmtMoney(antecip) + '</b> para receber o dinheiro antes do prazo.', acao: 'Desligue a antecipação automática no Mercado Pago e antecipe só quando precisar.' });
    }
    linhas.filter(function (g) { return g.receita > 0 && g.taxasMl / g.receita > 0.4 && g.lucro !== null && g.lucro >= 0; }).forEach(function (g) {
      itens.push({ valor: 0, tipo: 'taxa', texto: 'A plataforma ficou com <b>' + fmtPct(g.taxasMl / g.receita) + '</b> das vendas de ' + g.titulo + '.', acao: 'Revise o preço ou o tipo de anúncio de ' + curto(g.titulo) + ' (taxa acima de 40%).' });
    });
    itens.sort(function (a, b) { return b.valor - a.valor; });
    var emJogo = itens.reduce(function (s, i) { return s + i.valor; }, 0);

    // ---- Nota de 0 a 10 (cada desconto aparece na tela) ----
    var fatores = [];
    if (margem !== null && margem < alvo) fatores.push({ pontos: -Math.min(4, (alvo - margem) * 20), texto: 'margem de ' + fmtPct(margem) + ' abaixo da meta de ' + fmtPct(alvo) });
    if (tot.prejuizo.length) fatores.push({ pontos: -Math.min(2, tot.prejuizo.length * 0.5), texto: tot.prejuizo.length + ' produto(s) com prejuízo' });
    if (tot.receita && tot.receitaSemCusto / tot.receita > 0.1) fatores.push({ pontos: -2 * tot.receitaSemCusto / tot.receita, texto: fmtPct(tot.receitaSemCusto / tot.receita) + ' do faturamento sem custo cadastrado' });
    if (anterior.total && proj !== null && proj < anterior.total * 0.9) fatores.push({ pontos: -1, texto: 'vendas ' + (emAndamento ? 'projetadas ' : '') + fmtPct(proj / anterior.total - 1) + ' em relação ao mês anterior' });
    if (ads.gasto && ads.vendas && ads.gasto / ads.vendas > 0.15) fatores.push({ pontos: -1, texto: 'Shopee Ads levando ' + fmtPct(ads.gasto / ads.vendas) + ' das vendas que trouxe' });
    var nota = Math.max(0, Math.min(10, 10 + fatores.reduce(function (s, f) { return s + f.pontos; }, 0)));

    var destaques = linhas.filter(function (g) { return g.lucro !== null && g.lucro > 0; }).sort(function (a, b) { return b.lucro - a.lucro; }).slice(0, 5);
    var plano = itens.slice(0, 6).map(function (i) { return i.acao; });
    if (tot.semCusto.length) plano.push('Cadastre o custo de ' + tot.semCusto.length + ' produto(s) na aba Lucro real (' + fmtMoney(tot.receitaSemCusto) + ' em vendas sem lucro conhecido).');
    if (adsProd) adsProd.linhas.filter(function (a) { return a.decisao === 'aumentar'; }).slice(0, 2).forEach(function (a) { plano.push('Aumente o orçamento do Ads de ' + curto(a.titulo) + ': o Ads leva ' + fmtPct(a.acos) + ' e a margem é ' + fmtPct(a.margem) + '.'); });
    if (destaques[0]) plano.push('Garanta estoque de ' + curto(destaques[0].titulo) + ', o produto que mais deu lucro (' + fmtMoney(destaques[0].lucro) + ').');

    return {
      mes: mes, emAndamento: emAndamento, vendas: vendas, anterior: anterior, projecao: proj, lucro: tot.lucro, lucroAposAds: lucroAposAds,
      receitaComCusto: tot.receitaComCusto, receitaSemCusto: tot.receitaSemCusto, margem: margem, ads: ads,
      nota: Math.round(nota * 10) / 10, fatores: fatores, itens: itens, emJogo: emJogo, destaques: destaques, plano: plano
    };
  }

  function renderRelatorioTab(wrap) {
    var meses = mesesComVendas();
    if (!meses.length) { wrap.appendChild(el('div', { class: 'pml-card' }, [el('div', { class: 'pml-empty', text: 'O relatório aparece quando houver vendas sincronizadas.' })])); return; }
    var mes = meses.indexOf(state.relMes) !== -1 ? state.relMes : meses[0];
    var r = calcRelatorioMes(mes);
    function nomeMes(m) { var p = m.split('-'); var s = new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }

    var sel = el('select', { onchange: function () { state.relMes = sel.value; render(); } }, meses.map(function (m) { var o = el('option', { value: m, text: nomeMes(m) }); if (m === mes) o.setAttribute('selected', ''); return o; }));
    var topo = el('div', { class: 'rel-topo' }, [
      el('div', {}, [el('h2', { text: 'Relatório de ' + nomeMes(mes) }), el('p', { class: 'pml-margin', text: r.emAndamento ? 'Mês em andamento: números até hoje, com projeção para o mês inteiro.' : 'Mês fechado.' })]),
      el('div', { class: 'rel-acoes' }, [sel, el('button', { class: 'pml-btn', text: 'Salvar em PDF', onclick: function () { window.print(); } })])
    ]);
    wrap.appendChild(topo);

    var notaCls = r.nota >= 8 ? 'pos' : (r.nota >= 5 ? '' : 'neg');
    var cardNota = el('div', { class: 'pml-card rel-nota' }, [
      el('div', { class: 'rel-nota-num ' + notaCls, text: r.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }),
      el('div', {}, [
        el('p', { class: 'pml-section-title', style: 'margin:0 0 6px;', text: 'Nota da loja' }),
        el('div', { class: 'pml-margin', html: r.fatores.length ? 'Começa em 10 e perde pontos por: ' + r.fatores.map(function (f) { return f.texto + ' (' + f.pontos.toFixed(1).replace('.', ',') + ')'; }).join('; ') + '.' : 'Nada puxou a nota para baixo neste mês. 👏' })
      ])
    ]);
    wrap.appendChild(cardNota);

    var variacao = r.anterior.total ? (r.emAndamento ? r.projecao : r.vendas.total) / r.anterior.total - 1 : null;
    wrap.appendChild(el('div', { class: 'pml-metrics' }, [
      metricaFicha('Faturamento', fmtMoney(r.vendas.total), r.vendas.pedidos + ' pedidos' + (r.emAndamento && r.projecao ? ' · projeção ' + fmtMoney(r.projecao) : '')),
      metricaFicha('Contra o mês anterior', variacao === null ? '—' : (variacao >= 0 ? '+' : '') + fmtPct(variacao), r.anterior.total ? 'mês anterior: ' + fmtMoney(r.anterior.total) : (r.anterior.completo ? 'sem vendas no mês anterior' : 'o painel ainda não tem o mês anterior inteiro'), variacao === null ? '' : (variacao >= 0 ? 'pos' : 'neg')),
      metricaFicha('Lucro real', r.receitaComCusto ? fmtMoney(r.lucroAposAds) : '—', r.receitaComCusto ? 'margem ' + fmtPct(r.margem) + ', já sem imposto e Ads (produtos com custo)' : 'cadastre os custos para ver', r.receitaComCusto ? (r.lucroAposAds >= 0 ? 'pos' : 'neg') : ''),
      metricaFicha('Shopee Ads', fmtMoney(r.ads.gasto), r.ads.gasto ? 'trouxe ' + fmtMoney(r.ads.vendas) + (r.ads.dias < intervaloMes(mes).diasNoMes && !r.emAndamento ? ' (só ' + r.ads.dias + ' dias com dados)' : '') : 'sem gasto registrado')
    ]));

    var cardProb = el('div', { class: 'pml-card' });
    cardProb.appendChild(el('p', { class: 'pml-section-title', text: r.emJogo > 0 ? 'Problemas e oportunidades: ' + fmtMoney(r.emJogo) + ' em jogo' : 'Problemas e oportunidades' }));
    if (!r.itens.length) cardProb.appendChild(el('div', { class: 'pml-empty', text: 'Nenhum vazamento encontrado com os dados que existem.' }));
    r.itens.forEach(function (i) {
      cardProb.appendChild(el('div', { class: 'rel-item' }, [el('span', { class: 'rel-valor', text: i.valor > 0 ? fmtMoney(i.valor) : '—' }), el('span', { html: i.texto })]));
    });
    if (r.receitaSemCusto > 0) cardProb.appendChild(el('p', { class: 'pml-note', text: fmtMoney(r.receitaSemCusto) + ' em vendas de produtos sem custo cadastrado ficaram fora destas contas.' }));
    wrap.appendChild(cardProb);

    if (r.destaques.length) {
      var cardTop = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Quem mais deu lucro' })]);
      r.destaques.forEach(function (g, k) {
        cardTop.appendChild(el('div', { class: 'rel-item' }, [el('span', { class: 'rel-valor', style: 'color:var(--good);', text: fmtMoney(g.lucro) }), el('span', { text: (k + 1) + '. ' + g.titulo + ' · ' + g.unidades + ' un. · margem ' + fmtPct(g.margem) })]));
      });
      wrap.appendChild(cardTop);
    }

    var cardPlano = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Plano para os próximos 30 dias' })]);
    var ol = el('ol', { class: 'rel-plano' });
    (r.plano.length ? r.plano : ['Continue assim: nenhum ajuste urgente apareceu nos dados.']).forEach(function (p) { ol.appendChild(el('li', { text: p })); });
    cardPlano.appendChild(ol);
    wrap.appendChild(cardPlano);
  }
