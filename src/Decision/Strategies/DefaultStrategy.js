import { BaseStrategy } from './BaseStrategy.js';
import Markets from '../../Backpack/Public/Markets.js';
import { calculateIndicators } from '../Indicators.js';
import OrderController from '../../Controllers/OrderController.js';

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

      // FILTRO DE TENDÊNCIA VWAP (sentimento intradiário)
      const vwapValidation = this.validateVWAPTrend(data, signals.isLong, data.market.symbol === 'BTC_USDC_PERP');
      
      if (!vwapValidation.isValid) {
        console.log(`❌ ${data.market.symbol}: Sinal ${signals.signalType} rejeitado - ${vwapValidation.reason}`);
        console.log(`   📊 VWAP: ${vwapValidation.details}`);
        return null;
      }

      console.log(`✅ ${data.market.symbol}: VWAP confirma ${signals.isLong ? 'LONG' : 'SHORT'} - ${vwapValidation.details}`);

      // FILTRO DE TENDÊNCIA DO BTC (usando tendência já calculada)
      if (data.market.symbol !== 'BTC_USDC_PERP') {
        // Só permite operações quando BTC tem tendência clara (BULLISH ou BEARISH)
        if (btcTrend === 'NEUTRAL') {
          return null; // BTC neutro - não operar em altcoins
        }

        // Validação restritiva: só permite operações alinhadas com a tendência do BTC
        if (signals.isLong && btcTrend === 'BEARISH') {
          console.log(`❌ ${data.market.symbol}: Sinal ${signals.signalType} rejeitado - BTC em tendência BEARISH (não permite LONG em altcoins)`);
          return null; // BTC em baixa - não entrar LONG em altcoins
        }

        if (!signals.isLong && btcTrend === 'BULLISH') {
          console.log(`❌ ${data.market.symbol}: Sinal ${signals.signalType} rejeitado - BTC em tendência BULLISH (não permite SHORT em altcoins)`);
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
      
      console.log(`✅ ${data.market.symbol}: ${action.toUpperCase()} - Tendência: ${btcTrendMsg} - Sinal: ${signals.signalType} - Money Flow: ${moneyFlowValidation.reason} - VWAP: ${vwapValidation.reason}`);

      // NOVO: Chamada do fluxo híbrido de execução de ordem
      const orderResult = await OrderController.openHybridOrder({
        entry,
        stop,
        target,
        action,
        market: data.market.symbol,
        volume: investmentUSD,
        decimal_quantity: data.market.decimal_quantity,
        decimal_price: data.market.decimal_price,
        stepSize_quantity: data.market.stepSize_quantity,
        accountId: data.accountId || 'DEFAULT',
        originalSignalData: { signals, moneyFlowValidation, vwapValidation, btcTrend, data }
      });
      return {
        market: data.market.symbol,
        entry: Number(entry.toFixed(data.market.decimal_price)),
        stop: Number(stop.toFixed(data.market.decimal_price)),
        target: Number(target.toFixed(data.market.decimal_price)),
        action,
        pnl,
        risk,
        orderResult
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
    const hasMomentum = data.momentum?.rsi !== null && data.momentum?.rsi !== undefined;
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
      if (!hasMomentum) missingIndicators.push('Momentum');
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

    // 1. ANÁLISE DE MOMENTUM (RSI Avançado) - SUBSTITUI RSI SIMPLES
    const momentum = data.momentum;
    
    if (momentum && momentum.rsi !== null && momentum.rsi !== undefined) {
      const momentumRsi = momentum.rsi;
      const momentumValue = momentum.momentumValue;
      const isBullish = momentum.isBullish;
      const isBearish = momentum.isBearish;
      const reversal = momentum.reversal;
      
      // Log detalhado do Momentum para debug
      if (isBTCAnalysis) {
        console.log(`      • Momentum Debug: RSI=${(momentumRsi || 0).toFixed(1)}, Value=${(momentumValue || 0).toFixed(3)}, Bullish=${isBullish}, Bearish=${isBearish}, Reversal=${reversal?.type || 'NONE'}`);
      }
      
      // SINAL DE LONG (Compra) - NOVA LÓGICA AVANÇADA
      // Condição A (Cruzamento - Sinal Forte): momentum.reversal.type === 'GREEN'
      // Condição B (Sobrevenda com Confirmação): momentum.rsi <= 30 && momentum.isBullish
      if (reversal && reversal.type === 'GREEN') {
        isLong = true;
        signalType = 'Momentum Cruzamento GREEN';
        analysisDetails.push(`Momentum: Cruzamento GREEN (RSI=${(momentumRsi || 0).toFixed(1)}, Value=${(momentumValue || 0).toFixed(3)}) - Sinal Forte`);
      } else if (momentumRsi <= 30 && isBullish) {
        isLong = true;
        signalType = 'Momentum Sobrevenda + Confirmação';
        analysisDetails.push(`Momentum: RSI=${(momentumRsi || 0).toFixed(1)} <= 30 + Bullish=${isBullish} (sobrevenda com confirmação)`);
      } else if (momentumRsi <= 30) {
        analysisDetails.push(`Momentum: RSI=${(momentumRsi || 0).toFixed(1)} <= 30 (sobrevenda, mas sem confirmação bullish)`);
      }
      
      // SINAL DE SHORT (Venda) - NOVA LÓGICA AVANÇADA
      // Condição A (Cruzamento - Sinal Forte): momentum.reversal.type === 'RED'
      // Condição B (Sobrecompra com Confirmação): momentum.rsi >= 70 && momentum.isBearish
      else if (reversal && reversal.type === 'RED') {
        isShort = true;
        signalType = 'Momentum Cruzamento RED';
        analysisDetails.push(`Momentum: Cruzamento RED (RSI=${(momentumRsi || 0).toFixed(1)}, Value=${(momentumValue || 0).toFixed(3)}) - Sinal Forte`);
      } else if (momentumRsi >= 70 && isBearish) {
        isShort = true;
        signalType = 'Momentum Sobrecompra + Confirmação';
        analysisDetails.push(`Momentum: RSI=${(momentumRsi || 0).toFixed(1)} >= 70 + Bearish=${isBearish} (sobrecompra com confirmação)`);
      } else if (momentumRsi >= 70) {
        analysisDetails.push(`Momentum: RSI=${(momentumRsi || 0).toFixed(1)} >= 70 (sobrecompra, mas sem confirmação bearish)`);
      }
      
      // CASO NEUTRO
      else {
        analysisDetails.push(`Momentum: RSI=${(momentumRsi || 0).toFixed(1)}, Value=${(momentumValue || 0).toFixed(3)} (neutro)`);
      }
    } else {
      analysisDetails.push(`Momentum: Não disponível`);
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
      analysisDetails.push(`Stoch: K=${(stoch.k || 0).toFixed(1)}, D=${(stoch.d || 0).toFixed(1)} (já definido por Momentum)`);
    } else {
      analysisDetails.push(`Stoch: Não disponível`);
    }

    // 3. MACD com validação de momentum e tendência (CORRIGIDO)
    if (!isLong && !isShort && hasMacd) {
      const macdValue = macd.MACD;
      const macdSignal = macd.MACD_signal;
      const macdHistogram = macd.MACD_histogram;
      const macdHistogramPrev = macd.histogramPrev;

      // Log detalhado do MACD para debug
      if (isBTCAnalysis) {
        console.log(`      • MACD Debug: Value=${(macdValue || 0).toFixed(3)}, Signal=${(macdSignal || 0).toFixed(3)}, Hist=${(macdHistogram || 0).toFixed(3)}, HistPrev=${(macdHistogramPrev || 0).toFixed(3)}`);
      }

      // NOVA LÓGICA: MACD como indicador de momentum e tendência (NÃO sobrecompra/sobrevenda)
      if (macdSignal !== null && macdSignal !== undefined) {
        // MACD BULLISH: Histograma positivo (momentum de alta) + cruzamento de baixo para cima
        if (macdHistogram > 0 && macdValue > macdSignal && 
            macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
            macdHistogramPrev < macdHistogram) {
          isLong = true;
          signalType = 'MACD Bullish + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} > HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (bullish + momentum crescente)`);
        }
        // MACD BEARISH: Histograma negativo (momentum de baixa) + cruzamento de cima para baixo
        else if (macdHistogram < 0 && macdValue < macdSignal && 
                 macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
                 macdHistogramPrev > macdHistogram) {
          isShort = true;
          signalType = 'MACD Bearish + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} < HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (bearish + momentum decrescente)`);
        }
        // MACD BULLISH forte (histograma muito positivo) - sem cruzamento
        else if (macdHistogram > 0.5 && macdValue > macdSignal) {
          isLong = true;
          signalType = 'MACD Bullish Forte';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} > Signal (bullish forte)`);
        }
        // MACD BEARISH forte (histograma muito negativo) - sem cruzamento
        else if (macdHistogram < -0.5 && macdValue < macdSignal) {
          isShort = true;
          signalType = 'MACD Bearish Forte';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} < Signal (bearish forte)`);
        } else {
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (neutro)`);
        }
      } else {
        // Usa apenas o histograma sem signal (com cruzamento)
        if (macdHistogram > 0.3 && 
            macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
            macdHistogramPrev < macdHistogram) {
          isLong = true;
          signalType = 'MACD Bullish + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} > HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (bullish + momentum crescente - sem signal)`);
        }
        // MACD BEARISH (histograma negativo) - sem cruzamento
        else if (macdHistogram < -0.3 && 
                 macdHistogramPrev !== null && macdHistogramPrev !== undefined && 
                 macdHistogramPrev > macdHistogram) {
          isShort = true;
          signalType = 'MACD Bearish + Cruzamento';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} < HistPrev=${(macdHistogramPrev || 0).toFixed(3)} (bearish + momentum decrescente - sem signal)`);
        }
        // MACD BULLISH forte (histograma muito positivo) - sem cruzamento
        else if (macdHistogram > 0.5) {
          isLong = true;
          signalType = 'MACD Bullish Forte';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (bullish forte - sem signal)`);
        }
        // MACD BEARISH forte (histograma muito negativo) - sem cruzamento
        else if (macdHistogram < -0.5) {
          isShort = true;
          signalType = 'MACD Bearish Forte';
          analysisDetails.push(`MACD: Hist=${(macdHistogram || 0).toFixed(3)} (bearish forte - sem signal)`);
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
   * Valida se o VWAP confirma a tendência intradiária
   * @param {object} data - Dados de mercado com indicadores
   * @param {boolean} isLong - Se é sinal de compra
   * @param {boolean} isBTCAnalysis - Se é análise do BTC (para logs diferentes)
   * @returns {object} - Resultado da validação
   */
  validateVWAPTrend(data, isLong, isBTCAnalysis = false) {
    const vwap = data.vwap;
    const currentPrice = parseFloat(data.marketPrice);
    
    // Verifica se o VWAP está disponível
    if (!vwap || vwap.vwap === null || vwap.vwap === undefined) {
      if (isBTCAnalysis) {
        console.log(`   ⚠️ BTC: VWAP não disponível`);
      }
      return {
        isValid: false,
        reason: 'VWAP não disponível',
        details: 'Indicador VWAP não encontrado nos dados'
      };
    }

    const vwapValue = vwap.vwap;
    const stdDev = vwap.stdDev;
    const upperBand = vwap.upperBands;
    const lowerBand = vwap.lowerBands;

    let isValid = false;
    let reason = '';
    let details = '';

    if (isLong) {
      // Para sinal LONG: Preço atual deve estar acima do VWAP
      if (currentPrice > vwapValue) {
        isValid = true;
        reason = 'VWAP confirma LONG';
        details = `Preço: ${currentPrice.toFixed(6)} > VWAP: ${vwapValue.toFixed(6)} (sentimento intradiário bullish)`;
      } else {
        isValid = false;
        reason = 'VWAP não confirma LONG';
        details = `Preço: ${currentPrice.toFixed(6)} <= VWAP: ${vwapValue.toFixed(6)} (sentimento intradiário bearish)`;
      }
    } else {
      // Para sinal SHORT: Preço atual deve estar abaixo do VWAP
      if (currentPrice < vwapValue) {
        isValid = true;
        reason = 'VWAP confirma SHORT';
        details = `Preço: ${currentPrice.toFixed(6)} < VWAP: ${vwapValue.toFixed(6)} (sentimento intradiário bearish)`;
      } else {
        isValid = false;
        reason = 'VWAP não confirma SHORT';
        details = `Preço: ${currentPrice.toFixed(6)} >= VWAP: ${vwapValue.toFixed(6)} (sentimento intradiário bullish)`;
      }
    }

    // Log detalhado do VWAP
    if (isBTCAnalysis) {
      console.log(`   📊 BTC VWAP: Preço=${currentPrice.toFixed(6)}, VWAP=${vwapValue.toFixed(6)}, StdDev=${(stdDev || 0).toFixed(6)}`);
      console.log(`   ${isValid ? '✅' : '❌'} BTC: ${reason} - ${details}`);
    }

    return {
      isValid,
      reason,
      details,
      currentPrice,
      vwapValue,
      stdDev,
      upperBand,
      lowerBand
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