#!/usr/bin/env node

/**
 * Quick Timeframe Optimizer para Backbot PRO MAX
 * Versão rápida sem interface interativa
 * Executa: node quick-optimize-timeframe.js
 */

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function quickOptimizeTimeframe() {
  console.log('⚡ Quick Timeframe Optimizer para Backbot PRO MAX');
  console.log('='.repeat(50));

  // Configuração padrão (pode ser alterada via argumentos de linha de comando)
  const config = {
    symbols: ['BTC_USDC_PERP', 'ETH_USDC_PERP', 'SOL_USDC_PERP'],
    days: 90,
    initialBalance: 1000,
    investmentPerTrade: 100,
    timeframes: ['1m', '5m', '15m', '1h', '4h'] // Remove 1d para ser mais rápido
  };

  // Verifica argumentos de linha de comando
  const args = process.argv.slice(2);
  if (args.length > 0) {
    if (args[0] === '--help' || args[0] === '-h') {
      console.log('\n📖 Uso: node quick-optimize-timeframe.js [opções]');
      console.log('\nOpções:');
      console.log('  --symbols BTC,ETH,SOL    Símbolos para testar');
      console.log('  --days 90                Período em dias');
      console.log('  --balance 1000           Saldo inicial');
      console.log('  --investment 100         Investimento por trade');
      console.log('  --timeframes 5m,15m,1h   Timeframes específicos');
      console.log('  --help                   Mostra esta ajuda');
      console.log('\nExemplo:');
      console.log('  node quick-optimize-timeframe.js --days 60 --timeframes 5m,15m,1h');
      return;
    }

    // Processa argumentos
    for (let i = 0; i < args.length; i += 2) {
      const arg = args[i];
      const value = args[i + 1];

      switch (arg) {
        case '--symbols':
          config.symbols = value.split(',').map(s => s.trim());
          break;
        case '--days':
          config.days = parseInt(value);
          break;
        case '--balance':
          config.initialBalance = parseInt(value);
          break;
        case '--investment':
          config.investmentPerTrade = parseInt(value);
          break;
        case '--timeframes':
          config.timeframes = value.split(',').map(s => s.trim());
          break;
      }
    }
  }

  console.log(`\n📊 Configuração:`);
  console.log(`   • Símbolos: ${config.symbols.join(', ')}`);
  console.log(`   • Período: ${config.days} dias`);
  console.log(`   • Saldo inicial: $${config.initialBalance}`);
  console.log(`   • Investimento por trade: $${config.investmentPerTrade}`);
  console.log(`   • Timeframes: ${config.timeframes.join(', ')}`);

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

  for (const timeframe of config.timeframes) {
    console.log(`⏱️  Testando ${timeframe}...`);

    try {
      // Define o timeframe para ACCOUNT2 (PRO_MAX)
      process.env.ACCOUNT2_TIME = timeframe;
      
      const testConfig = {
        ...baseConfig,
        interval: timeframe
      };

      const result = await runner.runBacktest(testConfig);

      if (!result || !result.results || !result.performance) {
        console.log(`   ⚠️ Resultados inválidos`);
        continue;
      }

      const { results: res, performance } = result;

      // Calcula métricas
      const analysis = {
        timeframe,
        totalReturn: res.totalReturn,
        winRate: performance.winRate,
        totalTrades: performance.totalTrades,
        profitFactor: res.profitFactor,
        maxDrawdown: res.maxDrawdown,
        sharpeRatio: res.sharpeRatio,
        tradesPerDay: performance.totalTrades / config.days,
        returnPerTrade: res.totalReturn / performance.totalTrades,
        riskRewardRatio: performance.averageWin / Math.abs(performance.averageLoss)
      };

      // Calcula score composto
      analysis.compositeScore = calculateQuickScore(analysis);
      results.push(analysis);

      console.log(`   ✅ Retorno: ${analysis.totalReturn.toFixed(2)}% | Win Rate: ${analysis.winRate.toFixed(1)}% | Score: ${analysis.compositeScore.toFixed(1)}`);

    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }

  // Restaura configuração original
  delete process.env.ACCOUNT2_TIME;

  // Análise dos resultados
  if (results.length === 0) {
    console.log('\n❌ Nenhum resultado válido obtido');
    return;
  }

  // Ordena por score
  results.sort((a, b) => b.compositeScore - a.compositeScore);

  console.log('\n🏆 RANKING FINAL:');
  console.log('┌─────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Timeframe│ Retorno % │ Win Rate │ Trades   │ Drawdown │ Score    │');
  console.log('├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

  results.forEach((result, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`│ ${rank} ${result.timeframe.padEnd(6)} │ ${result.totalReturn.toFixed(2).padStart(8)} │ ${result.winRate.toFixed(1).padStart(8)} │ ${result.totalTrades.toString().padStart(8)} │ ${result.maxDrawdown.toFixed(2).padStart(8)} │ ${result.compositeScore.toFixed(2).padStart(8)} │`);
  });

  console.log('└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

  // Recomendação
  const best = results[0];
  console.log(`\n💡 RECOMENDAÇÃO: Use ACCOUNT2_TIME=${best.timeframe}`);
  console.log(`   • Score: ${best.compositeScore.toFixed(2)}`);
  console.log(`   • Retorno: ${best.totalReturn.toFixed(2)}%`);
  console.log(`   • Win Rate: ${best.winRate.toFixed(2)}%`);
  console.log(`   • Trades/Dia: ${best.tradesPerDay.toFixed(2)}`);

  console.log('\n✅ Otimização rápida concluída!');
}

/**
 * Calcula score rápido para comparação
 */
function calculateQuickScore(analysis) {
  // Score simplificado: 40% retorno + 30% win rate + 20% profit factor + 10% drawdown
  const returnScore = Math.max(0, Math.min(100, analysis.totalReturn * 2));
  const winRateScore = analysis.winRate;
  const profitFactorScore = Math.max(0, Math.min(100, analysis.profitFactor * 25));
  const drawdownScore = Math.max(0, 100 - analysis.maxDrawdown * 2);

  return (returnScore * 0.4) + (winRateScore * 0.3) + (profitFactorScore * 0.2) + (drawdownScore * 0.1);
}

// Executa a otimização
quickOptimizeTimeframe().catch(console.error); 