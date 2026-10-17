# Painel Top Brasil Shop

Painel web estático (GitHub Pages) que mostra vendas, lucro real e custos da loja no Mercado Livre e na Shopee. Os dados chegam de um Gist atualizado de hora em hora pelo repositório privado `automacao-mercado-livre`. Produto e decisões: [PRODUCT.md](PRODUCT.md).

## Como o código está organizado

- **Não edite `index.html` à mão.** Ele é montado a partir de `src/`, na ordem de `src/ordem.json`.
- Depois de mudar qualquer arquivo em `src/`: `node scripts/montar.mjs` e faça commit do `index.html` junto.
- `src/js/` são pedaços de **um único** `(function () { ... })()`: todos compartilham as mesmas variáveis (`state`, `el`, `render`...). Não use `import`/`export`.
- Partes: `01-estado` (estado e desfazer) · `02-sincronizacao` (Gist, armazenamento) · `03-base-ui` · `04-estoque-financeiro` · `05-importar` (leitura dos JSON/CSV) · `06-tema-intro` · `07-inicio` · `08-calc3d-dados` (contas 3D) · `09-calc3d-tela` · `10-lucro-calculos` (contas de lucro) · `11-lucro-tela` · `13-metas-calor-backup` (metas do mês, mapa de calor das vendas, backup dos custos) · `14-produto-calculos` (histórico, simulador de desconto, Ads por produto, reposição, filamento) · `15-produto-tela` (ficha do produto, tabela de Ads, card de reposição) · `16-relatorio` (relatório do mês: nota, problemas em R$, plano de 30 dias) · `12-render`.
- Mantenha cada arquivo de `src/` abaixo de 350 linhas; divida por responsabilidade quando passar.
- Estilo: `src/estilos.css`, só com variáveis de tema (`--bg`, `--surface`, `--ink`, `--accent`...). Tema escuro e claro em `:root` e `:root[data-theme="light"]`. Cores das séries: `--s-ml`, `--s-shopee`, `--s-tiktok` (validadas para daltonismo).

## Verificar antes de publicar

```bash
node scripts/montar.mjs --check   # index.html em dia com src/
node --test tests/*.test.mjs      # contas de lucro, custo 3D, Ads, reposição e relatório
```

O GitHub Actions (`.github/workflows/checar.yml`) roda os dois e a checagem de sintaxe a cada push. Mudou uma conta? Atualize ou acrescente um teste em `tests/calculos.test.mjs`.

## Dados e privacidade

- O repositório e o site são **públicos**. Nunca coloque aqui custos, tokens, URL do Gist ou dados de clientes.
- Custos, URL do Gist e configurações ficam no `localStorage` do navegador do usuário (chaves `pml_*`). Trocar de navegador ou limpar dados apaga os custos.
- Formato dos arquivos do Gist: `pedidos_classificados.json` (ML, com `custos_ml`), `faturamento.json`, `pedidos_shopee.json` (com `custos_shopee`) e `ads_shopee.json` (com `por_item`: Ads de cada anúncio em 30 dias) e `status.json` (hora da última execução, usada no aviso de automação parada). Quem gera é o `automacao-mercado-livre`; mudou o formato lá, ajuste `05-importar.js` e `10-lucro-calculos.js` aqui.

## Acordos

- Interface em português do Brasil, linguagem simples para quem vende, não para programador.
- Números de dinheiro sempre com `fmtMoney`; porcentagem com `fmtPct`.
- Mostre só números que vêm de dados reais; quando faltar dado, diga o que falta em vez de mostrar zero ou um valor enganoso.
- Gráficos com Chart.js (cdnjs). Destrua os gráficos no `render()` (`destruirGraficos`).
