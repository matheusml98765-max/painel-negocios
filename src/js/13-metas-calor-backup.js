  // ===================== METAS, MAPA DE CALOR E BACKUP =====================

  var DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Projecao simples: o ritmo de vendas ate agora, estendido ate o fim do mes.
  function calcProjecaoMes(totalAteAgora, agora) {
    agora = agora || new Date();
    var diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    var decorrido = (agora.getDate() - 1) + (agora.getHours() + agora.getMinutes() / 60) / 24;
    var diasRestantes = Math.max(0, diasNoMes - decorrido);
    // Nas primeiras horas do mes o ritmo ainda nao diz nada
    if (decorrido < 1) return { diasNoMes: diasNoMes, decorrido: decorrido, diasRestantes: diasRestantes, projecao: null };
    return { diasNoMes: diasNoMes, decorrido: decorrido, diasRestantes: diasRestantes, projecao: totalAteAgora / decorrido * diasNoMes };
  }

  // Quantas vendas e quanto faturou em cada dia da semana x hora (ultimos N dias).
  function calcMapaCalor(transacoes, dias, agora) {
    agora = agora || new Date();
    var limite = new Date(agora.getTime() - dias * 864e5);
    var matriz = [];
    for (var d = 0; d < 7; d++) { matriz.push([]); for (var h = 0; h < 24; h++) matriz[d].push({ pedidos: 0, valor: 0 }); }
    var total = 0, semHora = 0, max = 0, melhor = null;
    transacoes.forEach(function (t) {
      if (t.tipo !== 'venda') return;
      if (typeof t.hora !== 'number' || typeof t.dow !== 'number') {
        if (t.data && new Date(t.data + 'T12:00:00') >= limite) semHora++;
        return;
      }
      if (t.dataHora && new Date(t.dataHora) < limite) return;
      var c = matriz[t.dow][t.hora];
      c.pedidos++; c.valor += Number(t.valor) || 0; total++;
      if (c.pedidos > max) { max = c.pedidos; melhor = { dow: t.dow, hora: t.hora }; }
    });
    var porHora = []; for (var hh = 0; hh < 24; hh++) porHora.push(matriz.reduce(function (s, linha) { return s + linha[hh].pedidos; }, 0));
    var porDia = matriz.map(function (linha) { return linha.reduce(function (s, c) { return s + c.pedidos; }, 0); });
    return { matriz: matriz, total: total, semHora: semHora, max: max, melhor: melhor, porHora: porHora, porDia: porDia };
  }

  // Melhor faixa de 3 horas seguidas (somando todos os dias)
  function melhorFaixa(porHora) {
    var melhor = 0, inicio = 0;
    for (var h = 0; h < 24; h++) {
      var s = porHora[h] + porHora[(h + 1) % 24] + porHora[(h + 2) % 24];
      if (s > melhor) { melhor = s; inicio = h; }
    }
    return { inicio: inicio, fim: (inicio + 3) % 24, pedidos: melhor };
  }

  async function salvarMetas() {
    try { await window.storage.set('ml-metas', JSON.stringify(state.metas || {})); } catch (e) {}
  }

  function blocoMetas(d, lucroMes) {
    var agora = new Date();
    var chave = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
    state.metas = state.metas || {};
    var meta = state.metas[chave] || {};
    var nomeMes = agora.toLocaleDateString('pt-BR', { month: 'long' });
    var proj = calcProjecaoMes(d.mes.total, agora);
    var sec = el('section', { class: 'ini-bloco ini-c12 meta-bloco' });
    var cab = el('div', { class: 'cab' }, [el('h3', { text: 'Meta de ' + nomeMes })]);
    var editando = state.editandoMeta || !meta.faturamento;
    sec.appendChild(cab);

    if (editando) {
      var inpFat = el('input', { type: 'number', step: '100', value: meta.faturamento || '', placeholder: 'Ex: 25000' });
      var inpLuc = el('input', { type: 'number', step: '100', value: meta.lucro || '', placeholder: 'Opcional' });
      sec.appendChild(el('p', { class: 'pml-note', style: 'margin:-6px 0 12px;', text: 'Defina quanto quer faturar este mês. O painel acompanha o ritmo e mostra quanto precisa vender por dia para chegar lá.' }));
      sec.appendChild(el('div', { class: 'pml-form-grid', style: 'max-width:620px; align-items:end;' }, [
        el('div', { class: 'pml-field' }, [el('label', { text: 'Faturamento (R$)' }), inpFat]),
        el('div', { class: 'pml-field' }, [el('label', { text: 'Lucro real (R$)' }), inpLuc]),
        el('div', {}, [el('button', { class: 'pml-btn', text: 'Salvar meta', onclick: function () {
          var f = Number(inpFat.value) || 0;
          if (f <= 0) { inpFat.focus(); return; }
          state.metas[chave] = { faturamento: f, lucro: Number(inpLuc.value) || 0 };
          state.editandoMeta = false; salvarMetas(); render();
        } })])
      ]));
      return sec;
    }

    cab.appendChild(el('button', { class: 'ini-ver-tabela', text: 'Mudar meta', onclick: function () { state.editandoMeta = true; render(); } }));
    function barra(rotulo, atual, alvo, projetado) {
      var pct = alvo ? atual / alvo : 0;
      var pctProj = alvo && projetado !== null ? projetado / alvo : null;
      var linha = el('div', { class: 'meta-linha' });
      linha.appendChild(el('div', { class: 'meta-topo' }, [
        el('span', { class: 'meta-rotulo', text: rotulo }),
        el('span', { class: 'meta-num', text: fmtMoney(atual) + ' de ' + fmtMoney(alvo) })
      ]));
      var trilho = el('div', { class: 'meta-trilho', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(Math.min(pct, 1) * 100)), 'aria-label': rotulo });
      if (pctProj !== null) trilho.appendChild(el('span', { class: 'meta-proj', style: 'width:' + Math.min(100, pctProj * 100).toFixed(1) + '%' }));
      trilho.appendChild(el('span', { class: 'meta-feito', style: 'width:' + Math.min(100, pct * 100).toFixed(1) + '%' }));
      linha.appendChild(trilho);
      var txt;
      if (pct >= 1) txt = '🎉 Meta batida! ' + fmtPct(pct) + ' do objetivo.';
      else if (projetado === null) txt = fmtPct(pct) + ' do objetivo. A projeção aparece a partir do segundo dia do mês.';
      else {
        var falta = Math.max(0, alvo - atual);
        var porDia = proj.diasRestantes > 0 ? falta / proj.diasRestantes : falta;
        txt = (projetado >= alvo ? '✅ No ritmo: ' : '⚠️ Abaixo do ritmo: ') + 'a projeção é ' + fmtMoney(projetado) + ' (' + fmtPct(pctProj) + '). Faltam ' + fmtMoney(falta) + ', cerca de ' + fmtMoney(porDia) + ' por dia.';
      }
      linha.appendChild(el('p', { class: 'meta-texto', text: txt }));
      return linha;
    }
    sec.appendChild(barra('Faturamento', d.mes.total, meta.faturamento, proj.projecao));
    if (meta.lucro && lucroMes !== null) {
      var projLucro = proj.projecao !== null && d.mes.total ? lucroMes / d.mes.total * proj.projecao : null;
      sec.appendChild(barra('Lucro real (produtos com custo)', lucroMes, meta.lucro, projLucro));
    }
    sec.appendChild(el('p', { class: 'pml-margin', style: 'margin:6px 0 0;', text: 'Barra cheia: o que já entrou. Faixa clara: onde você chega no fim do mês mantendo o ritmo.' }));
    return sec;
  }

  function blocoMapaCalor() {
    var m = calcMapaCalor(state.transacoes, 30);
    var sec = el('section', { class: 'ini-bloco ini-c12' });
    sec.appendChild(el('div', { class: 'cab' }, [el('h3', { text: 'Quando você mais vende (30 dias)' })]));
    if (!m.total) {
      sec.appendChild(el('div', { class: 'pml-empty', text: 'O horário das vendas começa a ser registrado com a automação nova. Em algumas horas o mapa aparece aqui.' }));
      return sec;
    }
    var faixa = melhorFaixa(m.porHora);
    var diaTop = m.porDia.indexOf(Math.max.apply(null, m.porDia));
    var dica = 'Seu melhor horário é das ' + faixa.inicio + 'h às ' + faixa.fim + 'h (' + faixa.pedidos + ' pedidos) e o melhor dia é ' + DIAS_SEMANA[diaTop].toLowerCase() + '. Concentre Ads, ofertas relâmpago e posts nesse período.';
    sec.appendChild(el('p', { class: 'pml-note', style: 'margin:-6px 0 14px; font-size:13.5px; color:var(--ink);', text: dica }));
    var grade = el('div', { class: 'calor-grade', role: 'table', 'aria-label': 'Pedidos por dia da semana e hora' });
    grade.appendChild(el('div', { class: 'calor-canto' }));
    for (var h = 0; h < 24; h++) grade.appendChild(el('div', { class: 'calor-hora', text: h % 3 === 0 ? h + 'h' : '' }));
    var niveis = 5;
    for (var d = 0; d < 7; d++) {
      grade.appendChild(el('div', { class: 'calor-dia', text: DIAS_CURTOS[d] }));
      for (var hh = 0; hh < 24; hh++) {
        var c = m.matriz[d][hh];
        var nivel = c.pedidos ? Math.max(1, Math.ceil(c.pedidos / m.max * niveis)) : 0;
        grade.appendChild(el('div', {
          class: 'calor-cel n' + nivel, role: 'cell', tabindex: c.pedidos ? '0' : '-1',
          title: DIAS_SEMANA[d] + ', ' + hh + 'h às ' + (hh + 1) + 'h: ' + c.pedidos + (c.pedidos === 1 ? ' pedido' : ' pedidos') + ' · ' + fmtMoney(c.valor),
          'aria-label': DIAS_SEMANA[d] + ' ' + hh + ' horas: ' + c.pedidos + ' pedidos'
        }));
      }
    }
    sec.appendChild(el('div', { class: 'pml-scroll' }, [grade]));
    var leg = el('div', { class: 'calor-legenda' }, [el('span', { text: 'Menos' })]);
    for (var n = 0; n <= niveis; n++) leg.appendChild(el('i', { class: 'calor-cel n' + n }));
    leg.appendChild(el('span', { text: 'Mais pedidos' }));
    sec.appendChild(leg);
    if (m.semHora) sec.appendChild(el('p', { class: 'pml-margin', style: 'margin:8px 0 0;', text: m.semHora + ' venda(s) antigas ainda sem horário não entram no mapa.' }));
    return sec;
  }

  // ---------- Backup dos custos ----------
  var CHAVES_BACKUP = ['ml-produtos', 'ml-custos-avulsos', 'ml-calc3d', 'ml-config-lucro', 'ml-metas', 'ml-gist-url', 'ml-gist-url-shopee'];

  async function exportarBackup() {
    var dados = { tipo: 'backup-painel-top-brasil-shop', versao: 1, criadoEm: new Date().toISOString(), chaves: {} };
    for (var i = 0; i < CHAVES_BACKUP.length; i++) {
      try { var v = await window.storage.get(CHAVES_BACKUP[i]); if (v) dados.chaves[CHAVES_BACKUP[i]] = v.value; } catch (e) {}
    }
    var blob = new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup-painel-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function renderBackupCard(wrap) {
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Backup dos seus custos' }));
    card.appendChild(el('p', { style: 'font-size:13.5px; color:var(--muted); margin:0 0 12px; line-height:1.6;', text: 'Os custos, a calculadora 3D e as metas ficam salvos só neste navegador. Baixe um backup de vez em quando — e use o mesmo arquivo para abrir o painel com tudo em outro computador ou no celular.' }));
    var msg = el('div', { class: 'pml-note' });
    var inp = el('input', { type: 'file', accept: '.json', style: 'display:none;' });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = async function () {
        try {
          var dados = JSON.parse(r.result);
          if (!dados || dados.tipo !== 'backup-painel-top-brasil-shop' || !dados.chaves) throw new Error('formato');
          var n = 0;
          for (var k in dados.chaves) { if (CHAVES_BACKUP.indexOf(k) !== -1) { await window.storage.set(k, dados.chaves[k]); n++; } }
          msg.textContent = 'Backup restaurado (' + n + ' itens). Recarregando...';
          setTimeout(function () { location.reload(); }, 800);
        } catch (e) { msg.textContent = 'Esse arquivo não é um backup do painel. Escolha o arquivo baixado pelo botão "Baixar backup".'; }
      };
      r.readAsText(f);
    });
    card.appendChild(el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap;' }, [
      el('button', { class: 'pml-btn', text: '⬇ Baixar backup', onclick: exportarBackup }),
      el('button', { class: 'pml-tema-btn', text: '⬆ Restaurar backup', onclick: function () { inp.click(); } }),
      inp
    ]));
    card.appendChild(msg);
    wrap.appendChild(card);
  }

