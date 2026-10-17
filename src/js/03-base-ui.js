  var NOMES_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function calcSeriesMensais() {
    var porMes = {};
    state.transacoes.forEach(function (t) {
      var mesKey = String(t.data).slice(0, 7);
      if (!mesKey || mesKey.length !== 7) return;
      if (!porMes[mesKey]) porMes[mesKey] = { vendas: 0, saidas: 0 };
      if (t.tipo === 'venda') porMes[mesKey].vendas += Number(t.valor) || 0;
      else porMes[mesKey].saidas += Number(t.valor) || 0;
    });
    var chaves = Object.keys(porMes).sort();
    return chaves.map(function (k) {
      var partes = k.split('-');
      var mesIdx = parseInt(partes[1], 10) - 1;
      return { mes: k, label: NOMES_MESES[mesIdx] + '/' + partes[0].slice(2), vendas: porMes[k].vendas, saidas: porMes[k].saidas };
    });
  }

  function renderGraficoVendas(wrap) {
    var serie = calcSeriesMensais();
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Vendas por mês' }));
    if (serie.length === 0) {
      card.appendChild(el('div', { class: 'pml-empty', text: 'Ainda não há vendas suficientes para mostrar um gráfico.' }));
      wrap.appendChild(card);
      return;
    }
    var maxValor = Math.max.apply(null, serie.map(function (s) { return Math.max(s.vendas, s.saidas); })) || 1;
    var largura = Math.max(320, serie.length * 90);
    var altura = 220;
    var baseY = altura - 30;
    var alturaUtil = baseY - 20;
    var larguraGrupo = largura / serie.length;

    var svgPartes = [];
    svgPartes.push('<svg viewBox="0 0 ' + largura + ' ' + altura + '" style="width:100%; height:auto; max-width:' + largura + 'px; font-family:inherit;">');
    svgPartes.push('<line x1="0" y1="' + baseY + '" x2="' + largura + '" y2="' + baseY + '" stroke="var(--line)" stroke-width="1" />');
    serie.forEach(function (s, i) {
      var cx = i * larguraGrupo + larguraGrupo / 2;
      var barW = Math.min(28, larguraGrupo * 0.28);
      var hVenda = (s.vendas / maxValor) * alturaUtil;
      var hSaida = (s.saidas / maxValor) * alturaUtil;
      var xVenda = cx - barW - 3;
      var xSaida = cx + 3;
      svgPartes.push('<rect x="' + xVenda + '" y="' + (baseY - hVenda) + '" width="' + barW + '" height="' + hVenda + '" fill="var(--good)" rx="2" />');
      svgPartes.push('<rect x="' + xSaida + '" y="' + (baseY - hSaida) + '" width="' + barW + '" height="' + hSaida + '" fill="var(--bad)" rx="2" />');
      svgPartes.push('<text x="' + cx + '" y="' + (baseY + 16) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + s.label + '</text>');
    });
    svgPartes.push('</svg>');

    var svgWrap = el('div', { style: 'overflow-x:auto;' });
    svgWrap.innerHTML = svgPartes.join('');
    card.appendChild(svgWrap);

    var legenda = el('div', { style: 'display:flex; gap:16px; margin-top:10px; font-size:12px; color:var(--muted);' });
    legenda.innerHTML = '<span><span style="display:inline-block; width:10px; height:10px; background:var(--good); border-radius:2px; margin-right:5px;"></span>Vendas</span><span><span style="display:inline-block; width:10px; height:10px; background:var(--bad); border-radius:2px; margin-right:5px;"></span>Saídas (custos, reembolsos, cancelamentos etc)</span>';
    card.appendChild(legenda);
    wrap.appendChild(card);
  }

  function calcMetrics() {
    var valorEstoque = state.produtos.reduce(function (sum, p) {
      return sum + (Number(p.custo) || 0) * (Number(p.quantidade) || 0);
    }, 0);
    var qtdProdutos = state.produtos.length;

    var now = new Date();
    var mesAtual = now.getMonth();
    var anoAtual = now.getFullYear();
    var entradasMes = 0, saidasMes = 0;
    state.transacoes.forEach(function (t) {
      var d = new Date(t.data + 'T00:00:00');
      if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
        if (t.tipo === 'venda') entradasMes += Number(t.valor) || 0;
        else saidasMes += Number(t.valor) || 0;
      }
      // compra, despesa, devolucao, cancelamento e reembolso contam como saída do mês
    });
    var saldoMes = entradasMes - saidasMes;
    var entradasTotal = 0, saidasTotal = 0;
    state.transacoes.forEach(function (t) {
      if (t.tipo === 'venda') entradasTotal += Number(t.valor) || 0;
      else saidasTotal += Number(t.valor) || 0;
    });
    var saldoTotal = entradasTotal - saidasTotal;
    return { valorEstoque: valorEstoque, qtdProdutos: qtdProdutos, saldoMes: saldoMes, saldoTotal: saldoTotal };
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function renderHeader(wrap) {
    var acoes = el('div', { class: 'pml-header-acoes' });
    if (pilhaUndo.length > 0 || pilhaRedo.length > 0) {
      acoes.appendChild(el('button', {
        class: 'pml-tema-btn', style: pilhaUndo.length === 0 ? 'opacity:0.45; cursor:default;' : '', text: '↩ Desfazer',
        onclick: function () { if (pilhaUndo.length > 0) desfazer(); }
      }));
      acoes.appendChild(el('button', {
        class: 'pml-tema-btn', style: pilhaRedo.length === 0 ? 'opacity:0.45; cursor:default;' : '', text: 'Refazer ↪',
        onclick: function () { if (pilhaRedo.length > 0) refazer(); }
      }));
    }
    var escuro = temaAtual() === 'dark';
    acoes.appendChild(el('button', {
      class: 'pml-tema-btn', 'aria-label': escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro',
      text: escuro ? '☀️ Tema claro' : '🌙 Tema escuro',
      onclick: function () { aplicarTema(escuro ? 'light' : 'dark'); render(); }
    }));
    var header = el('header', { class: 'pml-header' }, [
      el('div', { class: 'pml-marca' }, [
        el('div', { class: 'pml-logo', 'aria-hidden': 'true', text: 'TB' }),
        el('div', {}, [
          el('p', { class: 'pml-title', text: NOME_LOJA }),
          el('p', { class: 'pml-subtitle', text: 'Mercado Livre, Shopee e impressão 3D num lugar só' })
        ])
      ]),
      acoes
    ]);
    wrap.appendChild(header);
  }

  function renderTabs(wrap) {
    var tabs = el('div', { class: 'pml-tabs' });
    [['geral', 'Início'], ['lucro', 'Lucro real'], ['calc3d', 'Calculadora 3D'], ['estoque', 'Estoque'], ['financeiro', 'Financeiro'], ['relatorio', 'Relatório'], ['tarefas', 'Tarefas'], ['contas', 'Contas'], ['receber', 'A receber'], ['cpf', 'CPF'], ['conquistas', 'Conquistas'], ['importar', 'Importar']].forEach(function (t) {
      var btn = el('button', {
        class: 'pml-tab' + (state.tab === t[0] ? ' active' : ''),
        text: t[1],
        onclick: function () { state.tab = t[0]; render(); }
      });
      tabs.appendChild(btn);
    });
    wrap.appendChild(tabs);
  }

  function fonteAtrasada(url, ultimaSync) {
    if (!url) return false;
    if (!ultimaSync) return true;
    var partes = ultimaSync.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/);
    if (!partes) return false;
    var dataSync = new Date(partes[3], partes[2] - 1, partes[1], partes[4], partes[5]);
    var horasPassadas = (Date.now() - dataSync.getTime()) / (1000 * 60 * 60);
    return horasPassadas > 48;
  }

  function sincronizacaoAtrasada() {
    return fonteAtrasada(state.gistUrl, state.ultimaSincronizacao) || fonteAtrasada(state.gistUrlShopee, state.ultimaSincronizacaoShopee);
  }

  function renderMetrics(wrap) {
    var m = calcMetrics();
    var grid = el('div', { class: 'pml-metrics' }, [
      el('div', { class: 'pml-metric' }, [
        el('p', { class: 'pml-metric-label', text: 'Valor em estoque (custo)' }),
        el('p', { class: 'pml-metric-value', text: fmtMoney(m.valorEstoque) })
      ]),
      el('div', { class: 'pml-metric' }, [
        el('p', { class: 'pml-metric-label', text: 'Produtos cadastrados' }),
        el('p', { class: 'pml-metric-value', text: String(m.qtdProdutos) })
      ]),
      el('div', { class: 'pml-metric' }, [
        el('p', { class: 'pml-metric-label', text: 'Saldo do mês' }),
        el('p', { class: 'pml-metric-value ' + (m.saldoMes >= 0 ? 'pos' : 'neg'), text: fmtMoney(m.saldoMes) })
      ]),
      el('div', { class: 'pml-metric' }, [
        el('p', { class: 'pml-metric-label', text: 'Saldo total (todo o período importado)' }),
        el('p', { class: 'pml-metric-value ' + (m.saldoTotal >= 0 ? 'pos' : 'neg'), text: fmtMoney(m.saldoTotal) })
      ])
    ]);
    wrap.appendChild(grid);
  }

