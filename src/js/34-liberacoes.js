  // ===================== LIBERACOES DO MERCADO PAGO =====================
  // O dinheiro que entrou e saiu de verdade em cada venda do ML (liberacoes_mp.json da automacao,
  // o mesmo relatorio de "Relatorios > Liberacoes" do Mercado Pago). Quando a venda ja foi liberada,
  // ele vale mais que a API: inclui o frete devolvido em linha separada, a devolucao descontada dias
  // depois e a reclamacao encerrada a favor do vendedor. Venda ainda nao liberada usa a API.

  function pedidoMlDe(t) {
    var m = /^api-ml-(\d+)-/.exec((t && t.origemId) || '');
    return m ? m[1] : null;
  }

  function liberacaoDoPedido(t) {
    var L = state.liberacoes;
    if (!L || !L.pedidos) return null;
    var id = pedidoMlDe(t);
    return id ? (L.pedidos[id] || null) : null;
  }

  // total: tudo o que o pedido deixou na conta. devolvido: o comprador recebeu o dinheiro de volta
  // (o produto voltou, entao o custo dele nao conta; fica so o prejuizo do frete e das taxas).
  function vendaPeloExtrato(t) {
    var l = liberacaoDoPedido(t);
    if (!l) return null;
    var dev = Number(l.devolucao) || 0;
    var total = round2((Number(l.liquido) || 0) + dev + (Number(l.outros) || 0));
    var teveDev = Math.abs(dev) > 0.005;
    return { liquido: total, comDevolucao: teveDev, devolvido: teveDev && total <= 0.01 };
  }

  // Cancelamento em que o dinheiro ficou com o vendedor (ex.: reclamacao encerrada a favor dele e
  // produto descartado pelo ML): na pratica e uma venda, e o produto foi embora.
  function cancelamentoQueFicou(t) {
    if (!t || t.tipo !== 'cancelamento' || !Array.isArray(t.itens) || !t.itens.length) return null;
    var e = vendaPeloExtrato(t);
    return e && e.liquido > 0.5 ? e : null;
  }

  // Tarifa de antecipacao cobrada de verdade no intervalo. null = o relatorio nao cobre esses dias.
  function antecipacaoNoIntervalo(de, ate) {
    var L = state.liberacoes;
    if (!L || !L.antecipacao || !Array.isArray(L.cobertura)) return null;
    var ontem = isoHoje(-1);
    var fim = ate < ontem ? ate : ontem;
    var coberto = L.cobertura.some(function (c) { return c[0] <= de && c[1] >= fim; });
    if (!coberto) return null;
    return Object.keys(L.antecipacao).reduce(function (s, d) {
      return d >= de && d <= ate ? s + (Number(L.antecipacao[d]) || 0) : s;
    }, 0);
  }
