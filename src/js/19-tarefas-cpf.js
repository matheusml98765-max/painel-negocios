  // ===================== TAREFAS E CPF =====================
  // Duas fontes juntas: o que o Claude lanca pelo chat (tarefas.json e financas_cpf.json no Gist,
  // vindos do repositorio privado da automacao) e o que o vendedor faz aqui (localStorage).
  // Riscar ou excluir algo vindo do Gist fica guardado so neste navegador, pelo id.

  function lerLocal(chave, padrao) {
    try { var v = localStorage.getItem('pml_' + chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  function gravarLocal(chave, valor) {
    try { localStorage.setItem('pml_' + chave, JSON.stringify(valor)); } catch (e) {}
  }

  async function sincronizarTarefasCpf() {
    if (!state.gistUrl) return;
    var pares = [['tarefas.json', 'tarefasRemotas', 'ml-tarefas-remotas'], ['financas_cpf.json', 'cpfRemoto', 'ml-cpf-remoto']];
    for (var i = 0; i < pares.length; i++) {
      try {
        var r = await fetch(urlArquivoIrmao(state.gistUrl, pares[i][0]) + '?_=' + Date.now());
        if (!r.ok) continue;
        var d = await r.json();
        state[pares[i][1]] = d;
        gravarLocal(pares[i][2], d);
      } catch (e) {}
    }
  }

  // ---------------- Tarefas ----------------
  function listaTarefas() {
    var local = lerLocal('ml-tarefas-local', { feitas: {}, excluidas: {}, novas: [] });
    var remotas = ((state.tarefasRemotas || lerLocal('ml-tarefas-remotas', null) || {}).tarefas) || [];
    var todas = remotas.concat(local.novas || []).filter(function (t) { return !local.excluidas[t.id]; });
    todas.forEach(function (t) { t.feita = !!(local.feitas[t.id] || t.feita_em); t.feitaEm = local.feitas[t.id] || t.feita_em || null; });
    return { local: local, todas: todas };
  }

  function renderTarefasTab(wrap) {
    var L = listaTarefas();
    function salvar() { gravarLocal('ml-tarefas-local', L.local); render(); }
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Nova tarefa' }));
    var tit = el('input', { placeholder: 'Ex.: Lubrificar o eixo Z da impressora 2' });
    var prazo = el('input', { type: 'date' });
    var cat = el('select', {}, ['Loja', 'Impressoras', 'Compras', 'Pessoal', 'Outros'].map(function (c) { return el('option', { value: c, text: c }); }));
    card.appendChild(el('div', { class: 'pml-form-grid' }, [
      el('div', { class: 'pml-field', style: 'grid-column: span 2;' }, [el('label', { text: 'O que fazer' }), tit]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Até quando (opcional)' }), prazo]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Tipo' }), cat])
    ]));
    card.appendChild(el('button', { class: 'pml-btn', text: 'Adicionar', onclick: function () {
      if (!tit.value.trim()) return;
      L.local.novas.push({ id: 'l' + uid(), titulo: tit.value.trim(), prazo: prazo.value || null, categoria: cat.value, criada: isoHoje(0) });
      salvar();
    } }));
    wrap.appendChild(card);

    var pend = L.todas.filter(function (t) { return !t.feita; }).sort(function (a, b) { return String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')); });
    var feitas = L.todas.filter(function (t) { return t.feita; }).sort(function (a, b) { return String(b.feitaEm).localeCompare(String(a.feitaEm)); });
    var lista = el('div', { class: 'pml-card' });
    lista.appendChild(el('p', { class: 'pml-section-title', text: 'Para fazer (' + pend.length + ')' }));
    if (!pend.length) lista.appendChild(el('div', { class: 'pml-empty', text: 'Nada pendente. 🎉' }));
    var hoje = isoHoje(0);
    function linha(t) {
      var atrasada = !t.feita && t.prazo && t.prazo < hoje;
      return el('div', { class: 'tarefa' + (t.feita ? ' feita' : '') }, [
        el('button', { class: 'tarefa-check', title: t.feita ? 'Desmarcar' : 'Marcar como feita', text: t.feita ? '✓' : '', onclick: function () {
          if (t.feita) delete L.local.feitas[t.id]; else L.local.feitas[t.id] = hoje;
          salvar();
        } }),
        el('div', { class: 'tarefa-texto' }, [
          el('div', { class: 'tarefa-titulo', text: t.titulo }),
          el('div', { class: 'pml-margin', html: [t.categoria, t.detalhe, t.prazo ? (atrasada ? '<b style="color:var(--bad)">atrasada · ' : 'até ') + t.prazo.split('-').reverse().join('/') + (atrasada ? '</b>' : '') : null, t.feita && t.feitaEm ? 'feita em ' + t.feitaEm.split('-').reverse().join('/') : null].filter(Boolean).join(' · ') })
        ]),
        el('button', { class: 'tarefa-x', title: 'Excluir', text: '×', onclick: function () {
          if (String(t.id).charAt(0) === 'l') L.local.novas = L.local.novas.filter(function (x) { return x.id !== t.id; });
          else L.local.excluidas[t.id] = true;
          salvar();
        } })
      ]);
    }
    pend.forEach(function (t) { lista.appendChild(linha(t)); });
    if (feitas.length) {
      var det = el('details', { class: 'pml-fat-cat' }, [el('summary', { text: 'Feitas (' + feitas.length + ')' })]);
      feitas.forEach(function (t) { det.appendChild(linha(t)); });
      lista.appendChild(det);
    }
    lista.appendChild(el('p', { class: 'pml-note', text: 'Pode me mandar tarefas pelo chat também: elas aparecem aqui sozinhas na próxima atualização.' }));
    wrap.appendChild(lista);
  }

  // ---------------- CPF ----------------
  var CATEGORIAS_CPF = ['Alimentação', 'Mercado', 'Transporte', 'Moradia', 'Contas (luz, água, internet)', 'Saúde', 'Lazer', 'Compras', 'Assinaturas', 'Da empresa para o CPF', 'Outras entradas', 'Outros'];

  function lancamentosCpf() {
    var local = lerLocal('ml-cpf-local', { novos: [], excluidos: {} });
    var remotos = ((state.cpfRemoto || lerLocal('ml-cpf-remoto', null) || {}).lancamentos) || [];
    return { local: local, todos: remotos.concat(local.novos || []).filter(function (l) { return !local.excluidos[l.id]; }) };
  }

  function resumoCpf(lista, mes) {
    var r = { entradas: 0, saidas: 0, cat: {}, itens: [] };
    lista.forEach(function (l) {
      if (String(l.data || '').slice(0, 7) !== mes) return;
      var v = Number(l.valor) || 0;
      if (l.tipo === 'entrada') r.entradas += v; else { r.saidas += v; r.cat[l.categoria || 'Outros'] = (r.cat[l.categoria || 'Outros'] || 0) + v; }
      r.itens.push(l);
    });
    r.saldo = r.entradas - r.saidas;
    r.itens.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    return r;
  }

  function renderCpfTab(wrap) {
    var L = lancamentosCpf();
    function salvar() { gravarLocal('ml-cpf-local', L.local); render(); }
    var meses = {}; meses[isoHoje(0).slice(0, 7)] = true;
    L.todos.forEach(function (l) { if (l.data) meses[String(l.data).slice(0, 7)] = true; });
    var lista = Object.keys(meses).sort().reverse();
    var mes = lista.indexOf(state.cpfMes) !== -1 ? state.cpfMes : lista[0];
    var r = resumoCpf(L.todos, mes);
    function nomeMes(m) { var p = m.split('-'); var s = new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
    var sel = el('select', { onchange: function () { state.cpfMes = sel.value; render(); } }, lista.map(function (m) { var o = el('option', { value: m, text: nomeMes(m) }); if (m === mes) o.setAttribute('selected', ''); return o; }));
    wrap.appendChild(el('div', { class: 'rel-topo' }, [el('div', {}, [el('h2', { text: 'Meu dinheiro (CPF)' }), el('p', { class: 'pml-margin', text: 'Separado da loja. Me mande no chat o que entrou e saiu, ou lance aqui.' })]), el('div', { class: 'rel-acoes' }, [sel])]));
    wrap.appendChild(el('div', { class: 'pml-metrics' }, [
      metricaFicha('Entrou', fmtMoney(r.entradas), nomeMes(mes), 'pos'),
      metricaFicha('Saiu', fmtMoney(r.saidas), r.itens.filter(function (l) { return l.tipo !== 'entrada'; }).length + ' gastos', 'neg'),
      metricaFicha('Sobrou', fmtMoney(r.saldo), r.saldo >= 0 ? 'no positivo' : 'gastou mais do que entrou', r.saldo >= 0 ? 'pos' : 'neg')
    ]));

    var form = el('div', { class: 'pml-card' });
    form.appendChild(el('p', { class: 'pml-section-title', text: 'Lançar' }));
    var data = el('input', { type: 'date', value: isoHoje(0) });
    var tipo = el('select', {}, [el('option', { value: 'saida', text: 'Gasto (saiu)' }), el('option', { value: 'entrada', text: 'Entrada (entrou)' })]);
    var valor = el('input', { type: 'number', step: '0.01', placeholder: '0,00' });
    var desc = el('input', { placeholder: 'Ex.: mercado, gasolina, pix da empresa' });
    var cat = el('select', {}, CATEGORIAS_CPF.map(function (c) { return el('option', { value: c, text: c }); }));
    form.appendChild(el('div', { class: 'pml-form-grid' }, [
      el('div', { class: 'pml-field' }, [el('label', { text: 'Data' }), data]), el('div', { class: 'pml-field' }, [el('label', { text: 'Tipo' }), tipo]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Valor (R$)' }), valor]), el('div', { class: 'pml-field' }, [el('label', { text: 'O que foi' }), desc]),
      el('div', { class: 'pml-field' }, [el('label', { text: 'Categoria' }), cat])
    ]));
    form.appendChild(el('button', { class: 'pml-btn', text: 'Lançar', onclick: function () {
      if (!(num(valor.value) > 0)) return;
      L.local.novos.push({ id: 'l' + uid(), data: data.value || isoHoje(0), tipo: tipo.value, valor: num(valor.value), descricao: desc.value.trim(), categoria: cat.value });
      salvar();
    } }));
    wrap.appendChild(form);

    var cats = Object.keys(r.cat).sort(function (a, b) { return r.cat[b] - r.cat[a]; });
    if (cats.length) {
      var cc = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Para onde foi o dinheiro' })]);
      cats.forEach(function (c) {
        cc.appendChild(el('div', { class: 'dev-motivo' }, [el('span', { text: c }), el('div', { class: 'pml-barra' }, [el('span', { style: 'width:' + (r.cat[c] / r.cat[cats[0]] * 100).toFixed(0) + '%' })]), el('b', { text: fmtMoney(r.cat[c]) + ' · ' + fmtPct(r.saidas ? r.cat[c] / r.saidas : 0) })]));
      });
      wrap.appendChild(cc);
    }
    var lc = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Lançamentos de ' + nomeMes(mes) })]);
    if (!r.itens.length) lc.appendChild(el('div', { class: 'pml-empty', text: 'Nada lançado neste mês ainda.' }));
    else {
      var t = el('table', { class: 'pml-table' });
      r.itens.forEach(function (l) {
        t.appendChild(el('tr', {}, [
          el('td', { text: String(l.data).slice(8, 10) + '/' + String(l.data).slice(5, 7) }),
          el('td', {}, [el('div', { text: l.descricao || l.categoria }), el('div', { class: 'pml-margin', text: (l.categoria || '') + (l.forma ? ' · ' + l.forma : '') + (l.obs ? ' · ' + l.obs : '') })]),
          el('td', { class: 'num', style: 'font-weight:700; color:' + (l.tipo === 'entrada' ? 'var(--good)' : 'var(--ink)'), text: (l.tipo === 'entrada' ? '+' : '−') + fmtMoney(l.valor) }),
          el('td', {}, [el('button', { class: 'tarefa-x', title: 'Excluir', text: '×', onclick: function () {
            if (String(l.id).charAt(0) === 'l') L.local.novos = L.local.novos.filter(function (x) { return x.id !== l.id; }); else L.local.excluidos[l.id] = true;
            salvar();
          } })])
        ]));
      });
      lc.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    }
    wrap.appendChild(lc);
  }
