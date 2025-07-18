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
   * Executa backtest completo
   * @param {object} config - Configuração do backtest
   * @returns {object} - Resultados do backtest
   */
  async runBacktest(config) {
    try {
      this.logger.info('🚀 Iniciando Backtest Runner...');
      
      // Valida configuração
      this.validateConfig(config);
      
      // Obtém dados históricos
      const historicalData = await this.getHistoricalData(config);
      
      // Inicializa engine
      this.engine = new BacktestEngine({
        ...config,
        strategyName: config.strategy
      });
      
      // Executa backtest
      const results = await this.engine.runBacktest(
        config.strategy,
        historicalData,
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
   * Obtém dados históricos baseado na configuração
   */
  async getHistoricalData(config) {
    try {
      let historicalData;
      
      if (config.useSyntheticData) {
        // Usa dados sintéticos apenas se explicitamente solicitado
        this.logger.warn('🔧 Usando dados sintéticos (NÃO recomendado para análise real)...');
        historicalData = this.dataProvider.generateSyntheticData(
          config.symbols,
          config.days || 30,
          config.interval || '1h'
        );
      } else {
        // SEMPRE tenta obter dados reais primeiro
        this.logger.info('📊 Obtendo dados históricos REAIS da API...');
        
        const startTime = config.startTime || this.calculateStartTime(config.days || 30);
        const endTime = config.endTime || Date.now();
        
        try {
          historicalData = await this.dataProvider.getHistoricalData(
            config.symbols,
            config.interval || '1h',
            config.days || 30,
            startTime,
            endTime
          );
          
          this.logger.info('✅ Dados reais obtidos com sucesso!');
          
        } catch (apiError) {
          this.logger.error(`❌ Erro ao obter dados da API: ${apiError.message}`);
          
          // Pergunta se deve usar dados sintéticos como fallback
          if (config.allowSyntheticFallback !== false) {
            this.logger.warn('🔄 Tentando usar dados sintéticos como fallback...');
            historicalData = this.dataProvider.generateSyntheticData(
              config.symbols,
              config.days || 30,
              config.interval || '1h'
            );
            this.logger.warn('⚠️ Usando dados sintéticos - resultados podem não ser realistas!');
          } else {
            throw new Error('Falha ao obter dados da API e fallback sintético desabilitado');
          }
        }
      }
      
      // Valida dados
      if (!this.dataProvider.validateData(historicalData, config.interval || '1h')) {
        this.logger.warn('⚠️ Problemas encontrados nos dados, mas continuando...');
      }
      
      // Filtra símbolos sem dados
      const validSymbols = Object.keys(historicalData).filter(
        symbol => historicalData[symbol] && historicalData[symbol].length > 0
      );
      
      if (validSymbols.length === 0) {
        throw new Error('Nenhum símbolo com dados válidos encontrado');
      }
      
      this.logger.info(`✅ Dados obtidos para ${validSymbols.length} símbolos`);
      
      // Informações sobre o período
      const totalCandles = validSymbols.reduce((sum, symbol) => sum + historicalData[symbol].length, 0);
      this.logger.info(`📊 Total de candles: ${totalCandles.toLocaleString()}`);
      
      return historicalData;
      
    } catch (error) {
      this.logger.error(`❌ Erro ao obter dados históricos: ${error.message}`);
      throw error;
    }
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
        period: {
          days: config.days || 30,
          interval: config.interval || '1h',
          startTime: config.startTime,
          endTime: config.endTime
        },
        configuration: {
          initialBalance: config.initialBalance || 1000,
          investmentPerTrade: config.investmentPerTrade || 100,
          fee: config.fee || 0.0004,
          maxConcurrentTrades: config.maxConcurrentTrades || 5,
          enableStopLoss: config.enableStopLoss !== false,
          enableTakeProfit: config.enableTakeProfit !== false,
          slippage: config.slippage || 0.0001,
          useSyntheticData: config.useSyntheticData || false
        }
      },
      results: {
        ...results,
        totalReturn: ((results.balance - results.initialBalance) / results.initialBalance) * 100,
        annualizedReturn: this.calculateAnnualizedReturn(results, config.days || 30),
        sharpeRatio: results.sharpeRatio || 0,
        maxDrawdown: (results.maxDrawdown || 0) * 100,
        profitFactor: results.profitFactor || 0
      },
      performance: {
        winRate: results.winRate || 0,
        averageWin: results.averageWin || 0,
        averageLoss: results.averageLoss || 0,
        totalTrades: results.totalTrades || 0,
        winningTrades: results.winningTrades || 0,
        losingTrades: results.losingTrades || 0,
        maxConsecutiveLosses: results.maxConsecutiveLosses || 0
      }
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
    
    // Performance
    this.logger.info('\n📊 PERFORMANCE:');
    this.logger.info(`🎯 Win Rate: ${performance.winRate.toFixed(2)}%`);
    this.logger.info(`📈 Total de Trades: ${performance.totalTrades}`);
    this.logger.info(`✅ Trades Vencedores: ${performance.winningTrades}`);
    this.logger.info(`❌ Trades Perdedores: ${performance.losingTrades}`);
    this.logger.info(`💰 Média de Ganho: $${performance.averageWin.toFixed(2)}`);
    this.logger.info(`💸 Média de Perda: $${performance.averageLoss.toFixed(2)}`);
    this.logger.info(`📊 Profit Factor: ${results.profitFactor.toFixed(2)}`);
    
    // Risco
    this.logger.info('\n⚠️ RISCO:');
    this.logger.info(`📉 Máximo Drawdown: ${results.maxDrawdown.toFixed(2)}%`);
    this.logger.info(`📊 Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
    this.logger.info(`🔴 Máximo de Perdas Consecutivas: ${performance.maxConsecutiveLosses}`);
    
    // Configuração
    this.logger.info('\n⚙️ CONFIGURAÇÃO:');
    this.logger.info(`💵 Investimento por Trade: $${metadata.configuration.investmentPerTrade}`);
    this.logger.info(`💸 Taxa: ${(metadata.configuration.fee * 100).toFixed(4)}%`);
    this.logger.info(`🔒 Stop Loss: ${metadata.configuration.enableStopLoss ? 'Ativado' : 'Desativado'}`);
    this.logger.info(`🎯 Take Profit: ${metadata.configuration.enableTakeProfit ? 'Ativado' : 'Desativado'}`);
    this.logger.info(`📊 Slippage: ${(metadata.configuration.slippage * 100).toFixed(4)}%`);
    
    // Aviso sobre dados sintéticos
    if (metadata.configuration.useSyntheticData) {
      this.logger.warn('\n⚠️ ATENÇÃO: Este backtest usou dados sintéticos!');
      this.logger.warn('   Os resultados podem não refletir o comportamento real do mercado.');
      this.logger.warn('   Para análise real, execute com dados históricos da API.');
    }
    
    this.logger.info('\n' + '='.repeat(60));
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