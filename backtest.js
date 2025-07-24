#!/usr/bin/env node

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';
import { DataProvider } from './src/Backtest/DataProvider.js';
import ColorLogger from './src/Utils/ColorLogger.js';
import inquirer from 'inquirer';

const logger = new ColorLogger('BACKTEST', 'CLI');

/**
 * Calcula o timeframe ACTION baseado no AMBIENT
 * @param {string} ambientTimeframe - Timeframe AMBIENT
 * @returns {string} - Timeframe ACTION
 */
function getActionTimeframe(ambientTimeframe) {
  const timeframePairs = {
    // Hold de Longo TF
    '1w': '1d',    // Hold de Longo TF - 1 Semana → 1 Dia
    '3d': '12h',   // Hold de Longo TF - 3 Dias → 12 Horas
    '1d': '4h',    // Hold de Longo TF - 1 Dia → 4 Horas
    
    // Hold de Médio TF
    '12h': '2h',   // Hold de Médio TF - 12 Horas → 2 Horas
    '8h': '1h',    // Hold de Médio TF - 8 Horas → 1 Hora
    '6h': '30m',   // Hold de Médio TF - 6 Horas → 30 Minutos
    '4h': '20m',   // Hold de Médio TF - 4 Horas → 20 Minutos
    
    // Swing Trade TF
    '6h': '30m',   // Swing Trade - 6 Horas → 30 Minutos
    '4h': '20m',   // Swing Trade - 4 Horas → 20 Minutos
    
    // Day Trade
    '2h': '10m',   // Day Trade - 2 Horas → 10 Minutos
    '1h': '5m',    // Day Trade - 1 Hora → 5 Minutos
    
    // Day Trade Volátil
    '1h': '5m',    // Day Trade Volátil - 1 Hora → 5 Minutos
    
    // Scalp Trade
    '30m': '3m',   // Scalp Trade - 30 Minutos → 3 Minutos
    
    // Super Scalp Trade
    '15m': '1m',   // Super Scalp Trade - 15 Minutos → 1 Minuto
    
    // Fallbacks para timeframes antigos
    '5m': '1m',    // Micro Scalp
    '1m': '1m'     // Nano Scalp
  };
  
  return timeframePairs[ambientTimeframe] || '5m'; // Fallback para 5m
}

/**
 * Obtém o tipo de trading baseado no timeframe AMBIENT
 * @param {string} ambientTimeframe - Timeframe AMBIENT
 * @returns {string} - Tipo de trading
 */
function getTradingType(ambientTimeframe) {
  const tradingTypes = {
    // Hold de Longo TF
    '1w': 'Hold de Longo TF',
    '3d': 'Hold de Longo TF',
    '1d': 'Hold de Longo TF',
    
    // Hold de Médio TF
    '12h': 'Hold de Médio TF',
    '8h': 'Hold de Médio TF',
    '6h': 'Hold de Médio TF',
    '4h': 'Hold de Médio TF',
    
    // Swing Trade TF
    '6h': 'Swing Trade TF',
    '4h': 'Swing Trade TF',
    
    // Day Trade
    '2h': 'Day Trade',
    '1h': 'Day Trade',
    
    // Day Trade Volátil
    '1h': 'Day Trade Volátil',
    
    // Scalp Trade
    '30m': 'Scalp Trade',
    
    // Super Scalp Trade
    '15m': 'Super Scalp Trade (EXPERIENTES)',
    
    // Fallbacks
    '5m': 'Micro Scalp',
    '1m': 'Nano Scalp'
  };
  
  return tradingTypes[ambientTimeframe] || 'Trading';
}

/**
 * Menu principal do backtest
 */
async function showMainMenu() {
  console.clear();
  logger.info('🚀 BACKBOT BACKTEST SYSTEM - DADOS REAIS');
  logger.info('='.repeat(50));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Escolha uma opção:',
      choices: [
        { name: '📊 Executar Backtest com Dados Reais', value: 'real' },
        { name: '🔄 Executar Backtest Comparativo', value: 'comparative' },
        { name: '📋 Ver Símbolos Mais Líquidos', value: 'liquid' },
        { name: '📋 Ver Todos os Símbolos', value: 'symbols' },
        { name: '⚙️ Configurações Avançadas', value: 'advanced' },
        { name: '🔧 Teste Rápido (Dados Sintéticos)', value: 'synthetic' },
        { name: '❌ Sair', value: 'exit' }
      ]
    }
  ]);
  
  return action;
}

/**
 * Executa backtest com dados reais
 */
async function runRealBacktest() {
  logger.info('\n📊 CONFIGURAÇÃO DO BACKTEST COM DADOS REAIS');
  logger.info('-'.repeat(40));
  
  // Primeiro, perguntar a estratégia para determinar se precisa do investimento por trade
  const strategyChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'strategy',
      message: 'Escolha a estratégia:',
      choices: [
        { name: 'DEFAULT - Farm de Volume', value: 'DEFAULT' },
        { name: 'PRO_MAX - Estratégia Avançada', value: 'PRO_MAX' },
        { name: 'CYPHERPUNK - Sistema AMBIENT + ACTION', value: 'CYPHERPUNK' }
      ]
    }
  ]);

  // Configurações base
  const baseConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'symbols',
      message: 'Símbolos para testar (separados por vírgula):',
      default: 'BTC_USDC_PERP,ETH_USDC_PERP,SOL_USDC_PERP',
      filter: (input) => input.split(',').map(s => s.trim())
    },
    {
      type: 'number',
      name: 'days',
      message: 'Período em dias (recomendado: 90-365):',
      default: 90,
      validate: (value) => {
        if (value < 1 || value > 3650) {
          return 'Período deve estar entre 1 e 3650 dias (10 anos)';
        }
        if (value < 30) {
          return 'Recomendado pelo menos 30 dias para análise confiável';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'interval',
      message: 'Intervalo dos candles (AMBIENT):',
      choices: [
        // Hold de Longo TF
        new inquirer.Separator('📈 HOLD DE LONGO TF'),
        { name: '3 Dias (Recomendado)', value: '3d' },
        { name: '1 Dia', value: '1d' },
        { name: '1 Semana', value: '1w' },
        
        // Hold de Médio TF
        new inquirer.Separator('📊 HOLD DE MÉDIO TF'),
        { name: '8 Horas (Recomendado)', value: '8h' },
        { name: '12 Horas (Recomendado)', value: '12h' },
        { name: '4 Horas', value: '4h' },
        
        // Swing Trade TF
        new inquirer.Separator('🔄 SWING TRADE TF'),
        { name: '4 Horas (Recomendado)', value: '4h' },
        { name: '6 Horas', value: '6h' },
        
        // Day Trade
        new inquirer.Separator('📅 DAY TRADE'),
        { name: '2 Horas (Recomendado)', value: '2h' },
        { name: '1 Hora', value: '1h' },
        
        // Day Trade Volátil
        new inquirer.Separator('⚡ DAY TRADE VOLÁTIL'),
        { name: '1 Hora (Recomendado)', value: '1h' },
        
        // Scalp Trade
        new inquirer.Separator('🎯 SCALP TRADE'),
        { name: '30 Minutos (Recomendado)', value: '30m' },
        
        // Super Scalp Trade
        new inquirer.Separator('🚨 SUPER SCALP TRADE (EXPERIENTES)'),
        { name: '15 Minutos (MUITO CUIDADO)', value: '15m' }
      ],
      default: '4h'
    },
    {
      type: 'number',
      name: 'initialBalance',
      message: 'Saldo inicial (USD):',
      default: 1000,
      validate: (value) => value > 0 ? true : 'Saldo deve ser maior que zero'
    },
    {
      type: 'list',
      name: 'leverage',
      message: 'Alavancagem:',
      choices: [
        { name: '1x - Sem alavancagem (Spot)', value: 1 },
        { name: '2x - Baixa alavancagem', value: 2 },
        { name: '5x - Alavancagem moderada', value: 5 },
        { name: '10x - Alavancagem alta', value: 10 },
        { name: '20x - Alavancagem muito alta', value: 20 },
        { name: '50x - Alavancagem extrema (CUIDADO)', value: 50 },
        { name: '100x - Alavancagem máxima (MUITO RISCO)', value: 100 }
      ],
      default: 1
    }
  ]);

  // Perguntar investimento por trade apenas para estratégias que não gerenciam isso internamente
  let investmentPerTrade = null;
  let capitalPercentage = null;
  if (strategyChoice.strategy !== 'CYPHERPUNK') {
    const investmentConfig = await inquirer.prompt([
      {
        type: 'list',
        name: 'investmentType',
        message: 'Tipo de investimento por trade:',
        choices: [
          { name: '💰 Valor fixo em USD', value: 'fixed' },
          { name: '📊 Porcentagem do capital disponível', value: 'percentage' }
        ],
        default: 'fixed'
      }
    ]);

    if (investmentConfig.investmentType === 'fixed') {
      const fixedConfig = await inquirer.prompt([
        {
          type: 'number',
          name: 'investmentPerTrade',
          message: 'Investimento por trade (USD):',
        default: 100,
        validate: (value) => value > 0 ? true : 'Investimento deve ser maior que zero'
      }
    ]);
    investmentPerTrade = fixedConfig.investmentPerTrade;
  } else {
    const percentageConfig = await inquirer.prompt([
      {
        type: 'number',
        name: 'capitalPercentage',
        message: 'Porcentagem do capital por trade (%):',
        default: 10,
        validate: (value) => {
          if (value <= 0 || value > 100) {
            return 'Porcentagem deve estar entre 0.1% e 100%';
          }
          return true;
        }
      }
    ]);
    capitalPercentage = percentageConfig.capitalPercentage;
  }
} else {
  // Para CypherPunk, usar 10% do saldo inicial como padrão (será gerenciado pela estratégia)
  investmentPerTrade = Math.round(baseConfig.initialBalance * 0.1);
  logger.info(`💰 CypherPunk: Usando ${investmentPerTrade} USD por trade (10% do saldo - gerenciado pela estratégia)`);
}

  // Configuração final
  const config = {
    ...strategyChoice,
    ...baseConfig,
    investmentPerTrade,
    capitalPercentage
  };

  // Configurações adicionais
  const additionalConfig = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveResults',
      message: 'Salvar resultados em arquivo?',
      default: true
    }
  ]);

  Object.assign(config, additionalConfig);
  
  // Configurações adicionais para dados reais
  config.useSyntheticData = false; // SEMPRE dados reais
  config.allowSyntheticFallback = false; // Não permite fallback sintético
  config.fee = 0.0004; // 0.04%
  config.slippage = 0.0001; // 0.01%
  config.maxConcurrentTrades = 5;
  config.enableStopLoss = true;
  config.enableTakeProfit = true;
  config.leverage = baseConfig.leverage; // Alavancagem selecionada
  config.minProfitPercentage = 0; // Profit mínimo: 0% = apenas vs taxas (como o bot real)
  
  // Configurações específicas da estratégia
  if (config.strategy === 'PRO_MAX') {
    config.strategyConfig = {
      adxLength: 14,
      adxThreshold: 20,
      adxAverageLength: 21,
      useRsiValidation: 'true',
      useStochValidation: 'true',
      useMacdValidation: 'true',
      ignoreBronzeSignals: 'false'
    };
  } else if (config.strategy === 'CYPHERPUNK') {
    config.strategyConfig = {
      // Trade System CypherPunk
      targets: 3, // 3 pontos de entrada
      stopLossPercentage: 2, // 2% stop loss
      takeProfitPercentage: 10, // 10% take profit
      // Sistema AMBIENT + ACTION
      ambientTimeframe: config.interval, // Usa o timeframe selecionado como AMBIENT
      actionTimeframe: getActionTimeframe(config.interval), // Calcula ACTION automaticamente
      // Configurações dos indicadores
      vwapThreshold: 0.5, // Sensibilidade VWAP
      momentumThreshold: 0.3, // Sensibilidade MOMENTUM
      moneyFlowThreshold: 0.7, // Sensibilidade MONEY FLOW (mais importante)
      // Filtros
      enableDivergence: true,
      enableExhaustionLines: true,
      minDays: 10 // Mínimo de dias para análise
    };
  }
  
  try {
    logger.info('\n🚀 Iniciando backtest com dados REAIS...');
    logger.info(`📅 Período: ${config.days} dias`);
    logger.info(`📊 Símbolos: ${config.symbols.join(', ')}`);
    logger.info(`⏱️ Intervalo: ${config.interval}`);
    logger.info(`⚡ Alavancagem: ${config.leverage}x`);
    logger.info(`💰 Capital efetivo: $${(config.initialBalance * config.leverage).toFixed(2)}`);
    
    // Log da configuração de volume
    if (config.capitalPercentage > 0) {
      logger.info(`📈 Volume por operação: ${config.capitalPercentage}% do capital disponível`);
    } else {
      logger.info(`📈 Volume por operação: $${config.investmentPerTrade.toFixed(2)} (valor fixo)`);
    }
    
    // Log da configuração de profit mínimo
    if (config.minProfitPercentage > 0) {
      logger.info(`🎯 Profit mínimo: ${config.minProfitPercentage}%`);
    } else {
      logger.info(`🎯 Profit mínimo: Apenas vs taxas (lucro líquido > 0)`);
    }
    
    // Informações específicas do CypherPunk
    if (config.strategy === 'CYPHERPUNK') {
      const tradingType = getTradingType(config.interval);
      logger.info(`🎯 Estratégia: CYPHERPUNK - Sistema AMBIENT + ACTION`);
      logger.info(`📈 Tipo: ${tradingType}`);
      logger.info(`🌍 AMBIENT: ${config.interval} (Visão MACRO)`);
      logger.info(`⚡ ACTION: ${config.strategyConfig.actionTimeframe} (Pontos de Entrada)`);
      logger.info(`📊 Trade System: 3 entradas, 10% lucro, 2% stop loss`);
      logger.info(`🔍 Análise: VWAP → MOMENTUM → MONEY FLOW (ordem obrigatória)`);
      
      // Avisos específicos para timeframes de alto risco
      if (config.interval === '15m') {
        logger.warn('🚨 ATENÇÃO: Super Scalp Trade - APENAS para traders EXPERIENTES!');
        logger.warn('   Alto risco - Requer conhecimento profundo do CypherPunk');
      } else if (config.interval === '30m') {
        logger.info('🎯 Scalp Trade - Requer atenção constante');
      } else if (config.interval === '1h') {
        logger.info('⚡ Day Trade Volátil - Mercados em movimento');
      }
    }
    
    const runner = new BacktestRunner();
    await runner.runBacktest(config);
    
    const { continueTest } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueTest',
        message: '\nDeseja executar outro backtest?',
        default: false
      }
    ]);
    
    if (continueTest) {
      await runRealBacktest();
    }
    
  } catch (error) {
    logger.error(`❌ Erro no backtest: ${error.message}`);
    
    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Deseja tentar novamente?',
        default: false
      }
    ]);
    
    if (retry) {
      await runRealBacktest();
    }
  }
}

/**
 * Executa backtest comparativo
 */
async function runComparativeBacktest() {
  logger.info('\n🔄 CONFIGURAÇÃO DO BACKTEST COMPARATIVO');
  logger.info('-'.repeat(40));
  
  const baseConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'symbols',
      message: 'Símbolos para testar (separados por vírgula):',
      default: 'BTC_USDC_PERP,ETH_USDC_PERP,SOL_USDC_PERP',
      filter: (input) => input.split(',').map(s => s.trim())
    },
    {
      type: 'number',
      name: 'days',
      message: 'Período em dias (recomendado: 90-365):',
      default: 90,
      validate: (value) => {
        if (value < 1 || value > 3650) {
          return 'Período deve estar entre 1 e 3650 dias (10 anos)';
        }
        if (value < 30) {
          return 'Recomendado pelo menos 30 dias para análise confiável';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'interval',
      message: 'Intervalo dos candles (AMBIENT):',
      choices: [
        // Hold de Longo TF
        new inquirer.Separator('📈 HOLD DE LONGO TF'),
        { name: '3 Dias (Recomendado)', value: '3d' },
        { name: '1 Dia', value: '1d' },
        { name: '1 Semana', value: '1w' },
        
        // Hold de Médio TF
        new inquirer.Separator('📊 HOLD DE MÉDIO TF'),
        { name: '8 Horas (Recomendado)', value: '8h' },
        { name: '12 Horas (Recomendado)', value: '12h' },
        { name: '4 Horas', value: '4h' },
        
        // Swing Trade TF
        new inquirer.Separator('🔄 SWING TRADE TF'),
        { name: '4 Horas (Recomendado)', value: '4h' },
        { name: '6 Horas', value: '6h' },
        
        // Day Trade
        new inquirer.Separator('📅 DAY TRADE'),
        { name: '2 Horas (Recomendado)', value: '2h' },
        { name: '1 Hora', value: '1h' },
        
        // Day Trade Volátil
        new inquirer.Separator('⚡ DAY TRADE VOLÁTIL'),
        { name: '1 Hora (Recomendado)', value: '1h' },
        
        // Scalp Trade
        new inquirer.Separator('🎯 SCALP TRADE'),
        { name: '30 Minutos (Recomendado)', value: '30m' },
        
        // Super Scalp Trade
        new inquirer.Separator('🚨 SUPER SCALP TRADE (EXPERIENTES)'),
        { name: '15 Minutos (MUITO CUIDADO)', value: '15m' }
      ],
      default: '4h'
    },
    {
      type: 'number',
      name: 'initialBalance',
      message: 'Saldo inicial (USD):',
      default: 1000,
      validate: (value) => value > 0 ? true : 'Saldo deve ser maior que zero'
    }
  ]);
  
  // Configurações base
  baseConfig.useSyntheticData = false; // SEMPRE dados reais
  baseConfig.allowSyntheticFallback = false;
  baseConfig.fee = 0.0004;
  baseConfig.slippage = 0.0001;
  baseConfig.maxConcurrentTrades = 5;
  baseConfig.enableStopLoss = true;
  baseConfig.enableTakeProfit = true;
  baseConfig.saveResults = true;
  
  // Configurações para cada estratégia
  const configs = [
    {
      ...baseConfig,
      strategy: 'DEFAULT',
      investmentPerTrade: Math.round(baseConfig.initialBalance * 0.1), // 10% do saldo
      strategyConfig: {}
    },
    {
      ...baseConfig,
      strategy: 'PRO_MAX',
      investmentPerTrade: Math.round(baseConfig.initialBalance * 0.1), // 10% do saldo
      strategyConfig: {
        adxLength: 14,
        adxThreshold: 20,
        adxAverageLength: 21,
        useRsiValidation: 'true',
        useStochValidation: 'true',
        useMacdValidation: 'true',
        ignoreBronzeSignals: 'false'
      }
    },
    {
      ...baseConfig,
      strategy: 'CYPHERPUNK',
      investmentPerTrade: Math.round(baseConfig.initialBalance * 0.1), // 10% do saldo (gerenciado pela estratégia)
      strategyConfig: {
        // Trade System CypherPunk
        targets: 3, // 3 pontos de entrada
        stopLossPercentage: 2, // 2% stop loss
        takeProfitPercentage: 10, // 10% take profit
        // Sistema AMBIENT + ACTION
        ambientTimeframe: baseConfig.interval, // Usa o timeframe selecionado como AMBIENT
        actionTimeframe: getActionTimeframe(baseConfig.interval), // Calcula ACTION automaticamente
        // Configurações dos indicadores
        vwapThreshold: 0.5, // Sensibilidade VWAP
        momentumThreshold: 0.3, // Sensibilidade MOMENTUM
        moneyFlowThreshold: 0.7, // Sensibilidade MONEY FLOW (mais importante)
        // Filtros
        enableDivergence: true,
        enableExhaustionLines: true,
        minDays: 10 // Mínimo de dias para análise
      }
    }
  ];
  
  try {
    logger.info('\n🚀 Iniciando backtest comparativo com dados REAIS...');
    logger.info(`📅 Período: ${baseConfig.days} dias`);
    logger.info(`📊 Símbolos: ${baseConfig.symbols.join(', ')}`);
    logger.info(`⏱️ Intervalo: ${baseConfig.interval}`);
    logger.info(`💰 Saldo inicial: $${baseConfig.initialBalance}`);
    logger.info(`📈 Estratégias: DEFAULT, PRO_MAX, CYPHERPUNK`);
    logger.info(`💡 Investimento por trade: 10% do saldo (${Math.round(baseConfig.initialBalance * 0.1)} USD)`);
    
    const runner = new BacktestRunner();
    await runner.runComparativeBacktest(configs);
    
    const { continueComp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueComp',
        message: '\nDeseja executar outro backtest comparativo?',
        default: false
      }
    ]);
    
    if (continueComp) {
      await runComparativeBacktest();
    }
    
  } catch (error) {
    logger.error(`❌ Erro no backtest comparativo: ${error.message}`);
    
    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Deseja tentar novamente?',
        default: false
      }
    ]);
    
    if (retry) {
      await runComparativeBacktest();
    }
  }
}

/**
 * Mostra símbolos mais líquidos
 */
async function showLiquidSymbols() {
  try {
    logger.info('\n📊 OBTENDO SÍMBOLOS MAIS LÍQUIDOS...');
    
    const runner = new BacktestRunner();
    const symbols = await runner.getTopLiquidSymbols(20);
    
    if (symbols.length === 0) {
      logger.warn('⚠️ Nenhum símbolo líquido encontrado');
      return;
    }
    
    logger.info(`✅ Top ${symbols.length} símbolos mais líquidos:`);
    
    // Agrupa por categoria
    const categories = {
      'BTC Pairs': symbols.filter(s => s.includes('BTC')),
      'ETH Pairs': symbols.filter(s => s.includes('ETH') && !s.includes('BTC')),
      'USDC Pairs': symbols.filter(s => s.includes('USDC') && !s.includes('BTC') && !s.includes('ETH')),
      'Others': symbols.filter(s => !s.includes('BTC') && !s.includes('ETH') && !s.includes('USDC'))
    };
    
    for (const [category, categorySymbols] of Object.entries(categories)) {
      if (categorySymbols.length > 0) {
        logger.info(`\n${category}:`);
        categorySymbols.forEach((symbol, index) => {
          const globalIndex = symbols.indexOf(symbol) + 1;
          logger.info(`  ${globalIndex}. ${symbol}`);
        });
      }
    }
    
    const { useSymbols } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useSymbols',
        message: '\nDeseja usar estes símbolos em um backtest?',
        default: false
      }
    ]);
    
    if (useSymbols) {
      const topSymbols = symbols.slice(0, 5); // Top 5 mais líquidos
      logger.info(`\n🎯 Usando top 5 símbolos: ${topSymbols.join(', ')}`);
      
      // Perguntar estratégia para determinar investimento por trade
      const strategyChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'strategy',
          message: 'Escolha a estratégia para o teste:',
          choices: [
            { name: 'DEFAULT - Farm de Volume', value: 'DEFAULT' },
            { name: 'PRO_MAX - Estratégia Avançada', value: 'PRO_MAX' },
            { name: 'CYPHERPUNK - Sistema AMBIENT + ACTION', value: 'CYPHERPUNK' }
          ]
        }
      ]);

      // Configuração base
      const baseConfig = {
        strategy: strategyChoice.strategy,
        symbols: topSymbols,
        days: 90,
        interval: '1h',
        initialBalance: 1000,
        useSyntheticData: false,
        allowSyntheticFallback: false,
        saveResults: true
      };

      // Determinar investimento por trade
      let investmentPerTrade;
      if (strategyChoice.strategy === 'CYPHERPUNK') {
        investmentPerTrade = Math.round(baseConfig.initialBalance * 0.1);
        logger.info(`💰 CypherPunk: Usando ${investmentPerTrade} USD por trade (10% do saldo - gerenciado pela estratégia)`);
      } else {
        investmentPerTrade = 100; // Valor padrão para outras estratégias
      }

      // Configuração final
      const config = {
        ...baseConfig,
        investmentPerTrade
      };
      
      const runner = new BacktestRunner();
      await runner.runBacktest(config);
    }
    
  } catch (error) {
    logger.error(`❌ Erro ao obter símbolos líquidos: ${error.message}`);
  }
}

/**
 * Mostra todos os símbolos disponíveis
 */
async function showAllSymbols() {
  try {
    logger.info('\n📋 OBTENDO TODOS OS SÍMBOLOS DISPONÍVEIS...');
    
    const runner = new BacktestRunner();
    const symbols = await runner.getAvailableSymbols();
    
    if (symbols.length === 0) {
      logger.warn('⚠️ Nenhum símbolo encontrado');
      return;
    }
    
    logger.info(`✅ ${symbols.length} símbolos disponíveis:`);
    
    // Mostra apenas os primeiros 50 para não poluir o console
    const displaySymbols = symbols.slice(0, 50);
    displaySymbols.forEach((symbol, index) => {
      logger.info(`  ${index + 1}. ${symbol}`);
    });
    
    if (symbols.length > 50) {
      logger.info(`  ... e mais ${symbols.length - 50} símbolos`);
    }
    
    const { back } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'back',
        message: '\nPressione Enter para voltar ao menu principal',
        default: true
      }
    ]);
    
  } catch (error) {
    logger.error(`❌ Erro ao obter símbolos: ${error.message}`);
  }
}

/**
 * Teste rápido com dados sintéticos
 */
async function runSyntheticTest() {
  logger.warn('\n⚠️ TESTE RÁPIDO COM DADOS SINTÉTICOS');
  logger.warn('⚠️ ATENÇÃO: Resultados NÃO são realistas!');
  logger.warn('-'.repeat(40));
  
  const config = await inquirer.prompt([
    {
      type: 'list',
      name: 'strategy',
      message: 'Escolha a estratégia:',
      choices: [
        { name: 'DEFAULT - Farm de Volume', value: 'DEFAULT' },
        { name: 'PRO_MAX - Estratégia Avançada', value: 'PRO_MAX' }
      ]
    },
    {
      type: 'number',
      name: 'days',
      message: 'Período em dias (máximo 30 para teste rápido):',
      default: 7,
      validate: (value) => value > 0 && value <= 30 ? true : 'Período deve estar entre 1 e 30 dias'
    }
  ]);
  
  // Configuração para teste rápido
  config.symbols = ['BTC_USDC_PERP', 'ETH_USDC_PERP'];
  config.interval = '1h';
  config.initialBalance = 1000;
  config.investmentPerTrade = 100;
  config.useSyntheticData = true; // Força dados sintéticos
  config.saveResults = false; // Não salva resultados de teste
  
  try {
    logger.info('\n🔧 Executando teste rápido...');
    
    const runner = new BacktestRunner();
    await runner.runBacktest(config);
    
    logger.warn('\n⚠️ Lembre-se: Este foi um teste com dados sintéticos!');
    logger.warn('   Para análise real, use "Executar Backtest com Dados Reais"');
    
  } catch (error) {
    logger.error(`❌ Erro no teste: ${error.message}`);
  }
}

/**
 * Configurações avançadas
 */
async function showAdvancedSettings() {
  logger.info('\n⚙️ CONFIGURAÇÕES AVANÇADAS');
  logger.info('-'.repeat(40));
  
  const { setting } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setting',
      message: 'Escolha uma configuração:',
      choices: [
        { name: '📊 Configurar Parâmetros da Estratégia PRO_MAX', value: 'promax' },
        { name: '💰 Configurar Parâmetros de Risco', value: 'risk' },
        { name: '📈 Configurar Parâmetros de Performance', value: 'performance' },
        { name: '🔙 Voltar', value: 'back' }
      ]
    }
  ]);
  
  switch (setting) {
    case 'promax':
      await showProMaxSettings();
      break;
    case 'risk':
      await showRiskSettings();
      break;
    case 'performance':
      await showPerformanceSettings();
      break;
    case 'back':
      return;
  }
}

/**
 * Configurações da estratégia PRO_MAX
 */
async function showProMaxSettings() {
  logger.info('\n📊 CONFIGURAÇÕES DA ESTRATÉGIA PRO_MAX');
  logger.info('-'.repeat(40));
  
  const config = await inquirer.prompt([
    {
      type: 'number',
      name: 'adxLength',
      message: 'Comprimento do ADX:',
      default: 14,
      validate: (value) => value > 0 ? true : 'Valor deve ser maior que zero'
    },
    {
      type: 'number',
      name: 'adxThreshold',
      message: 'Threshold do ADX:',
      default: 20,
      validate: (value) => value > 0 ? true : 'Valor deve ser maior que zero'
    },
    {
      type: 'number',
      name: 'adxAverageLength',
      message: 'Comprimento da média do ADX:',
      default: 21,
      validate: (value) => value > 0 ? true : 'Valor deve ser maior que zero'
    },
    {
      type: 'confirm',
      name: 'useRsiValidation',
      message: 'Usar validação RSI?',
      default: true
    },
    {
      type: 'confirm',
      name: 'useStochValidation',
      message: 'Usar validação Stochastic?',
      default: true
    },
    {
      type: 'confirm',
      name: 'useMacdValidation',
      message: 'Usar validação MACD?',
      default: true
    },
    {
      type: 'confirm',
      name: 'ignoreBronzeSignals',
      message: 'Ignorar sinais BRONZE?',
      default: false
    }
  ]);
  
  logger.info('\n✅ Configurações salvas! Use estas configurações no backtest:');
  logger.info(JSON.stringify(config, null, 2));
  
  const { back } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'back',
      message: 'Pressione Enter para voltar',
      default: true
    }
  ]);
}

/**
 * Configurações de risco
 */
async function showRiskSettings() {
  logger.info('\n💰 CONFIGURAÇÕES DE RISCO');
  logger.info('-'.repeat(40));
  
  const config = await inquirer.prompt([
    {
      type: 'number',
      name: 'maxConcurrentTrades',
      message: 'Máximo de trades simultâneos:',
      default: 5,
      validate: (value) => value > 0 && value <= 20 ? true : 'Valor deve estar entre 1 e 20'
    },
    {
      type: 'number',
      name: 'maxDrawdown',
      message: 'Máximo drawdown permitido (%):',
      default: 20,
      validate: (value) => value > 0 && value <= 50 ? true : 'Valor deve estar entre 1 e 50'
    },
    {
      type: 'number',
      name: 'stopLossPercentage',
      message: 'Stop loss padrão (%):',
      default: 1.5,
      validate: (value) => value > 0 && value <= 10 ? true : 'Valor deve estar entre 0.1 e 10'
    },
    {
      type: 'number',
      name: 'takeProfitPercentage',
      message: 'Take profit padrão (%):',
      default: 2.5,
      validate: (value) => value > 0 && value <= 20 ? true : 'Valor deve estar entre 0.1 e 20'
    }
  ]);
  
  logger.info('\n✅ Configurações de risco salvas!');
  logger.info(JSON.stringify(config, null, 2));
  
  const { back } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'back',
      message: 'Pressione Enter para voltar',
      default: true
    }
  ]);
}

/**
 * Configurações de performance
 */
async function showPerformanceSettings() {
  logger.info('\n📈 CONFIGURAÇÕES DE PERFORMANCE');
  logger.info('-'.repeat(40));
  
  const config = await inquirer.prompt([
    {
      type: 'number',
      name: 'minWinRate',
      message: 'Win rate mínimo desejado (%):',
      default: 50,
      validate: (value) => value >= 0 && value <= 100 ? true : 'Valor deve estar entre 0 e 100'
    },
    {
      type: 'number',
      name: 'minProfitFactor',
      message: 'Profit factor mínimo desejado:',
      default: 1.2,
      validate: (value) => value > 0 ? true : 'Valor deve ser maior que zero'
    },
    {
      type: 'number',
      name: 'minSharpeRatio',
      message: 'Sharpe ratio mínimo desejado:',
      default: 0.5,
      validate: (value) => value > -10 && value < 10 ? true : 'Valor deve estar entre -10 e 10'
    },
    {
      type: 'number',
      name: 'minTrades',
      message: 'Número mínimo de trades para considerar válido:',
      default: 10,
      validate: (value) => value > 0 ? true : 'Valor deve ser maior que zero'
    }
  ]);
  
  logger.info('\n✅ Configurações de performance salvas!');
  logger.info(JSON.stringify(config, null, 2));
  
  const { back } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'back',
      message: 'Pressione Enter para voltar',
      default: true
    }
  ]);
}

/**
 * Função principal
 */
async function main() {
  try {
    while (true) {
      const action = await showMainMenu();
      
      switch (action) {
        case 'real':
          await runRealBacktest();
          break;
        case 'comparative':
          await runComparativeBacktest();
          break;
        case 'liquid':
          await showLiquidSymbols();
          break;
        case 'symbols':
          await showAllSymbols();
          break;
        case 'advanced':
          await showAdvancedSettings();
          break;
        case 'synthetic':
          await runSyntheticTest();
          break;
        case 'exit':
          logger.info('👋 Até logo!');
          process.exit(0);
      }
    }
  } catch (error) {
    logger.error(`❌ Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executa se for o arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 