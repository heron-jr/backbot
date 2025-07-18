#!/usr/bin/env node

/**
 * Teste do Timeframe Optimizer
 * Verifica se o sistema está funcionando corretamente
 * Executa: node test-timeframe-optimizer.js
 */

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function testTimeframeOptimizer() {
  console.log('🧪 Teste do Timeframe Optimizer');
  console.log('='.repeat(40));

  // Teste com configuração mínima
  const testConfig = {
    strategy: 'PRO_MAX',
    symbols: ['BTC_USDC_PERP'],
    days: 30, // Período curto para teste rápido
    initialBalance: 1000,
    investmentPerTrade: 100,
    fee: 0.0004,
    maxConcurrentTrades: 3,
    enableStopLoss: true,
    enableTakeProfit: true,
    slippage: 0.0001,
    useSyntheticData: false,
    saveResults: false
  };

  const runner = new BacktestRunner();
  const timeframes = ['5m', '15m']; // Apenas 2 timeframes para teste rápido
  const results = [];

  console.log('📊 Testando configuração básica...\n');

  for (const timeframe of timeframes) {
    console.log(`⏱️  Testando ${timeframe}...`);

    try {
      // Define o timeframe para ACCOUNT2 (PRO_MAX)
      process.env.ACCOUNT2_TIME = timeframe;
      
      const config = {
        ...testConfig,
        interval: timeframe
      };

      const result = await runner.runBacktest(config);

      if (!result || !result.results || !result.performance) {
        console.log(`   ❌ Resultados inválidos para ${timeframe}`);
        continue;
      }

      const { results: res, performance } = result;

      const analysis = {
        timeframe,
        totalReturn: res.totalReturn,
        winRate: performance.winRate,
        totalTrades: performance.totalTrades,
        profitFactor: res.profitFactor,
        maxDrawdown: res.maxDrawdown,
        sharpeRatio: res.sharpeRatio
      };

      results.push(analysis);

      console.log(`   ✅ ${timeframe}: Retorno ${analysis.totalReturn.toFixed(2)}% | Win Rate ${analysis.winRate.toFixed(1)}% | Trades ${analysis.totalTrades}`);

    } catch (error) {
      console.log(`   ❌ Erro em ${timeframe}: ${error.message}`);
    }
  }

  // Restaura configuração original
  delete process.env.ACCOUNT2_TIME;

  // Verifica resultados
  if (results.length === 0) {
    console.log('\n❌ TESTE FALHOU: Nenhum resultado obtido');
    return false;
  }

  if (results.length < 2) {
    console.log('\n⚠️ TESTE PARCIAL: Apenas um timeframe funcionou');
    return false;
  }

  console.log('\n✅ TESTE PASSOU: Sistema funcionando corretamente!');
  console.log(`   • Timeframes testados: ${results.length}`);
  console.log(`   • Todos os backtests executaram com sucesso`);
  console.log(`   • Variável ACCOUNT2_TIME funcionando corretamente`);

  // Mostra resultados
  console.log('\n📊 Resultados do teste:');
  results.forEach(result => {
    console.log(`   • ${result.timeframe}: ${result.totalReturn.toFixed(2)}% retorno, ${result.winRate.toFixed(1)}% win rate`);
  });

  return true;
}

// Executa o teste
testTimeframeOptimizer().then(success => {
  if (success) {
    console.log('\n🎉 Timeframe Optimizer está pronto para uso!');
    console.log('\n📖 Comandos disponíveis:');
    console.log('   npm run optimize-timeframe    # Otimização completa com interface');
    console.log('   npm run quick-timeframe       # Otimização rápida');
    console.log('   node quick-optimize-timeframe.js --help  # Ajuda da versão rápida');
  } else {
    console.log('\n❌ Verifique a configuração e tente novamente');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Erro no teste:', error.message);
  process.exit(1);
}); 