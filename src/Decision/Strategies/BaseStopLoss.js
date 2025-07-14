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
} 