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

  return {
    ema : analyzeEMA(ema9, ema21),
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

export function analyzeTrade(fee, data, investmentUSD) {
  if (!data.vwap?.lowerBands?.length || !data.vwap?.upperBands?.length || data.vwap.vwap == null) return null;

  const isBull = data.ema?.signal === 'bullish' && data.rsi.value > 50;
  const isBear = data.ema?.signal === 'bearish' && data.rsi.value < 50;

  if (!isBull && !isBear) return null;

  const action = isBull ? 'long' : 'short';
  const price = parseFloat(data.marketPrice);
  const mean = parseFloat(data.vwap.vwap);

  // Unifica e ordena as bandas
  const bands = [...data.vwap.lowerBands, ...data.vwap.upperBands].map(Number).sort((a, b) => a - b);

  // Encontra a banda abaixo e acima mais próximas
  const bandBelow = bands.filter(b => b < price).pop(); // última abaixo
  const bandAbove = bands.find(b => b > price); // primeira acima

  let entry, stop, target;

  if (action === 'long') {
    if (!bandBelow || mean <= bandBelow) return null;
    entry = bandBelow;
    stop = entry * 0.99;
    target = mean;
  } else {
    if (!bandAbove || mean >= bandAbove) return null;
    entry = bandAbove;
    stop = entry * 1.01;
    target = mean;
  }

  // Cálculo de PnL e risco
  const units = investmentUSD / entry;

  const grossLoss = ((action === 'long') ? entry - stop : stop - entry ) * units
  const grossTarget = ((action === 'long') ? target - entry : entry - target) * units

  const entryFee = investmentUSD * fee;
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
}


