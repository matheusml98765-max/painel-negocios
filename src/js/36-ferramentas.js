  // ===================== AUDITOR, FAIXA DE PRECO E RANKING =====================

  // ---- Auditor de cobrancas (ML): o que devia cair x o que caiu de verdade ----
  // devia = venda - comissao - frete do vendedor (o "Total recebido" do resumo da venda).
  // caiu  = relatorio de liberacoes do Mercado Pago (pagamento + frete devolvido), sem devolucoes.
  function calcAuditoria(dias) {
    var lim = limiteDias(dias || 60), r = [];
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !t.custosMl || t.data < lim) return;
      var l = liberacaoDoPedido(t);
      if (!l || Math.abs(Number(l.devolucao) || 0) > 0.005) return;   // nao liberada ou com devolucao (outra conta)
      var c = t.custosMl, devia = round2((Number(t.valor) || 0) - (Number(c.comissao) || 0) - (Number(c.frete) || 0));
      var caiu = round2(Number(l.liquido) || 0), dif = round2(caiu - devia);
      if (dif < -0.5) r.push({ pedido: pedidoMlDe(t), data: t.data, titulo: ((t.itens || [])[0] || {}).titulo || '', valor: t.valor, devia: devia, caiu: caiu, dif: dif });
    });
    r.sort(function (a, b) { return a.dif - b.dif; });
    return { lista: r, total: r.reduce(function (s, x) { return s + x.dif; }, 0) };
  }

  function renderAuditoriaCard(wrap) {
    if (!state.liberacoes || !state.liberacoes.pedidos) return;
    var a = calcAuditoria(60);
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Auditor de cobranças (Mercado Livre, 60 dias)' })]);
    if (!a.lista.length) {
      card.appendChild(el('p', { class: 'pml-note', style: 'color:var(--good); font-weight:600;', text: 'Tudo certo: em todas as vendas liberadas caiu o que o resumo da venda prometia (venda − comissão − frete).' }));
      wrap.appendChild(card); return;
    }
    card.appendChild(el('p', { class: 'pml-margin', style: 'margin:0 0 8px;', text: a.lista.length + ' venda(s) em que caiu menos do que o prometido, ' + fmtMoney(-a.total) + ' no total. Pode ser parcelamento sem juros pago por você, tarifa extra ou cobrança errada: abra o pedido no ML e, se não tiver explicação, peça revisão.' }));
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Pedido', 'Produto', 'Devia cair', 'Caiu', 'Diferença'].map(function (h, i) { return el('th', { class: i > 1 ? 'num' : '', text: h }); })));
    a.lista.slice(0, 15).forEach(function (x) {
      t.appendChild(el('tr', {}, [el('td', { text: x.pedido + ' · ' + x.data.split('-').reverse().slice(0, 2).join('/') }), el('td', { text: String(x.titulo).slice(0, 40) }),
        el('td', { class: 'num', text: fmtMoney(x.devia) }), el('td', { class: 'num', text: fmtMoney(x.caiu) }),
        el('td', { class: 'num', style: 'color:var(--bad); font-weight:700;', text: fmtMoney(x.dif) })]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    wrap.appendChild(card);
  }

  // ---- Preco na faixa errada (ML): logo acima de R$ 79 voce paga o frete gratis ----
  var LIMITE_FRETE_ML = 79, PRECO_SUGERIDO = 78.9;
  function calcFaixaPreco(dias) {
    var lim = limiteDias(dias || 60), itens = {}, baratos = [];
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !t.custosMl || t.data < lim || !Array.isArray(t.itens) || t.itens.length !== 1) return;
      var i = t.itens[0], q = Number(i.quantidade) || 1, p = Number(i.preco_unitario) || (t.valor / q);
      var c = t.custosMl, fr = Number(c.frete) || 0;
      if (p < LIMITE_FRETE_ML) { baratos.push(fr / q); return; }
      if (p > 95 || q !== 1) return;
      var g = itens[i.item_id] || (itens[i.item_id] = { itemId: i.item_id, titulo: i.titulo, n: 0, preco: 0, frete: 0, comissao: 0 });
      g.n++; g.preco += p; g.frete += fr; g.comissao += Number(c.comissao) || 0;
    });
    baratos.sort(function (a, b) { return a - b; });
    var freteBarato = baratos.length ? baratos[Math.floor(baratos.length / 2)] : 0;
    var lista = Object.keys(itens).map(function (k) {
      var g = itens[k], preco = g.preco / g.n, frete = g.frete / g.n, taxa = g.comissao / g.preco;
      var ganho = (frete - freteBarato) - (preco - PRECO_SUGERIDO) * (1 - taxa);
      return { itemId: g.itemId, titulo: g.titulo, vendas: g.n, preco: preco, frete: frete, freteBarato: freteBarato, ganho: ganho };
    }).filter(function (x) { return x.ganho > 0.5 && x.frete >= 8; }).sort(function (a, b) { return b.ganho * b.vendas - a.ganho * a.vendas; });
    return { lista: lista, freteBarato: freteBarato, amostra: baratos.length };
  }

  function renderFaixaPrecoCard(wrap) {
    var f = calcFaixaPreco(60);
    if (!f.lista.length) return;
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Preço logo acima de R$ 79: o frete grátis sai do seu bolso' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 8px;', text: 'A partir de R$ 79 o ML obriga frete grátis e cobra de você. Abaixo disso, nas suas vendas o frete saiu em média ' + fmtMoney(f.freteBarato) + ' (' + f.amostra + ' vendas). Simulação baixando para ' + fmtMoney(PRECO_SUGERIDO) + ', com a mesma comissão:' })]);
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Produto', 'Vendas (60 d)', 'Preço hoje', 'Frete que você paga', 'Ganho por venda a R$ 78,90'].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); })));
    f.lista.forEach(function (x) {
      t.appendChild(el('tr', {}, [el('td', { text: String(x.titulo || x.itemId).slice(0, 45) }), el('td', { class: 'num', text: String(x.vendas) }),
        el('td', { class: 'num', text: fmtMoney(x.preco) }), el('td', { class: 'num', text: fmtMoney(x.frete) }),
        el('td', { class: 'num', style: 'color:var(--good); font-weight:700;', text: '+' + fmtMoney(x.ganho) + ' (+' + fmtMoney(x.ganho * x.vendas) + ' em 60 d)' })]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    card.appendChild(el('p', { class: 'pml-note', text: 'Abaixo de R$ 79 o comprador passa a pagar parte do frete, então a conversão pode cair um pouco. Teste num anúncio e compare as vendas da semana.' }));
    wrap.appendChild(card);
  }

  // ---- Lucro de verdade por anuncio (depois do Ads), com o que fazer: colunas da tabela Lucro por produto ----
  function calcRanking(dias, plat) {
    var ads = calcAdsPorProduto(plat || 'todas'), gasto = {}, decAds = {};
    ((ads && ads.linhas) || []).forEach(function (x) {
      var k = String(x.itemId).toUpperCase();
      gasto[k] = (gasto[k] || 0) + x.gasto * (dias / (ads.dias || 30));
      decAds[k] = x.decisao;   // a mesma decisao do quadro de Ads (ACOS x margem), para os dois nao se contradizerem
    });
    return calcLucroPorProduto(dias, plat || 'todas').linhas.filter(function (g) { return g.lucro !== null && g.unidades > 0; }).map(function (g) {
      var a = gasto[String(g.itemId).toUpperCase()] || 0, real = g.lucro - a, margem = g.receita ? real / g.receita : 0;
      var acao, dA = decAds[String(g.itemId).toUpperCase()];
      if (real < 0) acao = a > 0 && g.lucro > 0 ? 'baixar Ads' : 'subir preço ou pausar';
      else if (a > 0 && dA === 'pausar') acao = 'baixar Ads';
      else if (margem < 0.08) acao = 'subir preço';
      else if (margem >= 0.2 && g.unidades >= 5) acao = 'escalar';
      else acao = 'manter';
      return { itemId: g.itemId, plataforma: g.plataforma, titulo: g.titulo, unidades: g.unidades, receita: g.receita, lucro: g.lucro, ads: a, real: real, margem: margem, acao: acao };
    }).sort(function (a, b) { return b.real - a.real; });
  }

  var COR_ACAO = { 'escalar': 'var(--good)', 'manter': 'var(--muted)', 'subir preço': 'var(--warn)', 'baixar Ads': 'var(--warn)', 'subir preço ou pausar': 'var(--bad)' };
