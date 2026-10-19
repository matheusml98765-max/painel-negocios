  function render() {
    destruirGraficos();
    root.innerHTML = '';
    var wrap = el('div', { class: 'pml-wrap' + (state.tab === 'lucro' || state.tab === 'calc3d' || state.tab === 'relatorio' || state.tab === 'calendario' || state.tab === 'cpf' || state.tab === 'contas' ? ' largo' : '') });
    renderHeader(wrap);
    renderTabs(wrap);
    if (!state.loaded) {
      wrap.appendChild(el('div', { class: 'pml-empty', text: 'Carregando seu painel...' }));
      root.appendChild(wrap);
      return;
    }
    if (state.errorMsg) {
      wrap.appendChild(el('div', { class: 'pml-error', text: state.errorMsg }));
    }
    if (sincronizacaoAtrasada()) {
      wrap.appendChild(el('div', { class: 'pml-import-summary', style: 'border:1px solid var(--bad-line); color:var(--bad); margin-bottom:16px;', text: '⚠ A sincronização automática não roda há mais de 2 dias. Confere se a automação no GitHub Actions ainda está rodando, ou sincronize manualmente na aba Importar.' }));
    }
    var horasSemAtualizar = horasDesdeAtualizacaoAutomacao();
    if (horasSemAtualizar !== null && horasSemAtualizar > 6) {
      wrap.appendChild(el('div', { class: 'pml-import-summary', style: 'border:1px solid var(--bad-line); color:var(--bad); margin-bottom:16px;', text: '⚠ A automação do Mercado Livre não manda dados novos há ' + Math.round(horasSemAtualizar) + ' horas. As vendas mais recentes podem não estar aparecendo. Verifique a automação no GitHub (aba Actions).' }));
    }
    if (state.tab === 'estoque' || state.tab === 'financeiro' || state.tab === 'importar') renderMetrics(wrap);
    if (state.tab === 'geral') {
      renderInicio(wrap);
    } else if (state.tab === 'estoque') {
      renderEstoqueTab(wrap);
    } else if (state.tab === 'lucro') {
      renderLucroTab(wrap);
    } else if (state.tab === 'calc3d') {
      renderCalc3dTab(wrap);
    } else if (state.tab === 'tarefas') {
      renderTarefasTab(wrap);
    } else if (state.tab === 'contas') {
      renderContasTab(wrap);
    } else if (state.tab === 'dia') {
      renderMeuDia(wrap);
    } else if (state.tab === 'conquistas') {
      renderConquistasTab(wrap);
    } else if (state.tab === 'receber') {
      renderReceberTab(wrap);
    } else if (state.tab === 'cpf') {
      renderCpfTab(wrap);
    } else if (state.tab === 'relatorio') {
      renderRelatorioTab(wrap);
    } else if (state.tab === 'calendario') {
      renderCalendarioTab(wrap);
    } else if (state.tab === 'financeiro') {
      renderFinanceiroTab(wrap);
    } else {
      renderBackupNuvemCard(wrap);
      renderImportarTab(wrap);
      renderBackupCard(wrap);
    }
    root.appendChild(wrap);
  }

  // Link direto para uma aba (ex.: .../painel-negocios/#relatorio, usado no aviso do Telegram)
  var abaDoLink = (location.hash || '').replace('#', '');
  if (['dia', 'geral', 'lucro', 'calc3d', 'estoque', 'financeiro', 'relatorio', 'calendario', 'tarefas', 'contas', 'receber', 'cpf', 'conquistas', 'importar'].indexOf(abaDoLink) !== -1) state.tab = abaDoLink;

  if (!abaDoLink || /[?&]bomdia=1/.test(location.search)) abrirMeuDiaHoje();
  mostrarIntro();
  loadData();
})();
