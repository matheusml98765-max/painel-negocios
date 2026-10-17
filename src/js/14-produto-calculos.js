  // ===================== CONTAS POR PRODUTO =====================
  // Historico, simulador de desconto, Ads por produto, reposicao e filamento.

  function isoDia(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function mesmoItem(a, b) { return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase(); }

  // Vendas de um anuncio por semana (segunda a domingo), das ultimas N semanas.
  // lucro fica null na semana em que falta o custo ou as taxas de alguma venda.
  function historicoProduto(itemId, semanas, agora) {
    semanas = semanas || 12;
    agora = agora || new Date();
    var hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    var seg = new Date(hoje); seg.setDate(hoje.getDate() - (hoje.getDay() + 6) % 7);
    var semanasLista = [];
    for (var i = semanas - 1; i >= 0; i--) {
      var d = new Date(seg); d.setDate(seg.getDate() - 7 * i);
      semanasLista.push({ inicio: isoDia(d), unidades: 0, receita: 0, liquido: 0, semTaxas: 0 });
    }
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens) || !t.data || t.data < semanasLista[0].inicio) return;
      var alvo = null;
      for (var k = semanasLista.length - 1; k >= 0; k--) { if (t.data >= semanasLista[k].inicio) { alvo = semanasLista[k]; break; } }
      if (!alvo) return;
      var bruto = t.itens.reduce(function (s, i) { return s + (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 1); }, 0);
      var c = custosDaVenda(t);
      t.itens.forEach(function (i) {
        if (!mesmoItem(i.item_id, itemId)) return;
        var qtd = Number(i.quantidade) || 1;
        var parte = bruto > 0 ? (Number(i.preco_unitario) || 0) * qtd / bruto : 1 / t.itens.length;
        alvo.unidades += qtd;
        alvo.receita += (Number(t.valor) || 0) * parte;
        if (c) alvo.liquido += c.liquido * parte; else alvo.semTaxas += qtd;
      });
    });
    var custo = custoDoItem(itemId);
    var imp = (Number(state.configLucro.imposto) || 0) / 100;
    semanasLista.forEach(function (s) {
      s.precoMedio = s.unidades ? s.receita / s.unidades : null;
      s.lucro = (custo && !s.semTaxas) ? s.liquido - s.receita * imp - custo.valor * s.unidades : null;
    });
    return semanasLista;
  }

  // Simula um desconto sobre o preco medio atual, mantendo a % de taxas, o frete
  // por unidade e a taxa fixa por pedido da Shopee que aparecem nas vendas reais.
  function simularDesconto(g, desconto) {
    if (!g || !g.unidades || !g.receita) return null;
    var imp = (Number(state.configLucro.imposto) || 0) / 100;
    var fixoPedido = 0;
    if (g.plataforma === 'shopee') {
      var pl = (getCalc3d().plataformas || []).find(function (p) { return p.id === 'shopee'; });
      fixoPedido = pl ? num(pl.taxaFixa) : 0;
    }
    var fixoUn = fixoPedido * g.vendas / g.unidades;
    var freteUn = g.frete / g.unidades;
    var taxas = g.receita - g.liquido;
    var pct = Math.max(0, (taxas - g.frete - fixoUn * g.unidades) / g.receita);
    var custo = g.custoUnit;
    function conta(preco) {
      var taxasUn = preco * pct + fixoUn + freteUn;
      var lucro = custo === null ? null : preco - taxasUn - preco * imp - custo;
      return { preco: preco, taxas: taxasUn, recebido: preco - taxasUn, lucro: lucro, margem: lucro === null || !preco ? null : lucro / preco };
    }
    var atual = conta(g.precoMedio);
    var novo = conta(g.precoMedio * (1 - desconto));
    var res = { atual: atual, novo: novo, pctTaxas: pct, vendasAMais: null, descontoMaximo: null };
    if (custo !== null) {
      var precoMin = (fixoUn + freteUn + custo) / Math.max(0.01, 1 - pct - imp);
      res.descontoMaximo = Math.max(0, 1 - precoMin / g.precoMedio);
      if (atual.lucro > 0 && novo.lucro > 0) res.vendasAMais = atual.lucro / novo.lucro - 1;
    }
    return res;
  }

  // Shopee Ads por anuncio, comparado com a margem do produto antes do Ads.
  // decisao: 'aumentar' | 'manter' | 'pausar' | 'sem-custo' | 'pouco-dado'
  function calcAdsPorProduto() {
    var a = state.adsShopee;
    if (!a || !a.por_item || !Object.keys(a.por_item).length) return null;
    var dias = Number(a.por_item_dias) || 30;
    var mapa = {};
    calcLucroPorProduto(dias, 'shopee').linhas.forEach(function (g) { mapa[String(g.itemId)] = g; });
    var linhas = Object.keys(a.por_item).map(function (id) {
      var x = a.por_item[id];
      var g = mapa[String(id)] || null;
      var acos = x.vendas > 0 ? x.gasto / x.vendas : null;
      var margem = g && g.margem !== null ? g.margem : null;
      var decisao;
      if (x.vendas === 0 && x.gasto < 15) decisao = 'pouco-dado';
      else if (margem === null) decisao = 'sem-custo';
      else if (acos === null || acos > margem) decisao = 'pausar';
      else if (acos < margem * 0.5) decisao = 'aumentar';
      else decisao = 'manter';
      var nomeCamp = (x.campanhas || []).map(function (c) { return c.nome; }).filter(Boolean)[0];
      return {
        itemId: id, titulo: g ? g.titulo : (nomeCamp || 'Anúncio ' + id), gasto: x.gasto, vendasAds: x.vendas, pedidosAds: x.pedidos,
        cliques: x.cliques, acos: acos, margem: margem, lucro: g ? g.lucro : null,
        lucroDepois: g && g.lucro !== null ? g.lucro - x.gasto : null, decisao: decisao, campanhas: x.campanhas || []
      };
    });
    linhas.sort(function (p, q) { return q.gasto - p.gasto; });
    return { dias: dias, linhas: linhas };
  }

  // Unidades vendidas por anuncio nos ultimos N dias.
  function unidadesPorItem(dias) {
    var lim = limiteDias(dias);
    var u = {};
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens) || t.data < lim) return;
      t.itens.forEach(function (i) {
        var id = String(i.item_id || '').trim().toUpperCase();
        if (id) u[id] = (u[id] || 0) + (Number(i.quantidade) || 1);
      });
    });
    return u;
  }

  // Quanto tempo o estoque cadastrado aguenta e quanto comprar.
  // prazo = dias que o fornecedor leva para entregar; cobrir = dias de venda a garantir depois que chegar.
  function calcReposicao(prazo, cobrir) {
    prazo = prazo || 10; cobrir = cobrir || 30;
    var u = unidadesPorItem(30);
    return state.produtos.filter(function (p) { return p.mlItemId; }).map(function (p) {
      var id = String(p.mlItemId).trim().toUpperCase();
      var qtd = Number(p.quantidade) || 0;
      var porDia = (u[id] || 0) / 30;
      var cobertura = porDia > 0 ? qtd / porDia : null;
      var comprar = porDia > 0 ? Math.max(0, Math.ceil(porDia * (prazo + cobrir) - qtd)) : 0;
      var situacao = porDia === 0 ? 'parado' : (cobertura <= prazo ? 'urgente' : (cobertura <= prazo + 7 ? 'logo' : 'ok'));
      var fim = cobertura === null ? null : new Date(Date.now() + cobertura * 864e5);
      return { produto: p, itemId: id, estoque: qtd, porDia: porDia, cobertura: cobertura, acabaEm: fim, comprar: comprar, situacao: situacao };
    }).sort(function (a, b) {
      return (a.cobertura === null ? 1e9 : a.cobertura) - (b.cobertura === null ? 1e9 : b.cobertura);
    });
  }

  // Ritmo de compra de filamento (pelos lotes da Calculadora 3D) e, quando as pecas
  // tem gramas e anuncios ligados, o consumo real pelas vendas.
  function calcFilamento(agora) {
    agora = agora || new Date();
    var c = state.calc3d;
    if (!c || !Array.isArray(c.filamentos) || c.filamentos.length < 2) return null;
    var lotes = c.filamentos.filter(function (l) { return l.data && num(l.kg) > 0; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (lotes.length < 2) return null;
    var primeiro = new Date(lotes[0].data + 'T12:00:00'), ultimo = new Date(lotes[lotes.length - 1].data + 'T12:00:00');
    var diasEntre = (ultimo - primeiro) / 864e5;
    var kgAntes = lotes.slice(0, -1).reduce(function (s, l) { return s + num(l.kg); }, 0);
    var kgDiaCompra = diasEntre > 0 ? kgAntes / diasEntre : null;
    var u = unidadesPorItem(30), gramas30 = 0, pecasLigadas = 0;
    (c.produtos || []).forEach(function (p) {
      if (!(num(p.gramas) > 0) || !p.anuncios) return;
      pecasLigadas++;
      String(p.anuncios).toUpperCase().split(/[\s,;]+/).forEach(function (id) { if (id) gramas30 += (u[id] || 0) * num(p.gramas); });
    });
    var kgDiaVendas = pecasLigadas && gramas30 > 0 ? gramas30 / 1000 / 30 : null;
    var ritmo = kgDiaVendas || kgDiaCompra;
    var kgUltimo = num(lotes[lotes.length - 1].kg);
    var proxima = ritmo ? new Date(ultimo.getTime() + kgUltimo / ritmo * 864e5) : null;
    return {
      lotes: lotes.length, kgTotal: kgAntes + kgUltimo, kgMesCompra: kgDiaCompra ? kgDiaCompra * 30 : null,
      kgMesVendas: kgDiaVendas ? kgDiaVendas * 30 : null, ultimaCompra: ultimo, kgUltimo: kgUltimo,
      proximaCompra: proxima, diasAteProxima: proxima ? Math.round((proxima - agora) / 864e5) : null,
      fonte: kgDiaVendas ? 'vendas' : 'compras'
    };
  }
