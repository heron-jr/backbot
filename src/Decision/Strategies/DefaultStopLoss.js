import { BaseStopLoss } from './BaseStopLoss.js';

export class DefaultStopLoss extends BaseStopLoss {
  /**
   * Implementação do stop loss para estratégia DEFAULT
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

      // Configurações do stop loss
      const STOP_LOSS_TYPE = process.env.STOP_LOSS_TYPE || 'USD';
      const USE_PERCENTAGE = STOP_LOSS_TYPE.toUpperCase() === 'PERCENTAGE';
      const MAX_NEGATIVE_PNL_STOP = Number(process.env.MAX_NEGATIVE_PNL_STOP || -5);
      const MAX_NEGATIVE_PNL_STOP_PCT = Number(process.env.MAX_NEGATIVE_PNL_STOP_PCT || -4);
      const MINIMAL_VOLUME = Number(process.env.MINIMAL_VOLUME || 50);

      // Configurações de take profit mínimo em tempo real
      const MIN_TAKE_PROFIT_USD = Number(process.env.MIN_TAKE_PROFIT_USD || 0.5);
      const MIN_TAKE_PROFIT_PCT = Number(process.env.MIN_TAKE_PROFIT_PCT || 0.5);
      const ENABLE_TP_VALIDATION = process.env.ENABLE_TP_VALIDATION === 'true';

      // Verifica volume mínimo (específico da estratégia DEFAULT)
      // NOTA: A estratégia PRO_MAX não usa esta validação para evitar fechamento prematuro
      if (this.isVolumeBelowMinimum(position, MINIMAL_VOLUME)) {
        return {
          shouldClose: true,
          reason: `VOLUME_MIN: Volume ${Number(position.netExposureNotional)} menor que mínimo ${MINIMAL_VOLUME}`,
          type: 'VOLUME_MIN'
        };
      }

      // Calcula PnL
      const { pnl, pnlPct } = this.calculatePnL(position, account);

      // Verifica stop loss baseado no tipo configurado
      if (USE_PERCENTAGE) {
        // Stop loss em porcentagem
        if (pnlPct <= MAX_NEGATIVE_PNL_STOP_PCT) {
          return {
            shouldClose: true,
            reason: `PERCENTAGE: PnL ${pnlPct}% <= limite ${MAX_NEGATIVE_PNL_STOP_PCT}%`,
            type: 'PERCENTAGE',
            pnl,
            pnlPct
          };
        }
      } else {
        // Stop loss em USD (padrão)
        if (pnl <= MAX_NEGATIVE_PNL_STOP) {
          return {
            shouldClose: true,
            reason: `USD: PnL $${pnl.toFixed(2)} <= limite $${MAX_NEGATIVE_PNL_STOP}`,
            type: 'USD',
            pnl,
            pnlPct
          };
        }
      }

      // Monitoramento de take profit mínimo em tempo real (se habilitada)
      if (ENABLE_TP_VALIDATION && pnl > 0) {
        const takeProfitMonitoring = this.monitorTakeProfitMinimum(position, account);
        
        if (takeProfitMonitoring && takeProfitMonitoring.shouldTakePartialProfit) {
          return takeProfitMonitoring;
        }
      }

      // Não deve fechar
      return null;

    } catch (error) {
      console.error('DefaultStopLoss.shouldClosePosition - Error:', error);
      return null;
    }
  }

} 