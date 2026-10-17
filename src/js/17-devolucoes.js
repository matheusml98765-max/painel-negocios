  // ===================== DEVOLUCOES E CANCELAMENTOS =====================
  // Dados de devolucoes.json (automacao): devolucoes da Shopee com motivo, cancelamentos do ML,
  // tarifas de devolucao da fatura do ML e ajustes de estoque no Full.

  function devolucoesNoPeriodo(dias) {
    var d = state.devolucoes;
    if (!d || !Array.isArray(d.itens)) return null;
    var lim = limiteDias(dias);
    return d.itens.filter(function (x) { return String(x.data || '').slice(0, 10) >= lim; });
  }

  // Tarifas de devolucao do ML por anuncio (entram no lucro real do produto).
  function tarifasDevolucaoPorItem(de, ate) {
    var d = state.devolucoes, r = {};
    if (!d || !Array.isArray(d.itens)) return r;
    d.itens.forEach(function (x) {
      var dia = String(x.data || '').slice(0, 10);
      if (x.tipo !== 'custo_devolucao' || dia < de || (ate && dia > ate)) return;
      var it = (x.itens || [])[0];
      if (!it || !it.item_id) return;
      var id = String(it.item_id).toUpperCase();
      r[id] = (r[id] || 0) + (Number(x.custo) || 0);
    });
    return r;
  }

  var TIPOS_FULL = {
    ADJUSTMENT: 'Ajuste feito pelo ML', LOST_REFUND: 'Perdido pelo ML (reembolsado)', QUARANTINE_RESTOCK: 'Voltou da quarentena',
    QUARANTINE: 'Em quarentena (avaria ou inspeção)', WITHDRAWAL_DELIVERY: 'Retirada do Full', SALE_DELIVERY_CANCELATION: 'Venda cancelada voltou ao estoque',
    FISCAL_COVERAGE_ADJUSTMENT: 'Ajuste fiscal', DISPOSAL: 'Descartado', DISCARD: 'Descartado', DAMAGED: 'Avariado'
  };
  function nomeTipoFull(t) { return TIPOS_FULL[t] || String(t || '').replace(/_/g, ' ').toLowerCase(); }

  function calcDevolucoes(dias) {
    var lista = devolucoesNoPeriodo(dias);
    if (!lista) return null;
    // Pedido de devolucao que o comprador desistiu ou foi recusado (CANCELLED) nao conta
    lista = lista.filter(function (x) { return !(x.tipo === 'devolucao' && x.status === 'CANCELLED'); });
    var res = { lista: lista, devolucoes: 0, cancelamentos: 0, reembolsado: 0, cancelado: 0, tarifas: 0, quebradas: 0, perdaPecas: 0, semCusto: 0, motivos: {}, produtos: {} };
    lista.forEach(function (x) {
      if (x.tipo === 'custo_devolucao') res.tarifas += Number(x.custo) || 0;
      else if (x.tipo === 'devolucao') res.devolucoes++;
      else if (x.tipo === 'cancelamento') res.cancelamentos++;
      if (x.tipo === 'devolucao') res.reembolsado += Number(x.reembolso) || 0;
      if (x.tipo === 'cancelamento' && x.entregue) res.canceladosEntregues = (res.canceladosEntregues || 0) + 1;
      if (x.tipo === 'cancelamento') res.cancelado += (x.itens || []).reduce(function (t, it) { return t + (Number(it.preco) || 0) * (Number(it.quantidade) || 1); }, 0);
      if (x.tipo !== 'custo_devolucao') {
        var m = res.motivos[x.motivo] || (res.motivos[x.motivo] = { n: 0, valor: 0 });
        m.n++; m.valor += Number(x.reembolso) || 0;
      }
      (x.itens || []).forEach(function (it) {
        var id = String(it.item_id || '').toUpperCase();
        var p = res.produtos[id] || (res.produtos[id] = { itemId: id, plataforma: x.plataforma, titulo: it.titulo || id, devolucoes: 0, cancelamentos: 0, quebradas: 0, reembolso: 0, tarifas: 0, perda: 0 });
        var qtd = Number(it.quantidade) || 1;
        if (x.tipo === 'devolucao') p.devolucoes += qtd;
        if (x.tipo === 'cancelamento') p.cancelamentos += qtd;
        if (x.tipo === 'custo_devolucao') p.tarifas += Number(x.custo) || 0;
        else p.reembolso += (Number(it.preco) || 0) * qtd;
        if (x.quebrado && !x.coberto_pelo_ml) {
          p.quebradas += qtd; res.quebradas += qtd;
          var c = custoDoItem(id);
          if (c) { p.perda += c.valor * qtd; res.perdaPecas += c.valor * qtd; } else res.semCusto += qtd;
        }
      });
    });
    res.listaProdutos = Object.keys(res.produtos).map(function (k) { return res.produtos[k]; })
      .sort(function (a, b) { return (b.quebradas - a.quebradas) || (b.devolucoes + b.cancelamentos - a.devolucoes - a.cancelamentos); });
    res.listaMotivos = Object.keys(res.motivos).map(function (k) { return { motivo: k, n: res.motivos[k].n, valor: res.motivos[k].valor }; })
      .sort(function (a, b) { return b.n - a.n; });
    // Full: so o que mexe no seu estoque (reservas e transferencias internas do ML ficam de fora)
    res.full = ((state.devolucoes && state.devolucoes.full_ajustes) || []).filter(function (f) {
      return String(f.data || '').slice(0, 10) >= limiteDias(dias) && !/_RESERVATION$/.test(f.tipo || '') && !/^TRANSFER_/.test(f.tipo || '');
    });
    return res;
  }

  function renderDevolucoesCard(wrap, dias) {
    var r = calcDevolucoes(dias);
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Devoluções, cancelamentos e perdas (' + dias + ' dias)' }));
    if (!r) {
      card.appendChild(el('div', { class: 'pml-empty', text: 'Os dados de devoluções chegam pela automação (a cada 3 horas). Abra o painel de novo daqui a pouco.' }));
      wrap.appendChild(card);
      return;
    }
    card.appendChild(el('div', { class: 'pml-metrics', style: 'margin-bottom:14px;' }, [
      metricaFicha('Devoluções', String(r.devolucoes), 'pedidos que o comprador devolveu'),
      metricaFicha('Reembolsado em devoluções', fmtMoney(r.reembolsado), 'já sai do valor que você recebe', 'neg'),
      metricaFicha('Vendas canceladas', fmtMoney(r.cancelado), r.cancelamentos + ' pedido(s)' + (r.canceladosEntregues ? ', ' + r.canceladosEntregues + ' depois da entrega' : ', nenhum depois da entrega')),
      metricaFicha('Chegaram quebradas', r.quebradas + ' un.', r.perdaPecas ? 'perda de ' + fmtMoney(r.perdaPecas) + ' em peças' + (r.semCusto ? ' (+' + r.semCusto + ' sem custo)' : '') : (r.semCusto ? 'cadastre o custo para ver a perda' : 'nenhuma'), r.quebradas ? 'neg' : 'pos'),
      metricaFicha('Tarifas de devolução (ML)', fmtMoney(r.tarifas), 'cobradas na fatura; já descontadas do lucro')
    ]));

    var dicas = [];
    var pior = r.listaProdutos.filter(function (p) { return p.quebradas > 0; })[0];
    if (pior) dicas.push('📦 <b>' + pior.titulo + '</b> teve <b>' + pior.quebradas + ' unidade(s) que chegaram quebradas</b>' + (pior.perda ? ' (' + fmtMoney(pior.perda) + ' em peças perdidas)' : '') + '. Vale reforçar a embalagem desse produto (plástico bolha, caixa mais firme ou calço).');
    var perdidos = r.full.filter(function (f) { return f.tipo === 'LOST_REFUND'; }).length;
    if (r.full.length) dicas.push('🏭 O Full registrou <b>' + r.full.length + ' mudança(s) no seu estoque</b> fora de venda e entrada' + (perdidos ? ', incluindo ' + perdidos + ' unidade(s) perdida(s) pelo ML (reembolsada)' : '') + '. Confira abaixo se cada ajuste foi reembolsado.');
    if (dicas.length) card.appendChild(el('div', { class: 'pml-dica', style: 'margin-bottom:14px;', html: dicas.join('<br>') }));

    if (r.listaMotivos.length) {
      card.appendChild(el('h4', { class: 'ficha-sub', text: 'Por que voltaram' }));
      var max = r.listaMotivos[0].n;
      r.listaMotivos.forEach(function (m) {
        card.appendChild(el('div', { class: 'dev-motivo' }, [
          el('span', { text: m.motivo }),
          el('div', { class: 'pml-barra' }, [el('span', { style: 'width:' + (m.n / max * 100).toFixed(0) + '%' })]),
          el('b', { text: m.n + '× · ' + fmtMoney(m.valor) })
        ]));
      });
    }

    if (r.listaProdutos.length) {
      card.appendChild(el('h4', { class: 'ficha-sub', text: 'Por produto' }));
      var t = el('table', { class: 'pml-table' });
      t.appendChild(el('tr', {}, [el('th', { text: 'Produto' }), el('th', { class: 'num', text: 'Devolvidas' }), el('th', { class: 'num', text: 'Canceladas' }), el('th', { class: 'num', text: 'Quebradas' }), el('th', { class: 'num', text: 'Valor dos pedidos' }), el('th', { class: 'num', text: 'Tarifas' }), el('th', { class: 'num', text: 'Perda em peças' })]));
      r.listaProdutos.forEach(function (p) {
        t.appendChild(el('tr', { class: p.quebradas ? 'pml-row-alerta' : '' }, [
          el('td', {}, [el('button', { class: 'pml-link-prod', text: p.titulo, onclick: function () { state.tab = 'lucro'; abrirFichaProduto(p.itemId); } }), el('div', { class: 'pml-margin', text: (p.plataforma === 'ml' ? 'Mercado Livre ' : 'Shopee ') + p.itemId })]),
          el('td', { class: 'num', text: String(p.devolucoes) }), el('td', { class: 'num', text: String(p.cancelamentos) }),
          el('td', { class: 'num', style: p.quebradas ? 'color:var(--bad); font-weight:700;' : '', text: String(p.quebradas) }),
          el('td', { class: 'num', text: fmtMoney(p.reembolso) }), el('td', { class: 'num', text: p.tarifas ? fmtMoney(p.tarifas) : '—' }),
          el('td', { class: 'num', text: p.quebradas ? (custoDoItem(p.itemId) ? fmtMoney(p.perda) : 'sem custo') : '—' })
        ]));
      });
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    }

    var det = el('details', { class: 'pml-fat-cat' }, [el('summary', { text: 'Ver cada devolução e cancelamento (' + r.lista.length + ')' })]);
    var t2 = el('table', { class: 'pml-table' });
    r.lista.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }).forEach(function (x) {
      var it = (x.itens || [])[0] || {};
      var valor = x.tipo === 'custo_devolucao' ? Number(x.custo) || 0 : Number(x.reembolso) || 0;
      t2.appendChild(el('tr', {}, [
        el('td', { text: String(x.data || '').slice(8, 10) + '/' + String(x.data || '').slice(5, 7) }),
        el('td', {}, [el('div', { class: 'pml-titulo-prod', text: it.titulo || '—' }), el('div', { class: 'pml-margin', text: (x.plataforma === 'ml' ? 'ML' : 'Shopee') + ' · pedido ' + x.pedido })]),
        el('td', {}, [el('div', { text: x.motivo || '' }), x.texto && x.plataforma === 'shopee' ? el('div', { class: 'pml-margin', text: '“' + x.texto + '”' }) : null, x.coberto_pelo_ml ? el('div', { class: 'pml-margin', style: 'color:var(--good);', text: 'O ML cobriu o custo (sem perda para você)' }) : null, x.status === 'CANCELLED' && x.plataforma === 'ml' ? el('div', { class: 'pml-margin', style: 'color:var(--good);', text: 'Decidido a seu favor' }) : null]),
        el('td', { class: 'num', text: fmtMoney(valor) })
      ]));
    });
    det.appendChild(el('div', { class: 'pml-scroll' }, [t2]));
    card.appendChild(det);

    if (r.full.length) {
      var dFull = el('details', { class: 'pml-fat-cat' }, [el('summary', { text: 'Ajustes de estoque no Full (' + r.full.length + ')' })]);
      r.full.forEach(function (f) {
        var ind = (f.indisponivel || []).map(function (n) { return n.quantidade + ' ' + n.motivo; }).join(', ');
        dFull.appendChild(el('div', { class: 'pml-fat-linha' }, [el('span', { text: String(f.data || '').slice(8, 10) + '/' + String(f.data || '').slice(5, 7) + ' · ' + (f.titulo || f.item_id) + ' · ' + nomeTipoFull(f.tipo) + (ind ? ' (' + ind + ')' : '') }), el('span', { text: (f.quantidade > 0 ? '+' : '') + f.quantidade + ' un.' })]));
      });
      card.appendChild(dFull);
    }
    card.appendChild(el('p', { class: 'pml-note', text: 'Na Shopee, o valor devolvido já sai do recebido da venda (por isso já aparece no lucro do produto). Peça que chegou quebrada conta como perda do custo da peça. No ML, as tarifas de devolução da fatura são descontadas do lucro do produto. Reclamação do ML que o ML cobriu ou decidiu a seu favor não conta como perda.' + (state.devolucoes.atualizado_em ? ' Atualizado em ' + new Date(state.devolucoes.atualizado_em).toLocaleString('pt-BR') + '.' : '') }));
    wrap.appendChild(card);
  }
