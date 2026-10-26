// Carrega as partes de calculo do painel num ambiente isolado (sem navegador)
// para testar as contas de lucro e de custo 3D.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const partes = ['src/js/01-estado.js', 'src/js/05b-ler-api.js', 'src/js/06-tema-intro.js', 'src/js/08-calc3d-dados.js', 'src/js/10-lucro-calculos.js', 'src/js/13-metas-calor-backup.js', 'src/js/14-produto-calculos.js', 'src/js/16-relatorio.js', 'src/js/17-devolucoes.js', 'src/js/18-luz-insumos.js', 'src/js/19-tarefas-cpf.js', 'src/js/20-compras.js', 'src/js/21-contas-calculos.js', 'src/js/23-fifo.js', 'src/js/24-vendas-hoje.js', 'src/js/25-avisos-falhas.js', 'src/js/32-escada-lucro.js', 'src/js/33-kits.js', 'src/js/34-liberacoes.js', 'src/js/35-caixa.js', 'src/js/36-ferramentas.js', 'src/js/37-plano-impressao.js', 'src/js/38-calendario.js', 'src/js/39-horas-impressoras.js', 'src/js/40-calculadora.js', 'src/js/41-lucro-lojas.js'];

export function carregarPainel() {
  const memoria = {};
  const contexto = {
    console,
    localStorage: { getItem: (k) => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = String(v); } },
    document: { getElementById: () => ({}), addEventListener() {}, documentElement: { getAttribute: () => null, setAttribute() {} } },
    Promise, Date, Math, JSON, Number, String, isNaN, isFinite, Object, Array,
  };
  contexto.window = contexto;
  vm.createContext(contexto);
  const codigo = partes.map((p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')).join('\n');
  const expor = 'return { state: state, fmtMoney: fmtMoney, custoPeca3d: custoPeca3d, custoGrama: custoGrama, custoEmbalagem: custoEmbalagem, custo3dDoAnuncio: custo3dDoAnuncio, getCalc3d: getCalc3d, calcLucroPorProduto: calcLucroPorProduto, custoDoItem: custoDoItem, compararCompras: compararCompras, filaFifo: filaFifo, calcVendasDoDia: calcVendasDoDia, custoFalha: custoFalha, calcEscada: calcEscada, calcKits: calcKits, vendaPeloExtrato: vendaPeloExtrato, antecipacaoNoIntervalo: antecipacaoNoIntervalo, calcCaixa: calcCaixa, calcAuditoria: calcAuditoria, calcFaixaPreco: calcFaixaPreco, calcRanking: calcRanking, calcPlanoImpressao: calcPlanoImpressao, calcCalendario: calcCalendario, calcHorasImpressoras: calcHorasImpressoras, faturaNoIntervalo: faturaNoIntervalo, falhasNoPeriodo: falhasNoPeriodo, precoFifo: precoFifo, contasDoMes: contasDoMes, resumoContasMes: resumoContasMes, parcelasEmAndamento: parcelasEmAndamento, dadosContas: dadosContas, inicioSemana: inicioSemana, adsShopeeNoPeriodo: adsShopeeNoPeriodo, calcProjecaoMes: calcProjecaoMes, calcMapaCalor: calcMapaCalor, melhorFaixa: melhorFaixa, historicoProduto: historicoProduto, simularDesconto: simularDesconto, calcAdsPorProduto: calcAdsPorProduto, calcReposicao: calcReposicao, calcFilamento: calcFilamento, calcRelatorioMes: calcRelatorioMes, horasDesdeAtualizacaoAutomacao: horasDesdeAtualizacaoAutomacao, parseApiJson: parseApiJson, calcDevolucoes: calcDevolucoes, calcConsumo3d: calcConsumo3d, calcEstoqueInsumos: calcEstoqueInsumos, taxasPlataforma: taxasPlataforma, lucroNaPlataforma: lucroNaPlataforma, precoParaMargem: precoParaMargem, custoCalcSimples: custoCalcSimples, calcLucroPorLoja: calcLucroPorLoja };';
  return vm.runInContext('(function () {\n' + codigo + '\n' + expor + '\n})()', contexto);
}
