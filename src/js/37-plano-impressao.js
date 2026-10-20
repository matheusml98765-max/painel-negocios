  // ===================== PLANO DE IMPRESSAO DO DIA =====================
  // Ritmo de vendas de cada peca 3D por cor (ultimos 14 dias) + pecas prontas (o vendedor conta,
  // e as vendas depois da contagem descontam sozinhas) + horas das impressoras -> o que imprimir hoje.
  // A mesma peca impressa com dupla face ou parafuso ("Suporte secador — dupla face" e "— parafuso")
  // conta como uma so: o estoque e por peca-base e cor.
  // calc3d.estoquePecas = { '<base>|<cor>': qtd }, calc3d.estoquePecasEm = ISO da contagem.

  var PLANO_DIAS_COBRIR = 7, PLANO_HORAS_DIA = 20, CORES_PECA = ['branco', 'preto'];

  function basePeca(p) { return String((p && p.nome) || '').split(' — ')[0].trim(); }

  function corDoItem(i) {
    var s = sem_acento_js(String((i && i.variacao) || '') + ' ' + String((i && i.titulo) || ''));
    var b = /branc/.test(s), pr = /pret/.test(s);
    return b && !pr ? 'branco' : pr && !b ? 'preto' : null;
  }

  function sem_acento_js(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // Unidades vendidas por peca-base e cor desde 'desde' (ISO ou AAAA-MM-DD). Sem cor no anuncio:
  // reparte pela proporcao das cores conhecidas da peca.
  function vendasPorBaseCor(desde) {
    var r = {}, semCor = {};
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens) || !t.data) return;
      // desde com hora (contagem): so vendas depois dela; sem hora: a partir desse dia
      var conta = desde.length > 10 ? (t.dataHora ? t.dataHora > desde : t.data > desde.slice(0, 10)) : t.data >= desde;
      if (!conta) return;
      t.itens.forEach(function (i) {
        var p = pecaDoItem(i.item_id);
        if (!p) return;
        var b = basePeca(p), q = Number(i.quantidade) || 1, cor = corDoItem(i);
        r[b] = r[b] || { branco: 0, preto: 0 };
        if (cor) r[b][cor] += q; else semCor[b] = (semCor[b] || 0) + q;
      });
    });
    Object.keys(semCor).forEach(function (b) {
      var x = r[b], tot = x.branco + x.preto;
      x.branco += tot ? semCor[b] * x.branco / tot : semCor[b] / 2;
      x.preto += tot ? semCor[b] * x.preto / tot : semCor[b] / 2;
    });
    return r;
  }

  // Pecas prontas agora: contagem menos o que vendeu depois dela.
  function estoquePronto() {
    var c = getCalc3d(), e = c.estoquePecas || {}, em = c.estoquePecasEm;
    var vend = em ? vendasPorBaseCor(em) : {}, r = {};
    Object.keys(e).forEach(function (k) {
      if (k.indexOf('|') === -1) return;            // formato antigo (sem cor) fica de fora
      var b = k.split('|')[0], cor = k.split('|')[1];
      r[k] = Math.max(0, num(e[k]) - Math.round((vend[b] || {})[cor] || 0));
    });
    return r;
  }

  function calcPlanoImpressao() {
    var c = getCalc3d();
    var est = estoquePronto(), vend = vendasPorBaseCor(isoHoje(-13)), bases = {};
    (c.produtos || []).forEach(function (p) { var b = basePeca(p); if (num(p.horas) > 0 && !bases[b]) bases[b] = p; });
    var nImp = Math.max(1, (c.impressoras || []).length);
    var capacidade = nImp * PLANO_HORAS_DIA, lista = [];
    Object.keys(bases).forEach(function (b) {
      var p = bases[b];
      CORES_PECA.forEach(function (cor) {
        var k = b + '|' + cor, ritmo = ((vend[b] || {})[cor] || 0) / 14, informado = Object.prototype.hasOwnProperty.call(est, k);
        if (!ritmo && !informado) return;
        var tem = est[k] || 0, porPlaca = Math.max(1, num(p.porPlaca) || 1), hPlaca = num(p.horas);
        var precisa = Math.max(0, Math.ceil(ritmo * PLANO_DIAS_COBRIR - tem));
        lista.push({ id: k, base: b, cor: cor, nome: b + ' ' + cor, ritmo: ritmo, estoque: tem, informado: informado,
          duraDias: ritmo ? tem / ritmo : 99, precisa: precisa, placas: Math.ceil(precisa / porPlaca),
          porPlaca: porPlaca, hPlaca: hPlaca });
      });
    });
    lista.sort(function (a, b) { return a.duraDias - b.duraDias || b.ritmo - a.ritmo; });
    lista.forEach(function (x) { x.horas = x.placas * x.hPlaca; x.hojePlacas = 0; });
    // Reparte as horas das impressoras uma placa por vez, pela ordem de urgencia, para nao
    // gastar o dia todo numa peca so e deixar faltar as outras.
    var livre = capacidade, mudou = true;
    while (mudou) {
      mudou = false;
      lista.forEach(function (x) {
        if (x.hojePlacas < x.placas && x.hPlaca > 0 && x.hPlaca <= livre) { x.hojePlacas++; livre -= x.hPlaca; mudou = true; }
      });
    }
    lista.forEach(function (x) { x.hojePecas = x.hojePlacas * x.porPlaca; });
    return { lista: lista, capacidade: capacidade, usadas: capacidade - livre, impressoras: nImp, contadoEm: c.estoquePecasEm || null };
  }

  function renderPlanoImpressaoCard(wrap) {
    var p = calcPlanoImpressao();
    if (!p.lista.length) return;
    var c = getCalc3d(), inputs = {};
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Plano de impressão de hoje' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 8px;', text: 'Pelo ritmo de vendas de cada cor nos últimos 14 dias, para ter ' + PLANO_DIAS_COBRIR + ' dias de estoque. ' + p.impressoras + ' impressoras × ' + PLANO_HORAS_DIA + ' h = ' + p.capacidade + ' h por dia; o plano usa ' + Math.round(p.usadas) + ' h. Dupla face e parafuso contam juntos (é a mesma peça impressa).' })]);
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Peça', 'Cor', 'Vende por dia', 'Prontas agora', 'Dura', 'Imprimir hoje', 'Nova contagem'].map(function (h, i) { return el('th', { class: i > 1 ? 'num' : '', text: h }); })));
    p.lista.forEach(function (x) {
      inputs[x.id] = el('input', { type: 'number', min: '0', step: '1', placeholder: x.informado ? String(x.estoque) : 'quantas', style: 'width:70px;' });
      t.appendChild(el('tr', {}, [el('td', { text: x.base }), el('td', { text: x.cor === 'branco' ? 'Branco' : 'Preto' }),
        el('td', { class: 'num', text: (Math.round(x.ritmo * 10) / 10).toLocaleString('pt-BR') }),
        el('td', { class: 'num', text: x.informado ? String(x.estoque) : '—' }),
        el('td', { class: 'num', style: x.informado && x.duraDias < 3 ? 'color:var(--bad); font-weight:700;' : '', text: !x.informado ? 'conte' : x.duraDias >= 99 ? '—' : Math.floor(x.duraDias) + ' dia(s)' }),
        el('td', { class: 'num', style: 'font-weight:700;', text: x.hojePecas ? x.hojePecas + ' peça(s) · ' + (Math.round(x.hojePlacas * x.hPlaca * 10) / 10).toLocaleString('pt-BR') + ' h' : (x.precisa ? 'amanhã' : 'tem estoque') }),
        el('td', { class: 'num' }, [inputs[x.id]])]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    card.appendChild(el('div', { style: 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center;' }, [
      el('button', { class: 'pml-btn', text: 'Salvar contagem', onclick: function () {
        // Quem nao foi recontado continua com o que tem agora (contagem antiga menos as vendas).
        var atual = estoquePronto(), novo = {}, algum = false;
        Object.keys(atual).forEach(function (k) { novo[k] = atual[k]; });
        Object.keys(inputs).forEach(function (k) { var v = inputs[k].value; if (v !== '') { novo[k] = Number(v) || 0; algum = true; } });
        if (!algum) return;
        c.estoquePecas = novo; c.estoquePecasEm = new Date().toISOString(); salvarCalc3d(); render();
      } }),
      p.contadoEm ? el('span', { class: 'pml-margin', text: 'Última contagem: ' + new Date(p.contadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '. As vendas depois dela já foram descontadas.' }) : null
    ].filter(Boolean)));
    wrap.appendChild(card);
  }
