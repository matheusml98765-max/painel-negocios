  function renderCalc3dTab(wrap) {
    var c = getCalc3d();
    function salvarERender() { salvarCalc3d(); render(); }
    function campo(label, input, dica) {
      return el('div', { class: 'pml-field' }, [el('label', { text: label }), input, dica ? el('div', { class: 'pml-margin', style: 'margin-top:3px;', text: dica }) : null]);
    }
    function inputNum(obj, chave, passo, aoMudar) {
      var i = el('input', { type: 'number', step: passo || '0.01', value: obj[chave] === undefined ? '' : obj[chave] });
      i.addEventListener('change', function () { obj[chave] = i.value === '' ? '' : num(i.value); (aoMudar || salvarERender)(); });
      return i;
    }
    function inputTxt(obj, chave, ph) {
      var i = el('input', { value: obj[chave] || '', placeholder: ph || '' });
      i.addEventListener('change', function () { obj[chave] = i.value.trim(); salvarERender(); });
      return i;
    }
    function hoje() { return new Date().toISOString().slice(0, 10); }

    wrap.appendChild(el('div', { class: 'pml-dica', style: 'margin:0 0 20px;', html: 'Calculadora própria da sua impressão 3D. Cadastre cada <b>remessa</b> de filamento e embalagem com o preço que você pagou — o custo por grama é a média de todas as remessas, então quando o preço muda, o custo das peças acompanha sozinho. As peças ligadas a um anúncio do ML entram direto na aba <b>Lucro real</b>.' }));

    // ---------- Custos gerais ----------
    var g = el('div', { class: 'pml-card' });
    g.appendChild(el('p', { class: 'pml-section-title', text: '1. Custos gerais' }));
    g.appendChild(el('div', { class: 'pml-form-grid' }, [
      campo('Luz (R$ por kWh)', inputNum(c, 'kwh', '0.01'), 'Valor na sua conta de luz'),
      campo('Perdas e falhas (%)', inputNum(c, 'perdaPct', '1'), 'Peças que dão errado'),
      campo('Manutenção (R$ por hora)', inputNum(c, 'manutencaoHora', '0.05'), 'Bico, mesa, correias...')
    ]));
    g.appendChild(el('p', { style: 'font-size:13px; font-weight:700; margin:14px 0 8px;', text: 'Impressoras' }));
    c.impressoras.forEach(function (imp) {
      var linha = el('div', { class: 'pml-form-grid', style: 'align-items:start; padding-bottom:8px; border-bottom:1px solid var(--line); margin-bottom:12px;' }, [
        campo('Nome', inputTxt(imp, 'nome')),
        campo('Consumo (watts)', inputNum(imp, 'watts', '1'), 'Média durante a impressão'),
        campo('Quanto pagou (R$)', inputNum(imp, 'preco', '1')),
        campo('Vida útil (horas)', inputNum(imp, 'vidaHoras', '100'), 'Para dividir o desgaste'),
        c.impressoras.length > 1 ? el('div', {}, [el('button', { class: 'pml-btn secondary', text: 'Remover', onclick: function () { c.impressoras = c.impressoras.filter(function (x) { return x !== imp; }); salvarERender(); } })]) : null
      ]);
      g.appendChild(linha);
    });
    g.appendChild(el('button', { class: 'pml-btn secondary', style: 'color:var(--good);', text: '+ Adicionar impressora', onclick: function () { c.impressoras.push({ id: uid(), nome: 'Impressora ' + (c.impressoras.length + 1), watts: 150, preco: 0, vidaHoras: 5000 }); salvarERender(); } }));
    wrap.appendChild(g);

    // ---------- Remessas de filamento ----------
    function cardLotes(titulo, lista, colunas, novoLote, resumo) {
      var card = el('div', { class: 'pml-card' });
      card.appendChild(el('p', { class: 'pml-section-title', text: titulo }));
      if (resumo) card.appendChild(resumo);
      var t = el('table', { class: 'pml-table' });
      t.appendChild(el('tr', {}, colunas.map(function (col) { return el('th', { class: col.num ? 'num' : '', text: col.titulo }); }).concat([el('th', { text: '' })])));
      lista.slice().reverse().forEach(function (l) {
        t.appendChild(el('tr', {}, colunas.map(function (col) {
          var inp = col.num ? inputNum(l, col.chave, col.passo) : (col.chave === 'data' ? (function () { var d = el('input', { type: 'date', value: l.data || '' }); d.addEventListener('change', function () { l.data = d.value; salvarERender(); }); return d; })() : inputTxt(l, col.chave, col.ph));
          inp.setAttribute('style', 'width:100%; min-width:' + (col.largura || 70) + 'px; padding:5px 7px; border:1px solid var(--line); border-radius:6px; font-size:13px; background:var(--field); font-family:inherit;');
          return el('td', {}, [inp]);
        }).concat([el('td', {}, [el('button', { class: 'pml-btn secondary', text: '✕', title: 'Remover', onclick: function () { lista.splice(lista.indexOf(l), 1); salvarERender(); } })])])));
      });
      if (!lista.length) t.appendChild(el('tr', {}, [el('td', { colspan: String(colunas.length + 1), class: 'pml-margin', text: 'Nenhuma remessa cadastrada ainda.' })]));
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
      card.appendChild(el('button', { class: 'pml-btn', style: 'margin-top:12px; padding:7px 14px; font-size:13px;', text: '+ Nova remessa', onclick: function () { lista.push(novoLote()); salvarERender(); } }));
      return card;
    }

    var resumoFil = el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;' }, tiposFilamento().map(function (t) {
      return el('span', { class: 'pml-badge venda', style: 'font-size:12px;', text: t + ': ' + fmtMoney(custoGrama(t) * 1000) + '/kg · ' + fmtMoney(custoGrama(t)).replace('R$', 'R$') + '/g' });
    }));
    wrap.appendChild(cardLotes('2. Remessas de filamento', c.filamentos, [
      { titulo: 'Data', chave: 'data', largura: 130 },
      { titulo: 'Tipo', chave: 'tipo', ph: 'PLA, PETG...', largura: 70 },
      { titulo: 'Descrição', chave: 'descricao', ph: 'Marca / cor', largura: 140 },
      { titulo: 'Kg', chave: 'kg', num: true, passo: '0.1' },
      { titulo: 'Preço pago (R$)', chave: 'preco', num: true },
      { titulo: 'Frete (R$)', chave: 'frete', num: true }
    ], function () { return { id: uid(), data: hoje(), tipo: 'PLA', descricao: '', kg: 1, preco: '', frete: 0 }; }, resumoFil));

    var resumoEmb = el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;' }, nomesEmbalagem().map(function (n) {
      return el('span', { class: 'pml-badge compra', style: 'font-size:12px;', text: n + ': ' + fmtMoney(custoEmbalagem(n)) + ' cada' });
    }));
    wrap.appendChild(cardLotes('3. Embalagens e insumos (caixa, saco, etiqueta, fita, parafuso...)', c.embalagens, [
      { titulo: 'Data', chave: 'data', largura: 130 },
      { titulo: 'Item', chave: 'nome', ph: 'Ex: Caixa 19x12x12', largura: 160 },
      { titulo: 'Qtd. na remessa', chave: 'qtd', num: true, passo: '1' },
      { titulo: 'Preço pago (R$)', chave: 'preco', num: true },
      { titulo: 'Frete (R$)', chave: 'frete', num: true }
    ], function () { return { id: uid(), data: hoje(), nome: '', qtd: 100, preco: '', frete: 0 }; }, resumoEmb));

    // ---------- Pecas ----------
    var pc = el('div', { class: 'pml-card' });
    pc.appendChild(el('p', { class: 'pml-section-title', text: '4. Suas peças — custo de cada uma' }));
    pc.appendChild(el('p', { class: 'pml-note', style: 'margin:-6px 0 14px;', text: 'Gramas e horas vêm do fatiador (Cura, Bambu Studio, Orca...). Se imprime várias peças de uma vez, informe quantas saem por impressão. Em "Anúncios", cole os códigos MLB do Mercado Livre e o ID do item da Shopee dessa peça para o lucro aparecer na aba Lucro real.' }));
    c.produtos.forEach(function (p) {
      var custo = custoPeca3d(p);
      var selTipo = el('select', {}, tiposFilamento().map(function (t) { var o = el('option', { value: t, text: t }); if ((p.tipo || '').toUpperCase() === t) o.setAttribute('selected', ''); return o; }));
      selTipo.addEventListener('change', function () { p.tipo = selTipo.value; salvarERender(); });
      var selImp = el('select', {}, c.impressoras.map(function (i) { var o = el('option', { value: i.id, text: i.nome }); if (p.impressoraId === i.id) o.setAttribute('selected', ''); return o; }));
      selImp.addEventListener('change', function () { p.impressoraId = selImp.value; salvarERender(); });

      var bloco = el('div', { style: 'border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:12px; background:var(--field);' });
      bloco.appendChild(el('div', { style: 'display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap; margin-bottom:10px;' }, [
        el('div', { style: 'flex:1; min-width:200px;' }, [campo('Peça', inputTxt(p, 'nome', 'Ex: Suporte papel higiênico'))]),
        el('div', { style: 'text-align:right;' }, [
          el('div', { class: 'pml-metric-label', text: 'Custo por peça' }),
          el('div', { class: 'pml-metric-value', style: 'color:var(--warn);', text: (num(p.gramas) > 0 && num(p.horas) > 0) ? fmtMoney(custo.total) : 'faltam gramas e horas' })
        ])
      ]));
      bloco.appendChild(el('div', { class: 'pml-form-grid' }, [
        campo('Filamento', selTipo),
        campo('Gramas (por impressão)', inputNum(p, 'gramas', '1')),
        campo('Horas (por impressão)', inputNum(p, 'horas', '0.1')),
        campo('Peças por impressão', inputNum(p, 'porPlaca', '1')),
        campo('Impressora', selImp),
        campo('Extras por peça (R$)', inputNum(p, 'extras', '0.01'), 'Parafuso, fita, etiqueta...'),
        campo('Anúncios (ML ou Shopee)', inputTxt(p, 'anuncios', 'MLB123, 22894922420'))
      ]));
      var ins = el('div', { style: 'margin:6px 0 4px;' }, [el('div', { class: 'pml-metric-label', style: 'margin-bottom:6px;', text: 'Embalagem e insumos usados por peça' })]);
      p.insumos.forEach(function (it) {
        var sel = el('select', { style: 'padding:6px 8px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; background:var(--field); font-family:inherit;' }, nomesEmbalagem().map(function (n) { var o = el('option', { value: n, text: n }); if (it.nome === n) o.setAttribute('selected', ''); return o; }));
        sel.addEventListener('change', function () { it.nome = sel.value; salvarERender(); });
        var q = el('input', { type: 'number', step: '0.1', value: it.qtd, style: 'width:80px; padding:6px 8px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; background:var(--field);' });
        q.addEventListener('change', function () { it.qtd = num(q.value); salvarERender(); });
        ins.appendChild(el('div', { style: 'display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;' }, [
          sel, el('span', { class: 'pml-margin', text: '×' }), q,
          el('span', { class: 'pml-margin', text: '= ' + fmtMoney(custoEmbalagem(it.nome) * num(it.qtd)) }),
          el('button', { class: 'pml-btn secondary', text: '✕', onclick: function () { p.insumos.splice(p.insumos.indexOf(it), 1); salvarERender(); } })
        ]));
      });
      if (nomesEmbalagem().length) {
        ins.appendChild(el('button', { class: 'pml-btn secondary', style: 'color:var(--good);', text: '+ insumo', onclick: function () { p.insumos.push({ nome: nomesEmbalagem()[0], qtd: 1 }); salvarERender(); } }));
      } else {
        ins.appendChild(el('span', { class: 'pml-margin', text: 'Cadastre embalagens e insumos na seção 3 para usar aqui.' }));
      }
      bloco.appendChild(ins);
      var partes = [['Filamento', custo.material], ['Luz', custo.energia], ['Desgaste', custo.desgaste], ['Manutenção', custo.manutencao], ['Perdas', custo.perda], ['Embalagem e insumos', custo.embalagem], ['Extras', custo.extras]];
      bloco.appendChild(el('div', { class: 'pml-margin', style: 'margin-top:4px; line-height:1.8;' }, partes.map(function (x) {
        return el('span', { style: 'margin-right:14px; white-space:nowrap;', text: x[0] + ': ' + fmtMoney(x[1]) });
      })));
      bloco.appendChild(el('button', { class: 'pml-btn secondary', style: 'margin-top:8px;', text: 'Remover peça', onclick: function () { c.produtos = c.produtos.filter(function (x) { return x !== p; }); salvarERender(); } }));
      pc.appendChild(bloco);
    });
    pc.appendChild(el('button', { class: 'pml-btn', text: '+ Nova peça', onclick: function () { c.produtos.push({ id: uid(), nome: '', tipo: tiposFilamento()[0], gramas: '', horas: '', porPlaca: 1, impressoraId: (c.impressoras[0] || {}).id, insumos: [], precos: {}, extras: 0, anuncios: '' }); salvarERender(); } }));
    wrap.appendChild(pc);

    // ---------- Simulador por plataforma ----------
    if (c.produtos.length) {
      var sim = el('div', { class: 'pml-card' });
      sim.appendChild(el('p', { class: 'pml-section-title', text: '5. Preço e lucro em cada plataforma' }));
      sim.appendChild(el('p', { class: 'pml-note', style: 'margin:-6px 0 12px;', text: 'Cada plataforma cobra diferente. Ajuste as taxas se mudarem — os valores iniciais são os públicos de 2026 e o Ads da Shopee é o seu gasto real do último mês (15,5% das vendas).' }));
      sim.appendChild(el('div', { class: 'pml-form-grid', style: 'max-width:220px;' }, [campo('Imposto (% da venda)', inputNum(c, 'imposto', '0.5'))]));

      c.plataformas.forEach(function (pl) {
        var bloco = el('div', { style: 'border-top:1px solid var(--surface-2); padding-top:14px; margin-top:14px;' });
        bloco.appendChild(el('p', { style: 'font-size:15px; font-weight:700; margin:0 0 4px;', text: pl.nome }));
        if (pl.nota) bloco.appendChild(el('p', { class: 'pml-margin', style: 'margin:0 0 10px;', text: pl.nota }));
        bloco.appendChild(el('div', { class: 'pml-form-grid' }, [
          campo('Comissão (%)', inputNum(pl, 'comissao', '0.5')),
          campo('Taxa fixa por item (R$)', inputNum(pl, 'taxaFixa', '0.5')),
          campo('Frete que você paga (R$)', inputNum(pl, 'frete', '0.5')),
          campo('Ads (% das vendas)', inputNum(pl, 'ads', '0.5'))
        ]));
        var pct = (num(pl.comissao) + num(c.imposto) + num(pl.ads)) / 100;
        var fixo = num(pl.taxaFixa) + num(pl.frete);
        function precoPara(custo, margem) { var d = 1 - pct - margem; return d > 0 ? (custo + fixo) / d : null; }
        var t = el('table', { class: 'pml-table' });
        t.appendChild(el('tr', {}, ['Peça', 'Custo', 'Empata em', 'Preço p/ 20%', 'Preço p/ 30%', 'Seu preço', 'Lucro', 'Margem'].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); })));
        c.produtos.forEach(function (p) {
          var custo = custoPeca3d(p).total;
          var pronta = num(p.gramas) > 0 && num(p.horas) > 0;
          if (!pronta) {
            t.appendChild(el('tr', {}, [el('td', { text: p.nome || '(sem nome)' }), el('td', { colspan: '7', class: 'pml-margin', text: 'Preencha gramas e horas desta peça (seção 4) para calcular.' })]));
            return;
          }
          var precoInp = el('input', { class: 'pml-custo-input', type: 'number', step: '0.01', value: p.precos[pl.id] || '', placeholder: 'R$' });
          precoInp.addEventListener('change', function () { p.precos[pl.id] = num(precoInp.value) || ''; salvarERender(); });
          var pv = num(p.precos[pl.id]);
          var lucro = pv ? pv * (1 - pct) - fixo - custo : null;
          t.appendChild(el('tr', { class: lucro !== null && lucro < 0 ? 'pml-row-alerta' : (lucro !== null && lucro / pv < 0.1 ? 'pml-row-atencao' : '') }, [
            el('td', { text: p.nome || '(sem nome)' }),
            el('td', { class: 'num', text: fmtMoney(custo) }),
            el('td', { class: 'num', text: precoPara(custo, 0) ? fmtMoney(precoPara(custo, 0)) : '—' }),
            el('td', { class: 'num', text: precoPara(custo, 0.2) ? fmtMoney(precoPara(custo, 0.2)) : '—' }),
            el('td', { class: 'num', text: precoPara(custo, 0.3) ? fmtMoney(precoPara(custo, 0.3)) : '—' }),
            el('td', { class: 'num' }, [precoInp]),
            el('td', { class: 'num', style: lucro !== null && lucro < 0 ? 'color:var(--bad); font-weight:700;' : 'font-weight:600;', text: lucro === null ? '—' : fmtMoney(lucro) }),
            el('td', { class: 'num', text: lucro === null ? '—' : fmtPct(lucro / pv) })
          ]));
        });
        bloco.appendChild(el('div', { class: 'pml-scroll' }, [t]));
        sim.appendChild(bloco);
      });
      wrap.appendChild(sim);
    }
  }

