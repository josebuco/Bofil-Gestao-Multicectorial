# Exibir todos os registos offline

## Objetivo
Fazer com que qualquer registo guardado sem internet apareça imediatamente no próprio aparelho, em todos os ecrãs relevantes, sem esperar pela sincronização.

## Alterações
- Criar uma única forma de combinar os dados já recebidos com os registos ainda guardados no aparelho.
- Incluir entradas, vendas de Água e despesas offline nos totais de receitas, despesas, valores por pagar, saldo total, saldo em numerário e saldo bancário.
- Incluir esses mesmos valores nos gráficos do setor, Painel Geral e Faturação, respeitando o dia ou mês e o período selecionado.
- Mostrar despesas offline imediatamente no Centro de Custos, com a indicação “No aparelho”, e impedir ações que exigem internet até à sincronização.
- Manter as listas de Água, Restaurante, Lavagem e Transporte atualizadas com os registos locais.
- Garantir uma apresentação útil mesmo quando o aparelho abre offline sem conseguir atualizar os dados da nuvem naquele momento.
- Depois da sincronização, retirar automaticamente a indicação “No aparelho” e atualizar todos os números sem duplicar o registo.

## Detalhes técnicos
- A fila local continuará a ser a fonte dos registos pendentes; não serão guardadas palavras-passe nem enfraquecidas as permissões.
- O valor calculado de uma venda de Água será guardado junto ao registo local para poder alimentar totais e gráficos fora do ecrã da Água.
- O cálculo combinado será reutilizado pelo Caixa do Setor, Painel Geral, Faturação e páginas rápidas, evitando regras diferentes em cada página.
- Serão adicionados testes do cálculo local por setor, período, pagamento e estado, além da verificação do ecrã e da compilação.
