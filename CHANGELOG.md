# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 🚧 Em Desenvolvimento
- Estratégia PRO_MAX (em breve)
- Otimizador de parâmetros
- Backtest avançado
- Interface web de monitoramento

---

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