  // ===================== LUCRO REAL =====================

  // Horas desde a ultima execucao da automacao. Usa o status.json (escrito a cada execucao);
  // a fatura so atualiza a cada 6 horas, entao ela so serve de reserva.
  function horasDesdeAtualizacaoAutomacao() {
    var fonte = (state.statusAuto && state.statusAuto.atualizado_em) || null;
    var folga = 0;
    if (!fonte && state.faturamento && state.faturamento.atualizado_em) { fonte = state.faturamento.atualizado_em; folga = 6; }
    if (!fonte) return null;
    var t = new Date(fonte).getTime();
    if (isNaN(t)) return null;
    return Math.max(0, (Date.now() - t) / 36e5 - folga);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  // dataRef (opcional): data da venda, para a peca 3D usar o preco das compras daquela epoca.
  function custoDoItem(itemId, dataRef) {
    var id = String(itemId || '').trim().toUpperCase();
    var c3d = custo3dDoAnuncio(id, dataRef);
    if (c3d !== null) return { valor: c3d, fonte: '3d' };
    var prod = state.produtos.find(function (p) { return String(p.mlItemId || '').trim().toUpperCase() === id && id; });
    if (prod && prod.custo !== '' && !isNaN(Number(prod.custo))) return { valor: Number(prod.custo), fonte: 'estoque' };
    if (state.custosAvulsos[id] !== undefined && state.custosAvulsos[id] !== '') return { valor: Number(state.custosAvulsos[id]), fonte: 'avulso' };
    return null;
  }

  // Taxas reais de uma venda, vindas da automacao (ML ou Shopee). null = sem dados.
  function custosDaVenda(t) {
    var valor = Number(t.valor) || 0;
    if (t.custosMl) {
      var c = t.custosMl;
      var liq = (c.liquido_recebido !== null && c.liquido_recebido !== undefined) ? Number(c.liquido_recebido) : valor - (Number(c.comissao) || 0) - (Number(c.frete) || 0);
      return { plataforma: 'ml', liquido: liq, comissao: Number(c.comissao) || 0, frete: Number(c.frete) || 0, comissaoPorItem: true };
    }
    if (t.custosShopee) {
      var s = t.custosShopee;
      var taxas = (Number(s.comissao) || 0) + (Number(s.taxa_servico) || 0) + (Number(s.afiliados) || 0) + (Number(s.protecao_frete) || 0);
      var liqS = (s.liquido_recebido !== null && s.liquido_recebido !== undefined) ? Number(s.liquido_recebido) : valor - taxas - (Number(s.frete_vendedor) || 0);
      return { plataforma: 'shopee', liquido: liqS, comissao: taxas, frete: Number(s.frete_vendedor) || 0, comissaoPorItem: false, afiliados: Number(s.afiliados) || 0 };
    }
    return null;
  }

  function limiteDias(dias) {
    var limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - dias + 1);
    return limite.getFullYear() + '-' + String(limite.getMonth() + 1).padStart(2, '0') + '-' + String(limite.getDate()).padStart(2, '0');
  }

  // Gasto com Shopee Ads nos ultimos N dias (vem do ads_shopee.json da automacao).
  function adsShopeeNoPeriodo(dias) {
    var a = state.adsShopee;
    if (!a || !Array.isArray(a.dias)) return null;
    var lim = limiteDias(dias);
    return a.dias.reduce(function (r, d) {
      if (d.data >= lim) { r.gasto += Number(d.gasto) || 0; r.vendas += Number(d.vendas_ads) || 0; }
      return r;
    }, { gasto: 0, vendas: 0 });
  }

  // Junta as vendas dos ultimos N dias por anuncio e calcula o lucro real de cada um.
  // plataforma: 'todas' (padrao), 'ml' ou 'shopee'.
  // intervalo (opcional): { de: 'AAAA-MM-DD', ate: 'AAAA-MM-DD' } no lugar dos ultimos N dias.
  function calcLucroPorProduto(dias, plataforma, intervalo) {
    plataforma = plataforma || 'todas';
    var limiteStr = intervalo ? intervalo.de : limiteDias(dias);
    var ateStr = intervalo ? intervalo.ate : null;
    var imposto = (Number(state.configLucro.imposto) || 0) / 100;
    var alvo = (Number(state.configLucro.margemAlvo) || 0) / 100;
    var grupos = {};
    var semDados = 0;

    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens) || t.data < limiteStr || (ateStr && t.data > ateStr)) return;
      var c = custosDaVenda(t);
      var origem = t.origemId || '';
      if (!c) {
        if (origem.indexOf('api-') === 0) semDados++;
        return;
      }
      if (plataforma !== 'todas' && c.plataforma !== plataforma) return;
      var valor = Number(t.valor) || 0;
      var brutoItens = t.itens.reduce(function (s, i) { return s + (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 1); }, 0);
      t.itens.forEach(function (i) {
        var qtd = Number(i.quantidade) || 1;
        var parte = brutoItens > 0 ? ((Number(i.preco_unitario) || 0) * qtd) / brutoItens : 1 / t.itens.length;
        var id = String(i.item_id || 'sem-id');
        var g = grupos[id] || (grupos[id] = { itemId: id, plataforma: c.plataforma, titulo: i.titulo || id, tipoAnuncio: i.tipo_anuncio || '', unidades: 0, vendas: 0, receita: 0, comissao: 0, frete: 0, liquido: 0, afiliados: 0, custoAcum: 0, semCusto: false });
        g.unidades += qtd;
        var cv = custoDoItem(id, t.data);
        if (cv) { g.custoAcum += cv.valor * qtd; g.fonteVenda = cv.fonte; } else g.semCusto = true;
        g.vendas += 1;
        g.receita += valor * parte;
        g.comissao += c.comissaoPorItem ? (Number(i.comissao) || 0) : c.comissao * parte;
        g.frete += c.frete * parte;
        g.liquido += c.liquido * parte;
        g.afiliados += (c.afiliados || 0) * parte;
      });
    });

    var tarifasDev = typeof tarifasDevolucaoPorItem === 'function' ? tarifasDevolucaoPorItem(limiteStr, ateStr) : {};
    var linhas = Object.keys(grupos).map(function (k) {
      var g = grupos[k];
      g.tarifasDevolucao = tarifasDev[String(g.itemId).toUpperCase()] || 0;
      // Custo de cada venda pelo preco da epoca dela; custoUnit e a media do periodo.
      var custo = g.semCusto ? null : { valor: g.unidades ? g.custoAcum / g.unidades : 0, fonte: g.fonteVenda };
      g.custoUnit = custo ? custo.valor : null;
      g.fonteCusto = custo ? custo.fonte : null;
      g.imposto = g.receita * imposto;
      g.taxasMl = g.receita - g.liquido;
      g.precoMedio = g.unidades ? g.receita / g.unidades : 0;
      if (g.custoUnit !== null) {
        g.custoTotal = g.custoUnit * g.unidades;
        g.lucro = g.liquido - g.imposto - g.custoTotal - g.tarifasDevolucao;
        g.lucroUnit = g.unidades ? g.lucro / g.unidades : 0;
        g.margem = g.receita ? g.lucro / g.receita : null;
        g.roi = g.custoTotal ? g.lucro / g.custoTotal : null;
      } else {
        g.custoTotal = null; g.lucro = null; g.lucroUnit = null; g.margem = null; g.roi = null;
      }
      g.maxCompra = g.unidades ? (g.liquido - g.imposto) / g.unidades - alvo * g.precoMedio : null;
      return g;
    });
    if (typeof aplicarFalhasNoLucro === 'function') aplicarFalhasNoLucro(linhas, limiteStr, ateStr);
    return { linhas: linhas, semDados: semDados };
  }

  function exportarLucroExcel(linhas, dias) {
    if (typeof XLSX === 'undefined') { alertaSimples('Não consegui carregar o gerador de Excel. Confira sua internet.'); return; }
    var rows = linhas.map(function (g) {
      return {
        'Anúncio': g.itemId, 'Produto': g.titulo, 'Tipo': g.tipoAnuncio,
        'Unidades': g.unidades, 'Preço médio': round2(g.precoMedio), 'Faturamento': round2(g.receita),
        'Plataforma': g.plataforma === 'shopee' ? 'Shopee' : 'Mercado Livre', 'Comissão e taxas': round2(g.comissao), 'Frete pago': round2(g.frete), 'Recebido líquido': round2(g.liquido),
        'Imposto': round2(g.imposto), 'Custo unitário': g.custoUnit, 'Custo total': g.custoTotal === null ? null : round2(g.custoTotal),
        'Lucro': g.lucro === null ? null : round2(g.lucro), 'Lucro por unidade': g.lucroUnit === null ? null : round2(g.lucroUnit),
        'Margem %': g.margem === null ? null : round2(g.margem * 100), 'Preço máx. de compra': round2(g.maxCompra)
      };
    });
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lucro real ' + dias + 'd');
    XLSX.writeFile(wb, 'lucro-real-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function alertaSimples(msg) { state.errorMsg = msg; render(); }

