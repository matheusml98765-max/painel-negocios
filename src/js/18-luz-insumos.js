  // ===================== LUZ DAS IMPRESSORAS E INSUMOS =====================
  // Tudo calculado pelas vendas: cada peca 3D vendida = as horas e os gramas do fatiamento
  // (Calculadora 3D) mais a % de perdas. Insumos (caixa, saco, fita, parafuso...) saem do
  // estoque contado pelo vendedor e baixam sozinhos a cada venda.

  function pecaDoItem(itemId) {
    var id = String(itemId || '').trim().toUpperCase();
    if (!id || !state.calc3d) return null;
    return (state.calc3d.produtos || []).find(function (p) {
      return String(p.anuncios || '').toUpperCase().split(/[\s,;]+/).indexOf(id) !== -1;
    }) || null;
  }

  // Pecas 3D vendidas no intervalo (de/ate 'AAAA-MM-DD'), com horas, gramas e kWh.
  function calcConsumo3d(de, ate) {
    var c = getCalc3d();
    var perda = 1 + num(c.perdaPct) / 100;
    var r = { pecas: {}, unidades: 0, horas: 0, gramas: 0, kwh: 0, luz: 0, insumos: {} };
    state.transacoes.forEach(function (t) {
      if (t.tipo !== 'venda' || !Array.isArray(t.itens) || !t.data || t.data < de || t.data > ate) return;
      t.itens.forEach(function (i) {
        var p = pecaDoItem(i.item_id);
        if (!p) return;
        var qtd = Number(i.quantidade) || 1;
        var imp = c.impressoras.find(function (x) { return x.id === p.impressoraId; }) || c.impressoras[0] || { watts: 100 };
        var porPlaca = Math.max(1, num(p.porPlaca) || 1);
        var h = num(p.horas) / porPlaca * qtd * perda;
        var kwh = h * num(imp.watts) / 1000;
        var e = r.pecas[p.id] || (r.pecas[p.id] = { nome: p.nome, unidades: 0, horas: 0, gramas: 0, kwh: 0 });
        e.unidades += qtd; e.horas += h; e.gramas += num(p.gramas) / porPlaca * qtd * perda; e.kwh += kwh;
        r.unidades += qtd; r.horas += h; r.gramas += num(p.gramas) / porPlaca * qtd * perda; r.kwh += kwh;
        (p.insumos || []).forEach(function (s) { r.insumos[s.nome] = (r.insumos[s.nome] || 0) + num(s.qtd) * qtd; });
      });
    });
    if (typeof falhasNoPeriodo === 'function') {
      var fx = falhasNoPeriodo(de, ate);
      r.falhas = fx; r.horas += fx.horas; r.kwh += fx.kwh; r.gramas += fx.gramas;
    }
    r.luz = r.kwh * num(c.kwh);
    r.lista = Object.keys(r.pecas).map(function (k) { return r.pecas[k]; }).sort(function (a, b) { return b.horas - a.horas; });
    return r;
  }

  function isoHoje(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return isoDia(d); }

  // Estoque de cada insumo e de cada filamento: contagem feita pelo vendedor + compras depois
  // dela - o que as vendas gastaram, pela ordem das compras (23-fifo.js).
  function calcEstoqueInsumos() {
    var c = getCalc3d();
    c.estoqueInsumos = c.estoqueInsumos || {};
    var itens = [];
    tiposFilamento().forEach(function (t) { if (c.filamentos.length) itens.push({ nome: nomeFilamentoEstoque(t), chave: 'fil:' + t.toUpperCase(), fator: 1000 }); });
    var nomes = {};
    c.embalagens.forEach(function (l) { if (l.nome) nomes[l.nome] = true; });
    c.produtos.forEach(function (p) { (p.insumos || []).forEach(function (s) { if (s.nome && num(s.qtd) > 0) nomes[s.nome] = true; }); });
    Object.keys(nomes).forEach(function (n) { itens.push({ nome: n, chave: 'emb:' + n, fator: 1 }); });
    var ini = isoHoje(-29);
    return itens.map(function (it) {
      var uso = usoPorDia(it.chave);
      var u30 = Object.keys(uso).reduce(function (s, d) { return s + (d >= ini ? uso[d] : 0); }, 0) / it.fator;
      var cont = c.estoqueInsumos[it.nome];
      var linha = { nome: it.nome, contado: !!cont, porDia: u30 / 30, semPreco: !lotesFifo(it.chave).length };
      if (cont) {
        var f = filaFifo(it.chave);
        var usado = Object.keys(uso).reduce(function (s, d) { return s + (d > cont.data ? uso[d] : 0); }, 0) / it.fator;
        var comprado = lotesFifo(it.chave).filter(function (l) { return l.data >= cont.data; }).reduce(function (s, l) { return s + l.qtd; }, 0) / it.fator;
        linha.sobra = num(cont.qtd) + comprado - usado;
        linha.comprado = comprado; linha.usado = usado; linha.desde = cont.data;
        linha.dias = linha.porDia > 0 ? Math.max(0, linha.sobra) / linha.porDia : null;
        if (f && f.fila.length) linha.loteAtual = { data: f.fila[0].data, unit: f.fila[0].unit * it.fator, semCompra: f.fila[0].semCompra };
      }
      return linha;
    }).sort(function (a, b) { return (a.dias === undefined || a.dias === null ? 1e9 : a.dias) - (b.dias === undefined || b.dias === null ? 1e9 : b.dias); });
  }

  function fmtUnitario(v) { return v > 0 && v < 0.1 ? 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : fmtMoney(v); }
  function fmtQtd(n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 }); }

  function renderLuzInsumosCards(wrap) {
    var c = getCalc3d();
    // ---------- Luz ----------
    var agora = new Date();
    var mesAtual = isoDia(agora).slice(0, 7);
    var ant = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    var mesAnt = isoDia(ant).slice(0, 7);
    var escolha = state.mesLuz === mesAnt ? mesAnt : mesAtual;
    var iv = intervaloMes(escolha);
    var r = calcConsumo3d(iv.de, iv.ate);
    var card = el('div', { class: 'pml-card' });
    card.appendChild(el('p', { class: 'pml-section-title', text: 'Luz das impressoras (peças vendidas + falhas lançadas)' }));
    var sel = el('select', { onchange: function () { state.mesLuz = sel.value; render(); } }, [mesAtual, mesAnt].map(function (m) {
      var p = m.split('-'); var nome = new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      var o = el('option', { value: m, text: nome.charAt(0).toUpperCase() + nome.slice(1) + (m === mesAtual ? ' (até hoje)' : '') });
      if (m === escolha) o.setAttribute('selected', ''); return o;
    }));
    card.appendChild(el('div', { class: 'pml-field', style: 'max-width:300px; margin-bottom:12px;' }, [sel]));
    if (!r.unidades) {
      card.appendChild(el('div', { class: 'pml-empty', text: 'Nenhuma peça 3D vendida neste mês com gramas, horas e código do anúncio preenchidos.' }));
    } else {
      card.appendChild(el('div', { class: 'pml-metrics', style: 'margin-bottom:12px;' }, [
        metricaFicha('Horas de impressão', Math.round(r.horas).toLocaleString('pt-BR') + ' h', r.unidades + ' peças vendidas' + (r.falhas && r.falhas.horas ? ' + ' + r.falhas.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h de falhas' : '') + (num(c.perdaPct) ? ' + ' + num(c.perdaPct) + '% de perdas' : '')),
        metricaFicha('Energia', r.kwh.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kWh', 'a ' + fmtMoney(num(c.kwh)) + ' por kWh'),
        metricaFicha('Sua parte na conta de luz', fmtMoney(r.luz), 'só o que as impressoras gastaram', 'neg'),
        metricaFicha('Filamento usado', (r.gramas / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg', 'pelas peças vendidas')
      ]));
      var t = el('table', { class: 'pml-table' });
      t.appendChild(el('tr', {}, [el('th', { text: 'Peça' }), el('th', { class: 'num', text: 'Vendidas' }), el('th', { class: 'num', text: 'Horas' }), el('th', { class: 'num', text: 'kWh' }), el('th', { class: 'num', text: 'Luz' })]));
      r.lista.forEach(function (p) {
        t.appendChild(el('tr', {}, [el('td', { text: p.nome }), el('td', { class: 'num', text: String(p.unidades) }), el('td', { class: 'num', text: p.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }), el('td', { class: 'num', text: p.kwh.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }), el('td', { class: 'num', text: fmtMoney(p.kwh * num(c.kwh)) })]));
      });
      card.appendChild(el('div', { class: 'pml-scroll' }, [t]));
    }
    card.appendChild(el('p', { class: 'pml-note', text: 'Conta feita com as horas de cada peça no fatiamento × a potência da impressora (aba acima). Inclui as perdas, mas não o tempo parada ligada. Para medir exato, use uma tomada com medidor de energia em cada impressora.' }));
    wrap.appendChild(card);

    // ---------- Insumos ----------
    var lista = calcEstoqueInsumos();
    if (!lista.length) return;
    var ci = el('div', { class: 'pml-card' });
    ci.appendChild(el('p', { class: 'pml-section-title', text: 'Estoque de insumos (baixa sozinho a cada venda)' }));
    var alerta = lista.filter(function (l) { return l.dias !== undefined && l.dias !== null && l.dias <= 10; });
    if (alerta.length) ci.appendChild(el('div', { class: 'pml-dica', style: 'margin-bottom:12px;', html: '🛒 <b>Hora de comprar:</b> ' + alerta.map(function (l) { return l.nome + ' (acaba em ' + Math.max(0, Math.round(l.dias)) + ' dias)'; }).join(', ') + '.' }));
    var t2 = el('table', { class: 'pml-table' });
    t2.appendChild(el('tr', {}, [el('th', { text: 'Insumo' }), el('th', { class: 'num', text: 'Usa por dia' }), el('th', { class: 'num', text: 'Sobra hoje' }), el('th', { class: 'num', text: 'Dura' }), el('th', { text: 'Contei agora' })]));
    lista.forEach(function (l) {
      var inp = el('input', { type: 'number', step: 'any', min: '0', placeholder: 'quantidade', style: 'width:110px;' });
      var btn = el('button', { class: 'pml-btn', style: 'padding:5px 10px; font-size:12px; margin-left:6px;', text: 'Salvar', onclick: function () {
        if (inp.value === '') return;
        c.estoqueInsumos = c.estoqueInsumos || {};
        c.estoqueInsumos[l.nome] = { qtd: num(inp.value), data: isoHoje(0) };
        salvarCalc3d(); render();
      } });
      t2.appendChild(el('tr', { class: l.dias !== undefined && l.dias !== null && l.dias <= 10 ? 'pml-row-alerta' : '' }, [
        el('td', {}, [el('div', { text: l.nome }), l.contado ? el('div', { class: 'pml-margin', text: 'contado em ' + l.desde.split('-').reverse().join('/') + ' · +' + fmtQtd(l.comprado) + ' comprados · −' + fmtQtd(l.usado) + ' usados nas vendas' + (l.loteAtual ? ' · usando agora a compra de ' + (l.loteAtual.semCompra ? 'antes do cadastro' : l.loteAtual.data.split('-').reverse().join('/')) + ' (' + fmtUnitario(l.loteAtual.unit) + ' cada)' : '') }) : el('div', { class: 'pml-margin', text: 'conte quantos tem hoje' }), l.semPreco ? el('div', { class: 'pml-margin', style: 'color:var(--warn);', text: 'falta cadastrar a compra (preço)' }) : null].filter(Boolean)),
        el('td', { class: 'num', text: l.porDia ? l.porDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0' }),
        el('td', { class: 'num', style: 'font-weight:700;', text: l.contado ? fmtQtd(l.sobra) : '—' }),
        el('td', { class: 'num', text: l.dias === undefined ? '—' : (l.dias === null ? 'sem uso' : Math.max(0, Math.round(l.dias)) + ' dias') }),
        el('td', {}, [inp, btn])
      ]));
    });
    ci.appendChild(el('div', { class: 'pml-scroll' }, [t2]));
    ci.appendChild(el('p', { class: 'pml-note', text: 'Conte uma vez quanto tem de cada insumo e salve. Depois, cada compra cadastrada soma, e cada venda tira o que a peça usa (ex.: papel higiênico com parafuso tira 2 pares de parafuso e bucha e 120 cm de plástico bolha). Fita e plástico bolha em cm; filamento em kg (o que as vendas gastam: peças impressas para estoque e falhas ainda não entram). O custo de cada venda usa a compra que estava sendo gasta naquele dia: a mais antiga primeiro.' }));
    ci.appendChild(el('p', { class: 'pml-note', text: 'Se a sobra ficar negativa, faltou cadastrar alguma compra.' }));
    wrap.appendChild(ci);
  }
