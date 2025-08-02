# 📋 Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.4.0] - 2024-12-31

### 🎯 Adicionado
- **Estratégia Híbrida de Stop Loss Adaptativo**
  - Dupla camada de segurança: failsafe + monitoramento tático
  - Stop loss baseado em ATR (Average True Range) para adaptação à volatilidade
  - Take profit parcial com ordens LIMIT na corretora
  - Monitoramento e recriação automática de ordens perdidas
  - Atualização de stop loss para breakeven quando TP parcial é executado

- **Sistema de Proteção Inteligente**
  - Failsafe sempre ativo na corretora (STOP_MARKET)
  - Monitoramento tático paralelo baseado em ATR
  - Decisão inteligente: sempre escolhe o stop mais seguro
  - Cancelamento e criação automática de ordens de stop loss

- **Gestão Dinâmica de Risco**
  - Fase 1: Risco inicial com stop ATR + failsafe
  - Fase 2: Monitoramento de take profit parcial
  - Fase 3: Trailing stop após execução do TP parcial
  - Transição automática entre fases baseada em eventos

### 🔧 Melhorado
- **OrderController.js**
  - Implementação de `createPartialTakeProfitOrder()` para ordens LIMIT
  - Implementação de `hasPartialTakeProfitOrder()` para monitoramento
  - Melhoria no `validateAndCreateStopLoss()` com dupla camada
  - Logs detalhados de cálculos e decisões de stop loss

- **TrailingStop.js**
  - Refatoração completa para estratégia híbrida
  - Implementação de `updateTrailingStopHybrid()` com fases
  - Detecção automática de execução de take profit parcial
  - Atualização de stop loss para breakeven com ordens na corretora

- **Indicators.js**
  - Integração completa do cálculo ATR
  - Método `getAtrValue()` para busca de dados históricos
  - Cálculo dinâmico de stop loss baseado em volatilidade

### 🐛 Correções
- **Sincronização Bot-Corretora**
  - Correção de problema onde stop loss interno não sincronizava com corretora
  - Implementação de cancelamento e criação de novas ordens
  - Garantia de que ordens na corretora sempre refletem estado interno

- **Detecção de Take Profit Parcial**
  - Correção de lógica para detectar execução de ordens LIMIT
  - Implementação de verificação por redução de posição
  - Tolerância de 1% para variações de quantidade

- **Cálculo de Stop Loss com ATR**
  - Correção para considerar alavancagem no cálculo ATR
  - Implementação de multiplicadores configuráveis
  - Cálculo correto para posições LONG e SHORT

### ⚙️ Configurações
- `ENABLE_HYBRID_STOP_STRATEGY`: Ativa estratégia híbrida (true/false)
- `INITIAL_STOP_ATR_MULTIPLIER`: Multiplicador ATR para stop inicial (padrão: 2.0)
- `TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER`: Multiplicador ATR para TP parcial (padrão: 1.5)
- `PARTIAL_PROFIT_PERCENTAGE`: Porcentagem da posição para TP parcial (padrão: 50%)

### 🎯 Funcionalidades
- **Stop Loss Adaptativo**: Ajuste automático baseado na volatilidade do mercado
- **Take Profit Parcial**: Execução automática pela corretora
- **Breakeven Management**: Proteção de lucros após TP parcial
- **Monitoramento Inteligente**: Verificação contínua de ordens
- **Logs User-Friendly**: Mensagens claras em português

### 📚 Documentação
- **context.md**: Overview completo do projeto BackBot
- **tasks-stop-loss-adaptativo.md**: Especificações detalhadas da implementação
- **tasks.md**: Tasks gerais do projeto
- **jest.setup.js**: Configuração de testes para nova funcionalidade

### 🛡️ Segurança
- **Dupla Proteção**: Failsafe + monitoramento tático
- **Execução na Corretora**: Ordens sempre enviadas para proteção
- **Limpeza Automática**: Sistema de limpeza de ordens órfãs
- **Tratamento de Erros**: Robustez em todas as operações

## [1.3.0] - 2024-12-31

### 🎯 Adicionado
- **Sistema de Trailing Stop Avançado**
  - Implementação completa de trailing stop dinâmico
  - Ativação automática quando posição fica lucrativa
  - Ajuste contínuo do stop loss baseado no preço mais favorável
  - Configuração via `TRAILING_STOP_DISTANCE` (padrão: 1.5%)
  - Suporte para posições LONG e SHORT com lógica específica

- **Monitor de Ordens Órfãs**
  - Sistema automático de limpeza de ordens condicionais órfãs
  - Verificação periódica a cada 60 segundos
  - Identificação inteligente de ordens sem posições correspondentes
  - Cancelamento automático de stop loss órfãos
  - Logs detalhados de todas as operações de limpeza

- **Sistema de Auditoria para Backtest**
  - Modo de auditoria ativado via `BACKTEST_AUDIT_MODE=true`
  - 8 camadas de validação para diagnóstico completo
  - Análise detalhada de cada etapa do processo de decisão
  - Identificação de pontos de falha em backtests
  - Compatibilidade com modo normal (alta performance)

### 🔧 Melhorado
- **Sistema de Logs Condicional**
  - Logs verbosos controlados por `LOG_TYPE=debug`
  - Redução de poluição visual em modo normal
  - Logs essenciais sempre visíveis (ações importantes)
  - Sistema consistente entre TrailingStop e OrderController

- **Sistema de Cores para Logs**
  - Implementação de ColorLogger para Trailing Stop
  - Cores diferenciadas para identificação visual rápida:
    - 🟣 Fúcsia: Aguardando posição ficar lucrativa
    - 🟠 Laranja: Aguardando ativação
    - 🟢 Verde: Trailing ativo e em lucro
    - 🟢 Brilhante: Verificando gatilho
    - 🔴 Vermelho: Trailing em hold/proteção
    - 🔴 Brilhante: Gatilho ativado
    - 🔵 Azul: Trailing atualizado
    - 🟡 Amarelo: Trailing ativando
    - ⚪ Cinza: Cleanup
    - 🔵 Ciano: Configuração

- **Cálculo de Stop Loss**
  - Correção para considerar alavancagem no cálculo
  - Uso de `validateLeverageForSymbol()` para alavancagem correta
  - Cálculo `actualStopLossPct = baseStopLossPct / leverage`
  - Resolução de problema onde stop loss era criado na distância bruta

- **Sistema de Cache Inteligente**
  - Cache para logs de ajuste de alavancagem
  - Evita logs repetitivos por símbolo
  - Limpeza automática quando posição é fechada
  - Cache de verificação de stop loss com timeout

### 🐛 Correções
- **Correção Crítica no Cálculo de PnL para Posições SHORT**
  - Problema: Bot usava apenas `pnlUnrealized` da API, ignorando `pnlRealized`
  - Solução: Usar `pnlRealized + pnlUnrealized` para PnL total correto
  - Impacto: Trailing stop agora detecta corretamente lucro em posições SHORT
  - Exemplo: BTC SHORT com pnlRealized=2.12 e pnlUnrealized=-1.13 agora mostra lucro total de 0.99
  - Resolução: Posições SHORT com lucro parcial realizado agora ativam trailing stop corretamente

- **Correção Crítica no Trailing Stop**
  - Refatoração do método `stopLoss()` para garantir execução
  - Uso de `trailingState` diretamente em vez de `trailingInfo`
  - Garantia de chamada de `OrderController.forceClose()` quando decisão é positiva
  - Resolução de falha na 'última milha' que impedia fechamento

- **Correção de Cálculo de PnL**
  - Validação de alavancagem nos métodos `calculatePnL`
  - Correção para tokens como ENA_USDC_PERP (10x ao invés de 15x)
  - Cálculo correto de PnL: -7.13% ao invés de -10.13%
  - Evita fechamento prematuro por stop loss incorreto

- **Correção de Importações**
  - Adição de importações corretas no BaseStrategy.js
  - Conversão de `calculateStopAndTarget()` para assíncrono
  - Atualização de chamadas em DefaultStrategy.js para usar `await`
  - Resolução de erro de sintaxe 'Unexpected reserved word'

- **Correção de Método de Cancelamento**
  - Alteração de `cancelOrder` para `cancelOpenOrder`
  - Uso correto de `order.id` em vez de `order.orderId`
  - Melhoria na identificação de ordens órfãs

### ⚙️ Configurações
- `TRAILING_STOP_DISTANCE`: Distância do trailing stop (padrão: 1.5%)
- `BACKTEST_AUDIT_MODE`: Ativa modo de auditoria para diagnóstico
- `LOG_TYPE`: Controla verbosidade dos logs (debug/normal)
- `TRAILING_STOP_ENABLED`: Habilita/desabilita trailing stop

### 🎯 Funcionalidades
- **Trailing Stop Inteligente**:
  - Ativação automática quando posição fica lucrativa
  - Ajuste contínuo baseado no preço mais favorável
  - Proteção contra reversões de tendência
  - Suporte completo para LONG e SHORT

- **Monitor de Segurança**:
  - Limpeza automática de ordens órfãs
  - Prevenção de execuções acidentais
  - Monitoramento contínuo 24/7
  - Logs detalhados de todas as operações

- **Sistema de Diagnóstico**:
  - Auditoria completa de backtests
  - Identificação de pontos de falha
  - Análise detalhada de cada etapa
  - Compatibilidade com modo de alta performance

### 📚 Documentação
- **README Atualizado**: Documentação do sistema de trailing stop
- **Configurações de Trailing Stop**: Explicação detalhada dos parâmetros
- **Sistema de Logs**: Guia para uso do sistema de logs condicional
- **Monitor de Ordens Órfãs**: Documentação da funcionalidade de limpeza

---

## [1.2.1] - 2024-12-19

### 🐛 Correções
- **TrailingStop Error**: Corrigido erro `this.cancelPendingOrders is not a function`
  - Solução: Alterado `cancelPendingOrders` de método de instância para método estático
  - Permite chamada correta a partir do método estático `forceClose` no OrderController

## [1.2.0] - 2024-12-19

### 🎯 Adicionado
- **Sistema de Modos de Simulação do Backtest**
  - Modo `HIGH_FIDELITY`: Simulação intra-vela para timeframes baixos (≤ 30m)
  - Modo `STANDARD`: Simulação em velas fechadas para timeframes altos (≥ 1h)
  - Modo `AUTO`: Seleção automática baseada no timeframe (padrão)
  - Configuração via variável de ambiente `BACKTEST_SIMULATION_MODE`

### 🔧 Melhorado
- **BacktestEngine.js**
  - Refatoração completa para suportar dois modos de simulação
  - Implementação de simulação intra-vela com dados de 1m
  - Construção dinâmica de velas AMBIENT baseada em dados de 1m
  - Métodos para agrupar candles de 1m em timeframes AMBIENT
  - Seleção automática de modo baseado no timeframe

- **DataProvider.js**
  - Suporte a busca de dados de 1m para modo High-Fidelity
  - Agrupamento automático de dados de 1m para timeframes AMBIENT
  - Determinação automática do timeframe de dados baseado no modo
  - Métodos para conversão de timeframes e agrupamento de candles

- **BacktestRunner.js**
  - Integração com sistema de modos de simulação
  - Determinação automática de timeframes AMBIENT e ACTION
  - Validação de configurações de simulação
  - Exibição de informações detalhadas sobre modo de simulação

- **backtest.js**
  - Interface atualizada para mostrar informações de simulação
  - Seleção automática de modo baseado no timeframe escolhido
  - Opção para alterar modo de simulação manualmente
  - Exibição de descrições detalhadas de cada modo

### 📚 Documentação
- **SIMULATION_MODES.md**: Documentação completa do sistema de modos de simulação
- **env.example**: Adicionada configuração `BACKTEST_SIMULATION_MODE`
- Atualização de documentação existente para refletir novos recursos

### ⚙️ Configuração
- Nova variável de ambiente `BACKTEST_SIMULATION_MODE` com valores:
  - `AUTO`: Seleção automática (recomendado)
  - `HIGH_FIDELITY`: Força simulação intra-vela
  - `STANDARD`: Força simulação em velas fechadas

### 🎯 Funcionalidades
- **Seleção Automática Inteligente**:
  - Timeframes ≤ 30m → HIGH_FIDELITY
  - Timeframes ≥ 1h → STANDARD
- **Simulação Intra-Vela**: Análise contínua a cada minuto para timeframes baixos
- **Performance Otimizada**: Modo rápido para timeframes altos
- **Compatibilidade**: Mantém compatibilidade com configurações existentes

## [1.1.0] - 2024-12-18

### 🎯 Adicionado
- **Sistema de Modos de Execução do Bot**
  - Modo `ON_CANDLE_CLOSE`: Análise sincronizada ao fechamento de velas
  - Modo `REALTIME`: Análise a cada 60 segundos (modo anterior)
  - Configuração via variável de ambiente `EXECUTION_MODE`

### 🔧 Melhorado
- **app.js**
  - Refatoração do loop principal de execução
  - Implementação de dois modos de operação distintos
  - Função `getTimeUntilNextCandleClose()` para cálculo de tempo até próximo fechamento
  - Função `parseTimeframeToMs()` para conversão de timeframes
  - Barra de progresso dinâmica baseada no tempo de espera
  - Logs informativos para cada modo de execução

- **src/Decision/Decision.js**
  - Função `showLoadingProgress()` adaptada para receber duração dinâmica
  - Cálculo automático do horário de término da espera
  - Suporte a diferentes durações de espera por modo

### 📚 Documentação
- **EXECUTION_MODES.md**: Documentação completa dos modos de execução
- **ENV_EXAMPLE.md**: Exemplo de configuração para `.env.example`
- **CORRECOES_IMPLEMENTADAS.md**: Documentação de problemas identificados e soluções

### ⚙️ Configuração
- Nova variável de ambiente `EXECUTION_MODE` com valores:
  - `ON_CANDLE_CLOSE`: Modo recomendado para máxima fidelidade
  - `REALTIME`: Modo de alta frequência (com avisos)

### 🛠️ Correções
- **TypeError**: Corrigido erro `OrderController.monitorPendingOrders is not a function`
  - Solução: Alterado para `OrderController.monitorPendingEntryOrders('DEFAULT')`
- **AccountConfig Warning**: Identificado e documentado para monitoramento futuro

### 🎯 Funcionalidades
- **Sincronização com Velas**: Análise no exato momento do fechamento
- **Fidelidade com Backtests**: Garantia de 100% de fidelidade
- **Flexibilidade**: Escolha entre precisão e frequência
- **Interface Melhorada**: Logs claros e barra de progresso informativa

## [1.0.0] - 2024-12-17

### 🎯 Adicionado
- **Sistema de Backtesting Completo**
  - Motor de simulação com suporte a múltiplas estratégias
  - Provedor de dados históricos (Backpack + Binance)
  - Interface CLI interativa para configuração
  - Relatórios detalhados de performance

### 🔧 Melhorado
- **Estratégias de Trading**
  - DEFAULT: Farm de volume com stop loss básico
  - PRO_MAX: Estratégia avançada com múltiplos targets
  

### 📚 Documentação
- **README.md**: Documentação principal do projeto
- **CHANGELOG.md**: Histórico de mudanças
- **env.example**: Exemplo de configuração

### ⚙️ Configuração
- Sistema de variáveis de ambiente para configuração
- Suporte a múltiplas contas de trading
- Configurações de risco e performance

### 🎯 Funcionalidades
- **Backtesting**: Simulação de estratégias com dados históricos
- **Análise de Performance**: Métricas detalhadas (win rate, profit factor, etc.)
- **Comparação de Estratégias**: Teste múltiplas estratégias simultaneamente
- **Geração de Relatórios**: Salvamento de resultados em JSON

---

## 📝 Notas de Versão

### Versão 1.2.0
Esta versão introduz um sistema revolucionário de modos de simulação que resolve o problema fundamental de precisão vs. performance em backtests. Agora o sistema automaticamente escolhe o modo mais apropriado baseado no timeframe, garantindo máxima fidelidade para scalping e máxima eficiência para swing trading.

### Versão 1.1.0
Esta versão resolve o problema de divergência entre backtests e bot real através da implementação de modos de execução flexíveis. O modo `ON_CANDLE_CLOSE` garante 100% de fidelidade com os backtests, enquanto o modo `REALTIME` mantém a funcionalidade anterior para casos específicos.

### Versão 1.0.0
Versão inicial do sistema de backtesting, fornecendo uma base sólida para teste e otimização de estratégias de trading algorítmico. 
