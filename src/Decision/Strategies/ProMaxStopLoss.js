import { BaseStopLoss } from './BaseStopLoss.js';
import TrailingStop from '../../TrailingStop/TrailingStop.js';

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
      
      // Usa a função calculatePnL do TrailingStop
      const { pnl } = TrailingStop.calculatePnL(position, account);
      
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
} 