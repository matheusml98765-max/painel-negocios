# Produto: Painel de lucro real para vendedores de marketplace

## Problema

Quem vende no Mercado Livre e na Shopee não sabe quanto lucra em cada produto. As taxas vêm misturadas na fatura (comissão, frete, taxa fixa, afiliados, antecipação, Full), o custo do produto muda a cada compra e a calculadora da própria plataforma não mostra o que realmente caiu na conta. Resultado: produtos vendendo com prejuízo sem o dono perceber.

## Público

1. **Agora:** a própria loja (Top Brasil Shop) — revenda no ML comprando na Amazon e impressão 3D vendida principalmente na Shopee.
2. **Depois:** outros vendedores, com instalação, agentes e suporte vendidos como serviço.

## O que o produto faz hoje

- Lucro real por produto com os valores de **cada venda** (o que a plataforma descontou e o que caiu na conta), imposto e custo do produto.
- Fatura do ML e do Mercado Pago por categoria, com alerta de antecipação e parcelamento.
- Taxas reais da Shopee por pedido (comissão, serviço, afiliados) e gasto com Shopee Ads.
- Calculadora de custo da impressão 3D: remessas de filamento e insumos com preços que mudam, luz, desgaste das impressoras, perdas, e simulador de preço por plataforma.
- Tela de início com resumo do dia e do mês, gráficos e alertas; tema escuro e claro.
- Tudo atualizado sozinho de hora em hora.

## Critérios de "pronto" para uma funcionalidade

- Os números batem com a fonte (fatura, extrato ou pedido) em pelo menos um caso conferido à mão.
- A conta tem teste em `tests/`.
- Funciona no celular e nos dois temas.
- Quando falta dado, a tela explica o que falta.

## Próximos passos

- Guardar custos fora do navegador (hoje ficam só no `localStorage`).
- TikTok Shop.
- Custos da Shopee por variação (dupla face × parafuso) em vez de por anúncio.
- Empacotar a instalação para outros vendedores: configuração por loja, nada fixo no código.
