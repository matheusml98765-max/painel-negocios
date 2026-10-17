// Carrega as partes de calculo do painel num ambiente isolado (sem navegador)
// para testar as contas de lucro e de custo 3D.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const partes = ['src/js/01-estado.js', 'src/js/08-calc3d-dados.js', 'src/js/10-lucro-calculos.js', 'src/js/13-metas-calor-backup.js'];

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
  const expor = 'return { state: state, fmtMoney: fmtMoney, custoPeca3d: custoPeca3d, custoGrama: custoGrama, custoEmbalagem: custoEmbalagem, custo3dDoAnuncio: custo3dDoAnuncio, getCalc3d: getCalc3d, calcLucroPorProduto: calcLucroPorProduto, custoDoItem: custoDoItem, adsShopeeNoPeriodo: adsShopeeNoPeriodo, calcProjecaoMes: calcProjecaoMes, calcMapaCalor: calcMapaCalor, melhorFaixa: melhorFaixa };';
  return vm.runInContext('(function () {\n' + codigo + '\n' + expor + '\n})()', contexto);
}
