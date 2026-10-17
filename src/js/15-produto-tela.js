  // ===================== TELAS POR PRODUTO =====================
  // Ficha do produto (historico + simulador de desconto + Ads), Ads por produto e reposicao.

  function abrirFichaProduto(itemId) {
    state.fichaProduto = itemId;
    render();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }

  var DECISAO_ADS = {
    aumentar: { tag: 'boa', texto: 'aumentar', dica: 'O Ads custa bem menos que a sua margem: dá para subir o orçamento.' },
    manter: { tag: 'baixa', texto: 'manter', dica: 'Dá lucro, mas a folga é pequena. Mantenha e acompanhe.' },
    pausar: { tag: 'prejuizo', texto: 'pausar ou baixar', dica: 'O Ads custa mais do que a margem do produto: cada venda pelo Ads dá prejuízo.' },
    'sem-custo': { tag: 'baixa', texto: 'sem custo', dica: 'Cadastre o custo da peça para saber se o Ads compensa.' },
    'pouco-dado': { tag: 'baixa', texto: 'pouco dado', dica: 'Gastou pouco até agora; espere mais uns dias.' }
  };

  function renderFichaProduto(wrap) {
    var id = state.fichaProduto;
    var g = calcLucroPorProduto(90, 'todas').linhas.find(function (x) { return mesmoItem(x.itemId, id); });
    var card = el('div', { class: 'pml-card ficha-prod' });
    var titulo = g ? g.titulo : id;
    card.appendChild(el('div', { style: 'display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:6px;' }, [
      el('div', {}, [
        el('p', { class: 'pml-section-title', style: 'margin:0 0 4px;', text: titulo }),
        el('p', { class: 'pml-margin', text: (g && g.plataforma === 'shopee' ? 'Shopee ' : 'Mercado Livre ') + id + ' · últimos 90 dias' })
      ]),
      el('button', { class: 'pml-btn', style: 'padding:6px 12px; font-size:13px;', text: 'Fechar', onclick: function () { state.fichaProduto = null; render(); } })
    ]));
    if (!g) {
      card.appendChild(el('div', { class: 'pml-empty', text: 'Não há vendas com as taxas da plataforma para este anúncio nos últimos 90 dias.' }));
      wrap.appendChild(card);
      return;
    }

    // ---- Resumo ----
    card.appendChild(el('div', { class: 'pml-metrics', style: 'margin:14px 0;' }, [
      metricaFicha('Vendeu', g.unidades + ' un.', fmtMoney(g.receita)),
      metricaFicha('Preço médio', fmtMoney(g.precoMedio), 'taxas de ' + fmtPct(g.receita ? g.taxasMl / g.receita : null)),
      metricaFicha('Lucro por unidade', g.lucroUnit === null ? '—' : fmtMoney(g.lucroUnit), g.custoUnit === null ? 'falta o custo da peça' : 'custo ' + fmtMoney(g.custoUnit), g.lucroUnit === null ? '' : (g.lucroUnit >= 0 ? 'pos' : 'neg')),
      metricaFicha('Margem', fmtPct(g.margem), g.lucro === null ? '' : 'lucro total ' + fmtMoney(g.lucro))
    ]));

    // ---- Historico ----
    var hist = historicoProduto(id, 12);
    var temLucro = hist.some(function (s) { return s.lucro !== null && s.unidades; });
    card.appendChild(el('h4', { class: 'ficha-sub', text: 'Vendas por semana' }));
    var cv = el('canvas', { role: 'img', 'aria-label': 'Unidades vendidas e lucro por semana nas últimas 12 semanas' });
    card.appendChild(el('div', { class: 'ini-grafico baixo' }, [cv]));
    if (!temLucro) card.appendChild(el('p', { class: 'pml-note', text: 'A linha de lucro aparece quando o produto tem custo cadastrado.' }));
    setTimeout(function () {
      var base = opcoesBaseGrafico();
      var labels = hist.map(function (s) { return s.inicio.slice(8, 10) + '/' + s.inicio.slice(5, 7); });
      var ds = [{ type: 'bar', label: 'Unidades', data: hist.map(function (s) { return s.unidades; }), backgroundColor: cssVar('--accent'), borderRadius: 4, maxBarThickness: 26, yAxisID: 'y1', order: 2 }];
      if (temLucro) ds.push({ type: 'line', label: 'Lucro', data: hist.map(function (s) { return s.unidades ? Math.round(s.lucro * 100) / 100 : null; }), borderColor: cssVar('--good'), backgroundColor: cssVar('--good'), tension: 0.3, pointRadius: 4, borderWidth: 2.5, spanGaps: true, yAxisID: 'y', order: 1 });
      var opts = Object.assign({}, base, {
        scales: {
          x: base.scales.x,
          y: Object.assign({}, base.scales.y, { display: temLucro, position: 'left', beginAtZero: true }),
          y1: { beginAtZero: true, position: temLucro ? 'right' : 'left', grid: { display: !temLucro, color: cssVar('--line') }, border: { display: false }, ticks: { color: cssVar('--muted'), precision: 0 } }
        }
      });
      opts.plugins = Object.assign({}, base.plugins, { tooltip: Object.assign({}, base.plugins.tooltip, { callbacks: { label: function (c) {
        return ' ' + c.dataset.label + ': ' + (c.dataset.label === 'Unidades' ? c.parsed.y + ' un.' + (hist[c.dataIndex].precoMedio ? ' a ' + fmtMoney(hist[c.dataIndex].precoMedio) : '') : fmtMoney(c.parsed.y));
      } } }) });
      novoGrafico(cv, { data: { labels: labels, datasets: ds }, options: opts });
    }, 0);

    // ---- Simulador de desconto / campanha ----
    card.appendChild(el('h4', { class: 'ficha-sub', text: 'E se eu der desconto?' }));
    var saida = el('div', { class: 'sim-saida' });
    var rotulo = el('b', { text: state.simDesconto + '%' });
    var faixa = el('input', { type: 'range', min: '0', max: '50', step: '1', value: state.simDesconto, 'aria-label': 'Desconto em porcentagem' });
    function atualizar() {
      var d = Number(faixa.value);
      state.simDesconto = d;
      rotulo.textContent = d + '%';
      saida.innerHTML = '';
      var s = simularDesconto(g, d / 100);
      if (!s) return;
      var linhas = [
        ['Preço', fmtMoney(s.atual.preco), fmtMoney(s.novo.preco)],
        ['Taxas da plataforma', fmtMoney(s.atual.taxas), fmtMoney(s.novo.taxas)],
        ['Você recebe', fmtMoney(s.atual.recebido), fmtMoney(s.novo.recebido)],
        ['Lucro por unidade', s.atual.lucro === null ? '—' : fmtMoney(s.atual.lucro), s.novo.lucro === null ? '—' : fmtMoney(s.novo.lucro)],
        ['Margem', fmtPct(s.atual.margem), fmtPct(s.novo.margem)]
      ];
      var t = el('table', { class: 'pml-table' }, [el('tr', {}, [el('th', { text: '' }), el('th', { class: 'num', text: 'Hoje' }), el('th', { class: 'num', text: 'Com ' + d + '% off' })])]);
      linhas.forEach(function (l) { t.appendChild(el('tr', {}, [el('td', { text: l[0] }), el('td', { class: 'num', text: l[1] }), el('td', { class: 'num', style: 'font-weight:700;', text: l[2] })])); });
      saida.appendChild(t);
      var msg;
      if (s.novo.lucro === null) msg = '✏️ Cadastre o custo deste produto para ver se o desconto compensa.';
      else if (s.novo.lucro <= 0) msg = '🔴 <b>Com ' + d + '% de desconto você paga para vender.</b> O desconto máximo sem prejuízo é <b>' + fmtPct(s.descontoMaximo) + '</b>.';
      else if (s.vendasAMais !== null) msg = '📈 Para lucrar o mesmo, você precisa vender <b>' + fmtPct(s.vendasAMais) + ' a mais</b> (' + Math.ceil(g.unidades * (1 + s.vendasAMais)) + ' un. em vez de ' + g.unidades + ' no mesmo período). Desconto máximo sem prejuízo: <b>' + fmtPct(s.descontoMaximo) + '</b>.';
      else msg = 'Desconto máximo sem prejuízo: <b>' + fmtPct(s.descontoMaximo) + '</b>.';
      saida.appendChild(el('div', { class: 'pml-dica', style: 'margin-top:12px;', html: msg }));
    }
    faixa.addEventListener('input', atualizar);
    card.appendChild(el('div', { class: 'sim-faixa' }, [el('span', { text: 'Desconto' }), faixa, rotulo]));
    card.appendChild(saida);
    card.appendChild(el('p', { class: 'pml-note', text: 'Estimativa com as taxas reais das suas vendas: mantém a mesma % de comissão, o mesmo frete por unidade' + (g.plataforma === 'shopee' ? ' e a taxa fixa por pedido da Shopee (Calculadora 3D → Plataformas)' : '') + '. No Mercado Livre, se o preço cair abaixo de R$ 79 o frete e a tarifa fixa mudam.' }));
    atualizar();

    // ---- Ads deste anuncio ----
    var ads = calcAdsPorProduto();
    var a = ads && ads.linhas.find(function (x) { return mesmoItem(x.itemId, id); });
    if (a) {
      var dec = DECISAO_ADS[a.decisao];
      card.appendChild(el('h4', { class: 'ficha-sub', text: (a.plataforma === 'ml' ? 'Product Ads do ML' : 'Shopee Ads') + ' (' + ads.dias + ' dias)' }));
      card.appendChild(el('div', { class: 'pml-dica', html: 'Gastou <b>' + fmtMoney(a.gasto) + '</b> e trouxe <b>' + fmtMoney(a.vendasAds) + '</b> em ' + a.pedidosAds + ' pedido(s). O Ads levou <b>' + fmtPct(a.acos) + '</b> de cada venda; sua margem antes do Ads é ' + fmtPct(a.margem) + '. <span class="pml-tag ' + dec.tag + '">' + dec.texto + '</span><br>' + dec.dica }));
    }
    wrap.appendChild(card);
  }

  function metricaFicha(rotulo, valor, sub, classe) {
    return el('div', { class: 'pml-metric' }, [el('p', { class: 'pml-metric-label', text: rotulo }), el('p', { class: 'pml-metric-value ' + (classe || ''), text: valor }), el('p', { class: 'pml-margin', text: sub || '' })]);
  }

  function renderAdsPorProduto(wrap, plataforma) {
    var ads = calcAdsPorProduto(plataforma);
    if (!ads) return;
    var card = el('div', { class: 'pml-card' });
    var nomeAds = ads.plataformas.length > 1 ? 'Ads por produto (ML e Shopee' : (ads.plataformas[0] === 'ml' ? 'Product Ads do ML por produto (' : 'Shopee Ads por produto (');
    card.appendChild(el('p', { class: 'pml-section-title', text: nomeAds + (ads.plataformas.length > 1 ? ', ' : '') + ads.dias + ' dias)' }));
    var t = el('table', { class: 'pml-table' });
    t.appendChild(el('tr', {}, [el('th', { text: 'Produto' }), el('th', { class: 'num', text: 'Gasto' }), el('th', { class: 'num', text: 'Vendas pelo Ads' }), el('th', { class: 'num', text: 'Ads levou' }), el('th', { class: 'num', text: 'Sua margem' }), el('th', { class: 'num', text: 'Lucro depois do Ads' }), el('th', { text: 'O que fazer' })]));
    var economia = 0;
    ads.linhas.forEach(function (a) {
      var dec = DECISAO_ADS[a.decisao];
      if (a.decisao === 'pausar') economia += a.gasto;
      t.appendChild(el('tr', { class: a.decisao === 'pausar' ? 'pml-row-alerta' : '' }, [
        el('td', {}, [
          el('button', { class: 'pml-link-prod', title: 'Abrir a ficha do produto', text: a.titulo, onclick: function () { state.tab = 'lucro'; abrirFichaProduto(a.itemId); } }),
          el('div', { class: 'pml-margin', text: (a.plataforma === 'ml' ? 'Mercado Livre ' : 'Shopee ') + a.itemId + (a.plataforma === 'ml' && a.nomeCampanha ? ' · ' + a.nomeCampanha : '') })
        ]),
        el('td', { class: 'num', text: fmtMoney(a.gasto) }),
        el('td', { class: 'num', text: fmtMoney(a.vendasAds) + ' · ' + a.pedidosAds + ' ped.' }),
        el('td', { class: 'num', text: fmtPct(a.acos) }),
        el('td', { class: 'num', text: fmtPct(a.margem) }),
        el('td', { class: 'num', style: a.lucroDepois !== null && a.lucroDepois < 0 ? 'color:var(--bad); font-weight:700;' : '', text: a.lucroDepois === null ? '—' : fmtMoney(a.lucroDepois) }),
        el('td', { title: dec.dica }, [el('span', { class: 'pml-tag ' + dec.tag, style: 'margin-left:0;', text: dec.texto })])
      ]));
    });
    card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    if (economia > 0) card.appendChild(el('div', { class: 'pml-dica', style: 'margin-top:12px;', html: '💡 Os anúncios marcados para pausar gastaram <b>' + fmtMoney(economia) + '</b> em ' + ads.dias + ' dias sem dar lucro.' }));
    card.appendChild(el('p', { class: 'pml-note', html: '<b>Ads levou</b> = gasto ÷ vendas que vieram do Ads (ACOS). Se for maior que a <b>margem</b> do produto, cada venda pelo Ads dá prejuízo. Regra: Ads abaixo da metade da margem → aumentar; entre metade e a margem → manter; acima → pausar ou baixar o lance. Na Shopee, campanha com vários anúncios é dividida igualmente entre eles. No ML o gasto já vem por anúncio; parte do Product Ads do ML pode ser bonificada (veja Estornos e bonificações na fatura).' }));
    wrap.appendChild(card);
  }

  function renderReposicaoCard(wrap) {
    var cfg = state.configLucro;
    var prazo = Number(cfg.prazoReposicao) || 10;
    var lista = calcReposicao(prazo, 30);
    var fil = calcFilamento();
    if (!lista.length && !fil) return;
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Reposição' }));
    var inpPrazo = el('input', { type: 'number', min: '1', step: '1', value: prazo, style: 'width:80px;', onchange: function () { cfg.prazoReposicao = Number(inpPrazo.value) || 10; salvarConfigLucro(); render(); } });
    card.appendChild(el('div', { class: 'pml-field', style: 'max-width:340px; margin-bottom:12px;' }, [el('label', { text: 'Quantos dias o fornecedor leva para entregar' }), inpPrazo]));

    if (fil) {
      var txt = '🧵 <b>Filamento:</b> ';
      txt += fil.fonte === 'vendas' ? 'pelas vendas dos últimos 30 dias você gasta cerca de <b>' + fil.kgMesVendas.toFixed(1).replace('.', ',') + ' kg por mês</b>.' : 'pelo ritmo das suas compras, você usa cerca de <b>' + fil.kgMesCompra.toFixed(1).replace('.', ',') + ' kg por mês</b>.';
      if (fil.proximaCompra) txt += ' A última compra (' + fil.kgUltimo + ' kg em ' + fil.ultimaCompra.toLocaleDateString('pt-BR') + ') deve durar até <b>' + fil.proximaCompra.toLocaleDateString('pt-BR') + '</b>' + (fil.diasAteProxima <= prazo ? ' — <b style="color:var(--bad)">hora de pedir mais</b>.' : '.');
      if (fil.fonte === 'compras') txt += '<br><span class="pml-margin">Fica mais preciso quando cada peça da Calculadora 3D tiver os gramas e o código do anúncio.</span>';
      card.appendChild(el('div', { class: 'pml-dica', style: 'margin-bottom:14px;', html: txt }));
    }

    if (lista.length) {
      var nomes = { urgente: ['prejuizo', 'comprar já'], logo: ['baixa', 'comprar logo'], ok: ['boa', 'tranquilo'], parado: ['baixa', 'sem vendas'] };
      var t = el('table', { class: 'pml-table' });
      t.appendChild(el('tr', {}, [el('th', { text: 'Produto' }), el('th', { class: 'num', text: 'Estoque' }), el('th', { class: 'num', text: 'Vende por dia' }), el('th', { class: 'num', text: 'Dura até' }), el('th', { class: 'num', text: 'Comprar' }), el('th', { text: '' })]));
      var parados = lista.filter(function (r) { return r.situacao === 'parado'; });
      function linhaRep(r) {
        var n = nomes[r.situacao];
        return el('tr', { class: r.situacao === 'urgente' ? 'pml-row-alerta' : (r.situacao === 'logo' ? 'pml-row-atencao' : '') }, [
          el('td', {}, [el('div', { class: 'pml-titulo-prod', text: r.produto.nome }), el('div', { class: 'pml-margin', text: (r.fonte === 'ml' ? 'ML ' + r.itemId + (r.full ? ' · Full' : '') + (r.pausado ? (r.estoque <= 0 ? ' · pausado por falta de estoque' : ' · pausado') : '') + ' · estoque automático' : r.itemId + ' · estoque cadastrado') })]),
          el('td', { class: 'num', text: String(r.estoque) }),
          el('td', { class: 'num', text: r.porDia ? r.porDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0' }),
          el('td', { class: 'num', style: r.estoque <= 0 && r.porDia ? 'color:var(--bad); font-weight:700;' : '', text: r.estoque <= 0 && r.porDia ? 'esgotado' : (r.acabaEm ? r.acabaEm.toLocaleDateString('pt-BR') + ' (' + Math.round(r.cobertura) + ' d)' : '—') }),
          el('td', { class: 'num', style: 'font-weight:700;', text: r.comprar ? r.comprar + ' un.' : '—' }),
          el('td', {}, [el('span', { class: 'pml-tag ' + n[0], style: 'margin-left:0;', text: n[1] })])
        ]);
      }
      lista.filter(function (r) { return r.situacao !== 'parado'; }).forEach(function (r) { t.appendChild(linhaRep(r)); });
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
      if (parados.length) {
        var det = el('details', { class: 'pml-fat-cat' }, [el('summary', { text: parados.length + ' anúncio(s) sem venda nos últimos 30 dias' })]);
        var t2 = el('table', { class: 'pml-table' });
        parados.forEach(function (r) { t2.appendChild(linhaRep(r)); });
        det.appendChild(el('div', { class: 'pml-scroll' }, [t2]));
        card.appendChild(det);
      }
      card.appendChild(el('p', { class: 'pml-note', text: 'Mercado Livre: estoque real de cada anúncio, atualizado pela automação (Full incluso). Outros produtos: a quantidade cadastrada abaixo (ela baixa sozinha a cada venda). Ritmo = média de vendas dos últimos 30 dias. "Comprar" = o que falta para aguentar a entrega mais 30 dias de vendas. O preço máximo para pagar está na aba Lucro real, coluna "Pagar até".' }));
    } else {
      card.appendChild(el('p', { class: 'pml-note', text: 'Para ver quando cada produto acaba, cadastre abaixo a quantidade em estoque e o código do anúncio.' }));
    }
    wrap.appendChild(card);
  }
