  // Fora do ambiente do Claude (ex: GitHub Pages), window.storage não existe.
  // Este polyfill usa o localStorage do navegador nesse caso, sem mudar o resto do código.
  if (!window.storage) {
    window.storage = {
      get: function (key) {
        var v = localStorage.getItem('pml_' + key);
        return Promise.resolve(v === null ? null : { key: key, value: v });
      },
      set: function (key, value) {
        localStorage.setItem('pml_' + key, value);
        return Promise.resolve({ key: key, value: value });
      }
    };
  }

  var root = document.getElementById('app-root');
  var state = { tab: 'geral', produtos: [], transacoes: [], loaded: false, errorMsg: '', gistUrl: '', gistUrlShopee: '', ultimaSincronizacao: '', ultimaSincronizacaoShopee: '', sincronizando: false, sincronizandoShopee: false, confirmarLimpeza: false, editandoProdutoId: null, ultimaBaixaEstoque: [], faturamento: null, adsShopee: null, custosAvulsos: {}, configLucro: { imposto: 4, margemAlvo: 25, dias: 30, ordem: 'receita', plataforma: 'todas' }, fatPeriodo: '', calc3d: null, metas: {}, editandoMeta: false, statusAuto: null, fichaProduto: null, simDesconto: 10, relMes: '', anunciosMl: null, devolucoes: null, mesLuz: '', cpfMes: '', tarefasRemotas: null, cpfRemoto: null, contasRemotas: null, contasMes: '', comprasVisao: 'semana', diaVendas: '', atualizandoAgora: null, pedirTokenAtualizar: false, erroToken: '', producaoRemota: null, abrirFalha: false };

  function fmtMoney(n) {
    var v = Number(n);
    if (isNaN(v)) v = 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var pilhaUndo = [];
  var pilhaRedo = [];

  function estadoAtualSnapshot() {
    return {
      produtos: JSON.parse(JSON.stringify(state.produtos)),
      transacoes: JSON.parse(JSON.stringify(state.transacoes))
    };
  }

  function salvarSnapshotUndo() {
    pilhaUndo.push(estadoAtualSnapshot());
    if (pilhaUndo.length > 20) pilhaUndo.shift();
    pilhaRedo = [];
  }

  function desfazer() {
    if (pilhaUndo.length === 0) return;
    pilhaRedo.push(estadoAtualSnapshot());
    var anterior = pilhaUndo.pop();
    state.produtos = anterior.produtos;
    state.transacoes = anterior.transacoes;
    saveProdutos();
    saveTransacoes();
    render();
  }

  function refazer() {
    if (pilhaRedo.length === 0) return;
    pilhaUndo.push(estadoAtualSnapshot());
    var proximo = pilhaRedo.pop();
    state.produtos = proximo.produtos;
    state.transacoes = proximo.transacoes;
    saveProdutos();
    saveTransacoes();
    render();
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      var alvo = e.target;
      var digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT' || alvo.tagName === 'TEXTAREA');
      if (!digitando) {
        e.preventDefault();
        if (e.shiftKey) { refazer(); } else { desfazer(); }
      }
    }
  });

