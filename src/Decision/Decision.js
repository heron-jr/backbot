import Futures from '../Backpack/Authenticated/Futures.js';
import Order from '../Backpack/Authenticated/Order.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Markets from '../Backpack/Public/Markets.js';
import { calculateIndicators } from './Indicators.js';
import { StrategyFactory } from './Strategies/StrategyFactory.js';

const STRATEGY_DEFAULT = 'DEFAULT';

class Decision {
  constructor() {
    const strategyType = process.env.TRADING_STRATEGY || STRATEGY_DEFAULT;
    this.strategy = StrategyFactory.createStrategy(strategyType);
    
    console.log(`🤖 Estratégia carregada: ${strategyType.toUpperCase()}`);
  }

  async getDataset(Account, closed_markets) {
    const dataset = []

    const markets = Account.markets.filter((el) => {
      return !closed_markets.includes(el.symbol) 
    })

    try {
    
        for (const market of markets) {
            const getAllMarkPrices = await Markets.getAllMarkPrices(market.symbol)
            const candles = await Markets.getKLines(market.symbol, process.env.TIME, 30)
            const analyze = calculateIndicators(candles)
            const marketPrice = getAllMarkPrices[0].markPrice

            console.log("🔍 Analyzing", String(market.symbol).replace("_USDC_PERP", ""))

            const obj = {
              candles,
              market,
              marketPrice,
              ...analyze
            }

            dataset.push(obj)
        }

        } catch (error) {
          console.log(error)
    }

    return dataset
  }


  analyzeTrades(fee, datasets, investmentUSD, media_rsi) {
    const results = [];
    for (const data of datasets) {
      const row = this.strategy.analyzeTrade(fee, data, investmentUSD, media_rsi)
      if(row){
        results.push(row)
      }
    }
    return results.sort((a,b) => b.pnl - a.pnl)
  }

  analyzeMarket(candles, marketPrice, market) {
  const parsed = candles.map(c => ({
    open: parseFloat(c.open),
    close: parseFloat(c.close),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    volume: parseFloat(c.volume),
    quoteVolume: parseFloat(c.quoteVolume),
    trades: parseInt(c.trades),
    start: c.start,
    end: c.end
  }));

  const valid = parsed.filter(c => c.volume > 0);
  const volume = valid.reduce((acc, c) => acc + c.volume, 0);

  const last = valid[valid.length - 1] || parsed[parsed.length - 1];

  const entry = last.close;

  const action = marketPrice >= entry ?  'LONG' : 'SHORT'  ;

  return {
    action: action,
    entry: entry,
    marketPrice: marketPrice,
    volume: volume,
    market: market
  };
  }

  analyzeMAEMACross(candles, marketPrice, period = 25) {

  const closes = candles.map(c => parseFloat(c.close));
  const ma = [];
  const ema = [];
  const k = 2 / (period + 1);

  // Cálculo da MA
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 >= period) {
      const sum = closes.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    } else {
      ma.push(null);
    }
  }

  // Cálculo da EMA
  for (let i = 0; i < closes.length; i++) {
    if (i === period - 1) {
      ema.push(ma[i]);
    } else if (i >= period) {
      ema.push(closes[i] * k + ema[i - 1] * (1 - k));
    } else {
      ema.push(null);
    }
  }

  const i = closes.length - 1;
  const iPrev = i - 1;
  const parsedMarketPrice = parseFloat(marketPrice);

  let action = 'NEUTRAL';
  let entry = null;

  if (ma[iPrev] !== null && ema[iPrev] !== null && ma[i] !== null && ema[i] !== null) {
    const prevDiff = ma[iPrev] - ema[iPrev];
    const currDiff = ma[i] - ema[i];

    // MA cruzou EMA de baixo para cima → LONG
    if (prevDiff <= 0 && currDiff > 0) {
      action = 'LONG';
      entry = parseFloat((parsedMarketPrice).toFixed(6));
    }

    // MA cruzou EMA de cima para baixo → SHORT
    else if (prevDiff >= 0 && currDiff < 0) {
      action = 'SHORT';
      entry = parseFloat((parsedMarketPrice).toFixed(6));
    }
  }

  return {
    action,
    entry,
    marketPrice: parsedMarketPrice,
  };
  }

  async analyze() {

    try {
      

    const Account = await AccountController.get()

    // Verifica se os dados da conta foram carregados com sucesso
    if (!Account) {
      console.error('❌ Falha ao carregar dados da conta. Verifique suas credenciais de API.');
      return;
    }

    if(Account.leverage > 10 && process.env.TIME !== "1m"){
      console.log(`Leverage ${Account.leverage}x and time candle high (${process.env.TIME}) HIGH RISK LIQUIDATION`)
    }
   
    const positions = await Futures.getOpenPositions()
    const closed_markets = positions.map((el) => el.symbol)

    if(positions.length >= Number(Account.maxOpenOrders)){
      console.log("Maximum number of orders reached", positions.length)
      return
    }

    const dataset = await this.getDataset(Account, closed_markets)

    let media_rsi = 0
    
    for (const row of dataset) {
      media_rsi += row.rsi.value
    }

    media_rsi = media_rsi / dataset.length

    console.log("Média do RSI", media_rsi)

    // Calcula volume baseado em porcentagem ou valor fixo
    const VOLUME_ORDER = Number(process.env.VOLUME_ORDER)
    const CAPITAL_PERCENTAGE = Number(process.env.CAPITAL_PERCENTAGE || 0)
    
    let investmentUSD;
    
    if (CAPITAL_PERCENTAGE > 0) {
      // Usa porcentagem do capital disponível
      investmentUSD = (Account.capitalAvailable * CAPITAL_PERCENTAGE) / 100;
      console.log(`💰 Usando ${CAPITAL_PERCENTAGE}% do capital: $${investmentUSD.toFixed(2)}`);
    } else {
      // Usa valor fixo
      investmentUSD = VOLUME_ORDER;
      console.log(`💰 Usando valor fixo: $${investmentUSD.toFixed(2)}`);
    }

    // Validação de segurança: nunca exceder o capital disponível
    if (investmentUSD > Account.capitalAvailable) {
      investmentUSD = Account.capitalAvailable;
      console.log(`⚠️ Volume ajustado para capital disponível: $${investmentUSD.toFixed(2)}`);
    }

    if(investmentUSD < Account.capitalAvailable){
    const fee = Account.fee

    const rows = this.analyzeTrades(fee, dataset, investmentUSD, media_rsi)

    for (const row of rows) {
        const marketInfo = Account.markets.find((el) => el.symbol === row.market);

        row.volume = investmentUSD
        row.decimal_quantity = marketInfo.decimal_quantity
        row.decimal_price = marketInfo.decimal_price
        row.stepSize_quantity = marketInfo.stepSize_quantity

        const orders = await OrderController.getRecentOpenOrders(row.market)

        if(orders.length > 0) {
            
            if(orders[0].minutes > 3){
              await Order.cancelOpenOrders(row.market)
              await OrderController.openOrder(row)
            } 

        } else {
          await OrderController.openOrder(row)
        }


    }

    }


    } catch (error) {
      console.log(error)
    }

  } 

}

export default new Decision();