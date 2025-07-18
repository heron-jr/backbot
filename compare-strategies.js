#!/usr/bin/env node

/**
 * Comparador de Estratégias
 * Testa DEFAULT vs PRO_MAX para encontrar a melhor
 */

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function compareStrategies() {
  console.log('🔄 Comparador de Estratégias');
  console.log('='.repeat(50));
  console.log('Testando DEFAULT vs PRO_MAX\n');

  const runner = new BacktestRunner();
  const results = [];

  // Configuração base
  const baseConfig = {
    symbols: ['BTC_USDC_PERP', 'ETH_USDC_PERP', 'SOL_USDC_PERP'],
    days: 90,
    interval: '4h',
    initialBalance: 1000,
    investmentPerTrade: 100,
    fee: 0.0004,
    maxConcurrentTrades: 5,
    enableStopLoss: true,
    enableTakeProfit: true,
    slippage: 0.0001,
    useSyntheticData: false,
    saveResults: false
  };

  // Configurações para testar
  const testConfigs = [
    {
      name: 'DEFAULT - Farm de Volume',
      strategy: 'DEFAULT',
      description: 'Estratégia simples com RSI, Stochastic, MACD',
      envVars: {
        ACCOUNT1_TIME: '4h'
      }
    },
    {
      name: 'PRO_MAX - Configuração Atual',
      strategy: 'PRO_MAX',
      description: 'ADX=20, RSI=45/55, SL=6.5, TP=1.5, Targets=8',
      envVars: {
        ACCOUNT2_TIME: '4h',
        ADX_THRESHOLD: 20,
        RSI_BULL_THRESHOLD: 45,
        RSI_BEAR_THRESHOLD: 55,
        SL_ATR_MULTIPLIER: 6.5,
        ATR_ZONE_MULTIPLIER: 1.5,
        MAX_TARGETS_PER_ORDER: 8
      }
    },
    {
      name: 'PRO_MAX - Relaxada',
      strategy: 'PRO_MAX',
      description: 'ADX=15, RSI=40/60, SL=8.0, TP=2.0, Targets=5',
      envVars: {
        ACCOUNT2_TIME: '4h',
        ADX_THRESHOLD: 15,
        RSI_BULL_THRESHOLD: 40,
        RSI_BEAR_THRESHOLD: 60,
        SL_ATR_MULTIPLIER: 8.0,
        ATR_ZONE_MULTIPLIER: 2.0,
        MAX_TARGETS_PER_ORDER: 5
      }
    },
    {
      name: 'PRO_MAX - Conservadora',
      strategy: 'PRO_MAX',
      description: 'ADX=25, RSI=35/65, SL=10.0, TP=2.5, Targets=3',
      envVars: {
        ACCOUNT2_TIME: '4h',
        ADX_THRESHOLD: 25,
        RSI_BULL_THRESHOLD: 35,
        RSI_BEAR_THRESHOLD: 65,
        SL_ATR_MULTIPLIER: 10.0,
        ATR_ZONE_MULTIPLIER: 2.5,
        MAX_TARGETS_PER_ORDER: 3
      }
    }
  ];

  console.log('🚀 Testando diferentes estratégias...\n');

  for (const config of testConfigs) {
    console.log(`\n🔧 Testando: ${config.name}`);
    console.log(`📝 ${config.description}`);
    console.log('-'.repeat(50));

    try {
      // Define variáveis de ambiente
      const originalVars = {};
      for (const [key, value] of Object.entries(config.envVars)) {
        originalVars[key] = process.env[key];
        process.env[key] = value.toString();
      }

      const testConfig = {
        ...baseConfig,
        strategy: config.strategy
      };

      const result = await runner.runBacktest(testConfig);

      // Restaura variáveis originais
      for (const [key, value] of Object.entries(originalVars)) {
        if (value !== undefined) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      }

      if (!result || !result.results || !result.performance) {
        console.log(`⚠️ Resultados inválidos para ${config.name}`);
        continue;
      }

      const { results: res, performance } = result;

      const analysis = {
        name: config.name,
        strategy: config.strategy,
        description: config.description,
        totalReturn: res.totalReturn,
        winRate: performance.winRate,
        totalTrades: performance.totalTrades,
        profitFactor: res.profitFactor,
        maxDrawdown: res.maxDrawdown,
        sharpeRatio: res.sharpeRatio,
        averageWin: performance.averageWin,
        averageLoss: performance.averageLoss,
        tradesPerDay: performance.totalTrades / 90,
        riskRewardRatio: performance.averageWin / Math.abs(performance.averageLoss),
        // Score composto
        compositeScore: calculateCompositeScore(res.profitFactor, performance.winRate, res.maxDrawdown, performance.totalTrades)
      };

      results.push(analysis);

      console.log(`✅ ${config.name}:`);
      console.log(`   📈 Retorno: ${analysis.totalReturn.toFixed(2)}%`);
      console.log(`   🎯 Win Rate: ${analysis.winRate.toFixed(2)}%`);
      console.log(`   💰 Profit Factor: ${analysis.profitFactor.toFixed(2)}`);
      console.log(`   📉 Max Drawdown: ${analysis.maxDrawdown.toFixed(2)}%`);
      console.log(`   ⚖️ Risk/Reward: ${analysis.riskRewardRatio.toFixed(2)}`);
      console.log(`   📊 Trades: ${analysis.totalTrades} (${analysis.tradesPerDay.toFixed(2)}/dia)`);
      console.log(`   🎯 Score: ${analysis.compositeScore.toFixed(2)}`);

      if (analysis.profitFactor >= 2.0) {
        console.log(`   🎉 EXCELENTE! PF ≥ 2.0`);
      } else if (analysis.profitFactor >= 1.0) {
        console.log(`   ✅ Lucrativo! PF ≥ 1.0`);
      } else {
        console.log(`   ❌ Não lucrativo`);
      }

    } catch (error) {
      console.log(`❌ Erro no teste ${config.name}: ${error.message}`);
    }
  }

  // Análise dos resultados
  if (results.length === 0) {
    console.log('\n❌ Nenhum resultado válido obtido');
    return;
  }

  console.log('\n📊 COMPARAÇÃO DE ESTRATÉGIAS');
  console.log('='.repeat(60));

  // Ordena por score composto
  results.sort((a, b) => b.compositeScore - a.compositeScore);

  console.log('\n🏆 RANKING DAS ESTRATÉGIAS:');
  console.log('┌─────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Estratégia          │ PF       │ Retorno% │ Win Rate │ Trades   │ Score    │');
  console.log('├─────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

  results.forEach((result, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    const name = result.name.length > 18 ? result.name.substring(0, 15) + '...' : result.name.padEnd(18);
    console.log(`│ ${rank} ${name} │ ${result.profitFactor.toFixed(2).padStart(8)} │ ${result.totalReturn.toFixed(2).padStart(8)} │ ${result.winRate.toFixed(1).padStart(8)} │ ${result.totalTrades.toString().padStart(8)} │ ${result.compositeScore.toFixed(2).padStart(8)} │`);
  });

  console.log('└─────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

  // Recomendações
  console.log('\n💡 RECOMENDAÇÕES:');
  console.log('='.repeat(30));

  const best = results[0];
  const profitable = results.filter(r => r.profitFactor >= 1.0);

  console.log(`\n🥇 MELHOR ESTRATÉGIA: ${best.name}`);
  console.log(`   • Score: ${best.compositeScore.toFixed(2)}`);
  console.log(`   • Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`   • Retorno: ${best.totalReturn.toFixed(2)}%`);
  console.log(`   • Trades: ${best.totalTrades}`);

  console.log(`\n📊 Estratégias lucrativas: ${profitable.length}/${results.length}`);

  if (profitable.length === 0) {
    console.log(`\n⚠️ NENHUMA estratégia é lucrativa!`);
    console.log(`   Considere:`);
    console.log(`   1. Mudar de exchange`);
    console.log(`   2. Usar timeframe diferente`);
    console.log(`   3. Ajustar parâmetros de mercado`);
    console.log(`   4. Testar período diferente`);
  } else {
    console.log(`\n✅ Estratégias recomendadas:`);
    profitable.forEach((strategy, index) => {
      console.log(`   ${index + 1}. ${strategy.name}: PF ${strategy.profitFactor.toFixed(2)}`);
    });
  }

  // Configuração recomendada
  console.log('\n🔧 CONFIGURAÇÃO RECOMENDADA:');
  console.log('='.repeat(30));
  
  if (best.strategy === 'DEFAULT') {
    console.log(`\nPara usar a estratégia DEFAULT:`);
    console.log(`ACCOUNT1_TIME=4h`);
    console.log(`# Use configurações padrão da estratégia DEFAULT`);
  } else {
    console.log(`\nPara usar a estratégia PRO_MAX:`);
    console.log(`ACCOUNT2_TIME=4h`);
    console.log(`ADX_THRESHOLD=${best.description.includes('ADX=15') ? '15' : best.description.includes('ADX=25') ? '25' : '20'}`);
    console.log(`SL_ATR_MULTIPLIER=${best.description.includes('SL=8.0') ? '8.0' : best.description.includes('SL=10.0') ? '10.0' : '6.5'}`);
    console.log(`ATR_ZONE_MULTIPLIER=${best.description.includes('TP=2.0') ? '2.0' : best.description.includes('TP=2.5') ? '2.5' : '1.5'}`);
    console.log(`MAX_TARGETS_PER_ORDER=${best.description.includes('Targets=5') ? '5' : best.description.includes('Targets=3') ? '3' : '8'}`);
  }

  console.log('\n✅ Comparação de estratégias concluída!');
}

/**
 * Calcula score composto
 */
function calculateCompositeScore(profitFactor, winRate, maxDrawdown, totalTrades) {
  // Score baseado em: 40% Profit Factor + 25% Win Rate + 20% Drawdown + 15% Trades
  const pfScore = Math.min(100, profitFactor * 25); // 4.0 = 100 pontos
  const wrScore = winRate; // Já está em 0-100
  const ddScore = Math.max(0, 100 - (maxDrawdown * 10)); // 10% drawdown = 0 pontos
  const tradesScore = Math.min(100, totalTrades * 2); // 50 trades = 100 pontos
  
  return (pfScore * 0.4) + (wrScore * 0.25) + (ddScore * 0.2) + (tradesScore * 0.15);
}

// Executa a comparação
compareStrategies().catch(console.error); 