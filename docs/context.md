# Documento de Contexto – BackBot

---

### 1. Contexto e Visão Geral

* **Situação Atual:** O BackBot é um sistema automatizado de trading de criptomoedas desenvolvido em Node.js/ESM que opera na exchange Backpack Exchange. O bot utiliza estratégias baseadas em indicadores técnicos para executar operações de futures perpétuos de forma automatizada, visando farmar volume para airdrops e gerar lucros através de operações rápidas.
* **Motivação:** O projeto foi desenvolvido para automatizar operações de trading na Backpack Exchange, aproveitando oportunidades de mercado através de análise técnica em tempo real. O objetivo é maximizar o volume negociado para qualificar para airdrops da exchange, enquanto tenta reduzir perdas e potencialmente gerar lucros que cubram as taxas de transação.
* **Objetivo Geral:** O objetivo deste projeto é implementar um sistema de trading automatizado que execute estratégias baseadas em indicadores técnicos (RSI, EMA, MACD, Bollinger Bands, VWAP) para identificar oportunidades de entrada e saída em mercados de futures perpétuos, com foco em operações rápidas e gerenciamento de risco.

### 2. O Problema

* **Descrição do Problema:** Trading manual de criptomoedas é altamente trabalhoso e requer monitoramento constante. Operações manuais podem perder oportunidades de mercado devido à latência humana e emocionalidade. Além disso, para qualificar para airdrops da Backpack Exchange, é necessário manter volume significativo de trading, o que é difícil de alcançar manualmente. O sistema atual enfrenta desafios de timing de execução, gerenciamento de risco e otimização de estratégias para diferentes condições de mercado.

### 3. Objetivos e Resultados Esperados

* **Objetivos:** 
  * Automatizar a identificação de oportunidades de trading usando múltiplos indicadores técnicos
  * Executar operações de forma rápida e precisa na Backpack Exchange
  * Implementar sistema de stop-loss e take-profit para gerenciar risco
  * Manter volume de trading consistente para qualificar para airdrops
  * Otimizar estratégias para diferentes condições de mercado
  * Monitorar performance e PnL em tempo real
* **Resultados Esperados:** 
  * Redução significativa do tempo necessário para monitorar mercados
  * Execução consistente de estratégias sem interferência emocional
  * Qualificação para airdrops através de volume automatizado
  * Potencial geração de lucros que cubram taxas de transação
  * Sistema resiliente que opera 24/7 com gerenciamento de risco

### 4. Escopo e Principais Funcionalidades

#### Incluído no Escopo:
* **Análise Técnica Automatizada:** Cálculo de indicadores técnicos (RSI, EMA, MACD, Bollinger Bands, VWAP) em tempo real
* **Sistema de Decisão:** Algoritmo que combina múltiplos indicadores para identificar sinais de entrada
* **Execução de Ordens:** Integração com API da Backpack Exchange para execução automática de ordens
* **Gerenciamento de Risco:** Sistema de stop-loss e trailing stop para proteger capital
* **Monitoramento de Performance:** Tracking de PnL e volume negociado
* **Controle de Posições:** Gestão automática de posições abertas e limites de exposição
* **Configuração Flexível:** Sistema de variáveis de ambiente para ajuste de parâmetros

#### Fora do Escopo Inicial:
* Interface gráfica de administração
* Suporte a múltiplas exchanges simultâneas
* Machine learning avançado para otimização de estratégias
* Sistema de notificações push
* Backtesting histórico de estratégias
* Integração com redes sociais para sinais

### 5. Arquitetura ou Abordagem Técnica

* A arquitetura é baseada em um sistema modular escrito em Node.js/ESM, com foco em separação de responsabilidades. O sistema inclui:
  * **Camada de Decisão:** Módulo que analisa dados de mercado e toma decisões de trading
  * **Camada de Execução:** Controllers que gerenciam ordens e posições
  * **Camada de Integração:** Módulos que se comunicam com a API da Backpack Exchange
  * **Camada de Monitoramento:** Sistema de trailing stop e controle de PnL
  * **Camada de Configuração:** Sistema de variáveis de ambiente para parametrização

O design segue princípios de Clean Architecture, com separação clara entre lógica de negócio, acesso a dados e integração externa. O sistema é resiliente a falhas de rede e inclui mecanismos de retry e fallback.

### 6. Dependências, Restrições e Riscos

#### Dependências:
* **Backpack Exchange API:** Para execução de ordens e obtenção de dados de mercado
* **Node.js 18+:** Para execução do runtime JavaScript
* **Bibliotecas Técnicas:** technicalindicators para cálculos de indicadores
* **Sistema de Autenticação:** tweetnacl para assinatura de requisições
* **Persistência:** sqlite3 para armazenamento local de dados
* **Agendamento:** cron para execução de tarefas programadas

#### Restrições:
* **Compatibilidade com API:** Necessidade de manter compatibilidade com mudanças na API da Backpack Exchange
* **Limites de Rate Limiting:** Respeito aos limites de requisições da exchange
* **Precisão de Indicadores:** Dependência da qualidade dos dados de mercado para acurácia das decisões
* **Liquidez de Mercado:** Operações limitadas pela liquidez disponível nos pares negociados

#### Riscos:
* **Falhas de API:** Problemas na comunicação com Backpack Exchange podem resultar em perda de oportunidades ou execução incorreta de ordens
* **Volatilidade de Mercado:** Condições extremas de mercado podem invalidar estratégias baseadas em indicadores técnicos
* **Configuração Incorreta:** Parâmetros mal configurados podem resultar em perdas significativas
* **Dependência de Indicadores:** Estratégias baseadas em indicadores técnicos podem falhar em mercados laterais ou com baixa liquidez
* **Risco de Liquidação:** Operações com alavancagem podem resultar em liquidação em movimentos adversos do mercado 