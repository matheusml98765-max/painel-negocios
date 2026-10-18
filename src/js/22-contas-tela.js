  // ===================== CONTAS A PAGAR: TELA =====================

  function nomeMesLongo(m) {
    var s = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function renderContasTab(wrap) {
    var D = dadosContas();
    function salvar() { gravarLocal('ml-contas-local', D.local); render(); }
    var hoje = isoHoje(0), mesHoje = hoje.slice(0, 7);
    var meses = [];
    for (var i = -3; i <= 12; i++) meses.push(somaMes(mesHoje, i));
    var mes = meses.indexOf(state.contasMes) !== -1 ? state.contasMes : mesHoje;
    var r = resumoContasMes(mes, D);

    var sel = el('select', { onchange: function () { state.contasMes = sel.value; render(); } }, meses.map(function (m) {
      var o = el('option', { value: m, text: nomeMesLongo(m) + (m === mesHoje ? ' (este mês)' : '') }); if (m === mes) o.setAttribute('selected', ''); return o;
    }));
    wrap.appendChild(el('div', { class: 'rel-topo' }, [el('div', {}, [
      el('h2', { text: 'Contas a pagar' }),
      el('p', { class: 'pml-margin', text: 'Contas fixas, parcelas, faturas do cartão e imposto, da loja e do CPF. Me mande pelo chat ou lance aqui.' })
    ]), el('div', { class: 'rel-acoes' }, [sel])]));

    wrap.appendChild(el('div', { class: 'pml-metrics' }, [
      metricaFicha('Total do mês', fmtMoney(r.total), r.linhas.length + (r.linhas.length === 1 ? ' conta' : ' contas'), ''),
      metricaFicha('Já pago', fmtMoney(r.pago), r.total ? fmtPct(r.pago / r.total) + ' do mês' : '—', 'pos'),
      metricaFicha('Falta pagar', fmtMoney(r.falta), r.atrasado ? fmtMoney(r.atrasado) + ' atrasado' : 'nada atrasado', r.atrasado ? 'neg' : ''),
      metricaFicha('Loja / CPF', fmtMoney(r.empresa) + ' / ' + fmtMoney(r.cpf), 'separado por quem paga', '')
    ]));

    // Lista do mes
    var lc = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Vencimentos de ' + nomeMesLongo(mes) })]);
    if (!r.linhas.length) lc.appendChild(el('div', { class: 'pml-empty', text: D.contas.length ? 'Nada vence neste mês.' : 'Nenhuma conta cadastrada ainda. Me mande pelo chat (ex.: "aluguel 800 todo dia 10, CPF") ou use o formulário abaixo.' }));
    r.linhas.forEach(function (l) {
      var dias = Math.round((new Date(l.vence + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
      var status = l.pago ? 'pago em ' + l.pago.split('-').reverse().join('/') : dias < 0 ? '<b style="color:var(--bad)">atrasada há ' + (-dias) + (dias === -1 ? ' dia' : ' dias') + '</b>' : dias === 0 ? '<b style="color:var(--warn)">vence hoje</b>' : dias <= 3 ? '<b style="color:var(--warn)">vence em ' + dias + (dias === 1 ? ' dia' : ' dias') + '</b>' : 'vence ' + l.vence.slice(8, 10) + '/' + l.vence.slice(5, 7);
      var info = [l.quem === 'cpf' ? 'CPF' : 'Loja', l.categoria, l.parcela ? 'parcela ' + l.parcela : null, l.forma && !l.cartao ? l.forma : null, status].filter(Boolean).join(' · ');
      var linha = el('div', { class: 'tarefa' + (l.pago ? ' feita' : '') }, [
        el('button', { class: 'tarefa-check', title: l.pago ? 'Desmarcar' : 'Marcar como paga', text: l.pago ? '✓' : '', onclick: function () {
          if (l.pago) { delete D.local.pagos[l.chave]; D.local.despagos[l.chave] = true; }
          else { D.local.pagos[l.chave] = hoje; delete D.local.despagos[l.chave]; }
          salvar();
        } }),
        el('div', { class: 'tarefa-texto' }, [
          el('div', { class: 'tarefa-titulo', text: l.nome }),
          el('div', { class: 'pml-margin', html: info }),
          l.obs ? el('div', { class: 'pml-margin', text: l.obs }) : null
        ].filter(Boolean)),
        el('b', { style: 'white-space:nowrap;', text: (l.aproximado ? '≈ ' : '') + fmtMoney(l.valor) }),
        (!l.cartao && !l.das) ? el('button', { class: 'tarefa-x', title: 'Excluir esta conta (todos os meses)', text: '×', onclick: function () {
          if (String(l.id).charAt(0) === 'l') D.local.novas = D.local.novas.filter(function (x) { return x.id !== l.id; }); else D.local.excluidas[l.id] = true;
          salvar();
        } }) : null
      ].filter(Boolean));
      lc.appendChild(linha);
      if (l.cartao) {
        var det = el('details', { style: 'margin:-4px 0 8px 40px;' }, [el('summary', { class: 'pml-margin', text: 'O que tem nesta fatura (' + l.itens.length + ')' })]);
        l.itens.forEach(function (it) {
          det.appendChild(el('div', { class: 'pml-margin', style: 'display:flex; justify-content:space-between; gap:8px; padding:3px 0;' }, [
            el('span', { text: it.conta.nome + (it.parcela ? ' · ' + it.parcela + '/' + it.de : '') + (it.conta.de === 'empresa' ? ' · loja' : '') }),
            el('span', { text: fmtMoney(it.valor) })
          ]));
        });
        lc.appendChild(det);
      }
    });
    wrap.appendChild(lc);

    // Proximos meses
    var prox = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Quanto já está comprometido nos próximos meses' })]);
    var tb = el('tbody');
    for (var k = 0; k < 6; k++) {
      var m = somaMes(mesHoje, k), rm = resumoContasMes(m, D);
      tb.appendChild(el('tr', {}, [el('td', { text: nomeMesLongo(m) }), el('td', { class: 'num', text: fmtMoney(rm.empresa) }), el('td', { class: 'num', text: fmtMoney(rm.cpf) }), el('td', { class: 'num', style: 'font-weight:700;', text: fmtMoney(rm.total) })]));
    }
    prox.appendChild(el('div', { class: 'pml-table-wrap' }, [el('table', { class: 'pml-table' }, [
      el('thead', {}, [el('tr', {}, ['Mês', 'Loja', 'CPF', 'Total'].map(function (h, i) { return el('th', { class: i ? 'num' : '', text: h }); }))]), tb
    ])]));
    prox.appendChild(el('p', { class: 'pml-note', text: 'O imposto dos meses futuros só aparece quando o mês anterior tiver vendas. Contas com ≈ são estimadas.' }));
    wrap.appendChild(prox);
    renderCaixaCard(wrap);

    // Parcelamentos
    var pa = parcelasEmAndamento(mesHoje, D);
    if (pa.length) {
      var pc = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Parcelamentos em andamento' })]);
      pc.appendChild(el('div', { class: 'pml-table-wrap' }, [el('table', { class: 'pml-table' }, [
        el('thead', {}, [el('tr', {}, ['O quê', 'Parcela', 'Valor', 'Ainda falta', 'Última'].map(function (h, i) { return el('th', { class: i > 1 ? 'num' : '', text: h }); }))]),
        el('tbody', {}, pa.map(function (p) {
          return el('tr', {}, [el('td', { text: p.conta.nome + (p.conta.forma ? ' · ' + p.conta.forma : '') }), el('td', { text: (p.atual || 0) + '/' + p.total }),
            el('td', { class: 'num', text: fmtMoney(Number(p.conta.valor) || 0) }), el('td', { class: 'num', style: 'font-weight:700;', text: fmtMoney(p.falta) }),
            el('td', { class: 'num', text: nomeMesCurto(p.acaba) })]);
        }))
      ])]));
      pc.appendChild(el('p', { class: 'pml-margin', text: 'Total que ainda falta pagar em parcelas: ' + fmtMoney(pa.reduce(function (s, p) { return s + p.falta; }, 0)) }));
      wrap.appendChild(pc);
    }

    // Formulario
    var f = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Lançar conta' })]);
    var tipo = el('select', {}, [el('option', { value: 'fixa', text: 'Fixa (todo mês)' }), el('option', { value: 'parcela', text: 'Parcelada' })]);
    var nome = el('input', { placeholder: 'Ex.: Aluguel, internet, impressora 4' });
    var valor = el('input', { type: 'number', step: '0.01', placeholder: 'Valor (da parcela, se for parcelado)' });
    var dia = el('input', { type: 'number', min: '1', max: '31', placeholder: 'Dia que vence' });
    var quem = el('select', {}, [el('option', { value: 'empresa', text: 'Loja (CNPJ)' }), el('option', { value: 'cpf', text: 'CPF' })]);
    var forma = el('select', {}, ['Pix', 'Boleto', 'Débito automático'].concat(D.cartoes.map(function (c) { return c.nome; })).map(function (x) { return el('option', { value: x, text: D.cartoes.some(function (c) { return c.nome === x; }) ? 'Cartão ' + x : x }); }));
    var nParc = el('input', { type: 'number', min: '1', placeholder: 'Nº de parcelas' });
    var primeira = el('input', { type: 'month', value: mesHoje });
    function campoC(r, x) { return el('div', { class: 'pml-field' }, [el('label', { text: r }), x]); }
    f.appendChild(el('div', { class: 'pml-form-grid' }, [campoC('Tipo', tipo), campoC('O quê', nome), campoC('Valor (R$)', valor), campoC('Vence dia', dia),
      campoC('Quem paga', quem), campoC('Como paga', forma), campoC('Parcelas (se parcelado)', nParc), campoC('Começa em', primeira)]));
    f.appendChild(el('button', { class: 'pml-btn', text: 'Lançar', onclick: function () {
      if (!nome.value.trim() || !(num(valor.value) > 0)) return;
      var nova = { id: 'l' + uid(), tipo: tipo.value, nome: nome.value.trim(), valor: num(valor.value), dia: num(dia.value) || 1, de: quem.value, forma: forma.value };
      if (tipo.value === 'parcela') { nova.parcelas = Math.max(1, num(nParc.value) || 1); nova.primeira = primeira.value || mesHoje; } else nova.inicio = primeira.value || mesHoje;
      D.local.novas.push(nova);
      salvar();
    } }));
    f.appendChild(el('p', { class: 'pml-note', text: 'Compra no cartão entra na fatura daquele cartão (os cartões eu cadastro quando você me passar o dia de vencimento). O que você marca como pago fica salvo neste navegador.' }));
    wrap.appendChild(f);
  }
