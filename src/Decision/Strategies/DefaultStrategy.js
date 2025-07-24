import { BaseStrategy } from './BaseStrategy.js';
import Markets from '../../Backpack/Public/Markets.js';
import { calculateIndicators } from '../Indicators.js';

export class DefaultStrategy extends BaseStrategy {
  /**
   * Implementação da estratégia DEFAULT com novas regras
   * @param {number} fee - Taxa da exchange
   * @param {object} data - Dados de mercado com indicadores
   * @param {number} investmentUSD - Valor a investir
   * @param {number} media_rsi - Média do RSI de todos os mercados
   * @param {object} config - Configuração adicional
   * @param {string} btcTrend - Tendência do BTC (BULLISH/BEARISH/NEUTRAL)
   * @returns {object|null} - Objeto com decisão de trading ou null se não houver sinal
   */
  async analyzeTrade(fee, data, investmentUSD, media_rsi, config = null, btcTrend = 'NEUTRAL') {
    try {
      // Validação inicial dos dados
      if (!this.validateData(data)) {
        return null;
      }

      // NOVA LÓGICA DE DECISÃO
      const signals = this.analyzeSignals(data);
      
      if (!signals.hasSignal) {
        return null;
      }

      // FILTRO DE CONFIRMAÇÃO MONEY FLOW
      const moneyFlowValidation = this.validateMoneyFlowConfirmation(data, signals.isLong, data.market.symbol === 'BTC_USDC_PERP');
      
      if (!moneyFlowValidation.isValid) {
        console.log(`❌ ${data.market.symbol}: Sinal ${signals.signalType} rejeitado - ${moneyFlowValidation.reason}`);
        console.log(`   💰 Money Flow: ${moneyFlowValidation.details}`);
        return null;
      }

      console.log(`✅ ${data.market.symbol}: Money Flow confirma ${signals.isLong ? 'LONG' : 'SHORT'} - ${moneyFlowValidation.details}`);

      // FILTRO DE TENDÊNCIA DO BTC (usando tendência já calculada)
      if (data.market.symbol !== 'BTC_USDC_PERP') {
        // Só permite operações quando BTC tem tendência clara (BULLISH ou BEARISH)
        if (btcTrend === 'NEUTRAL') {
          return null; // BTC neutro - não operar em altcoins
        }

        // Validação restritiva: só permite operações alinhadas com a tendência do BTC
        if (signals.isLong && btcTrend === 'BEARISH') {
          return null; // BTC em baixa - não entrar LONG em altcoins
        }

        if (!signals.isLong && btcTrend === 'BULLISH') {
          return null; // BTC em alta - não entrar SHORT em altcoins
        }
      }

      const action = signals.isLong ? 'long' : 'short';
      const price = parseFloat(data.marketPrice);

      // Cálculo de stop e target usando VWAP
      const stopTarget = this.calculateStopAndTarget(data, price, signals.isLong);
      if (!stopTarget) {
        return null;
      }

      const { stop, target } = stopTarget;
      const entry = price;
      
      // Log detalhado dos valores calculados
      console.log(`\n📊 [DEFAULT] ${data.market.symbol}: Entry: ${entry.toFixed(6)}, Stop: ${stop.toFixed(6)} (${((Math.abs(entry - stop) / entry) * 100).toFixed(2)}%), Target: ${target.toFixed(6)} (${((Math.abs(target - entry) / entry) * 100).toFixed(2)}%)`);

      // Cálculo de PnL e risco
      const { pnl, risk } = this.calculatePnLAndRisk(action, entry, stop, target, investmentUSD, fee);

      // Log mais claro sobre a tendência do BTC
      let btcTrendMsg;
      if (data.market.symbol === 'BTC_USDC_PERP') {
        btcTrendMsg = 'TENDÊNCIA ATUAL DO BTC';
      } else if (btcTrend === 'BULLISH') {
        btcTrendMsg = 'BTC em alta (favorável)';
      } else if (btcTrend === 'BEARISH') {
        btcTrendMsg = 'BTC em baixa (favorável)';
      } else if (btcTrend === 'NEUTRAL') {
        btcTrendMsg = 'BTC neutro (não permitido)';
      } else {
        btcTrendMsg = `BTC: ${btcTrend}`;
      }
      
      console.log(`✅ ${data.market.symbol}: ${action.toUpperCase()} - Tendência: ${btcTrendMsg} - Sinal: ${signals.signalType} - Money Flow: ${moneyFlowValidation.reason}`);

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
   * Analisa os sinais baseados nas novas regras com validação de cruzamentos
   * @param {object} data - Dados de mercado com indicadores
   * @param {boolean} isBTCAnalysis - Se é análise do BTC (para logs diferentes)
   * @returns {object} - Resultado da análise de sinais
   */
  analyzeSignals(data, isBTCAnalysis = false) {
    const rsi = data.rsi;
    const stoch = data.stoch;
    const macd = data.macd;
    const adx = data.adx;

    // Validação dos indicadores essenciais (mais flexível para indicadores opcionais)
    const hasEssentialIndicators = rsi?.value !== null && rsi?.value !== undefined;
    const hasStoch = stoch?.k !== null && stoch?.k !== undefined && stoch?.d !== null && stoch?.d !== undefined;
    const hasMacd = macd?.MACD !== null && macd?.MACD !== undefined;
    const hasAdx = adx?.adx !== null && adx?.adx !== undefined && adx?.diPlus !== null && adx?.diPlus !== undefined && adx?.diMinus !== null && adx?.diMinus !== undefined;

    if (!hasEssentialIndicators) {
      if (isBTCAnalysis) {
        console.log(`   ⚠️ BTC: Indicadores essenciais incompletos - RSI: ${rsi?.value}`);
      }
      return { hasSignal: false, analysisDetails: ['Indicadores essenciais incompletos'] };
    }

    // Log de indicadores opcionais faltando
    if (isBTCAnalysis) {
      const missingIndicators = [];
      if (!hasStoch) missingIndicators.push('StochK/StochD');
      if (!hasMacd) missingIndicators.push('MACD');
      if (!hasAdx) missingIndicators.push('ADX/D+/D-');
      
      if (missingIndicators.length > 0) {
        console.log(`   ℹ️ BTC: Indicadores opcionais faltando: ${missingIndicators.join(', ')} - continuando análise`);
      }
    }

    let isLong = false;
    let isShort = false;
    let signalType = '';
    let analysisDetails = [];

    // 1. RSI com validação de cruzamento
    const rsiValue = rsi.value;
    const rsiPrev = rsi.prev;
    
    // RSI Sobrevendido para LONG (com validação de reversão)
    if (rsiValue <= 30) {
      // Verifica se RSI está subindo (reversão de sobrevendido)
      if (rsiPrev !== null && rsiPrev !== undefined && rsiValue > rsiPrev) {
        isLong = true;
        signalType = 'RSI Sobrevendido + Reversão';
        analysisDetails.push(`RSI: ${(rsiValue || 0).toFixed(1)} > ${(rsiPrev || 0).toFixed(1)} (sobrevendido + subindo)`);
      } else {
        analysisDetails.push(`RSI: ${(rsiValue || 0).toFixed(1)} (sobrevendido, mas não subindo)`);
      }
    } 
    // RSI Sobrecomprado para SHORT (com validação de reversão)
    else if (rsiValue >= 70) {
      // Verifica se RSI está caindo (reversão de sobrecomprado)
      if (rsiPrev !== null && rsiPrev !== undefined && rsiValue < rsiPrev) {
        isShort = true;
        signalType = 'RSI Sobrecomprado + Reversão';
        analysisDetails.push(`RSI: ${(rsiValue || 0).toFixed(1)} < ${(rsiPrev || 0).toFixed(1)} (sobrecomprado + caindo)`);
      } else {
        analysisDetails.push(`RSI: ${(rsiValue || 0).toFixed(1)} (sobrecomprado, mas não caindo)`);
      }
    } else {
      analysisDetails.push(`RSI: ${(rsiValue || 0).toFixed(1)} (neutro)`);
    }

    // 2. Slow Stochastic com validação de cruzamentos (se disponível)
    if (!isLong && !isShort && hasStoch) {
      const stochK = stoch.k;
      const stochD = stoch.d;
      const stochKPrev = stoch.kPrev;
      const stochDPrev = stoch.dPrev;
      
      // Slow Stochastic Sobrevendido para LONG (D cruzando acima do K estando sobrevendido)
      if (stochK <= 20 && stochD <= 20) {
        // Verifica se D está cruzando acima do K (reversão de sobrevendido)
        if (stochDPrev !== null && stochDPrev !== undefined && 
            stochKPrev !== null && stochKPrev !== undefined && 
            stochDPrev <= stochKPrev && stochD > stochK) {
          isLong = true;
          signalType = 'Stochastic Sobrevendido + Cruzamento D>K';
          analysisDetails.push(`Stoch: D(${(stochD || 0).toFixed(1)}) > K(${(stochK || 0).toFixed(1)}) | D cruzou acima (sobrevendido)`);
        } else {
          analysisDetails.push(`Stoch: K=${(stochK || 0).toFixed(1)}, D=${(stochD || 0).toFixed(1)} (sobrevendido, mas sem cruzamento)`);
        }
      } 
      // Slow Stochastic Sobrecomprado para SHORT (K cruzando acima do D estando sobrevendido)
      else if (stochK >= 80 && stochD >= 80) {
        // Verifica se K está cruzando acima do D (reversão de sobrecomprado)
        if (stochDPrev !== null && stochDPrev !== undefined && 
            stochKPrev !== null && stochKPrev !== undefined && 
            stochKPrev <= stochDPrev && stochK > stochD) {
          isShort = true;
          signalType = 'Stochastic Sobrecomprado + Cruzamento K>D';
          analysisDetails.push(`Stoch: K(${(stochK || 0).toFixed(1)}) > D(${(stochD || 0).toFixed(1)}) | K cruzou acima (sobrecomprado)`);
        } else {
          analysisDetails.push(`Stoch: K=${(stochK || 0).toFixed(1)}, D=${(stochD || 0).toFixed(1)} (sobrecomprado, mas sem cruzamento)`);
        }
      } else {
        analysisDetails.push(`Stoch: K=${(stochK || 0).toFixed(1)}, D=${(stochD || 0).toFixed(1)} (neutro)`);
      }
    } else if (hasStoch) {
      analysisDetails.push(`Stoch: K=${(stoch.k || 0).toFixed(1)}, D=${(stoch.d || 0).toFixed(1)} (já definido por RSI)`);
    } else {
      analysisDetails.push(`Stoch: Não disponível`);
    }

    // 3. MACD com validação de cruzamento (se disponível)
    if (!isLong && !isShort && hasMacd) {
      const macdValue = macd.MACD;
      const macdSignal = macd.MACD_signal;
      const macdHistogram = macd.MACD_histogram;
      const macdHistogramPrev = macd.histogramPrev;

      // Log detalhado do MACD para debug
      if (isBTCAnalysis) {
        console.log(`      • MACD Debug: Value=${(macdValue || 0).toFixed(3)}, Signal=${(macdSignal || 0).toFixed(3)}, Hist=${(macdHistogram || 0).toFixed(3)}, HistPrev=${(macdHistogramPrev || 0).toFixed(3)}`);
      }

      // Se MACD signal não estiver disponível, usa apenas o histograma
      if (macdSignal !== null && macdSignal !== undefined) {
        // MACD sobrevendido com cruzamento (histograma cruzando de negativo para positivo)
        if (macdHistogram < -0.3 && macdValue < macdSignal && 
            macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
            macdHistogramPrev < macdHistogram) {
          isLong = true;
          signalType = 'MACD Sobrevendido + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} > HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (sobrevendido + subindo)`);
        }
        // MACD sobrecomprado com cruzamento (histograma cruzando de positivo para negativo)
        else if (macdHistogram > 0.3 && macdValue > macdSignal && 
                 macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
                 macdHistogramPrev > macdHistogram) {
          isShort = true;
          signalType = 'MACD Sobrecomprado + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} < HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (sobrecomprado + caindo)`);
        }
        // MACD sobrevendido (histograma muito negativo) - sem cruzamento
        else if (macdHistogram < -0.5 && macdValue < macdSignal) {
          isLong = true;
          signalType = 'MACD Sobrevendido';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} < Signal (sobrevendido)`);
        }
        // MACD sobrecomprado (histograma muito positivo) - sem cruzamento
        else if (macdHistogram > 0.5 && macdValue > macdSignal) {
          isShort = true;
          signalType = 'MACD Sobrecomprado';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} > Signal (sobrecomprado)`);
        } else {
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (neutro)`);
        }
      } else {
        // Usa apenas o histograma sem signal (com cruzamento)
        if (macdHistogram < -0.3 && 
            macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
            macdHistogramPrev < macdHistogram) {
          isLong = true;
          signalType = 'MACD Sobrevendido + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} > HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (sobrevendido + subindo - sem signal)`);
        }
        // MACD sobrecomprado (histograma muito positivo) - sem cruzamento
        else if (macdHistogram > 0.3 && 
                 macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
                 macdHistogramPrev > macdHistogram) {
          isShort = true;
          signalType = 'MACD Sobrecomprado + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} < HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (sobrecomprado + caindo - sem signal)`);
        }
        // MACD sobrevendido (histograma muito negativo) - sem cruzamento
        else if (macdHistogram < -0.5) {
          isLong = true;
          signalType = 'MACD Sobrevendido';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (sobrevendido - sem signal)`);
        }
        // MACD sobrecomprado (histograma muito positivo) - sem cruzamento
        else if (macdHistogram > 0.5) {
          isShort = true;
          signalType = 'MACD Sobrecomprado';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (sobrecomprado - sem signal)`);
        } else {
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (neutro - sem signal)`);
        }
      }
    } else if (hasMacd) {
      analysisDetails.push(`MACD: Hist=${(macd.MACD_histogram || 0).toFixed(3)} (já definido anteriormente)`);
    } else {
      analysisDetails.push(`MACD: Não disponível`);
    }

    // 4. ADX com validação da EMA (ou sem EMA se não disponível)
    if (!isLong && !isShort && hasAdx) {
      const adxValue = adx.adx;
      const diPlus = adx.diPlus;
      const diMinus = adx.diMinus;
      const adxEma = adx.adxEma;

      // Se EMA do ADX estiver disponível, usa ela. Senão, usa threshold fixo
      const adxThreshold = (adxEma !== null && adxEma !== undefined) ? adxEma : 25;
      const useEma = (adxEma !== null && adxEma !== undefined);

      // Valida se ADX está acima do threshold
      if (adxValue > adxThreshold) {
        // D+ acima do D- para LONG
        if (diPlus > diMinus) {
          isLong = true;
          signalType = 'ADX Bullish';
          if (useEma) {
            analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} > EMA(${(adxEma || 0).toFixed(1)}) | D+(${(diPlus || 0).toFixed(1)}) > D-(${(diMinus || 0).toFixed(1)})`);
          } else {
            analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} > 25 | D+(${(diPlus || 0).toFixed(1)}) > D-(${(diMinus || 0).toFixed(1)})`);
          }
        }
        // D- acima do D+ para SHORT
        else if (diMinus > diPlus) {
          isShort = true;
          signalType = 'ADX Bearish';
          if (useEma) {
            analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} > EMA(${(adxEma || 0).toFixed(1)}) | D-(${(diMinus || 0).toFixed(1)}) > D+(${(diPlus || 0).toFixed(1)})`);
          } else {
            analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} > 25 | D-(${(diMinus || 0).toFixed(1)}) > D+(${(diPlus || 0).toFixed(1)})`);
          }
        } else {
          if (useEma) {
            analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} > EMA(${(adxEma || 0).toFixed(1)}) | D+(${(diPlus || 0).toFixed(1)}) ≈ D-(${(diMinus || 0).toFixed(1)}) (neutro)`);
          } else {
            analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} > 25 | D+(${(diPlus || 0).toFixed(1)}) ≈ D-(${(diMinus || 0).toFixed(1)}) (neutro)`);
          }
        }
      } else {
        if (useEma) {
          analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} < EMA(${(adxEma || 0).toFixed(1)}) (tendência fraca)`);
        } else {
          analysisDetails.push(`ADX: ${(adxValue || 0).toFixed(1)} < 25 (tendência fraca)`);
        }
      }
    } else if (hasAdx) {
      analysisDetails.push(`ADX: ${(adx.adx || 0).toFixed(1)} (já definido anteriormente)`);
    } else {
      analysisDetails.push(`ADX: Não disponível`);
    }

    return {
      hasSignal: isLong || isShort,
      isLong,
      isShort,
      signalType,
      analysisDetails: analysisDetails || []
    };
  }

  /**
   * Valida se o Money Flow confirma a convicção do sinal
   * @param {object} data - Dados de mercado com indicadores
   * @param {boolean} isLong - Se é sinal de compra
   * @param {boolean} isBTCAnalysis - Se é análise do BTC (para logs diferentes)
   * @returns {object} - Resultado da validação
   */
  validateMoneyFlowConfirmation(data, isLong, isBTCAnalysis = false) {
    const moneyFlow = data.moneyFlow;
    
    // Verifica se o Money Flow está disponível
    if (!moneyFlow || moneyFlow.mfi === null || moneyFlow.mfi === undefined) {
      if (isBTCAnalysis) {
        console.log(`   ⚠️ BTC: Money Flow não disponível`);
      }
      return {
        isValid: false,
        reason: 'Money Flow não disponível',
        details: 'Indicador Money Flow não encontrado nos dados'
      };
    }

    const mfi = moneyFlow.mfi;
    const mfiAvg = moneyFlow.mfiAvg;
    const mfiValue = moneyFlow.value; // MFI - Média do MFI
    const isBullish = moneyFlow.isBullish;
    const isBearish = moneyFlow.isBearish;
    const isStrong = moneyFlow.isStrong;
    const direction = moneyFlow.direction;

    let isValid = false;
    let reason = '';
    let details = '';

    if (isLong) {
      // Para sinal LONG: MFI > 50 E mfiValue > 0 (LÓGICA AND - MAIS ROBUSTA)
      if (mfi > 50 && (mfiValue !== null && mfiValue > 0)) {
        isValid = true;
        reason = 'Money Flow confirma LONG';
        details = `MFI: ${(mfi || 0).toFixed(1)} > 50 E mfiValue: ${(mfiValue || 0).toFixed(1)} > 0`;
      } else {
        isValid = false;
        reason = 'Money Flow não confirma LONG';
        details = `MFI: ${(mfi || 0).toFixed(1)} <= 50 OU mfiValue: ${(mfiValue || 0).toFixed(1)} <= 0`;
      }
    } else {
      // Para sinal SHORT: MFI < 50 E mfiValue < 0 (LÓGICA AND - MAIS ROBUSTA)
      if (mfi < 50 && (mfiValue !== null && mfiValue < 0)) {
        isValid = true;
        reason = 'Money Flow confirma SHORT';
        details = `MFI: ${(mfi || 0).toFixed(1)} < 50 E mfiValue: ${(mfiValue || 0).toFixed(1)} < 0`;
      } else {
        isValid = false;
        reason = 'Money Flow não confirma SHORT';
        details = `MFI: ${(mfi || 0).toFixed(1)} >= 50 OU mfiValue: ${(mfiValue || 0).toFixed(1)} >= 0`;
      }
    }

    // Log detalhado do Money Flow
    if (isBTCAnalysis) {
      console.log(`   💰 BTC Money Flow: MFI=${(mfi || 0).toFixed(1)}, Avg=${(mfiAvg || 0).toFixed(1)}, Value=${(mfiValue || 0).toFixed(1)}, Direction=${direction}, Strong=${isStrong}`);
      console.log(`   ${isValid ? '✅' : '❌'} BTC: ${reason} - ${details}`);
    }

    return {
      isValid,
      reason,
      details,
      mfi,
      mfiAvg,
      mfiValue,
      isBullish,
      isBearish,
      isStrong,
      direction
    };
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
      
      // Análise de tendência do BTC usando a mesma lógica da estratégia
      const btcSignals = this.analyzeSignals(btcIndicators, true);
      
      // Determina tendência do BTC
      let btcTrend = 'NEUTRAL';
      if (btcSignals.isLong) {
        btcTrend = 'BULLISH';
      } else if (btcSignals.isShort) {
        btcTrend = 'BEARISH';
      }

      // Validação mais restritiva: só permite operações alinhadas com a tendência do BTC
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

      // Se BTC está neutro, permite ambas as operações
      // Se BTC está bullish, só permite LONG
      // Se BTC está bearish, só permite SHORT
      if (btcTrend === 'BULLISH' && !isLong) {
        return { 
          isValid: false, 
          btcTrend, 
          reason: 'BTC em tendência de alta - só permitir LONG em altcoins' 
        };
      }

      if (btcTrend === 'BEARISH' && isLong) {
        return { 
          isValid: false, 
          btcTrend, 
          reason: 'BTC em tendência de baixa - só permitir SHORT em altcoins' 
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