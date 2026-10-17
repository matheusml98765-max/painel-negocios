  // ===================== A RECEBER =====================
  // Dinheiro que outras pessoas devem ao vendedor. Sem automacao: o Claude lanca pelo chat
  // (a_receber.json no Gist) e o vendedor marca como recebido ou lanca aqui (localStorage).

  function dadosReceber() {
    var remoto = state.receberRemoto || lerLocal('ml-receber-remoto', null) || {};
    var local = lerLocal('ml-receber-local', { novos: [], recebidos: {}, desfeitos: {}, excluidos: {} });
    ['recebidos', 'desfeitos', 'excluidos'].forEach(function (k) { if (!local[k]) local[k] = {}; });
    if (!local.novos) local.novos = [];
    var itens = (remoto.itens || []).concat(local.novos).filter(function (x) { return !local.excluidos[x.id]; }).map(function (x) {
      var rec = local.desfeitos[x.id] ? null : (local.recebidos[x.id] || x.recebido_em || null);
      return Object.assign({}, x, { recebido: rec });
    });
    return { local: local, itens: itens };
  }

  function renderReceberTab(wrap) {
    var D = dadosReceber();
    function salvar() { gravarLocal('ml-receber-local', D.local); render(); }
    var hoje = isoHoje(0);
    var pend = D.itens.filter(function (x) { return !x.recebido; }).sort(function (a, b) { return String(a.previsao || '9999').localeCompare(String(b.previsao || '9999')); });
    var feitos = D.itens.filter(function (x) { return x.recebido; }).sort(function (a, b) { return String(b.recebido).localeCompare(String(a.recebido)); });
    var total = pend.reduce(function (s, x) { return s + num(x.valor); }, 0);
    var atras = pend.filter(function (x) { return x.previsao && x.previsao < hoje; });

    wrap.appendChild(el('div', { class: 'rel-topo' }, [el('div', {}, [
      el('h2', { text: 'A receber' }),
      el('p', { class: 'pml-margin', text: 'Dinheiro que te devem ou que você vai receber. Me fale no chat ou lance aqui.' })
    ])]));
    wrap.appendChild(el('div', { class: 'pml-metrics' }, [
      metricaFicha('Falta receber', fmtMoney(total), pend.length + (pend.length === 1 ? ' pessoa/valor' : ' valores'), total ? 'pos' : ''),
      metricaFicha('Atrasado', fmtMoney(atras.reduce(function (s, x) { return s + num(x.valor); }, 0)), atras.length ? atras.length + ' passou da data combinada' : 'nada atrasado', atras.length ? 'neg' : ''),
      metricaFicha('Já recebido', fmtMoney(feitos.reduce(function (s, x) { return s + num(x.valor); }, 0)), feitos.length + ' recebido(s)')
    ]));

    var lista = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Para receber (' + pend.length + ')' })]);
    if (!pend.length) lista.appendChild(el('div', { class: 'pml-empty', text: 'Ninguém te deve nada. 🎉' }));
    function linha(x) {
      var atrasado = !x.recebido && x.previsao && x.previsao < hoje;
      var info = [x.descricao, x.criado ? 'desde ' + x.criado.split('-').reverse().join('/') : null,
        x.previsao ? (atrasado ? '<b style="color:var(--bad)">combinado para ' : 'combinado para ') + x.previsao.split('-').reverse().join('/') + (atrasado ? '</b>' : '') : null,
        x.recebido ? 'recebido em ' + x.recebido.split('-').reverse().join('/') : null].filter(Boolean).join(' · ');
      return el('div', { class: 'tarefa' + (x.recebido ? ' feita' : '') }, [
        el('button', { class: 'tarefa-check', title: x.recebido ? 'Desmarcar' : 'Marcar como recebido', text: x.recebido ? '✓' : '', onclick: function () {
          if (x.recebido) { delete D.local.recebidos[x.id]; D.local.desfeitos[x.id] = true; } else { D.local.recebidos[x.id] = hoje; delete D.local.desfeitos[x.id]; }
          salvar();
        } }),
        el('div', { class: 'tarefa-texto' }, [el('div', { class: 'tarefa-titulo', text: x.quem }), info ? el('div', { class: 'pml-margin', html: info }) : null].filter(Boolean)),
        el('b', { style: 'white-space:nowrap; color:' + (x.recebido ? 'var(--muted)' : 'var(--good)'), text: fmtMoney(num(x.valor)) }),
        el('button', { class: 'tarefa-x', title: 'Excluir', text: '×', onclick: function () {
          if (String(x.id).charAt(0) === 'l') D.local.novos = D.local.novos.filter(function (y) { return y.id !== x.id; }); else D.local.excluidos[x.id] = true;
          salvar();
        } })
      ]);
    }
    pend.forEach(function (x) { lista.appendChild(linha(x)); });
    if (feitos.length) {
      var det = el('details', { class: 'pml-fat-cat' }, [el('summary', { text: 'Já recebidos (' + feitos.length + ')' })]);
      feitos.forEach(function (x) { det.appendChild(linha(x)); });
      lista.appendChild(det);
    }
    wrap.appendChild(lista);

    var f = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Lançar' })]);
    var quem = el('input', { placeholder: 'Quem vai te pagar' }), valor = el('input', { type: 'number', step: '0.01', placeholder: '0,00' });
    var desc = el('input', { placeholder: 'Do que é (opcional)' }), prev = el('input', { type: 'date' });
    f.appendChild(el('div', { class: 'pml-form-grid' }, [['Quem', quem], ['Valor (R$)', valor], ['Do que é', desc], ['Combinado para (opcional)', prev]].map(function (c) { return el('div', { class: 'pml-field' }, [el('label', { text: c[0] }), c[1]]); })));
    f.appendChild(el('button', { class: 'pml-btn', text: 'Lançar', onclick: function () {
      if (!quem.value.trim() || !(num(valor.value) > 0)) return;
      D.local.novos.push({ id: 'l' + uid(), quem: quem.value.trim(), valor: num(valor.value), descricao: desc.value.trim(), previsao: prev.value || null, criado: hoje });
      salvar();
    } }));
    wrap.appendChild(f);
  }
