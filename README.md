# BackBot

A crypto trading bot for Backpack Exchange. It trades perpetual futures automatically using custom strategies and real-time market data.

## 🚀 Features

- **Multiple Trading Strategies**: Support for DEFAULT and PRO_MAX strategies
- **Multi-Account Support**: Run multiple accounts with different strategies simultaneously
- **Modular Stop Loss System**: Each strategy can have its own stop loss logic
- **Flexible Capital Management**: Use fixed amounts or percentage of available capital
- **Real-time Market Analysis**: Technical indicators including RSI, EMA, MACD, Bollinger Bands, VWAP, ATR, Stochastic, and ADX
- **Risk Management**: Automatic stop-loss and trailing stop functionality
- **Modular Architecture**: Easy to add new strategies and indicators
- **PRO_MAX Strategy**: Advanced ADX-based strategy with signal quality levels (BRONZE, SILVER, GOLD, DIAMOND)
- **Colored Logs**: Separate colored logs for each account/strategy for easy identification
- **Interactive Menus**: User-friendly interface for strategy and account selection
- **Loading Progress Bar**: Visual feedback during analysis cycles

## 📋 Requirements

- Node.js 18+
- Backpack Exchange API credentials
- Technical analysis knowledge

## ⚙️ Configuration

Copy `env.example` to `.env` and configure your settings:

```bash
# Copy example configuration
cp env.example .env
```

### 🔧 Configuration Modes

The bot supports two modes:

#### 1. Single Account Mode (Default)
Use the traditional configuration with one account:

```bash
# Single account configuration
API_KEY=<your_api_key>
API_SECRET=<your_api_secret>
TRADING_STRATEGY=DEFAULT
VOLUME_ORDER=100
CAPITAL_PERCENTAGE=40
```

#### 2. Multi-Account Mode (New)
Configure multiple accounts with different strategies:

```bash
# Account 1 - DEFAULT Strategy
ACCOUNT1_API_KEY=<api_key_1>
ACCOUNT1_API_SECRET=<api_secret_1>
ACCOUNT1_STRATEGY=DEFAULT
ACCOUNT1_VOLUME_ORDER=100
ACCOUNT1_CAPITAL_PERCENTAGE=40

# Account 2 - PRO_MAX Strategy
ACCOUNT2_API_KEY=<api_key_2>
ACCOUNT2_API_SECRET=<api_secret_2>
ACCOUNT2_STRATEGY=PRO_MAX
ACCOUNT2_VOLUME_ORDER=50
ACCOUNT2_CAPITAL_PERCENTAGE=30
ACCOUNT2_TIME=15m
```

### Key Configuration Options

#### Trading Strategy
```bash
TRADING_STRATEGY=DEFAULT  # or PRO_MAX

# PRO_MAX Strategy Configuration
IGNORE_BRONZE_SIGNALS=true  # Ignore BRONZE signals (only SILVER, GOLD, DIAMOND)
ADX_LENGTH=14              # ADX period
ADX_THRESHOLD=20           # ADX threshold for volume confirmation
ATR_ZONE_MULTIPLIER=2.0    # ATR multiplier for target zones
```

#### Capital Management
```bash
# Fixed amount per trade
VOLUME_ORDER=100

# Or percentage of available capital
CAPITAL_PERCENTAGE=5  # 5% of available capital
```

#### Risk Management
```bash
LIMIT_ORDER=5                    # Max open orders
STOP_LOSS_TYPE=USD              # USD or PERCENTAGE (for DEFAULT strategy)
MAX_NEGATIVE_PNL_STOP=-5        # Stop loss in USD (when STOP_LOSS_TYPE=USD)
MAX_NEGATIVE_PNL_STOP_PCT=-4    # Stop loss in percentage (when STOP_LOSS_TYPE=PERCENTAGE)
MINIMAL_VOLUME=50               # Min volume to maintain position (DEFAULT strategy only)

# Take Profit Minimum Settings
MIN_TAKE_PROFIT_PCT=0.5         # Minimum take profit in percentage
ENABLE_TP_VALIDATION=false      # Enable real-time take profit monitoring
TP_PARTIAL_PERCENTAGE=50        # Percentage of position to take partial profit
```

## 🤖 Multi-Account System

### Overview
The multi-account system allows you to run multiple trading bots simultaneously, each with its own:
- API credentials
- Trading strategy
- Capital management settings
- Timeframe
- Risk parameters

### Benefits
- **Parallel Execution**: Multiple strategies running simultaneously
- **Risk Diversification**: Different capital allocation per account
- **Strategy Testing**: Compare different strategies in real-time
- **Colored Logs**: Easy identification of which account is performing each action

### Configuration Example

```bash
# ========================================
# CONTA 1 - DEFAULT Strategy (High Volume)
# ========================================
ACCOUNT1_API_KEY=<api_key_1>
ACCOUNT1_API_SECRET=<api_secret_1>
ACCOUNT1_NAME="Conta Principal"
ACCOUNT1_STRATEGY=DEFAULT
ACCOUNT1_ENABLED=true
ACCOUNT1_VOLUME_ORDER=100
ACCOUNT1_CAPITAL_PERCENTAGE=40
ACCOUNT1_TIME=5m

# ========================================
# CONTA 2 - PRO_MAX Strategy (High Quality)
# ========================================
ACCOUNT2_API_KEY=<api_key_2>
ACCOUNT2_API_SECRET=<api_secret_2>
ACCOUNT2_NAME="Conta Pro"
ACCOUNT2_STRATEGY=PRO_MAX
ACCOUNT2_ENABLED=true
ACCOUNT2_VOLUME_ORDER=50
ACCOUNT2_CAPITAL_PERCENTAGE=30
ACCOUNT2_TIME=15m
ACCOUNT2_IGNORE_BRONZE_SIGNALS=true
```

### Logs Example

With multi-account mode, you'll see colored logs for each account:

```
🤖 [CONTA1-DEFAULT] 🔍 Analyzing BTC_USDC_PERP
🤖 [CONTA1-DEFAULT] 💰 Usando 40% do capital: $6.65
🤖 [CONTA1-DEFAULT] ✅ BTC_USDC_PERP: Executada

🤖 [CONTA2-PRO_MAX] 🔍 Analyzing SOL_USDC_PERP
🤖 [CONTA2-PRO_MAX] 🎯 SOL_USDC_PERP (🥇 GOLD): LONG - Confluências: 3/4
🤖 [CONTA2-PRO_MAX] ✅ SOL_USDC_PERP (GOLD): Executada
```

### Account-Specific Settings

Each account can have its own configuration:

| Setting | Description | Example |
|---------|-------------|---------|
| `ACCOUNT1_STRATEGY` | Trading strategy | `DEFAULT` or `PRO_MAX` |
| `ACCOUNT1_VOLUME_ORDER` | Fixed volume per trade | `100` |
| `ACCOUNT1_CAPITAL_PERCENTAGE` | % of capital per trade | `40` |
| `ACCOUNT1_TIME` | Timeframe | `5m`, `15m`, `1h` |
| `ACCOUNT1_IGNORE_BRONZE_SIGNALS` | PRO_MAX specific | `true` |

## 🎯 PRO_MAX Strategy (ADX-based)

The PRO_MAX strategy is based on the ADX indicator with multiple validation layers and signal quality levels.

### Signal Quality Levels

- **🥉 BRONZE**: 1 confluence (ADX only)
- **🥈 SILVER**: 2 confluences (ADX + 1 indicator)
- **🥇 GOLD**: 3 confluences (ADX + 2 indicators)
- **💎 DIAMOND**: 4 confluences (ADX + all 3 indicators)

### Logs da Estratégia PRO_MAX

O bot agora mostra claramente o nível de cada sinal:

```
✅ [PRO_MAX] SOL_USDC_PERP (🥉 BRONZE): LONG - Confluências: 1/4 - Targets: 5 - PnL $0.15
✅ [PRO_MAX] BTC_USDC_PERP (🥈 SILVER): SHORT - Confluências: 2/4 - Targets: 3 - PnL $2.50
✅ [PRO_MAX] ETH_USDC_PERP (🥇 GOLD): LONG - Confluências: 3/4 - Targets: 4 - PnL $1.20
✅ [PRO_MAX] ADA_USDC_PERP (💎 DIAMOND): SHORT - Confluências: 4/4 - Targets: 6 - PnL $0.80
```

**Logs de Sinais Ignorados:**
```
⚠️ [PRO_MAX] DOGE_USDC_PERP (🥉 BRONZE): Sinal LONG ignorado - IGNORE_BRONZE_SIGNALS=true
```

**Logs de Execução:**
```
✅ kPEPE_USDC_PERP (🥉 BRONZE): Executada
❌ BTC_USDC_PERP (🥈 SILVER): Falhou
```

### Validation Indicators

- **RSI**: Reversal confirmation
- **Stochastic**: Momentum validation
- **MACD**: Trend confirmation

### Configuration Options

```bash
# Signal Filtering
IGNORE_BRONZE_SIGNALS=true  # Only accept SILVER, GOLD, DIAMOND

# ADX Settings
ADX_LENGTH=14
ADX_THRESHOLD=20
ADX_AVERAGE_LENGTH=21

# Validation Settings
USE_RSI_VALIDATION=true
USE_STOCH_VALIDATION=true
USE_MACD_VALIDATION=true

# Target Zones
MAX_TARGETS_PER_ORDER=20  # Quantidade de alvos calculados e executados
# ATR_ZONE_MULTIPLIER=2.0 (fixo no código)
# ATR_PERIOD=14 (fixo no código)

# Stop Loss (fixo no código)
# SL_ATR_MULTIPLIER=1.5

# Partial Take Profit
USE_PARTIAL_TP=true
```

### Timeframe Multipliers

The strategy automatically adjusts target distances based on timeframe:

- **1m, 3m**: Closer targets (0.5x, 0.7x multiplier)
- **5m**: Base multiplier (1.0x)
- **15m, 30m**: Medium targets (1.2x, 1.5x multiplier)
- **1h, 2h, 4h, 1d**: Distant targets (2.0x, 2.5x, 3.0x, 4.0x multiplier)

## 🏃‍♂️ Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your API credentials and preferences
   ```

3. **Run the bot:**
   ```bash
   npm start
   ```

### 🎯 Interactive Menus

When you start the bot, you'll see interactive menus for configuration:

#### Mode Selection Menu
```
🤖 BACKBOT - Seleção de Modo
=====================================

📋 Modos Disponíveis:

1️⃣  CONTA ÚNICA
   🔧 Configuração tradicional
   📊 Uma estratégia por vez
   💡 Ideal para iniciantes

2️⃣  MÚLTIPLAS CONTAS
   🚀 Execução paralela
   📈 Múltiplas estratégias
   💡 Ideal para traders avançados

3️⃣  Sair

Escolha o modo (1-3):
```

#### Strategy Selection Menu
```
🤖 BACKBOT - Seleção de Estratégia
=====================================

📋 Estratégias Disponíveis:

1️⃣  DEFAULT
   📊 Foco: Volume na corretora
   🎯 Objetivo: Maximizar número de operações
   💡 Características:
      • Sinais mais frequentes
      • Stop loss dinâmico
      • Take profit único
      • Ideal para corretoras que pagam por volume

2️⃣  PRO_MAX
   📈 Foco: Lucro e qualidade de sinais
   🎯 Objetivo: Maximizar retorno por operação
   💡 Características:
      • Sinais filtrados por qualidade (BRONZE/SILVER/GOLD/DIAMOND)
      • Múltiplos take profits
      • Stop loss baseado em ATR
      • Ideal para traders que buscam lucro consistente

3️⃣  Sair

Escolha sua estratégia (1-3):
```

#### Account Selection Menu (Multi-Bot Mode)
```
🤖 BACKBOT - Seleção de Contas
=====================================

📋 Contas Configuradas:

1️⃣  Conta Principal (DEFAULT)
   📊 Estratégia: DEFAULT
   💰 Volume: $100 (40% do capital)
   ⏰ Timeframe: 5m

2️⃣  Conta Pro (PRO_MAX)
   📈 Estratégia: PRO_MAX
   💰 Volume: $50 (30% do capital)
   ⏰ Timeframe: 15m

3️⃣  Executar Todas as Contas
4️⃣  Sair

Escolha a conta (1-4):
```

#### Command Line Options

**Simple Start (Recommended for beginners):**
```bash
npm start
```
- Always shows interactive menus
- Perfect for new users

**Skip Menus (Advanced users):**
```bash
# Development mode
npm run start:skip

# Production mode  
npm run prod:skip

# Direct node command
node app.js -- --skip-selection
```

**Auto-start with configured strategy:**
- Set `TRADING_STRATEGY=DEFAULT` or `TRADING_STRATEGY=PRO_MAX` in your `.env` file
- Then use `npm run start:skip` or `npm run prod:skip`

## 📊 Bot Status Display

The bot shows real-time status information:

### Single Account Mode
```
🤖 BACKBOT - Status
=====================================
📊 Estratégia: DEFAULT
💰 Capital: $16.62
📈 Ordens Abertas: 2
⏰ Próxima Análise: 00:45
```

### Multi-Account Mode
```
🤖 BACKBOT - Status Multi-Contas
=====================================
📊 Conta Principal (DEFAULT):
   💰 Capital: $16.62 | 📈 Ordens: 2 | ⏰ 00:45

📈 Conta Pro (PRO_MAX):
   💰 Capital: $8.31 | 📈 Ordens: 1 | ⏰ 00:30

⏰ Próxima Análise Geral: 00:45
```

## 🔄 Loading Progress Bar

During analysis cycles, the bot shows a loading progress bar:

```
🔄 Analisando mercados... [████████████████████] 100%
```

The progress bar:
- Updates in real-time during analysis
- Prevents log overlap with other messages
- Provides visual feedback during idle periods

## 📚 Documentation

- [Available Commands](COMMANDS.md) - Complete list of npm scripts and commands
- [Strategy Documentation](docs/strategies.md)
- [Capital Management](docs/capital-management.md)
- [Project Context](docs/context.md)

## ⚠️ Important Notes

**Stop Loss Logic**: Stop loss logic is automatically selected based on your trading strategy. Each strategy can implement its own stop loss rules.

**PRO_MAX Strategy**: The `PRO_MAX` strategy uses the calculated stop loss (based on ATR) that is sent to the exchange, rather than a dynamic stop loss that adjusts continuously. This ensures consistency with the original strategy calculation.

**Take Profit Management**: The `PRO_MAX` strategy uses a monitoring system that detects when entry orders are executed and then creates the corresponding take profit orders. This ensures that take profits are only created after the position is actually opened, avoiding premature order creation.

**Fast Monitoring**: The monitoring system runs every 5 seconds to ensure take profits are created immediately after entry orders are executed, providing faster response times compared to the main analysis cycle (1 minute).

**Take Profit Monitoring**: When enabled (`ENABLE_TP_VALIDATION=true`), the bot monitors open positions and automatically takes partial profits when minimum criteria are met:

- **Minimum Take Profit**: Position must reach minimum percentage gain
- **Partial Profit**: Takes configured percentage of position (default: 50%)
- **Risk Reduction**: Secures profits while keeping remaining position open

This feature helps secure profits early while allowing positions to continue running for additional gains.

## ⚠️ Disclaimer

Use at your own risk – bugs may exist, and the logic won't always yield profits. But if you know what you're doing, it might save you some time.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

