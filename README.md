# BackBot - Bot de Trading para Backpack Exchange

Bot de trading automatizado para Backpack Exchange com estratégias para farm de volume e lucro.

## 🚀 Funcionalidades

- **Estratégia DEFAULT**: Foco em farm de volume com sinais baseados em RSI, Stochastic e MACD
- **Estratégia PRO_MAX**: Estratégia avançada baseada em ADX com múltiplas confluências
- **Sistema de Backtest**: Teste suas estratégias com dados históricos antes de usar em produção
- **Multi-Bot**: Execute múltiplas instâncias simultaneamente
- **Trailing Stop**: Proteção automática de lucros
- **Logs Coloridos**: Interface visual clara e informativa

## 📊 Sistema de Backtest e Otimização

O BackBot agora inclui um sistema completo de backtest e otimização que permite:

### ✅ Funcionalidades do Backtest

- **Teste de Estratégias**: Compare DEFAULT vs PRO_MAX
- **Dados Históricos**: Use dados reais da API ou sintéticos para teste
- **Métricas Avançadas**: Win rate, profit factor, Sharpe ratio, drawdown
- **Configuração Flexível**: Ajuste parâmetros de risco e performance
- **Relatórios Detalhados**: Salve resultados em JSON para análise posterior
- **Interface Interativa**: Menu CLI intuitivo para configuração

### 🎯 Sistema de Otimização

- **Otimização de Estratégias**: Teste diferentes parâmetros automaticamente
- **Otimização de Targets**: Encontre o melhor número de alvos para PRO_MAX
- **Otimização de Capital**: Descubra a porcentagem ideal de capital por trade
- **Análise Comparativa**: Compare múltiplas configurações simultaneamente
- **Recomendações Inteligentes**: Sugestões baseadas em retorno, risco e eficiência

### 🎯 Métricas Calculadas

- **Retorno Total e Anualizado**
- **Win Rate** (taxa de acerto)
- **Profit Factor** (ganhos vs perdas)
- **Máximo Drawdown**
- **Sharpe Ratio**
- **Máximo de Perdas Consecutivas**
- **Média de Ganhos e Perdas**

## 🛠️ Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd backbot

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas chaves da Backpack
```

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# Backpack API Keys
BACKPACK_API_KEY=your_api_key
BACKPACK_SECRET_KEY=your_secret_key
BACKPACK_PASSPHRASE=your_passphrase

# Configurações de Trading
TRADING_STRATEGY=DEFAULT  # ou PRO_MAX
INVESTMENT_PER_TRADE=100
MAX_CONCURRENT_TRADES=5
ACCOUNT2_CAPITAL_PERCENTAGE=20  # Porcentagem de capital por trade (10-80)

# Configurações da Estratégia PRO_MAX
ADX_LENGTH=14
ADX_THRESHOLD=20
ADX_AVERAGE_LENGTH=21
USE_RSI_VALIDATION=true
USE_STOCH_VALIDATION=true
USE_MACD_VALIDATION=true
IGNORE_BRONZE_SIGNALS=false
MAX_TARGETS_PER_ORDER=8  # Número de alvos por trade (3-20)
MAX_TAKE_PROFIT_ORDERS=8  # Limite de ordens de take profit

# Configurações de Risco
MIN_TAKE_PROFIT_PCT=0.5
ENABLE_STOP_LOSS=true
ENABLE_TAKE_PROFIT=true
MIN_PROFIT_PERCENTAGE=0.5  # Lucro mínimo para fechar trade (vs taxas)
```

## 🚀 Uso

### Executar Bot de Trading

```bash
# Menu interativo
npm run menu

# Estratégia DEFAULT
npm run start

# Estratégia PRO_MAX
npm run promax

# Produção (sem nodemon)
npm run prod
```

### Executar Backtest

```bash
# Menu interativo do backtest
npm run backtest

# Otimização de estratégias
npm run optimize

# Otimização de targets (PRO_MAX)
npm run optimize-targets

# Otimização de capital por trade
npm run optimize-capital

# Ou execute diretamente
node backtest.js
```

## 📊 Como Usar o Backtest e Otimização

### 1. Backtest Simples

1. Execute `npm run backtest`
2. Escolha "Executar Backtest Simples"
3. Configure:
   - **Estratégia**: DEFAULT ou PRO_MAX
   - **Símbolos**: Lista separada por vírgula (ex: BTC_USDC_PERP,ETH_USDC_PERP)
   - **Período**: Dias para testar (1-365)
   - **Intervalo**: Frequência dos candles (1m, 5m, 15m, 1h, 4h, 1d)
   - **Saldo Inicial**: Capital para simulação
   - **Investimento por Trade**: Valor por operação

### 2. Backtest Comparativo

1. Escolha "Executar Backtest Comparativo"
2. Configure parâmetros base
3. Compare automaticamente DEFAULT vs PRO_MAX

### 3. Otimização de Estratégias

1. Execute `npm run optimize`
2. Teste automaticamente diferentes parâmetros:
   - **ADX**: Comprimento e threshold
   - **Validações**: RSI, Stochastic, MACD
   - **Filtros**: Sinais Bronze, Silver, Gold, Platinum

### 4. Otimização de Targets (PRO_MAX)

1. Execute `npm run optimize-targets`
2. Teste diferentes números de alvos (3-20)
3. Encontre o equilíbrio ideal entre retorno e risco

### 5. Otimização de Capital

1. Execute `npm run optimize-capital`
2. Teste porcentagens de 10% a 80%
3. Descubra a eficiência ideal de capital

### 6. Configurações Avançadas

- **Parâmetros PRO_MAX**: ADX, validações RSI/Stochastic/MACD
- **Parâmetros de Risco**: Stop loss, take profit, drawdown máximo
- **Parâmetros de Performance**: Win rate mínimo, profit factor

## 📈 Estratégias

### DEFAULT Strategy
- **Objetivo**: Farm de volume
- **Sinais**: RSI, Stochastic, MACD
- **Filtros**: Tendência do BTC
- **Stop/Target**: Baseado em VWAP

### PRO_MAX Strategy
- **Objetivo**: Lucro com análise técnica avançada
- **Base**: ADX (Average Directional Index)
- **Confluências**: RSI, Stochastic, MACD
- **Níveis**: BRONZE, SILVER, GOLD, PLATINUM
- **Stop/Target**: Múltiplos alvos

## 📁 Estrutura do Projeto

```
backbot/
├── src/
│   ├── Backpack/           # Integração com Backpack Exchange
│   ├── Config/            # Configurações
│   ├── Controllers/       # Controladores
│   ├── Decision/          # Lógica de decisão
│   │   ├── Strategies/    # Estratégias de trading
│   │   └── Indicators.js  # Indicadores técnicos
│   ├── MultiBot/          # Sistema multi-bot
│   ├── TrailingStop/      # Trailing stop
│   ├── Utils/             # Utilitários
│   └── Backtest/          # Sistema de backtest
│       ├── BacktestEngine.js
│       ├── BacktestRunner.js
│       └── DataProvider.js
├── backtest.js            # Script principal do backtest
├── bootstrap.js           # Inicialização do bot
└── package.json
```

## 🔧 Desenvolvimento

### Adicionar Nova Estratégia

1. Crie nova classe em `src/Decision/Strategies/`
2. Estenda `BaseStrategy`
3. Implemente `analyzeTrade()` e `analyzeSignals()`
4. Adicione ao `StrategyFactory`

### Exemplo de Estratégia

```javascript
import { BaseStrategy } from './BaseStrategy.js';

export class MinhaEstrategia extends BaseStrategy {
  async analyzeTrade(fee, data, investmentUSD, media_rsi, config = null) {
    // Sua lógica aqui
    return {
      market: data.market.symbol,
      entry: price,
      stop: stopPrice,
      target: targetPrice,
      action: 'long', // ou 'short'
      pnl: calculatedPnl,
      risk: calculatedRisk
    };
  }
}
```

## 📊 Resultados do Backtest e Otimização

### Resultados do Backtest

Os resultados são salvos em `backtest_results/` com:

- **Métricas de Performance**: Win rate, profit factor, Sharpe ratio
- **Métricas de Risco**: Drawdown máximo, perdas consecutivas
- **Configuração Usada**: Parâmetros da estratégia e do backtest
- **Histórico de Trades**: Detalhes de cada operação

### Resultados da Otimização

Os otimizadores fornecem:

- **Comparação de Configurações**: Tabelas comparativas detalhadas
- **Rankings**: Top 3 por retorno, profit factor, eficiência e risco
- **Recomendações**: Sugestões baseadas em equilíbrio risco/retorno
- **Análise de Eficiência**: Métricas de uso de capital
- **Configurações Ideais**: Valores recomendados para .env

## ⚠️ Disclaimer

Este software é para fins educacionais. Trading de criptomoedas envolve riscos significativos. Use por sua conta e risco.

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📞 Suporte

- **Autor**: @heron_jr
- **Issues**: Use o GitHub Issues para reportar bugs
- **Discord**: [Link do servidor]

---

**BackBot** - Trading automatizado inteligente para Backpack Exchange 🚀