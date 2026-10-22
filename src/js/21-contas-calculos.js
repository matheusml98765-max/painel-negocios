  // ===================== CONTAS A PAGAR: CALCULOS =====================
  // Contas fixas (todo mes), parcelas (N vezes), compras no cartao (entram na fatura do cartao)
  // e o imposto do Simples (estimado pelas vendas do mes anterior, vence dia 20).
  // Fonte: contas.json no Gist (o Claude lanca pelo chat) + o que o vendedor faz aqui.
  //
  // contas.json = {
  //   contas: [{ id, tipo: 'fixa'|'parcela', nome, valor, dia, de: 'empresa'|'cpf', categoria,
  //              forma: 'Pix'|'Boleto'|'Débito'|<nome do cartao>, inicio: 'AAAA-MM', fim: 'AAAA-MM'|null,
  //              parcelas (so parcela), primeira: 'AAAA-MM' (so parcela), aproximado: bool, obs }],
  //   cartoes: [{ id, nome, vencimento (dia), fechamento (dia), de }],
  //   pagos: { '<id>:<AAAA-MM>': 'AAAA-MM-DD' }
  // }

  function difMeses(a, b) { // meses de a ate b (AAAA-MM)
    return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  }
  function somaMes(m, n) {
    var d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function diaNoMes(m, dia) { // dia 31 em fevereiro vira o ultimo dia
    var ult = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
    return m + '-' + String(Math.min(Math.max(1, Number(dia) || 1), ult)).padStart(2, '0');
  }

  function dadosContas() {
    var remoto = state.contasRemotas || lerLocal('ml-contas-remotas', null) || {};
    var local = lerLocal('ml-contas-local', { pagos: {}, despagos: {}, novas: [], excluidas: {} });
    ['pagos', 'despagos', 'excluidas'].forEach(function (k) { if (!local[k]) local[k] = {}; });
    if (!local.novas) local.novas = [];
    var contas = (remoto.contas || []).concat(local.novas).filter(function (c) { return !local.excluidas[c.id]; });
    return { local: local, contas: contas, cartoes: remoto.cartoes || [], pagosRemotos: remoto.pagos || {} };
  }

  function pagoEm(D, chave) {
    if (D.local.despagos[chave]) return null;
    return D.local.pagos[chave] || D.pagosRemotos[chave] || null;
  }

  // Vendas (ML + Shopee) de um mes, para estimar o DAS
  function faturamentoDoMes(m) {
    return (state.transacoes || []).reduce(function (s, t) {
      return s + (t.tipo === 'venda' && String(t.data || '').slice(0, 7) === m ? (Number(t.valor) || 0) + (Number(t.freteComprador) || 0) : 0);   // faturamento do Simples inclui o frete pago pelo comprador
    }, 0);
  }

  // Tudo que vence num mes. Compras no cartao viram uma linha so: a fatura daquele cartao.
  function contasDoMes(m, D) {
    D = D || dadosContas();
    var cartoes = {};
    D.cartoes.forEach(function (k) { cartoes[k.nome] = { cartao: k, itens: [] }; });
    var linhas = [];
    D.contas.forEach(function (c) {
      var item = null;
      if (c.tipo === 'parcela') {
        var n = difMeses(c.primeira || c.inicio || m, m) + 1;
        if (n >= 1 && n <= (Number(c.parcelas) || 1)) item = { conta: c, parcela: n, de: Number(c.parcelas) || 1 };
      } else if ((!c.inicio || c.inicio <= m) && (!c.fim || m <= c.fim)) {
        item = { conta: c };
      }
      if (!item) return;
      item.valor = Number(c.valor) || 0;
      if (c.forma && cartoes[c.forma]) { cartoes[c.forma].itens.push(item); return; }
      var chave = c.id + ':' + m;
      linhas.push({ chave: chave, nome: c.nome, valor: item.valor, vence: diaNoMes(m, c.dia), quem: c.de || 'empresa',
        categoria: c.categoria || (c.tipo === 'parcela' ? 'Parcelamento' : 'Conta fixa'), forma: c.forma || '',
        parcela: item.parcela ? item.parcela + '/' + item.de : null, aproximado: !!c.aproximado, obs: c.obs || '',
        id: c.id, origem: c, pago: pagoEm(D, chave) });
    });
    Object.keys(cartoes).forEach(function (nome) {
      var k = cartoes[nome];
      if (!k.itens.length) return;
      var chave = 'cartao-' + (k.cartao.id || nome) + ':' + m;
      linhas.push({ chave: chave, nome: 'Fatura ' + nome, valor: k.itens.reduce(function (s, i) { return s + i.valor; }, 0),
        vence: diaNoMes(m, k.cartao.vencimento), quem: k.cartao.de || 'cpf', categoria: 'Cartão de crédito', forma: nome,
        itens: k.itens, cartao: true, pago: pagoEm(D, chave) });
    });
    var imp = Number(state.configLucro && state.configLucro.imposto) || 0;
    var fatAnt = faturamentoDoMes(somaMes(m, -1));
    if (imp > 0 && fatAnt > 0) {
      var chaveDas = 'das:' + m;
      linhas.push({ chave: chaveDas, nome: 'Imposto Simples (DAS)', valor: fatAnt * imp / 100, vence: diaNoMes(m, 20), quem: 'empresa',
        categoria: 'Imposto', forma: 'Guia DAS', aproximado: true, das: true,
        obs: 'Estimado: ' + fmtPct(imp / 100) + ' sobre ' + fmtMoney(fatAnt) + ' vendidos em ' + somaMes(m, -1).split('-').reverse().join('/') + '. O valor certo é o da guia.',
        pago: pagoEm(D, chaveDas) });
    }
    linhas.sort(function (a, b) { return a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : b.valor - a.valor; });
    return linhas;
  }

  function resumoContasMes(m, D) {
    var hoje = isoHoje(0);
    var linhas = contasDoMes(m, D);
    var r = { linhas: linhas, total: 0, pago: 0, falta: 0, atrasado: 0, empresa: 0, cpf: 0, proximas: [] };
    linhas.forEach(function (l) {
      r.total += l.valor;
      if (l.quem === 'cpf') r.cpf += l.valor; else r.empresa += l.valor;
      if (l.pago) r.pago += l.valor;
      else { r.falta += l.valor; if (l.vence < hoje) r.atrasado += l.valor; }
    });
    return r;
  }

  // Parcelamentos em andamento a partir de um mes: quanto falta e quando acaba
  function parcelasEmAndamento(m, D) {
    D = D || dadosContas();
    return D.contas.filter(function (c) { return c.tipo === 'parcela'; }).map(function (c) {
      var total = Number(c.parcelas) || 1, n = difMeses(c.primeira || m, m) + 1;
      var restantes = Math.max(0, total - Math.max(n, 1) + 1);
      if (n < 1) restantes = total;
      return { conta: c, atual: Math.min(Math.max(n, 0), total), total: total, restantes: n > total ? 0 : restantes,
        falta: (n > total ? 0 : restantes) * (Number(c.valor) || 0), acaba: somaMes(c.primeira || m, total - 1) };
    }).filter(function (p) { return p.restantes > 0; }).sort(function (a, b) { return a.acaba < b.acaba ? -1 : 1; });
  }
