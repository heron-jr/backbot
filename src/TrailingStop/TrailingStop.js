import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Order from '../Backpack/Authenticated/Order.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';

class TrailingStop {

  constructor() {
    // Inicializa o stop loss baseado na estratégia configurada
    const strategyType = process.env.TRADING_STRATEGY || 'DEFAULT';
    this.stopLoss = StopLossFactory.createStopLoss(strategyType);
    
    console.log(`🛡️ Stop Loss carregado para estratégia: ${strategyType.toUpperCase()}`);
  }

  async stopLoss() {
    try {
      const positions = await Futures.getOpenPositions();
      const Account = await AccountController.get();

      if (!positions || positions.length === 0) {
       // console.log("❌ Nenhuma posição aberta encontrada.");
        return;
      }

      for (const position of positions) {
        // Usa o stop loss específico da estratégia
        const decision = this.stopLoss.shouldClosePosition(position, Account);
        
        if (decision && decision.shouldClose) {
          console.log(`❌ STOP LOSS (${decision.type}): ${decision.reason}. Fechando.`);
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