import { EMA, RSI, MACD, BollingerBands, ATR, Stochastic, ADX, MFI } from 'technicalindicators';

function calculateVWAPClassicBands(candles) {
  let sumVol = 0;
  let sumTPV = 0;

  // 1ª passada: soma de volume e tp * volume
  for (const c of candles) {
    const high  = parseFloat(c.high);
    const low   = parseFloat(c.low);
    const close = parseFloat(c.close);
    const vol   = parseFloat(c.volume);

    const tp = (high + low + close) / 3;
    sumVol  += vol;
    sumTPV  += tp * vol;
  }

  const vwap = sumTPV / sumVol;

  // 2ª passada: soma do desvio² ponderado por volume
  let sumVarV = 0;
  for (const c of candles) {
    const high  = parseFloat(c.high);
    const low   = parseFloat(c.low);
    const close = parseFloat(c.close);
    const vol   = parseFloat(c.volume);

    const tp = (high + low + close) / 3;
    const diff = tp - vwap;
    sumVarV += vol * diff * diff;
  }

  const variance = sumVarV / sumVol;
  const stdDev   = Math.sqrt(variance);

  // bandas clássicas: ±1, ±2, ±3 desvios
  const upperBands = [
    vwap + stdDev,
    vwap + 2 * stdDev,
    vwap + 3 * stdDev
  ];
  const lowerBands = [
    vwap - stdDev,
    vwap - 2 * stdDev,
    vwap - 3 * stdDev
  ];

  return {
    vwap,
    stdDev,
    upperBands,
    lowerBands
  };
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
 * Função Custom Money Flow (MONEY FLOW) - Baseada no PineScript CypherPunk
 * @param {Array} candles - Array de candles
 * @param {number} period - Período (padrão: 60)
 * @param {number} multiplier - Multiplicador (padrão: 225)
 * @returns {Object} - Dados do Money Flow
 */
function calculateCustomMoneyFlow(candles, period = 60, multiplier = 225) {
  if (candles.length < period) {
    return {
      value: 0,
      mfi: 50,
      mfiAvg: 50,
      isBullish: false,
      isBearish: false,
      isStrong: false,
      direction: 'NEUTRAL'
    };
  }

  // Calcular ((close - open) / (high - low)) * multiplier
  const mfiValues = [];
  for (const c of candles) {
    const open = parseFloat(c.open);
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    const close = parseFloat(c.close);
    
    const denominator = high - low;
    if (denominator !== 0) {
      mfiValues.push(((close - open) / denominator) * multiplier);
    } else {
      mfiValues.push(0);
    }
  }
  
  // Calcular SMA dos valores
  const mfi = [];
  for (let i = 0; i < mfiValues.length; i++) {
    if (i >= period - 1) {
      const sum = mfiValues.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      mfi.push(sum / period);
    } else {
      mfi.push(null);
    }
  }
  
  const currentMfi = mfi[mfi.length - 1];
  const mfiAvg = mfi.length >= period ? mfi.slice(-period).reduce((sum, val) => sum + (val || 0), 0) / period : 50;
  const mfiValue = (currentMfi || 50) - mfiAvg;
  
  return {
    value: mfiValue,
    mfi: currentMfi || 50,
    mfiAvg: mfiAvg,
    isBullish: mfiValue > 0,
    isBearish: mfiValue < 0,
    isStrong: Math.abs(mfiValue) > 10,
    direction: mfiValue > 0 ? 'UP' : 'DOWN',
    history: mfi
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
 * @param {Array} closes - Array de preços de fechamento
 * @returns {Object} - Dados do momentum
 */
function calculateMomentum(closes) {
  if (closes.length < 14) {
    return {
      value: 0,
      rsi: 50,
      rsiAvg: 50,
      isBullish: false,
      isBearish: false,
      reversal: null,
      isExhausted: false,
      isNearZero: true,
      direction: 'NEUTRAL',
      momentumValue: 0
    };
  }

  // Calcular RSI para momentum
  const rsi = RSI.calculate({ period: 14, values: closes });
  const currentRsi = rsi[rsi.length - 1] || 50;
  const prevRsi = rsi[rsi.length - 2] || 50;
  
  // Média do RSI (últimos 14 períodos)
  const rsiAvg = rsi.slice(-14).reduce((sum, val) => sum + val, 0) / 14;
  
  // Momentum baseado na diferença RSI vs Média
  const momentumValue = currentRsi - rsiAvg;
  
  // Detectar reversão baseado no RSI
  let reversal = null;
  if (currentRsi > rsiAvg && currentRsi > 50 && prevRsi <= rsiAvg) {
    reversal = { type: 'GREEN', strength: currentRsi - rsiAvg };
  } else if (currentRsi < rsiAvg && currentRsi < 50 && prevRsi >= rsiAvg) {
    reversal = { type: 'RED', strength: rsiAvg - currentRsi };
  }
  
  // Verificar exaustão baseado no RSI
  const isExhausted = Math.abs(currentRsi - 50) > 30; // RSI > 80 ou < 20
  
  return {
    value: momentumValue,
    rsi: currentRsi,
    rsiAvg: rsiAvg,
    isBullish: momentumValue > 0 && currentRsi > rsiAvg,
    isBearish: momentumValue < 0 && currentRsi < rsiAvg,
    reversal: reversal,
    isExhausted: isExhausted,
    isNearZero: Math.abs(momentumValue) <= 5,
    direction: momentumValue > 0 ? 'UP' : 'DOWN',
    history: rsi,
    momentumValue: momentumValue,
    momentumHistory: rsi
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

  // MONEY FLOW INDEX (MFI) - Para o MONEY FLOW do CypherPunk
  const mfi = MFI.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
    volume: candles.map(c => parseFloat(c.volume))
  });

  // MOMENTUM - Para o MOMENTUM do CypherPunk (baseado em RSI)
  const momentum = calculateMomentum(closes);

  // CYPHERPUNK INDICATORS - Baseados no PineScript
  const waveTrend = calculateWaveTrend(candles, 9, 12, 3); // MOMENTUM(2)
  const customMoneyFlow = calculateCustomMoneyFlow(candles, 60, 225); // MONEY FLOW(3)

  const { vwap, stdDev, upperBands, lowerBands } = calculateVWAPClassicBands(candles);
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
        vwap, 
        stdDev, 
        upperBands, 
        lowerBands
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
    // CYPHERPUNK INDICATORS
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
    // CYPHERPUNK WAVETREND (MOMENTUM 2)
    waveTrend: {
      wt1: waveTrend.wt1,
      wt2: waveTrend.wt2,
      vwap: waveTrend.vwap,
      reversal: waveTrend.reversal,
      isBullish: waveTrend.isBullish,
      isBearish: waveTrend.isBearish,
      history: waveTrend.history
    },
    // CYPHERPUNK CUSTOM MONEY FLOW (MONEY FLOW 3)
    customMoneyFlow: {
      value: customMoneyFlow.value,
      mfi: customMoneyFlow.mfi,
      mfiAvg: customMoneyFlow.mfiAvg,
      isBullish: customMoneyFlow.isBullish,
      isBearish: customMoneyFlow.isBearish,
      isStrong: customMoneyFlow.isStrong,
      direction: customMoneyFlow.direction,
      history: customMoneyFlow.history
    },
    moneyFlow: {
      mfi: mfi[mfi.length - 1] ?? 50,
      mfiAvg: mfi.length >= 14 ? mfi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : 50,
      mfiPrev: mfi[mfi.length - 2] ?? 50,
      value: (mfi[mfi.length - 1] ?? 50) - (mfi.length >= 14 ? mfi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : 50),
      isBullish: (mfi[mfi.length - 1] ?? 50) > (mfi.length >= 14 ? mfi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : 50),
      isBearish: (mfi[mfi.length - 1] ?? 50) < (mfi.length >= 14 ? mfi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : 50),
      isStrong: Math.abs((mfi[mfi.length - 1] ?? 50) - (mfi.length >= 14 ? mfi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : 50)) > 10,
      direction: (mfi[mfi.length - 1] ?? 50) > (mfi.length >= 14 ? mfi.slice(-14).reduce((sum, val) => sum + val, 0) / 14 : 50) ? 'UP' : 'DOWN',
      history: mfi
    }
  };
}




