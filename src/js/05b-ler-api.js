  // ===================== LEITURA DOS JSON DA AUTOMACAO =====================
  // pedidos_classificados.json (ML) e pedidos_shopee.json: cria ou atualiza as transacoes.

  // Na Shopee o total do pedido inclui o frete que o comprador paga (vai para a Shopee, nao para o
  // vendedor). A venda vale o preco dos produtos; o frete do comprador fica guardado a parte.
  function tirarFreteDoComprador(t) {
    if (!t || (t.tipo !== 'venda' && t.tipo !== 'cancelamento') || String(t.origemId || '').indexOf('shopee') === -1 || !Array.isArray(t.itens)) return false;
    var sub = t.itens.reduce(function (s, i) { return s + (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 1); }, 0);
    sub = Math.round(sub * 100) / 100;
    if (!(sub > 0) || !(Number(t.valor) - sub > 0.01)) return false;
    t.freteComprador = Math.round((Number(t.valor) - sub) * 100) / 100;
    t.valor = sub;
    return true;
  }

  // Kits da Shopee (desde 22/10/2026): a variacao "Kit 2", "3 jogos" ou "+ Secador" e 1 unidade no pedido,
  // mas sao 2, 3 ou 5 pecas. Aqui o item vira N pecas (quantidade x N, preco / N), assim o custo,
  // o estoque e os insumos contam as pecas certas. O SKU do kit termina em -K2, -K3, -K5 ou -COMBO.
  function unidadesDoKit(i) {
    var sku = String(i.sku || '').toUpperCase();
    var m = sku.match(/-K(\d+)$/);
    if (m) return Number(m[1]);
    if (/-COMBO$/.test(sku)) return 2;
    var v = String(i.variacao || '');
    m = v.match(/kit\s*(\d+)/i) || v.match(/(\d+)\s*jogos/i);
    if (m) return Number(m[1]);
    if (/\+\s*secador/i.test(v)) return 2;
    return 1;
  }
  function expandirKits(itens) {
    return itens.map(function (i) {
      var n = unidadesDoKit(i);
      if (n <= 1 || i.kit) return i;
      var novo = Object.assign({}, i);
      novo.kit = n;
      novo.quantidade = (Number(i.quantidade) || 1) * n;
      novo.preco_unitario = Math.round((Number(i.preco_unitario) || 0) / n * 10000) / 10000;
      return novo;
    });
  }

  function parseApiJson(texto, origemPrefix, labelFonte) {
    origemPrefix = origemPrefix || 'api-ml-';
    labelFonte = labelFonte || 'Mercado Livre';
    var novas = [];
    var ignoradas = 0;
    var atualizadas = 0;
    var dados;
    try { dados = JSON.parse(texto); } catch (e) { return { novas: [], ignoradas: 0, atualizadas: 0, erro: true }; }
    if (!Array.isArray(dados)) return { novas: [], ignoradas: 0, atualizadas: 0, erro: true };
    dados.forEach(function (item, i) {
      if (origemPrefix.indexOf('shopee') !== -1 && Array.isArray(item.itens)) item.itens = expandirKits(item.itens);
      var tipo = item.tipo;
      var valor = parseFloat(item.valor);
      var dataRaw = String(item.data || '').trim();
      if (!dataRaw || isNaN(valor) || ['venda', 'compra', 'despesa', 'devolucao', 'cancelamento', 'reembolso'].indexOf(tipo) === -1) {
        ignoradas++; return;
      }
      var data = dataRaw.split('T')[0];
      // Horario da venda (para o mapa de calor), no fuso de quem abre o painel
      var quando = dataRaw.indexOf('T') !== -1 ? new Date(dataRaw) : null;
      var temHora = quando && !isNaN(quando.getTime());
      var origemId = origemPrefix + item.id + '-' + tipo;
      var existente = state.transacoes.find(function (t) { return t.origemId === origemId; });
      // Venda que depois foi cancelada: vira cancelamento (senão contaria a venda e o cancelamento)
      if (!existente && tipo === 'cancelamento') {
        var vendaAntes = state.transacoes.find(function (t) { return t.origemId === origemPrefix + item.id + '-venda'; });
        if (vendaAntes) {
          vendaAntes.tipo = 'cancelamento';
          vendaAntes.origemId = origemId;
          // os itens ficam: se o dinheiro ficou com o vendedor (relatorio de liberacoes), conta como venda
          if (Array.isArray(item.itens)) vendaAntes.itens = item.itens;
          delete vendaAntes.custosMl; delete vendaAntes.custosShopee;
          atualizadas++;
          return;
        }
      }
      if (existente) {
        var mudou = false;
        if (tipo === 'cancelamento' && Array.isArray(item.itens) && !Array.isArray(existente.itens)) {
          existente.itens = item.itens;
          mudou = true;
        }
        if (tipo === 'venda' && Array.isArray(item.itens) && (!Array.isArray(existente.itens) || ((item.custos_ml || item.custos_shopee) && JSON.stringify(existente.itens) !== JSON.stringify(item.itens)))) {
          existente.itens = item.itens;
          mudou = true;
        }
        if (tipo === 'venda' && item.custos_ml && JSON.stringify(existente.custosMl || null) !== JSON.stringify(item.custos_ml)) {
          existente.custosMl = item.custos_ml;
          mudou = true;
        }
        if (tipo === 'venda' && item.custos_shopee && JSON.stringify(existente.custosShopee || null) !== JSON.stringify(item.custos_shopee)) {
          existente.custosShopee = item.custos_shopee;
          mudou = true;
        }
        if (item.status && existente.status !== item.status) { existente.status = item.status; mudou = true; }
        if (tirarFreteDoComprador(existente)) mudou = true;
        if (temHora && existente.hora === undefined) {
          existente.hora = quando.getHours(); existente.dow = quando.getDay(); existente.dataHora = quando.toISOString();
          mudou = true;
        }
        if (mudou) atualizadas++; else ignoradas++;
        return;
      }
      var transacaoNova = {
        id: uid(), origemId: origemId, data: data, tipo: tipo,
        descricao: labelFonte + ' (API) - pedido ' + item.id,
        valor: Math.abs(valor)
      };
      if ((tipo === 'venda' || tipo === 'cancelamento') && Array.isArray(item.itens)) {
        transacaoNova.itens = item.itens;
      }
      if (item.status) transacaoNova.status = item.status;   // Shopee: pedido concluido ou nao (previsao de caixa)
      if ((tipo === 'venda' || tipo === 'cancelamento') && Array.isArray(item.itens)) tirarFreteDoComprador(transacaoNova);
      if (temHora) { transacaoNova.hora = quando.getHours(); transacaoNova.dow = quando.getDay(); transacaoNova.dataHora = quando.toISOString(); }
      if (tipo === 'venda' && item.custos_ml) {
        transacaoNova.custosMl = item.custos_ml;
      }
      if (tipo === 'venda' && item.custos_shopee) {
        transacaoNova.custosShopee = item.custos_shopee;
      }
      novas.push(transacaoNova);
    });
    return { novas: novas, ignoradas: ignoradas, atualizadas: atualizadas };
  }
