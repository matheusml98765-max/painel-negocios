  function renderCalc3dTab(wrap) {
    renderPlanoImpressaoCard(wrap);
    renderHorasImpressorasCard(wrap);
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

    wrap.appendChild(el('div', { class: 'pml-dica', style: 'margin:0 0 20px;', html: 'Os dados da sua produção 3D. Cadastre cada <b>remessa</b> de filamento e embalagem com o preço que você pagou — o custo por grama é a média de todas as remessas, então quando o preço muda, o custo das peças acompanha sozinho. As peças ligadas a um anúncio entram direto no lucro das vendas. Para simular preço e lucro de uma peça, use a aba <b>Calculadora 3D</b>.' }));

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
      return el('span', { class: 'pml-badge venda', style: 'font-size:12px;', text: t + ' (preço de hoje: compras dos últimos 30 dias): ' + fmtMoney(custoGrama(t) * 1000) + '/kg · ' + fmtMoney(custoGrama(t)).replace('R$', 'R$') + '/g' });
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
    pc.appendChild(el('p', { class: 'pml-note', style: 'margin:-6px 0 14px;', text: 'Gramas e horas vêm do fatiador (Cura, Bambu Studio, Orca...). Se imprime várias peças de uma vez, informe quantas saem por impressão. Em "Anúncios", cole os códigos MLB do Mercado Livre e o ID do item da Shopee dessa peça para o lucro aparecer na aba Lucro por produto.' }));
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
      var antigos = p.insumos.filter(function (it) { return it.ate && it.ate < isoHoje(0); });
      p.insumos.forEach(function (it) {
        if (antigos.indexOf(it) !== -1) return;   // insumo que a peca deixou de usar: vale so para as vendas antigas
        var nomesSel = nomesEmbalagem().indexOf(it.nome) >= 0 ? nomesEmbalagem() : [it.nome].concat(nomesEmbalagem());
        var semPreco = nomesEmbalagem().indexOf(it.nome) < 0;
        var sel = el('select', { style: 'padding:6px 8px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; background:var(--field); font-family:inherit;' }, nomesSel.map(function (n) { var o = el('option', { value: n, text: n }); if (it.nome === n) o.setAttribute('selected', ''); return o; }));
        sel.addEventListener('change', function () { it.nome = sel.value; salvarERender(); });
        var q = el('input', { type: 'number', step: '0.1', value: it.qtd, style: 'width:80px; padding:6px 8px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; background:var(--field);' });
        q.addEventListener('change', function () { it.qtd = num(q.value); salvarERender(); });
        var onde = el('select', { title: 'Em qual plataforma esse insumo vai junto', style: 'padding:6px 8px; border:1px solid var(--field-line); border-radius:7px; font-size:13px; background:var(--field); font-family:inherit;' },
          [['', 'Todas'], ['shopee', 'Só Shopee'], ['ml', 'Só Mercado Livre']].map(function (o) { var op = el('option', { value: o[0], text: o[1] }); if ((it.so || '') === o[0]) op.setAttribute('selected', ''); return op; }));
        onde.addEventListener('change', function () { if (onde.value) it.so = onde.value; else delete it.so; salvarERender(); });
        ins.appendChild(el('div', { style: 'display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;' }, [
          sel, el('span', { class: 'pml-margin', text: '×' }), q, onde,
          semPreco ? el('span', { class: 'pml-margin', style: 'color:var(--warn);', text: 'falta o preço: cadastre a compra na seção 3' }) : el('span', { class: 'pml-margin', text: '= ' + fmtMoney(custoEmbalagem(it.nome) * num(it.qtd)) }),
          el('button', { class: 'pml-btn secondary', text: '✕', onclick: function () { p.insumos.splice(p.insumos.indexOf(it), 1); salvarERender(); } })
        ]));
      });
      if (antigos.length) ins.appendChild(el('div', { class: 'pml-margin', style: 'margin-bottom:6px;', text: 'Usava antes: ' + antigos.map(function (it) { return it.nome + ' × ' + it.qtd + ' (até ' + it.ate.split('-').reverse().join('/') + ')'; }).join(', ') + '. Continua valendo para as vendas até essa data.' }));
      if (nomesEmbalagem().length) {
        ins.appendChild(el('button', { class: 'pml-btn secondary', style: 'color:var(--good);', text: '+ insumo', onclick: function () { p.insumos.push({ nome: nomesEmbalagem()[0], qtd: 1 }); salvarERender(); } }));
      } else {
        ins.appendChild(el('span', { class: 'pml-margin', text: 'Cadastre embalagens e insumos na seção 3 para usar aqui.' }));
      }
      bloco.appendChild(ins);
      var faltaPreco = p.insumos.filter(function (it) { return num(it.qtd) > 0 && nomesEmbalagem().indexOf(it.nome) < 0; }).map(function (it) { return it.nome; });
      if (faltaPreco.length) bloco.appendChild(el('div', { class: 'pml-margin', style: 'color:var(--warn); margin:4px 0;', text: 'O custo ainda não inclui: ' + faltaPreco.join(', ') + '. Falta cadastrar o preço.' }));
      var partes = [['Filamento', custo.material], ['Luz', custo.energia], ['Desgaste', custo.desgaste], ['Manutenção', custo.manutencao], ['Perdas', custo.perda], ['Embalagem e insumos', custo.embalagem], ['Extras', custo.extras]];
      bloco.appendChild(el('div', { class: 'pml-margin', style: 'margin-top:4px; line-height:1.8;' }, partes.map(function (x) {
        return el('span', { style: 'margin-right:14px; white-space:nowrap;', text: x[0] + ': ' + fmtMoney(x[1]) });
      })));
      if (p.insumos.some(function (it) { return it.so; })) {
        var cml = custoPeca3d(p, null, 'ml');
        bloco.appendChild(el('div', { class: 'pml-margin', style: 'margin-top:4px;', text: 'Custo total: Shopee ' + fmtMoney(custo.total) + ' (embalagem ' + fmtMoney(custo.embalagem) + ') · Mercado Livre ' + fmtMoney(cml.total) + ' (embalagem ' + fmtMoney(cml.embalagem) + ')' }));
      }
      bloco.appendChild(el('button', { class: 'pml-btn secondary', style: 'margin-top:8px;', text: 'Remover peça', onclick: function () { c.produtos = c.produtos.filter(function (x) { return x !== p; }); salvarERender(); } }));
      pc.appendChild(bloco);
    });
    pc.appendChild(el('button', { class: 'pml-btn', text: '+ Nova peça', onclick: function () { c.produtos.push({ id: uid(), nome: '', tipo: tiposFilamento()[0], gramas: '', horas: '', porPlaca: 1, impressoraId: (c.impressoras[0] || {}).id, insumos: [], precos: {}, extras: 0, anuncios: '' }); salvarERender(); } }));
    wrap.appendChild(pc);

    renderLuzInsumosCards(wrap);
    renderFalhasCard(wrap);
    renderComprasCard(wrap);
  }
