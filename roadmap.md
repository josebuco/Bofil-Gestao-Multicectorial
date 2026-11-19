# Roadmap

- [ ] Pedido actual
  - [x] Mostrar os veículos em cartões individuais, semelhantes aos cartões dos sectores; testes e build OK
  - [ ] Repor a palavra-passe da conta administrativa (aguarda sessão/autorização administrativa)

- [ ] Aba "Controle de consumo dos veículos"
  - [x] Permissão independente para acesso à aba
  - [x] Reunir veículos, consumos e compras de estoque partilhado
  - [ ] Cartões seleccionáveis e painel de operações por baixo
  - [ ] Ocultar compras e histórico de entradas quando o técnico não tem acesso ao setor
  - [ ] Aplicar período diário aos técnicos e período escolhido pela administração
  - [ ] Verificar cálculos, permissões e apresentação

- [x] Compras individuais de estoque nos setores
  - [x] Registar compras como despesa paga do setor, com lotes partilhados
  - [x] Calcular automaticamente combustível a 420 Kz por litro
  - [x] Mostrar compra local pendente de sincronização e testar cálculos
  - [ ] Confirmar registo no ecrã autenticado (pré-visualização sem sessão autenticada)

- [x] Pagamentos pendentes no Restaurante e Lavagem
  - [x] Estado e cliente opcional, preservando entradas antigas
  - [x] Marcar pago e sincronizar sem internet
  - [x] Totais, saldo e lucro sem receitas pendentes
  - [x] Verificar formulários, cálculos e histórico (5 testes financeiros; navegador com dados locais; build OK)
  - [ ] Verificação online autenticada da sincronização

- [x] Simplificar aba Utilizadores (design "Cartões industriais" escolhido)
  - [x] Dispositivos integrados por baixo dentro de Utilizadores
  - [x] Aba Dispositivos removida do menu e rota apagada
  - [x] Verificado: build OK, tsgo OK, screenshot confirmado

- [x] Exibir registos offline em todos os setores
  - [x] Listas e totais do Centro de Custos
  - [x] Entradas, saídas e saldos por setor
  - [x] Gráficos do setor, Painel e Faturação
  - [x] Verificar compilação e apresentação

- [x] Cópia de segurança dos registos (botão para a administração)
  - [x] ZIP com JSON + CSV de todas as tabelas e lista das faturas
  - [x] Ficheiros das faturas em ZIP separado
  - [x] Verificado: build OK, tsgo OK, descarga comprovada no navegador (47 KB, 39 ficheiros)

- [x] Corrigir seletor de data nas entradas dos veículos da Água
  - [x] Botão azul compacto “Data” no canto superior direito do cartão
  - [x] Visível apenas à administração e aplicado à entrada guardada
  - [x] Verificar no ecrã da Água

- [x] Uniformizar a data nas entradas de Restaurante e Lavagem
  - [x] Substituir o campo antigo pelo botão azul compacto no canto superior direito
  - [x] Manter o calendário exclusivo da administração

- [x] Compactar formulários e históricos dos setores
  - [x] Restaurante e Lavagem com entradas e saídas expansíveis
  - [x] Água, Transporte e Aluguer com históricos por unidade expansíveis
  - [x] Entregas recentes da Água expansíveis
  - [x] Verificar no computador e no telefone
