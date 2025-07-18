#!/usr/bin/env node

/**
 * Timeframe Optimizer para Backbot PRO MAX
 * Testa diferentes timeframes para encontrar o melhor para sua estratégia
 * Executa: node optimize-timeframe.js
 */

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';
import inquirer from 'inquirer';

async function optimizeTimeframe() {
  console.log('⏱️  Timeframe Optimizer para Backbot PRO MAX');
  console.log('='.repeat(50));
  console.log('Este script testa diferentes timeframes para encontrar o melhor para sua estratégia PRO MAX.\n');

  // Configuração interativa
  const config = await inquirer.prompt([
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
      message: 'Período em dias para teste (recomendado: 90-180):',
      default: 90,
      validate: (value) => {
        if (value < 30 || value > 365) {
          return 'Período deve estar entre 30 e 365 dias para análise confiável';
        }
        return true;
      }
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
      name: 'includeAllTimeframes',
      message: 'Testar todos os timeframes disponíveis? (1m, 5m, 15m, 1h, 4h, 1d)',
      default: false
    },
    {
      type: 'checkbox',
      name: 'selectedTimeframes',
      message: 'Selecione os timeframes para testar:',
      choices: [
        { name: '1 minuto (1m) - Muito agressivo', value: '1m' },
        { name: '5 minutos (5m) - Agressivo', value: '5m' },
        { name: '15 minutos (15m) - Moderado', value: '15m' },
        { name: '1 hora (1h) - Conservador', value: '1h' },
        { name: '4 horas (4h) - Muito conservador', value: '4h' },
        { name: '1 dia (1d) - Extremamente conservador', value: '1d' }
      ],
      when: (answers) => !answers.includeAllTimeframes,
      default: ['5m', '15m', '1h']
    }
  ]);

  // Define timeframes para testar
  let timeframesToTest;
  if (config.includeAllTimeframes) {
    timeframesToTest = ['1m', '5m', '15m', '1h', '4h', '1d'];
  } else {
    timeframesToTest = config.selectedTimeframes;
  }

  console.log(`\n📊 Testando ${timeframesToTest.length} timeframes:`);
  timeframesToTest.forEach(tf => console.log(`   • ${tf}`));

  const runner = new BacktestRunner();
  const results = [];

  // Configuração base
  const baseConfig = {
    strategy: 'PRO_MAX',
    symbols: config.symbols,
    days: config.days,
    initialBalance: config.initialBalance,
    investmentPerTrade: config.investmentPerTrade,
    fee: 0.0004,
    maxConcurrentTrades: 5,
    enableStopLoss: true,
    enableTakeProfit: true,
    slippage: 0.0001,
    useSyntheticData: false,
    saveResults: false
  };

  console.log('\n🚀 Iniciando testes de timeframe...\n');

  for (const timeframe of timeframesToTest) {
    console.log(`\n⏱️  Testando timeframe: ${timeframe}`);
    console.log('-'.repeat(40));

    try {
      // Define o timeframe para ACCOUNT2 (PRO_MAX)
      process.env.ACCOUNT2_TIME = timeframe;
      
      const testConfig = {
        ...baseConfig,
        interval: timeframe
      };

      const result = await runner.runBacktest(testConfig);

      if (!result || !result.results || !result.performance) {
        console.log(`⚠️ Timeframe ${timeframe}: Resultados inválidos`);
        continue;
      }

      const { results: res, performance } = result;

      // Calcula métricas específicas para timeframe
      const timeframeAnalysis = {
        timeframe,
        totalReturn: res.totalReturn,
        winRate: performance.winRate,
        totalTrades: performance.totalTrades,
        profitFactor: res.profitFactor,
        maxDrawdown: res.maxDrawdown,
        sharpeRatio: res.sharpeRatio,
        averageWin: performance.averageWin,
        averageLoss: performance.averageLoss,
        // Métricas específicas de timeframe
        tradesPerDay: performance.totalTrades / (config.days || 1),
        returnPerTrade: res.totalReturn / performance.totalTrades,
        riskRewardRatio: performance.averageWin / Math.abs(performance.averageLoss),
        // Análise de consistência
        consecutiveWins: res.maxConsecutiveWins || 0,
        consecutiveLosses: res.maxConsecutiveLosses || 0,
        // Análise de volatilidade
        volatilityScore: calculateVolatilityScore(res.maxDrawdown, res.sharpeRatio),
        // Score composto
        compositeScore: 0
      };

      // Calcula score composto (peso das métricas)
      timeframeAnalysis.compositeScore = calculateCompositeScore(timeframeAnalysis);

      results.push(timeframeAnalysis);

      console.log(`✅ ${timeframe}:`);
      console.log(`   📈 Retorno: ${timeframeAnalysis.totalReturn.toFixed(2)}%`);
      console.log(`   🎯 Win Rate: ${timeframeAnalysis.winRate.toFixed(2)}%`);
      console.log(`   📊 Total Trades: ${timeframeAnalysis.totalTrades}`);
      console.log(`   💰 Profit Factor: ${timeframeAnalysis.profitFactor.toFixed(2)}`);
      console.log(`   📉 Max Drawdown: ${timeframeAnalysis.maxDrawdown.toFixed(2)}%`);
      console.log(`   📈 Sharpe Ratio: ${timeframeAnalysis.sharpeRatio.toFixed(2)}`);
      console.log(`   ⚡ Trades/Dia: ${timeframeAnalysis.tradesPerDay.toFixed(2)}`);
      console.log(`   🎯 Score: ${timeframeAnalysis.compositeScore.toFixed(2)}`);

    } catch (error) {
      console.log(`❌ Erro no timeframe ${timeframe}: ${error.message}`);
    }
  }

  // Restaura configuração original
  delete process.env.ACCOUNT2_TIME;

  // Análise dos resultados
  if (results.length === 0) {
    console.log('\n❌ Nenhum resultado válido obtido');
    return;
  }

  console.log('\n📊 ANÁLISE COMPLETA DOS TIMEFRAMES');
  console.log('='.repeat(60));

  // Ordena por score composto
  results.sort((a, b) => b.compositeScore - a.compositeScore);

  // Tabela de resultados
  console.log('\n🏆 RANKING DOS TIMEFRAMES:');
  console.log('┌─────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Timeframe│ Retorno % │ Win Rate │ Trades   │ Profit F │ Drawdown │ Score    │');
  console.log('├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

  results.forEach((result, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`│ ${rank} ${result.timeframe.padEnd(6)} │ ${result.totalReturn.toFixed(2).padStart(8)} │ ${result.winRate.toFixed(1).padStart(8)} │ ${result.totalTrades.toString().padStart(8)} │ ${result.profitFactor.toFixed(2).padStart(8)} │ ${result.maxDrawdown.toFixed(2).padStart(8)} │ ${result.compositeScore.toFixed(2).padStart(8)} │`);
  });

  console.log('└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

  // Recomendações
  console.log('\n💡 RECOMENDAÇÕES:');
  console.log('='.repeat(30));

  const best = results[0];
  const second = results[1];
  const worst = results[results.length - 1];

  console.log(`\n🥇 MELHOR TIMEFRAME: ${best.timeframe}`);
  console.log(`   • Score: ${best.compositeScore.toFixed(2)}`);
  console.log(`   • Retorno: ${best.totalReturn.toFixed(2)}%`);
  console.log(`   • Win Rate: ${best.winRate.toFixed(2)}%`);
  console.log(`   • Trades/Dia: ${best.tradesPerDay.toFixed(2)}`);

  console.log(`\n🥈 SEGUNDA OPÇÃO: ${second.timeframe}`);
  console.log(`   • Score: ${second.compositeScore.toFixed(2)}`);
  console.log(`   • Retorno: ${second.totalReturn.toFixed(2)}%`);

  console.log(`\n⚠️ EVITAR: ${worst.timeframe}`);
  console.log(`   • Score: ${worst.compositeScore.toFixed(2)}`);
  console.log(`   • Problema: ${getTimeframeIssue(worst)}`);

  // Análise de características
  console.log('\n📈 ANÁLISE DE CARACTERÍSTICAS:');
  console.log('='.repeat(30));

  const highFrequency = results.filter(r => ['1m', '5m'].includes(r.timeframe));
  const mediumFrequency = results.filter(r => ['15m', '1h'].includes(r.timeframe));
  const lowFrequency = results.filter(r => ['4h', '1d'].includes(r.timeframe));

  if (highFrequency.length > 0) {
    const avgHighFreq = highFrequency.reduce((sum, r) => sum + r.compositeScore, 0) / highFrequency.length;
    console.log(`\n⚡ Alta Frequência (1m-5m): Score médio ${avgHighFreq.toFixed(2)}`);
    console.log(`   • Vantagens: Mais oportunidades, resposta rápida`);
    console.log(`   • Desvantagens: Mais ruído, taxas mais altas`);
  }

  if (mediumFrequency.length > 0) {
    const avgMediumFreq = mediumFrequency.reduce((sum, r) => sum + r.compositeScore, 0) / mediumFrequency.length;
    console.log(`\n⚖️  Frequência Média (15m-1h): Score médio ${avgMediumFreq.toFixed(2)}`);
    console.log(`   • Vantagens: Equilíbrio entre oportunidade e qualidade`);
    console.log(`   • Desvantagens: Menos trades, resposta mais lenta`);
  }

  if (lowFrequency.length > 0) {
    const avgLowFreq = lowFrequency.reduce((sum, r) => sum + r.compositeScore, 0) / lowFrequency.length;
    console.log(`\n🐌 Baixa Frequência (4h-1d): Score médio ${avgLowFreq.toFixed(2)}`);
    console.log(`   • Vantagens: Sinais mais confiáveis, menos taxas`);
    console.log(`   • Desvantagens: Poucas oportunidades, resposta muito lenta`);
  }

  // Configuração recomendada
  console.log('\n🔧 CONFIGURAÇÃO RECOMENDADA:');
  console.log('='.repeat(30));
  console.log(`\nPara usar o melhor timeframe (${best.timeframe}), configure no seu .env:`);
  console.log(`\nACCOUNT2_TIME=${best.timeframe}`);
  console.log(`\nOu se preferir a segunda opção (${second.timeframe}):`);
  console.log(`\nACCOUNT2_TIME=${second.timeframe}`);

  // Salva resultados
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `timeframe-optimization-${timestamp}.json`;
  
  try {
    const fs = await import('fs');
    const dataToSave = {
      timestamp: new Date().toISOString(),
      config: {
        symbols: config.symbols,
        days: config.days,
        initialBalance: config.initialBalance,
        investmentPerTrade: config.investmentPerTrade
      },
      results: results,
      recommendations: {
        best: best.timeframe,
        second: second.timeframe,
        avoid: worst.timeframe
      }
    };

    fs.writeFileSync(filename, JSON.stringify(dataToSave, null, 2));
    console.log(`\n💾 Resultados salvos em: ${filename}`);
  } catch (error) {
    console.log(`\n⚠️ Não foi possível salvar resultados: ${error.message}`);
  }

  console.log('\n✅ Otimização de timeframe concluída!');
}

/**
 * Calcula score de volatilidade
 */
function calculateVolatilityScore(maxDrawdown, sharpeRatio) {
  // Penaliza drawdown alto e premia Sharpe ratio alto
  const drawdownScore = Math.max(0, 100 - (maxDrawdown * 2)); // Máximo 100, diminui com drawdown
  const sharpeScore = Math.max(0, Math.min(100, sharpeRatio * 20)); // Sharpe * 20, máximo 100
  
  return (drawdownScore + sharpeScore) / 2;
}

/**
 * Calcula score composto
 */
function calculateCompositeScore(analysis) {
  // Pesos das métricas (soma = 100)
  const weights = {
    totalReturn: 25,      // 25% - Retorno total
    winRate: 20,          // 20% - Taxa de acerto
    profitFactor: 20,     // 20% - Fator de lucro
    maxDrawdown: 15,      // 15% - Drawdown máximo (penaliza)
    sharpeRatio: 10,      // 10% - Sharpe ratio
    tradesPerDay: 10      // 10% - Frequência de trades
  };

  // Normaliza valores para 0-100
  const normalized = {
    totalReturn: Math.max(0, Math.min(100, analysis.totalReturn * 2)), // 50% = 100 pontos
    winRate: analysis.winRate, // Já está em 0-100
    profitFactor: Math.max(0, Math.min(100, analysis.profitFactor * 25)), // 4.0 = 100 pontos
    maxDrawdown: Math.max(0, 100 - analysis.maxDrawdown * 2), // 50% drawdown = 0 pontos
    sharpeRatio: Math.max(0, Math.min(100, analysis.sharpeRatio * 20)), // 5.0 = 100 pontos
    tradesPerDay: Math.max(0, Math.min(100, analysis.tradesPerDay * 10)) // 10 trades/dia = 100 pontos
  };

  // Calcula score ponderado
  let score = 0;
  for (const [metric, weight] of Object.entries(weights)) {
    score += normalized[metric] * (weight / 100);
  }

  return score;
}

/**
 * Identifica problema principal de um timeframe
 */
function getTimeframeIssue(analysis) {
  if (analysis.totalReturn < 0) {
    return 'Retorno negativo';
  }
  if (analysis.winRate < 40) {
    return 'Win rate muito baixo';
  }
  if (analysis.profitFactor < 1.2) {
    return 'Profit factor baixo';
  }
  if (analysis.maxDrawdown > 30) {
    return 'Drawdown muito alto';
  }
  if (analysis.tradesPerDay < 0.1) {
    return 'Muito poucos trades';
  }
  if (analysis.tradesPerDay > 10) {
    return 'Muitos trades (alto custo)';
  }
  return 'Score geral baixo';
}

// Executa a otimização
optimizeTimeframe().catch(console.error); 