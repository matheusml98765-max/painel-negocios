  // ===================== ESCADA DO LUCRO =====================
  // Do faturamento ao bolso, degrau por degrau (definicao do Matheus):
  //   lucro da operacao = vendas - taxas/frete - imposto - custo dos produtos (- devolucoes e falhas)
  //   lucro real        = lucro da operacao - Ads ML - Ads Shopee - antecipacao - Full - outras cobrancas da fatura
  //   sobrou no bolso   = lucro real - contas fixas da loja (contador, parcelamento do Simples, assinaturas)
  // Investimentos (impressoras, curso) aparecem a parte. Comissao, frete e parcelamento da fatura ja
  // saem venda a venda (valor liquido do Mercado Pago), por isso nao entram de novo.

  var FATURA_FORA_DA_VENDA = { 'Antecipação': 'antecipacao', 'Publicidade': 'adsMl', 'Full': 'full', 'Outros': 'outros' };

  function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000) + 1; }

  // Cobrancas da fatura do ML que nao vem em cada venda, proporcionais aos dias do intervalo
  function faturaNoIntervalo(de, ate) {
    var r = { antecipacao: 0, adsMl: 0, full: 0, outros: 0, temDados: false };
    var fat = state.faturamento, hoje = isoHoje(0);
    if (!fat || !Array.isArray(fat.periodos)) return r;
    fat.periodos.forEach(function (p) {
      if (!p.de || !p.ate || !(p.linhas || []).length) return;
      var fimReal = p.ate > hoje ? hoje : p.ate;          // fatura aberta: so ate hoje
      var ini = de > p.de ? de : p.de, fim = ate < fimReal ? ate : fimReal;
      if (ini > fim) return;
      var parte = diasEntre(ini, fim) / Math.max(1, diasEntre(p.de, fimReal));
      p.linhas.forEach(function (l) {
        var k = FATURA_FORA_DA_VENDA[l.categoria];
        if (k && l.valor > 0) { r[k] += l.valor * parte; r.temDados = true; }
      });
    });
    return r;
  }

  function calcEscada(de, ate) {
    var calc = calcLucroPorProduto(null, 'todas', { de: de, ate: ate });
    var t = { receita: 0, liquido: 0, imposto: 0, custo: 0, lucro: 0, receitaSemCusto: 0, semCusto: 0 };
    var outrosVenda = 0;
    calc.linhas.forEach(function (g) {
      if (g.lucro === null) { t.receitaSemCusto += g.receita; t.semCusto++; return; }
      t.receita += g.receita; t.liquido += g.liquido;
      t.imposto += g.imposto; t.custo += g.custoTotal; t.lucro += g.lucro;
      outrosVenda += g.liquido - g.imposto - g.custoTotal - g.lucro;   // tarifas de devolucao e falhas
    });
    var adsSp = 0;
    ((state.adsShopee && state.adsShopee.dias) || []).forEach(function (d) { if (d.data >= de && d.data <= ate) adsSp += Number(d.gasto) || 0; });
    var fat = faturaNoIntervalo(de, ate);
    var lucroReal = t.lucro - adsSp - fat.adsMl - fat.antecipacao - fat.full - fat.outros;

    // Contas do mes do fim do intervalo: fixas da loja x investimentos (o DAS ja esta no imposto)
    var fixas = 0, invest = 0, listaFixas = [], listaInvest = [];
    resumoContasMes(ate.slice(0, 7)).linhas.forEach(function (l) {
      if (l.quem !== 'empresa' || l.das) return;
      var itens = l.cartao ? l.itens.filter(function (i) { return (i.conta.de || 'empresa') === 'empresa'; }).map(function (i) { return { nome: i.conta.nome, valor: i.valor, cat: i.conta.categoria }; }) : [{ nome: l.nome, valor: l.valor, cat: l.categoria }];
      itens.forEach(function (i) {
        if (/Equipamento|Curso/i.test(i.cat || '')) { invest += i.valor; listaInvest.push(i); } else { fixas += i.valor; listaFixas.push(i); }
      });
    });
    return {
      de: de, ate: ate, t: t, outrosVenda: outrosVenda, adsShopee: adsSp, fatura: fat, lucroReal: lucroReal,
      fixas: fixas, listaFixas: listaFixas, invest: invest, listaInvest: listaInvest, bolso: lucroReal - fixas
    };
  }

  function renderEscadaCard(wrap, de, ate, titulo) {
    var e = calcEscada(de, ate), t = e.t;
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: titulo || 'Do faturamento ao seu bolso' })]);
    var cobertas = t.receita - t.receitaSemCusto;
    function degrau(rotulo, valor, explica, tipo) {
      return el('div', { class: 'escada-linha ' + (tipo || '') }, [
        el('div', {}, [el('div', { class: 'escada-rotulo', text: rotulo }), explica ? el('div', { class: 'pml-margin', text: explica }) : null].filter(Boolean)),
        el('div', { class: 'escada-valor', text: (tipo === 'menos' ? '− ' : '') + fmtMoney(Math.abs(valor)) })
      ]);
    }
    var pct = function (v) { return t.receita ? ' · ' + fmtPct(v / t.receita) + ' do vendido' : ''; };
    card.appendChild(degrau('Vendeu', t.receita, 'tudo o que entrou de pedidos (ML e Shopee)', 'total'));
    card.appendChild(degrau('Comissões, taxas e frete', t.receita - t.liquido, 'o que o ML e a Shopee descontam de cada venda' + pct(t.receita - t.liquido), 'menos'));
    card.appendChild(degrau('Imposto (Simples)', t.imposto, '', 'menos'));
    card.appendChild(degrau('Custo dos produtos', t.custo, 'o que você pagou em cada produto vendido (peças 3D pelo custo real)', 'menos'));
    if (Math.abs(e.outrosVenda) >= 0.5) card.appendChild(degrau('Devoluções e falhas de impressão', e.outrosVenda, 'tarifas de devolução e peças perdidas', 'menos'));
    card.appendChild(degrau('Lucro da operação', t.lucro, 'o que os produtos deixaram' + pct(t.lucro), 'subtotal'));
    card.appendChild(degrau('Ads da Shopee', e.adsShopee, '', 'menos'));
    card.appendChild(degrau('Ads do Mercado Livre', e.fatura.adsMl, 'da fatura do ML', 'menos'));
    card.appendChild(degrau('Antecipação do Mercado Pago', e.fatura.antecipacao, 'para receber antes do prazo', 'menos'));
    card.appendChild(degrau('Full e outras cobranças', e.fatura.full + e.fatura.outros, 'armazenagem do Full e outras cobranças da fatura', 'menos'));
    card.appendChild(degrau('Lucro real', e.lucroReal, 'o que a loja gerou de verdade' + pct(e.lucroReal), 'destaque ' + (e.lucroReal >= 0 ? 'pos' : 'neg')));
    card.appendChild(degrau('Contas fixas da loja', e.fixas, e.listaFixas.map(function (i) { return i.nome; }).join(', ') || 'nenhuma lançada', 'menos'));
    card.appendChild(degrau('Sobrou no bolso', e.bolso, '', 'destaque ' + (e.bolso >= 0 ? 'pos' : 'neg')));
    if (e.invest) card.appendChild(el('p', { class: 'pml-note', text: 'Investimentos no mês (fora da conta, porque viram patrimônio): ' + e.listaInvest.map(function (i) { return i.nome + ' ' + fmtMoney(i.valor); }).join(' · ') + ' = ' + fmtMoney(e.invest) + '.' }));
    var notas = [];
    if (t.semCusto) notas.push(t.semCusto + ' produto(s) sem custo cadastrado (' + fmtMoney(t.receitaSemCusto) + ' em vendas) ficaram fora do lucro.');
    if (!e.fatura.temDados) notas.push('A fatura do ML deste período ainda não chegou: Ads do ML, antecipação e Full podem estar faltando.');
    else notas.push('Cobranças da fatura do ML entram proporcionais aos dias do período.');
    if (!(state.adsShopee && (state.adsShopee.dias || []).length)) notas.push('Os dados de Ads da Shopee não chegaram: o Ads da Shopee está faltando.');
    card.appendChild(el('p', { class: 'pml-note', text: notas.join(' ') + ' As contas fixas são as do mês, lançadas na aba Contas (o DAS do mês já está no imposto).' }));
    if (cobertas <= 0 && t.receita > 0) card.appendChild(el('p', { class: 'pml-note', style: 'color:var(--bad);', text: 'Cadastre os custos dos produtos para ver o lucro.' }));
    wrap.appendChild(card);
  }
