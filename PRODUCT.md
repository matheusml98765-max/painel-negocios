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
- Meta do mês com projeção pelo ritmo de vendas, mapa de calor de vendas por dia da semana e hora, e backup dos custos para levar a outro navegador.
- Ficha de cada produto (clique no nome na aba Lucro real): vendas e lucro por semana e simulador de desconto/campanha (quanto sobra e quanto precisa vender a mais).
- Ads por produto (Shopee Ads e Product Ads do ML) com regra de decisão: Ads acima da margem → pausar; abaixo da metade → aumentar.
- Reposição com o estoque real dos anúncios do ML (Full incluso): até quando o estoque dura, quanto comprar e quando pedir filamento.
- Relatório do mês: nota da loja (com o motivo de cada ponto perdido), problemas e oportunidades em R$, plano para 30 dias e PDF.
- Avisos no Telegram (resumo às 8h, automação parada, venda grande), feitos pela automação.
- Tudo atualizado sozinho de hora em hora.

## Critérios de "pronto" para uma funcionalidade

- Os números batem com a fonte (fatura, extrato ou pedido) em pelo menos um caso conferido à mão.
- A conta tem teste em `tests/`.
- Funciona no celular e nos dois temas.
- Quando falta dado, a tela explica o que falta.

## Próximos passos

- Guardar custos fora do navegador (hoje: `localStorage` + backup manual em arquivo).
- TikTok Shop.
- Custos da Shopee por variação (dupla face × parafuso) em vez de por anúncio.
- Empacotar a instalação para outros vendedores: configuração por loja, nada fixo no código.
