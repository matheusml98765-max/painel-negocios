  // ===================== SIMULADOR DE KITS (SHOPEE) =====================
  // A Shopee cobra uma taxa fixa por pedido (R$ 4,50) alem da porcentagem. Num kit de 2 ou 3
  // unidades a taxa fixa e paga uma vez so. A porcentagem de cada produto sai das vendas reais
  // dos ultimos 30 dias: (taxas - taxa fixa x pedidos) / vendido. Imposto e custo como no lucro.

  var TAXA_FIXA_SHOPEE = 4.5;
  var KITS = [{ n: 1, desc: 0 }, { n: 2, desc: 0.05 }, { n: 3, desc: 0.08 }];

  function calcKits(dias) {
    var imp = (Number(state.configLucro.imposto) || 0) / 100;
    return calcLucroPorProduto(dias || 30, 'shopee').linhas.filter(function (g) {
      return g.custoUnit !== null && g.unidades >= 5 && g.receita > 0;
    }).map(function (g) {
      var pedidos = Math.max(1, g.vendas || g.unidades);
      var preco = g.receita / g.unidades;
      var pct = Math.max(0, ((g.receita - g.liquido) - TAXA_FIXA_SHOPEE * pedidos) / g.receita);
      var op = KITS.map(function (k) {
        var precoKit = k.n * preco * (1 - k.desc);
        var lucroKit = precoKit * (1 - pct - imp) - TAXA_FIXA_SHOPEE - k.n * g.custoUnit;
        return { n: k.n, desc: k.desc, preco: precoKit, lucroKit: lucroKit, porUnidade: lucroKit / k.n };
      });
      return { itemId: g.itemId, titulo: g.titulo, unidades: g.unidades, preco: preco, pct: pct, custo: g.custoUnit, op: op };
    }).sort(function (a, b) { return b.unidades - a.unidades; });
  }

  function renderKitsCard(wrap) {
    var lista = calcKits(30);
    if (!lista.length) return;
    var card = el('div', { class: 'pml-card' }, [
      el('p', { class: 'pml-section-title', text: 'Kits na Shopee: quanto sobra vendendo 2 ou 3 juntos' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 10px;', text: 'A taxa fixa de ' + fmtMoney(TAXA_FIXA_SHOPEE) + ' é cobrada uma vez por pedido. No kit ela se divide entre as unidades, então dá para dar um desconto e ainda lucrar mais. Simulação com as taxas reais de cada produto (30 dias): kit de 2 com 5% de desconto e kit de 3 com 8%.' })
    ]);
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, ['Produto', '1 unidade', 'Kit de 2', 'Kit de 3', 'Ganho por unidade no kit de 2'].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); })));
    lista.forEach(function (k) {
      var g2 = k.op[1].porUnidade - k.op[0].porUnidade;
      function cel(o) {
        return el('td', { class: 'num' }, [
          el('div', { style: 'font-weight:700; color:' + (o.lucroKit >= 0 ? 'var(--good)' : 'var(--bad)'), text: fmtMoney(o.lucroKit) }),
          el('div', { class: 'pml-margin', text: 'vende a ' + fmtMoney(o.preco) + (o.n > 1 ? ' · ' + fmtMoney(o.porUnidade) + '/un.' : '') })
        ]);
      }
      t.appendChild(el('tr', {}, [
        el('td', {}, [el('div', { text: k.titulo }), el('div', { class: 'pml-margin', text: k.unidades + ' vendidas · taxa ' + fmtPct(k.pct) + ' + ' + fmtMoney(TAXA_FIXA_SHOPEE) + ' por pedido · custo ' + fmtMoney(k.custo) })]),
        cel(k.op[0]), cel(k.op[1]), cel(k.op[2]),
        el('td', { class: 'num', style: 'font-weight:700; color:' + (g2 >= 0 ? 'var(--good)' : 'var(--bad)'), text: (g2 >= 0 ? '+' : '') + fmtMoney(g2) + (k.op[0].porUnidade > 0 ? ' (' + (g2 >= 0 ? '+' : '') + fmtPct(g2 / k.op[0].porUnidade) + ')' : '') })
      ]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    card.appendChild(el('p', { class: 'pml-note', text: 'Cada valor é o lucro do pedido inteiro, já sem taxas, imposto e custo, e antes do Ads. No kit, a embalagem pode sair mais barata (1 saco e 1 etiqueta para tudo). Na Shopee dá para criar o kit como variação do anúncio ("2 unidades") ou usar o Desconto por quantidade ("leve 2, pague menos").' }));
    wrap.appendChild(card);
  }
