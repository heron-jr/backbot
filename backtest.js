#!/usr/bin/env node

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';
import { DataProvider } from './src/Backtest/DataProvider.js';
import ColorLogger from './src/Utils/ColorLogger.js';
import inquirer from 'inquirer';

const logger = new ColorLogger('BACKTEST', 'CLI');

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
      message: 'Intervalo dos candles:',
      choices: [
        { name: '1 hora (recomendado)', value: '1h' },
        { name: '4 horas', value: '4h' },
        { name: '1 dia', value: '1d' },
        { name: '15 minutos', value: '15m' },
        { name: '5 minutos', value: '5m' },
        { name: '1 minuto', value: '1m' }
      ],
      default: '1h'
    },
    {
      type: 'number',
      name: 'initialBalance',
      message: 'Saldo inicial (USD):',
      default: 1000,
      validate: (value) => value > 0 ? true : 'Saldo deve ser maior que zero'
    },
    {
      type: 'number',
      name: 'investmentPerTrade',
      message: 'Investimento por trade (USD):',
      default: 100,
      validate: (value) => value > 0 ? true : 'Investimento deve ser maior que zero'
    },
    {
      type: 'confirm',
      name: 'saveResults',
      message: 'Salvar resultados em arquivo?',
      default: true
    }
  ]);
  
  // Configurações adicionais para dados reais
  config.useSyntheticData = false; // SEMPRE dados reais
  config.allowSyntheticFallback = false; // Não permite fallback sintético
  config.fee = 0.0004; // 0.04%
  config.slippage = 0.0001; // 0.01%
  config.maxConcurrentTrades = 5;
  config.enableStopLoss = true;
  config.enableTakeProfit = true;
  
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
  }
  
  try {
    logger.info('\n🚀 Iniciando backtest com dados REAIS...');
    logger.info(`📅 Período: ${config.days} dias`);
    logger.info(`📊 Símbolos: ${config.symbols.join(', ')}`);
    logger.info(`⏱️ Intervalo: ${config.interval}`);
    
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
      message: 'Intervalo dos candles:',
      choices: [
        { name: '1 hora (recomendado)', value: '1h' },
        { name: '4 horas', value: '4h' },
        { name: '1 dia', value: '1d' },
        { name: '15 minutos', value: '15m' }
      ],
      default: '1h'
    },
    {
      type: 'number',
      name: 'initialBalance',
      message: 'Saldo inicial (USD):',
      default: 1000,
      validate: (value) => value > 0 ? true : 'Saldo deve ser maior que zero'
    },
    {
      type: 'number',
      name: 'investmentPerTrade',
      message: 'Investimento por trade (USD):',
      default: 100,
      validate: (value) => value > 0 ? true : 'Investimento deve ser maior que zero'
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
      strategyConfig: {}
    },
    {
      ...baseConfig,
      strategy: 'PRO_MAX',
      strategyConfig: {
        adxLength: 14,
        adxThreshold: 20,
        adxAverageLength: 21,
        useRsiValidation: 'true',
        useStochValidation: 'true',
        useMacdValidation: 'true',
        ignoreBronzeSignals: 'false'
      }
    }
  ];
  
  try {
    logger.info('\n🚀 Iniciando backtest comparativo com dados REAIS...');
    logger.info(`📅 Período: ${baseConfig.days} dias`);
    logger.info(`📊 Símbolos: ${baseConfig.symbols.join(', ')}`);
    
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
      
      // Executa backtest com símbolos líquidos
      const config = {
        strategy: 'DEFAULT',
        symbols: topSymbols,
        days: 90,
        interval: '1h',
        initialBalance: 1000,
        investmentPerTrade: 100,
        useSyntheticData: false,
        allowSyntheticFallback: false,
        saveResults: true
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