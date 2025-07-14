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
        
        // Configuração do tipo de stop loss (USD ou porcentagem)
        const STOP_LOSS_TYPE = process.env.STOP_LOSS_TYPE || 'USD'; // 'USD' ou 'PERCENTAGE'
        const USE_PERCENTAGE = STOP_LOSS_TYPE.toUpperCase() === 'PERCENTAGE';

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

        // Verifica stop loss baseado no tipo configurado
        let shouldClose = false;
        let stopReason = '';

        if (USE_PERCENTAGE) {
          // Stop loss em porcentagem
          if (pnlPct <= MAX_NEGATIVE_PNL_STOP_PCT) {
            shouldClose = true;
            stopReason = `PERCENTAGE: ${position.symbol} PnL ${pnlPct}% <= limite ${MAX_NEGATIVE_PNL_STOP_PCT}%`;
          }
        } else {
          // Stop loss em USD (padrão)
          if (pnl <= MAX_NEGATIVE_PNL_STOP) {
            shouldClose = true;
            stopReason = `USD: ${position.symbol} PnL $${pnl.toFixed(2)} <= limite $${MAX_NEGATIVE_PNL_STOP}`;
          }
        }

        if (shouldClose) {
          console.log(`❌ STOP LOSS (${STOP_LOSS_TYPE}): ${stopReason}. Fechando.`);
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