import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Order from '../Backpack/Authenticated/Order.js';

class TrailingStop {

  async stopLoss() {
    try {
      const positions = await Futures.getOpenPositions();
      const Account = await AccountController.get();

      if (!positions || positions.length === 0) {
       // console.log("❌ Nenhuma posição aberta encontrada.");
        return;
      }

      for (const position of positions) {
        // Valores configuráveis via .env
        const MAX_NEGATIVE_PNL_STOP = Number(process.env.MAX_NEGATIVE_PNL_STOP || -5);
        const MAX_NEGATIVE_PNL_STOP_PCT = Number(process.env.MAX_NEGATIVE_PNL_STOP_PCT || -4);
        const MINIMAL_VOLUME = Number(process.env.MINIMAL_VOLUME || 50);

        const volume = Number(position.netExposureNotional);
        if (volume <= MINIMAL_VOLUME) {
          console.log(`⚠️ Volume ${volume} menor que mínimo ${MINIMAL_VOLUME}, forçando fechar.`);
          await OrderController.forceClose(position);
          continue;
        }

        // Calcula taxa estimada (duas pontas)
        let fee = Math.abs(position.netCost * Account.fee) * 2;

        // PnL em dólares
        const pnl = (Number(position.pnlRealized) + Number(position.pnlUnrealized)) - fee;

        // Calcula % sobre o capital realmente usado (margem)
        const marginUsed = Math.abs(position.netCost);
        const pnlPct = marginUsed > 0 ? ((pnl / marginUsed) * 100).toFixed(2) : 0;

        // Verifica stop em USD fixo (eu tinha colocado % mais nao pegava por conta do valor da alavancagem)
        if (pnl <= -Math.abs(MAX_NEGATIVE_PNL_STOP)) {
          console.log(`❌ STOP LOSS (USD): ${position.symbol} PnL $${pnl.toFixed(2)} <= limite -$${Math.abs(MAX_NEGATIVE_PNL_STOP)}. Fechando.`);
          await OrderController.forceClose(position);
          continue;
        }
      }

    } catch (error) {
      console.error('stopLoss - Error:', error);
    }
  }
}

export default new TrailingStop();