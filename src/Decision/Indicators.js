import { EMA, RSI, MACD, BollingerBands, ATR, Stochastic, ADX } from 'technicalindicators';

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
    }
  };
}




