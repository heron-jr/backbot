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
   * Valida se o take profit atende aos critérios mínimos
   * @param {string} action - 'long' ou 'short'
   * @param {number} entry - Preço de entrada
   * @param {number} stop - Preço de stop
   * @param {number} target - Preço alvo
   * @param {number} investmentUSD - Valor investido
   * @param {number} fee - Taxa da exchange
   * @returns {object} - Objeto com validação e métricas
   */
  validateTakeProfit(action, entry, stop, target, investmentUSD, fee) {
    // Configurações do take profit mínimo (apenas porcentagem e R/R)
    const MIN_TAKE_PROFIT_PCT = Number(process.env.MIN_TAKE_PROFIT_PCT || 0.5);

    const { pnl, risk } = this.calculatePnLAndRisk(action, entry, stop, target, investmentUSD, fee);
    
    // Calcula métricas
    const riskRewardRatio = pnl / risk;
    const takeProfitPct = ((action === 'long') ? target - entry : entry - target) / entry * 100;
    
    // Validações (apenas porcentagem e R/R)
    const isValidPct = takeProfitPct >= MIN_TAKE_PROFIT_PCT;
    
    const isValid = isValidPct;
    
    return {
      isValid,
      pnl,
      risk,
      riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
      takeProfitPct: Number(takeProfitPct.toFixed(2)),
      reasons: {
        pct: isValidPct ? null : `TP ${takeProfitPct.toFixed(2)}% < mínimo ${MIN_TAKE_PROFIT_PCT}%`
      }
    };
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
   * Calcula preços de stop e target baseados em configurações do .env
   * @param {object} data - Dados de mercado
   * @param {number} price - Preço atual
   * @param {boolean} isLong - Se é posição long
   * @param {number} stopLossPct - Percentual de stop loss (do .env)
   * @param {number} takeProfitPct - Percentual de take profit (do .env)
   * @returns {object|null} - Objeto com stop e target ou null se inválido
   */
  calculateStopAndTarget(data, price, isLong, stopLossPct, takeProfitPct) {
    // Validação dos parâmetros
    if (!stopLossPct || !takeProfitPct) {
      console.error('❌ [BASE_STRATEGY] Parâmetros de stop/target inválidos:', { stopLossPct, takeProfitPct });
      return null;
    }

    // Converte percentuais para decimais
    const stopLossDecimal = Math.abs(stopLossPct) / 100;
    const takeProfitDecimal = Math.abs(takeProfitPct) / 100;

    let stop, target;

    if (isLong) {
      // Stop: abaixo do preço atual
      stop = price * (1 - stopLossDecimal);
      
      // Target: acima do preço atual
      target = price * (1 + takeProfitDecimal);
    } else {
      // Stop: acima do preço atual
      stop = price * (1 + stopLossDecimal);
      
      // Target: abaixo do preço atual
      target = price * (1 - takeProfitDecimal);
    }

    // Valida se os valores fazem sentido
    if (isLong && (stop >= price || target <= price)) {
      console.error('❌ [BASE_STRATEGY] Valores inválidos para LONG:', { price, stop, target });
      return null;
    }
    if (!isLong && (stop <= price || target >= price)) {
      console.error('❌ [BASE_STRATEGY] Valores inválidos para SHORT:', { price, stop, target });
      return null;
    }

    return { stop, target };
  }
} 