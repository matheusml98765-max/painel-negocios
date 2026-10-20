// Testes das contas do painel. Rodar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarPainel } from './carregar.mjs';

function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg}: esperado ${b}, veio ${a}`);

function painelBase() {
  const p = carregarPainel();
  p.state.produtos = [];
  p.state.custosAvulsos = {};
  p.state.transacoes = [];
  p.state.configLucro = { imposto: 4, margemAlvo: 25, dias: 30, ordem: 'receita', plataforma: 'todas' };
  p.state.calc3d = null;
  return p;
}

test('custo por grama é a média ponderada de todas as remessas (com frete)', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.filamentos = [
    { tipo: 'PLA', kg: 1, preco: 89.9, frete: 15 },
    { tipo: 'PLA', kg: 2, preco: 150, frete: 0 },
  ];
  perto(p.custoGrama('PLA') * 1000, (89.9 + 15 + 150) / 3, 'R$/kg');
});

test('custo por grama usa o preço atual: compras dos últimos 30 dias, não o histórico', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.filamentos = [
    { tipo: 'PETG', data: '2026-07-18', kg: 5, preco: 384.5, frete: 0 },
    { tipo: 'PETG', data: '2026-10-02', kg: 8, preco: 548, frete: 0 },
    { tipo: 'PETG', data: '2026-10-02', kg: 9, preco: 603, frete: 0 },
    { tipo: 'PETG', data: '2026-10-09', kg: 6, preco: 389.94, frete: 0 },
  ];
  perto(p.custoGrama('PETG') * 1000, (548 + 603 + 389.94) / 23, 'R$/kg');
  c.embalagens = [
    { nome: 'Caixa', data: '2026-05-03', qtd: 50, preco: 60, frete: 0 },
    { nome: 'Caixa', data: '2026-10-05', qtd: 50, preco: 45, frete: 0 },
  ];
  perto(p.custoEmbalagem('Caixa'), 0.9, 'caixa');
});

test('custo da peça 3D soma filamento, luz, desgaste, manutenção, perdas e insumos', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  Object.assign(c, {
    kwh: 0.95, perdaPct: 8, manutencaoHora: 0.3,
    impressoras: [{ id: 'i', nome: 'A1', watts: 150, preco: 2500, vidaHoras: 5000 }],
    filamentos: [{ tipo: 'PLA', kg: 1, preco: 89.9, frete: 15 }, { tipo: 'PLA', kg: 2, preco: 150, frete: 0 }],
    embalagens: [{ nome: 'Envelope', qtd: 100, preco: 45, frete: 5 }],
  });
  const peca = { tipo: 'PLA', gramas: 60, horas: 2.5, porPlaca: 2, impressoraId: 'i', insumos: [{ nome: 'Envelope', qtd: 1 }], extras: 0.8 };
  const r = p.custoPeca3d(peca);
  perto(r.material, 2.55, 'filamento');
  perto(r.energia, 0.18, 'luz');
  perto(r.desgaste, 0.63, 'desgaste');
  perto(r.embalagem, 0.5, 'embalagem');
  perto(r.total, 5.33, 'total');
});

test('peça sem gramas ou horas não entra no Lucro real', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.filamentos = [{ tipo: 'PETG', kg: 1, preco: 70, frete: 0 }];
  c.produtos = [{ id: 'x', nome: 'Suporte', tipo: 'PETG', gramas: '', horas: '', porPlaca: 1, insumos: [], anuncios: 'MLB1, 22894922420' }];
  assert.equal(p.custo3dDoAnuncio('MLB1'), null);
  c.produtos[0].gramas = 50; c.produtos[0].horas = 1.5;
  assert.ok(p.custo3dDoAnuncio('22894922420') > 0, 'aceita o ID numérico da Shopee');
  assert.ok(p.custo3dDoAnuncio('mlb1') > 0, 'aceita minúsculas');
});

test('lucro de uma venda do ML usa o líquido real, o imposto e o custo', () => {
  const p = painelBase();
  p.state.custosAvulsos = { MLB7579708336: 21 };
  p.state.transacoes = [{
    tipo: 'venda', data: hoje(), valor: 59.9, origemId: 'api-ml-1-venda',
    itens: [{ item_id: 'MLB7579708336', titulo: 'Listerine', quantidade: 1, preco_unitario: 59.9, comissao: 8.39 }],
    custosMl: { comissao: 8.39, frete: 4.2, liquido_recebido: 47.31 },
  }];
  const { linhas } = p.calcLucroPorProduto(30);
  assert.equal(linhas.length, 1);
  perto(linhas[0].lucro, 47.31 - 59.9 * 0.04 - 21, 'lucro');
  perto(linhas[0].taxasMl, 59.9 - 47.31, 'taxas');
  assert.equal(linhas[0].plataforma, 'ml');
});

test('lucro da Shopee desconta comissão, taxa de serviço e afiliados', () => {
  const p = painelBase();
  p.state.custosAvulsos = { '58216140538': 5 };
  p.state.transacoes = [{
    tipo: 'venda', data: hoje(), valor: 13.9, origemId: 'api-shopee-A-venda',
    itens: [{ item_id: 58216140538, titulo: 'Suporte roteador', quantidade: 1, preco_unitario: 13.9 }],
    custosShopee: { comissao: 2.59, taxa_servico: 4.98, afiliados: 2.09, protecao_frete: 0.49, frete_vendedor: 0, liquido_recebido: 3.75 },
  }];
  const { linhas } = p.calcLucroPorProduto(30);
  assert.equal(linhas[0].plataforma, 'shopee');
  perto(linhas[0].liquido, 3.75, 'líquido');
  perto(linhas[0].afiliados, 2.09, 'afiliados');
  perto(linhas[0].lucro, 3.75 - 13.9 * 0.04 - 5, 'lucro (prejuízo)');
  assert.ok(linhas[0].lucro < 0, 'peça de R$ 13,90 com afiliado dá prejuízo');
});

test('filtro de loja separa ML e Shopee; venda sem taxas não entra', () => {
  const p = painelBase();
  p.state.transacoes = [
    { tipo: 'venda', data: hoje(), valor: 10, origemId: 'api-ml-1-venda', itens: [{ item_id: 'MLB1', quantidade: 1, preco_unitario: 10 }], custosMl: { comissao: 1, frete: 1, liquido_recebido: 8 } },
    { tipo: 'venda', data: hoje(), valor: 20, origemId: 'api-shopee-2-venda', itens: [{ item_id: 2, quantidade: 1, preco_unitario: 20 }], custosShopee: { comissao: 4, taxa_servico: 4.5, liquido_recebido: 11.5 } },
    { tipo: 'venda', data: hoje(), valor: 30, origemId: 'api-shopee-3-venda', itens: [{ item_id: 3, quantidade: 1, preco_unitario: 30 }] },
  ];
  assert.equal(p.calcLucroPorProduto(30).linhas.length, 2);
  assert.equal(p.calcLucroPorProduto(30).semDados, 1);
  assert.deepEqual(p.calcLucroPorProduto(30, 'ml').linhas.map((g) => g.itemId), ['MLB1']);
  assert.deepEqual(p.calcLucroPorProduto(30, 'shopee').linhas.map((g) => g.itemId), ['2']);
});

test('pedido com vários itens divide o líquido pelo valor de cada item', () => {
  const p = painelBase();
  p.state.transacoes = [{
    tipo: 'venda', data: hoje(), valor: 100, origemId: 'api-ml-9-venda',
    itens: [{ item_id: 'A', quantidade: 1, preco_unitario: 75, comissao: 9 }, { item_id: 'B', quantidade: 1, preco_unitario: 25, comissao: 3 }],
    custosMl: { comissao: 12, frete: 8, liquido_recebido: 80 },
  }];
  const { linhas } = p.calcLucroPorProduto(30);
  const a = linhas.find((g) => g.itemId === 'A');
  const b = linhas.find((g) => g.itemId === 'B');
  perto(a.liquido, 60, 'líquido A');
  perto(b.liquido, 20, 'líquido B');
  perto(a.comissao, 9, 'comissão exata do item A');
});

test('vendas fora do período não entram', () => {
  const p = painelBase();
  p.state.transacoes = [{ tipo: 'venda', data: '2020-01-01', valor: 10, origemId: 'api-ml-1-venda', itens: [{ item_id: 'X', quantidade: 1, preco_unitario: 10 }], custosMl: { comissao: 1, frete: 1, liquido_recebido: 8 } }];
  assert.equal(p.calcLucroPorProduto(30).linhas.length, 0);
});

test('projeção do mês estende o ritmo atual até o último dia', () => {
  const p = painelBase();
  // 10 de outubro, meio-dia: 9,5 dias decorridos de 31
  const agora = new Date(2026, 9, 10, 12, 0, 0);
  const r = p.calcProjecaoMes(9500, agora);
  perto(r.decorrido, 9.5, 'dias decorridos');
  perto(r.projecao, 9500 / 9.5 * 31, 'projeção');
  perto(r.diasRestantes, 21.5, 'dias restantes');
});

test('projeção fica vazia nas primeiras horas do mês', () => {
  const p = painelBase();
  assert.equal(p.calcProjecaoMes(500, new Date(2026, 10, 1, 8, 0, 0)).projecao, null);
});

test('mapa de calor conta pedidos por dia da semana e hora e ignora vendas antigas', () => {
  const p = painelBase();
  const agora = new Date(2026, 9, 17, 10, 0, 0);
  const v = (iso, valor) => { const d = new Date(iso); return { tipo: 'venda', valor, data: iso.slice(0, 10), hora: d.getHours(), dow: d.getDay(), dataHora: d.toISOString() }; };
  p.state.transacoes = [
    v('2026-10-16T20:15:00', 30), v('2026-10-16T20:40:00', 20), v('2026-10-15T09:00:00', 10),
    v('2026-08-01T20:00:00', 99), // fora dos 30 dias
    { tipo: 'venda', valor: 5, data: '2026-10-14' }, // sem horario
    { tipo: 'cancelamento', valor: 50, data: '2026-10-16', hora: 20, dow: 5 },
  ];
  const m = p.calcMapaCalor(p.state.transacoes, 30, agora);
  assert.equal(m.total, 3);
  assert.equal(m.semHora, 1);
  const sexta = new Date('2026-10-16T20:15:00').getDay();
  assert.equal(m.matriz[sexta][20].pedidos, 2);
  perto(m.matriz[sexta][20].valor, 50, 'valor na célula');
  assert.deepEqual({ ...m.melhor }, { dow: sexta, hora: 20 });
  const f = p.melhorFaixa(m.porHora);
  assert.equal(f.pedidos, 2);
});

test('venda usa o preço das compras da época dela, não o de hoje', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.filamentos = [
    { tipo: 'PETG', data: '2026-07-10', kg: 5, preco: 400, frete: 0 },  // R$ 80/kg
    { tipo: 'PETG', data: '2026-10-05', kg: 10, preco: 600, frete: 0 }, // R$ 60/kg
  ];
  perto(p.custoGrama('PETG', '2026-07-20') * 1000, 80, 'julho');
  perto(p.custoGrama('PETG', '2026-10-15') * 1000, 60, 'outubro');
  perto(p.custoGrama('PETG') * 1000, 60, 'hoje');
  perto(p.custoGrama('PETG', '2026-06-01') * 1000, 80, 'antes da primeira compra');
});

test('compras: cada compra comparada com o preço de antes, por semana e por mês', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.filamentos = [
    { tipo: 'PETG', data: '2026-10-02', kg: 10, preco: 700, frete: 0 }, // 70/kg, primeira
    { tipo: 'PETG', data: '2026-10-09', kg: 10, preco: 650, frete: 0 }, // 65/kg: 5/kg a menos = R$ 50
  ];
  c.embalagens = [
    { nome: 'Caixa', data: '2026-10-01', qtd: 50, preco: 50, frete: 0 },
    { nome: 'Caixa', data: '2026-10-08', qtd: 50, preco: 55, frete: 0 }, // 0,10 a mais = R$ 5
  ];
  const r = p.compararCompras();
  const fil = r.linhas.find((x) => x.data === '2026-10-09');
  perto(fil.difUnit, -5, 'filamento R$/kg');
  perto(fil.difTotal, -50, 'filamento total');
  assert.equal(r.linhas.find((x) => x.data === '2026-10-02').ref, null);
  perto(r.linhas.find((x) => x.data === '2026-10-08').difTotal, 5, 'caixa');
  assert.equal(p.inicioSemana('2026-10-09'), '2026-10-05');
  const sem = r.semanas.find((s) => s.mes === '2026-10-05');
  perto(sem.aMenos, 50, 'economia da semana'); perto(sem.aMais, 5, 'a mais na semana');
  assert.equal(r.meses[0].compras, 4);
});

test('contas: fixas, parcelas, fatura do cartão e imposto estimado', () => {
  const p = painelBase();
  p.state.configLucro.imposto = 4;
  p.state.transacoes = [{ tipo: 'venda', data: '2026-09-15', valor: 1000, itens: [] }];
  p.state.contasRemotas = {
    cartoes: [{ id: 'k01', nome: 'Nubank', vencimento: 10, de: 'cpf' }],
    contas: [
      { id: 'f001', tipo: 'fixa', nome: 'Internet', valor: 100, dia: 5, de: 'cpf', forma: 'Pix', inicio: '2026-01' },
      { id: 'f002', tipo: 'fixa', nome: 'Streaming', valor: 40, dia: 1, de: 'cpf', forma: 'Nubank' },
      { id: 'p001', tipo: 'parcela', nome: 'Impressora', valor: 300, parcelas: 10, primeira: '2026-08', dia: 10, de: 'empresa', forma: 'Nubank' },
      { id: 'f003', tipo: 'fixa', nome: 'Antiga', valor: 50, dia: 5, fim: '2026-09' },
    ],
    pagos: { 'f001:2026-10': '2026-10-04' },
  };
  const ls = p.contasDoMes('2026-10');
  const fat = ls.find((l) => l.cartao);
  perto(fat.valor, 340, 'fatura Nubank');
  assert.equal(fat.itens.find((i) => i.conta.id === 'p001').parcela, 3);
  assert.equal(ls.some((l) => l.id === 'f003'), false);
  perto(ls.find((l) => l.das).valor, 40, 'DAS de outubro sobre setembro');
  assert.equal(ls.find((l) => l.das).vence, '2026-10-20');
  const r = p.resumoContasMes('2026-10');
  perto(r.total, 480, 'total'); perto(r.pago, 100, 'pago');
  const pa = p.parcelasEmAndamento('2026-10');
  assert.equal(pa[0].restantes, 8); perto(pa[0].falta, 2400, 'falta impressora'); assert.equal(pa[0].acaba, '2027-05');
  assert.equal(p.contasDoMes('2027-06').some((l) => l.id === 'p001' || (l.itens || []).some((i) => i.conta.id === 'p001')), false);
});

test('PEPS: usa primeiro a compra mais antiga; compra nova só vale quando a anterior acaba', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.perdaPct = 0;
  c.embalagens = [
    { nome: 'Parafuso + bucha (par)', data: '2026-09-01', qtd: 500, preco: 100, frete: 0 }, // 0,20
    { nome: 'Parafuso + bucha (par)', data: '2026-10-29', qtd: 500, preco: 50, frete: 0 },  // 0,10
  ];
  c.estoqueInsumos = { 'Parafuso + bucha (par)': { qtd: 4, data: '2026-10-01' } };
  c.produtos = [{ id: 'x', nome: 'Papel', tipo: 'PETG', gramas: 10, horas: 1, porPlaca: 1, anuncios: 'MLB1', insumos: [{ nome: 'Parafuso + bucha (par)', qtd: 2 }] }];
  p.state.transacoes = [
    { tipo: 'venda', data: '2026-10-10', valor: 30, itens: [{ item_id: 'MLB1', quantidade: 1 }] },
    { tipo: 'venda', data: '2026-10-30', valor: 30, itens: [{ item_id: 'MLB1', quantidade: 2 }] },
  ];
  perto(p.custoEmbalagem('Parafuso + bucha (par)', '2026-10-10'), 0.2, 'gasta o lote antigo');
  // dia 30: sobram 2 pares do lote antigo (0,20) e usa 2 do novo (0,10) => média 0,15
  perto(p.custoEmbalagem('Parafuso + bucha (par)', '2026-10-30'), 0.15, 'mistura no fim do lote');
  perto(p.custoEmbalagem('Parafuso + bucha (par)', '2026-11-05'), 0.1, 'depois: lote novo');
  const f = p.filaFifo('emb:Parafuso + bucha (par)');
  perto(f.sobra, 498, 'sobra 4 - 2 - 4 + 500');
  // antes da contagem: regra antiga
  perto(p.custoEmbalagem('Parafuso + bucha (par)', '2026-09-15'), 0.2, 'antes da contagem');
});

test('vendas do dia: taxas, imposto, custo e lucro de cada venda', () => {
  const p = painelBase();
  p.state.configLucro.imposto = 4;
  p.state.custosAvulsos = { MLB9: 10 };
  p.state.transacoes = [
    { tipo: 'venda', data: '2026-10-17', valor: 50, itens: [{ item_id: 'MLB9', quantidade: 1, comissao: 6 }], custosMl: { comissao: 6, frete: 4, liquido_recebido: 40 } },
    { tipo: 'venda', data: '2026-10-17', valor: 30, origemId: 'api-shopee-1', itens: [{ item_id: '999', quantidade: 1 }] },
    { tipo: 'venda', data: '2026-10-16', valor: 99, itens: [] },
  ];
  const r = p.calcVendasDoDia('2026-10-17');
  assert.equal(r.vendas.length, 2);
  const ml = r.vendas.find((v) => v.plataforma === 'ml');
  perto(ml.lucro, 40 - 2 - 10, 'lucro da venda ML');
  assert.equal(r.semTaxas, 1); assert.equal(r.semCusto, 1);
  perto(r.bruto, 80, 'vendido');
});

test('falha de impressão: gramas × % onde parou, entra no lucro e no estoque de filamento', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  Object.assign(c, { kwh: 1, perdaPct: 0, manutencaoHora: 0, impressoras: [{ id: 'i', nome: 'A1', watts: 100, preco: 0, vidaHoras: 0 }],
    filamentos: [{ tipo: 'PETG', data: '2026-10-01', kg: 1, preco: 60, frete: 0 }] });
  c.produtos = [{ id: 'dreno', nome: 'Dreno', tipo: 'PETG', gramas: 66.31, horas: 3.18, porPlaca: 1, impressoraId: 'i', anuncios: '111', insumos: [] }];
  p.state.producaoRemota = { falhas: [{ id: 'x1', data: '2026-10-17', pecaId: 'dreno', qtd: 4, pct: 10 }] };
  const f = p.custoFalha(p.state.producaoRemota.falhas[0]);
  perto(f.gramas, 26.524, 'gramas perdidos');
  perto(f.total, 26.524 * 0.06 + 4 * 3.18 * 0.1 * 0.1, 'perda em R$');
  const r = p.falhasNoPeriodo('2026-10-01', '2026-10-31');
  perto(r.total, f.total, 'mês');
});

test('contagem vale para o fim do dia: vendas do dia não saem de novo e compra do dia entra depois', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.perdaPct = 0;
  c.embalagens = [
    { nome: 'Par', data: '2026-09-11', qtd: 200, preco: 36.1, frete: 0 },
    { nome: 'Par', data: '2026-10-17', qtd: 500, preco: 70, frete: 0 },
  ];
  c.estoqueInsumos = { Par: { qtd: 96, data: '2026-10-17' } };
  c.produtos = [{ id: 'x', nome: 'Papel', tipo: 'PETG', gramas: 10, horas: 1, anuncios: 'MLB1', insumos: [{ nome: 'Par', qtd: 2 }] }];
  p.state.transacoes = [{ tipo: 'venda', data: '2026-10-17', valor: 30, itens: [{ item_id: 'MLB1', quantidade: 1 }] }];
  const f = p.filaFifo('emb:Par');
  perto(f.sobra, 596, 'contagem + compra do dia');
  perto(f.fila[0].unit, 0.1805, 'gasta primeiro a caixa antiga');
});

test('contagem com a origem de cada parte (450 do ML + 50 da Shopee)', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.embalagens = [
    { nome: 'Saco', data: '2026-08-07', qtd: 500, preco: 84.43, frete: 0 },
    { nome: 'Saco', data: '2026-10-07', qtd: 500, preco: 69.18, frete: 0 },
  ];
  c.estoqueInsumos = { Saco: { qtd: 500, data: '2026-10-17', lotes: [{ data: '2026-10-07', qtd: 450 }, { data: '2026-08-07', qtd: 50 }] } };
  const f = p.filaFifo('emb:Saco');
  assert.equal(f.fila[0].data, '2026-08-07'); perto(f.fila[0].qtd, 50, 'shopee primeiro');
  perto(f.fila[1].qtd, 450, 'ml depois'); perto(f.sobra, 500, 'total');
});

test('escada do lucro: operação, lucro real (Ads, antecipação, Full) e bolso (contas fixas)', () => {
  const p = painelBase();
  p.state.configLucro.imposto = 4;
  p.state.custosAvulsos = { MLB1: 20 };
  p.state.transacoes = [
    { tipo: 'venda', data: '2026-09-10', valor: 100, itens: [{ item_id: 'MLB1', quantidade: 1, preco_unitario: 100, comissao: 15 }], custosMl: { comissao: 15, frete: 5, liquido_recebido: 80 } },
  ];
  p.state.adsShopee = { dias: [{ data: '2026-09-10', gasto: 6 }, { data: '2026-08-01', gasto: 99 }] };
  // fatura de 30 dias (21/08 a 19/09), 19 deles dentro de setembro => 19/30 de cada cobrança fora da venda
  p.state.faturamento = { periodos: [{ de: '2026-08-21', ate: '2026-09-19', linhas: [
    { categoria: 'Antecipação', valor: 30 }, { categoria: 'Publicidade', valor: 15 }, { categoria: 'Full', valor: 9 },
    { categoria: 'Estornos e bonificações', codigo: 'BPAD', descricao: 'Bonificação campanhas de publicidade - Product Ads', valor: -6 },
    { categoria: 'Comissões', valor: 500 }, { categoria: 'Parcelamento', valor: 300 } ] }] };
  p.state.contasRemotas = { contas: [
    { id: 'f1', tipo: 'fixa', nome: 'Contador', valor: 10, dia: 20, de: 'empresa', categoria: 'Serviços' },
    { id: 'p1', tipo: 'parcela', nome: 'Impressora', valor: 50, parcelas: 5, primeira: '2026-09', dia: 6, de: 'empresa', categoria: 'Equipamentos' },
    { id: 'f2', tipo: 'fixa', nome: 'Apple', valor: 5, dia: 9, de: 'cpf' } ] };
  const e = p.calcEscada('2026-09-01', '2026-09-30');
  perto(e.t.lucro, 80 - 4 - 20, 'lucro da operação');
  perto(e.adsShopee, 6, 'Ads Shopee do período');
  perto(e.fatura.antecipacao, 19, 'antecipação proporcional');
  perto(e.fatura.adsMl, 9.5 - 3.8, 'Ads ML menos a bonificação'); perto(e.fatura.full, 5.7, 'Full proporcional');
  perto(e.lucroReal, 56 - 6 - 5.7 - 19 - 5.7, 'lucro real (comissão e parcelamento da fatura não contam de novo)');
  perto(e.fixas, 10, 'só contas fixas da loja'); perto(e.invest, 50, 'impressora é investimento');
  perto(e.bolso, 19.6 - 10, 'sobrou no bolso');
});

test('kits: taxa fixa por pedido dividida entre as unidades', () => {
  const p = painelBase();
  p.state.configLucro.imposto = 4;
  p.state.custosAvulsos = { '111': 7.69 };
  // 10 pedidos de 1 unidade a R$ 26,77; taxas = 29,7% + R$ 4,50 por pedido
  p.state.transacoes = Array.from({ length: 10 }, (_, i) => ({ tipo: 'venda', data: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), valor: 26.77, origemId: 'api-shopee-' + i,
    itens: [{ item_id: '111', quantidade: 1, preco_unitario: 26.77 }], custosShopee: { comissao: 26.77 * 0.297, taxa_servico: 4.5, liquido_recebido: 26.77 * (1 - 0.297) - 4.5 } }));
  const k = p.calcKits(30)[0];
  perto(k.pct, 0.297, 'taxa percentual real');
  perto(k.op[0].lucroKit, 26.77 * (1 - 0.297 - 0.04) - 4.5 - 7.69, '1 unidade');
  perto(k.op[1].lucroKit, 2 * 26.77 * 0.95 * (1 - 0.297 - 0.04) - 4.5 - 2 * 7.69, 'kit de 2 com 5% off');
  assert.ok(k.op[1].porUnidade > k.op[0].porUnidade, 'kit lucra mais por unidade');
});

test('venda do ML já liberada usa o relatório de liberações do Mercado Pago', () => {
  const p = painelBase();
  const d = hoje();
  p.state.custosAvulsos = { MLB1: 30, MLB2: 50, MLB3: 100 };
  p.state.transacoes = [
    // Gillette: a API dizia 67,32, mas o MP pagou 67,32 + 19,99 de frete devolvido
    { tipo: 'venda', data: d, valor: 109.9, origemId: 'api-ml-111-venda', itens: [{ item_id: 'MLB1', quantidade: 1, preco_unitario: 109.9, comissao: 15.39 }], custosMl: { comissao: 15.39, frete: 27.19, liquido_recebido: 67.32 } },
    // Devolvida: o comprador recebeu o dinheiro de volta; o produto voltou (sem custo, só o prejuízo)
    { tipo: 'venda', data: d, valor: 119.9, origemId: 'api-ml-222-venda', itens: [{ item_id: 'MLB2', quantidade: 1, preco_unitario: 119.9 }] },
    // Cancelada, mas a reclamação foi encerrada a favor do vendedor: o dinheiro ficou e o produto foi embora
    { tipo: 'cancelamento', data: d, valor: 389.9, origemId: 'api-ml-333-cancelamento', itens: [{ item_id: 'MLB3', quantidade: 1, preco_unitario: 389.9 }] },
  ];
  p.state.liberacoes = { cobertura: [['2026-01-01', d]], antecipacao: {}, pedidos: {
    111: { liquido: 87.31, devolucao: 0, outros: 0 },
    222: { liquido: 87.46, devolucao: -138.01, outros: 0 },
    333: { liquido: 298.07, devolucao: 0, outros: 0 },
  } };
  const l = Object.fromEntries(p.calcLucroPorProduto(30).linhas.map((g) => [g.itemId, g]));
  perto(l.MLB1.lucro, 87.31 - 109.9 * 0.04 - 30, 'Gillette');
  perto(l.MLB2.lucro, -50.55, 'devolvida: só o prejuízo, sem imposto nem custo');
  perto(l.MLB3.lucro, 298.07 - 389.9 * 0.04 - 100, 'cancelada que ficou');
});

test('antecipação vem do relatório de liberações quando ele cobre o período', () => {
  const p = painelBase();
  p.state.liberacoes = { cobertura: [['2026-07-03', '2099-12-31']], pedidos: {}, antecipacao: { '2026-10-02': 35.39, '2026-10-12': 77.36, '2026-10-15': 249.47, '2026-09-29': 29.93 } };
  perto(p.antecipacaoNoIntervalo('2026-10-01', '2026-10-18'), 362.22, 'outubro');
  assert.equal(p.antecipacaoNoIntervalo('2026-06-01', '2026-06-30'), null);
});

test('previsão de caixa: saldo + liberações do ML + Shopee pendente − contas', () => {
  const p = painelBase();
  const d = hoje();
  const mais = (n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  p.state.liberacoes = { saldo: { em: d + 'T08:00:00', valor: 100 }, pedidos: {}, cobertura: [], antecipacao: {} };
  p.state.transacoes = [
    { tipo: 'venda', data: d, valor: 109.9, origemId: 'api-ml-1-venda', itens: [], custosMl: { comissao: 15.39, frete: 7.2, liquido_recebido: 87.31, libera_em: mais(5) } },
    { tipo: 'venda', data: d, valor: 23.9, origemId: 'api-shopee-A-venda', status: 'SHIPPED', itens: [], custosShopee: { liquido_recebido: 14.13 } },
  ];
  p.state.contasRemotas = { contas: [{ id: 'f1', tipo: 'fixa', nome: 'Contador', valor: 300, dia: Number(mais(3).slice(8)), de: 'empresa' }], cartoes: [], pagos: {} };
  const c = p.calcCaixa(30);
  perto(c.mlPend, 87.31, 'ML a liberar');
  perto(c.spPend, 14.13, 'Shopee a liberar');
  assert.ok(c.sai >= 300, 'conta do contador entra');
  assert.ok(c.menor.saldo < 0, 'mostra o dia em que fica negativo');
});

test('auditor acha venda em que caiu menos que venda − comissão − frete', () => {
  const p = painelBase();
  const d = hoje();
  p.state.transacoes = [
    { tipo: 'venda', data: d, valor: 109.9, origemId: 'api-ml-1-venda', itens: [{ titulo: 'Gillette' }], custosMl: { comissao: 15.39, frete: 7.2 } },
    { tipo: 'venda', data: d, valor: 59.9, origemId: 'api-ml-2-venda', itens: [{ titulo: 'Listerine' }], custosMl: { comissao: 8.39, frete: 4.2 } },
  ];
  p.state.liberacoes = { pedidos: { 1: { liquido: 67.32, devolucao: 0 }, 2: { liquido: 47.31, devolucao: 0 } } };
  const a = p.calcAuditoria(60);
  assert.equal(a.lista.length, 1);
  perto(a.lista[0].dif, -19.99, 'diferença da Gillette');
});

test('preço logo acima de R$ 79: simula a R$ 78,90', () => {
  const p = painelBase();
  const d = hoje();
  p.state.transacoes = [
    { tipo: 'venda', data: d, valor: 81, origemId: 'api-ml-1-venda', itens: [{ item_id: 'MLB9', titulo: 'Refil', quantidade: 1, preco_unitario: 81 }], custosMl: { comissao: 11.34, frete: 24.19 } },
    { tipo: 'venda', data: d, valor: 23.9, origemId: 'api-ml-2-venda', itens: [{ item_id: 'MLB8', quantidade: 1, preco_unitario: 23.9 }], custosMl: { comissao: 3.94, frete: 6.95 } },
  ];
  const f = p.calcFaixaPreco(60);
  assert.equal(f.lista.length, 1);
  perto(f.lista[0].ganho, (24.19 - 6.95) - (81 - 78.9) * (1 - 11.34 / 81), 'ganho por venda');
});

test('plano de impressão reparte as horas entre as peças pela urgência', () => {
  const p = painelBase();
  const d = hoje();
  const c = p.getCalc3d();
  c.impressoras = [{ id: 'a', watts: 100 }];
  c.produtos = [{ id: 'x', nome: 'Papel', horas: 4, porPlaca: 1, anuncios: 'MLB1' }, { id: 'y', nome: 'Secador — dupla face', horas: 2, porPlaca: 1, anuncios: 'MLB2' },
    { id: 'z', nome: 'Secador — parafuso', horas: 2, porPlaca: 1, anuncios: 'MLB3' }];
  c.estoquePecas = { 'Papel|branco': 0, 'Secador|preto': 10 };
  c.estoquePecasEm = '2000-01-01T00:00:00.000Z';
  p.state.calc3d = c;
  p.state.transacoes = [
    { tipo: 'venda', data: d, valor: 20, itens: [{ item_id: 'MLB1', titulo: 'Papel Branco', quantidade: 28 }] },
    { tipo: 'venda', data: d, valor: 20, itens: [{ item_id: 'MLB2', variacao: 'Preto,Dupla Face', quantidade: 14 }] },
    { tipo: 'venda', data: d, valor: 20, itens: [{ item_id: 'MLB3', variacao: 'Preto,Parafuso', quantidade: 2 }] },
  ];
  const pl = p.calcPlanoImpressao();
  assert.equal(new Set(pl.lista.map((x) => x.base)).size, 2, 'dupla face e parafuso viram uma peça só');
  assert.equal(pl.lista[0].nome, 'Papel branco', 'sem estoque vem primeiro');
  const sec = pl.lista.find((x) => x.base === 'Secador');
  assert.equal(sec.estoque, 0, 'as 16 vendas depois da contagem descontam as 10 prontas');
  assert.ok(pl.lista[0].hojePlacas > 0 && sec.hojePlacas > 0, 'as duas peças entram no dia');
  assert.ok(pl.usadas <= pl.capacidade);
});

test('estoque de peças prontas só desconta vendas depois da contagem', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.impressoras = [{ id: 'a', watts: 100 }];
  c.produtos = [{ id: 'x', nome: 'Pia', horas: 3, porPlaca: 1, anuncios: 'MLB1' }];
  c.estoquePecas = { 'Pia|preto': 11 };
  c.estoquePecasEm = '2026-10-20T18:30:00.000Z';
  p.state.calc3d = c;
  p.state.transacoes = [
    { tipo: 'venda', data: '2026-10-20', dataHora: '2026-10-20T15:00:00.000Z', valor: 20, itens: [{ item_id: 'MLB1', titulo: 'Pia Preto', quantidade: 2 }] },
    { tipo: 'venda', data: '2026-10-20', dataHora: '2026-10-20T19:00:00.000Z', valor: 20, itens: [{ item_id: 'MLB1', titulo: 'Pia Preto', quantidade: 3 }] },
  ];
  const pl = p.calcPlanoImpressao();
  assert.equal(pl.lista.find((x) => x.cor === 'preto').estoque, 8);
});

test('insumo perdido baixa o estoque e entra no lucro como perda', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.embalagens = [{ nome: 'Plástico bolha (cm)', data: '2026-09-30', qtd: 40000, preco: 115.6, frete: 0 }];
  c.estoqueInsumos = { 'Plástico bolha (cm)': { qtd: 18000, data: '2026-10-17' } };
  p.state.calc3d = c;
  p.state.producaoRemota = { falhas: [], manutencoes: [], perdas: [{ id: 'x1', data: '2026-10-19', insumo: 'Plástico bolha (cm)', qtd: 120 }] };
  const e = p.calcEscada('2026-10-01', '2026-10-31');
  perto(e.outrosVenda, 120 * 115.6 / 40000, 'perda de 120 cm');
});

test('calendário soma o mês dia a dia com lucro e margem', () => {
  const p = painelBase();
  const d = hoje();
  p.state.custosAvulsos = { MLB1: 30 };
  p.state.transacoes = [
    { tipo: 'venda', data: d, valor: 100, origemId: 'api-ml-1-venda', itens: [{ item_id: 'MLB1', quantidade: 1, preco_unitario: 100, comissao: 10 }], custosMl: { comissao: 10, frete: 5, liquido_recebido: 85 } },
  ];
  const c = p.calcCalendario(d.slice(0, 7));
  const dia = c.dias.find((x) => x.dia === d);
  perto(dia.lucro, 85 - 4 - 30, 'lucro do dia');
  perto(dia.margem, (85 - 4 - 30) / 100, 'margem do dia');
  perto(c.tot.lucro, 51, 'lucro do mês');
});

test('horas das impressoras: diferença entre duas leituras do contador', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.kwh = 1;
  c.impressoras = [{ id: 'a', nome: 'A1', watts: 100 }, { id: 'b', nome: 'A1 b', watts: 100 }];
  c.leiturasHoras = [{ data: '2026-10-01', valores: { a: 1000, b: 500 } }, { data: '2026-10-11', valores: { a: 1150, b: 560 } }];
  p.state.calc3d = c;
  const h = p.calcHorasImpressoras();
  assert.equal(h.realTotal, 210);
  perto(h.luzReal, 210 * 0.1, 'luz real');
});

test('troca de embalagem com data não mexe no custo das vendas antigas', () => {
  const p = painelBase();
  const c = p.getCalc3d();
  c.embalagens = [{ nome: 'Bolha', data: '2026-01-01', qtd: 100, preco: 10, frete: 0 }, { nome: 'Caixa', data: '2026-01-01', qtd: 10, preco: 8, frete: 0 }];
  const peca = { id: 'x', nome: 'Papel', horas: 0, gramas: 0, porPlaca: 1, insumos: [{ nome: 'Bolha', qtd: 10, ate: '2026-10-19' }, { nome: 'Caixa', qtd: 1, desde: '2026-10-20' }] };
  c.produtos = [peca];
  p.state.calc3d = c;
  perto(p.custoPeca3d(peca, '2026-10-01').embalagem, 1, 'antes: bolha');
  perto(p.custoPeca3d(peca, '2026-10-21').embalagem, 0.8, 'depois: caixa');
});
