import { calculateIndicators } from '../Decision/Indicators.js';
import { StrategyFactory } from '../Decision/Strategies/StrategyFactory.js';
import ColorLogger from '../Utils/ColorLogger.js';

export class BacktestEngine {
  constructor(config = {}) {
    this.config = {
      initialBalance: config.initialBalance || 1000, // USD
      fee: config.fee || 0.0004, // 0.04% por operação
      investmentPerTrade: config.investmentPerTrade || 100, // USD por operação (fallback)
      capitalPercentage: config.capitalPercentage || 0, // Porcentagem do capital (prioridade)
      maxConcurrentTrades: config.maxConcurrentTrades || 5,
      enableStopLoss: config.enableStopLoss !== false,
      enableTakeProfit: config.enableTakeProfit !== false,
      slippage: config.slippage || 0.0001, // 0.01% slippage
      leverage: config.leverage || 1, // Alavancagem (1x = sem alavancagem)
      minProfitPercentage: config.minProfitPercentage || 0, // Profit mínimo em % (0 = apenas vs taxas)
      // FIX: Configurações do bot real sincronizadas
      maxNegativePnlStopPct: Number(config.maxNegativePnlStopPct || process.env.MAX_NEGATIVE_PNL_STOP_PCT || -4),
      minTakeProfitPct: Number(config.minTakeProfitPct || process.env.MIN_TAKE_PROFIT_PCT || 0.5),
      enableTrailingStop: config.enableTrailingStop !== false,
      trailingStopDistance: config.trailingStopDistance || 0.01, // 1% por padrão
      
      // NOVO: Configurações de modo de simulação
      simulationMode: config.simulationMode || 'AUTO', // AUTO, HIGH_FIDELITY, STANDARD
      ambientTimeframe: config.ambientTimeframe || '1h', // Timeframe da estratégia
      actionTimeframe: config.actionTimeframe || '5m', // Timeframe de ação
      dataFormat: config.dataFormat || 'STANDARD', // NOVO: Formato dos dados recebidos
      
      // NOVO: Modo de Auditoria para diagnosticar por que não há trades
      isAuditing: config.isAuditing || false,
      ...config
    };
    
    this.logger = new ColorLogger('BACKTEST', 'ENGINE');
    this.results = {
      trades: [],
      balance: this.config.initialBalance,
      initialBalance: this.config.initialBalance,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      maxDrawdown: 0,
      maxBalance: this.config.initialBalance,
      currentDrawdown: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxConsecutiveLosses: 0,
      currentConsecutiveLosses: 0
    };
    
    this.openPositions = new Map(); // symbol -> position
    this.candleHistory = new Map(); // symbol -> candles[]
    this.strategyName = null; // Será definido em runBacktest
    
    // CORREÇÃO: Instanciar classes de stop loss do bot real
    this.stopLossStrategies = new Map(); // strategyName -> stopLossInstance
    
    // REFATORADO: Dados para modo High-Fidelity
    this.highFidelityData = new Map(); // symbol -> { oneMinuteCandles: [], ambientCandles: [] }
    this.currentAmbientCandles = new Map(); // symbol -> current ambient candle in formation
    this.lastAmbientTimestamp = new Map(); // symbol -> last ambient candle timestamp
    
    // Determinar modo de simulação
    this.determineSimulationMode();
  }

  /**
   * NOVO: Determina o modo de simulação baseado na configuração e timeframe
   */
  determineSimulationMode() {
    const { simulationMode, ambientTimeframe } = this.config;
    
    // Se modo for AUTO, determina automaticamente baseado no timeframe
    if (simulationMode === 'AUTO') {
      const highFidelityTimeframes = ['30m', '15m', '5m', '1m'];
      this.config.simulationMode = highFidelityTimeframes.includes(ambientTimeframe) ? 'HIGH_FIDELITY' : 'STANDARD';
    }
    
    this.logger.info(`🎯 Modo de Simulação: ${this.config.simulationMode}`);
    this.logger.info(`📊 Timeframe AMBIENT: ${this.config.ambientTimeframe}`);
    this.logger.info(`⚡ Timeframe ACTION: ${this.config.actionTimeframe}`);
    
    if (this.config.simulationMode === 'HIGH_FIDELITY') {
      this.logger.info(`🔬 Alta Fidelidade: Simulação intra-vela com dados de 1m`);
    } else {
      this.logger.info(`📈 Padrão: Simulação em velas fechadas`);
    }
  }

  /**
   * NOVO: Converte timeframe para milissegundos
   */
  timeframeToMs(timeframe) {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000; // minutos
      case 'h': return value * 60 * 60 * 1000; // horas
      case 'd': return value * 24 * 60 * 60 * 1000; // dias
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // semanas
      default: return 60 * 1000; // fallback para 1 minuto
    }
  }

  /**
   * REFATORADO: Executa backtest com suporte a dados duplos
   * @param {string} strategyName - Nome da estratégia
   * @param {object} historicalData - Dados históricos (formato varia conforme dataFormat)
   * @param {object} strategyConfig - Configuração da estratégia
   * @returns {object} - Resultados do backtest
   */
  async runBacktest(strategyName, historicalData, strategyConfig = {}) {
    try {
      this.strategyName = strategyName;
      this.logger.info(`🚀 Iniciando Backtest Engine para estratégia: ${strategyName}`);
      
      // REFATORADO: Detecta e processa dados no formato correto
      if (this.config.dataFormat === 'HIGH_FIDELITY' || this.isHighFidelityDataFormat(historicalData)) {
        this.logger.info('🔬 Modo HIGH_FIDELITY detectado - Processando dados duplos');
        return await this.runHighFidelityBacktest(strategyName, historicalData, strategyConfig);
      } else {
        this.logger.info('📈 Modo STANDARD detectado - Processando dados simples');
        return await this.runStandardBacktest(strategyName, historicalData, strategyConfig);
      }
      
    } catch (error) {
      this.logger.error(`❌ Erro no Backtest Engine: ${error.message}`);
      throw error;
    }
  }

  /**
   * NOVO: Detecta se os dados estão no formato HIGH_FIDELITY
   * @param {object} data - Dados históricos
   * @returns {boolean} - True se for formato HIGH_FIDELITY
   */
  isHighFidelityDataFormat(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Verifica se pelo menos um símbolo tem o formato HIGH_FIDELITY
    for (const [symbol, symbolData] of Object.entries(data)) {
      if (symbolData && 
          typeof symbolData === 'object' && 
          symbolData.oneMinuteCandles && 
          symbolData.ambientCandles) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * REFATORADO: Executa backtest de alta fidelidade com dados duplos
   * @param {string} strategyName - Nome da estratégia
   * @param {object} historicalData - Dados no formato { symbol: { oneMinuteCandles: [], ambientCandles: [] } }
   * @param {object} strategyConfig - Configuração da estratégia
   * @returns {object} - Resultados do backtest
   */
  async runHighFidelityBacktest(strategyName, historicalData, strategyConfig) {
    try {
      this.logger.info('🔬 Iniciando Backtest de Alta Fidelidade...');
      
      // Inicializa estratégia e stop loss
      const strategy = StrategyFactory.createStrategy(strategyName);
      await this.initializeStopLossStrategies();
      
      // REFATORADO: Processa dados duplos
      this.processHighFidelityData(historicalData);
      
      // Extrai todos os timestamps de 1m para simulação
      const allTimestamps = this.extractAllOneMinuteTimestamps(historicalData);
      this.logger.info(`⏰ Simulação com ${allTimestamps.length} timestamps de 1m`);
      
      // Loop principal de simulação minuto a minuto
      for (let i = 0; i < allTimestamps.length; i++) {
        const timestamp = allTimestamps[i];
        const currentData = this.getDataForOneMinuteTimestamp(historicalData, timestamp);
        
        // Atualiza posições abertas
        this.updateOpenPositions(currentData);
        this.updateTrailingStops(currentData);
        this.checkStopLossAndTakeProfit(currentData);
        
        // Analisa sinais com dados de alta fidelidade
        await this.analyzeSignalsHighFidelity(strategy, currentData, strategyConfig, timestamp);
        
        // Atualiza métricas a cada 1000 timestamps
        if (i % 1000 === 0) {
          this.updateMetrics();
          this.logger.info(`📊 Progresso: ${i}/${allTimestamps.length} timestamps processados`);
        }
      }
      
      // Fecha todas as posições no final
      const finalTimestamp = allTimestamps[allTimestamps.length - 1];
      this.closeAllPositions(finalTimestamp);
      
      // Calcula métricas finais
      this.calculateFinalMetrics();
      
      this.logger.info('✅ Backtest de Alta Fidelidade concluído');
      return this.generateReport();
      
    } catch (error) {
      this.logger.error(`❌ Erro no Backtest de Alta Fidelidade: ${error.message}`);
      throw error;
    }
  }

  /**
   * NOVO: Processa dados duplos para modo HIGH_FIDELITY
   * @param {object} historicalData - Dados no formato duplo
   */
  processHighFidelityData(historicalData) {
    this.highFidelityData.clear();
    this.currentAmbientCandles.clear();
    this.lastAmbientTimestamp.clear();
    
    for (const [symbol, data] of Object.entries(historicalData)) {
      if (data.oneMinuteCandles && data.ambientCandles) {
        this.highFidelityData.set(symbol, {
          oneMinuteCandles: data.oneMinuteCandles,
          ambientCandles: data.ambientCandles
        });
        
        // Inicializa candle atual em formação
        this.currentAmbientCandles.set(symbol, null);
        this.lastAmbientTimestamp.set(symbol, 0);
        
        this.logger.info(`🔬 ${symbol}: ${data.oneMinuteCandles.length} candles 1m + ${data.ambientCandles.length} candles ${this.config.ambientTimeframe}`);
      }
    }
  }

  /**
   * NOVO: Extrai todos os timestamps de 1m para simulação
   * @param {object} historicalData - Dados duplos
   * @returns {Array} - Array de timestamps únicos ordenados
   */
  extractAllOneMinuteTimestamps(historicalData) {
    const allTimestamps = new Set();
    
    for (const [symbol, data] of Object.entries(historicalData)) {
      if (data.oneMinuteCandles) {
        for (const candle of data.oneMinuteCandles) {
          allTimestamps.add(candle.timestamp);
        }
      }
    }
    
    return Array.from(allTimestamps).sort((a, b) => a - b);
  }

  /**
   * NOVO: Obtém dados para um timestamp específico de 1m
   * @param {object} historicalData - Dados duplos
   * @param {number} timestamp - Timestamp de 1m
   * @returns {object} - Dados para o timestamp
   */
  getDataForOneMinuteTimestamp(historicalData, timestamp) {
    const currentData = {};
    
    for (const [symbol, data] of Object.entries(historicalData)) {
      if (data.oneMinuteCandles) {
        // Encontra o candle de 1m para este timestamp
        const oneMinuteCandle = data.oneMinuteCandles.find(c => c.timestamp === timestamp);
        
        if (oneMinuteCandle) {
          // Atualiza candle atual em formação
          this.updateCurrentAmbientCandle(symbol, oneMinuteCandle);
          
          // Obtém histórico de candles AMBIENT fechados
          const ambientHistory = this.getAmbientCandleHistory(symbol, timestamp);
          
          currentData[symbol] = {
            current: oneMinuteCandle,
            ambient: this.currentAmbientCandles.get(symbol),
            history: ambientHistory
          };
        }
      }
    }
    
    return currentData;
  }

  /**
   * REFATORADO: Atualiza candle AMBIENT em formação com novo candle de 1m
   * @param {string} symbol - Símbolo
   * @param {object} oneMinuteCandle - Candle de 1m
   */
  updateCurrentAmbientCandle(symbol, oneMinuteCandle) {
    const ambientMs = this.timeframeToMs(this.config.ambientTimeframe);
    const ambientStart = Math.floor(oneMinuteCandle.timestamp / ambientMs) * ambientMs;
    
    let currentAmbient = this.currentAmbientCandles.get(symbol);
    
    // Se é um novo período AMBIENT, inicia novo candle
    if (!currentAmbient || currentAmbient.start !== ambientStart) {
      currentAmbient = {
        timestamp: ambientStart,
        start: ambientStart,
        end: ambientStart + ambientMs - 1,
        open: oneMinuteCandle.open,
        high: oneMinuteCandle.high,
        low: oneMinuteCandle.low,
        close: oneMinuteCandle.close,
        volume: oneMinuteCandle.volume,
        quoteVolume: oneMinuteCandle.quoteVolume,
        trades: oneMinuteCandle.trades
      };
    } else {
      // Atualiza candle existente
      currentAmbient.high = Math.max(currentAmbient.high, oneMinuteCandle.high);
      currentAmbient.low = Math.min(currentAmbient.low, oneMinuteCandle.low);
      currentAmbient.close = oneMinuteCandle.close;
      currentAmbient.volume += oneMinuteCandle.volume;
      currentAmbient.quoteVolume += oneMinuteCandle.quoteVolume;
      currentAmbient.trades += oneMinuteCandle.trades;
    }
    
    this.currentAmbientCandles.set(symbol, currentAmbient);
  }

  /**
   * REFATORADO: Obtém histórico de candles AMBIENT fechados
   * @param {string} symbol - Símbolo
   * @param {number} currentTimestamp - Timestamp atual
   * @returns {Array} - Array de candles AMBIENT fechados
   */
  getAmbientCandleHistory(symbol, currentTimestamp) {
    const data = this.highFidelityData.get(symbol);
    if (!data || !data.ambientCandles) {
      return [];
    }
    
    // Retorna candles AMBIENT que já fecharam (antes do timestamp atual)
    return data.ambientCandles.filter(candle => candle.end < currentTimestamp);
  }

  /**
   * NOVO: Executa backtest em modo Standard (velas fechadas)
   */
  async runStandardBacktest(strategy, historicalData, strategyConfig) {
    this.logger.info(`📈 Executando backtest em modo Standard (velas fechadas)`);
    
    // Processa dados históricos cronologicamente
    const allTimestamps = this.extractAllTimestamps(historicalData);
    const sortedTimestamps = [...new Set(allTimestamps)].sort((a, b) => a - b);
    
    this.logger.info(`📅 Período: ${new Date(sortedTimestamps[0]).toLocaleString()} - ${new Date(sortedTimestamps[sortedTimestamps.length - 1]).toLocaleString()}`);
    this.logger.info(`⏱️ Total de candles: ${sortedTimestamps.length}`);
    
    // Processa cada timestamp
    for (let i = 0; i < sortedTimestamps.length; i++) {
      const timestamp = sortedTimestamps[i];
      const currentData = this.getDataForTimestamp(historicalData, timestamp);
      
      // Atualiza preços das posições abertas
      this.updateOpenPositions(currentData);
      
      // CORREÇÃO: Atualiza trailing stop antes de verificar saídas
      if (this.config.enableTrailingStop) {
        this.updateTrailingStops(currentData);
      }
      
      // Verifica stop loss e take profit (agora com lógica dinâmica de PnL)
      this.checkStopLossAndTakeProfit(currentData);
      
      // Analisa novos sinais apenas se não atingiu limite de posições
      if (this.openPositions.size < this.config.maxConcurrentTrades) {
        await this.analyzeSignals(strategy, currentData, strategyConfig, timestamp);
      }
      
      // Atualiza métricas a cada 100 candles
      if (i % 100 === 0) {
        this.updateMetrics();
        this.logger.info(`📈 Progresso: ${((i / sortedTimestamps.length) * 100).toFixed(1)}% - Saldo: $${this.results.balance.toFixed(2)}`);
      }
    }
    
    // Fecha todas as posições abertas no final
    this.closeAllPositions(sortedTimestamps[sortedTimestamps.length - 1]);
    
    // Calcula métricas finais
    this.calculateFinalMetrics();
    
    this.logger.info('✅ Backtest Standard concluído');
    return this.generateReport();
  }

  /**
   * NOVO: Analisa sinais em modo High-Fidelity
   */
  async analyzeSignalsHighFidelity(strategy, currentData, strategyConfig, timestamp) {
    for (const [symbol, data] of Object.entries(currentData)) {
      // Constrói vela AMBIENT atual baseada em dados de 1m
      const currentAmbientCandle = this.currentAmbientCandles.get(symbol);
      
      // Obtém histórico de velas AMBIENT para análise
      const ambientCandleHistory = this.getAmbientCandleHistory(symbol, timestamp);
      
      // Verifica se tem dados suficientes para análise
      if (ambientCandleHistory.length < 50) {
        continue; // Aguarda mais dados
      }
      
      // Cria dados no formato esperado pela estratégia
      const ambientData = {
        [symbol]: ambientCandleHistory
      };
      
      // Analisa sinais usando velas AMBIENT
      await this.analyzeSignals(strategy, ambientData, strategyConfig, timestamp);
    }
  }

  /**
   * CORREÇÃO: Inicializar estratégias de stop loss do bot real
   */
  async initializeStopLossStrategies() {
    try {
      // Importa as classes de stop loss do bot real
      const { DefaultStopLoss } = await import('../Decision/Strategies/DefaultStopLoss.js');
      const { ProMaxStopLoss } = await import('../Decision/Strategies/ProMaxStopLoss.js');
      
      // Instancia as estratégias de stop loss
      this.stopLossStrategies.set('DEFAULT', new DefaultStopLoss());
      this.stopLossStrategies.set('PRO_MAX', new ProMaxStopLoss());
      
      this.logger.info('✅ Estratégias de stop loss do bot real inicializadas');
    } catch (error) {
      this.logger.error(`❌ Erro ao inicializar estratégias de stop loss: ${error.message}`);
      throw error;
    }
  }

  /**
>>>>>>> Stashed changes
   * Extrai todos os timestamps únicos dos dados históricos
   */
  extractAllTimestamps(historicalData) {
    const timestamps = [];
    for (const [symbol, candles] of Object.entries(historicalData)) {
      for (const candle of candles) {
        timestamps.push(candle.timestamp);
      }
    }
    return timestamps;
  }

  /**
   * Obtém dados de todos os símbolos para um timestamp específico
   */
  getDataForTimestamp(historicalData, timestamp) {
    const currentData = {};
    
    for (const [symbol, candles] of Object.entries(historicalData)) {
      const candle = candles.find(c => c.timestamp === timestamp);
      if (candle) {
        // Atualiza histórico de candles
        if (!this.candleHistory.has(symbol)) {
          this.candleHistory.set(symbol, []);
        }
        
        const history = this.candleHistory.get(symbol);
        history.push(candle);
        
        // Mantém apenas os últimos 100 candles para performance
        if (history.length > 100) {
          history.shift();
        }
        
        // Calcula indicadores
        const indicators = calculateIndicators(history);
        
        currentData[symbol] = {
          market: {
            symbol: symbol,
            decimal_price: 6 // Assumindo 6 casas decimais
          },
          marketPrice: candle.close,
          timestamp: candle.timestamp,
          ...indicators
        };
      }
    }
    
    return currentData;
  }

  /**
   * Analisa sinais de trading para todos os símbolos
   */
  async analyzeSignals(strategy, currentData, strategyConfig, timestamp) {
    // Log das configurações carregadas
    const maxTargets = Number(process.env.MAX_TARGETS_PER_ORDER || 20);
    this.logger.info(`🎯 MAX_TARGETS_PER_ORDER carregado: ${maxTargets}`);
    
    // VALIDAÇÃO: MAX_OPEN_TRADES - Controla quantidade máxima de posições abertas
    const maxOpenTrades = Number(process.env.MAX_OPEN_TRADES || this.config.maxConcurrentTrades || 5);
    const currentOpenPositions = this.openPositions.size;
    
    if (currentOpenPositions >= maxOpenTrades) {
      this.logger.warn(`🚫 MAX_OPEN_TRADES atingido: ${currentOpenPositions}/${maxOpenTrades} posições abertas`);
      return;
    }
    
    for (const [symbol, data] of Object.entries(currentData)) {
      // Verifica se já tem posição aberta neste símbolo
      if (this.openPositions.has(symbol)) {
        continue;
      }
      
      // Verifica novamente se atingiu o limite antes de abrir nova posição
      if (this.openPositions.size >= maxOpenTrades) {
        this.logger.warn(`🚫 MAX_OPEN_TRADES atingido durante análise: ${this.openPositions.size}/${maxOpenTrades}`);
        break;
      }
      
      try {
        // Combina configurações do .env com as passadas
        const envConfig = {
          // Configurações específicas da estratégia PRO_MAX
          maxTargetsPerOrder: maxTargets,
          adxLength: Number(process.env.ADX_LENGTH || 14),
          adxThreshold: Number(process.env.ADX_THRESHOLD || 20),
          adxAverageLength: Number(process.env.ADX_AVERAGE_LENGTH || 21),
          
          // Configurações de validação
          useRsiValidation: process.env.USE_RSI_VALIDATION === 'true',
          useStochValidation: process.env.USE_STOCH_VALIDATION === 'true',
          useMacdValidation: process.env.USE_MACD_VALIDATION === 'true',
          
          // Configurações RSI
          rsiLength: Number(process.env.RSI_LENGTH || 14),
          rsiAverageLength: Number(process.env.RSI_AVERAGE_LENGTH || 14),
          rsiBullThreshold: Number(process.env.RSI_BULL_THRESHOLD || 45),
          rsiBearThreshold: Number(process.env.RSI_BEAR_THRESHOLD || 55),
          
          // Configurações Stochastic
          stochKLength: Number(process.env.STOCH_K_LENGTH || 14),
          stochDLength: Number(process.env.STOCH_D_LENGTH || 3),
          stochSmooth: Number(process.env.STOCH_SMOOTH || 3),
          stochBullThreshold: Number(process.env.STOCH_BULL_THRESHOLD || 45),
          stochBearThreshold: Number(process.env.STOCH_BEAR_THRESHOLD || 55),
          
          // Configurações MACD
          macdFastLength: Number(process.env.MACD_FAST_LENGTH || 12),
          macdSlowLength: Number(process.env.MACD_SLOW_LENGTH || 26),
          macdSignalLength: Number(process.env.MACD_SIGNAL_LENGTH || 9),
          
          // Configurações gerais
          ignoreBronzeSignals: process.env.IGNORE_BRONZE_SIGNALS === 'true',
          
          // Sobrescreve com configurações específicas passadas
          ...strategyConfig
        };
        
        // NOVO: Passa configuração de auditoria para a estratégia
        const auditConfig = {
          ...envConfig,
          isAuditing: this.config.isAuditing
        };
        
        const decision = await strategy.analyzeTrade(
          this.config.fee,
          data,
          this.config.investmentPerTrade,
          0, // media_rsi (não usado no backtest)
          auditConfig
        );
        
        // NOVO: Tratamento de pacotes de auditoria
        if (decision && decision.auditInfo) {
          // É um pacote de auditoria
          console.log('\n🔍 PACOTE DE AUDITORIA:');
          console.log(JSON.stringify(decision, null, 2));
          
          // Verifica se a decisão foi aprovada
          if (decision.finalDecision.decision === 'APPROVED') {
            // Converte o pacote de auditoria em decisão de trading
            const tradingDecision = this.convertAuditToTradingDecision(decision, data);
            if (tradingDecision) {
              await this.openPosition(symbol, tradingDecision, timestamp);
            }
          }
        } else if (decision) {
          // É uma decisão normal de trading
          await this.openPosition(symbol, decision, timestamp);
        }
      } catch (error) {
        this.logger.error(`❌ Erro ao analisar ${symbol}: ${error.message}`);
      }
    }
  }

  /**
   * Abre uma nova posição
   */
  async openPosition(symbol, decision, timestamp) {
    try {
      const entryPrice = parseFloat(decision.entry);
      
      // Calcula volume baseado na configuração (igual ao bot real)
      let investmentUSD;
      if (this.config.capitalPercentage > 0) {
        // Usa porcentagem do capital disponível
        const availableCapital = this.results.balance;
        investmentUSD = (availableCapital * this.config.capitalPercentage) / 100;
      } else {
        // Usa valor fixo
        investmentUSD = this.config.investmentPerTrade;
      }
      
      // Calcula volume com alavancagem (volume efetivo = margem × alavancagem)
      let effectiveInvestment = investmentUSD * this.config.leverage;
      
      // Validação para evitar valores extremos
      if (effectiveInvestment > 1000000) { // Limite de $1M por operação
        this.logger.warn(`⚠️ Volume muito alto: $${effectiveInvestment.toFixed(2)} - Limitando a $1,000,000`);
        effectiveInvestment = 1000000;
      }
      
      const units = effectiveInvestment / entryPrice;
      
      // Aplica slippage
      const actualEntryPrice = decision.action === 'long' 
        ? entryPrice * (1 + this.config.slippage)
        : entryPrice * (1 - this.config.slippage);
      
      // Calcula unidades por target (distribuição igual)
      const totalTargets = decision.targets ? decision.targets.length : 1;
      const unitsPerTarget = units / totalTargets;
      
      const position = {
        symbol,
        action: decision.action,
        entryPrice: actualEntryPrice,
        totalUnits: units,
        unitsPerTarget,
        stopLoss: decision.stop, // Primeiro stop para compatibilidade
        takeProfit: decision.target, // Primeiro target para compatibilidade
        targets: decision.targets || [decision.target], // Todos os targets
        stopLosses: decision.stopLosses || [decision.stop], // Todos os stops (CypherPunk)
        executedTargets: [], // Targets já executados
        remainingUnits: units, // Unidades restantes
        timestamp,
        decision
      };
      
      this.openPositions.set(symbol, position);
      
      // Log específico para CypherPunk
      if (decision.tradeSystem) {
        this.logger.info(`📈 ABERTO ${symbol} ${decision.action.toUpperCase()} @ $${actualEntryPrice.toFixed(6)}`);
        this.logger.info(`   🎯 Targets: ${position.targets.map((t, i) => `${i+1}=$${t.toFixed(6)} (${decision.tradeSystem.targetPercentages[i]}%)`).join(' | ')}`);
        this.logger.info(`   🛑 Stops: ${position.stopLosses.map((s, i) => `${i+1}=$${s.toFixed(6)} (${decision.tradeSystem.stopPercentages[i]}%)`).join(' | ')}`);
        this.logger.info(`   📊 Risk/Reward: ${decision.tradeSystem.riskRewardRatio}:1`);
      } else {
        this.logger.info(`📈 ABERTO ${symbol} ${decision.action.toUpperCase()} @ $${actualEntryPrice.toFixed(6)}`);
        this.logger.info(`   Stop: $${decision.stop.toFixed(6)} | Targets: ${position.targets.length} (${position.targets.slice(0, 3).map(t => t.toFixed(6)).join(', ')}${position.targets.length > 3 ? '...' : ''})`);
        this.logger.info(`   💰 Volume: $${effectiveInvestment.toFixed(2)} | Alavancagem: ${this.config.leverage}x | Margem: $${investmentUSD.toFixed(2)}`);
      }
      
    } catch (error) {
      this.logger.error(`❌ Erro ao abrir posição ${symbol}: ${error.message}`);
    }
  }

  /**
   * Atualiza preços das posições abertas
   */
  updateOpenPositions(currentData) {
    for (const [symbol, position] of this.openPositions) {
      const data = currentData[symbol];
      if (data) {
        position.currentPrice = parseFloat(data.marketPrice);
      }
    }
  }

  /**
   * NOVO: Converte pacote de auditoria em decisão de trading
   * @param {object} auditPackage - Pacote de auditoria
   * @param {object} data - Dados de mercado
   * @returns {object|null} - Decisão de trading ou null
   */
  convertAuditToTradingDecision(auditPackage, data) {
    try {
      // Extrai informações do pacote de auditoria
      const { finalDecision, inputData } = auditPackage;
      
      if (finalDecision.decision !== 'APPROVED') {
        return null;
      }
      
      // Reconstrói a decisão de trading baseada nos dados de auditoria
      const currentPrice = parseFloat(inputData.currentPrice);
      
      // Calcula stop e target baseado nos indicadores
      const signals = this.reconstructSignalsFromAudit(auditPackage);
      if (!signals) {
        return null;
      }
      
      const stopTarget = this.calculateStopAndTargetFromAudit(auditPackage, currentPrice, signals.isLong);
      if (!stopTarget) {
        return null;
      }
      
      return {
        action: signals.isLong ? 'long' : 'short',
        entry: currentPrice,
        stop: stopTarget.stop,
        target: stopTarget.target,
        timestamp: auditPackage.auditInfo.timestamp
      };
      
    } catch (error) {
      this.logger.error(`❌ Erro ao converter auditoria para decisão: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Reconstrói sinais a partir do pacote de auditoria
   */
  reconstructSignalsFromAudit(auditPackage) {
    try {
      // Procura pela camada de análise de sinais no trace
      const signalLayer = auditPackage.validationTrace.find(layer => 
        layer.layer === '2. Análise de Sinais'
      );
      
      if (!signalLayer || signalLayer.status !== 'PASS') {
        return null;
      }
      
      // Extrai informações do sinal da avaliação
      const evaluation = signalLayer.evaluation;
      const isLong = evaluation.includes('LONG');
      const signalType = evaluation.includes('GREEN') ? 'GREEN' : 'RED';
      
      return {
        hasSignal: true,
        isLong,
        signalType
      };
      
    } catch (error) {
      this.logger.error(`❌ Erro ao reconstruir sinais: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Calcula stop e target a partir do pacote de auditoria
   */
  calculateStopAndTargetFromAudit(auditPackage, currentPrice, isLong) {
    try {
      // Procura pela camada de cálculo de stop e target no trace
      const stopTargetLayer = auditPackage.validationTrace.find(layer => 
        layer.layer === '6. Cálculo de Stop e Target'
      );
      
      if (!stopTargetLayer || stopTargetLayer.status !== 'PASS') {
        return null;
      }
      
      // Extrai valores da avaliação
      const evaluation = stopTargetLayer.evaluation;
      const stopMatch = evaluation.match(/Stop: \$([\d.]+)/);
      const targetMatch = evaluation.match(/Target: \$([\d.]+)/);
      
      if (!stopMatch || !targetMatch) {
        return null;
      }
      
      return {
        stop: parseFloat(stopMatch[1]),
        target: parseFloat(targetMatch[1])
      };
      
    } catch (error) {
      this.logger.error(`❌ Erro ao calcular stop/target: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica stop loss e take profit
   */
  checkStopLossAndTakeProfit(currentData) {
    for (const [symbol, position] of this.openPositions) {
      const data = currentData[symbol];
      if (!data || !position.currentPrice) continue;
      
      const currentPrice = position.currentPrice;
      let shouldClose = false;
      let closeReason = '';
      
      // Verifica stop loss (fecha completamente)
      if (this.config.enableStopLoss) {
        // Verifica stops múltiplos (CypherPunk)
        if (position.stopLosses && position.stopLosses.length > 1) {
          for (let i = 0; i < position.stopLosses.length; i++) {
            const stop = position.stopLosses[i];
            
            if (position.action === 'long' && currentPrice <= stop) {
              shouldClose = true;
              closeReason = `Stop Loss ${i + 1} (${position.decision?.tradeSystem?.stopPercentages?.[i] || 'N/A'}%)`;
              break;
            } else if (position.action === 'short' && currentPrice >= stop) {
              shouldClose = true;
              closeReason = `Stop Loss ${i + 1} (${position.decision?.tradeSystem?.stopPercentages?.[i] || 'N/A'}%)`;
              break;
            }
          }
        } else {
          // Verifica stop único (compatibilidade)
          if (position.action === 'long' && currentPrice <= position.stopLoss) {
            shouldClose = true;
            closeReason = 'Stop Loss';
          } else if (position.action === 'short' && currentPrice >= position.stopLoss) {
            shouldClose = true;
            closeReason = 'Stop Loss';
          }
        }
      }
      
      // Verifica profit mínimo vs taxas (estratégia DEFAULT) - PRIORIDADE 1
      const minProfitPct = this.config.minProfitPercentage || 0; // Usa configuração do backtest
      if (!shouldClose && this.strategyName === 'DEFAULT') {
        if (minProfitPct === 0) {
          if (this.shouldCloseForMinimumProfit(position, currentPrice)) {
            shouldClose = true;
            closeReason = 'Profit vs Taxas';
          }
        } else {
          if (this.shouldCloseForConfiguredProfit(position, currentPrice)) {
            shouldClose = true;
            closeReason = 'Profit Mínimo Configurado';
          }
        }
      }
      
      // Verifica take profits parciais (estratégia PRO_MAX e CYPHERPUNK) - PRIORIDADE 3
      if (!shouldClose && this.config.enableTakeProfit && position.targets) {
        for (let i = 0; i < position.targets.length; i++) {
          const target = position.targets[i];
          
          // Pula se já foi executado
          if (position.executedTargets.includes(i)) {
            continue;
          }
          
          // Verifica se atingiu o target
          let targetHit = false;
          if (position.action === 'long' && currentPrice >= target) {
            targetHit = true;
          } else if (position.action === 'short' && currentPrice <= target) {
            targetHit = true;
          }
          
          if (targetHit) {
            // Executa target parcial
            this.executePartialTarget(symbol, i, target, data.timestamp);
          }
        }
        
        // Verifica se todos os targets foram executados
        if (position.executedTargets.length === position.targets.length) {
          shouldClose = true;
          closeReason = 'All Targets Hit';
        }
      }
      
      // Verifica take profit único (compatibilidade com outras estratégias) - PRIORIDADE 4
      if (!shouldClose && this.config.enableTakeProfit && !position.targets) {
        if (position.action === 'long' && currentPrice >= position.takeProfit) {
          shouldClose = true;
          closeReason = 'Take Profit';
        } else if (position.action === 'short' && currentPrice <= position.takeProfit) {
          shouldClose = true;
          closeReason = 'Take Profit';
        }
      }
      
      if (shouldClose) {
        this.closePosition(symbol, currentPrice, closeReason, data.timestamp);
      }
    }
  }

  /**
   * Executa um target parcial
   */
  executePartialTarget(symbol, targetIndex, targetPrice, timestamp) {
    const position = this.openPositions.get(symbol);
    if (!position || position.executedTargets.includes(targetIndex)) {
      return;
    }
    
    // Marca target como executado
    position.executedTargets.push(targetIndex);
    
    // Calcula unidades para este target
    const unitsToExecute = position.unitsPerTarget;
    position.remainingUnits -= unitsToExecute;
    
    // Aplica slippage
    const actualTargetPrice = position.action === 'long'
      ? targetPrice * (1 - this.config.slippage)
      : targetPrice * (1 + this.config.slippage);
    
    // Calcula PnL parcial
    const entryValue = position.entryPrice * unitsToExecute;
    const exitValue = actualTargetPrice * unitsToExecute;
    
    let partialPnl;
    if (position.action === 'long') {
      partialPnl = exitValue - entryValue;
    } else {
      partialPnl = entryValue - exitValue;
    }
    
    // Deduz taxas
    const entryFee = entryValue * this.config.fee;
    const exitFee = exitValue * this.config.fee;
    const totalFees = entryFee + exitFee;
    partialPnl -= totalFees;
    
    // Atualiza saldo
    this.results.balance += partialPnl;
    this.results.totalPnL += partialPnl;
    
    // Armazena trade parcial no histórico
    this.results.trades.push({
      symbol,
      action: position.action,
      entryPrice: position.entryPrice,
      exitPrice: actualTargetPrice,
      units: unitsToExecute,
      pnl: partialPnl,
      fees: totalFees,
      reason: `Target ${targetIndex + 1}`,
      timestamp,
      duration: timestamp - position.timestamp,
      isPartial: true,
      targetIndex
    });
    
    // Log específico para CypherPunk
    if (position.decision?.tradeSystem) {
      const percentage = position.decision.tradeSystem.targetPercentages[targetIndex];
      this.logger.info(`🎯 TARGET ${targetIndex + 1} ${symbol} ${position.action.toUpperCase()} @ $${actualTargetPrice.toFixed(6)} (${percentage}%)`);
      this.logger.info(`   PnL Parcial: $${partialPnl.toFixed(2)} | Saldo: $${this.results.balance.toFixed(2)} | Restante: ${position.remainingUnits.toFixed(6)}`);
    } else {
      this.logger.info(`🎯 TARGET ${targetIndex + 1} ${symbol} ${position.action.toUpperCase()} @ $${actualTargetPrice.toFixed(6)}`);
      this.logger.info(`   PnL Parcial: $${partialPnl.toFixed(2)} | Saldo: $${this.results.balance.toFixed(2)} | Restante: ${position.remainingUnits.toFixed(6)}`);
    }
  }

  /**
   * Fecha uma posição
   */
  closePosition(symbol, exitPrice, reason, timestamp) {
    const position = this.openPositions.get(symbol);
    if (!position) return;
    
    // Se a posição tem targets múltiplos e ainda há unidades restantes
    if (position.targets && position.remainingUnits > 0) {
      // Fecha apenas as unidades restantes
      const unitsToClose = position.remainingUnits;
      
      // Aplica slippage
      const actualExitPrice = position.action === 'long'
        ? exitPrice * (1 - this.config.slippage)
        : exitPrice * (1 + this.config.slippage);
      
      // Calcula PnL das unidades restantes
      const entryValue = position.entryPrice * unitsToClose;
      const exitValue = actualExitPrice * unitsToClose;
      
      let finalPnl;
      if (position.action === 'long') {
        finalPnl = exitValue - entryValue;
      } else {
        finalPnl = entryValue - exitValue;
      }
      
      // Deduz taxas
      const entryFee = entryValue * this.config.fee;
      const exitFee = exitValue * this.config.fee;
      const totalFees = entryFee + exitFee;
      finalPnl -= totalFees;
      
      // Atualiza saldo
      this.results.balance += finalPnl;
      this.results.totalPnL += finalPnl;
      
      // Armazena trade final no histórico
      this.results.trades.push({
        symbol,
        action: position.action,
        entryPrice: position.entryPrice,
        exitPrice: actualExitPrice,
        units: unitsToClose,
        pnl: finalPnl,
        fees: totalFees,
        reason: reason,
        timestamp,
        duration: timestamp - position.timestamp,
        isPartial: true,
        targetIndex: 'final'
      });
      
      // Log
      const pnlColor = finalPnl >= 0 ? '🟢' : '🔴';
      const pnlPercentage = (finalPnl / (entryValue / this.config.leverage)) * 100;
      this.logger.info(`${pnlColor} FECHADO FINAL ${symbol} ${position.action.toUpperCase()} @ $${actualExitPrice.toFixed(6)}`);
      this.logger.info(`   ${reason} | PnL: $${finalPnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%) | Alavancagem: ${this.config.leverage}x | Saldo: $${this.results.balance.toFixed(2)}`);
      
    } else {
      // Fechamento tradicional (sem targets múltiplos)
      const units = position.totalUnits || position.units;
      
      // Aplica slippage
      const actualExitPrice = position.action === 'long'
        ? exitPrice * (1 - this.config.slippage)
        : exitPrice * (1 + this.config.slippage);
      
      // Calcula PnL
      const entryValue = position.entryPrice * units;
      const exitValue = actualExitPrice * units;
      
      let pnl;
      if (position.action === 'long') {
        pnl = exitValue - entryValue;
      } else {
        pnl = entryValue - exitValue;
      }
      
      // Deduz taxas
      const entryFee = entryValue * this.config.fee;
      const exitFee = exitValue * this.config.fee;
      const totalFees = entryFee + exitFee;
      pnl -= totalFees;
      
      // Atualiza saldo
      this.results.balance += pnl;
      this.results.totalPnL += pnl;
      this.results.totalTrades++;
      
      // Atualiza estatísticas
      if (pnl > 0) {
        this.results.winningTrades++;
        this.results.currentConsecutiveLosses = 0;
      } else {
        this.results.losingTrades++;
        this.results.currentConsecutiveLosses++;
        this.results.maxConsecutiveLosses = Math.max(
          this.results.maxConsecutiveLosses,
          this.results.currentConsecutiveLosses
        );
      }
      
      // Atualiza drawdown
      if (this.results.balance > this.results.maxBalance) {
        this.results.maxBalance = this.results.balance;
      }
      this.results.currentDrawdown = (this.results.maxBalance - this.results.balance) / this.results.maxBalance;
      this.results.maxDrawdown = Math.max(this.results.maxDrawdown, this.results.currentDrawdown);
      
      // Armazena trade no histórico
      this.results.trades.push({
        symbol,
        action: position.action,
        entryPrice: position.entryPrice,
        exitPrice: actualExitPrice,
        units: units,
        pnl: pnl,
        fees: totalFees,
        reason: reason,
        timestamp,
        duration: timestamp - position.timestamp
      });
      
      // Log
      const pnlColor = pnl >= 0 ? '🟢' : '🔴';
      this.logger.info(`${pnlColor} FECHADO ${symbol} ${position.action.toUpperCase()} @ $${actualExitPrice.toFixed(6)}`);
      this.logger.info(`   ${reason} | PnL: $${pnl.toFixed(2)} | Saldo: $${this.results.balance.toFixed(2)}`);
    }
    
    // Remove posição
    this.openPositions.delete(symbol);
  }

  /**
   * Fecha todas as posições abertas
   */
  closeAllPositions(timestamp) {
    for (const [symbol, position] of this.openPositions) {
      const exitPrice = position.currentPrice || position.entryPrice;
      this.closePosition(symbol, exitPrice, 'Final do Backtest', timestamp);
    }
  }

  /**
   * Atualiza métricas durante o backtest
   */
  updateMetrics() {
    if (this.results.totalTrades > 0) {
      this.results.winRate = (this.results.winningTrades / this.results.totalTrades) * 100;
    }
  }

  /**
   * Calcula métricas finais
   */
  calculateFinalMetrics() {
    // Agrupa trades por operação (symbol + timestamp de entrada)
    const operationGroups = new Map();
    
    for (const trade of this.results.trades) {
      const key = `${trade.symbol}_${trade.timestamp}`;
      if (!operationGroups.has(key)) {
        operationGroups.set(key, []);
      }
      operationGroups.get(key).push(trade);
    }
    
    // Calcula trades completos (agrupando parciais)
    const completeTrades = [];
    for (const [key, trades] of operationGroups) {
      if (trades.length === 1 && !trades[0].isPartial) {
        // Trade único (sem targets múltiplos)
        completeTrades.push(trades[0]);
      } else {
        // Trade com targets múltiplos - agrupa todos os parciais
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
        const totalUnits = trades.reduce((sum, t) => sum + t.units, 0);
        const firstTrade = trades[0];
        const lastTrade = trades[trades.length - 1];
        
        completeTrades.push({
          symbol: firstTrade.symbol,
          action: firstTrade.action,
          entryPrice: firstTrade.entryPrice,
          exitPrice: lastTrade.exitPrice,
          units: totalUnits,
          pnl: totalPnl,
          fees: totalFees,
          reason: trades.length > 1 ? `Multiple Targets (${trades.length})` : firstTrade.reason,
          timestamp: firstTrade.timestamp,
          duration: lastTrade.timestamp - firstTrade.timestamp,
          isComplete: true
        });
      }
    }
    
    // Atualiza contadores baseados em trades completos
    this.results.totalTrades = completeTrades.length;
    this.results.winningTrades = completeTrades.filter(t => t.pnl > 0).length;
    this.results.losingTrades = completeTrades.filter(t => t.pnl < 0).length;
    
    // Win rate
    if (this.results.totalTrades > 0) {
      this.results.winRate = (this.results.winningTrades / this.results.totalTrades) * 100;
    }
    
    // Média de ganhos e perdas
    const winningTrades = completeTrades.filter(t => t.pnl > 0);
    const losingTrades = completeTrades.filter(t => t.pnl < 0);
    
    if (winningTrades.length > 0) {
      this.results.averageWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
    }
    
    if (losingTrades.length > 0) {
      this.results.averageLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length);
    }
    
    // Profit factor
    if (this.results.averageLoss > 0) {
      this.results.profitFactor = this.results.averageWin / this.results.averageLoss;
    }
    
    // Sharpe ratio (simplificado)
    if (this.results.totalTrades > 0) {
      const returns = completeTrades.map(t => t.pnl / this.config.investmentPerTrade);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        this.results.sharpeRatio = avgReturn / stdDev;
      }
    }
    
    // Retorno total
    this.results.totalReturn = ((this.results.balance - this.config.initialBalance) / this.config.initialBalance) * 100;
    
    // Retorno anualizado (assumindo 365 dias)
    const days = this.config.days || 365;
    this.results.annualizedReturn = this.results.totalReturn * (365 / days);
    
    // Métricas de alavancagem
    this.results.leverage = this.config.leverage;
    this.results.effectiveCapital = this.config.initialBalance * this.config.leverage;
    this.results.leverageAdjustedReturn = this.results.totalReturn * this.config.leverage;
    this.results.leverageAdjustedPnL = this.results.totalPnL * this.config.leverage;
    
    // Adiciona informações sobre targets múltiplos
    this.results.partialTrades = this.results.trades.filter(t => t.isPartial).length;
    this.results.completeTrades = completeTrades.length;
  }

  /**
   * Gera relatório detalhado dos resultados
   */
  generateReport() {
    const report = {
      summary: {
        strategy: this.config.strategyName,
        period: `${new Date(this.results.startDate).toLocaleDateString()} - ${new Date(this.results.endDate).toLocaleDateString()}`,
        initialBalance: this.config.initialBalance,
        finalBalance: this.results.balance,
        totalReturn: this.results.totalReturn,
        totalPnL: this.results.totalPnL,
        leverage: this.config.leverage,
        effectiveCapital: this.config.initialBalance * this.config.leverage
      },
      performance: {
        totalTrades: this.results.totalTrades,
        winningTrades: this.results.winningTrades,
        losingTrades: this.results.losingTrades,
        winRate: this.results.winRate,
        averageWin: this.results.averageWin,
        averageLoss: this.results.averageLoss,
        profitFactor: this.results.profitFactor,
        sharpeRatio: this.results.sharpeRatio,
        leverage: this.results.leverage,
        leverageAdjustedReturn: this.results.leverageAdjustedReturn,
        leverageAdjustedPnL: this.results.leverageAdjustedPnL
      },
      risk: {
        maxDrawdown: this.results.maxDrawdown * 100,
        maxConsecutiveLosses: this.results.maxConsecutiveLosses
      },
      trades: this.results.trades
    };
    
    return report;
  }

  /**
   * Verifica se deve fechar posição por profit mínimo (estratégia DEFAULT)
   * Implementa a mesma lógica do TrailingStop.js
   */
  shouldCloseForMinimumProfit(position, currentPrice) {
    try {
      // Calcula PnL atual
      const entryValue = position.entryPrice * position.totalUnits;
      const currentValue = currentPrice * position.totalUnits;
      
      let pnl;
      if (position.action === 'long') {
        pnl = currentValue - entryValue;
      } else {
        pnl = entryValue - currentValue;
      }
      
      // Calcula taxas totais (entrada + saída)
      const entryFee = entryValue * this.config.fee;
      const exitFee = currentValue * this.config.fee;
      const totalFees = entryFee + exitFee;
      
      // Lucro líquido (após taxas)
      const netProfit = pnl - totalFees;
      
      // Só fecha se há lucro líquido (após taxas)
      if (netProfit > 0) {
        this.logger.info(`✅ [PROFIT_CHECK] ${position.symbol}: Fechando por lucro $${netProfit.toFixed(4)} > 0 (após taxas)`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('[PROFIT_CHECK] Erro ao verificar profit mínimo:', error.message);
      return false;
    }
  }

  /**
   * Verifica se deve fechar posição por profit mínimo configurado (estratégia DEFAULT)
   */
  shouldCloseForConfiguredProfit(position, currentPrice) {
    try {
      // Calcula PnL atual
      const entryValue = position.entryPrice * position.totalUnits;
      const currentValue = currentPrice * position.totalUnits;
      
      let pnl;
      if (position.action === 'long') {
        pnl = currentValue - entryValue;
      } else {
        pnl = entryValue - currentValue;
      }
      
      // Calcula taxas totais
      const entryFee = entryValue * this.config.fee;
      const exitFee = currentValue * this.config.fee;
      const totalFees = entryFee + exitFee;
      
      // Lucro líquido (após taxas)
      const netProfit = pnl - totalFees;
      const netProfitPct = entryValue > 0 ? (netProfit / entryValue) * 100 : 0;
      
      // Configuração de profit mínimo (apenas porcentagem)
      const minProfitPct = this.config.minProfitPercentage || 0;
      
      // Só fecha se há lucro líquido E atende ao critério configurado
      if (netProfit > 0 && netProfitPct >= minProfitPct) {
        this.logger.info(`✅ [CONFIG_PROFIT] ${position.symbol}: Fechando por lucro ${netProfitPct.toFixed(3)}% >= mínimo ${minProfitPct.toFixed(3)}%`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('[CONFIG_PROFIT] Erro ao verificar profit configurado:', error.message);
      return false;
    }
  }
} 