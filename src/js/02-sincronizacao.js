  async function loadData() {
    try {
      var mt = await window.storage.get('ml-metas');
      state.metas = mt ? JSON.parse(mt.value) : {};
    } catch (e) { state.metas = {}; }
    try {
      var p = await window.storage.get('ml-produtos');
      state.produtos = p ? JSON.parse(p.value) : [];
    } catch (e) { state.produtos = []; }
    try {
      var t = await window.storage.get('ml-transacoes');
      state.transacoes = t ? JSON.parse(t.value) : [];
    } catch (e) { state.transacoes = []; }
    try {
      var g = await window.storage.get('ml-gist-url');
      state.gistUrl = g ? g.value : '';
    } catch (e) { state.gistUrl = ''; }
    try {
      var gs = await window.storage.get('ml-gist-url-shopee');
      state.gistUrlShopee = gs ? gs.value : '';
    } catch (e) { state.gistUrlShopee = ''; }
    try {
      var u = await window.storage.get('ml-ultima-sync');
      state.ultimaSincronizacao = u ? u.value : '';
    } catch (e) { state.ultimaSincronizacao = ''; }
    try {
      var us = await window.storage.get('ml-ultima-sync-shopee');
      state.ultimaSincronizacaoShopee = us ? us.value : '';
    } catch (e) { state.ultimaSincronizacaoShopee = ''; }
    try {
      var fa = await window.storage.get('ml-faturamento');
      state.faturamento = fa ? JSON.parse(fa.value) : null;
    } catch (e) { state.faturamento = null; }
    try {
      var lb = await window.storage.get('ml-liberacoes');
      state.liberacoes = lb ? JSON.parse(lb.value) : null;
    } catch (e) { state.liberacoes = null; }
    try {
      var an = await window.storage.get('ml-anuncios');
      state.anunciosMl = an ? JSON.parse(an.value) : null;
    } catch (e) { state.anunciosMl = null; }
    try {
      var dv = await window.storage.get('ml-devolucoes');
      state.devolucoes = dv ? JSON.parse(dv.value) : null;
    } catch (e) { state.devolucoes = null; }
    try {
      var ads = await window.storage.get('ml-ads-shopee');
      state.adsShopee = ads ? JSON.parse(ads.value) : null;
    } catch (e) { state.adsShopee = null; }
    try {
      var ca = await window.storage.get('ml-custos-avulsos');
      state.custosAvulsos = ca ? JSON.parse(ca.value) : {};
    } catch (e) { state.custosAvulsos = {}; }
    try {
      var c3 = await window.storage.get('ml-calc3d');
      if (c3) { var base3 = calc3dPadrao(); var salvo3 = JSON.parse(c3.value); Object.keys(salvo3).forEach(function (k) { base3[k] = salvo3[k]; }); state.calc3d = base3; }
    } catch (e) {}
    try {
      var cl = await window.storage.get('ml-config-lucro');
      if (cl) { var cfg = JSON.parse(cl.value); Object.keys(cfg).forEach(function (k) { state.configLucro[k] = cfg[k]; }); }
    } catch (e) {}
    // A automacao manda a Shopee para o mesmo Gist do ML. Se so o link do ML
    // estiver salvo, descobre o da Shopee sozinho.
    if (!state.gistUrlShopee && state.gistUrl) {
      try {
        var urlShopee = urlArquivoIrmao(state.gistUrl, 'pedidos_shopee.json');
        var teste = await fetch(urlShopee + '?_=' + Date.now());
        if (teste.ok) await salvarGistUrlShopee(urlShopee);
      } catch (e) {}
    }
    state.loaded = true;
    render();
    if (state.gistUrl) { sincronizarGist(true); }
    if (state.gistUrlShopee) { sincronizarGistShopee(true); }
  }

  async function salvarGistUrl(url) {
    state.gistUrl = url;
    try { await window.storage.set('ml-gist-url', url); } catch (e) {}
  }

  async function salvarGistUrlShopee(url) {
    state.gistUrlShopee = url;
    try { await window.storage.set('ml-gist-url-shopee', url); } catch (e) {}
  }

  // O link "raw" do Gist pode vir preso a uma versao antiga (/raw/<codigo>/arquivo).
  // Tirando esse codigo, o painel sempre busca a versao mais recente.
  function urlGistAtual(url) {
    return String(url || '').replace(/\/raw\/[0-9a-f]{40}\//, '/raw/');
  }

  function urlArquivoIrmao(url, nomeArquivo) {
    var base = urlGistAtual(url).split('?')[0];
    return base.replace(/[^\/]+$/, nomeArquivo);
  }

  async function sincronizarFaturamento() {
    if (!state.gistUrl) return;
    try {
      // status.json: hora da ultima execucao da automacao (a fatura so atualiza a cada 6 h)
      var rs = await fetch(urlArquivoIrmao(state.gistUrl, 'status.json') + '?_=' + Date.now());
      if (rs.ok) { var st = await rs.json(); if (st && st.atualizado_em) state.statusAuto = st; }
    } catch (e) {}
    try {
      var r = await fetch(urlArquivoIrmao(state.gistUrl, 'faturamento.json') + '?_=' + Date.now());
      if (!r.ok) return;
      var dados = await r.json();
      if (dados && Array.isArray(dados.periodos)) {
        state.faturamento = dados;
        try { await window.storage.set('ml-faturamento', JSON.stringify(dados)); } catch (e) {}
      }
    } catch (e) {}
  }

  // Estoque e Product Ads dos anuncios do ML (anuncios_ml.json da automacao)
  async function sincronizarAnunciosMl() {
    if (!state.gistUrl) return;
    try {
      var r = await fetch(urlArquivoIrmao(state.gistUrl, 'anuncios_ml.json') + '?_=' + Date.now());
      if (!r.ok) return;
      var dados = await r.json();
      if (dados && Array.isArray(dados.itens)) {
        state.anunciosMl = dados;
        try { await window.storage.set('ml-anuncios', JSON.stringify(dados)); } catch (e) {}
      }
    } catch (e) {}
    try {
      // Relatorio de liberacoes do Mercado Pago (dinheiro que entrou e saiu de cada venda)
      var rl = await fetch(urlArquivoIrmao(state.gistUrl, 'liberacoes_mp.json') + '?_=' + Date.now());
      if (rl.ok) {
        var lb = await rl.json();
        if (lb && lb.pedidos) {
          state.liberacoes = lb;
          try { await window.storage.set('ml-liberacoes', JSON.stringify(lb)); } catch (e) {}
        }
      }
    } catch (e) {}
    try {
      var rd = await fetch(urlArquivoIrmao(state.gistUrl, 'devolucoes.json') + '?_=' + Date.now());
      if (rd.ok) {
        var dv = await rd.json();
        if (dv && Array.isArray(dv.itens)) {
          state.devolucoes = dv;
          try { await window.storage.set('ml-devolucoes', JSON.stringify(dv)); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  async function sincronizarAdsShopee() {
    if (!state.gistUrlShopee) return;
    try {
      var r = await fetch(urlArquivoIrmao(state.gistUrlShopee, 'ads_shopee.json') + '?_=' + Date.now());
      if (!r.ok) return;
      var dados = await r.json();
      if (dados && Array.isArray(dados.dias)) {
        state.adsShopee = dados;
        try { await window.storage.set('ml-ads-shopee', JSON.stringify(dados)); } catch (e) {}
      }
    } catch (e) {}
  }

  async function salvarCustosAvulsos() {
    try { await window.storage.set('ml-custos-avulsos', JSON.stringify(state.custosAvulsos)); } catch (e) {}
  }

  async function salvarConfigLucro() {
    try { await window.storage.set('ml-config-lucro', JSON.stringify(state.configLucro)); } catch (e) {}
  }

  // Historico do ano (historico_ml.json / historico_shopee.json da automacao): vendas de antes da
  // janela de 35 dias. Busca no maximo a cada 6 h e nao baixa o estoque (sao vendas antigas).
  async function sincronizarHistorico(urlGist, nome, prefixo, rotulo) {
    if (!urlGist) return;
    var chave = 'ml-historico-' + nome, agora = Date.now();
    try { var u = await window.storage.get(chave); if (u && agora - Number(u.value) < 6 * 3600 * 1000) return; } catch (e) {}
    try {
      var r = await fetch(urlArquivoIrmao(urlGist, nome) + '?_=' + agora);
      if (!r.ok) return;
      var res = parseApiJson(await r.text(), prefixo, rotulo);
      if (res.erro) return;
      if (res.novas.length) {
        state.transacoes = state.transacoes.concat(res.novas);
        state.transacoes.sort(function (a, b) { return b.data.localeCompare(a.data); });
      }
      if (res.novas.length || res.atualizadas) await saveTransacoes();
      try { await window.storage.set(chave, String(agora)); } catch (e) {}
    } catch (e) {}
  }

  async function sincronizarGist(silencioso) {
    if (!state.gistUrl) return;
    state.sincronizando = true;
    if (!silencioso) render();
    try {
      var urlAtual = urlGistAtual(state.gistUrl);
      var resposta = await fetch(urlAtual + (urlAtual.indexOf('?') === -1 ? '?_=' : '&_=') + Date.now());
      var texto = await resposta.text();
      var resultado = parseApiJson(texto, 'api-ml-', 'Mercado Livre');
      if (!resultado.erro && resultado.novas.length > 0) {
        salvarSnapshotUndo();
        state.transacoes = state.transacoes.concat(resultado.novas);
        state.transacoes.sort(function (a, b) { return b.data.localeCompare(a.data); });
        await saveTransacoes();
        var baixas = baixarEstoquePorVendas(resultado.novas);
        if (baixas.length > 0) {
          await saveProdutos();
          state.ultimaBaixaEstoque = baixas;
        }
      } else if (!resultado.erro && resultado.atualizadas > 0) {
        await saveTransacoes();
      }
      await sincronizarHistorico(state.gistUrl, 'historico_ml.json', 'api-ml-', 'Mercado Livre');
      await sincronizarFaturamento();
      await sincronizarAnunciosMl();
      await sincronizarTarefasCpf();
      state.ultimaSincronizacao = new Date().toLocaleString('pt-BR');
      try { await window.storage.set('ml-ultima-sync', state.ultimaSincronizacao); } catch (e) {}
      state.errorMsg = '';
    } catch (e) {
      state.errorMsg = 'Não consegui sincronizar com a nuvem agora. Confere sua internet ou a URL configurada.';
    }
    state.sincronizando = false;
    render();
  }

  async function sincronizarGistShopee(silencioso) {
    if (!state.gistUrlShopee) return;
    state.sincronizandoShopee = true;
    if (!silencioso) render();
    try {
      var urlAtualShopee = urlGistAtual(state.gistUrlShopee);
      var resposta = await fetch(urlAtualShopee + (urlAtualShopee.indexOf('?') === -1 ? '?_=' : '&_=') + Date.now());
      var texto = await resposta.text();
      var resultado = parseApiJson(texto, 'api-shopee-', 'Shopee');
      if (!resultado.erro && resultado.novas.length > 0) {
        salvarSnapshotUndo();
        state.transacoes = state.transacoes.concat(resultado.novas);
        state.transacoes.sort(function (a, b) { return b.data.localeCompare(a.data); });
        await saveTransacoes();
        var baixas = baixarEstoquePorVendas(resultado.novas);
        if (baixas.length > 0) {
          await saveProdutos();
          state.ultimaBaixaEstoque = baixas;
        }
      } else if (!resultado.erro && resultado.atualizadas > 0) {
        await saveTransacoes();
      }
      await sincronizarHistorico(state.gistUrlShopee, 'historico_shopee.json', 'api-shopee-', 'Shopee');
      await sincronizarAdsShopee();
      state.ultimaSincronizacaoShopee = new Date().toLocaleString('pt-BR');
      try { await window.storage.set('ml-ultima-sync-shopee', state.ultimaSincronizacaoShopee); } catch (e) {}
      state.errorMsg = '';
    } catch (e) {
      state.errorMsg = 'Não consegui sincronizar com a Shopee agora. Confere sua internet ou a URL configurada.';
    }
    state.sincronizandoShopee = false;
    render();
  }

  async function saveProdutos() {
    try {
      await window.storage.set('ml-produtos', JSON.stringify(state.produtos));
    } catch (e) { state.errorMsg = 'Não consegui salvar. Tenta de novo.'; render(); }
  }

  async function saveTransacoes() {
    try {
      await window.storage.set('ml-transacoes', JSON.stringify(state.transacoes));
    } catch (e) { state.errorMsg = 'Não consegui salvar. Tenta de novo.'; render(); }
  }

