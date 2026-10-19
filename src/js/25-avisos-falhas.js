  // ===================== FALHAS, MANUTENCOES E AVISOS DO DIA =====================
  // Falha: peca que parou no meio. Perda = gramas da peca x quantidade x % onde parou (filamento
  // pelo preco da compra que estava sendo gasta) + a luz dessas horas. Entra no lucro do produto
  // e baixa o filamento do estoque. Manutencao: gasto real quando acontece (nao ha desgaste fixo).
  // Fontes: producao.json no Gist (o Claude lanca pelo chat) + o que o vendedor lanca aqui.

  function dadosProducao() {
    var remoto = state.producaoRemota || lerLocal('ml-producao-remota', null) || {};
    var local = lerLocal('ml-producao-local', { falhas: [], manutencoes: [], excluidos: {}, vistos: {} });
    ['falhas', 'manutencoes', 'perdas'].forEach(function (k) { if (!local[k]) local[k] = []; });
    if (!local.excluidos) local.excluidos = {};
    if (!local.vistos) local.vistos = {};
    function juntar(k) { return (remoto[k] || []).concat(local[k]).filter(function (x) { return !local.excluidos[x.id]; }); }
    return { local: local, falhas: juntar('falhas'), manutencoes: juntar('manutencoes'), perdas: juntar('perdas') };
  }

  function pecaPorId(id) { return (getCalc3d().produtos || []).find(function (p) { return p.id === id; }) || null; }

  // Custo e consumo de uma falha
  function custoFalha(f) {
    var c = getCalc3d();
    var p = pecaPorId(f.pecaId);
    if (!p) return null;
    var fr = Math.min(100, Math.max(0, num(f.pct))) / 100;
    var porPlaca = Math.max(1, num(p.porPlaca) || 1);
    var gramas = num(p.gramas) / porPlaca * num(f.qtd) * fr;
    var horas = num(p.horas) / porPlaca * num(f.qtd) * fr;
    var imp = c.impressoras.find(function (x) { return x.id === p.impressoraId; }) || c.impressoras[0] || { watts: 100 };
    var kwh = horas * num(imp.watts) / 1000;
    var fil = gramas * custoGrama(p.tipo, f.data);
    return { peca: p, gramas: gramas, horas: horas, kwh: kwh, filamento: fil, luz: kwh * num(c.kwh), total: fil + kwh * num(c.kwh) };
  }

  function falhasNoPeriodo(de, ate) {
    var r = { total: 0, gramas: 0, horas: 0, kwh: 0, porPeca: {}, lista: [] };
    dadosProducao().falhas.forEach(function (f) {
      if (!f.data || f.data < de || (ate && f.data > ate)) return;
      var cf = custoFalha(f);
      if (!cf) return;
      r.total += cf.total; r.gramas += cf.gramas; r.horas += cf.horas; r.kwh += cf.kwh;
      r.porPeca[f.pecaId] = (r.porPeca[f.pecaId] || 0) + cf.total;
      r.lista.push({ f: f, c: cf });
    });
    r.lista.sort(function (a, b) { return String(b.f.data).localeCompare(String(a.f.data)); });
    return r;
  }

  // Insumos perdidos fora das vendas (plastico rasgado, etiqueta que saiu errada...): producao.json
  // perdas [{id, data, insumo, qtd}]. Baixam o estoque e entram no lucro pelo preco do lote da epoca.
  function perdasInsumosNoPeriodo(de, ate) {
    var r = { total: 0, lista: [] };
    dadosProducao().perdas.forEach(function (x) {
      if (!x.data || x.data < de || (ate && x.data > ate)) return;
      var unit = (typeof precoFifo === 'function' ? precoFifo('emb:' + x.insumo, x.data) : null);
      if (unit === null || unit === undefined) unit = custoEmbalagem(x.insumo, x.data) || 0;
      var v = unit * num(x.qtd);
      r.total += v; r.lista.push({ p: x, valor: v });
    });
    return r;
  }

  function manutencoesNoPeriodo(de, ate) {
    var l = dadosProducao().manutencoes.filter(function (m) { return m.data && m.data >= de && (!ate || m.data <= ate); });
    return { lista: l.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }), total: l.reduce(function (s, m) { return s + num(m.valor); }, 0) };
  }

  // Gramas de filamento perdidos em falhas, por dia (para o estoque pela ordem das compras)
  function gramasFalhasPorDia(tipo) {
    var r = {};
    dadosProducao().falhas.forEach(function (f) {
      var p = pecaPorId(f.pecaId);
      if (!p || !f.data || (p.tipo || '').toUpperCase() !== tipo) return;
      var g = num(p.gramas) / Math.max(1, num(p.porPlaca) || 1) * num(f.qtd) * Math.min(100, Math.max(0, num(f.pct))) / 100;
      r[f.data] = (r[f.data] || 0) + g;
    });
    return r;
  }

  // Perda das falhas dividida entre os anuncios da peca, pelas unidades vendidas no periodo
  function aplicarFalhasNoLucro(linhas, de, ate) {
    var fp = falhasNoPeriodo(de, ate).porPeca;
    if (!Object.keys(fp).length) return;
    var unid = {};
    linhas.forEach(function (g) { var p = pecaDoItem(g.itemId); if (p && fp[p.id]) unid[p.id] = (unid[p.id] || 0) + g.unidades; });
    linhas.forEach(function (g) {
      var p = pecaDoItem(g.itemId);
      if (!p || !fp[p.id] || !unid[p.id]) return;
      g.perdasFalhas = fp[p.id] * g.unidades / unid[p.id];
      if (g.lucro !== null) {
        g.lucro -= g.perdasFalhas;
        g.lucroUnit = g.unidades ? g.lucro / g.unidades : 0;
        g.margem = g.receita ? g.lucro / g.receita : null;
        g.roi = g.custoTotal ? g.lucro / g.custoTotal : null;
      }
    });
  }

  // ---------------- Card na Calculadora 3D ----------------
  function formFalha(aoSalvar) {
    var pecas = (getCalc3d().produtos || []).filter(function (p) { return num(p.gramas) > 0; });
    var data = el('input', { type: 'date', value: isoHoje(0) });
    var peca = el('select', {}, pecas.map(function (p) { return el('option', { value: p.id, text: p.nome }); }));
    var qtd = el('input', { type: 'number', min: '1', step: '1', value: '1', style: 'width:80px;' });
    var pct = el('input', { type: 'number', min: '0', max: '100', step: '1', placeholder: 'ex.: 10', style: 'width:90px;' });
    var obs = el('input', { placeholder: 'opcional: o que aconteceu' });
    function campoF(r, x) { return el('div', { class: 'pml-field' }, [el('label', { text: r }), x]); }
    return el('div', {}, [
      el('div', { class: 'pml-form-grid' }, [campoF('Dia', data), campoF('Peça', peca), campoF('Quantas peças', qtd), campoF('Parou em quantos %', pct), campoF('Obs.', obs)]),
      el('button', { class: 'pml-btn', text: 'Lançar falha', onclick: function () {
        if (!peca.value || !(num(qtd.value) > 0) || pct.value === '') return;
        var D = dadosProducao();
        D.local.falhas.push({ id: 'l' + uid(), data: data.value || isoHoje(0), pecaId: peca.value, qtd: num(qtd.value), pct: num(pct.value), obs: obs.value.trim() });
        gravarLocal('ml-producao-local', D.local);
        if (aoSalvar) aoSalvar(); else render();
      } })
    ]);
  }

  function renderFalhasCard(wrap) {
    var iv = intervaloMes(isoHoje(0).slice(0, 7));
    var fa = falhasNoPeriodo(iv.de, iv.ate), ma = manutencoesNoPeriodo(iv.de, iv.ate);
    var D = dadosProducao();
    function excluir(id) { if (String(id).charAt(0) === 'l') { D.local.falhas = D.local.falhas.filter(function (x) { return x.id !== id; }); D.local.manutencoes = D.local.manutencoes.filter(function (x) { return x.id !== id; }); } else D.local.excluidos[id] = true; gravarLocal('ml-producao-local', D.local); render(); }
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Falhas de impressão e manutenções (este mês)' })]);
    card.appendChild(el('div', { class: 'pml-metrics', style: 'margin-bottom:12px;' }, [
      metricaFicha('Perdido em falhas', fmtMoney(fa.total), (fa.gramas).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' g de filamento · ' + fa.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h', fa.total ? 'neg' : ''),
      metricaFicha('Manutenções', fmtMoney(ma.total), ma.lista.length + (ma.lista.length === 1 ? ' manutenção' : ' manutenções'), ma.total ? 'neg' : '')
    ]));
    card.appendChild(formFalha());
    if (fa.lista.length) {
      var t = el('table', { class: 'pml-table', style: 'margin-top:10px;' });
      t.appendChild(el('tr', {}, ['Dia', 'Peça', 'Qtd', 'Parou em', 'Filamento', 'Perda', ''].map(function (h, i) { return el('th', { class: i > 1 && i < 6 ? 'num' : '', text: h }); })));
      fa.lista.forEach(function (x) {
        t.appendChild(el('tr', {}, [el('td', { text: x.f.data.split('-').reverse().join('/') }), el('td', { text: x.c.peca.nome + (x.f.obs ? ' · ' + x.f.obs : '') }), el('td', { class: 'num', text: String(x.f.qtd) }), el('td', { class: 'num', text: num(x.f.pct) + '%' }),
          el('td', { class: 'num', text: x.c.gramas.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' g' }), el('td', { class: 'num', text: fmtMoney(x.c.total) }),
          el('td', {}, [el('button', { class: 'tarefa-x', title: 'Excluir', text: '×', onclick: function () { excluir(x.f.id); } })])]));
      });
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    }
    // Manutencao
    var md = el('input', { type: 'date', value: isoHoje(0) }), mi = el('select', {}, getCalc3d().impressoras.map(function (i) { return el('option', { value: i.nome, text: i.nome }); }).concat([el('option', { value: 'Todas', text: 'Todas' })]));
    var mdesc = el('input', { placeholder: 'Ex.: troca do bico' }), mval = el('input', { type: 'number', step: '0.01', placeholder: '0,00' });
    var det = el('details', { style: 'margin-top:12px;' }, [el('summary', { text: 'Lançar manutenção (só quando acontecer)' }),
      el('div', { class: 'pml-form-grid', style: 'margin-top:8px;' }, [md, mi, mdesc, mval].map(function (x, i) { return el('div', { class: 'pml-field' }, [el('label', { text: ['Dia', 'Impressora', 'O que foi', 'Quanto gastou (R$)'][i] }), x]); })),
      el('button', { class: 'pml-btn', text: 'Lançar manutenção', onclick: function () {
        if (!(num(mval.value) > 0)) return;
        D.local.manutencoes.push({ id: 'l' + uid(), data: md.value || isoHoje(0), impressora: mi.value, descricao: mdesc.value.trim(), valor: num(mval.value) });
        gravarLocal('ml-producao-local', D.local); render();
      } })]);
    ma.lista.forEach(function (m) { det.appendChild(el('div', { class: 'pml-margin', style: 'display:flex; justify-content:space-between; padding:3px 0;' }, [el('span', { text: m.data.split('-').reverse().join('/') + ' · ' + (m.impressora || '') + ' · ' + (m.descricao || '') }), el('span', {}, [document.createTextNode(fmtMoney(m.valor) + ' '), el('button', { class: 'tarefa-x', text: '×', onclick: function () { excluir(m.id); } })])])); });
    card.appendChild(det);
    card.appendChild(el('p', { class: 'pml-note', text: 'Ex.: 4 drenos que pararam aos 10% = 4 × 66,3 g × 10% = 26,5 g perdidos. A perda entra no lucro do produto e o filamento sai do estoque. Pode me mandar pelo chat também.' }));
    wrap.appendChild(card);
  }
