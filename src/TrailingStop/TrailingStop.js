import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js'
import Order from '../Backpack/Authenticated/Order.js';

class TrailingStop {

  async stopLoss() {
    try {
      const positions = await Futures.getOpenPositions();
      const Account = await AccountController.get()
      for (const position of positions) {
        const volume = Number(position.netExposureNotional)
        const MINIMAL_VOLUME = Number(process.env.MINIMAL_VOLUME)
        if(volume <= MINIMAL_VOLUME){
          OrderController.forceClose(position)
        }

        const market = Account.markets.find((el) => el.symbol === position.symbol)

        let fee = Number(position.netCost * Account.fee) > 0 ? Number(position.netCost * Account.fee) : Number(position.netCost * Account.fee) * -1
        fee = (fee * 2)

        const MINIMAL_PNL_STOP = Number(process.env.MINIMAL_PNL_STOP)
        const pnl = (Number(position.pnlRealized) + Number(position.pnlUnrealized)) - fee

        const isLong = (Number(position.netCost) > 0)

        const orders = await OrderController.getRecentOpenOrders(position.symbol);
        const ordened = isLong ? orders.sort((a,b) => Number(a.triggerPrice) - Number(b.triggerPrice))
                                : orders.sort((a,b) => Number(b.triggerPrice) - Number(a.triggerPrice))

        console.log(`${pnl > 0 ? "🗿" :"😞"}`, position.symbol.replace("_USDC_PERP", ""), Number(pnl.toFixed(2)));
        
        const stop = isLong ? Number(position.markPrice) - Number(market.tickSize) : Number(position.markPrice) + Number(market.tickSize)
        
        if(pnl > MINIMAL_PNL_STOP){
          const current = ordened[0]

          const temp = orders.sort((a,b) => a.minutes - b.minutes)
          if(temp !== undefined){
            if(temp[0].minutes > 5) {
              await OrderController.forceClose(position)
            }
          }

          if(current === undefined) {
            console.log("💸 Adding stop loss with profit", stop, "saving ~", MINIMAL_PNL_STOP)
            await OrderController.createStopTS({symbol:position.symbol, price:stop, isLong, quantity: position.netExposureQuantity})
          } else {
            const updateBetter = isLong ? stop > current.price : stop < current.price
            if(updateBetter) {
              console.log("💸 Updating stop loss with profit", stop, "saving ~", MINIMAL_PNL_STOP)
              const newStop = await OrderController.createStopTS({symbol:position.symbol, price:stop, isLong, quantity: position.netExposureQuantity})
              if(newStop) {
                await Order.cancelOpenOrder(position.symbol, current.id)
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
