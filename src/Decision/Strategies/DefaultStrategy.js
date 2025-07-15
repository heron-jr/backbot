import { BaseStrategy } from './BaseStrategy.js';
import Markets from '../../Backpack/Public/Markets.js';
import { calculateIndicators } from '../Indicators.js';

export class DefaultStrategy extends BaseStrategy {
  /**
   * Implementação da estratégia DEFAULT (lógica atual do bot)
   * @param {number} fee - Taxa da exchange
   * @param {object} data - Dados de mercado com indicadores
   * @param {number} investmentUSD - Valor a investir
   * @param {number} media_rsi - Média do RSI de todos os mercados
   * @returns {object|null} - Objeto com decisão de trading ou null se não houver sinal
   */
  async analyzeTrade(fee, data, investmentUSD, media_rsi) {
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
        // Log de debug para mostrar quando não há sinais
        // console.log(`🔍 [DEFAULT] ${data.market.symbol}: Sem sinais - EMA: ${isBullish ? 'BULL' : isBearish ? 'BEAR' : 'NEUTRAL'}, RSI: ${data.rsi.value?.toFixed(1) || 'N/A'}`);
        return null;
      }

      // FILTRO DE TENDÊNCIA DO BTC - NOVA FUNCIONALIDADE
      const btcTrendFilter = await this.validateBTCTrend(data.market.symbol, isLong);
      if (!btcTrendFilter.isValid) {
        // console.log(`⚠️ [DEFAULT] ${data.market.symbol}: Sinal ${isLong ? 'LONG' : 'SHORT'} ignorado - ${btcTrendFilter.reason}`);
        return null;
      }
      
      // Log de debug para mostrar quando o filtro está funcionando
      // if (data.market.symbol !== 'BTC_USDC_PERP') {
      //   console.log(`🔍 [DEFAULT] ${data.market.symbol}: Sinal ${isLong ? 'LONG' : 'SHORT'} validado - BTC Trend: ${btcTrendFilter.btcTrend}`);
      // }

      const action = isLong ? 'long' : 'short';
      const price = parseFloat(data.marketPrice);

      // Cálculo de stop e target usando VWAP
      const stopTarget = this.calculateStopAndTarget(data, price, isLong);
      if (!stopTarget) {
        // console.log(`⚠️ [DEFAULT] ${data.market.symbol}: Não foi possível calcular stop/target`);
        return null;
      }

      const { stop, target } = stopTarget;
      const entry = price;
      
      // Log detalhado dos valores calculados
      console.log(`\n📊 [DEFAULT] ${data.market.symbol}: Entry: ${entry.toFixed(6)}, Stop: ${stop.toFixed(6)} (${((Math.abs(entry - stop) / entry) * 100).toFixed(2)}%), Target: ${target.toFixed(6)} (${((Math.abs(target - entry) / entry) * 100).toFixed(2)}%)`);

      // Cálculo de PnL e risco
      const { pnl, risk } = this.calculatePnLAndRisk(action, entry, stop, target, investmentUSD, fee);

      console.log(`✅ ${data.market.symbol}: ${action.toUpperCase()} - PnL $${pnl.toFixed(2)} - BTC Trend: ${btcTrendFilter.btcTrend}`);

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

  /**
   * Valida se o sinal está alinhado com a tendência do BTC
   * @param {string} marketSymbol - Símbolo do mercado
   * @param {boolean} isLong - Se é sinal de compra
   * @returns {object} - Resultado da validação
   */
  async validateBTCTrend(marketSymbol, isLong) {
    try {
      // Se for BTC, não precisa validar
      if (marketSymbol === 'BTC_USDC_PERP') {
        return { isValid: true, btcTrend: 'BTC_ITSELF', reason: null };
      }

      // Obtém dados do BTC
      const btcCandles = await Markets.getKLines('BTC_USDC_PERP', process.env.TIME || '5m', 30);
      if (!btcCandles || btcCandles.length === 0) {
        return { isValid: true, btcTrend: 'NO_DATA', reason: 'Dados do BTC não disponíveis' };
      }

      // Calcula indicadores do BTC
      const btcIndicators = calculateIndicators(btcCandles);
      
      // Análise de tendência do BTC (menos restritiva)
      const btcEmaBullish = btcIndicators.ema.ema9 > btcIndicators.ema.ema21 && btcIndicators.ema.diffPct > 0.02;
      const btcEmaBearish = btcIndicators.ema.ema9 < btcIndicators.ema.ema21 && btcIndicators.ema.diffPct < -0.02;
      const btcRSIBullish = btcIndicators.rsi.value > 40;
      const btcRSIBearish = btcIndicators.rsi.value < 60;

      // Determina tendência do BTC
      let btcTrend = 'NEUTRAL';
      if (btcEmaBullish && btcRSIBullish) {
        btcTrend = 'BULLISH';
      } else if (btcEmaBearish && btcRSIBearish) {
        btcTrend = 'BEARISH';
      }

      // Validação: só permite LONG em altcoins quando BTC está bullish ou neutro
      // Só permite SHORT em altcoins quando BTC está bearish ou neutro
      if (isLong && btcTrend === 'BEARISH') {
        return { 
          isValid: false, 
          btcTrend, 
          reason: 'BTC em tendência de baixa - não entrar LONG em altcoins' 
        };
      }

      if (!isLong && btcTrend === 'BULLISH') {
        return { 
          isValid: false, 
          btcTrend, 
          reason: 'BTC em tendência de alta - não entrar SHORT em altcoins' 
        };
      }

      return { isValid: true, btcTrend, reason: null };

    } catch (error) {
      console.error('DefaultStrategy.validateBTCTrend - Error:', error);
      // Em caso de erro, permite a operação (fail-safe)
      return { isValid: true, btcTrend: 'ERROR', reason: 'Erro na análise do BTC' };
    }
  }
} 