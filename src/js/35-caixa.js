  // ===================== PREVISAO DE CAIXA =====================
  // Quanto vai ter no dia X: saldo do Mercado Pago (relatorio de liberacoes) + o que ainda vai liberar
  // (ML: data de liberacao de cada venda; Shopee: pedido nao concluido, ~10 dias depois da compra,
  // a mediana do relatorio de renda) - contas que vencem (aba Contas, ainda nao pagas).

  var SHOPEE_DIAS_LIBERAR = 10;

  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDia(d); }

  function calcCaixa(dias) {
    dias = dias || 30;
    var hoje = isoHoje(0), fim = addDias(hoje, dias - 1);
    var L = state.liberacoes || {};
    var saldo = L.saldo ? Number(L.saldo.valor) || 0 : null;
    var mov = {};   // dia -> { entra, sai, itens: [] }
    function lanca(dia, valor, nome, tipo) {
      if (dia < hoje) dia = hoje;            // atrasado: conta para hoje
      if (dia > fim || !valor) return;
      var m = mov[dia] || (mov[dia] = { entra: 0, sai: 0, itens: [] });
      if (tipo === 'entra') m.entra += valor; else m.sai += valor;
      m.itens.push({ nome: nome, valor: valor, tipo: tipo });
    }
    var mlPend = 0, spPend = 0;
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda') return;
      if (t.custosMl) {
        var c = t.custosMl;
        if (!c.libera_em || liberacaoDoPedido(t)) return;          // ja caiu na conta
        var v = Number(c.liquido_recebido) || 0;
        if (v <= 0 || c.libera_em < addDias(hoje, -7)) return;      // antigo demais: ja deve ter caido
        mlPend += v; lanca(c.libera_em, v, 'Mercado Livre', 'entra');
      } else if (t.custosShopee && /^api-shopee-/.test(t.origemId || '')) {
        var st = String((t.custosShopee && t.custosShopee.status) || t.status || '');
        if (st === 'COMPLETED') return;
        var s = Number(t.custosShopee.liquido_recebido) || 0;
        if (s <= 0 || t.data < addDias(hoje, -30)) return;
        spPend += s; lanca(addDias(t.data, SHOPEE_DIAS_LIBERAR), s, 'Shopee', 'entra');
      }
    });
    var contas = [];
    [hoje.slice(0, 7), somaMes(hoje.slice(0, 7), 1), somaMes(hoje.slice(0, 7), 2)].forEach(function (m) {
      contasDoMes(m).forEach(function (l) {
        if (l.pago || l.vence > fim) return;
        contas.push(l); lanca(l.vence, l.valor, l.nome, 'sai');
      });
    });
    var serie = [], acum = saldo || 0, menor = null, entra = 0, sai = 0;
    for (var i = 0; i < dias; i++) {
      var d = addDias(hoje, i), m = mov[d] || { entra: 0, sai: 0, itens: [] };
      acum += m.entra - m.sai; entra += m.entra; sai += m.sai;
      var linha = { dia: d, entra: m.entra, sai: m.sai, saldo: acum, itens: m.itens };
      serie.push(linha);
      if (!menor || acum < menor.saldo) menor = linha;
    }
    return { saldo: saldo, saldoEm: L.saldo ? L.saldo.em : null, entra: entra, sai: sai, final: acum, menor: menor,
      serie: serie, mlPend: mlPend, spPend: spPend, contas: contas, dias: dias };
  }

  function renderCaixaCard(wrap) {
    var c = calcCaixa(30);
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Previsão de caixa: próximos 30 dias' })]);
    if (c.saldo === null) {
      card.appendChild(el('p', { class: 'pml-note', text: 'Falta o saldo do Mercado Pago (vem do relatório de liberações da automação). Assim que ele chegar, a previsão aparece aqui.' }));
      wrap.appendChild(card); return;
    }
    var kpis = el('div', { class: 'pml-metrics' });
    [['Saldo hoje no Mercado Pago', c.saldo, 'em ' + String(c.saldoEm || '').slice(0, 10).split('-').reverse().join('/')],
      ['Vai entrar', c.entra, 'ML ' + fmtMoney(c.mlPend) + ' · Shopee ' + fmtMoney(c.spPend)],
      ['Vai sair (contas)', -c.sai, c.contas.length + ' conta(s) a pagar'],
      ['Saldo em 30 dias', c.final, 'se nada mudar']].forEach(function (k) {
      kpis.appendChild(el('div', { class: 'pml-metric' }, [el('div', { class: 'pml-metric-label', text: k[0] }),
        el('div', { class: 'pml-metric-value' + (k[1] < 0 ? ' neg' : ''), text: (k[1] < 0 ? '− ' : '') + fmtMoney(Math.abs(k[1])) }),
        el('div', { class: 'pml-margin', text: k[2] })]));
    });
    card.appendChild(kpis);
    var m = c.menor;
    var aviso = m.saldo < 0
      ? 'Atenção: no dia ' + m.dia.split('-').reverse().slice(0, 2).join('/') + ' o saldo fica em ' + fmtMoney(m.saldo) + '. Se precisar antecipar, antecipe só o que falta, perto desse dia (antecipação custa caro).'
      : 'O saldo não fica negativo nos próximos 30 dias: não precisa antecipar. O menor saldo é ' + fmtMoney(m.saldo) + ' no dia ' + m.dia.split('-').reverse().slice(0, 2).join('/') + '.';
    card.appendChild(el('p', { class: 'pml-note', style: 'font-weight:600; color:' + (m.saldo < 0 ? 'var(--bad)' : 'var(--good)'), text: aviso }));
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Dia', 'Entra', 'Sai', 'Saldo previsto', 'O quê'].map(function (h, i) { return el('th', { class: i && i < 4 ? 'num' : '', text: h }); })));
    c.serie.filter(function (s) { return s.entra || s.sai; }).forEach(function (s) {
      var oque = {};
      s.itens.forEach(function (i) { var k = i.tipo === 'entra' ? i.nome : i.nome; oque[k] = (oque[k] || 0) + i.valor; });
      t.appendChild(el('tr', {}, [
        el('td', { text: s.dia.split('-').reverse().slice(0, 2).join('/') }),
        el('td', { class: 'num', style: 'color:var(--good)', text: s.entra ? fmtMoney(s.entra) : '' }),
        el('td', { class: 'num', style: 'color:var(--bad)', text: s.sai ? fmtMoney(s.sai) : '' }),
        el('td', { class: 'num', style: 'font-weight:700;' + (s.saldo < 0 ? 'color:var(--bad)' : ''), text: fmtMoney(s.saldo) }),
        el('td', { class: 'pml-margin', text: Object.keys(oque).map(function (k) { return k + ' ' + fmtMoney(oque[k]); }).join(' · ') })
      ]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    card.appendChild(el('p', { class: 'pml-note', text: 'Mercado Livre: data de liberação de cada venda, informada pelo Mercado Pago. Shopee: pedido ainda não concluído, previsto para ' + SHOPEE_DIAS_LIBERAR + ' dias depois da compra (o tempo normal nos seus pedidos). Contas: as não pagas da aba Contas, empresa e CPF. O saldo é só o do Mercado Pago; dinheiro no banco não entra.' }));
    wrap.appendChild(card);
  }
