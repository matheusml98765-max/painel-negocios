  function renderLucroTab(wrap) {
    var cfg = state.configLucro;
    var dias = Number(cfg.dias) || 30;
    var plat = cfg.plataforma || 'todas';
    var calc = calcLucroPorProduto(dias, plat);
    var ads = (plat === 'todas' || plat === 'shopee') ? adsShopeeNoPeriodo(dias) : null;
    var nomePlat = plat === 'ml' ? 'O Mercado Livre' : (plat === 'shopee' ? 'A Shopee' : 'As plataformas');
    var linhas = calc.linhas;

    // ---- Filtros e premissas ----
    var filtros = el('div', { class: 'pml-filtros' });
    function campo(label, input) { return el('div', { class: 'pml-field' }, [el('label', { text: label }), input]); }
    var selDias = el('select', { onchange: function () { cfg.dias = Number(selDias.value); salvarConfigLucro(); render(); } },
      [7, 15, 30].map(function (d) { var o = el('option', { value: d, text: 'Últimos ' + d + ' dias' }); if (d === dias) o.setAttribute('selected', ''); return o; }));
    var inpImp = el('input', { type: 'number', step: '0.1', value: cfg.imposto, onchange: function () { cfg.imposto = Number(inpImp.value) || 0; salvarConfigLucro(); render(); } });
    var inpAlvo = el('input', { type: 'number', step: '1', value: cfg.margemAlvo, onchange: function () { cfg.margemAlvo = Number(inpAlvo.value) || 0; salvarConfigLucro(); render(); } });
    var selOrdem = el('select', { onchange: function () { cfg.ordem = selOrdem.value; salvarConfigLucro(); render(); } },
      [['receita', 'Mais vendidos (R$)'], ['lucro', 'Maior lucro'], ['margem', 'Menor margem primeiro'], ['semcusto', 'Sem custo primeiro']].map(function (o) {
        var op = el('option', { value: o[0], text: o[1] }); if (o[0] === cfg.ordem) op.setAttribute('selected', ''); return op;
      }));
    var selPlat = el('select', { onchange: function () { cfg.plataforma = selPlat.value; salvarConfigLucro(); render(); } },
      [['todas', 'ML e Shopee'], ['ml', 'Só Mercado Livre'], ['shopee', 'Só Shopee']].map(function (o) {
        var op = el('option', { value: o[0], text: o[1] }); if (o[0] === plat) op.setAttribute('selected', ''); return op;
      }));
    filtros.appendChild(campo('Loja', selPlat));
    filtros.appendChild(campo('Período', selDias));
    filtros.appendChild(campo('Imposto (% da venda)', inpImp));
    filtros.appendChild(campo('Margem que você quer (%)', inpAlvo));
    filtros.appendChild(campo('Ordenar por', selOrdem));

    if (linhas.length === 0) {
      var vazio = el('div', { class: 'pml-card' });
      vazio.appendChild(filtros);
      vazio.appendChild(el('div', { class: 'pml-empty', html: 'Ainda não há vendas com as taxas das plataformas neste período.<br>Eles chegam sozinhos pela automação (comissão, frete e valor recebido de cada venda). Se a automação acabou de ser atualizada, abra o painel de novo daqui a pouco.' }));
      wrap.appendChild(vazio);
      renderFaturaCard(wrap);
      return;
    }

    // ---- Resumo ----
    var tot = linhas.reduce(function (a, g) {
      a.receita += g.receita; a.liquido += g.liquido; a.unidades += g.unidades; a.imposto += g.imposto;
      if (g.lucro !== null) { a.lucro += g.lucro; a.receitaComCusto += g.receita; } else { a.semCusto++; }
      if (g.lucro !== null && g.lucro < 0) a.prejuizo++;
      return a;
    }, { receita: 0, liquido: 0, unidades: 0, imposto: 0, lucro: 0, receitaComCusto: 0, semCusto: 0, prejuizo: 0 });
    var levou = tot.receita ? 1 - tot.liquido / tot.receita : 0;

    var metr = el('div', { class: 'pml-metrics' }, [
      el('div', { class: 'pml-metric' }, [el('p', { class: 'pml-metric-label', text: 'Faturamento (' + dias + ' dias)' }), el('p', { class: 'pml-metric-value', text: fmtMoney(tot.receita) }), el('p', { class: 'pml-margin', text: tot.unidades + ' unidades vendidas' })]),
      el('div', { class: 'pml-metric' }, [el('p', { class: 'pml-metric-label', text: 'Você recebeu (líquido)' }), el('p', { class: 'pml-metric-value', text: fmtMoney(tot.liquido) }), el('p', { class: 'pml-margin', text: 'depois de comissão, taxas e frete' })]),
      el('div', { class: 'pml-metric' }, [el('p', { class: 'pml-metric-label', text: nomePlat + ' ficou com' }), el('p', { class: 'pml-metric-value neg', text: fmtPct(levou) }), el('div', { class: 'pml-barra' }, [el('span', { style: 'width:' + Math.min(100, levou * 100).toFixed(1) + '%' })])]),
      el('div', { class: 'pml-metric' }, [el('p', { class: 'pml-metric-label', text: 'Lucro real' + (tot.semCusto ? ' (produtos com custo)' : '') }), el('p', { class: 'pml-metric-value ' + (tot.lucro >= 0 ? 'pos' : 'neg'), text: fmtMoney(tot.lucro) }), el('p', { class: 'pml-margin', text: 'margem ' + fmtPct(tot.receitaComCusto ? tot.lucro / tot.receitaComCusto : null) + ', já sem imposto' + (ads && ads.gasto ? ' (antes do Ads)' : '') })])
    ]);
    if (ads && ads.gasto > 0) {
      metr.appendChild(el('div', { class: 'pml-metric' }, [
        el('p', { class: 'pml-metric-label', text: 'Shopee Ads (' + dias + ' dias)' }),
        el('p', { class: 'pml-metric-value neg', text: fmtMoney(ads.gasto) }),
        el('p', { class: 'pml-margin', text: 'trouxe ' + fmtMoney(ads.vendas) + ' em vendas' + (tot.receitaComCusto ? '. Lucro depois do Ads: ' + fmtMoney(tot.lucro - ads.gasto) : '. Cadastre o custo das peças para ver o lucro depois do Ads.') })
      ]));
    }
    wrap.appendChild(metr);

    // ---- Alertas ----
    var alertas = [];
    if (tot.prejuizo) alertas.push('🔴 <b>' + tot.prejuizo + ' produto(s) dando prejuízo</b> no período (linhas em vermelho na tabela).');
    if (tot.semCusto) alertas.push('✏️ <b>' + tot.semCusto + ' produto(s) sem custo cadastrado.</b> Digite quanto você pagou direto na tabela (campo pontilhado) para ver o lucro deles.');
    if (calc.semDados) alertas.push('ℹ️ ' + calc.semDados + ' venda(s) ainda sem as taxas da plataforma — elas não entram nesta conta.');
    var afil = linhas.reduce(function (s2, g) { return s2 + (g.afiliados || 0); }, 0);
    if (afil > 0) alertas.push('🤝 Comissão de afiliados da Shopee no período: <b>' + fmtMoney(afil) + '</b> (já descontada do recebido).');
    if (alertas.length) wrap.appendChild(el('div', { class: 'pml-dica', style: 'margin:0 0 20px;', html: alertas.join('<br>') }));

    // ---- Tabela por produto ----
    var ordem = cfg.ordem || 'receita';
    linhas.sort(function (a, b) {
      if (ordem === 'lucro') return (b.lucro === null ? -1e12 : b.lucro) - (a.lucro === null ? -1e12 : a.lucro);
      if (ordem === 'margem') return (a.margem === null ? 1e12 : a.margem) - (b.margem === null ? 1e12 : b.margem);
      if (ordem === 'semcusto') return (a.custoUnit === null ? 0 : 1) - (b.custoUnit === null ? 0 : 1) || b.receita - a.receita;
      return b.receita - a.receita;
    });

    var card = el('div', { class: 'pml-card' });
    var topo = el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;' }, [
      el('p', { class: 'pml-section-title', style: 'margin:0;', text: 'Lucro por produto' }),
      el('button', { class: 'pml-btn', style: 'padding:7px 14px; font-size:13px;', text: '⬇ Exportar Excel', onclick: function () { exportarLucroExcel(linhas, dias); } })
    ]);
    card.appendChild(topo);
    card.appendChild(filtros);

    var table = el('table', { class: 'pml-table pml-tabela-lucro' });
    table.appendChild(el('tr', {}, [
      el('th', { text: 'Produto' }), el('th', { class: 'num', text: 'Un.' }), el('th', { class: 'num', text: 'Preço méd.' }),
      el('th', { class: 'num', text: 'Taxas' }), el('th', { class: 'num', text: 'Recebido' }), el('th', { class: 'num', text: 'Custo un.' }),
      el('th', { class: 'num', text: 'Lucro/un.' }), el('th', { class: 'num', text: 'Lucro total' }), el('th', { class: 'num', text: 'Margem' }),
      el('th', { class: 'num', text: 'Pagar até' })
    ]));
    linhas.forEach(function (g) {
      var classe = '';
      var tag = null;
      if (g.lucro !== null && g.lucro < 0) { classe = 'pml-row-alerta'; tag = el('span', { class: 'pml-tag prejuizo', text: 'prejuízo' }); }
      else if (g.margem !== null && g.margem < 0.1) { classe = 'pml-row-atencao'; tag = el('span', { class: 'pml-tag baixa', text: 'margem baixa' }); }
      else if (g.margem !== null && g.margem >= (Number(cfg.margemAlvo) || 0) / 100) { tag = el('span', { class: 'pml-tag boa', text: 'ótimo' }); }

      var celCusto;
      if (g.custoUnit === null || g.fonteCusto === 'avulso') {
        var inp = el('input', { class: 'pml-custo-input', type: 'number', step: '0.01', placeholder: 'R$ custo', value: g.custoUnit === null ? '' : g.custoUnit, title: 'Quanto você paga por unidade' });
        inp.addEventListener('change', function () {
          var v = inp.value.trim();
          if (v === '') delete state.custosAvulsos[g.itemId.toUpperCase()];
          else state.custosAvulsos[g.itemId.toUpperCase()] = Number(v.replace(',', '.'));
          salvarCustosAvulsos();
          render();
        });
        celCusto = el('td', { class: 'num' }, [inp]);
      } else {
        celCusto = el('td', { class: 'num', title: g.fonteCusto === '3d' ? 'Custo calculado na Calculadora 3D' : 'Custo vindo da aba Estoque', text: fmtMoney(g.custoUnit) + (g.fonteCusto === '3d' ? ' · 3D' : '') });
      }

      table.appendChild(el('tr', { class: classe }, [
        el('td', {}, [
          el('div', { class: 'pml-titulo-prod', title: g.titulo, text: g.titulo }),
          el('div', { class: 'pml-margin' }, [document.createTextNode((g.plataforma === 'shopee' ? 'Shopee ' : '') + g.itemId + (g.tipoAnuncio ? ' · ' + g.tipoAnuncio : '')), tag])
        ]),
        el('td', { class: 'num', text: String(g.unidades) }),
        el('td', { class: 'num', text: fmtMoney(g.precoMedio) }),
        el('td', { class: 'num', title: (g.plataforma === 'shopee' ? 'Comissão, taxa de serviço e afiliados ' : 'Comissão ') + fmtMoney(g.comissao) + ' + frete ' + fmtMoney(g.frete), text: fmtMoney(g.taxasMl) + ' (' + fmtPct(g.receita ? g.taxasMl / g.receita : 0) + ')' }),
        el('td', { class: 'num', text: fmtMoney(g.liquido) }),
        celCusto,
        el('td', { class: 'num', style: g.lucroUnit !== null && g.lucroUnit < 0 ? 'color:var(--bad); font-weight:700;' : 'font-weight:600;', text: g.lucroUnit === null ? '—' : fmtMoney(g.lucroUnit) }),
        el('td', { class: 'num', text: g.lucro === null ? '—' : fmtMoney(g.lucro) }),
        el('td', { class: 'num', text: fmtPct(g.margem) }),
        el('td', { class: 'num', title: 'Preço máximo de compra para ter ' + cfg.margemAlvo + '% de margem', text: g.maxCompra === null ? '—' : fmtMoney(Math.max(0, g.maxCompra)) })
      ]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [table]));
    card.appendChild(el('p', { class: 'pml-note', html: '<b>Taxas</b> = tudo o que a plataforma descontou de cada venda real (vem da API): no ML, comissão e frete; na Shopee, comissão, taxa de serviço (inclui a taxa fixa por item), afiliados e proteção de frete. <b>Recebido</b> = o que caiu para você. <b>Lucro</b> = recebido − imposto (' + cfg.imposto + '%) − custo do produto. <b>Pagar até</b> = o máximo que você pode pagar no produto para manter ' + cfg.margemAlvo + '% de margem. O Ads da Shopee aparece separado no card acima. Custos do mês que não são por venda (armazenagem Full, antecipação, eShop) aparecem na fatura abaixo.' }));
    wrap.appendChild(card);

    renderFaturaCard(wrap);
  }

  function renderFaturaCard(wrap) {
    var fat = state.faturamento;
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Fatura do Mercado Livre e Mercado Pago' }));
    if (!fat || !Array.isArray(fat.periodos) || fat.periodos.length === 0) {
      card.appendChild(el('div', { class: 'pml-empty', text: 'A fatura chega pela automação. Assim que ela rodar com a versão nova, aparece aqui tudo o que o ML cobrou no mês.' }));
      wrap.appendChild(card);
      return;
    }
    var periodos = fat.periodos.filter(function (p) { return (p.linhas || []).length > 0; });
    if (!periodos.length) { card.appendChild(el('div', { class: 'pml-empty', text: 'Sem detalhes de fatura ainda.' })); wrap.appendChild(card); return; }
    var padrao = periodos.find(function (p) { return p.situacao === 'fechada'; }) || periodos[0];
    var atual = periodos.find(function (p) { return p.chave === state.fatPeriodo; }) || padrao;

    function fmtData(d) { var x = String(d || '').split('-'); return x.length === 3 ? x[2] + '/' + x[1] : d; }
    var sel = el('select', { onchange: function () { state.fatPeriodo = sel.value; render(); } }, periodos.map(function (p) {
      var o = el('option', { value: p.chave, text: 'Fatura ' + p.chave.slice(0, 7) + ' (' + fmtData(p.de) + ' a ' + fmtData(p.ate) + ')' + (p.situacao === 'aberta' ? ' — em andamento' : '') });
      if (p.chave === atual.chave) o.setAttribute('selected', '');
      return o;
    }));
    card.appendChild(el('div', { class: 'pml-field', style: 'max-width:380px; margin-bottom:14px;' }, [sel]));

    var cats = {};
    var cobrado = 0, estornado = 0;
    atual.linhas.forEach(function (l) {
      var c = cats[l.categoria] || (cats[l.categoria] = { total: 0, linhas: [] });
      c.total += l.valor; c.linhas.push(l);
      if (l.valor >= 0) cobrado += l.valor; else estornado += l.valor;
    });
    var nomes = Object.keys(cats).sort(function (a, b) {
      if (a === 'Estornos e bonificações') return 1;
      if (b === 'Estornos e bonificações') return -1;
      return cats[b].total - cats[a].total;
    });
    nomes.forEach(function (n) {
      var c = cats[n];
      var det = el('details', { class: 'pml-fat-cat' });
      det.appendChild(el('summary', {}, [
        el('span', { html: '<b>' + n + '</b> <span class="pml-margin">(' + c.linhas.length + ')</span>' }),
        el('span', { style: 'font-weight:700; ' + (c.total < 0 ? 'color:var(--good);' : ''), text: fmtMoney(c.total) })
      ]));
      c.linhas.forEach(function (l) {
        det.appendChild(el('div', { class: 'pml-fat-linha' }, [el('span', { text: l.descricao }), el('span', { text: fmtMoney(l.valor) })]));
      });
      card.appendChild(det);
    });
    card.appendChild(el('div', { class: 'pml-fat-cat', style: 'display:flex; justify-content:space-between; font-size:15px;' }, [
      el('b', { text: 'Custo real do período' }), el('b', { text: fmtMoney(cobrado + estornado) })
    ]));

    var dicas = [];
    if (cats['Antecipação'] && cats['Antecipação'].total > 0) {
      dicas.push('💸 <b>Você pagou ' + fmtMoney(cats['Antecipação'].total) + ' para receber dinheiro antes do prazo.</b> Se não precisava do dinheiro na hora, vale desligar a antecipação automática no Mercado Pago e antecipar só quando precisar.');
    }
    if (cats['Parcelamento'] && cats['Parcelamento'].total > 0) {
      dicas.push('💳 <b>' + fmtMoney(cats['Parcelamento'].total) + ' em taxas de parcelamento.</b> Vem dos anúncios Premium e de campanhas com parcelamento sem juros — confira se as vendas a mais compensam.');
    }
    if (cats['Publicidade'] && cats['Estornos e bonificações']) {
      var pub = cats['Publicidade'].total;
      var bonPub = cats['Estornos e bonificações'].linhas.filter(function (l) { return /publicidade|ads/i.test(l.descricao); }).reduce(function (s, l) { return s + l.valor; }, 0);
      if (pub > 0 && bonPub < 0) dicas.push('📣 Dos ' + fmtMoney(pub) + ' de Product Ads, ' + fmtMoney(-bonPub) + ' foram bonificados pelo ML (crédito grátis).');
    }
    if (dicas.length) card.appendChild(el('div', { class: 'pml-dica', html: dicas.join('<br><br>') }));
    if (fat.atualizado_em) card.appendChild(el('p', { class: 'pml-note', text: 'Atualizado em ' + new Date(fat.atualizado_em).toLocaleString('pt-BR') + '.' }));
    wrap.appendChild(card);
  }

