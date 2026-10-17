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
