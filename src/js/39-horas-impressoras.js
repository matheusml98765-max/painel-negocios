  // ===================== HORAS DAS IMPRESSORAS (CONTADOR DA BAMBU) =====================
  // O vendedor anota o contador de horas de impressao de cada impressora de vez em quando.
  // Entre duas leituras: horas reais impressas x horas que as vendas e falhas explicam, e a luz real.
  // calc3d.leiturasHoras = [{ data: 'AAAA-MM-DD', valores: { <idImpressora>: horas } }]

  function leiturasHoras() {
    return (getCalc3d().leiturasHoras || []).slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; });
  }

  function calcHorasImpressoras() {
    var c = getCalc3d(), L = leiturasHoras();
    var ult = L[L.length - 1] || null, ant = L.length > 1 ? L[L.length - 2] : null;
    var r = { ultima: ult, anterior: ant, linhas: [], realTotal: 0, dias: 0 };
    c.impressoras.forEach(function (imp) {
      var h = ult && ult.valores[imp.id] !== undefined ? num(ult.valores[imp.id]) : null;
      var ha = ant && ant.valores[imp.id] !== undefined ? num(ant.valores[imp.id]) : null;
      var periodo = h !== null && ha !== null ? Math.max(0, h - ha) : null;
      if (periodo !== null) r.realTotal += periodo;
      r.linhas.push({ imp: imp, horas: h, periodo: periodo });
    });
    if (ult && ant) {
      r.dias = Math.max(1, diasEntre(ant.data, ult.data) - 1);
      var est = calcConsumo3d(addDias(ant.data, 1), ult.data);   // vendas e falhas entre as leituras
      r.estimado = est.horas;
      r.luzReal = r.linhas.reduce(function (s, l) { return s + (l.periodo || 0) * num(l.imp.watts) / 1000 * num(c.kwh); }, 0);
      r.luzEstimada = est.luz;
    }
    return r;
  }

  function renderHorasImpressorasCard(wrap) {
    var c = getCalc3d();
    if (!c.impressoras.length) return;
    var h = calcHorasImpressoras(), hoje = isoHoje(0);
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Horas das impressoras (contador da Bambu)' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 10px;', text: 'Anote o total de horas de impressão que a Bambu mostra em cada impressora (no app Bambu Handy ou na tela). Com duas leituras, o painel mostra as horas reais impressas no período, compara com o que as vendas explicam e calcula a luz de verdade.' })]);
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Impressora', 'Última leitura', 'Desde a anterior', 'Por dia', 'Nova leitura'].map(function (x, i) { return el('th', { class: i ? 'num' : '', text: x }); })));
    var inputs = {};
    h.linhas.forEach(function (l) {
      inputs[l.imp.id] = el('input', { type: 'number', min: '0', step: '1', placeholder: 'horas', style: 'width:90px;' });
      t.appendChild(el('tr', {}, [el('td', { text: l.imp.nome }),
        el('td', { class: 'num', text: l.horas === null ? '—' : l.horas.toLocaleString('pt-BR') + ' h' }),
        el('td', { class: 'num', text: l.periodo === null ? '—' : l.periodo.toLocaleString('pt-BR') + ' h' }),
        el('td', { class: 'num', text: l.periodo === null || !h.dias ? '—' : (Math.round(l.periodo / h.dias * 10) / 10).toLocaleString('pt-BR') + ' h' }),
        el('td', { class: 'num' }, [inputs[l.imp.id]])]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    card.appendChild(el('div', { style: 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;' }, [el('button', { class: 'pml-btn', text: 'Salvar leitura de hoje', onclick: function () {
      var valores = {}, algum = false;
      Object.keys(inputs).forEach(function (id) { var v = inputs[id].value; if (v !== '') { valores[id] = Number(v) || 0; algum = true; } });
      if (!algum) return;
      c.leiturasHoras = (c.leiturasHoras || []).filter(function (x) { return x.data !== hoje; });
      c.leiturasHoras.push({ data: hoje, valores: valores });
      salvarCalc3d(); render();
    } })]));
    var notas = [];
    if (h.ultima) notas.push('Última leitura em ' + h.ultima.data.split('-').reverse().join('/') + '.');
    if (h.anterior) {
      var dif = h.estimado ? h.realTotal / h.estimado - 1 : null;
      notas.push('Entre ' + h.anterior.data.split('-').reverse().slice(0, 2).join('/') + ' e ' + h.ultima.data.split('-').reverse().slice(0, 2).join('/') + ': ' + Math.round(h.realTotal) + ' h impressas de verdade; as vendas e falhas explicam ' + Math.round(h.estimado) + ' h' + (dif !== null ? ' (' + (dif >= 0 ? '+' : '') + fmtPct(dif) + ').' : '.') + ' Luz real: ' + fmtMoney(h.luzReal) + ' (pela conta das vendas: ' + fmtMoney(h.luzEstimada) + ').');
      if (dif !== null && dif > 0.15) notas.push('As impressoras trabalharam mais do que as vendas explicam: pode ser estoque de peças prontas, falhas não anotadas ou peças de teste.');
    } else if (h.ultima) notas.push('Na próxima leitura (daqui a uma ou duas semanas) aparecem as horas reais do período.');
    if (notas.length) card.appendChild(el('p', { class: 'pml-note', text: notas.join(' ') }));
    wrap.appendChild(card);
  }
