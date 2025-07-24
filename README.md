# BackBot - Bot de Trading Inteligente para Backpack Exchange

Bot de trading automatizado avançado para Backpack Exchange com estratégia inteligente baseada em múltiplos indicadores técnicos e filtros de confirmação.

## 🚀 Funcionalidades

- **Estratégia DEFAULT**: Sistema inteligente com 8 camadas de validação
- **Estratégia PRO_MAX**: Em breve - Estratégia avançada baseada em ADX
- **Sistema de Backtest**: Teste suas estratégias com dados históricos
- **Multi-Bot**: Execute múltiplas instâncias simultaneamente
- **Trailing Stop**: Proteção automática de lucros
- **Logs Coloridos**: Interface visual clara e informativa

## 📊 Sistema de Backtest

O BackBot inclui um sistema de backtest para validar a estratégia DEFAULT com dados históricos reais da API.

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
TRADING_STRATEGY=DEFAULT
INVESTMENT_PER_TRADE=100
MAX_CONCURRENT_TRADES=5
ACCOUNT2_CAPITAL_PERCENTAGE=20  # Porcentagem de capital por trade (10-80)

# Configurações da Estratégia DEFAULT
# O bot usa configurações inteligentes baseadas em múltiplos indicadores
# Não é necessário configurar parâmetros específicos - o sistema é automático

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

# Produção (sem nodemon)
npm run prod
```

### Executar Backtest

```bash
# Menu interativo do backtest
npm run backtest

# Ou execute diretamente
node backtest.js
```

## 📊 Como Usar o Backtest

### Backtest Simples

1. Execute `npm run backtest`
2. Escolha "Executar Backtest Simples"
3. Configure:
   - **Símbolos**: Lista separada por vírgula (ex: BTC_USDC_PERP,ETH_USDC_PERP)
   - **Período**: Dias para testar (1-365)
   - **Intervalo**: Frequência dos candles (1m, 5m, 15m, 1h, 4h, 1d)
   - **Saldo Inicial**: Capital para simulação
   - **Investimento por Trade**: Valor por operação

## 📈 Estratégias

### DEFAULT Strategy - Sistema Inteligente de 8 Camadas
- **Objetivo**: Trading inteligente com múltiplas validações
- **Camada 1**: Momentum (RSI Avançado) - Cruzamentos GREEN/RED + Sobrevenda/Sobrecompra
- **Camada 2**: Stochastic - Cruzamentos K/D em zonas extremas
- **Camada 3**: MACD - Momentum e tendência (histograma + cruzamentos)
- **Camada 4**: ADX - Força e direção da tendência
- **Camada 5**: Money Flow - Filtro de confirmação (MFI > 50 para LONG, < 50 para SHORT)
- **Camada 6**: VWAP - Filtro de tendência intradiária (Preço > VWAP para LONG, < VWAP para SHORT)
- **Camada 7**: BTC Trend - Filtro macro de correlação com Bitcoin
- **Camada 8**: Stop/Target - Cálculo inteligente baseado em VWAP + StdDev

### PRO_MAX Strategy - Em Breve
- **Status**: Em desenvolvimento
- **Objetivo**: Estratégia avançada baseada em ADX com múltiplas confluências
- **Base**: ADX (Average Directional Index) com níveis BRONZE, SILVER, GOLD, PLATINUM
- **Nota**: Esta estratégia ainda não está completa e não deve ser usada em produção

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

## 📊 Resultados do Backtest

Os resultados são salvos em `backtest_results/` com:

- **Métricas de Performance**: Win rate, profit factor, Sharpe ratio
- **Métricas de Risco**: Drawdown máximo, perdas consecutivas
- **Configuração Usada**: Parâmetros da estratégia e do backtest
- **Histórico de Trades**: Detalhes de cada operação

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