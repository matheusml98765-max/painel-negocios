// Monta o index.html juntando as partes de src/ na ordem de src/ordem.json.
// Uso: node scripts/montar.mjs          -> escreve index.html
//      node scripts/montar.mjs --check  -> falha se index.html estiver desatualizado
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ordem = JSON.parse(readFileSync(join(raiz, 'src/ordem.json'), 'utf8'));
const saida = ordem.map((f) => readFileSync(join(raiz, f), 'utf8')).join('');

if (process.argv.includes('--check')) {
  const atual = readFileSync(join(raiz, 'index.html'), 'utf8');
  if (atual !== saida) {
    console.error('index.html desatualizado: rode "node scripts/montar.mjs" e faça commit.');
    process.exit(1);
  }
  console.log('index.html está em dia com src/.');
} else {
  writeFileSync(join(raiz, 'index.html'), saida);
  console.log('index.html montado a partir de ' + ordem.length + ' partes.');
}
