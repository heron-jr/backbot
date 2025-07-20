import { EMA, RSI, MACD, BollingerBands, VWAP } from 'technicalindicators';

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

  const lastEma9  = ema9Arr.at(-1);
  const lastEma21 = ema21Arr.at(-1);
  const prevEma9  = ema9Arr.at(-2);
  const prevEma21 = ema21Arr.at(-2);

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

  const volumesUSD = candles.map(c => ({
    volume:   parseFloat(c.quoteVolume),
    variance: parseFloat(c.high) - parseFloat(c.low),
    price:    parseFloat(c.start) - parseFloat(c.close),
  }));

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
      value: rsi.at(-1) ?? null,
      history: rsi
    },
    macd: {
      MACD: macd.at(-1)?.MACD ?? null,
      MACD_signal: macd.at(-1)?.signal ?? null,
      MACD_histogram: macd.at(-1)?.histogram ?? null,
    },
    bollinger: {
      BOLL_upper: boll.at(-1)?.upper ?? null,
      BOLL_middle: boll.at(-1)?.middle ?? null,
      BOLL_lower: boll.at(-1)?.lower ?? null,
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
    }
  };
}

export function analyzeTrade(fee, data, volume, media_rsi) {
  try {
    
  if (!data.vwap?.lowerBands?.length || !data.vwap?.upperBands?.length || data.vwap.vwap == null) return null;

  const IsCrossBulligh = data.ema.crossType < 'goldenCross' && data.ema.candlesAgo < 2
  const IsCrossBearish = data.ema.crossType < 'deathCross' && data.ema.candlesAgo < 2

  const isReversingUp = data.rsi.value > 35 && media_rsi < 30;
  const isReversingDown = data.rsi.value < 65 && media_rsi > 70;

  const isBullish = data.ema.ema9 > data.ema.ema21 && data.ema.diffPct > 0.1;
  const isBearish = data.ema.ema9 < data.ema.ema21 && data.ema.diffPct < -0.1;

  const isRSIBullish = data.rsi.value > 50 && media_rsi > 40;
  const isRSIBearish = data.rsi.value < 50 && media_rsi < 60;

  const isLong  = (isBullish && isRSIBullish) || isReversingUp   || IsCrossBulligh;
  const isShort = (isBearish && isRSIBearish) || isReversingDown || IsCrossBearish;

  if (!isLong && !isShort) return null;

  const action = isLong ? 'long' : 'short';
  const price = parseFloat(data.marketPrice);

  // Unifica e ordena as bandas
  const bands = [...data.vwap.lowerBands, ...data.vwap.upperBands].map(Number).sort((a, b) => a - b);

  // Encontra a banda abaixo e acima mais próximas
  const bandBelow = bands.filter(b => b < price); // última abaixo
  const bandAbove = bands.filter(b => b > price); // primeira acima

  if(bandAbove.length === 0 || bandBelow.length === 0) return null

  const entry = price; // ajuste de slippage otimista

  let stop, target;
  const percentVwap = 0.95

  if (isLong) {
    stop = bandBelow[bandBelow.length - 1] 
    target = entry + ((bandAbove[0] - entry) * percentVwap)
  } else {
    stop = bandAbove[bandAbove.length - 1]
    target = entry - ((entry - bandBelow[0]) * percentVwap)
  }

  // Cálculo de PnL e risco
  const units = volume / entry;

  const grossLoss = ((action === 'long') ? entry - stop : stop - entry ) * units
  const grossTarget = ((action === 'long') ? target - entry : entry - target) * units

  const entryFee = volume * fee;
  const exitFeeTarget = grossTarget * fee;
  const exitFeeLoss = grossLoss * fee;

  const pnl  = grossTarget - (entryFee + exitFeeTarget)
  const risk = grossLoss + (entryFee + exitFeeLoss)

  return {
    market: data.market.symbol,
    entry: Number(entry.toFixed(data.market.decimal_price)),
    stop: Number(stop.toFixed(data.market.decimal_price)),
    target: Number(target.toFixed(data.market.decimal_price)),
    action,
    pnl: Number(pnl),
    risk: Number(risk)
  };
  
  } catch (error) {
    console.log(error)
    return null
  }

}


