# 📋 Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
  - CYPHERPUNK: Sistema AMBIENT + ACTION

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

<<<<<<< Updated upstream
## [1.0.0] - 2024-12-23

### 🚀 Novas Funcionalidades
- **Execução Híbrida de Ordens**: Implementação de sistema inteligente de execução que sempre tenta ordem LIMIT (post-only) primeiro, com fallback automático para MARKET se necessário
- **Monitoramento de Slippage**: Validação dinâmica de slippage antes de executar ordens a mercado como fallback
- **Timeout Configurável**: Sistema de timeout para ordens LIMIT não executadas (configurável via `ORDER_EXECUTION_TIMEOUT_SECONDS`)
- **Revalidação de Sinais**: Revalidação automática de sinais antes de executar fallback para mercado
- **Estatísticas de Fallback**: Monitoramento da eficiência do sistema híbrido com logs detalhados
- **Validação de Tipo de Ordem**: Suporte para `POSITION_ORDER_TYPE` (limit/market) com validação de entrada

### 🔧 Melhorias
- **Refatoração do OrderController**: Migração para métodos estáticos para melhor organização e performance
- **Logs Aprimorados**: Logs mais detalhados em todas as etapas do processo de execução
- **Filtros de Ordens Melhorados**: Melhor identificação de ordens de entrada vs. ordens de saída
- **Tratamento de Erros**: Melhor tratamento de erros em todas as operações de ordem

### 🐛 Correções
- **Correção de Imports**: Resolução de problemas de import/export em módulos ES6
- **Correção de IDs de Ordem**: Uso correto de IDs de ordem para cancelamento
- **Correção de Métodos Estáticos**: Conversão de métodos de instância para estáticos onde necessário

### ⚙️ Configurações
- `ORDER_EXECUTION_TIMEOUT_SECONDS`: Timeout para execução de ordens LIMIT (padrão: 12s)
- `MAX_SLIPPAGE_PCT`: Slippage máximo permitido para fallback (padrão: 0.2%)
- `POSITION_ORDER_TYPE`: Tipo de ordem para posições (limit/market)

---

## [Beta] - 2024-12-23

### 🎯 Estratégia DEFAULT Completa
- **Sistema de 8 Camadas de Validação**:
  1. **Validação de Dados**: Verificação de dados mínimos necessários
  2. **Análise de Sinais**: RSI, Stochastic, MACD, ADX
  3. **Filtro de Confirmação**: Money Flow Index (MFI) para validação de convicção
  4. **Filtro de Tendência**: VWAP para análise de tendência intradiária
  5. **Filtro Macro**: Correlação com tendência do BTC
  6. **Cálculo de Stop/Target**: Baseado em VWAP e desvios padrão
  7. **Validações de Risco**: Verificações de PnL e stop loss
  8. **Execução Inteligente**: Sistema híbrido de execução

### 📊 Indicadores Técnicos
- **RSI (Relative Strength Index)**: Análise de sobrecompra/sobrevenda
- **Stochastic Oscillator**: Sinais de reversão com cruzamentos
- **MACD**: Análise de momentum e tendência
- **ADX (Average Directional Index)**: Força e direção da tendência
- **Money Flow Index (MFI)**: Confirmação baseada em volume
- **VWAP (Volume Weighted Average Price)**: Filtro de tendência intradiária
- **Momentum Indicator**: Análise primária de sinais

### 🛡️ Gestão de Risco
- **Stop Loss Dinâmico**: Baseado em `MAX_NEGATIVE_PNL_STOP_PCT`
- **Take Profit Configurável**: Múltiplos níveis de take profit
- **Trailing Stop**: Ajuste automático de stop loss
- **Validação de PnL**: Verificações de lucro mínimo e configurado
- **Monitoramento de Posições**: Verificação contínua de posições abertas

### ⏰ Monitoramento de Ordens
- **Cancelamento Automático**: Ordens pendentes canceladas após timeout configurável
- **Proteção de Ordens**: Ordens `reduceOnly` não são canceladas automaticamente
- **Monitoramento Contínuo**: Verificação periódica de ordens pendentes

### 🔄 Sistema de Backtest
- **Suporte a Leverage**: Simulação de operações com alavancagem
- **Position Sizing por Percentual**: Cálculo de tamanho de posição baseado em percentual
- **Validação de Lógica**: Testes da lógica de monitoramento de ordens

### 📝 Documentação
- **README Atualizado**: Foco na estratégia DEFAULT com explicações detalhadas
- **Configuração Simplificada**: Arquivo `.env` pré-configurado
- **Guia de Uso**: Instruções claras para configuração e execução

### ⚙️ Configurações Principais
- `MAX_NEGATIVE_PNL_STOP_PCT`: Stop loss baseado em percentual de PnL
- `ORDER_TIMEOUT_MINUTES`: Timeout para cancelamento de ordens pendentes
- `STRATEGY`: Seleção de estratégia (DEFAULT/PRO_MAX)
- Configurações de indicadores técnicos (períodos, thresholds)
- Configurações de stop loss e take profit 
=======
## 📝 Notas de Versão

### Versão 1.2.0
Esta versão introduz um sistema revolucionário de modos de simulação que resolve o problema fundamental de precisão vs. performance em backtests. Agora o sistema automaticamente escolhe o modo mais apropriado baseado no timeframe, garantindo máxima fidelidade para scalping e máxima eficiência para swing trading.

### Versão 1.1.0
Esta versão resolve o problema de divergência entre backtests e bot real através da implementação de modos de execução flexíveis. O modo `ON_CANDLE_CLOSE` garante 100% de fidelidade com os backtests, enquanto o modo `REALTIME` mantém a funcionalidade anterior para casos específicos.

### Versão 1.0.0
Versão inicial do sistema de backtesting, fornecendo uma base sólida para teste e otimização de estratégias de trading algorítmico. 
>>>>>>> Stashed changes
