import Futures from '../Backpack/Authenticated/Futures.js';
import Order from '../Backpack/Authenticated/Order.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Markets from '../Backpack/Public/Markets.js';
import { calculateIndicators } from './Indicators.js';
import { StrategyFactory } from './Strategies/StrategyFactory.js';

const STRATEGY_DEFAULT = 'DEFAULT';

class Decision {
  constructor(strategyType = null) {
    // A estratégia deve ser sempre definida via parâmetro (terminal)
    // Não usa mais variável de ambiente como fallback
    if (!strategyType) {
      throw new Error('❌ Estratégia deve ser definida via parâmetro. Use o terminal para selecionar a estratégia.');
    }
    
    console.log(`🔍 Decision: Estratégia definida via terminal: "${strategyType}"`);
    
    this.strategy = StrategyFactory.createStrategy(strategyType);
    
    console.log(`🤖 Estratégia carregada: ${strategyType.toUpperCase()}`);
    
    // Cache simples para dados de mercado
    this.marketCache = new Map();
    this.cacheTimeout = 30000; // 30 segundos
  }

  /**
   * Re-inicializa a estratégia com um novo tipo
   * @param {string} strategyType - Novo tipo de estratégia
   */
  reinitializeStrategy(strategyType) {
    if (!strategyType) {
      console.log('⚠️ StrategyType não fornecido, mantendo estratégia atual');
      return;
    }
    
    console.log(`🔄 Re-inicializando estratégia: ${strategyType.toUpperCase()}`);
    this.strategy = StrategyFactory.createStrategy(strategyType);
    console.log(`✅ Estratégia re-inicializada: ${strategyType.toUpperCase()}`);
    
    // Reseta os logs para a nova sessão
    this.operationSummaryLogged = false;
  }

  /**
   * Mostra uma barra de progresso animada até a próxima execução
   * @param {number} durationMs - Duração total em milissegundos
   * @param {string} nextTime - Horário da próxima execução
   */
  showLoadingProgress(durationMs, nextTime) {
    const interval = 200; // Atualiza a cada 200ms para ser mais suave
    const steps = Math.floor(durationMs / interval);
    let currentStep = 0;
    let isActive = true;
    let timeoutId = null;
    
    // Função para limpar a linha atual
    const clearLine = () => {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
    };
    
    // Intercepta console.log para interromper o loading
    const originalLog = console.log;
    console.log = (...args) => {
      if (isActive) {
        clearLine();
        isActive = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Garante que o próximo log pule para uma nova linha
        process.stdout.write('\n');
      }
      originalLog.apply(console, args);
    };
    
    const progressBar = () => {
      if (!isActive) {
        // Restaura console.log original
        console.log = originalLog;
        return;
      }
      
      const progress = Math.min((currentStep / steps) * 100, 100);
      const filledBlocks = Math.floor(progress / 2);
      const emptyBlocks = 50 - filledBlocks;
      
      const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
      const percentage = Math.floor(progress);
      
      // Limpa a linha anterior e mostra o progresso
      process.stdout.write('\r');
      process.stdout.write(`⏳ Aguardando próxima análise... [${bar}] ${percentage}% | Próxima: ${nextTime}\n`);
      
      currentStep++;
      
      if (currentStep <= steps && isActive) {
        timeoutId = setTimeout(progressBar, interval);
      } else {
        // Limpa a linha quando termina e restaura console.log
        clearLine();
        console.log = originalLog;
      }
    };
    
    // Pequeno delay para não interferir com logs anteriores
    setTimeout(progressBar, 500);
  }

  async getDataset(Account, closed_markets, timeframe = null, logger = null) {
    const dataset = []
    
    // Usa o timeframe passado como parâmetro ou fallback para configuração da conta
    let currentTimeframe = timeframe;
    
    if (!currentTimeframe) {
      // Determina a estratégia atual para usar a configuração correta
      const strategyName = this.strategy.constructor.name;
      
      if (strategyName === 'ProMaxStrategy') {
        // Estratégia PRO_MAX usa CONTA2
        currentTimeframe = process.env.ACCOUNT2_TIME || process.env.TIME || '5m';
      } else {
        // Estratégia DEFAULT usa CONTA1
        currentTimeframe = process.env.ACCOUNT1_TIME || process.env.TIME || '5m';
      }
    }
    
    // Usa 100 candles para garantir que todos os indicadores tenham dados suficientes
    const candleCount = 100;

    const markets = Account.markets.filter((el) => {
      return !closed_markets.includes(el.symbol) 
    })

    try {
      // Paraleliza a coleta de dados de todos os mercados com cache
      const dataPromises = markets.map(async (market) => {
        try {
          const cacheKey = `${market.symbol}_${currentTimeframe}`;
          const now = Date.now();
          const cached = this.marketCache.get(cacheKey);
          
          let getAllMarkPrices, candles;
          
          // Verifica se há cache válido
          if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            getAllMarkPrices = cached.markPrices;
            candles = cached.candles;
            const cacheMsg = `📦 Cache hit para ${market.symbol}`;
            if (logger) {
              logger.info(cacheMsg);
            } else {
              console.log(cacheMsg);
            }
          } else {
            // Busca dados novos
            [getAllMarkPrices, candles] = await Promise.all([
              Markets.getAllMarkPrices(market.symbol),
              Markets.getKLines(market.symbol, currentTimeframe, candleCount)
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

          // const analyzeMsg = `🔍 Analyzing ${String(market.symbol).replace("_USDC_PERP", "")}`;
          // if (logger) {
          //   logger.info(analyzeMsg);
          // } else {
          //   console.log(analyzeMsg);
          // }

          return {
            candles,
            market,
            marketPrice,
            ...analyze
          };
        } catch (error) {
          const errorMsg = `❌ Erro ao processar ${market.symbol}: ${error.message}`;
          if (logger) {
            logger.error(errorMsg);
          } else {
            console.error(errorMsg);
          }
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
      const errorMsg = '❌ getDataset - Error:';
      if (logger) {
        logger.error(errorMsg);
      } else {
        console.error(errorMsg);
      }
    }

    return dataset;
  }


  async analyzeTrades(fee, datasets, investmentUSD, media_rsi, config = null, btcTrend = 'NEUTRAL') {
    // Paraleliza a análise de todos os datasets
    const analysisPromises = datasets.map(async (data) => {
      try {
        return await this.strategy.analyzeTrade(fee, data, investmentUSD, media_rsi, config, btcTrend);
      } catch (error) {
        const errorMsg = `❌ Erro na análise de ${data.market?.symbol}: ${error.message}`;
        if (logger) {
          logger.error(errorMsg);
        } else {
          console.error(errorMsg);
        }
        return null;
      }
    });

    // Executa todas as análises em paralelo
    const analysisResults = await Promise.all(analysisPromises);
    
    // Filtra resultados nulos e ordena por PnL
    return analysisResults
      .filter(result => result !== null)
      .sort((a, b) => b.pnl - a.pnl);
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

  async analyze(timeframe = null, logger = null, config = null) {

    try {
      
    // Usa o timeframe passado como parâmetro ou fallback para configuração da conta
    let currentTimeframe = timeframe;
    
    if (!currentTimeframe) {
      // Determina a estratégia atual para usar a configuração correta
      const strategyName = this.strategy.constructor.name;
      
      if (strategyName === 'ProMaxStrategy') {
        // Estratégia PRO_MAX usa CONTA2
        currentTimeframe = process.env.ACCOUNT2_TIME || process.env.TIME || '5m';
      } else {
        // Estratégia DEFAULT usa CONTA1
        currentTimeframe = process.env.ACCOUNT1_TIME || process.env.TIME || '5m';
      }
    }

    const Account = await AccountController.get(config)

    // Verifica se os dados da conta foram carregados com sucesso
    if (!Account) {
      const errorMsg = '❌ Falha ao carregar dados da conta. Verifique suas credenciais de API.';
      if (logger) {
        logger.error(errorMsg);
      } else {
        console.error(errorMsg);
      }
      return;
    }

    if(Account.leverage > 10 && currentTimeframe !== "1m"){
      const warningMsg = `\nLeverage ${Account.leverage}x and time candle high (${currentTimeframe}) HIGH RISK LIQUIDATION`;
      if (logger) {
        logger.warn(warningMsg);
      } else {
        console.log(warningMsg);
      }
    }
   
    const positions = await Futures.getOpenPositions()
    const closed_markets = positions.map((el) => el.symbol)

    if(positions.length >= Number(Account.maxOpenOrders)){
      const maxOrdersMsg = `Maximum number of orders reached ${positions.length}`;
      if (logger) {
        logger.warn(maxOrdersMsg);
      } else {
        console.log(maxOrdersMsg);
      }
      return
    }

    // Verificação adicional: também verifica ordens abertas para evitar duplicatas
    const openOrders = await Order.getOpenOrders()
    const marketsWithOpenOrders = openOrders ? openOrders.map(order => order.symbol) : []
    const allClosedMarkets = [...new Set([...closed_markets, ...marketsWithOpenOrders])]
    
    // Log de debug para verificar mercados fechados
    if (logger) {
      logger.info(`🔒 Mercados com posições: ${closed_markets.length}, Mercados com ordens: ${marketsWithOpenOrders.length}, Total fechados: ${allClosedMarkets.length}`);
    }

    // ANÁLISE DO BTC PRIMEIRO (antes das altcoins)
    console.log(`\n📊 ANÁLISE DO BTC (${currentTimeframe}):`);
    let btcTrend = 'NEUTRAL';
    try {
      // Usa 100 candles para garantir que todos os indicadores tenham dados suficientes
      const btcCandles = await Markets.getKLines('BTC_USDC_PERP', currentTimeframe, 100);
      if (btcCandles && btcCandles.length > 0) {
        const btcIndicators = calculateIndicators(btcCandles);
        
        // Validação adicional dos indicadores do BTC
        if (!btcIndicators || !btcIndicators.rsi || !btcIndicators.stoch || !btcIndicators.macd || !btcIndicators.adx) {
          console.log(`   ⚠️ BTC: Dados de indicadores insuficientes`);
        } else {
          const btcAnalysis = this.strategy.analyzeSignals(btcIndicators, true);
          
          if (btcAnalysis && btcAnalysis.hasSignal) {
            console.log(`   🟢 BTC: ${btcAnalysis.signalType}`);
            if (btcAnalysis.analysisDetails && btcAnalysis.analysisDetails.length > 0) {
              btcAnalysis.analysisDetails.forEach(detail => {
                console.log(`      • ${detail}`);
              });
            }
            // Define tendência do BTC baseada no sinal
            btcTrend = btcAnalysis.isLong ? 'BULLISH' : 'BEARISH';
          } else {
            console.log(`   ⚪ BTC: Sem sinais (NEUTRO - não permite operações em altcoins)`);
            if (btcAnalysis && btcAnalysis.analysisDetails && btcAnalysis.analysisDetails.length > 0) {
              btcAnalysis.analysisDetails.forEach(detail => {
                console.log(`      • ${detail}`);
              });
            }
            btcTrend = 'NEUTRAL';
          }
        }
      } else {
        console.log(`   ⚠️ BTC: Dados de candles insuficientes`);
      }
    } catch (error) {
      console.log(`   ❌ BTC: Erro na análise - ${error.message}`);
      console.log(`      Detalhes: ${error.stack?.split('\n')[1] || 'Erro desconhecido'}`);
    }

    const dataset = await this.getDataset(Account, allClosedMarkets, currentTimeframe, logger)

    // Otimiza o cálculo da média RSI
    const media_rsi = dataset.reduce((sum, row) => sum + row.rsi.value, 0) / dataset.length;

    // Só loga a média RSI se não for estratégia PRO_MAX
    // Verifica a estratégia atual da instância ao invés da variável de ambiente
    if (this.strategy.constructor.name !== 'ProMaxStrategy') {
      const rsiMsg = `Média do RSI ${media_rsi}`;
      if (logger) {
        logger.info(rsiMsg);
      } else {
        console.log(rsiMsg);
      }
    }

    // Usa configuração passada como parâmetro (prioridade) ou fallback para variáveis de ambiente
    const VOLUME_ORDER = config?.volumeOrder || Number(process.env.VOLUME_ORDER) || 100
    const CAPITAL_PERCENTAGE = config?.capitalPercentage || Number(process.env.CAPITAL_PERCENTAGE || 0)
    
    let investmentUSD;
    
    // Valida se os valores são números válidos
    if (isNaN(VOLUME_ORDER) || VOLUME_ORDER <= 0) {
      console.error(`❌ VOLUME_ORDER inválido: ${VOLUME_ORDER}. Usando valor padrão: 100`);
      investmentUSD = 100;
    } else if (CAPITAL_PERCENTAGE > 0) {
      // Usa porcentagem do capital disponível
      investmentUSD = (Account.capitalAvailable * CAPITAL_PERCENTAGE) / 100;
      const capitalMsg = `💰 CONFIGURAÇÃO: ${CAPITAL_PERCENTAGE}% do capital disponível`;
      if (logger) {
        logger.capital(capitalMsg);
      } else {
        console.log(capitalMsg);
      }
    } else {
      // Usa valor fixo
      investmentUSD = VOLUME_ORDER;
      const fixedMsg = `💰 CONFIGURAÇÃO: Valor fixo de $${investmentUSD.toFixed(2)}`;
      if (logger) {
        logger.capital(fixedMsg);
      } else {
        console.log(fixedMsg);
      }
    }

    // Log explicativo do capital e volume (apenas uma vez por análise)
    if (!this.operationSummaryLogged) {
      const equityAvailable = Account.capitalAvailable / Account.leverage;
      const availableToTrade = Account.capitalAvailable;
      
      const capitalExplanation = `\n💰 RESUMO DA OPERAÇÃO:
   • Capital Disponível: $${equityAvailable.toFixed(2)}
   • Alavancagem: ${Account.leverage}x
   • Disponível para Negociação: $${availableToTrade.toFixed(2)}
   • Volume por operação: $${investmentUSD.toFixed(2)}
   • Máximo de ordens: ${Account.maxOpenOrders}`;
      
      if (logger) {
        logger.capital(capitalExplanation);
      } else {
        console.log(capitalExplanation);
      }
      
      this.operationSummaryLogged = true;
    }

    const fee = Account.fee

    const rows = await this.analyzeTrades(fee, dataset, investmentUSD, media_rsi, config, btcTrend)

    // Executa ordens em paralelo usando Promise.all
    console.log(`\n🚀 Executando ${rows.length} ordens em paralelo...`);
    
    // Prepara todas as ordens
    const orderPromises = rows.map(async (row, index) => {
      try {
        const marketInfo = Account.markets.find((el) => el.symbol === row.market);

        row.volume = investmentUSD
        row.decimal_quantity = marketInfo.decimal_quantity
        row.decimal_price = marketInfo.decimal_price
        row.stepSize_quantity = marketInfo.stepSize_quantity

        // Verifica se já existe uma posição ativa para este mercado
        const positions = await Futures.getOpenPositions();
        const existingPosition = positions.find(p => p.symbol === row.market && Math.abs(Number(p.netQuantity)) > 0);
        
        if (existingPosition) {
          // Já existe posição ativa, não criar nova ordem
          console.log(`   ⏸️ ${row.market}: Posição ativa existe (${existingPosition.netQuantity}), pulando...`);
          return { index, market: row.market, result: null };
        }

        // Verifica se já existe uma ordem pendente
        const orders = await OrderController.getRecentOpenOrders(row.market)

        if(orders.length > 0) {
          if(orders[0].minutes > 3) {
            await Order.cancelOpenOrders(row.market);
            const result = await OrderController.openOrder({ ...row, accountId: config?.accountId || 'DEFAULT' })
            return { index, market: row.market, result };
          } else {
            return { index, market: row.market, result: null };
          }
        } else {
          const result = await OrderController.openOrder({ ...row, accountId: config?.accountId || 'DEFAULT' })
          return { index, market: row.market, result };
        }
        
      } catch (error) {
        const errorMsg = `❌ Erro ao executar ordem para ${row.market}: ${error.message}`;
        if (logger) {
          logger.error(errorMsg);
        } else {
          console.error(errorMsg);
        }
        return { index, market: row.market, result: { error: error.message } };
      }
    });

    // Executa todas as ordens em paralelo
    const orderResults = await Promise.all(orderPromises);
    
    // Ordena os resultados pelo índice original e mostra logs
    orderResults.sort((a, b) => a.index - b.index);
    
    orderResults.forEach(({ market, result }) => {
      if (result && !result.error) {
        console.log(`   ✅ ${market}: Executada`);
      } else if (result && result.error) {
        console.log(`   ❌ ${market}: Falhou - ${result.error}`);
      } else {
        console.log(`   ⏸️ ${market}: Pulado (ordem recente)`);
      }
    });
    
    // Log dos resultados
    const successfulOrders = orderResults.filter(({ result }) => result && !result.error);
    const failedOrders = orderResults.filter(({ result }) => !result || result.error);
    
    // Log detalhado das ordens
    const detailsMsg = `📊 Detalhes das ordens:`;
    if (logger) {
      logger.order(detailsMsg);
    } else {
      console.log(detailsMsg);
    }
    
    // Log resumo da análise quando há operações
    console.log(`\n📈 RESUMO DA ANÁLISE:`);
    console.log(`   • Mercados analisados: ${dataset.length}`);
    console.log(`   • Sinais encontrados: ${rows.length}`);
    console.log(`   • Operações executadas: ${successfulOrders.length}`);
    console.log(`   • Operações falharam: ${failedOrders.length}`);
    
    orderResults.forEach(({ market, result }) => {
      const status = result && !result.error ? '✅' : '❌';
      const errorMsg = result?.error ? ` - ${result.error}` : '';
      
      // Para estratégia PRO_MAX, inclui o nível do sinal
      let orderMsg;
      const row = rows.find(r => r.market === market);
      if (this.strategy.constructor.name === 'ProMaxStrategy' && row?.signalLevel) {
        orderMsg = `${status} ${market} (${row.signalLevel}): ${result && !result.error ? 'Executada' : 'Falhou' + errorMsg}`;
      } else {
        orderMsg = `${status} ${market}: ${result && !result.error ? 'Executada' : 'Falhou' + errorMsg}`;
      }
      
      if (logger) {
        logger.order(orderMsg);
      } else {
        console.log(orderMsg);
      }
    });
    
    if (successfulOrders.length > 0) {
      const successMsg = `✅ ${successfulOrders.length} ordens executadas com sucesso`;
      if (logger) {
        logger.success(successMsg);
      } else {
        console.log(successMsg);
      }
    }
    if (failedOrders.length > 0) {
      const failedMsg = `❌ ${failedOrders.length} ordens falharam`;
      if (logger) {
        logger.error(failedMsg);
      } else {
        console.log(failedMsg);
      }
    }
    


    // Log informativo quando não há operações
    if (rows.length === 0) {
      const noOpsMsg = `⏰ Nenhuma operação encontrada.`;
      if (logger) {
        logger.info(noOpsMsg);
      } else {
        console.log(noOpsMsg);
      }
      
      // Log resumo da análise quando não há operações
      console.log(`\n📈 RESUMO DA ANÁLISE:`);
      console.log(`   • Mercados analisados: ${dataset.length}`);
      console.log(`   • Sinais encontrados: 0`);
      console.log(`   • Operações executadas: 0`);
    }

    // Monitoramento de ordens pendentes agora é feito a cada 5 segundos em app.js
    // para resposta mais rápida na criação de take profits

    } catch (error) {
      const errorMsg = `❌ Erro na análise: ${error.message}`;
      if (logger) {
        logger.error(errorMsg);
      } else {
        console.log(error);
      }
    }

  } 

}

// Exporta a classe ao invés de uma instância
export default Decision;