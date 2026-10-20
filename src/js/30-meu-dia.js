  // ===================== MEU DIA (ROTINA) =====================
  // Primeira tela do dia: boas-vindas, a rotina (rotina.json no Gist, lancada pelo Claude) e o
  // que vence ou precisa de atencao hoje (tarefas, contas, a receber, insumos). Abre sozinha na
  // primeira vez do dia ou com ?bomdia=1 no endereco (atalho de inicializacao do Windows).

  var DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  function rotinaDoDia() {
    var r = state.rotinaRemota || lerLocal('ml-rotina-remota', null) || {};
    var dow = new Date().getDay();
    return (r.secoes || []).map(function (s) {
      return { id: s.id, titulo: s.titulo, icone: s.icone || '', itens: (s.itens || []).filter(function (i) { return !Array.isArray(i.dias) || i.dias.indexOf(dow) !== -1; }) };
    }).filter(function (s) { return s.itens.length; });
  }

  function abrirMeuDiaHoje() {
    var hoje = isoHoje(0);
    var forcar = /[?&]bomdia=1/.test(location.search);
    var visto = lerLocal('ml-meu-dia-visto', '');
    if (forcar || visto !== hoje) { state.tab = 'dia'; gravarLocal('ml-meu-dia-visto', hoje); }
  }

  // O que pede atencao hoje, fora da rotina
  function pendenciasDeHoje() {
    var hoje = isoHoje(0), itens = [];
    listaTarefas().todas.filter(function (t) { return !t.feita && t.prazo && t.prazo <= hoje; }).forEach(function (t) {
      itens.push({ icone: '✅', texto: (t.prazo < hoje ? 'Atrasada: ' : '') + t.titulo, ir: 'tarefas', forte: t.prazo < hoje });
    });
    resumoContasMes(hoje.slice(0, 7)).linhas.filter(function (l) { return !l.pago; }).forEach(function (l) {
      var d = Math.round((new Date(l.vence + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
      if (d > 3) return;
      itens.push({ icone: '🧾', texto: (d < 0 ? 'Conta atrasada: ' : d === 0 ? 'Pagar hoje: ' : 'Pagar em ' + d + (d === 1 ? ' dia: ' : ' dias: ')) + l.nome + ' · ' + (l.aproximado ? '≈ ' : '') + fmtMoney(l.valor), ir: 'contas', forte: d <= 0 });
    });
    dadosReceber().itens.filter(function (x) { return !x.recebido && x.previsao && x.previsao <= hoje; }).forEach(function (x) {
      itens.push({ icone: '💸', texto: 'Cobrar ' + x.quem + ': ' + fmtMoney(num(x.valor)) + (x.descricao ? ' (' + x.descricao + ')' : ''), ir: 'receber' });
    });
    calcEstoqueInsumos().filter(function (l) { return l.dias !== undefined && l.dias !== null && l.dias <= 10; }).forEach(function (l) {
      itens.push({ icone: '🛒', texto: 'Comprar ' + l.nome.replace(/ \((cm|kg)\)$/, '') + ' (acaba em ' + Math.round(l.dias) + ' dias)', ir: 'calc3d' });
    });
    var h = horasDesdeAtualizacaoAutomacao();
    if (h !== null && h > 3) itens.unshift({ icone: '⚠️', texto: 'A automação está parada há ' + Math.round(h) + ' horas', forte: true });
    return itens;
  }

  function renderMeuDia(wrap) {
    var hoje = isoHoje(0), agora = new Date();
    var local = lerLocal('ml-rotina-local', { feitos: {} });
    if (!local.feitos) local.feitos = {};
    var feitos = local.feitos[hoje] || {};
    function marcar(id) {
      if (feitos[id]) delete feitos[id]; else feitos[id] = new Date().toTimeString().slice(0, 5);
      local.feitos[hoje] = feitos;
      Object.keys(local.feitos).forEach(function (d) { if (d < isoHoje(-30)) delete local.feitos[d]; });
      gravarLocal('ml-rotina-local', local); render();
    }
    var secoes = rotinaDoDia();
    var total = secoes.reduce(function (s, x) { return s + x.itens.length; }, 0);
    var feitosN = secoes.reduce(function (s, x) { return s + x.itens.filter(function (i) { return feitos[i.id]; }).length; }, 0);
    var dataLonga = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    var v = calcVendasDoDia(isoHoje(-1));

    wrap.appendChild(el('div', { class: 'dia-topo' }, [
      el('h1', { text: saudacao(agora) + ', ' + NOME_DONO + '!' }),
      el('p', { class: 'dia-data', text: dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1) }),
      el('p', { class: 'dia-frase', text: fraseDoDia() }),
      v.vendas.length ? el('p', { class: 'pml-margin', text: 'Ontem: ' + v.vendas.length + ' vendas, ' + fmtMoney(v.bruto) + (v.comLucro ? ' · lucro ' + fmtMoney(v.lucro - (v.ads || 0)) + (function () { var b = v.vendas.reduce(function (s, x) { return s + (x.lucro !== null ? x.valor : 0); }, 0); return b > 0 ? ' · margem ' + fmtPct((v.lucro - (v.ads || 0)) / b) : ''; })() : '') }) : null
    ].filter(Boolean)));

    if (total) {
      var pct = Math.round(feitosN / total * 100);
      wrap.appendChild(el('div', { class: 'dia-progresso' }, [
        el('div', { class: 'dia-barra' }, [el('span', { style: 'width:' + pct + '%' })]),
        el('span', { text: feitosN === total ? 'Rotina completa! 🎉' : feitosN + ' de ' + total + ' feitos' })
      ]));
    }

    // Avisos do dia (contas, tarefas, compras, falhas, CPF): ficam so aqui, para nao repetir no Inicio
    renderAvisos(wrap);

    if (!secoes.length) {
      wrap.appendChild(el('div', { class: 'pml-card' }, [el('div', { class: 'pml-empty', text: 'Sua rotina ainda não foi montada. Me mande no chat o que você quer fazer todo dia que eu coloco aqui.' })]));
    }
    secoes.forEach(function (s) {
      var c = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: (s.icone ? s.icone + ' ' : '') + s.titulo })]);
      s.itens.forEach(function (i) {
        var f = feitos[i.id];
        c.appendChild(el('div', { class: 'tarefa' + (f ? ' feita' : '') }, [
          el('button', { class: 'tarefa-check', title: f ? 'Desmarcar' : 'Feito', text: f ? '✓' : '', onclick: function () { marcar(i.id); } }),
          el('div', { class: 'tarefa-texto' }, [
            el('div', { class: 'tarefa-titulo', text: i.texto }),
            (i.dica || f || Array.isArray(i.dias)) ? el('div', { class: 'pml-margin', text: [i.dica, Array.isArray(i.dias) ? 'toda ' + i.dias.map(function (d) { return DIAS_SEMANA[d]; }).join(', ') : null, f ? 'feito às ' + f : null].filter(Boolean).join(' · ') }) : null
          ].filter(Boolean)),
          i.ir ? el('button', { class: 'pml-btn secondary', style: 'padding:5px 10px; font-size:12px;', text: 'Abrir', onclick: function () { state.tab = i.ir; render(); window.scrollTo(0, 0); } }) : null
        ].filter(Boolean)));
      });
      wrap.appendChild(c);
    });

    wrap.appendChild(el('div', { style: 'text-align:center; margin:18px 0 8px;' }, [
      el('button', { class: 'pml-btn', style: 'padding:12px 26px; font-size:15px;', text: 'Começar o dia → ir para o painel', onclick: function () { state.tab = 'geral'; render(); window.scrollTo(0, 0); } })
    ]));
  }
