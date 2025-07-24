import { EMA, RSI, MACD, BollingerBands, ATR, Stochastic, ADX, MFI } from 'technicalindicators';

/**
 * Calcula o VWAP e suas bandas de desvio padrão da forma correta (cumulativo com reset diário).
 * @param {Array<Object>} candles - Array de candles, ordenados do mais antigo para o mais novo.
 * @returns {Array<Object>} - Um array de objetos, cada um com { vwap, stdDev, upperBands, lowerBands } para cada vela.
 */
function calculateIntradayVWAP(candles) {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDay = null;
  const vwapHistory = [];

  // Este array irá guardar as velas da sessão atual para calcular o desvio padrão
  let sessionCandles = [];

  for (const c of candles) {
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    const close = parseFloat(c.close);
    const volume = parseFloat(c.volume);

    // Usa a data de início da vela para detectar a mudança de dia
    const candleDay = new Date(c.start).getUTCDate();

    // Se o dia mudou, reseta os contadores e a sessão
    if (candleDay !== currentDay) {
      currentDay = candleDay;
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      sessionCandles = [];
    }
    
    // Validação para evitar dados inválidos
    if (isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
      vwapHistory.push(vwapHistory.length > 0 ? vwapHistory[vwapHistory.length-1] : { vwap: close }); // Repete o último valor válido
      continue;
    }

    // Acumula os valores da sessão atual
    const typicalPrice = (high + low + close) / 3;
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
    sessionCandles.push({ typicalPrice, volume });

    // Calcula o VWAP para a vela atual
    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;

    // --- Cálculo do Desvio Padrão para a sessão atual ---
    let sumVarV = 0;
    for (const sc of sessionCandles) {
      const diff = sc.typicalPrice - vwap;
      sumVarV += sc.volume * diff * diff;
    }
    
    const variance = cumulativeVolume > 0 ? sumVarV / cumulativeVolume : 0;
    const stdDev = Math.sqrt(variance);

    // Adiciona o resultado do VWAP e suas bandas para esta vela ao histórico
    vwapHistory.push({
      vwap,
      stdDev,
      upperBands: [vwap + stdDev, vwap + (2 * stdDev), vwap + (3 * stdDev)],
      lowerBands: [vwap - stdDev, vwap - (2 * stdDev), vwap - (3 * stdDev)],
    });
  }

  return vwapHistory;
}

/**
 * Função WaveTrend (MOMENTUM) - Baseada no PineScript CypherPunk
 * @param {Array} candles - Array de candles
 * @param {number} channelLen - Comprimento do Canal (padrão: 9)
 * @param {number} avgLen - Comprimento da Média (padrão: 12)
 * @param {number} maLen - Comprimento da MA do Sinal (padrão: 3)
 * @returns {Object} - Dados do WaveTrend
 */
function calculateWaveTrend(candles, channelLen = 9, avgLen = 12, maLen = 3) {
  if (candles.length < Math.max(channelLen, avgLen, maLen)) {
    return {
      wt1: null,
      wt2: null,
      vwap: null,
      reversal: null,
      isBullish: false,
      isBearish: false
    };
  }

  const hlc3 = candles.map(c => (parseFloat(c.high) + parseFloat(c.low) + parseFloat(c.close)) / 3);
  
  // Calcular ESA (EMA do HLC3)
  const esa = EMA.calculate({ period: channelLen, values: hlc3 });
  
  // Calcular DE (EMA do valor absoluto da diferença)
  const deValues = [];
  for (let i = 0; i < hlc3.length; i++) {
    if (esa[i] !== null && esa[i] !== undefined && !isNaN(esa[i])) {
      deValues.push(Math.abs(hlc3[i] - esa[i]));
    } else {
      deValues.push(0);
    }
  }
  const de = EMA.calculate({ period: channelLen, values: deValues });
  
  // Calcular CI (Chande Momentum Oscillator)
  const ci = [];
  for (let i = 0; i < hlc3.length; i++) {
    if (esa[i] !== null && de[i] !== null && de[i] !== 0 && !isNaN(esa[i]) && !isNaN(de[i])) {
      const ciValue = (hlc3[i] - esa[i]) / (0.015 * de[i]);
      ci.push(isNaN(ciValue) ? 0 : ciValue);
    } else {
      ci.push(0);
    }
  }
  
  // Calcular WT1 (EMA do CI)
  const wt1 = EMA.calculate({ period: avgLen, values: ci });
  
  // Calcular WT2 (SMA do WT1)
  const wt2 = [];
  for (let i = 0; i < wt1.length; i++) {
    if (i >= maLen - 1) {
      const validValues = wt1.slice(i - maLen + 1, i + 1).filter(val => val !== null && !isNaN(val));
      if (validValues.length > 0) {
        const sum = validValues.reduce((acc, val) => acc + val, 0);
        wt2.push(sum / validValues.length);
      } else {
        wt2.push(0);
      }
    } else {
      wt2.push(null);
    }
  }
  
  // Calcular VWAP (WT1 - WT2)
  const vwap = [];
  for (let i = 0; i < wt1.length; i++) {
    if (wt1[i] !== null && wt2[i] !== null && !isNaN(wt1[i]) && !isNaN(wt2[i])) {
      vwap.push(wt1[i] - wt2[i]);
    } else {
      vwap.push(null);
    }
  }
  
  // Detectar reversão
  let reversal = null;
  if (wt1.length >= 2 && wt2.length >= 2) {
    const currentWt1 = wt1[wt1.length - 1];
    const prevWt1 = wt1[wt1.length - 2];
    const currentWt2 = wt2[wt2.length - 1];
    const prevWt2 = wt2[wt2.length - 2];
    
    if (currentWt1 !== null && prevWt1 !== null && currentWt2 !== null && prevWt2 !== null &&
        !isNaN(currentWt1) && !isNaN(prevWt1) && !isNaN(currentWt2) && !isNaN(prevWt2)) {
      // Crossover (Golden Cross)
      if (prevWt1 <= prevWt2 && currentWt1 > currentWt2) {
        reversal = { type: 'GREEN', strength: Math.abs(currentWt1 - currentWt2) };
      }
      // Crossunder (Death Cross)
      else if (prevWt1 >= prevWt2 && currentWt1 < currentWt2) {
        reversal = { type: 'RED', strength: Math.abs(currentWt1 - currentWt2) };
      }
    }
  }
  
  const currentWt1 = wt1[wt1.length - 1];
  const currentWt2 = wt2[wt2.length - 1];
  const currentVwap = vwap[vwap.length - 1];
  
  return {
    wt1: currentWt1,
    wt2: currentWt2,
    vwap: currentVwap,
    reversal: reversal,
    isBullish: currentWt1 !== null && currentWt2 !== null && !isNaN(currentWt1) && !isNaN(currentWt2) && currentWt1 > currentWt2,
    isBearish: currentWt1 !== null && currentWt2 !== null && !isNaN(currentWt1) && !isNaN(currentWt2) && currentWt1 < currentWt2,
    history: {
      wt1: wt1,
      wt2: wt2,
      vwap: vwap
    }
  };
}

/**
 * Calcula o Money Flow Index (MFI) e seus sinais derivados.
 * @param {Array<Object>} candles - Array de candles.
 * @param {number} mfiPeriod - Período para o cálculo do MFI (padrão: 14).
 * @param {number} signalPeriod - Período para a média móvel (SMA) do MFI (padrão: 9).
 * @returns {Object} - Um objeto contendo os dados do Money Flow.
 */
function calculateMoneyFlow(candles, mfiPeriod = 14, signalPeriod = 9) {
  // A validação de quantidade de velas está correta
  if (candles.length < mfiPeriod + 1) {
    return {
      value: 0, mfi: 50, mfiAvg: 50, isBullish: false, isBearish: false,
      isStrong: false, direction: 'NEUTRAL', history: []
    };
  }

  // --- Passo 1: Calcular o Fluxo de Dinheiro Bruto com conversão de dados ---
  const moneyFlows = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];

    // **A CORREÇÃO ESTÁ AQUI**
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    const close = parseFloat(c.close);
    const volume = parseFloat(c.volume);

    const prevHigh = parseFloat(p.high);
    const prevLow = parseFloat(p.low);
    const prevClose = parseFloat(p.close);
    
    // Validar se os dados são numéricos após a conversão
    if (isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) continue;

    const typicalPrice = (high + low + close) / 3;
    const prevTypicalPrice = (prevHigh + prevLow + prevClose) / 3;
    const rawMoneyFlow = typicalPrice * volume;

    moneyFlows.push({
      positive: typicalPrice > prevTypicalPrice ? rawMoneyFlow : 0,
      negative: typicalPrice < prevTypicalPrice ? rawMoneyFlow : 0,
    });
  }
  
  // O resto da função continua igual, pois agora ela receberá os dados corretos...
  
  // --- Passo 2: Calcular o histórico de MFI ---
  const mfiHistory = [];
  // (código omitido para brevidade, continua o mesmo da resposta anterior)
  for (let i = mfiPeriod - 1; i < moneyFlows.length; i++) {
    const slice = moneyFlows.slice(i - mfiPeriod + 1, i + 1);
    const totalPositiveFlow = slice.reduce((sum, val) => sum + val.positive, 0);
    const totalNegativeFlow = slice.reduce((sum, val) => sum + val.negative, 0);

    if (totalNegativeFlow === 0) {
      mfiHistory.push(100);
      continue;
    }

    const moneyRatio = totalPositiveFlow / totalNegativeFlow;
    const mfi = 100 - (100 / (1 + moneyRatio));
    mfiHistory.push(mfi);
  }

  // --- Passo 3: Calcular a média (linha de sinal) do MFI ---
  const mfiAvgHistory = [];
  if (mfiHistory.length >= signalPeriod) {
      for (let i = signalPeriod - 1; i < mfiHistory.length; i++) {
          const smaSlice = mfiHistory.slice(i - signalPeriod + 1, i + 1);
          const sma = smaSlice.reduce((sum, val) => sum + val, 0) / signalPeriod;
          mfiAvgHistory.push(sma);
      }
  }

  // --- Passo 4: Obter os valores atuais e calcular o resultado final ---
  const currentMfi = mfiHistory[mfiHistory.length - 1] || 50;
  const currentMfiAvg = mfiAvgHistory[mfiAvgHistory.length - 1] || 50;
  const mfiValue = currentMfi - currentMfiAvg;
  
  // --- Passo 5: Montar o objeto de retorno ---
  return {
    value: mfiValue,
    mfi: currentMfi,
    mfiAvg: currentMfiAvg,
    isBullish: mfiValue > 0,
    isBearish: mfiValue < 0,
    isStrong: Math.abs(mfiValue) > 10,
    direction: mfiValue > 0 ? 'UP' : (mfiValue < 0 ? 'DOWN' : 'NEUTRAL'),
    history: mfiHistory
  };
}

function findEMACross(ema9Arr, ema21Arr) {
  const len = Math.min(ema9Arr.length, ema21Arr.length);

  for (let i = len - 2; i >= 0; i--) {
    const currEma9 = ema9Arr[i + 1];
    const prevEma9 = ema9Arr[i];
    const currEma21 = ema21Arr[i + 1];
    const prevEma21 = ema21Arr[i];

    // Detecta cruzamentos
    if (prevEma9 <= prevEma21 && currEma9 > currEma21) {
      return { index: i, type: 'goldenCross' };
    }
    if (prevEma9 >= prevEma21 && currEma9 < currEma21) {
      return { index: i, type: 'deathCross' };
    }
  }

  return null;
}

function  analyzeEMA(ema9Arr, ema21Arr) {
  const len = ema9Arr.length;
  if (len < 2 || ema21Arr.length < 2) return null;

  const lastEma9  = ema9Arr[ema9Arr.length - 1];
  const lastEma21 = ema21Arr[ema21Arr.length - 1];
  const prevEma9  = ema9Arr[ema9Arr.length - 2];
  const prevEma21 = ema21Arr[ema21Arr.length - 2];

  if (lastEma9 == null || lastEma21 == null || prevEma9 == null || prevEma21 == null) {
    return null;
  }

  // diferença absoluta e percentual
  const diff    = lastEma9 - lastEma21;
  const diffPct = (diff / lastEma21) * 100;

  // sinal básico
  const signal = diff > 0 ? 'bullish' : 'bearish';

  // detectar cruzamento no último candle
  let crossed = null;
  if (prevEma9 <= prevEma21 && lastEma9 > lastEma21) {
    crossed = 'goldenCross';
  } else if (prevEma9 >= prevEma21 && lastEma9 < lastEma21) {
    crossed = 'deathCross';
  }

  return {
    ema9:    lastEma9,
    ema21:   lastEma21,
    diff,
    diffPct,
    signal,
    crossed
  };
}

function analyzeTrends(data) {
  const n = data.length;
  const result = {};
  const metrics = ['volume', 'variance', 'price'];

  // soma dos índices de 0 a n-1 e sum(x^2) podem ser pré-calculados
  const sumX = (n - 1) * n / 2;
  const sumXX = (n - 1) * n * (2 * n - 1) / 6;

  metrics.forEach((metric) => {
    let sumY = 0;
    let sumXY = 0;

    data.forEach((d, i) => {
      const y = d[metric];
      sumY += y;
      sumXY += i * y;
    });

    // slope = (n * Σ(xᵢyᵢ) - Σxᵢ * Σyᵢ) / (n * Σ(xᵢ²) - (Σxᵢ)²)
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // intercept = mean(y) - slope * mean(x)
    const intercept = (sumY / n) - slope * (sumX / n);

    // previsão para o próximo ponto (índice n)
    const forecast = slope * n + intercept;

    // tendência
    const trend = slope > 0
      ? 'increasing'
      : slope < 0
        ? 'decreasing'
        : 'flat';

    result[metric] = {
      trend,
      slope,
      forecast
    };
  });

  return result;
}

/**
 * Calcula o MOMENTUM para a estratégia CypherPunk
 * Baseado em RSI e análise de tendência
 * @param {Array<number>} closes - Array de preços de fechamento
 * @returns {Object} - Dados do momentum
 */
function calculateMomentum(closes) {
  if (closes.length < 15) { // Precisa de pelo menos 14 para o RSI e 1 para a média
    return { /* ... seu objeto de retorno padrão ... */ };
  }

  const rsiHistory = RSI.calculate({ period: 14, values: closes });
  
  // Calcula o histórico do momentumValue (RSI - Média do RSI)
  const momentumHistory = [];
  const rsiAvgHistory = [];

  for (let i = 13; i < rsiHistory.length; i++) { // Começa após ter 14 valores de RSI
    const rsiSlice = rsiHistory.slice(i - 13, i + 1);
    const rsiAvg = rsiSlice.reduce((sum, val) => sum + val, 0) / 14;
    rsiAvgHistory.push(rsiAvg);
    momentumHistory.push(rsiHistory[i] - rsiAvg);
  }

  // Pega os valores mais recentes
  const currentRsi = rsiHistory[rsiHistory.length - 1] || 50;
  const prevRsi = rsiHistory[rsiHistory.length - 2] || 50;
  const currentRsiAvg = rsiAvgHistory[rsiAvgHistory.length - 1] || 50;
  const prevRsiAvg = rsiAvgHistory[rsiAvgHistory.length - 2] || 50;
  const momentumValue = momentumHistory[momentumHistory.length - 1] || 0;

  // Detectar cruzamento (reversão)
  let reversal = null;
  if (currentRsi > currentRsiAvg && prevRsi <= prevRsiAvg) {
    reversal = { type: 'GREEN', strength: momentumValue };
  } else if (currentRsi < currentRsiAvg && prevRsi >= prevRsiAvg) {
    reversal = { type: 'RED', strength: Math.abs(momentumValue) };
  }
  
  const isExhausted = Math.abs(currentRsi - 50) > 30; // RSI > 80 ou < 20

  return {
    value: momentumValue,
    rsi: currentRsi,
    rsiAvg: currentRsiAvg,
    isBullish: momentumValue > 0, // Lógica simplificada
    isBearish: momentumValue < 0, // Lógica simplificada
    reversal: reversal,
    isExhausted: isExhausted,
    isNearZero: Math.abs(momentumValue) <= 5,
    direction: momentumValue > 0 ? 'UP' : 'DOWN',
    history: rsiHistory, // Renomeado para clareza
    momentumValue: momentumValue,
    momentumHistory: momentumHistory, // Agora retorna o histórico correto
  };
}

export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c.close));
  const highs = candles.map(c => parseFloat(c.high));
  const lows = candles.map(c => parseFloat(c.low));

  const volumesUSD = candles.map(c => ({
    volume:   parseFloat(c.quoteVolume),
    variance: parseFloat(c.high) - parseFloat(c.low),
    price:    parseFloat(c.start) - parseFloat(c.close),
  }));

  // Indicadores existentes
  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });

  const rsi = RSI.calculate({ period: 14, values: closes });

  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const boll = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2
  });

  const atr = ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes
  });

  const slowStoch = Stochastic.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
    signalPeriod: 3
  });

  const adx = ADX.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes
  });

  // Calculate EMA of ADX values
  const adxValues = adx.map(v => v.adx).filter(v => v !== null);
  const adxEma = EMA.calculate({ 
    values: adxValues, 
    period: 21 
  });

  // MOMENTUM - Para o MOMENTUM (baseado em RSI)
  const momentum = calculateMomentum(closes);

  // INDICATORS - Baseados no PineScript
  const waveTrend = calculateWaveTrend(candles, 9, 12, 3); // MOMENTUM(2)
  const customMoneyFlow = calculateMoneyFlow(candles) // MONEY FLOW(3)

  const vwapHistory = calculateIntradayVWAP(candles);
  const latestVwapData = vwapHistory[vwapHistory.length - 1];

  const volumeAnalyse = analyzeTrends(volumesUSD)

  const emaAnalysis = analyzeEMA(ema9, ema21);
  const emaCrossInfo = findEMACross(ema9, ema21); 

  return {
    ema: {
      ...emaAnalysis,
      crossIndex: emaCrossInfo?.index ?? null,
      crossType: emaCrossInfo?.type ?? null,
      candlesAgo: emaCrossInfo ? (ema9.length - 1 - emaCrossInfo.index) : null
    },
    rsi: {
      value: rsi[rsi.length - 1] ?? null,
      avg: rsi.length >= 14 ? rsi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : null,
      prev: rsi[rsi.length - 2] ?? null,
      avgPrev: rsi.length >= 15 ? rsi.slice(-15, -1).reduce((sum, val) => sum + val, 0) / 14 : null,
      history: rsi
    },
    macd: {
      MACD: macd[macd.length - 1]?.MACD ?? null,
      MACD_signal: macd[macd.length - 1]?.signal ?? null,
      MACD_histogram: macd[macd.length - 1]?.histogram ?? null,
      histogram: macd[macd.length - 1]?.histogram ?? null,
      histogramPrev: macd[macd.length - 2]?.histogram ?? null,
    },
    bollinger: {
      BOLL_upper: boll[boll.length - 1]?.upper ?? null,
      BOLL_middle: boll[boll.length - 1]?.middle ?? null,
      BOLL_lower: boll[boll.length - 1]?.lower ?? null,
    },
    volume: {
      history: volumesUSD,
      ...volumeAnalyse
    },
    vwap: {
      vwap: latestVwapData.vwap,
      stdDev: latestVwapData.stdDev,
      upperBands: latestVwapData.upperBands,
      lowerBands: latestVwapData.lowerBands
    },
    atr: {
      atr: atr[atr.length - 1] ?? null,
      value: atr[atr.length - 1] ?? null,
      history: atr
    },
    stoch: {
      k: slowStoch[slowStoch.length - 1]?.k ?? null,
      d: slowStoch[slowStoch.length - 1]?.d ?? null,
      kPrev: slowStoch[slowStoch.length - 2]?.k ?? null,
      dPrev: slowStoch[slowStoch.length - 2]?.d ?? null,
      history: slowStoch
    },
    slowStochastic: {
      k: slowStoch[slowStoch.length - 1]?.k ?? null,
      d: slowStoch[slowStoch.length - 1]?.d ?? null,
      history: slowStoch
    },
    adx: {
      adx: adx[adx.length - 1]?.adx ?? null,
      diPlus: adx[adx.length - 1]?.pdi ?? null,
      diMinus: adx[adx.length - 1]?.mdi ?? null,
      diPlusPrev: adx[adx.length - 2]?.pdi ?? null,
      diMinusPrev: adx[adx.length - 2]?.mdi ?? null,
      adxEma: adxEma[adxEma.length - 1] ?? null,
      history: adx,
      emaHistory: adxEma
    },
    // INDICATORS
    momentum: {
      value: momentum.value,
      rsi: momentum.rsi,
      rsiAvg: momentum.rsiAvg,
      isBullish: momentum.isBullish,
      isBearish: momentum.isBearish,
      reversal: momentum.reversal,
      isExhausted: momentum.isExhausted,
      isNearZero: momentum.isNearZero,
      direction: momentum.direction,
      history: momentum.history,
      momentumValue: momentum.momentumValue,
      momentumHistory: momentum.momentumHistory
    },
    // WAVETREND (MOMENTUM 2)
    waveTrend: {
      wt1: waveTrend.wt1,
      wt2: waveTrend.wt2,
      vwap: waveTrend.vwap,
      reversal: waveTrend.reversal,
      isBullish: waveTrend.isBullish,
      isBearish: waveTrend.isBearish,
      history: waveTrend.history
    },
    moneyFlow: {
      mfi: customMoneyFlow.mfi,
      mfiAvg: customMoneyFlow.mfiAvg,
      value: customMoneyFlow.value,
      isBullish: customMoneyFlow.isBullish,
      isBearish: customMoneyFlow.isBearish,
      isStrong: customMoneyFlow.isStrong,
      direction: customMoneyFlow.direction,
      history: customMoneyFlow.history,
    
      mfiPrev: customMoneyFlow.history[customMoneyFlow.history.length - 2] ?? 50
    }
  };
}




