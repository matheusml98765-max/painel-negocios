  // ===================== CONQUISTAS =====================
  // O que o vendedor ja conquistou (o Claude lanca pelo chat em conquistas.json) + recordes
  // tirados das vendas reais + uma frase do dia. Nada de numero inventado: recorde so com dado.

  var FRASES_DIA = [
    'Constância ganha de motivação. Você apareceu hoje de novo.',
    'Cada pedido embalado é alguém que confiou na sua loja.',
    'Começou com uma impressora. Olha onde já está.',
    'Dia fraco também faz parte. O mês é que conta.',
    'Você não precisa fazer tudo hoje. Só o próximo passo.',
    'Quem mede, melhora. E agora você mede tudo.',
    'Um custo descoberto hoje é lucro a mais amanhã.',
    'Errar uma impressão faz parte. Desistir não.',
    'Devagar também é avanço.',
    'O cliente não vê o trabalho que dá. Mas sente o cuidado.',
    'Organização é o que transforma esforço em resultado.',
    'Cuida da vista, da coluna e do sono. Você é o maior ativo da loja.',
    'Uma decisão com número vale mais que dez no chute.',
    'Hoje é um bom dia para resolver aquela tarefa que você vem adiando.',
    'Crescer dá trabalho. Ficar parado dá mais.',
    'Você já fez coisa mais difícil do que o que está na sua frente hoje.',
    'Pequenas melhorias todo dia viram uma empresa diferente em um ano.',
    'Ninguém vê o que acontece às 23h embalando pedido. Mas o resultado aparece.',
    'Comemore as vitórias pequenas. Elas que pagam as grandes.',
    'O que você aprende sozinho, ninguém tira de você.',
    'Foco no que depende de você. O resto, a gente ajusta.',
    'Cada parcela paga é um pedaço a mais que é seu de verdade.',
    'Respira. Uma coisa de cada vez.',
    'Seu eu de seis meses atrás ficaria orgulhoso de ver isso aqui.',
    'Não é sobre vender mais a qualquer custo. É sobre sobrar mais no fim.',
    'Descansar também é parte do trabalho.',
    'O mercado muda. Quem se organiza se adapta mais rápido.',
    'Feito é melhor que perfeito. Depois você melhora.',
    'Hoje alguém vai receber um produto que você fez com as próprias mãos.',
    'A loja está crescendo porque você não parou.'
  ];

  function fraseDoDia() {
    var d = new Date(); var n = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
    return FRASES_DIA[n % FRASES_DIA.length];
  }

  // Recordes a partir das vendas registradas no painel
  function calcRecordes() {
    var dias = {}, meses = {}, pedidos = 0, total = 0, primeira = null;
    (state.transacoes || []).forEach(function (t) {
      if (t.tipo !== 'venda' || !t.data) return;
      var v = Number(t.valor) || 0;
      pedidos++; total += v;
      dias[t.data] = (dias[t.data] || 0) + v;
      var m = t.data.slice(0, 7); meses[m] = (meses[m] || 0) + v;
      if (!primeira || t.data < primeira) primeira = t.data;
    });
    function maior(o) { return Object.keys(o).reduce(function (a, k) { return !a || o[k] > o[a] ? k : a; }, null); }
    var md = maior(dias), mm = maior(meses);
    return { pedidos: pedidos, total: total, primeira: primeira, melhorDia: md ? { data: md, valor: dias[md] } : null, melhorMes: mm ? { mes: mm, valor: meses[mm] } : null };
  }

  function renderConquistasTab(wrap) {
    var dados = state.conquistasRemotas || lerLocal('ml-conquistas-remotas', null) || {};
    var itens = (dados.itens || []).slice().sort(function (a, b) { return String(b.data || '').localeCompare(String(a.data || '')); });
    wrap.appendChild(el('div', { class: 'pml-card conq-frase' }, [
      el('p', { class: 'pml-metric-label', text: 'Frase do dia' }),
      el('p', { class: 'conq-frase-texto', text: fraseDoDia() })
    ]));

    var r = calcRecordes();
    if (r.pedidos) {
      var nomeM = function (m) { var s = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
      wrap.appendChild(el('div', { class: 'pml-metrics' }, [
        metricaFicha('Pedidos no painel', r.pedidos.toLocaleString('pt-BR'), r.primeira ? 'desde ' + r.primeira.split('-').reverse().join('/') : '', 'pos'),
        metricaFicha('Já faturou', fmtMoney(r.total), 'ML e Shopee registrados aqui', 'pos'),
        metricaFicha('Melhor mês', r.melhorMes ? fmtMoney(r.melhorMes.valor) : '—', r.melhorMes ? nomeM(r.melhorMes.mes) : ''),
        metricaFicha('Melhor dia', r.melhorDia ? fmtMoney(r.melhorDia.valor) : '—', r.melhorDia ? r.melhorDia.data.split('-').reverse().join('/') : '')
      ]));
    }

    var investido = itens.reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);
    var card = el('div', { class: 'pml-card' }, [el('p', { class: 'pml-section-title', text: 'Suas conquistas' + (investido ? ' · ' + fmtMoney(investido) + (itens.some(function (c) { return c.mais; }) ? ' ou mais' : '') + ' conquistados' : '') })]);
    if (!itens.length) card.appendChild(el('div', { class: 'pml-empty', text: 'Me conte suas conquistas pelo chat que eu coloco aqui.' }));
    itens.forEach(function (c) {
      card.appendChild(el('div', { class: 'conq-item' }, [
        el('span', { class: 'conq-icone', text: c.icone || '🏆' }),
        el('div', {}, [
          el('div', { class: 'tarefa-titulo', text: c.titulo + (c.valor ? ' · ' + fmtMoney(Number(c.valor)) + (c.mais ? '+' : '') : '') }),
          el('div', { class: 'pml-margin', text: [c.data ? (c.data.length === 7 ? nomeMesCurto(c.data) : c.data.split('-').reverse().join('/')) : null, c.descricao].filter(Boolean).join(' · ') })
        ])
      ]));
    });
    wrap.appendChild(card);
  }
