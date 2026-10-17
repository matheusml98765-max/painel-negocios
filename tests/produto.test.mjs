// Testes das contas por produto: simulador de desconto, Ads, reposicao, historico e relatorio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarPainel } from './carregar.mjs';

const dia = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg}: esperado ${b}, veio ${a}`);

function painel() {
  const p = carregarPainel();
  Object.assign(p.state, { produtos: [], custosAvulsos: {}, transacoes: [], calc3d: null, adsShopee: null, faturamento: null, statusAuto: null });
  p.state.configLucro = { imposto: 0, margemAlvo: 25, dias: 30, ordem: 'receita', plataforma: 'todas' };
  return p;
}
// Venda no ML de R$ 100: comissao 12, frete 8, recebe 80
const vendaMl = (data, qtd = 1) => ({ tipo: 'venda', data, valor: 100 * qtd, origemId: 'api-ml-' + Math.random() + '-venda', itens: [{ item_id: 'MLB1', titulo: 'Suporte', quantidade: qtd, preco_unitario: 100, comissao: 12 * qtd }], custosMl: { comissao: 12 * qtd, frete: 8 * qtd, liquido_recebido: 80 * qtd } });

test('simulador de desconto mantém a % de comissão e o frete por unidade', () => {
  const p = painel();
  p.state.transacoes = [vendaMl(dia())];
  p.state.custosAvulsos = { MLB1: 50 };
  const g = p.calcLucroPorProduto(30).linhas[0];
  const s = p.simularDesconto(g, 0.1);
  perto(s.atual.lucro, 30, 'lucro hoje');
  perto(s.novo.preco, 90, 'preço com 10% off');
  perto(s.novo.taxas, 90 * 0.12 + 8, 'taxas com desconto');
  perto(s.novo.lucro, 90 - 18.8 - 50, 'lucro com desconto');
  perto(s.vendasAMais, 30 / 21.2 - 1, 'vendas a mais para empatar');
  // preço mínimo: (8 + 50) / 0,88 = 65,91 -> desconto máximo 34,09%
  perto(s.descontoMaximo * 100, (1 - 58 / 0.88 / 100) * 100, 'desconto máximo');
});

test('Ads por produto: pausar quando o Ads leva mais que a margem, aumentar quando leva menos da metade', () => {
  const p = painel();
  const vs = (id, valor, liq) => ({ tipo: 'venda', data: dia(), valor, origemId: 'api-shopee-' + id + '-venda', itens: [{ item_id: id, titulo: 'P' + id, quantidade: 1, preco_unitario: valor }], custosShopee: { comissao: valor - liq, liquido_recebido: liq } });
  p.state.transacoes = [vs(1, 100, 80), vs(2, 100, 80)];
  p.state.custosAvulsos = { '1': 60, '2': 40 }; // margem 20% e 40%
  p.state.adsShopee = { dias: [], por_item_dias: 30, por_item: { '1': { gasto: 30, vendas: 100, pedidos: 1, cliques: 10 }, '2': { gasto: 10, vendas: 100, pedidos: 1, cliques: 5 }, '9': { gasto: 5, vendas: 0, pedidos: 0, cliques: 2 } } };
  const r = p.calcAdsPorProduto();
  const de = Object.fromEntries(r.linhas.map((l) => [l.itemId, l]));
  assert.equal(de['1'].decisao, 'pausar');
  perto(de['1'].lucroDepois, -10, 'lucro depois do Ads');
  assert.equal(de['2'].decisao, 'aumentar');
  assert.equal(de['9'].decisao, 'pouco-dado');
});

test('reposição: cobertura e quanto comprar pelo ritmo dos últimos 30 dias', () => {
  const p = painel();
  p.state.transacoes = [vendaMl(dia(), 30), vendaMl(dia(-40), 50)]; // 30 un. em 30 dias = 1/dia
  p.state.produtos = [{ id: 'a', nome: 'Suporte', quantidade: 8, mlItemId: 'MLB1' }];
  const [r] = p.calcReposicao(10, 30);
  perto(r.porDia, 1, 'vende por dia');
  perto(r.cobertura, 8, 'dias de estoque');
  assert.equal(r.situacao, 'urgente');
  assert.equal(r.comprar, 32); // 40 dias de venda - 8 em estoque
});

test('histórico separa as vendas por semana', () => {
  const p = painel();
  p.state.transacoes = [vendaMl(dia(), 2), vendaMl(dia(-7), 1), vendaMl(dia(-200), 9)];
  const h = p.historicoProduto('MLB1', 12);
  assert.equal(h.length, 12);
  assert.equal(h.reduce((s, x) => s + x.unidades, 0), 3);
  assert.equal(h[11].unidades, 2);
  assert.equal(h[11].lucro, null); // sem custo cadastrado
});

test('filamento: ritmo de compra pelos lotes', () => {
  const p = painel();
  p.state.calc3d = { filamentos: [{ data: '2026-01-01', kg: 10 }, { data: '2026-01-11', kg: 10 }, { data: '2026-01-21', kg: 5 }], produtos: [] };
  const f = p.calcFilamento(new Date('2026-01-22T12:00:00'));
  perto(f.kgMesCompra, 30, 'kg por mês'); // 20 kg em 20 dias
  assert.equal(f.diasAteProxima, 4); // 5 kg a 1 kg/dia a partir de 21/01
});

test('relatório do mês: nota cai com prejuízo e soma o que está em jogo', () => {
  const p = painel();
  const mes = dia().slice(0, 7);
  p.state.transacoes = [vendaMl(mes + '-01', 2)];
  p.state.custosAvulsos = { MLB1: 90 }; // recebe 80, custa 90: prejuízo de 10 por unidade
  const r = p.calcRelatorioMes(mes, new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 2, 12));
  perto(r.lucro, -20, 'lucro do mês');
  assert.ok(r.nota < 10);
  assert.equal(r.itens[0].tipo, 'prejuizo');
  perto(r.emJogo, 20, 'em jogo');
  assert.ok(r.plano.length >= 1);
});

test('aviso de automação parada usa o status.json, não a fatura', () => {
  const p = painel();
  p.state.faturamento = { atualizado_em: new Date(Date.now() - 5 * 36e5).toISOString() };
  p.state.statusAuto = { atualizado_em: new Date(Date.now() - 1 * 36e5).toISOString() };
  perto(p.horasDesdeAtualizacaoAutomacao(), 1, 'horas com status');
  p.state.statusAuto = null;
  perto(p.horasDesdeAtualizacaoAutomacao(), 0, 'fatura tem 6 h de folga');
});

test('reposição usa o estoque real dos anúncios do ML e Ads junta ML e Shopee', () => {
  const p = painel();
  p.state.transacoes = [vendaMl(dia(), 30)];
  p.state.custosAvulsos = { MLB1: 50 }; // margem 30%
  p.state.produtos = [{ id: 'a', nome: 'Manual', quantidade: 99, mlItemId: 'MLB1' }];
  p.state.anunciosMl = { itens: [{ id: 'MLB1', titulo: 'Suporte', estoque: 5, status: 'active', full: true }, { id: 'MLB2', titulo: 'Parado', estoque: 3, status: 'active' }],
    ads: { dias: 30, por_item: { MLB1: { gasto: 120, vendas: 1000, pedidos: 10, cliques: 50 } } } };
  const rep = p.calcReposicao(10, 30);
  assert.equal(rep.length, 2);
  assert.equal(rep[0].estoque, 5); // vem da API, não do cadastro manual
  assert.equal(rep[0].fonte, 'ml');
  assert.equal(rep[1].situacao, 'parado');
  const ads = p.calcAdsPorProduto('ml');
  assert.equal(ads.linhas[0].plataforma, 'ml');
  assert.equal(ads.linhas[0].aumentar, undefined);
  assert.equal(ads.linhas[0].decisao, 'aumentar'); // ACOS 12% < metade de 30%
});

test('venda que depois foi cancelada vira cancelamento (não conta duas vezes)', () => {
  const p = painel();
  const venda = [{ id: 'SP1', tipo: 'venda', valor: 20, data: dia(), itens: [{ item_id: 1, quantidade: 1, preco_unitario: 20 }], custos_shopee: { comissao: 4, liquido_recebido: 14 } }];
  const r1 = p.parseApiJson(JSON.stringify(venda), 'api-shopee-', 'Shopee');
  assert.equal(r1.novas.length, 1);
  p.state.transacoes = r1.novas;
  const r2 = p.parseApiJson(JSON.stringify([{ id: 'SP1', tipo: 'cancelamento', valor: 20, data: dia() }]), 'api-shopee-', 'Shopee');
  assert.equal(r2.novas.length, 0);
  assert.equal(r2.atualizadas, 1);
  assert.equal(p.state.transacoes.length, 1);
  assert.equal(p.state.transacoes[0].tipo, 'cancelamento');
  assert.equal(p.state.transacoes[0].custosShopee, undefined);
});
