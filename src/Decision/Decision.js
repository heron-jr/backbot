import Futures from '../Backpack/Authenticated/Futures.js';
import Order from '../Backpack/Authenticated/Order.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Markets from '../Backpack/Public/Markets.js';
import { calculateIndicators } from './Indicators.js';
import CacheController from '../Controllers/CacheController.js';
import Terminal from '../Utils/Terminal.js';
import dotenv from 'dotenv';
dotenv.config();
const Cache = new CacheController();

class Decision {

  constructor() {
    this.UNIQUE_TREND = String(process.env.UNIQUE_TREND).toUpperCase().trim()
    this.MAX_ORDER_OPEN = Number(process.env.MAX_ORDER_OPEN)
  }

  async getDataset(Account, closed_markets) {
    const dataset = []
    const AUTHORIZED_MARKET = JSON.parse(process.env.AUTHORIZED_MARKET);

    const markets = Account.markets.filter(el => {
      const isOpen = !closed_markets.includes(el.symbol);
      const isAuthorized = AUTHORIZED_MARKET.length === 0 || AUTHORIZED_MARKET.includes(el.symbol);
      return isOpen && isAuthorized;
    });

    try {
    
        Terminal.init(markets.length, markets.length)
        let count = 0
      
        for (const market of markets) {
          
            const candles_1m  = await Markets.getKLines(market.symbol, "1m",  30)
            const candles_5m  = await Markets.getKLines(market.symbol, "5m",  30)
            const candles_15m = await Markets.getKLines(market.symbol, "15m", 30)
            
            const analyze_1m = calculateIndicators(candles_1m)
            const analyze_5m = calculateIndicators(candles_5m)
            const analyze_15m = calculateIndicators(candles_15m)

            const getAllMarkPrices = await Markets.getAllMarkPrices(market.symbol)
            const marketPrice = getAllMarkPrices[0].markPrice

            count++
            Terminal.update(`🔍 Analyzing ${markets.length} Markets`, count)

            const obj = {
              market,
              marketPrice,
              "1m":analyze_1m,
              "5m":analyze_5m,
              "15m":analyze_15m
            }

            dataset.push(obj)
        }

        Terminal.finish()

        } catch (error) {
          console.log(error)
    }

    return dataset
  }

  evaluateTradeOpportunity(obj) {
  const { market, marketPrice, "1m": tf1, "5m": tf5, "15m": tf15 } = obj;
  const mp = parseFloat(marketPrice);

  function scoreSide(isLong) {
    let score = 0;
    let total = 9;

    if (tf15.ema.ema9 > tf15.ema.ema21 === isLong) score++;
    if (tf5.ema.ema9 > tf5.ema.ema21 === isLong) score++;

    if ((isLong && tf5.rsi.value > 55) || (!isLong && tf5.rsi.value < 45)) score++;

    if (tf5.macd.MACD > tf5.macd.MACD_signal === isLong) score++;

    const boll = tf1.bollinger;
    if ((isLong && mp > boll.BOLL_middle) || (!isLong && mp < boll.BOLL_middle)) score++;

    if ((isLong && mp > tf1.vwap.vwap) || (!isLong && mp < tf1.vwap.vwap)) score++;

    if (tf1.volume.volume.trend === "increasing") score++;

    if (
      (isLong && tf1.volume.price.slope > 0) ||
      (!isLong && tf1.volume.price.slope < 0)
    ) score++;

    const stack = (
      (isLong && tf5.rsi.value > 55 && tf5.macd.MACD > tf5.macd.MACD_signal && tf5.ema.ema9 > tf5.ema.ema21) ||
      (!isLong && tf5.rsi.value < 45 && tf5.macd.MACD < tf5.macd.MACD_signal && tf5.ema.ema9 < tf5.ema.ema21)
    );
    if (stack) score++;

    return Math.round((score / total) * 100);
  }

  const longScore = scoreSide(true);
  const shortScore = scoreSide(false);

  const isLong = longScore > shortScore;
  const certainty = Math.max(longScore, shortScore);

  const entry = isLong 
    ? mp - (market.tickSize * 10)
    : mp + (market.tickSize * 10)

  return {
    side: isLong ? "long" : "short",
    certainty: certainty,
    ...market,
    entry: parseFloat(entry.toFixed(obj.market.decimal_price)),
  };

  }

  async openOrder(row) {
    const orders = await OrderController.getRecentOpenOrders(row.symbol)
    const [firstOrder] = orders;

    if (firstOrder) {
      if(firstOrder.minutes > 3) {
        await Order.cancelOpenOrders(row.symbol)
        await OrderController.openOrder(row)
      }
    } else {
      await OrderController.openOrder(row)
    }
  }

  async analyze() {

    try {
      
    const account = await Cache.get()

    if(account.leverage > 10){
      console.log(`Leverage ${account.leverage}x  HIGH RISK LIQUIDATION ☠️`)
    }

    const positions = await Futures.getOpenPositions()

    const open_markers = positions.map((el) => el.symbol)

    const orders = await Order.getOpenOrders(null, "PERP")

    for (const order of orders) {
      if(!open_markers.includes(order.symbol)){
        open_markers.push(order.symbol)
      }
    }

    console.log("open_markers.length", open_markers.length)

    if(this.MAX_ORDER_OPEN > open_markers.length){ 

      const VOLUME_ORDER = Number(process.env.VOLUME_ORDER)

      if(VOLUME_ORDER < account.capitalAvailable){

        if(positions){

          const closed_markets = positions.map((el) => el.symbol)
          const dataset = await this.getDataset(account, closed_markets)
          const CERTAINTY = Number(process.env.CERTAINTY)
          const rows = dataset.map((row) => this.evaluateTradeOpportunity(row)).filter((el) => el.certainty >= CERTAINTY)

          for (const row of rows) {
              row.volume = VOLUME_ORDER
              row.action = row.side
    
              const isLong = row.side === "long"
              const MAX_PERCENT_LOSS = Number(String(process.env.MAX_PERCENT_LOSS).replace("%","")) / 100
              const MAX_PERCENT_PROFIT = Number(String(process.env.MAX_PERCENT_PROFIT).replace("%","")) / 100
              
              const quantity = (VOLUME_ORDER / row.entry)
              const fee_open = VOLUME_ORDER * account.fee
              const fee_total_loss = (fee_open + (fee_open * MAX_PERCENT_LOSS)) / quantity
              const fee_total_profit = (fee_open + (fee_open * MAX_PERCENT_PROFIT)) / quantity

              const stop =  isLong ? (row.entry - (row.entry * MAX_PERCENT_LOSS)) - fee_total_loss : (row.entry + (row.entry * MAX_PERCENT_LOSS)) + fee_total_loss
              const target = isLong ? (row.entry + (row.entry * MAX_PERCENT_PROFIT)) + fee_total_profit : (row.entry - (row.entry * MAX_PERCENT_PROFIT)) - fee_total_profit

              row.stop = stop
              row.target = target

              if(this.UNIQUE_TREND !== ""){
                  if((this.UNIQUE_TREND === "LONG" && isLong === true) || (this.UNIQUE_TREND === "SHORT" && isLong === false)) {
                    await this.openOrder(row)
                  } else {
                    console.log( row.symbol, "Ignore by rule UNIQUE_TREND active Only", this.UNIQUE_TREND)
                  }
              } else {
                await this.openOrder(row)
              }

          }
        }

      } 

    }


    } catch (error) {
      console.log(error)
    }

  } 

}

export default new Decision();