export class BaseStopLoss {
  /**
   * Analisa se uma posição deve ser fechada baseado na estratégia
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @param {object} marketData - Dados de mercado atuais
   * @returns {object|null} - Objeto com decisão de fechamento ou null se não deve fechar
   */
  shouldClosePosition(position, account, marketData) {
    throw new Error('shouldClosePosition must be implemented by subclass');
  }

  /**
   * Valida se os dados necessários estão disponíveis
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {boolean} - True se dados são válidos
   */
  validateData(position, account) {
    return !!(position && account && position.symbol && position.netQuantity);
  }

  /**
   * Calcula PnL e porcentagem de uma posição
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {object} - Objeto com pnl e pnlPct
   */
  calculatePnL(position, account) {
    const fee = Math.abs(position.netCost * account.fee) * 2;
    const pnl = (Number(position.pnlRealized) + Number(position.pnlUnrealized)) - fee;
    const marginUsed = Math.abs(position.netCost);
    const pnlPct = marginUsed > 0 ? ((pnl / marginUsed) * 100) : 0;
    
    return { pnl, pnlPct: Number(pnlPct.toFixed(2)) };
  }

  /**
   * Verifica se o volume está abaixo do mínimo
   * @param {object} position - Dados da posição
   * @param {number} minVolume - Volume mínimo
   * @returns {boolean} - True se volume está abaixo do mínimo
   */
  isVolumeBelowMinimum(position, minVolume) {
    const volume = Number(position.netExposureNotional);
    return volume <= minVolume;
  }

  /**
   * Monitora take profit mínimo em operações abertas
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {object|null} - Decisão de take profit parcial ou null
   */
  monitorTakeProfitMinimum(position, account) {
    try {
      const ENABLE_TP_VALIDATION = process.env.ENABLE_TP_VALIDATION === 'true';
      if (!ENABLE_TP_VALIDATION) {
        return null;
      }

      const { pnl, pnlPct } = this.calculatePnL(position, account);
      
      // Só monitora se há lucro
      if (pnl <= 0) {
        return null;
      }

      const MIN_TAKE_PROFIT_PCT = Number(process.env.MIN_TAKE_PROFIT_PCT || 0.5);
      const TP_PARTIAL_PERCENTAGE = Number(process.env.TP_PARTIAL_PERCENTAGE || 50); // % da posição para realizar
      
      // Verifica se atende ao critério mínimo de take profit
      const isValidPct = pnlPct >= MIN_TAKE_PROFIT_PCT;
      
      // Se atende ao critério, realiza lucro parcial
      if (isValidPct) {
        return {
          shouldTakePartialProfit: true,
          reason: `TAKE_PROFIT_MIN: TP ${pnlPct.toFixed(2)}% >= mínimo ${MIN_TAKE_PROFIT_PCT}%`,
          type: 'TAKE_PROFIT_PARTIAL',
          pnl,
          pnlPct,
          partialPercentage: TP_PARTIAL_PERCENTAGE
        };
      }

      return null;

    } catch (error) {
      console.error('BaseStopLoss.monitorTakeProfitMinimum - Error:', error);
      return null;
    }
  }
} 