# BackBot

A crypto trading bot for Backpack Exchange. It trades perpetual futures automatically using custom strategies and real-time market data.

## 🚀 Features

- **Multiple Trading Strategies**: Support for DEFAULT and LEVEL strategies
- **Flexible Capital Management**: Use fixed amounts or percentage of available capital
- **Real-time Market Analysis**: Technical indicators including RSI, EMA, MACD, Bollinger Bands, VWAP, ATR, Stochastic, and ADX
- **Risk Management**: Automatic stop-loss and trailing stop functionality
- **Modular Architecture**: Easy to add new strategies and indicators

## 📋 Requirements

- Node.js 18+
- Backpack Exchange API credentials
- Technical analysis knowledge

## ⚙️ Configuration

Copy `env.example` to `.env` and configure your settings:

```bash
# Copy example configuration
cp env.example .env

# Edit with your settings
nano .env
```

### Key Configuration Options

#### Trading Strategy
```bash
TRADING_STRATEGY=DEFAULT  # or LEVEL
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
MAX_NEGATIVE_PNL_STOP=-5        # Stop loss in USD
MINIMAL_VOLUME=50               # Min volume to maintain position
```

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

