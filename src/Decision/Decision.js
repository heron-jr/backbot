import Futures from '../Backpack/Authenticated/Futures.js';
import Order from '../Backpack/Authenticated/Order.js';
import OrderController from '../Controllers/OrderController.js';
import { OrderController as OrderControllerClass } from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Markets from '../Backpack/Public/Markets.js';
import { calculateIndicators } from './Indicators.js';
import { StrategyFactory } from './Strategies/StrategyFactory.js';

const STRATEGY_DEFAULT = 'DEFAULT';

class Decision {
  constructor() {
    const strategyType = process.env.TRADING_STRATEGY || STRATEGY_DEFAULT;
    console.log(`🔍 Decision: TRADING_STRATEGY do .env: "${process.env.TRADING_STRATEGY}"`);
    console.log(`🔍 Decision: strategyType final: "${strategyType}"`);
    
    this.strategy = StrategyFactory.createStrategy(strategyType);
    
    console.log(`🤖 Estratégia carregada: ${strategyType.toUpperCase()}`);
    
    // Cache simples para dados de mercado
    this.marketCache = new Map();
    this.cacheTimeout = 30000; // 30 segundos
  }

  async getDataset(Account, closed_markets) {
    const dataset = []

    const markets = Account.markets.filter((el) => {
      return !closed_markets.includes(el.symbol) 
    })

    try {
      // Paraleliza a coleta de dados de todos os mercados com cache
      const dataPromises = markets.map(async (market) => {
        try {
          const cacheKey = `${market.symbol}_${process.env.TIME}`;
          const now = Date.now();
          const cached = this.marketCache.get(cacheKey);
          
          let getAllMarkPrices, candles;
          
          // Verifica se há cache válido
          if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            getAllMarkPrices = cached.markPrices;
            candles = cached.candles;
            console.log(`📦 Cache hit para ${market.symbol}`);
          } else {
            // Busca dados novos
            [getAllMarkPrices, candles] = await Promise.all([
              Markets.getAllMarkPrices(market.symbol),
              Markets.getKLines(market.symbol, process.env.TIME, 30)
            ]);
            
            // Salva no cache
            this.marketCache.set(cacheKey, {
              markPrices: getAllMarkPrices,
              candles: candles,
              timestamp: now
            });
          }
          
          const analyze = calculateIndicators(candles);
          const marketPrice = getAllMarkPrices[0].markPrice;

          console.log("🔍 Analyzing", String(market.symbol).replace("_USDC_PERP", ""));

          return {
            candles,
            market,
            marketPrice,
            ...analyze
          };
        } catch (error) {
          console.error(`❌ Erro ao processar ${market.symbol}:`, error.message);
          return null;
        }
      });

      // Aguarda todas as operações em paralelo
      const results = await Promise.all(dataPromises);
      
      // Filtra resultados nulos (erros)
      results.forEach(result => {
        if (result) {
          dataset.push(result);
        }
      });

    } catch (error) {
      console.error('❌ getDataset - Error:', error);
    }

    return dataset;
  }


  analyzeTrades(fee, datasets, investmentUSD, media_rsi) {
    // Paraleliza a análise de todos os datasets
    const analysisPromises = datasets.map(async (data) => {
      try {
        return await this.strategy.analyzeTrade(fee, data, investmentUSD, media_rsi);
      } catch (error) {
        console.error(`❌ Erro na análise de ${data.market?.symbol}:`, error.message);
        return null;
      }
    });

    // Executa todas as análises em paralelo
    const results = Promise.all(analysisPromises);
    
    // Filtra resultados nulos e ordena por PnL
    return results.then(analysisResults => 
      analysisResults
        .filter(result => result !== null)
        .sort((a, b) => b.pnl - a.pnl)
    );
  }

  analyzeMarket(candles, marketPrice, market) {
  const parsed = candles.map(c => ({
    open: parseFloat(c.open),
    close: parseFloat(c.close),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    volume: parseFloat(c.volume),
    quoteVolume: parseFloat(c.quoteVolume),
    trades: parseInt(c.trades),
    start: c.start,
    end: c.end
  }));

  const valid = parsed.filter(c => c.volume > 0);
  const volume = valid.reduce((acc, c) => acc + c.volume, 0);

  const last = valid[valid.length - 1] || parsed[parsed.length - 1];

  const entry = last.close;

  const action = marketPrice >= entry ?  'LONG' : 'SHORT'  ;

  return {
    action: action,
    entry: entry,
    marketPrice: marketPrice,
    volume: volume,
    market: market
  };
  }

  analyzeMAEMACross(candles, marketPrice, period = 25) {

  const closes = candles.map(c => parseFloat(c.close));
  const ma = [];
  const ema = [];
  const k = 2 / (period + 1);

  // Cálculo da MA
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 >= period) {
      const sum = closes.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    } else {
      ma.push(null);
    }
  }

  // Cálculo da EMA
  for (let i = 0; i < closes.length; i++) {
    if (i === period - 1) {
      ema.push(ma[i]);
    } else if (i >= period) {
      ema.push(closes[i] * k + ema[i - 1] * (1 - k));
    } else {
      ema.push(null);
    }
  }

  const i = closes.length - 1;
  const iPrev = i - 1;
  const parsedMarketPrice = parseFloat(marketPrice);

  let action = 'NEUTRAL';
  let entry = null;

  if (ma[iPrev] !== null && ema[iPrev] !== null && ma[i] !== null && ema[i] !== null) {
    const prevDiff = ma[iPrev] - ema[iPrev];
    const currDiff = ma[i] - ema[i];

    // MA cruzou EMA de baixo para cima → LONG
    if (prevDiff <= 0 && currDiff > 0) {
      action = 'LONG';
      entry = parseFloat((parsedMarketPrice).toFixed(6));
    }

    // MA cruzou EMA de cima para baixo → SHORT
    else if (prevDiff >= 0 && currDiff < 0) {
      action = 'SHORT';
      entry = parseFloat((parsedMarketPrice).toFixed(6));
    }
  }

  return {
    action,
    entry,
    marketPrice: parsedMarketPrice,
  };
  }

  async analyze() {

    try {
      

    const Account = await AccountController.get()

    // Verifica se os dados da conta foram carregados com sucesso
    if (!Account) {
      console.error('❌ Falha ao carregar dados da conta. Verifique suas credenciais de API.');
      return;
    }

    if(Account.leverage > 10 && process.env.TIME !== "1m"){
      console.log(`Leverage ${Account.leverage}x and time candle high (${process.env.TIME}) HIGH RISK LIQUIDATION`)
    }
   
    const positions = await Futures.getOpenPositions()
    const closed_markets = positions.map((el) => el.symbol)

    if(positions.length >= Number(Account.maxOpenOrders)){
      console.log("Maximum number of orders reached", positions.length)
      return
    }

    const dataset = await this.getDataset(Account, closed_markets)

    // Otimiza o cálculo da média RSI
    const media_rsi = dataset.reduce((sum, row) => sum + row.rsi.value, 0) / dataset.length;

    // Só loga a média RSI se não for estratégia PRO_MAX
    if (process.env.TRADING_STRATEGY !== 'PRO_MAX') {
      console.log("Média do RSI", media_rsi)
    }

    // Calcula volume baseado em porcentagem ou valor fixo
    const VOLUME_ORDER = Number(process.env.VOLUME_ORDER)
    const CAPITAL_PERCENTAGE = Number(process.env.CAPITAL_PERCENTAGE || 0)
    
    let investmentUSD;
    
    if (CAPITAL_PERCENTAGE > 0) {
      // Usa porcentagem do capital disponível
      investmentUSD = (Account.capitalAvailable * CAPITAL_PERCENTAGE) / 100;
      console.log(`💰 Usando ${CAPITAL_PERCENTAGE}% do capital: $${investmentUSD.toFixed(2)}`);
    } else {
      // Usa valor fixo
      investmentUSD = VOLUME_ORDER;
      console.log(`💰 Usando valor fixo: $${investmentUSD.toFixed(2)}`);
    }

    // Validação de segurança: nunca exceder o capital disponível
    if (investmentUSD > Account.capitalAvailable) {
      investmentUSD = Account.capitalAvailable;
      console.log(`⚠️ Volume ajustado para capital disponível: $${investmentUSD.toFixed(2)}`);
    }

    if(investmentUSD < Account.capitalAvailable){
    const fee = Account.fee

    const rows = await this.analyzeTrades(fee, dataset, investmentUSD, media_rsi)

    // Paraleliza a execução de ordens com controle de capital
    const orderPromises = rows.map(async (row) => {
      try {
        const marketInfo = Account.markets.find((el) => el.symbol === row.market);

        row.volume = investmentUSD
        row.decimal_quantity = marketInfo.decimal_quantity
        row.decimal_price = marketInfo.decimal_price
        row.stepSize_quantity = marketInfo.stepSize_quantity

        const orders = await OrderController.getRecentOpenOrders(row.market)

        if(orders.length > 0) {
          if(orders[0].minutes > 3){
            await Order.cancelOpenOrders(row.market)
            return await OrderController.openOrder(row)
          } 
        } else {
          return await OrderController.openOrder(row)
        }
      } catch (error) {
        console.error(`❌ Erro ao executar ordem para ${row.market}:`, error.message);
        return null;
      }
    });

    // Executa todas as ordens em paralelo
    const orderResults = await Promise.all(orderPromises);
    
    // Log dos resultados
    const successfulOrders = orderResults.filter(result => result !== null);
    const failedOrders = orderResults.filter(result => result === null);
    
    // Log detalhado das ordens
    console.log(`📊 Detalhes das ordens:`);
    rows.forEach((row, index) => {
      const result = orderResults[index];
      const status = result !== null ? '✅' : '❌';
      
      // Para estratégia PRO_MAX, inclui o nível do sinal
      if (process.env.TRADING_STRATEGY === 'PRO_MAX' && row.signalLevel) {
        console.log(`${status} ${row.market} (${row.signalLevel}): ${result !== null ? 'Executada' : 'Falhou'}`);
      } else {
        console.log(`${status} ${row.market}: ${result !== null ? 'Executada' : 'Falhou'}`);
      }
    });
    
    if (successfulOrders.length > 0) {
      console.log(`✅ ${successfulOrders.length} ordens executadas com sucesso`);
    }
    if (failedOrders.length > 0) {
      console.log(`❌ ${failedOrders.length} ordens falharam`);
    }
    
    // Log informativo quando não há operações
    if (rows.length === 0) {
      const nextAnalysis = new Date(Date.now() + 60000); // 60 segundos
      const timeString = nextAnalysis.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      });
      console.log(`⏰ Nenhuma operação encontrada. Próxima análise às ${timeString}`);
    }

    // Monitoramento de ordens pendentes agora é feito a cada 5 segundos em app.js
    // para resposta mais rápida na criação de take profits
    } else {
      console.log(`⚠️ Capital insuficiente para operar. Disponível: $${Account.capitalAvailable.toFixed(2)}`);
    }


    } catch (error) {
      console.log(error)
    }

  } 

}

export default new Decision();