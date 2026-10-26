  // ===================== LUCRO POR LOJA =====================
  // Mercado Livre e Shopee lado a lado: faturamento, recebido, lucro dos produtos, Ads e o que sobrou.

  // Ads de uma loja no periodo. Shopee: gasto da conta por dia (ads_shopee.json).
  // ML: Product Ads de cada anuncio (anuncios_ml.json), proporcional aos dias.
  function adsDaLoja(plat, dias) {
    if (plat === 'shopee') {
      var sp = adsShopeeNoPeriodo(dias);
      return sp ? sp.gasto : null;
    }
    var ml = state.anunciosMl && state.anunciosMl.ads;
    if (!ml || !ml.por_item || !Object.keys(ml.por_item).length) return null;
    var base = Number(ml.dias) || 30;
    return Object.keys(ml.por_item).reduce(function (s, id) { return s + (Number(ml.por_item[id].gasto) || 0); }, 0) * (dias / base);
  }

  function calcLucroPorLoja(dias) {
    return ['ml', 'shopee'].map(function (plat) {
      var linhas = calcLucroPorProduto(dias, plat).linhas;
      var t = linhas.reduce(function (a, g) {
        a.receita += g.receita; a.liquido += g.liquido; a.unidades += g.unidades; a.imposto += g.imposto;
        if (g.lucro !== null) { a.lucro += g.lucro; a.receitaComCusto += g.receita; } else a.semCusto++;
        return a;
      }, { plataforma: plat, receita: 0, liquido: 0, unidades: 0, imposto: 0, lucro: 0, receitaComCusto: 0, semCusto: 0 });
      t.produtos = linhas.length;
      t.ads = adsDaLoja(plat, dias);
      t.depoisAds = t.lucro - (t.ads || 0);
      t.margem = t.receitaComCusto ? t.depoisAds / t.receitaComCusto : null;
      t.taxas = t.receita - t.liquido;
      return t;
    });
  }

  function renderLucroPorLoja(wrap, dias) {
    var lojas = calcLucroPorLoja(dias);
    if (!lojas.some(function (l) { return l.produtos > 0; })) return;
    var periodo = dias === 1 ? 'hoje' : 'últimos ' + dias + ' dias';
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Lucro por loja (' + periodo + ')' }));
    var grade = el('div', { class: 'pml-lojas' });
    lojas.forEach(function (l) {
      var nome = l.plataforma === 'ml' ? 'Mercado Livre' : 'Shopee';
      var bloco = el('div', { class: 'pml-loja pml-loja-' + l.plataforma });
      bloco.appendChild(el('p', { class: 'pml-loja-nome', text: nome }));
      if (!l.produtos) {
        bloco.appendChild(el('p', { class: 'pml-margin', text: 'Sem vendas com as taxas da plataforma neste período.' }));
        grade.appendChild(bloco);
        return;
      }
      function linha(rotulo, valor, classe, dica) {
        return el('div', { class: 'pml-loja-linha' + (classe ? ' ' + classe : ''), title: dica || '' }, [el('span', { text: rotulo }), el('b', { text: valor })]);
      }
      bloco.appendChild(linha('Faturamento', fmtMoney(l.receita), '', l.unidades + ' unidades vendidas'));
      bloco.appendChild(linha('Taxas e frete da plataforma', '− ' + fmtMoney(l.taxas) + ' (' + fmtPct(l.receita ? l.taxas / l.receita : 0) + ')'));
      bloco.appendChild(linha('Você recebeu', fmtMoney(l.liquido)));
      bloco.appendChild(linha('Lucro dos produtos', fmtMoney(l.lucro), '', 'Recebido − imposto − custo das peças'));
      bloco.appendChild(linha(l.plataforma === 'ml' ? 'Product Ads' : 'Shopee Ads', l.ads === null ? 'sem dados' : '− ' + fmtMoney(l.ads)));
      bloco.appendChild(linha('Lucro depois do Ads', fmtMoney(l.depoisAds), 'pml-loja-total ' + (l.depoisAds >= 0 ? 'pos' : 'neg')));
      bloco.appendChild(el('p', { class: 'pml-margin', text: 'margem real ' + fmtPct(l.margem) + (l.semCusto ? ' · ' + l.semCusto + ' produto(s) sem custo ficaram fora do lucro' : '') + (l.ads === null ? ' · Ads ainda não chegou pela automação' : '') }));
      grade.appendChild(bloco);
    });
    card.appendChild(grade);
    var soma = lojas.reduce(function (s, l) { return s + l.depoisAds; }, 0);
    card.appendChild(el('p', { class: 'pml-note', text: 'As duas lojas juntas: ' + fmtMoney(soma) + ' de lucro depois do Ads. Imposto de ' + state.configLucro.imposto + '% já descontado. Custos fixos do mês (contador, Nubimetrics, parcelamento do Simples) e a fatura do ML (armazenagem Full, antecipação) ficam fora, como no resto da aba.' }));
    wrap.appendChild(card);
  }
