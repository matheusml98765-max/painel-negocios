  // ===================== AVISOS DO DIA (INICIO) =====================
  // Lembretes do que precisa ser lancado (falhas, compras, gastos do CPF, dinheiro da loja para o
  // CPF) e alertas do que esta para vencer ou acabar. "Não teve hoje" esconde o lembrete ate amanha.

  function calcAvisos() {
    var hoje = isoHoje(0), D = dadosProducao(), vistos = D.local.vistos, av = [];
    function visto(k) { return !!vistos[hoje + ':' + k]; }
    // Lembretes do dia
    var falhasHoje = D.falhas.filter(function (f) { return f.data === hoje; }).length;
    if (!falhasHoje && !visto('falha')) av.push({ k: 'falha', icone: '🖨️', texto: 'Teve alguma falha de impressão hoje?', acao: 'falha' });
    var c = getCalc3d();
    var comprasHoje = c.filamentos.concat(c.embalagens).filter(function (l) { return l.data === hoje; }).length;
    if (!comprasHoje && !visto('compra')) av.push({ k: 'compra', icone: '📦', texto: 'Comprou filamento ou insumo hoje? Cadastre com o preço que pagou.', ir: 'calc3d', botao: 'Cadastrar compra' });
    var cpf = lancamentosCpf().todos.filter(function (l) { return l.data === hoje; });
    if (!cpf.some(function (l) { return l.categoria !== 'Da empresa para o CPF'; }) && !visto('cpf')) av.push({ k: 'cpf', icone: '💳', texto: 'Gastou ou recebeu algo no seu CPF hoje?', ir: 'cpf', botao: 'Lançar no CPF' });
    if (!cpf.some(function (l) { return l.categoria === 'Da empresa para o CPF'; }) && !visto('retirada')) av.push({ k: 'retirada', icone: '🔁', texto: 'Passou dinheiro da loja para o seu CPF hoje?', ir: 'cpf', botao: 'Lançar' });
    // Tarefas de hoje ou atrasadas
    listaTarefas().todas.filter(function (t) { return !t.feita && t.prazo && t.prazo <= hoje; }).forEach(function (t) {
      av.push({ k: 't-' + t.id, icone: '✅', texto: (t.prazo < hoje ? 'Tarefa atrasada: ' : 'Tarefa para hoje: ') + t.titulo, ir: 'tarefas', botao: 'Ver tarefas', forte: t.prazo < hoje, fixo: true });
    });
    // Contas
    var cm = resumoContasMes(hoje.slice(0, 7));
    cm.linhas.filter(function (l) { return !l.pago; }).forEach(function (l) {
      var dias = Math.round((new Date(l.vence + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
      if (dias > 3) return;
      av.push({ k: 'c-' + l.chave, icone: '🧾', texto: (dias < 0 ? 'Conta atrasada: ' : dias === 0 ? 'Vence hoje: ' : 'Vence em ' + dias + (dias === 1 ? ' dia: ' : ' dias: ')) + l.nome + ' · ' + (l.aproximado ? '≈ ' : '') + fmtMoney(l.valor), ir: 'contas', botao: 'Ver contas', forte: dias <= 0, fixo: true });
    });
    // Insumos
    var ins = calcEstoqueInsumos();
    var acabando = ins.filter(function (l) { return l.dias !== undefined && l.dias !== null && l.dias <= 10; });
    if (acabando.length) av.push({ k: 'acabando', icone: '🛒', texto: 'Hora de comprar: ' + acabando.map(function (l) { return l.nome.replace(/ \((cm|kg)\)$/, '') + ' (' + Math.round(l.dias) + ' dias)'; }).join(', '), ir: 'calc3d', botao: 'Ver estoque', forte: true, fixo: true });
    var semConta = ins.filter(function (l) { return !l.contado; });
    if (semConta.length && !visto('contar')) av.push({ k: 'contar', icone: '🔢', texto: semConta.length + ' insumo(s) ainda sem contagem de estoque: ' + semConta.map(function (l) { return l.nome.replace(/ \((cm|kg)\)$/, ''); }).slice(0, 5).join(', ') + (semConta.length > 5 ? '...' : ''), ir: 'calc3d', botao: 'Contar' });
    var semPreco = ins.filter(function (l) { return l.semPreco; });
    if (semPreco.length && !visto('preco')) av.push({ k: 'preco', icone: '🏷️', texto: 'Falta o preço de: ' + semPreco.map(function (l) { return l.nome.replace(/ \((cm|kg)\)$/, ''); }).join(', ') + '. Sem ele o custo da peça fica menor do que é.', ir: 'calc3d', botao: 'Cadastrar' });
    // Vendas sem custo (7 dias)
    var semCusto = {};
    (state.transacoes || []).forEach(function (t) {
      if (t.tipo !== 'venda' || !t.data || t.data < isoHoje(-6)) return;
      (t.itens || []).forEach(function (i) { if (!custoDoItem(i.item_id, t.data)) semCusto[i.item_id] = i.titulo || i.item_id; });
    });
    var sc = Object.keys(semCusto);
    if (sc.length && !visto('semcusto')) av.push({ k: 'semcusto', icone: '❓', texto: sc.length + ' produto(s) vendidos nesta semana sem custo cadastrado: ' + sc.slice(0, 3).map(function (k) { return String(semCusto[k]).slice(0, 40); }).join('; ') + (sc.length > 3 ? '...' : ''), ir: 'lucro', botao: 'Cadastrar custo' });
    // Automacao
    var h = horasDesdeAtualizacaoAutomacao();
    if (h !== null && h > 3 && new Date().getHours() >= 7) av.unshift({ k: 'auto', icone: '⚠️', texto: 'A automação não atualiza há ' + Math.round(h) + ' horas. As vendas podem estar faltando.', forte: true, fixo: true });
    return av;
  }

  function renderAvisos(wrap) {
    var av = calcAvisos();
    if (!av.length) return;
    var D = dadosProducao(), hoje = isoHoje(0);
    var sec = el('section', { class: 'pml-card avisos', 'aria-label': 'Avisos de hoje' }, [el('p', { class: 'pml-section-title', text: 'Avisos de hoje (' + av.length + ')' })]);
    av.forEach(function (a) {
      var linha = el('div', { class: 'aviso' + (a.forte ? ' forte' : '') }, [
        el('span', { class: 'aviso-icone', text: a.icone }),
        el('span', { class: 'aviso-texto', text: a.texto }),
        el('span', { class: 'aviso-acoes' }, [
          a.acao === 'falha' ? el('button', { class: 'pml-btn', text: 'Lançar falha', onclick: function () { state.abrirFalha = !state.abrirFalha; render(); } }) : null,
          a.ir ? el('button', { class: 'pml-btn' + (a.acao ? ' secondary' : ''), text: a.botao, onclick: function () { state.tab = a.ir; try { history.replaceState(null, '', '#' + a.ir); } catch (e) {} render(); window.scrollTo(0, 0); } }) : null,
          !a.fixo ? el('button', { class: 'pml-btn secondary', text: a.k === 'contar' || a.k === 'preco' || a.k === 'semcusto' ? 'Depois' : 'Não teve hoje', onclick: function () { D.local.vistos[hoje + ':' + a.k] = true; gravarLocal('ml-producao-local', D.local); render(); } }) : null
        ].filter(Boolean))
      ]);
      sec.appendChild(linha);
      if (a.acao === 'falha' && state.abrirFalha) sec.appendChild(el('div', { style: 'padding:8px 0 12px 34px;' }, [formFalha(function () { state.abrirFalha = false; render(); })]));
    });
    sec.appendChild(el('p', { class: 'pml-note', text: 'Pode me mandar tudo isso pelo chat também. O Telegram lembra às 20h.' }));
    wrap.appendChild(sec);
  }
