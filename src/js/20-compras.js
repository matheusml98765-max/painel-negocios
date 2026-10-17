  // ===================== COMPRAS: PAGOU A MAIS OU A MENOS =====================
  // Cada compra (filamento por tipo, insumo por nome) comparada com o preco que valia
  // antes dela (compras dos 30 dias anteriores, a mesma regra usada no custo das vendas).

  function compararCompras() {
    var c = getCalc3d();
    var linhas = [];
    function grupo(lotes, chave, campoQtd, unidade) {
      var porChave = {};
      lotes.forEach(function (l) { var k = chave(l); if (k) (porChave[k] = porChave[k] || []).push(l); });
      Object.keys(porChave).forEach(function (k) {
        var lista = porChave[k].filter(function (l) { return l.data && num(l[campoQtd]) > 0; })
          .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
        lista.forEach(function (l, i) {
          var qtd = num(l[campoQtd]);
          var unit = (num(l.preco) + num(l.frete)) / qtd;
          var antes = lista.slice(0, i).filter(function (x) { return x.data < l.data; });
          var ref = antes.length ? precoMedioLotes(lotesDoPeriodo(antes, null), campoQtd, 1) : null;
          linhas.push({
            data: l.data, item: k, descricao: l.descricao || l.nome || k, qtd: qtd, unidade: unidade,
            pago: num(l.preco) + num(l.frete), unit: unit, ref: ref,
            difUnit: ref === null ? null : unit - ref,
            difTotal: ref === null ? null : (unit - ref) * qtd
          });
        });
      });
    }
    grupo(c.filamentos, function (l) { return 'Filamento ' + (l.tipo || '').toUpperCase(); }, 'kg', 'kg');
    grupo(c.embalagens, function (l) { return l.nome; }, 'qtd', 'un');
    linhas.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });

    function agrupar(chave) {
      var g = {};
      linhas.forEach(function (x) {
        var k = chave(x.data);
        var r = g[k] || (g[k] = { mes: k, gasto: 0, aMais: 0, aMenos: 0, compras: 0, itens: [] });
        r.gasto += x.pago; r.compras += 1; r.itens.push(x);
        if (x.difTotal !== null) { if (x.difTotal > 0) r.aMais += x.difTotal; else r.aMenos += -x.difTotal; }
      });
      return Object.keys(g).sort().reverse().map(function (k) { return g[k]; });
    }
    return {
      linhas: linhas,
      meses: agrupar(function (d) { return d.slice(0, 7); }),
      semanas: agrupar(inicioSemana)
    };
  }

  // Segunda-feira da semana da data (AAAA-MM-DD)
  function inicioSemana(data) {
    var d = new Date(data + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  function nomeSemana(seg) {
    var fim = new Date(seg + 'T12:00:00'); fim.setDate(fim.getDate() + 6);
    var f = function (x) { return x.slice(8, 10) + '/' + x.slice(5, 7); };
    var hoje = inicioSemana(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    var ant = new Date(hoje + 'T12:00:00'); ant.setDate(ant.getDate() - 7);
    var rot = seg === hoje ? 'Esta semana' : seg === ant.toISOString().slice(0, 10) ? 'Semana passada' : 'Semana';
    return rot + ' (' + f(seg) + ' a ' + f(fim.toISOString().slice(0, 10)) + ')';
  }

  function nomeMesCurto(m) {
    var n = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return n[Number(m.slice(5, 7)) - 1] + '/' + m.slice(0, 4);
  }

  function renderComprasCard(wrap) {
    var r = compararCompras();
    var card = el('div', { class: 'pml-card' }, [
      el('div', { class: 'pml-card-title', text: 'Suas compras: pagou a mais ou a menos' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 10px;', text: 'Cada compra comparada com o preço que você pagava antes dela (compras dos 30 dias anteriores do mesmo item). O custo de cada venda usa o preço das compras da época dela.' })
    ]);
    if (!r.linhas.length) {
      card.appendChild(el('p', { class: 'pml-margin', text: 'Cadastre as compras de filamento e insumos acima para ver a comparação.' }));
      wrap.appendChild(card);
      return;
    }
    var cor = corDif, sinal = sinalDif;

    var visao = state.comprasVisao || 'semana';
    var grupos = visao === 'semana' ? r.semanas : r.meses;
    card.appendChild(el('div', { style: 'display:flex; gap:6px; margin-bottom:10px;' }, [['semana', 'Por semana'], ['mes', 'Por mês']].map(function (o) {
      return el('button', { class: 'pml-btn' + (visao === o[0] ? '' : ' secondary'), text: o[1], onclick: function () { state.comprasVisao = o[0]; render(); } });
    })));

    // Ultima semana (ou mes) com compras: cada compra e a comparacao dela
    var atual = grupos[0], anterior = grupos[1];
    var saldoAtual = atual.aMais - atual.aMenos;
    var frase = (visao === 'semana' ? nomeSemana(atual.mes) : nomeMesCurto(atual.mes)) + ': ' + atual.compras + (atual.compras === 1 ? ' compra, ' : ' compras, ') + fmtMoney(atual.gasto) + '. ' +
      (atual.aMais || atual.aMenos ? (saldoAtual > 0.005 ? 'Pagou ' + fmtMoney(saldoAtual) + ' a mais que antes.' : saldoAtual < -0.005 ? 'Saiu ' + fmtMoney(-saldoAtual) + ' mais barato que antes.' : 'Mesmo preço de antes.') : 'Sem compra anterior para comparar.');
    if (anterior) {
      var saldoAnt = anterior.aMais - anterior.aMenos;
      frase += ' ' + (visao === 'semana' ? 'Na semana anterior com compras' : 'No mês anterior') + ': ' + (anterior.aMais || anterior.aMenos ? (saldoAnt > 0.005 ? fmtMoney(saldoAnt) + ' a mais.' : saldoAnt < -0.005 ? fmtMoney(-saldoAnt) + ' de economia.' : 'mesmo preço.') : 'sem comparação.');
    }
    card.appendChild(el('div', { class: 'pml-metric-label', style: 'margin:4px 0 6px; font-size:14px; color:' + (saldoAtual > 0.005 ? 'var(--bad)' : saldoAtual < -0.005 ? 'var(--good)' : 'var(--ink)') + ';', text: frase }));
    card.appendChild(tabelaCompras(atual.itens));

    card.appendChild(el('div', { class: 'pml-metric-label', style: 'margin:14px 0 6px;', text: visao === 'semana' ? 'Todas as semanas' : 'Todos os meses' }));
    card.appendChild(el('div', { class: 'pml-table-wrap' }, [el('table', { class: 'pml-table' }, [
      el('thead', {}, [el('tr', {}, [visao === 'semana' ? 'Semana' : 'Mês', 'Compras', 'Gasto', 'Pagou a mais', 'Economizou', 'Saldo'].map(function (h, i) { return el('th', { class: i > 1 ? 'num' : '', text: h }); }))]),
      el('tbody', {}, grupos.map(function (m) {
        var saldo = m.aMais - m.aMenos;
        return el('tr', {}, [
          el('td', { text: visao === 'semana' ? nomeSemana(m.mes) : nomeMesCurto(m.mes) }), el('td', { text: String(m.compras) }),
          el('td', { class: 'num', text: fmtMoney(m.gasto) }),
          el('td', { class: 'num', style: m.aMais ? 'color:var(--bad);' : '', text: m.aMais ? fmtMoney(m.aMais) : '—' }),
          el('td', { class: 'num', style: m.aMenos ? 'color:var(--good);' : '', text: m.aMenos ? fmtMoney(m.aMenos) : '—' }),
          el('td', { class: 'num', style: cor(saldo), text: (m.aMais || m.aMenos) ? sinal(saldo) : '—' })
        ]);
      }))
    ])]));

    var det = el('details', { style: 'margin-top:10px;' }, [el('summary', { text: 'Ver compra por compra (' + r.linhas.length + ')' })]);
    det.appendChild(tabelaCompras(r.linhas));
    card.appendChild(det);
    wrap.appendChild(card);
  }

  function corDif(v) { return v === null ? '' : v > 0.005 ? 'color:var(--bad); font-weight:700;' : v < -0.005 ? 'color:var(--good); font-weight:700;' : ''; }
  function sinalDif(v) { return v === null ? 'primeira compra' : (v > 0.005 ? '+' : v < -0.005 ? '−' : '') + fmtMoney(Math.abs(v)); }

  function tabelaCompras(lista) {
    var cor = corDif, sinal = sinalDif;
    return el('div', { class: 'pml-table-wrap' }, [el('table', { class: 'pml-table' }, [
      el('thead', {}, [el('tr', {}, ['Data', 'Item', 'Qtd', 'Pagou', 'Preço', 'Antes', 'Diferença', 'No total'].map(function (h, i) { return el('th', { class: i > 1 ? 'num' : '', text: h }); }))]),
      el('tbody', {}, lista.map(function (x) {
        var casas = x.unidade === 'kg' ? 2 : 4;
        function fu(v) { return v === null ? '—' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: casas }) + '/' + x.unidade; }
        return el('tr', {}, [
          el('td', { text: x.data.split('-').reverse().join('/') }),
          el('td', { text: x.descricao === x.item ? x.item : x.item + ' · ' + x.descricao }),
          el('td', { class: 'num', text: x.qtd.toLocaleString('pt-BR') + ' ' + x.unidade }),
          el('td', { class: 'num', text: fmtMoney(x.pago) }),
          el('td', { class: 'num', text: fu(x.unit) }),
          el('td', { class: 'num', text: fu(x.ref) }),
          el('td', { class: 'num', style: cor(x.difUnit), text: x.difUnit === null ? '—' : (x.ref ? (x.difUnit > 0 ? '+' : '') + fmtPct(x.difUnit / x.ref) : '—') }),
          el('td', { class: 'num', style: cor(x.difTotal), text: sinal(x.difTotal) })
        ]);
      }))
    ])]);
  }
