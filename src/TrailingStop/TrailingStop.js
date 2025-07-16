import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';

class TrailingStop {

  constructor(strategyType = null) {
    const finalStrategyType = strategyType || 'DEFAULT';
    this.stopLossStrategy = StopLossFactory.createStopLoss(finalStrategyType);
  }

  /**
   * Re-inicializa o stop loss com uma nova estratégia
   * @param {string} strategyType - Novo tipo de estratégia
   */
  reinitializeStopLoss(strategyType) {
    if (!strategyType) {
      return;
    }
    
    this.stopLossStrategy = StopLossFactory.createStopLoss(strategyType);
  }

  async stopLoss() {
    try {
      const positions = await Futures.getOpenPositions();
      const Account = await AccountController.get();

      if (!positions || positions.length === 0) {
        return;
      }

      for (const position of positions) {
        const decision = this.stopLossStrategy.shouldClosePosition(position, Account);
        
        if (decision && decision.shouldClose) {
          await OrderController.forceClose(position);
          continue;
        }

        if (decision && decision.shouldTakePartialProfit) {
          await OrderController.takePartialProfit(position, decision.partialPercentage);
          continue;
        }
      }

    } catch (error) {
      console.error('stopLoss - Error:', error);
    }
  }
}

export default new TrailingStop();