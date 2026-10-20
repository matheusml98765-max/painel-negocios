  // ===================== CALCULADORA 3D (SIMPLES) =====================
  // Uma peça nova ou cadastrada: filamento, tempo, luz e embalagem -> custo; preço de venda ->
  // o que cai no bolso em cada plataforma. As taxas saem das suas vendas parecidas (mesma
  // plataforma, preço perto do seu); sem vendas parecidas, usa as taxas públicas cadastradas.
  // O resto da calculadora antiga (remessas, peças, plano, insumos) fica na aba Produção 3D.

  var CALC_PLATS = ['ml', 'shopee', 'tiktok'];

  // Quanto a plataforma fica de cada venda nesse preço, pelas suas vendas reais dos últimos 90 dias.
  function taxasPlataforma(plat, preco) {
    var lim = limiteDias(90), razoes = [];
    if (preco > 0) state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || t.data < lim || !Array.isArray(t.itens) || t.itens.length !== 1 || (Number(t.itens[0].quantidade) || 1) !== 1) return;
      var cu = plat === 'ml' ? t.custosMl : plat === 'shopee' ? t.custosShopee : null;
      var v = Number(t.valor) || 0, liq = cu && Number(cu.liquido_recebido);
      if (!cu || !v || !(liq > 0) || v < preco * 0.65 || v > preco * 1.5) return;
      if (plat === 'ml' && (v < LIMITE_FRETE_ML) !== (preco < LIMITE_FRETE_ML)) return;   // frete grátis muda tudo
      razoes.push((v - liq) / v);
    });
    if (razoes.length >= 3) {
      razoes.sort(function (a, b) { return a - b; });
      var r = razoes[Math.floor(razoes.length / 2)];
      return { valor: preco * r, pct: r, fonte: 'real', amostra: razoes.length };
    }
    var cfg = (getCalc3d().plataformas || []).find(function (p) { return p.id === plat; }) || {};
    var v2 = preco * num(cfg.comissao) / 100 + num(cfg.taxaFixa) + num(cfg.frete);
    return { valor: v2, pct: preco ? v2 / preco : 0, fonte: 'tabela', amostra: razoes.length };
  }

  function adsPctPlataforma(plat) {
    var cfg = (getCalc3d().plataformas || []).find(function (p) { return p.id === plat; }) || {};
    return num(cfg.ads) / 100;
  }

  function custoCalcSimples(e) {
    var fil = num(e.gramas) * (1 + num(e.perda) / 100) * num(e.precoKg) / 1000;
    var luz = num(e.horas) * num(e.watts) / 1000 * num(e.kwh);
    return { filamento: fil, luz: luz, embalagem: num(e.embalagem), outros: num(e.outros), total: fil + luz + num(e.embalagem) + num(e.outros) };
  }

  function lucroNaPlataforma(plat, preco, custo, comAds) {
    var tx = taxasPlataforma(plat, preco), imp = preco * num(state.configLucro.imposto) / 100;
    var ads = comAds ? preco * adsPctPlataforma(plat) : 0;
    var lucro = preco - tx.valor - imp - ads - custo;
    return { plat: plat, preco: preco, taxas: tx, imposto: imp, ads: ads, custo: custo, lucro: lucro, margem: preco ? lucro / preco : null };
  }

  // Menor preço que deixa essa margem. A taxa muda com o preço (e no ML pula no R$ 79), então
  // procura subindo o preço de 1% em 1% e depois afina entre os dois últimos.
  function precoParaMargem(plat, custo, margem, comAds) {
    function ok(p) { var r = lucroNaPlataforma(plat, p, custo, comAds); return r.lucro >= margem * p - 0.001; }
    var p = Math.max(1, custo), ant = null;
    for (var i = 0; i < 400 && p < 5000; i++) {
      if (ok(p)) {
        var lo = ant || p / 1.01, hi = p;
        for (var k = 0; k < 30; k++) { var m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
        return Math.ceil(hi * 100) / 100;
      }
      ant = p; p *= 1.01;
    }
    return null;
  }

  function entradaCalcPadrao() {
    var c = getCalc3d(), imp = (c.impressoras || [])[0] || {};
    return { pecaId: '', gramas: '', horas: '', precoKg: Math.round(custoGrama(tiposFilamento()[0]) * 1000 * 100) / 100 || '', perda: num(c.perdaPct),
      watts: num(imp.watts) || 100, kwh: num(c.kwh) || 0.8, embalagem: '', outros: '', preco: '', comAds: true };
  }

  function renderCalculadoraTab(wrap) {
    var e = Object.assign(entradaCalcPadrao(), lerLocal('ml-calc-simples', {}));
    var c = getCalc3d();
    function guardar() { gravarLocal('ml-calc-simples', e); atualizar(); }
    function campoNum(rot, chave, passo, dica) {
      var i = el('input', { type: 'number', step: passo, min: '0', value: e[chave] === '' || e[chave] === undefined ? '' : e[chave] });
      i.addEventListener('input', function () { e[chave] = i.value === '' ? '' : Number(i.value); guardar(); });
      return el('div', { class: 'pml-field' }, [el('label', { text: rot }), i, dica ? el('div', { class: 'pml-margin', style: 'margin-top:3px;', text: dica }) : null]);
    }
    var sel = el('select', {}, [el('option', { value: '', text: 'Peça nova (preencher à mão)' })].concat((c.produtos || []).filter(function (p) { return num(p.gramas) > 0; }).map(function (p) {
      var o = el('option', { value: p.id, text: p.nome }); if (e.pecaId === p.id) o.setAttribute('selected', ''); return o;
    })));
    sel.addEventListener('change', function () {
      var p = (c.produtos || []).find(function (x) { return x.id === sel.value; });
      e.pecaId = sel.value;
      if (p) {
        var porPlaca = Math.max(1, num(p.porPlaca) || 1);
        e.gramas = Math.round(num(p.gramas) / porPlaca * 10) / 10; e.horas = Math.round(num(p.horas) / porPlaca * 100) / 100;
        e.precoKg = Math.round(custoGrama(p.tipo) * 1000 * 100) / 100;
        e.embalagem = Math.round(insumosNaData(p).reduce(function (s, i) { return s + custoEmbalagem(i.nome) * num(i.qtd); }, 0) * 100) / 100;
        e.outros = num(p.extras) || '';
        var pr = p.precos && (p.precos.ml || p.precos.shopee); if (pr) e.preco = num(pr);
      }
      gravarLocal('ml-calc-simples', e); render();
    });
    var chk = el('input', { type: 'checkbox' }); chk.checked = e.comAds !== false;
    chk.addEventListener('change', function () { e.comAds = chk.checked; guardar(); });

    wrap.appendChild(el('div', { class: 'pml-card' }, [
      el('p', { class: 'pml-section-title', text: 'Calculadora 3D: quanto custa e quanto cai no bolso' }),
      el('p', { class: 'pml-margin', style: 'margin:0 0 12px;', text: 'Preencha a peça e o preço de venda. Os números já vêm com o seu filamento, a sua luz e as taxas das suas vendas parecidas.' }),
      el('div', { class: 'pml-form-grid' }, [el('div', { class: 'pml-field' }, [el('label', { text: 'Começar de uma peça sua' }), sel])]),
      el('p', { class: 'pml-metric-label', style: 'margin:14px 0 6px;', text: 'A peça' }),
      el('div', { class: 'pml-form-grid' }, [campoNum('Filamento (gramas)', 'gramas', '1', 'o fatiador mostra'), campoNum('Tempo de impressão (horas)', 'horas', '0.1', 'por peça'),
        campoNum('Preço do filamento (R$ por kg)', 'precoKg', '0.01', 'média das suas compras'), campoNum('Falhas (% a mais de filamento)', 'perda', '1')]),
      el('p', { class: 'pml-metric-label', style: 'margin:14px 0 6px;', text: 'Luz e embalagem' }),
      el('div', { class: 'pml-form-grid' }, [campoNum('Impressora (watts)', 'watts', '1', 'Bambu A1 ≈ 100 W'), campoNum('Luz (R$ por kWh)', 'kwh', '0.01', 'da conta de luz'),
        campoNum('Embalagem (R$)', 'embalagem', '0.01', 'caixa, saco, etiqueta, plástico...'), campoNum('Outros (R$)', 'outros', '0.01', 'fita, parafuso, brinde...')]),
      el('p', { class: 'pml-metric-label', style: 'margin:14px 0 6px;', text: 'Venda' }),
      el('div', { class: 'pml-form-grid' }, [campoNum('Preço de venda (R$)', 'preco', '0.01'),
        el('div', { class: 'pml-field' }, [el('label', { text: 'Ads' }), el('label', { style: 'display:flex; gap:6px; align-items:center; font-weight:400;' }, [chk, el('span', { text: 'Descontar o Ads (Shopee ' + fmtPct(adsPctPlataforma('shopee')) + ' das vendas)' })])])])
    ]));
    var res = el('div');
    wrap.appendChild(res);

    function atualizar() {
      res.innerHTML = '';
      var custo = custoCalcSimples(e), preco = num(e.preco);
      res.appendChild(el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Custo de cada peça: ' + fmtMoney(custo.total) }),
        el('p', { class: 'pml-margin', style: 'margin:0;', text: 'Filamento ' + fmtMoney(custo.filamento) + ' · luz ' + fmtMoney(custo.luz) + ' · embalagem ' + fmtMoney(custo.embalagem) + (custo.outros ? ' · outros ' + fmtMoney(custo.outros) : '') })]));
      if (!(custo.total > 0)) return;
      var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: preco ? 'Vendendo a ' + fmtMoney(preco) : 'Que preço cobrar' })]);
      var t = el('table', { class: 'pml-table' });
      var cab = preco ? ['', 'Taxas e frete', 'Imposto', 'Ads', 'Custo da peça', 'Cai no bolso', 'Margem', 'Preço p/ 30%'] : ['', 'Empata em', 'Preço p/ 20%', 'Preço p/ 30%', 'Preço p/ 40%'];
      t.appendChild(el('tr', {}, cab.map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); })));
      var fontes = [];
      CALC_PLATS.forEach(function (pl) {
        var p30 = precoParaMargem(pl, custo.total, 0.3, e.comAds !== false);
        if (preco) {
          var r = lucroNaPlataforma(pl, preco, custo.total, e.comAds !== false);
          fontes.push(NOMES_PLAT[pl] + ': ' + (r.taxas.fonte === 'real' ? r.taxas.amostra + ' vendas suas parecidas (' + fmtPct(r.taxas.pct) + ')' : 'taxa da tabela (sem vendas parecidas)'));
          t.appendChild(el('tr', { class: r.lucro < 0 ? 'pml-row-alerta' : '' }, [el('td', { style: 'font-weight:600;', text: NOMES_PLAT[pl] }),
            el('td', { class: 'num', text: '−' + fmtMoney(r.taxas.valor) }), el('td', { class: 'num', text: '−' + fmtMoney(r.imposto) }),
            el('td', { class: 'num', text: r.ads ? '−' + fmtMoney(r.ads) : '—' }), el('td', { class: 'num', text: '−' + fmtMoney(custo.total) }),
            el('td', { class: 'num', style: 'font-weight:700; font-size:15px; color:var(' + (r.lucro < 0 ? '--bad' : '--good') + ');', text: fmtMoney(r.lucro) }),
            el('td', { class: 'num', text: fmtPct(r.margem) }), el('td', { class: 'num', text: p30 ? fmtMoney(p30) : '—' })]));
        } else {
          t.appendChild(el('tr', {}, [el('td', { style: 'font-weight:600;', text: NOMES_PLAT[pl] })].concat([0, 0.2, 0.3, 0.4].map(function (m) {
            var p = precoParaMargem(pl, custo.total, m, e.comAds !== false); return el('td', { class: 'num', text: p ? fmtMoney(p) : '—' });
          }))));
        }
      });
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
      card.appendChild(el('p', { class: 'pml-note', text: (preco ? 'Taxas: ' + fontes.join(' · ') + '. ' : 'Digite o preço de venda para ver quanto cai no bolso. ') + 'Imposto do Simples ' + fmtPct(num(state.configLucro.imposto) / 100) + '. No ML, abaixo de R$ 79 o comprador paga parte do frete; acima, o frete grátis sai de você.' }));
      res.appendChild(card);
    }
    atualizar();
  }
