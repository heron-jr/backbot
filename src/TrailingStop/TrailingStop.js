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

        let fee = Number(position.netCost * Account.fee) > 0 ? Number(position.netCost * Account.fee) : Number(position.netCost * Account.fee) * -1
        fee = (fee * 2)

        const MINIMAL_PNL_STOP = Number(process.env.MINIMAL_PNL_STOP)
        const pnl = (Number(position.pnlRealized) + Number(position.pnlUnrealized)) - fee

        const orders = await OrderController.getRecentOpenOrders(position.symbol);
        let minutes = 0

        if(orders.length > 0) {
          minutes = Number(orders[0].minutes)
        }

        console.log(`${pnl > 0 ? "🗿" :"😞"}`, position.symbol.replace("_USDC_PERP", ""), Number(pnl.toFixed(2)), "minutes", minutes );
        
        if(pnl > 0 && minutes > 15){ 
          await OrderController.forceClose(position)
        }
        
        if(pnl > MINIMAL_PNL_STOP){
          await OrderController.forceClose(position)
        } 
      }


    } catch (error) {
      console.error('stopLoss - Error:',error);
      return null;
    }
  }
}

export default new TrailingStop();
