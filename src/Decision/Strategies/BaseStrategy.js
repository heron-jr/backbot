export class BaseStrategy {
  /**
   * Analisa dados de mercado e retorna decisão de trading
   * @param {number} fee - Taxa da exchange
   * @param {object} data - Dados de mercado com indicadores
   * @param {number} investmentUSD - Valor a investir
   * @param {number} media_rsi - Média do RSI de todos os mercados
   * @returns {object|null} - Objeto com decisão de trading ou null se não houver sinal
   */
  analyzeTrade(fee, data, investmentUSD, media_rsi) {
    throw new Error('analyzeTrade must be implemented by subclass');
  }

  /**
   * Valida se os dados necessários estão disponíveis
   * @param {object} data - Dados de mercado
   * @returns {boolean} - True se dados são válidos
   */
  validateData(data) {
    return !!(data.vwap?.lowerBands?.length && 
              data.vwap?.upperBands?.length && 
              data.vwap.vwap != null);
  }

  /**
   * Calcula PnL e risco de uma operação
   * @param {string} action - 'long' ou 'short'
   * @param {number} entry - Preço de entrada
   * @param {number} stop - Preço de stop
   * @param {number} target - Preço alvo
   * @param {number} investmentUSD - Valor investido
   * @param {number} fee - Taxa da exchange
   * @returns {object} - Objeto com pnl e risk
   */
  calculatePnLAndRisk(action, entry, stop, target, investmentUSD, fee) {
    const units = investmentUSD / entry;
    
    const grossLoss = ((action === 'long') ? entry - stop : stop - entry) * units;
    const grossTarget = ((action === 'long') ? target - entry : entry - target) * units;
    
    const entryFee = investmentUSD * fee;
    const exitFeeTarget = grossTarget * fee;
    const exitFeeLoss = grossLoss * fee;
    
    const pnl = grossTarget - (entryFee + exitFeeTarget);
    const risk = grossLoss + (entryFee + exitFeeLoss);
    
    return { pnl: Number(pnl), risk: Number(risk) };
  }

  /**
   * Calcula preços de stop e target baseados em bandas VWAP
   * @param {object} data - Dados de mercado
   * @param {number} price - Preço atual
   * @param {boolean} isLong - Se é posição long
   * @param {number} percentVwap - Percentual para target (padrão 0.95)
   * @returns {object|null} - Objeto com stop e target ou null se inválido
   */
  calculateStopAndTarget(data, price, isLong, percentVwap = 0.95) {
    const bands = [...data.vwap.lowerBands, ...data.vwap.upperBands]
      .map(Number)
      .sort((a, b) => a - b);

    const bandBelow = bands.filter(b => b < price);
    const bandAbove = bands.filter(b => b > price);

    if (bandAbove.length === 0 || bandBelow.length === 0) return null;

    let stop, target;

    if (isLong) {
      stop = bandBelow[1];
      target = price + ((bandAbove[0] - price) * percentVwap);
    } else {
      stop = bandAbove[1];
      target = price - ((price - bandBelow[0]) * percentVwap);
    }

    return { stop, target };
  }
} 