import { BaseStopLoss } from './BaseStopLoss.js';

export class ProMaxStopLoss extends BaseStopLoss {
  /**
   * Implementação do stop loss para estratégia PRO_MAX
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @param {object} marketData - Dados de mercado atuais
   * @returns {object|null} - Objeto com decisão de fechamento ou null se não deve fechar
   */
  shouldClosePosition(position, account, marketData) {
    try {
      // Validação inicial dos dados
      if (!this.validateData(position, account)) {
        return null;
      }

      const ENABLE_TP_VALIDATION = process.env.ENABLE_TP_VALIDATION === 'true';
      const { pnl } = this.calculatePnL(position, account);
      if (ENABLE_TP_VALIDATION && pnl > 0) {
        const takeProfitMonitoring = this.monitorTakeProfitMinimum(position, account);
        
        if (takeProfitMonitoring && takeProfitMonitoring.shouldTakePartialProfit) {
          return takeProfitMonitoring;
        }
      }

      return null;

    } catch (error) {
      console.error('ProMaxStopLoss.shouldClosePosition - Error:', error);
      return null;
    }
  }

  /**
   * Obtém multiplicador baseado no timeframe
   * @param {string} timeframe - Timeframe atual
   * @returns {number} - Multiplicador ajustado
   */
  getTimeframeMultiplier(timeframe) {
    const multipliers = {
      '1m': 0.5,
      '3m': 0.7,
      '5m': 1.0,
      '15m': 1.2,
      '30m': 1.5,
      '1h': 2.0,
      '2h': 2.5,
      '4h': 3.0,
      '1d': 4.0
    };
    return multipliers[timeframe] || 1.0;
  }
} 