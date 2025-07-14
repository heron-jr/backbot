import { BaseStrategy } from './BaseStrategy.js';

export class DefaultStrategy extends BaseStrategy {
  /**
   * Implementação da estratégia DEFAULT (lógica atual do bot)
   * @param {number} fee - Taxa da exchange
   * @param {object} data - Dados de mercado com indicadores
   * @param {number} investmentUSD - Valor a investir
   * @param {number} media_rsi - Média do RSI de todos os mercados
   * @returns {object|null} - Objeto com decisão de trading ou null se não houver sinal
   */
  analyzeTrade(fee, data, investmentUSD, media_rsi) {
    try {
      // Validação inicial dos dados
      if (!this.validateData(data)) {
        return null;
      }

      // Análise de cruzamentos EMA
      const IsCrossBullish = data.ema.crossType === 'goldenCross' && data.ema.candlesAgo < 2;
      const IsCrossBearish = data.ema.crossType === 'deathCross' && data.ema.candlesAgo < 2;

      // Análise de reversão RSI
      const isReversingUp = data.rsi.value > 35 && media_rsi < 30;
      const isReversingDown = data.rsi.value < 65 && media_rsi > 70;

      // Análise de tendência EMA
      const isBullish = data.ema.ema9 > data.ema.ema21 && data.ema.diffPct > 0.1;
      const isBearish = data.ema.ema9 < data.ema.ema21 && data.ema.diffPct < -0.1;

      // Análise de momentum RSI
      const isRSIBullish = data.rsi.value > 50 && media_rsi > 40;
      const isRSIBearish = data.rsi.value < 50 && media_rsi < 60;

      // Decisão final
      const isLong = (isBullish && isRSIBullish) || isReversingUp || IsCrossBullish;
      const isShort = (isBearish && isRSIBearish) || isReversingDown || IsCrossBearish;

      if (!isLong && !isShort) {
        return null;
      }

      const action = isLong ? 'long' : 'short';
      const price = parseFloat(data.marketPrice);

      // Cálculo de stop e target usando VWAP
      const stopTarget = this.calculateStopAndTarget(data, price, isLong);
      if (!stopTarget) {
        return null;
      }

      const { stop, target } = stopTarget;
      const entry = price;

      // Cálculo de PnL e risco
      const { pnl, risk } = this.calculatePnLAndRisk(action, entry, stop, target, investmentUSD, fee);

      return {
        market: data.market.symbol,
        entry: Number(entry.toFixed(data.market.decimal_price)),
        stop: Number(stop.toFixed(data.market.decimal_price)),
        target: Number(target.toFixed(data.market.decimal_price)),
        action,
        pnl,
        risk
      };

    } catch (error) {
      console.error('DefaultStrategy.analyzeTrade - Error:', error);
      return null;
    }
  }
} 