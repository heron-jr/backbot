import { BaseStrategy } from './BaseStrategy.js';

export class ProMaxStrategy extends BaseStrategy {
      /**
     * Implementação da estratégia PRO_MAX baseada no script PineScript ADX
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

      // Configurações da estratégia PRO_MAX
      const IGNORE_BRONZE = process.env.IGNORE_BRONZE_SIGNALS === 'true';
      const ADX_LENGTH = Number(process.env.ADX_LENGTH || 14);
      const ADX_THRESHOLD = Number(process.env.ADX_THRESHOLD || 20);
      const ADX_AVERAGE_LENGTH = Number(process.env.ADX_AVERAGE_LENGTH || 21);
      
      // Configurações de validação
      const USE_RSI = process.env.USE_RSI_VALIDATION === 'true';
      const USE_STOCH = process.env.USE_STOCH_VALIDATION === 'true';
      const USE_MACD = process.env.USE_MACD_VALIDATION === 'true';
      
      // Configurações RSI
      const RSI_LENGTH = Number(process.env.RSI_LENGTH || 14);
      const RSI_AVERAGE_LENGTH = Number(process.env.RSI_AVERAGE_LENGTH || 14);
      const RSI_BULL_THRESHOLD = Number(process.env.RSI_BULL_THRESHOLD || 45);
      const RSI_BEAR_THRESHOLD = Number(process.env.RSI_BEAR_THRESHOLD || 55);
      
      // Configurações Stochastic
      const STOCH_K_LENGTH = Number(process.env.STOCH_K_LENGTH || 14);
      const STOCH_D_LENGTH = Number(process.env.STOCH_D_LENGTH || 3);
      const STOCH_SMOOTH = Number(process.env.STOCH_SMOOTH || 3);
      const STOCH_BULL_THRESHOLD = Number(process.env.STOCH_BULL_THRESHOLD || 45);
      const STOCH_BEAR_THRESHOLD = Number(process.env.STOCH_BEAR_THRESHOLD || 55);
      
      // Configurações MACD
      const MACD_FAST_LENGTH = Number(process.env.MACD_FAST_LENGTH || 12);
      const MACD_SLOW_LENGTH = Number(process.env.MACD_SLOW_LENGTH || 26);
      const MACD_SIGNAL_LENGTH = Number(process.env.MACD_SIGNAL_LENGTH || 9);

      // Análise ADX
      const adxAnalysis = this.analyzeADX(data, ADX_LENGTH, ADX_THRESHOLD, ADX_AVERAGE_LENGTH);
      if (!adxAnalysis.isValid) {
        return null;
      }

      // Análise de validação de indicadores
      const validationAnalysis = this.analyzeValidations(data, {
        useRSI: USE_RSI,
        useStoch: USE_STOCH,
        useMACD: USE_MACD,
        rsiLength: RSI_LENGTH,
        rsiAverageLength: RSI_AVERAGE_LENGTH,
        rsiBullThreshold: RSI_BULL_THRESHOLD,
        rsiBearThreshold: RSI_BEAR_THRESHOLD,
        stochKLength: STOCH_K_LENGTH,
        stochDLength: STOCH_D_LENGTH,
        stochSmooth: STOCH_SMOOTH,
        stochBullThreshold: STOCH_BULL_THRESHOLD,
        stochBearThreshold: STOCH_BEAR_THRESHOLD,
        macdFastLength: MACD_FAST_LENGTH,
        macdSlowLength: MACD_SLOW_LENGTH,
        macdSignalLength: MACD_SIGNAL_LENGTH
      });

      // Calcula confluências
      const bullConfluences = this.calculateBullConfluences(adxAnalysis, validationAnalysis);
      const bearConfluences = this.calculateBearConfluences(adxAnalysis, validationAnalysis);

      // Determina nível do sinal
      const bullSignalLevel = this.getSignalLevel(bullConfluences);
      const bearSignalLevel = this.getSignalLevel(bearConfluences);

      // Verifica se deve ignorar sinais BRONZE
      const isValidBullSignal = !IGNORE_BRONZE || bullSignalLevel !== 'BRONZE';
      const isValidBearSignal = !IGNORE_BRONZE || bearSignalLevel !== 'BRONZE';

      // Log de sinais ignorados (BRONZE)
      if (IGNORE_BRONZE && adxAnalysis.bullishCondition && bullConfluences === 1) {
        console.log(`⚠️ [PRO_MAX] ${data.market.symbol} (BRONZE): Sinal LONG ignorado - IGNORE_BRONZE_SIGNALS=true`);
      }
      if (IGNORE_BRONZE && adxAnalysis.bearishCondition && bearConfluences === 1) {
        console.log(`⚠️ [PRO_MAX] ${data.market.symbol} (BRONZE): Sinal SHORT ignorado - IGNORE_BRONZE_SIGNALS=true`);
      }

      // Determina ação baseada nas confluências
      let action = null;
      let signalLevel = null;

      if (adxAnalysis.bullishCondition && isValidBullSignal && bullConfluences > 0) {
        action = 'long';
        signalLevel = bullSignalLevel;
      } else if (adxAnalysis.bearishCondition && isValidBearSignal && bearConfluences > 0) {
        action = 'short';
        signalLevel = bearSignalLevel;
      }

      if (!action) {
        return null;
      }

      const price = parseFloat(data.marketPrice);
      
      // Calcula stop e múltiplos targets usando ATR (como no PineScript)
      const stopAndTargets = this.calculateStopAndMultipleTargets(data, price, action);
      if (!stopAndTargets) {
        return null;
      }

      const { stop, targets } = stopAndTargets;
      const entry = price;



      // Calcula PnL usando o primeiro target para validação
      const firstTarget = targets.length > 0 ? targets[0] : entry;
      const { pnl, risk } = this.calculatePnLAndRisk(action, entry, stop, firstTarget, investmentUSD, fee);

      // Log apenas quando há operação para ser aberta
      console.log(`✅ [PRO_MAX] ${data.market.symbol} (${signalLevel}): ${action.toUpperCase()} - Confluências: ${action === 'long' ? bullConfluences : bearConfluences}/4 - Targets: ${targets.length} - PnL $${pnl.toFixed(2)}`);

      return {
        market: data.market.symbol,
        entry: Number(entry.toFixed(data.market.decimal_price)),
        stop: Number(stop.toFixed(data.market.decimal_price)),
        target: Number(firstTarget.toFixed(data.market.decimal_price)), // Primeiro target para compatibilidade
        targets: targets.map(t => Number(t.toFixed(data.market.decimal_price))), // Todos os targets
        action,
        pnl,
        risk,
        signalLevel,
        confluences: action === 'long' ? bullConfluences : bearConfluences
      };

    } catch (error) {
      console.error('ProMaxStrategy.analyzeTrade - Error:', error);
      return null;
    }
  }

  /**
   * Analisa ADX e determina condições de entrada
   * @param {object} data - Dados de mercado
   * @param {number} length - Período ADX
   * @param {number} threshold - Limite ADX
   * @param {number} avgLength - Período da média ADX
   * @returns {object} - Análise ADX
   */
  analyzeADX(data, length, threshold, avgLength) {
    try {
      const adx = data.adx?.adx || 0;
      const diPlus = data.adx?.diPlus || 0;
      const diMinus = data.adx?.diMinus || 0;
      const adxAvg = data.adx?.adxEma || 0;

      // Condição de confirmação de volume (ADX < threshold)
      const confirmationVolume = adx < threshold;

      // Condições de reversão
      const bullishCondition = diPlus > diMinus && confirmationVolume && 
                              (data.adx?.diPlusPrev || 0) <= (data.adx?.diMinusPrev || 0);
      
      const bearishCondition = diMinus > diPlus && confirmationVolume && 
                              (data.adx?.diMinusPrev || 0) <= (data.adx?.diPlusPrev || 0);

      return {
        isValid: true,
        adx,
        diPlus,
        diMinus,
        adxAvg,
        confirmationVolume,
        bullishCondition,
        bearishCondition
      };
    } catch (error) {
      console.error('ProMaxStrategy.analyzeADX - Error:', error);
      return { isValid: false };
    }
  }

  /**
   * Analisa validações de indicadores (RSI, Stochastic, MACD)
   * @param {object} data - Dados de mercado
   * @param {object} config - Configurações dos indicadores
   * @returns {object} - Análise de validações
   */
  analyzeValidations(data, config) {
    try {
      const result = {
        rsi: { bullish: false, bearish: false },
        stoch: { bullish: false, bearish: false },
        macd: { bullish: false, bearish: false }
      };

      // Validação RSI
      if (config.useRSI && data.rsi) {
        const rsi = data.rsi.value;
        const rsiAvg = data.rsi.avg || rsi;
        const rsiPrev = data.rsi.prev || rsi;
        const rsiAvgPrev = data.rsi.avgPrev || rsiAvg;

        result.rsi.bullish = rsi > rsiAvg && rsi < config.rsiBullThreshold && rsiPrev <= rsiAvgPrev;
        result.rsi.bearish = rsi < rsiAvg && rsi > config.rsiBearThreshold && rsiPrev >= rsiAvgPrev;
      }

      // Validação Stochastic
      if (config.useStoch && data.stoch) {
        const stochK = data.stoch.k;
        const stochD = data.stoch.d;
        const stochKPrev = data.stoch.kPrev || stochK;
        const stochDPrev = data.stoch.dPrev || stochD;

        result.stoch.bullish = stochK > stochD && stochK < config.stochBullThreshold && stochKPrev <= stochDPrev;
        result.stoch.bearish = stochK < stochD && stochK > config.stochBearThreshold && stochKPrev >= stochDPrev;
      }

      // Validação MACD
      if (config.useMACD && data.macd) {
        const histogram = data.macd.histogram;
        const histogramPrev = data.macd.histogramPrev || histogram;

        result.macd.bullish = histogram < 0 && histogram > histogramPrev;
        result.macd.bearish = histogram >= 0 && histogram < histogramPrev;
      }

      return result;
    } catch (error) {
      console.error('ProMaxStrategy.analyzeValidations - Error:', error);
      return { rsi: { bullish: false, bearish: false }, stoch: { bullish: false, bearish: false }, macd: { bullish: false, bearish: false } };
    }
  }

  /**
   * Calcula confluências para sinais de alta
   * @param {object} adxAnalysis - Análise ADX
   * @param {object} validationAnalysis - Análise de validações
   * @returns {number} - Número de confluências
   */
  calculateBullConfluences(adxAnalysis, validationAnalysis) {
    let confluences = 0;

    // ADX é sempre contado se houver condição bullish
    if (adxAnalysis.bullishCondition) {
      confluences += 1;
    }

    // Adiciona confluências dos indicadores de validação
    if (validationAnalysis.rsi.bullish) {
      confluences += 1;
    }

    if (validationAnalysis.stoch.bullish) {
      confluences += 1;
    }

    if (validationAnalysis.macd.bullish) {
      confluences += 1;
    }

    return confluences;
  }

  /**
   * Calcula confluências para sinais de baixa
   * @param {object} adxAnalysis - Análise ADX
   * @param {object} validationAnalysis - Análise de validações
   * @returns {number} - Número de confluências
   */
  calculateBearConfluences(adxAnalysis, validationAnalysis) {
    let confluences = 0;

    // ADX é sempre contado se houver condição bearish
    if (adxAnalysis.bearishCondition) {
      confluences += 1;
    }

    // Adiciona confluências dos indicadores de validação
    if (validationAnalysis.rsi.bearish) {
      confluences += 1;
    }

    if (validationAnalysis.stoch.bearish) {
      confluences += 1;
    }

    if (validationAnalysis.macd.bearish) {
      confluences += 1;
    }

    return confluences;
  }

  /**
   * Determina o nível do sinal baseado no número de confluências
   * @param {number} confluences - Número de confluências
   * @returns {string} - Nível do sinal (BRONZE, SILVER, GOLD, DIAMOND)
   */
  getSignalLevel(confluences) {
    if (confluences === 1) return '🥉 BRONZE';
    if (confluences === 2) return '🥈 SILVER';
    if (confluences === 3) return '🥇 GOLD';
    if (confluences === 4) return '💎 DIAMOND';
    return '❓ UNKNOWN';
  }

  /**
   * Calcula stop e múltiplos targets usando ATR (como no PineScript)
   * @param {object} data - Dados de mercado
   * @param {number} price - Preço atual
   * @param {string} action - Ação (long/short)
   * @returns {object|null} - Stop e array de targets
   */
  calculateStopAndMultipleTargets(data, price, action) {
    try {
      // Configurações das zonas de objetivo
      const ATR_ZONE_MULTIPLIER = 3.5;
      const SL_ATR_MULTIPLIER = 8.0;
      const MAX_TARGETS_PER_ORDER = Number(process.env.MAX_TARGETS_PER_ORDER || 20);
      
      // Obtém o timeframe atual
      const timeframe = process.env.TIME || '5m';
      
      // Ajusta o multiplicador ATR baseado no timeframe
      const timeframeMultiplier = this.getTimeframeMultiplier(timeframe);
      const adjustedATRMultiplier = ATR_ZONE_MULTIPLIER * timeframeMultiplier;
      
      // Usa ATR dos dados ou calcula
      const atr = data.atr?.atr || 0;
      if (!atr || atr <= 0) {
        console.log(`⚠️ ATR não disponível para ${data.market.symbol}`);
        return null;
      }

      // Calcula distância baseada no ATR
      const distance = atr * adjustedATRMultiplier;
      
      let stop;
      const targets = [];
      
      if (action === 'long') {
        // Stop Loss para LONG
        stop = price - (atr * SL_ATR_MULTIPLIER);
        
        // Múltiplos targets para LONG (como no PineScript)
        for (let i = 0; i < MAX_TARGETS_PER_ORDER; i++) {
          const targetLevel = price + distance * (i + 1);
          if (targetLevel > 0) {
            targets.push(targetLevel);
          }
        }
      } else {
        // Stop Loss para SHORT
        stop = price + (atr * SL_ATR_MULTIPLIER);
        
        // Múltiplos targets para SHORT (como no PineScript)
        for (let i = 0; i < MAX_TARGETS_PER_ORDER; i++) {
          const targetLevel = price - distance * (i + 1);
          if (targetLevel > 0) {
            targets.push(targetLevel);
          }
        }
      }

      // Validações de segurança
      if (stop <= 0 || targets.length === 0) {
        console.log(`⚠️ Stop ou targets inválidos para ${data.market.symbol}`);
        return null;
      }

      console.log(`🎯 ${data.market.symbol}: ${action.toUpperCase()} - Stop: ${stop.toFixed(6)} - Targets: ${targets.length} (${targets.slice(0, 3).map(t => t.toFixed(6)).join(', ')}${targets.length > 3 ? '...' : ''}`);

      return { stop, targets };

    } catch (error) {
      console.error('ProMaxStrategy.calculateStopAndMultipleTargets - Error:', error);
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
      '1m': 0.5,    // Timeframes pequenos: multiplicador menor para alvos mais próximos
      '3m': 0.7,
      '5m': 1.0,    // Base
      '15m': 1.2,
      '30m': 1.5,
      '1h': 2.0,    // Timeframes maiores: multiplicador maior para alvos mais distantes
      '2h': 2.5,
      '4h': 3.0,
      '1d': 4.0
    };

    return multipliers[timeframe] || 1.0;
  }
} 