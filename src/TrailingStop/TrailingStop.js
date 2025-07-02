import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import Markets from '../Backpack/Public/Markets.js'
import {analyzeTrade, calculateIndicators} from '../Decision/Indicators.js'
import Account from '../Backpack/Authenticated/Account.js';
import AccountController from '../Controllers/AccountController.js'
import Order from '../Backpack/Authenticated/Order.js';

class TrailingStop {

  calculateStop(data, buffer = 0.1) {
  const markPrice = parseFloat(data.markPrice);
  const lowerBands = data.vwap.lowerBands;

  if (!lowerBands || lowerBands.length === 0) {
    throw new Error("VWAP lower bands not available.");
  }

  // Use the last lower band as the stop reference
  const baseStop = lowerBands[lowerBands.length - 1];

  // Subtract a safety buffer
  let stop = baseStop - buffer;

  // Ensure the stop is below the mark price
  if (stop >= markPrice) {
    stop = markPrice - buffer;
  }

  return parseFloat(stop.toFixed(8));
  }

  async calculateNewStopPrice(position) {
      const candles = await Markets.getKLines(position.symbol, process.env.TIME, 30)
      const analyze = calculateIndicators(candles) 
      analyze.markPrice = position.markPrice
      return this.calculateStop(analyze, 0.05)
  }

  async stopLoss() {
    try {
      const positions = await Futures.getOpenPositions();
      const Account = await AccountController.get()
      for (const position of positions) {

        const market = Account.markets.find((el) => el.symbol === position.symbol)
        let fee = Number(position.netCost * Account.fee) > 0 ? Number(position.netCost * Account.fee) : Number(position.netCost * Account.fee) * -1
        fee = (fee * 2)

        const MINIMAL_PNL_STOP = Number(process.env.MINIMAL_PNL_STOP)
        const pnl = (Number(position.pnlRealized) + Number(position.pnlUnrealized)) - fee

        const isLong = (Number(position.netCost) > 0)

        const orders = await OrderController.getRecentOpenOrders(position.symbol);
        const ordened = isLong ? orders.sort((a,b) => Number(a.triggerPrice) - Number(b.triggerPrice))
                                : orders.sort((a,b) => Number(b.triggerPrice) - Number(a.triggerPrice))

        console.log(position.symbol.replace("_USDC_PERP", ""), `${pnl > 0 ? "🗿" :"😞"}`, Number(pnl.toFixed(2)));

        if (ordened.length === 0) {
            const stop = await this.calculateNewStopPrice(position)
            await OrderController.createStopTS({symbol:position.symbol, price:stop, isLong, quantity: position.netExposureQuantity})
        } else {
          const markPrice = Number(position.markPrice) 
          const stops = ordened.filter((el) => isLong ? el.price < markPrice : el.price > markPrice)
          if(stops.length === 0) {
            const stop = await this.calculateNewStopPrice(position)
            await OrderController.createStopTS({symbol:position.symbol, price:stop, isLong, quantity: position.netExposureQuantity})
          } else { 
            if(pnl >= MINIMAL_PNL_STOP){
              const current = ordened[0]
              const stop = Number(isLong ? position.markPrice - market.tickSize : position.markPrice + market.tickSize)
              const updateBetter = isLong ? stop > current.price : stop < current.price
              if(updateBetter) {
                console.log("💸 Adding stop loss with profit", stop, "saving ~", MINIMAL_PNL_STOP)
                const newStop = await OrderController.createStopTS({symbol:position.symbol, price:stop, isLong, quantity: position.netExposureQuantity})
                if(newStop) {
                  await Order.cancelOpenOrder(position.symbol, current.id)
                }
              }
            } 
          }
        }

      }


    } catch (error) {
      console.error('stopLoss - Error:',error);
      return null;
    }
  }
}

export default new TrailingStop();
