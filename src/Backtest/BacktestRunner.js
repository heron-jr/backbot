import { BacktestEngine } from './BacktestEngine.js';
import { DataProvider } from './DataProvider.js';
import ColorLogger from '../Utils/ColorLogger.js';
import fs from 'fs/promises';
import path from 'path';

export class BacktestRunner {
  constructor() {
    this.logger = new ColorLogger('BACKTEST', 'RUNNER');
    this.engine = null;
    this.dataProvider = new DataProvider();
  }

  /**
   * REFATORADO: Executa backtest completo com suporte a dados duplos
   * @param {object} config - Configuração do backtest
   * @returns {object} - Resultados do backtest
   */
  async runBacktest(config) {
    try {
      this.logger.info('🚀 Iniciando Backtest Runner...');
      
      // Valida configuração
      this.validateConfig(config);
      
      // Determina modo de simulação se não especificado
      if (!config.simulationMode) {
        config.simulationMode = this.determineSimulationMode(config.interval || config.ambientTimeframe);
      }
      
      // Determina timeframes se não especificados
      if (!config.ambientTimeframe) {
        config.ambientTimeframe = config.interval;
      }
      if (!config.actionTimeframe) {
        config.actionTimeframe = this.getActionTimeframe(config.ambientTimeframe);
      }
      
      // Exibe informações do modo de simulação
      this.logger.info(`🎯 Modo de Simulação: ${config.simulationMode}`);
      this.logger.info(`📊 Timeframe AMBIENT: ${config.ambientTimeframe}`);
      this.logger.info(`⚡ Timeframe ACTION: ${config.actionTimeframe}`);
      
      // Obtém dados históricos com suporte ao novo formato
      const historicalDataResult = await this.getHistoricalData(config);
      
      // REFATORADO: Passa informações sobre o formato dos dados para o engine
      this.engine = new BacktestEngine({
        ...config,
        strategyName: config.strategy,
        simulationMode: config.simulationMode,
        ambientTimeframe: config.ambientTimeframe,
        actionTimeframe: config.actionTimeframe,
        dataFormat: historicalDataResult.format // NOVO: Informa o formato dos dados
      });
      
      // Executa backtest passando os dados no formato correto
      const results = await this.engine.runBacktest(
        config.strategy,
        historicalDataResult.data, // Dados no formato detectado
        config.strategyConfig || {}
      );
      
      // Gera relatório
      const report = this.generateReport(results, config);
      
      // Salva resultados
      if (config.saveResults) {
        await this.saveResults(report, config);
      }
      
      // Exibe resultados
      this.displayResults(report);
      
      return report;
      
    } catch (error) {
      this.logger.error(`❌ Erro no Backtest Runner: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida configuração do backtest
   */
  validateConfig(config) {
    const required = ['strategy', 'symbols'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
    }
    
    // Valida estratégia
    const validStrategies = ['DEFAULT', 'PRO_MAX'];
    if (!validStrategies.includes(config.strategy)) {
      throw new Error(`Estratégia inválida: ${config.strategy}. Válidas: ${validStrategies.join(', ')}`);
    }
    
    // Valida símbolos
    if (!Array.isArray(config.symbols) || config.symbols.length === 0) {
      throw new Error('Lista de símbolos deve ser um array não vazio');
    }
    
    // Valida período - agora suporta períodos muito longos
    if (config.days && (config.days < 1 || config.days > 3650)) { // Até 10 anos
      throw new Error('Período deve estar entre 1 e 3650 dias (10 anos)');
    }
    
    // Valida saldo inicial
    if (config.initialBalance && config.initialBalance <= 0) {
      throw new Error('Saldo inicial deve ser maior que zero');
    }
    
    // Valida investimento por trade
    if (config.investmentPerTrade && config.investmentPerTrade <= 0) {
      throw new Error('Investimento por trade deve ser maior que zero');
    }
    
    // Aviso sobre dados sintéticos
    if (config.useSyntheticData) {
      this.logger.warn('⚠️ ATENÇÃO: Usando dados sintéticos - NÃO recomendado para análise real!');
      this.logger.warn('   Para análise real, use dados históricos da API.');
    }
  }

  /**
   * REFATORADO: Obtém dados históricos com suporte ao novo formato de dados duplos
   * @param {object} config - Configuração do backtest
   * @returns {object} - Dados históricos no formato apropriado
   */
  async getHistoricalData(config) {
    try {
      let historicalDataResult;
      
      // Valida símbolos
      if (!config.symbols || !Array.isArray(config.symbols) || config.symbols.length === 0) {
        throw new Error('Lista de símbolos deve ser um array não vazio');
      }
      
      // Obtém dados para cada símbolo
      const allData = {};
      
      for (const symbol of config.symbols) {
        this.logger.info(`📊 Obtendo dados para ${symbol}...`);
        
        try {
          const data = await this.dataProvider.getDualTimeframeData(
            symbol,
            config.ambientTimeframe || config.interval || '1h',
            config.actionTimeframe || '1m',
            config.days || 30
          );
          
          allData[symbol] = data;
          
          this.logger.info(`✅ ${symbol}: ${data.oneMinuteCandles.length} candles 1m + ${data.ambientCandles.length} candles ${config.ambientTimeframe}`);
          
        } catch (error) {
          this.logger.error(`❌ Erro ao obter dados para ${symbol}: ${error.message}`);
          throw error;
        }
      }
      
      // Retorna dados no formato esperado pelo engine
      historicalDataResult = {
        data: allData,
        format: 'dual_timeframe'
      };
      
      return historicalDataResult;
      
    } catch (error) {
      this.logger.error(`❌ Erro ao obter dados históricos: ${error.message}`);
      throw error;
    }
  }

  /**
   * NOVO: Detecta se os dados estão no formato HIGH_FIDELITY
   * @param {object} data - Dados retornados pelo DataProvider
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
   * Calcula timestamp de início baseado no número de dias
   */
  calculateStartTime(days) {
    return Date.now() - (days * 24 * 60 * 60 * 1000);
  }

  /**
   * Gera relatório detalhado
   */
  generateReport(results, config) {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        strategy: config.strategy,
        symbols: config.symbols,
        period: config.days,
        interval: config.ambientTimeframe || config.interval,
        simulationMode: config.simulationMode,
        ambientTimeframe: config.ambientTimeframe,
        actionTimeframe: config.actionTimeframe,
        initialBalance: config.initialBalance,
        finalBalance: results.balance || config.initialBalance,
        totalReturn: results.balance ? ((results.balance - config.initialBalance) / config.initialBalance) * 100 : 0,
        totalTrades: results.totalTrades || 0,
        winRate: results.winRate || 0,
        profitFactor: results.profitFactor || 0,
        maxDrawdown: (results.maxDrawdown || 0) * 100,
        sharpeRatio: results.sharpeRatio || 0,
        leverage: config.leverage || 1
      },
      performance: {
        totalTrades: results.totalTrades || 0,
        winningTrades: results.winningTrades || 0,
        losingTrades: results.losingTrades || 0,
        winRate: results.winRate || 0,
        averageWin: results.averageWin || 0,
        averageLoss: results.averageLoss || 0,
        profitFactor: results.profitFactor || 0,
        sharpeRatio: results.sharpeRatio || 0,
        maxDrawdown: (results.maxDrawdown || 0) * 100,
        maxConsecutiveLosses: results.maxConsecutiveLosses || 0
      },
      configuration: {
        ...config,
        simulationMode: config.simulationMode,
        ambientTimeframe: config.ambientTimeframe,
        actionTimeframe: config.actionTimeframe
      },
      trades: results.trades || []
    };
    
    return report;
  }

  /**
   * Calcula retorno anualizado
   */
  calculateAnnualizedReturn(results, days) {
    if (days <= 0 || results.totalReturn === undefined) return 0;
    
    const totalReturn = results.totalReturn / 100; // Converte para decimal
    const years = days / 365;
    
    return ((1 + totalReturn) ** (1 / years) - 1) * 100;
  }

  /**
   * Salva resultados em arquivo
   */
  async saveResults(report, config) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dataType = config.useSyntheticData ? 'synthetic' : 'real';
      const filename = `backtest_${config.strategy}_${dataType}_${timestamp}.json`;
      const filepath = path.join(process.cwd(), 'backtest_results', filename);
      
      // Cria diretório se não existir
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Salva relatório
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      this.logger.info(`💾 Resultados salvos em: ${filepath}`);
      
    } catch (error) {
      this.logger.error(`❌ Erro ao salvar resultados: ${error.message}`);
    }
  }

  /**
   * Exibe resultados no console
   */
  displayResults(report) {
    const { results, performance, metadata } = report;
    
    this.logger.info('\n' + '='.repeat(60));
    this.logger.info('📊 RESULTADOS DO BACKTEST');
    this.logger.info('='.repeat(60));
    
    // Informações básicas
    this.logger.info(`🎯 Estratégia: ${metadata.strategy}`);
    this.logger.info(`📅 Período: ${metadata.period.days} dias (${metadata.period.interval})`);
    this.logger.info(`📊 Dados: ${metadata.configuration.useSyntheticData ? 'SINTÉTICOS ⚠️' : 'REAIS ✅'}`);
    this.logger.info(`💰 Saldo Inicial: $${metadata.configuration.initialBalance.toFixed(2)}`);
    this.logger.info(`💰 Saldo Final: $${results.balance.toFixed(2)}`);
    this.logger.info(`📈 Retorno Total: ${results.totalReturn.toFixed(2)}%`);
    this.logger.info(`📈 Retorno Anualizado: ${results.annualizedReturn.toFixed(2)}%`);
    
    // Performance financeira
    this.logger.info('\n💰 PERFORMANCE FINANCEIRA');
    this.logger.info('-'.repeat(40));
    this.logger.info(`💰 Saldo inicial: $${(metadata.initialBalance || 0).toFixed(2)}`);
    this.logger.info(`💰 Saldo final: $${(results.balance || 0).toFixed(2)}`);
    this.logger.info(`📈 Retorno total: ${(results.totalReturn || 0).toFixed(2)}%`);
    this.logger.info(`⚡ Alavancagem: ${metadata.leverage || 1}x`);
    this.logger.info(`📊 Retorno ajustado: ${((results.totalReturn || 0) * (metadata.leverage || 1)).toFixed(2)}%`);
    
    // Estatísticas de trading
    this.logger.info('\n📊 ESTATÍSTICAS DE TRADING');
    this.logger.info('-'.repeat(40));
    this.logger.info(`📊 Total de trades: ${performance.totalTrades || 0}`);
    this.logger.info(`✅ Trades vencedores: ${performance.winningTrades || 0}`);
    this.logger.info(`❌ Trades perdedores: ${performance.losingTrades || 0}`);
    this.logger.info(`🎯 Win rate: ${(performance.winRate || 0).toFixed(2)}%`);
    this.logger.info(`📊 Profit factor: ${(performance.profitFactor || 0).toFixed(2)}`);
    this.logger.info(`📈 Média de ganho: $${(performance.averageWin || 0).toFixed(2)}`);
    this.logger.info(`📉 Média de perda: $${(performance.averageLoss || 0).toFixed(2)}`);
    
    // Métricas de risco
    this.logger.info('\n🛡️ MÉTRICAS DE RISCO');
    this.logger.info('-'.repeat(40));
    this.logger.info(`📉 Máximo drawdown: ${(performance.maxDrawdown || 0).toFixed(2)}%`);
    this.logger.info(`📈 Sharpe ratio: ${(performance.sharpeRatio || 0).toFixed(2)}`);
    this.logger.info(`🔴 Máximo de perdas consecutivas: ${performance.maxConsecutiveLosses || 0}`);
    
    // Avaliação geral
    this.logger.info('\n🎯 AVALIAÇÃO GERAL');
    this.logger.info('-'.repeat(40));
    
    const profitFactor = performance.profitFactor || 0;
    const maxDrawdown = performance.maxDrawdown || 0;
    const winRate = performance.winRate || 0;
    
    if (profitFactor > 2) {
      this.logger.info('🟢 EXCELENTE: Profit factor > 2.0');
    } else if (profitFactor > 1.5) {
      this.logger.info('🟡 BOM: Profit factor > 1.5');
    } else if (profitFactor > 1.2) {
      this.logger.info('🟠 REGULAR: Profit factor > 1.2');
    } else {
      this.logger.info('🔴 RUIM: Profit factor <= 1.2');
    }
    
    if (maxDrawdown < 10) {
      this.logger.info('🟢 BAIXO RISCO: Drawdown < 10%');
    } else if (maxDrawdown < 20) {
      this.logger.info('🟡 RISCO MODERADO: Drawdown < 20%');
    } else {
      this.logger.info('🔴 ALTO RISCO: Drawdown >= 20%');
    }
    
    if (winRate > 60) {
      this.logger.info('🟢 ALTA PRECISÃO: Win rate > 60%');
    } else if (winRate > 50) {
      this.logger.info('🟡 PRECISÃO MÉDIA: Win rate > 50%');
    } else {
      this.logger.info('🔴 BAIXA PRECISÃO: Win rate <= 50%');
    }
  }

  /**
   * Executa backtest comparativo entre estratégias
   */
  async runComparativeBacktest(configs) {
    try {
      this.logger.info('🔄 Iniciando Backtest Comparativo...');
      
      const results = {};
      
      for (const config of configs) {
        this.logger.info(`\n📊 Testando estratégia: ${config.strategy}`);
        const result = await this.runBacktest(config);
        results[config.strategy] = result;
      }
      
      // Compara resultados
      this.displayComparativeResults(results);
      
      return results;
      
    } catch (error) {
      this.logger.error(`❌ Erro no backtest comparativo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Exibe resultados comparativos
   */
  displayComparativeResults(results) {
    this.logger.info('\n' + '='.repeat(80));
    this.logger.info('📊 COMPARAÇÃO DE ESTRATÉGIAS');
    this.logger.info('='.repeat(80));
    
    const strategies = Object.keys(results);
    
    // Cabeçalho
    this.logger.info('Estratégia'.padEnd(15) + 
                    'Retorno%'.padEnd(12) + 
                    'Win Rate%'.padEnd(12) + 
                    'Trades'.padEnd(8) + 
                    'Profit Factor'.padEnd(15) + 
                    'Max DD%'.padEnd(10) + 
                    'Sharpe');
    
    this.logger.info('-'.repeat(80));
    
    // Dados
    for (const strategy of strategies) {
      const result = results[strategy];
      const { results: res, performance } = result;
      
      this.logger.info(
        strategy.padEnd(15) +
        res.totalReturn.toFixed(2).padEnd(12) +
        performance.winRate.toFixed(2).padEnd(12) +
        performance.totalTrades.toString().padEnd(8) +
        res.profitFactor.toFixed(2).padEnd(15) +
        res.maxDrawdown.toFixed(2).padEnd(10) +
        res.sharpeRatio.toFixed(2)
      );
    }
    
    this.logger.info('='.repeat(80));
  }

  /**
   * Obtém símbolos mais líquidos para backtest
   */
  async getTopLiquidSymbols(limit = 20) {
    return await this.dataProvider.getTopLiquidSymbols(limit);
  }

  /**
   * Obtém todos os símbolos disponíveis
   */
  async getAvailableSymbols() {
    return await this.dataProvider.getAvailableSymbols();
  }
} 