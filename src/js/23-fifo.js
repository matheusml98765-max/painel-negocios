  // ===================== CUSTO PELA ORDEM DAS COMPRAS (PEPS) =====================
  // O que foi comprado primeiro e usado primeiro. Ex.: 20 rolos comprados dia 29 so passam a
  // valer quando os rolos anteriores acabarem, nao importa o mes. Cada venda gasta o filamento
  // (gramas do fatiamento + % de perdas) e os insumos da peca (cm de fita, parafusos...).
  //
  // Precisa de uma contagem de estoque (Calculadora 3D > Estoque de insumos): o que sobrou na
  // contagem e o das compras mais recentes. Sem contagem, ou antes dela, vale a regra antiga
  // (preco das compras mais recentes ate a data), em lotesDoPeriodo.

  var memoFifo = { chave: null, filas: {} };

  function nomeFilamentoEstoque(tipo) { return 'Filamento ' + String(tipo || '').toUpperCase() + ' (kg)'; }

  // Lotes de um item, em unidades basicas: filamento em gramas, insumo na unidade cadastrada
  function lotesFifo(chave) {
    var c = getCalc3d();
    if (chave.indexOf('fil:') === 0) {
      var tipo = chave.slice(4);
      return c.filamentos.filter(function (l) { return (l.tipo || '').toUpperCase() === tipo && l.data && num(l.kg) > 0; })
        .map(function (l) { return { data: l.data, qtd: num(l.kg) * 1000, unit: (num(l.preco) + num(l.frete)) / (num(l.kg) * 1000) }; });
    }
    var nome = chave.slice(4);
    return c.embalagens.filter(function (l) { return l.nome === nome && l.data && num(l.qtd) > 0; })
      .map(function (l) { return { data: l.data, qtd: num(l.qtd), unit: (num(l.preco) + num(l.frete)) / num(l.qtd) }; });
  }

  // Quanto deste item cada venda gastou, por dia
  function usoPorDia(chave) {
    var c = getCalc3d();
    var perda = 1 + num(c.perdaPct) / 100;
    var uso = {};
    (state.transacoes || []).forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens) || !t.data) return;
      t.itens.forEach(function (i) {
        var p = pecaDoItem(i.item_id);
        if (!p) return;
        var q = Number(i.quantidade) || 1, g = 0;
        if (chave.indexOf('fil:') === 0) {
          if ((p.tipo || '').toUpperCase() === chave.slice(4)) g = num(p.gramas) / Math.max(1, num(p.porPlaca) || 1) * q * perda;
        } else {
          (p.insumos || []).forEach(function (s) { if (s.nome === chave.slice(4)) g += num(s.qtd) * q; });
        }
        if (g > 0) uso[t.data] = (uso[t.data] || 0) + g;
      });
    });
    if (chave.indexOf('fil:') === 0 && typeof gramasFalhasPorDia === 'function') {
      var gf = gramasFalhasPorDia(chave.slice(4));
      Object.keys(gf).forEach(function (d) { uso[d] = (uso[d] || 0) + gf[d]; });
    }
    return uso;
  }

  function contagemFifo(chave) {
    var est = getCalc3d().estoqueInsumos || {};
    if (chave.indexOf('fil:') === 0) {
      var e = est[nomeFilamentoEstoque(chave.slice(4))];
      return e ? { qtd: num(e.qtd) * 1000, data: e.data } : null;
    }
    var x = est[chave.slice(4)];
    return x ? { qtd: num(x.qtd), data: x.data } : null;
  }

  // Monta a fila de um item: preco usado em cada dia de venda e o que sobra agora, lote a lote
  function montarFila(chave) {
    var cont = contagemFifo(chave);
    var lotes = lotesFifo(chave).sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    if (!cont || !lotes.length) return null;
    // A contagem vale para o fim do dia: as vendas daquele dia ja sairam dela, e uma compra
  // feita no mesmo dia ainda nao chegou (entra depois). O que sobrou e das compras anteriores.
    var fila = [], falta = cont.qtd;
    lotes.filter(function (l) { return l.data < cont.data; }).reverse().forEach(function (l) {
      if (falta <= 0) return;
      var q = Math.min(l.qtd, falta); falta -= q;
      fila.unshift({ data: l.data, qtd: q, unit: l.unit });
    });
    if (falta > 0) fila.unshift({ data: cont.data, qtd: falta, unit: (lotes.filter(function (l) { return l.data < cont.data; })[0] || lotes[0]).unit, semCompra: true });
    var depois = lotes.filter(function (l) { return l.data >= cont.data; });
    var uso = usoPorDia(chave);
    var dias = Object.keys(uso).filter(function (d) { return d > cont.data; }).concat(depois.map(function (l) { return l.data; }));
    dias = dias.filter(function (d, i) { return dias.indexOf(d) === i; }).sort();
    var precoDia = {}, faltou = 0, ultimo = lotes[lotes.length - 1].unit;
    dias.forEach(function (d) {
      depois.forEach(function (l) { if (l.data === d) fila.push({ data: l.data, qtd: l.qtd, unit: l.unit }); });
      var precisa = uso[d] || 0, pago = 0, gasto = 0;
      while (precisa > 1e-9 && fila.length) {
        var f = fila[0], q = Math.min(f.qtd, precisa);
        pago += q * f.unit; gasto += q; f.qtd -= q; precisa -= q;
        if (f.qtd <= 1e-9) fila.shift();
      }
      if (precisa > 1e-9) { faltou += precisa; pago += precisa * ultimo; gasto += precisa; }
      if (gasto > 0) precoDia[d] = pago / gasto;
    });
    return { desde: cont.data, precoDia: precoDia, fila: fila, sobra: fila.reduce(function (s, f) { return s + f.qtd; }, 0) - faltou, faltou: faltou, ultimo: ultimo };
  }

  function filaFifo(chave) {
    var c = getCalc3d();
    var k = (state.transacoes || []).length + '|' + JSON.stringify([c.filamentos, c.embalagens, c.produtos, c.estoqueInsumos, c.perdaPct, typeof dadosProducao === 'function' ? dadosProducao().falhas : 0]).length;
    if (memoFifo.chave !== k) memoFifo = { chave: k, filas: {} };
    if (!(chave in memoFifo.filas)) memoFifo.filas[chave] = montarFila(chave);
    return memoFifo.filas[chave];
  }

  // Preco por unidade basica (g ou unidade) pela ordem das compras; null = usar a regra antiga
  function precoFifo(chave, dataRef) {
    var f = filaFifo(chave);
    var d = dataRef || isoHoje(0);
    if (!f || d < f.desde) return null;
    if (f.precoDia[d] !== undefined) return f.precoDia[d];
    // Dia sem venda (ou hoje): o lote que esta sendo usado agora
    return f.fila.length ? f.fila[0].unit : f.ultimo;
  }
