# BackBot

A crypto trading bot for Backpack Exchange. It trades perpetual futures automatically using custom strategies and real-time market data.

## 🚀 Features

- **Multiple Trading Strategies**: Support for DEFAULT and LEVEL strategies
- **Modular Stop Loss System**: Each strategy can have its own stop loss logic
- **Flexible Capital Management**: Use fixed amounts or percentage of available capital
- **Real-time Market Analysis**: Technical indicators including RSI, EMA, MACD, Bollinger Bands, VWAP, ATR, Stochastic, and ADX
- **Risk Management**: Automatic stop-loss and trailing stop functionality
- **Modular Architecture**: Easy to add new strategies and indicators
- **LEVEL Strategy**: Advanced ADX-based strategy with signal quality levels (BRONZE, SILVER, GOLD, DIAMOND)

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

### Key Configuration Options

#### Trading Strategy
```bash
TRADING_STRATEGY=DEFAULT  # or LEVEL

# LEVEL Strategy Configuration
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
MINIMAL_VOLUME=50               # Min volume to maintain position

# Take Profit Minimum Settings
MIN_TAKE_PROFIT_USD=0.5         # Minimum take profit in USD
MIN_TAKE_PROFIT_PCT=0.5         # Minimum take profit in percentage
MIN_RISK_REWARD_RATIO=1.5       # Minimum risk/reward ratio
ENABLE_TP_VALIDATION=false      # Enable real-time take profit validation
```

**Note**: Stop loss logic is automatically selected based on your trading strategy. Each strategy can implement its own stop loss rules.

**Take Profit Validation**: The bot will only execute trades that meet minimum take profit criteria (percentage and risk/reward ratio).

**Real-time Take Profit Validation**: When enabled (`ENABLE_TP_VALIDATION=true`), the bot will close positions that no longer meet minimum take profit criteria, ensuring only high-quality trades remain open.

## 🎯 LEVEL Strategy (ADX-based)

The LEVEL strategy is based on the ADX indicator with multiple validation layers and signal quality levels.

### Signal Quality Levels

- **BRONZE**: 1 confluence (ADX only)
- **SILVER**: 2 confluences (ADX + 1 validation)
- **GOLD**: 3 confluences (ADX + 2 validations)
- **DIAMOND**: 4 confluences (ADX + 3 validations)

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

## 📚 Documentation

- [Strategy Documentation](docs/strategies.md)
- [Capital Management](docs/capital-management.md)
- [Project Context](docs/context.md)

## ⚠️ Disclaimer

Use at your own risk – bugs may exist, and the logic won't always yield profits. But if you know what you're doing, it might save you some time.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

