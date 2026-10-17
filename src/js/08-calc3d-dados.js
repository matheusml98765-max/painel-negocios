  // ===================== CALCULADORA 3D =====================

  function plataformasPadrao() {
    return [
      { id: 'shopee', nome: 'Shopee', comissao: 20, taxaFixa: 4.5, frete: 0, ads: 15.5, nota: 'Nas suas vendas reais: cerca de 18,6% de comissão + 1,4% de serviço + R$ 4,50 fixos por pedido. Afiliados cobram à parte quando a venda vem deles.' },
      { id: 'ml', nome: 'Mercado Livre', comissao: 12, taxaFixa: 6.5, frete: 5, ads: 0, nota: 'Abaixo de R$ 79 o ML cobra tarifa por unidade e frete por peso — use os números reais da aba Lucro real.' },
      { id: 'tiktok', nome: 'TikTok Shop', comissao: 10, taxaFixa: 4, frete: 0, ads: 0, nota: 'Abaixo de R$ 50: 10% + R$ 4 por item (desde 15/07/2026).' }
    ];
  }

  function calc3dPadrao() {
    return {
      kwh: 0.95,              // R$ por kWh da conta de luz
      perdaPct: 8,            // % de pecas perdidas/falhas
      manutencaoHora: 0.30,   // R$ por hora de impressao (bico, mesa, correia...)
      impressoras: [{ id: 'imp1', nome: 'Minha impressora', watts: 150, preco: 2500, vidaHoras: 5000 }],
      filamentos: [],         // lotes: {id, data, tipo, descricao, kg, preco, frete}
      embalagens: [],         // lotes: {id, data, nome, qtd, preco, frete}
      produtos: [],           // {id, nome, tipo, gramas, horas, porPlaca, impressoraId, embalagem, extras, anuncios}
      imposto: 4,
      plataformas: plataformasPadrao()
    };
  }

  function getCalc3d() {
    if (!state.calc3d) state.calc3d = calc3dPadrao();
    var c = state.calc3d;
    if (!Array.isArray(c.plataformas)) c.plataformas = plataformasPadrao();
    if (c.imposto === undefined) c.imposto = (c.simulador && c.simulador.imposto !== undefined) ? c.simulador.imposto : 4;
    c.produtos.forEach(function (p) {
      if (!Array.isArray(p.insumos)) {
        p.insumos = p.embalagem ? [{ nome: p.embalagem, qtd: 1 }] : [];
        delete p.embalagem;
      }
      if (!p.precos) p.precos = p.precoVenda ? { shopee: p.precoVenda } : {};
    });
    return c;
  }

  async function salvarCalc3d() {
    try { await window.storage.set('ml-calc3d', JSON.stringify(state.calc3d)); } catch (e) {}
  }

  function num(v) { var n = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }

  // Custo por grama de um tipo de filamento: media ponderada de todos os lotes daquele tipo
  // (soma do que voce pagou, com frete) / (soma dos gramas que chegaram).
  function custoGrama(tipo) {
    var c = getCalc3d();
    var lotes = c.filamentos.filter(function (l) { return (l.tipo || '').toUpperCase() === (tipo || '').toUpperCase(); });
    if (!lotes.length) lotes = c.filamentos;
    var gramas = lotes.reduce(function (s, l) { return s + num(l.kg) * 1000; }, 0);
    var pago = lotes.reduce(function (s, l) { return s + num(l.preco) + num(l.frete); }, 0);
    return gramas > 0 ? pago / gramas : 0;
  }

  function custoEmbalagem(nome) {
    var c = getCalc3d();
    var lotes = c.embalagens.filter(function (l) { return l.nome === nome; });
    var qtd = lotes.reduce(function (s, l) { return s + num(l.qtd); }, 0);
    var pago = lotes.reduce(function (s, l) { return s + num(l.preco) + num(l.frete); }, 0);
    return qtd > 0 ? pago / qtd : 0;
  }

  function tiposFilamento() {
    var t = {};
    getCalc3d().filamentos.forEach(function (l) { if (l.tipo) t[l.tipo.toUpperCase()] = true; });
    var lista = Object.keys(t);
    return lista.length ? lista : ['PLA'];
  }

  function nomesEmbalagem() {
    var t = {};
    getCalc3d().embalagens.forEach(function (l) { if (l.nome) t[l.nome] = true; });
    return Object.keys(t);
  }

  function custoPeca3d(p) {
    var c = getCalc3d();
    var imp = c.impressoras.find(function (i) { return i.id === p.impressoraId; }) || c.impressoras[0] || { watts: 0, preco: 0, vidaHoras: 1 };
    var porPlaca = Math.max(1, num(p.porPlaca) || 1);
    var horas = num(p.horas);
    var material = num(p.gramas) * custoGrama(p.tipo);
    var energia = horas * (num(imp.watts) / 1000) * num(c.kwh);
    var desgaste = horas * (num(imp.vidaHoras) > 0 ? num(imp.preco) / num(imp.vidaHoras) : 0);
    var manutencao = horas * num(c.manutencaoHora);
    var porPeca = (material + energia + desgaste + manutencao) / porPlaca;
    var perda = porPeca * num(c.perdaPct) / 100;
    var emb = (p.insumos || []).reduce(function (s, i) { return s + custoEmbalagem(i.nome) * num(i.qtd); }, 0);
    var extras = num(p.extras);
    return {
      material: material / porPlaca, energia: energia / porPlaca, desgaste: desgaste / porPlaca,
      manutencao: manutencao / porPlaca, perda: perda, embalagem: emb, extras: extras,
      total: porPeca + perda + emb + extras
    };
  }

  // Custo de um anuncio vindo da calculadora 3D (usado pela aba Lucro real)
  function custo3dDoAnuncio(itemId) {
    var id = String(itemId || '').trim().toUpperCase();
    if (!id || !state.calc3d) return null;
    var p = state.calc3d.produtos.find(function (x) {
      return String(x.anuncios || '').toUpperCase().split(/[\s,;]+/).indexOf(id) !== -1;
    });
    if (!p || !(num(p.gramas) > 0) || !(num(p.horas) > 0)) return null;  // peca ainda sem gramas/horas
    return custoPeca3d(p).total;
  }

