  function renderInicio(wrap) {
    destruirGraficos();
    var d = dadosInicio();
    var lucro = calcLucroPorProduto(30);
    var tot = lucro.linhas.reduce(function (a, g) {
      a.receita += g.receita; a.liquido += g.liquido;
      if (g.lucro !== null) { a.lucro += g.lucro; a.receitaComCusto += g.receita; }
      return a;
    }, { receita: 0, liquido: 0, lucro: 0, receitaComCusto: 0 });
    var levou = tot.receita ? 1 - tot.liquido / tot.receita : null;
    function ficouCom(p) {
      var t = lucro.linhas.filter(function (g) { return g.plataforma === p; }).reduce(function (a, g) { a.r += g.receita; a.l += g.liquido; return a; }, { r: 0, l: 0 });
      return t.r ? 1 - t.l / t.r : null;
    }
    var ficouMl = ficouCom('ml'), ficouShopee = ficouCom('shopee');
    var ads30 = adsShopeeNoPeriodo(30);
    // So desconta o Ads quando ja existe custo cadastrado em algum produto da Shopee,
    // senao o lucro ficaria negativo sem os produtos que o Ads ajudou a vender.
    var shopeeComCusto = lucro.linhas.some(function (g) { return g.plataforma === 'shopee' && g.lucro !== null; });
    var adsDesc = shopeeComCusto && ads30 ? ads30.gasto : 0;

    // Saudacao
    var agora = new Date();
    var dataLonga = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    var horas = horasDesdeAtualizacaoAutomacao();
    var sau = el('div', { class: 'ini-saudacao' }, [
      el('div', {}, [
        el('h1', { text: saudacao(agora) + ', ' + NOME_DONO }),
        el('p', { text: dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1) + '. Este é o resumo da ' + NOME_LOJA + '.' })
      ]),
      el('div', { class: 'ini-atualizado' }, [
        el('span', { class: 'ini-pulso' + (horas !== null && horas > 6 ? ' parado' : '') }),
        el('span', { text: horas === null ? 'Aguardando a automação' : (horas > 6 ? 'Automação parada há ' + Math.round(horas) + ' h' : 'Dados atualizados automaticamente') })
      ])
    ]);
    wrap.appendChild(sau);
    renderAvisos(wrap);

    var grid = el('div', { class: 'ini-grid' });

    // Hoje
    var variacao = d.ontem.total > 0 ? (d.hoje.total - d.ontem.total) / d.ontem.total : null;
    var ticketHoje = d.hoje.pedidos ? d.hoje.total / d.hoje.pedidos : 0;
    var hojeCard = el('section', { class: 'ini-hoje', 'aria-label': 'Vendas de hoje' }, [
      el('h2', { text: 'Vendas de hoje' }),
      el('div', { class: 'valor', text: fmtMoney(d.hoje.total) }),
      variacao === null ? el('span', { class: 'comp', text: 'Ontem: ' + fmtMoney(d.ontem.total) })
        : el('span', { class: 'comp', text: (variacao >= 0 ? '▲ ' : '▼ ') + fmtPct(Math.abs(variacao)) + ' em relação a ontem' }),
      el('div', { class: 'linha' }, [
        el('div', {}, [el('b', { text: String(d.hoje.pedidos) }), el('span', { text: d.hoje.pedidos === 1 ? 'pedido' : 'pedidos' })]),
        el('div', {}, [el('b', { text: fmtMoney(ticketHoje) }), el('span', { text: 'ticket médio' })]),
        el('div', {}, [el('b', { text: fmtMoney(d.hoje.plat.ml || 0) }), el('span', { text: 'Mercado Livre' })]),
        el('div', {}, [el('b', { text: fmtMoney(d.hoje.plat.shopee || 0) }), el('span', { text: 'Shopee' })])
      ])
    ]);
    grid.appendChild(hojeCard);

    // Mes
    var nomeMes = agora.toLocaleDateString('pt-BR', { month: 'long' });
    function kpi(rotulo, num, sub, classe) {
      return el('div', { class: 'ini-kpi' }, [el('div', { class: 'rotulo', text: rotulo }), el('div', { class: 'num' + (classe ? ' ' + classe : ''), text: num }), el('div', { class: 'sub', text: sub })]);
    }
    var mes = el('div', { class: 'ini-mes' }, [
      kpi('Faturamento de ' + nomeMes, fmtMoney(d.mes.total), d.mes.pedidos + ' pedidos · ticket ' + fmtMoney(d.mes.pedidos ? d.mes.total / d.mes.pedidos : 0)),
      kpi('Lucro real (30 dias)', fmtMoney(tot.lucro - adsDesc), tot.receitaComCusto ? 'margem de ' + fmtPct((tot.lucro - adsDesc) / tot.receitaComCusto) + ', já sem imposto' + (adsDesc ? ' e sem o Ads da Shopee' : '') : 'cadastre os custos na aba Lucro real', (tot.lucro - adsDesc) >= 0 ? 'pos' : 'neg'),
      kpi('As plataformas ficaram com', levou === null ? '—' : fmtPct(levou), 'ML ' + fmtPct(ficouMl) + ' · Shopee ' + fmtPct(ficouShopee) + ' das vendas, antes do Ads'),
      kpi('Shopee Ads (30 dias)', ads30 ? fmtMoney(ads30.gasto) : '—', ads30 ? 'trouxe ' + fmtMoney(ads30.vendas) + ' em vendas (' + fmtPct(ads30.vendas ? ads30.gasto / ads30.vendas : null) + ' gasto)' : 'chega pela automação da Shopee')
    ]);
    grid.appendChild(mes);
    var lucroMesCalc = calcLucroPorProduto(agora.getDate()).linhas.reduce(function (s, g) { return g.lucro !== null ? s + g.lucro : s; }, 0);
    grid.appendChild(blocoMetas(d, lucroMesCalc));
    renderVendasDoDia(grid);
    var escWrap = el('section', { class: 'ini-bloco ini-c12' });
    renderEscadaCard(escWrap, isoHoje(0).slice(0, 8) + '01', isoHoje(0), 'Este mês: do faturamento ao seu bolso');
    grid.appendChild(escWrap);

    // Grafico diario por plataforma
    var plats = ['ml', 'shopee', 'tiktok', 'outro'].filter(function (p) { return (d.plat30[p] || 0) > 0; });
    var corDe = { ml: cssVar('--s-ml'), shopee: cssVar('--s-shopee'), tiktok: cssVar('--s-tiktok'), outro: cssVar('--muted') };
    var diasLista = Object.keys(d.dias).sort();
    var blocoDia = el('section', { class: 'ini-bloco ini-c8' });
    var legenda = el('div', { class: 'ini-legenda' }, plats.map(function (p) { return el('span', {}, [el('i', { style: 'background:' + corDe[p] }), document.createTextNode(NOMES_PLAT[p])]); }));
    var tabelaWrap = el('div', { style: 'display:none; margin-top:12px; max-height:240px; overflow:auto;' });
    var btnTabela = el('button', { class: 'ini-ver-tabela', text: 'Ver como tabela', onclick: function () {
      var aberto = tabelaWrap.style.display !== 'none';
      tabelaWrap.style.display = aberto ? 'none' : 'block';
      btnTabela.textContent = aberto ? 'Ver como tabela' : 'Esconder tabela';
    } });
    blocoDia.appendChild(el('div', { class: 'cab' }, [el('h3', { text: 'Faturamento por dia' }), el('div', { style: 'display:flex; gap:16px; align-items:center; flex-wrap:wrap;' }, [legenda, btnTabela])]));
    var cvDia = el('canvas', { role: 'img', 'aria-label': 'Faturamento por dia nos últimos 30 dias, por plataforma' });
    blocoDia.appendChild(el('div', { class: 'ini-grafico' }, [cvDia]));
    var tb = el('table', { class: 'pml-table' });
    tb.appendChild(el('tr', {}, [el('th', { text: 'Dia' })].concat(plats.map(function (p) { return el('th', { class: 'num', text: NOMES_PLAT[p] }); }))));
    diasLista.slice().reverse().forEach(function (dia) {
      tb.appendChild(el('tr', {}, [el('td', { text: dia.slice(8, 10) + '/' + dia.slice(5, 7) })].concat(plats.map(function (p) { return el('td', { class: 'num', text: fmtMoney(d.dias[dia][p]) }); }))));
    });
    tabelaWrap.appendChild(tb);
    blocoDia.appendChild(tabelaWrap);
    grid.appendChild(blocoDia);

    // Rosca por plataforma
    var blocoPlat = el('section', { class: 'ini-bloco ini-c4' });
    blocoPlat.appendChild(el('div', { class: 'cab' }, [el('h3', { text: 'Onde você mais vende' })]));
    var cvPlat = el('canvas', { role: 'img', 'aria-label': 'Divisão do faturamento por plataforma em 30 dias' });
    blocoPlat.appendChild(el('div', { class: 'ini-grafico baixo' }, [cvPlat]));
    var mini = el('table', { class: 'ini-tabela-mini' });
    plats.forEach(function (p) {
      mini.appendChild(el('tr', {}, [
        el('td', {}, [el('i', { style: 'display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:8px; background:' + corDe[p] }), document.createTextNode(NOMES_PLAT[p])]),
        el('td', { text: fmtMoney(d.plat30[p]) + ' (' + fmtPct(d.total30 ? d.plat30[p] / d.total30 : 0) + ')' })
      ]));
    });
    blocoPlat.appendChild(mini);
    grid.appendChild(blocoPlat);

    // Ranking de lucro
    var comLucro = lucro.linhas.filter(function (g) { return g.lucro !== null; }).sort(function (a, b) { return b.lucro - a.lucro; });
    var ranking = comLucro.slice(0, 6).concat(comLucro.filter(function (g) { return g.lucro < 0; }).filter(function (g) { return comLucro.indexOf(g) >= 6; }));
    var blocoRank = el('section', { class: 'ini-bloco ini-c6' });
    blocoRank.appendChild(el('div', { class: 'cab' }, [el('h3', { text: 'Quem mais dá lucro (30 dias)' }), el('button', { class: 'ini-ver-tabela', text: 'Abrir Lucro real', onclick: function () { state.tab = 'lucro'; render(); } })]));
    var cvRank = null;
    if (ranking.length) {
      cvRank = el('canvas', { role: 'img', 'aria-label': 'Produtos com maior lucro e com prejuízo nos últimos 30 dias' });
      blocoRank.appendChild(el('div', { class: 'ini-grafico', style: 'height:' + Math.max(200, ranking.length * 38 + 30) + 'px;' }, [cvRank]));
    } else {
      blocoRank.appendChild(el('div', { class: 'pml-empty', text: 'Cadastre o custo dos produtos na aba Lucro real para ver o ranking.' }));
    }
    grid.appendChild(blocoRank);

    // Alertas
    var blocoAl = el('section', { class: 'ini-bloco ini-c6' });
    blocoAl.appendChild(el('div', { class: 'cab' }, [el('h3', { text: 'O que pede sua atenção' })]));
    var alertas = [];
    comLucro.filter(function (g) { return g.lucro < 0; }).forEach(function (g) {
      alertas.push(['bad', '🔻', g.titulo, 'Perdendo ' + fmtMoney(-g.lucroUnit) + ' por unidade. Reveja o preço ou pare de comprar acima de ' + fmtMoney(Math.max(0, g.maxCompra)) + '.']);
    });
    comLucro.filter(function (g) { return g.lucro >= 0 && g.margem !== null && g.margem < 0.08; }).slice(0, 3).forEach(function (g) {
      alertas.push(['warn', '⚠️', g.titulo, 'Margem de só ' + fmtPct(g.margem) + '.']);
    });
    if (ficouShopee !== null && ficouShopee > 0.35) alertas.push(['warn', '🧾', 'A Shopee ficou com ' + fmtPct(ficouShopee) + ' das suas vendas', 'Comissão, taxa fixa por pedido e afiliados pesam muito em peças baratas. Veja o simulador da Calculadora 3D.']);
    var semCusto = lucro.linhas.filter(function (g) { return g.custoUnit === null; }).length;
    if (semCusto) alertas.push(['warn', '✏️', semCusto + ' produto(s) sem custo cadastrado', 'Sem o custo, o lucro deles não entra na conta.']);
    if (state.faturamento && state.faturamento.periodos) {
      var per = state.faturamento.periodos.find(function (p) { return p.situacao === 'fechada' && (p.linhas || []).length; });
      if (per) {
        var ant = per.linhas.filter(function (l) { return l.categoria === 'Antecipação'; }).reduce(function (s, l) { return s + l.valor; }, 0);
        if (ant > 0) alertas.push(['warn', '💸', 'Antecipação do Mercado Pago: ' + fmtMoney(ant), 'Foi o que você pagou na última fatura para receber antes do prazo.']);
      }
    }
    if (horas !== null && horas > 6) alertas.unshift(['bad', '⛔', 'A automação não atualiza há ' + Math.round(horas) + ' horas', 'Confira o GitHub Actions.']);
    if (!alertas.length) alertas.push(['good', '✅', 'Tudo em ordem', 'Nenhum produto com prejuízo nos últimos 30 dias.']);
    alertas.slice(0, 6).forEach(function (a) {
      blocoAl.appendChild(el('div', { class: 'ini-alerta' }, [el('div', { class: 'ic ' + a[0], 'aria-hidden': 'true', text: a[1] }), el('div', {}, [el('b', { text: a[2] }), el('span', { text: a[3] })])]));
    });
    grid.appendChild(blocoAl);

    grid.appendChild(blocoMapaCalor());
    wrap.appendChild(grid);

    // Desenha os graficos depois que os canvas estao na pagina
    setTimeout(function () {
      var base = opcoesBaseGrafico();
      novoGrafico(cvDia, {
        type: 'bar',
        data: {
          labels: diasLista.map(function (x) { return x.slice(8, 10) + '/' + x.slice(5, 7); }),
          datasets: plats.map(function (p) {
            return { label: NOMES_PLAT[p], data: diasLista.map(function (x) { return Math.round(d.dias[x][p] * 100) / 100; }), backgroundColor: corDe[p], borderRadius: 4, borderSkipped: 'bottom', borderColor: cssVar('--surface'), borderWidth: { top: 0, left: 1, right: 1, bottom: 2 }, maxBarThickness: 22 };
          })
        },
        options: Object.assign({}, base, { scales: { x: Object.assign({}, base.scales.x, { stacked: true }), y: Object.assign({}, base.scales.y, { stacked: true }) } })
      });
      novoGrafico(cvPlat, {
        type: 'doughnut',
        data: { labels: plats.map(function (p) { return NOMES_PLAT[p]; }), datasets: [{ data: plats.map(function (p) { return Math.round(d.plat30[p] * 100) / 100; }), backgroundColor: plats.map(function (p) { return corDe[p]; }), borderColor: cssVar('--surface'), borderWidth: 3, hoverOffset: 8 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          animation: { animateRotate: true, duration: 900 },
          plugins: { legend: { display: false }, tooltip: Object.assign({}, base.plugins.tooltip, { callbacks: { label: function (c) { return ' ' + c.label + ': ' + fmtMoney(c.parsed) + ' (' + fmtPct(d.total30 ? c.parsed / d.total30 : 0) + ')'; } } }) }
        },
        plugins: [{
          id: 'centro',
          afterDraw: function (ch) {
            var a = ch.chartArea; if (!a) return;
            var c = ch.ctx, cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2;
            c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = cssVar('--muted'); c.font = '600 12px Manrope'; c.fillText('30 dias', cx, cy - 14);
            c.fillStyle = cssVar('--ink'); c.font = '700 17px Sora'; c.fillText(fmtMoney(d.total30).replace(',00', ''), cx, cy + 8);
            c.restore();
          }
        }]
      });
      if (cvRank) {
        var good = cssVar('--good'), bad = cssVar('--bad');
        novoGrafico(cvRank, {
          type: 'bar',
          data: {
            labels: ranking.map(function (g) { var lim = window.innerWidth < 600 ? 18 : 34; var t = g.titulo; return t.length > lim ? t.slice(0, lim - 1) + '…' : t; }),
            datasets: [{ label: 'Lucro', data: ranking.map(function (g) { return Math.round(g.lucro * 100) / 100; }), backgroundColor: ranking.map(function (g) { return g.lucro < 0 ? bad : good; }), borderRadius: 4, maxBarThickness: 18 }]
          },
          options: Object.assign({}, base, {
            indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false },
            plugins: Object.assign({}, base.plugins, { tooltip: Object.assign({}, base.plugins.tooltip, { callbacks: {
              title: function (items) { return ranking[items[0].dataIndex].titulo; },
              label: function (c) { var g = ranking[c.dataIndex]; return [' Lucro: ' + fmtMoney(g.lucro) + (g.lucro < 0 ? ' (prejuízo)' : ''), ' ' + g.unidades + ' un. · margem ' + fmtPct(g.margem)]; }
            } }) }),
            scales: {
              x: { grid: { color: cssVar('--line') }, border: { display: false }, ticks: { color: cssVar('--muted'), font: { family: 'Manrope', size: 11 }, callback: function (v) { return 'R$ ' + v; } } },
              y: { grid: { display: false }, border: { color: cssVar('--line') }, ticks: { color: cssVar('--ink'), font: { family: 'Manrope', size: 12, weight: '600' } } }
            }
          })
        });
      }
    }, 0);
  }

