  // ===================== PLANO DE IMPRESSAO DO DIA =====================
  // Ritmo de vendas de cada peca 3D (ultimos 14 dias) + estoque pronto (o vendedor informa) +
  // horas das impressoras -> o que imprimir hoje para nao faltar o que mais vende.

  var PLANO_DIAS_COBRIR = 7, PLANO_HORAS_DIA = 20;

  function calcPlanoImpressao() {
    var c = getCalc3d();
    var estoque = c.estoquePecas || {};
    var u = unidadesPorItem(14), porPeca = {};
    Object.keys(u).forEach(function (id) {
      var p = pecaDoItem(id);
      if (p) porPeca[p.id] = (porPeca[p.id] || 0) + u[id];
    });
    var nImp = Math.max(1, (c.impressoras || []).length);
    var capacidade = nImp * PLANO_HORAS_DIA;
    var lista = (c.produtos || []).filter(function (p) { return num(p.horas) > 0 && porPeca[p.id]; }).map(function (p) {
      var ritmo = porPeca[p.id] / 14, tem = num(estoque[p.id]);
      var porPlaca = Math.max(1, num(p.porPlaca) || 1), hPlaca = num(p.horas);
      var precisa = Math.max(0, Math.ceil(ritmo * PLANO_DIAS_COBRIR - tem));
      var placas = Math.ceil(precisa / porPlaca);
      return { id: p.id, nome: p.nome, ritmo: ritmo, estoque: tem, duraDias: ritmo ? tem / ritmo : 99, precisa: precisa,
        placas: placas, horas: placas * hPlaca, porPlaca: porPlaca, hPlaca: hPlaca };
    }).sort(function (a, b) { return a.duraDias - b.duraDias; });
    // Hoje: reparte as horas das impressoras uma placa por vez, pela ordem de urgencia, para nao
    // gastar o dia todo numa peca so e deixar faltar as outras.
    var livre = capacidade, mudou = true;
    lista.forEach(function (x) { x.hojePlacas = 0; });
    while (mudou) {
      mudou = false;
      lista.forEach(function (x) {
        if (x.hojePlacas < x.placas && x.hPlaca > 0 && x.hPlaca <= livre) { x.hojePlacas++; livre -= x.hPlaca; mudou = true; }
      });
    }
    lista.forEach(function (x) { x.hojePecas = x.hojePlacas * x.porPlaca; x.informado = Object.prototype.hasOwnProperty.call(estoque, x.id); });
    return { lista: lista, capacidade: capacidade, usadas: capacidade - livre, impressoras: nImp };
  }

  function renderPlanoImpressaoCard(wrap) {
    var p = calcPlanoImpressao();
    if (!p.lista.length) return;
    var c = getCalc3d();
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Plano de impressão de hoje' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 8px;', text: 'Pelo ritmo de vendas dos últimos 14 dias, para ter ' + PLANO_DIAS_COBRIR + ' dias de estoque. ' + p.impressoras + ' impressoras × ' + PLANO_HORAS_DIA + ' h = ' + p.capacidade + ' h por dia; o plano usa ' + Math.round(p.usadas) + ' h. Informe quantas peças prontas você tem para o plano ficar certo.' })]);
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Peça', 'Vende por dia', 'Prontas', 'Dura', 'Imprimir hoje'].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); })));
    p.lista.forEach(function (x) {
      var inp = el('input', { type: 'number', min: '0', step: '1', value: x.estoque || '', style: 'width:70px;', onchange: function () {
        c.estoquePecas = c.estoquePecas || {}; c.estoquePecas[x.id] = Number(inp.value) || 0; salvarCalc3d(); render();
      } });
      t.appendChild(el('tr', {}, [el('td', { text: x.nome }), el('td', { class: 'num', text: (Math.round(x.ritmo * 10) / 10).toLocaleString('pt-BR') }),
        el('td', { class: 'num' }, [inp]),
        el('td', { class: 'num', style: x.informado && x.duraDias < 3 ? 'color:var(--bad); font-weight:700;' : '', text: !x.informado ? 'informe' : x.duraDias >= 99 ? '—' : Math.floor(x.duraDias) + ' dia(s)' }),
        el('td', { class: 'num', style: 'font-weight:700;', text: x.hojePecas ? x.hojePecas + ' peça(s) · ' + x.hojePlacas + ' placa(s) · ' + (Math.round(x.hojePlacas * x.hPlaca * 10) / 10).toLocaleString('pt-BR') + ' h' : (x.precisa ? 'amanhã' : 'tem estoque') })]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    wrap.appendChild(card);
  }
