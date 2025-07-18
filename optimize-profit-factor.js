#!/usr/bin/env node

/**
 * Profit Factor Optimizer para Backbot PRO MAX
 * Foca em melhorar o ratio risco/retorno
 * Executa: node optimize-profit-factor.js
 */

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function optimizeProfitFactor() {
  console.log('💰 Profit Factor Optimizer para Backbot PRO MAX');
  console.log('='.repeat(50));
  console.log('Focando em melhorar o ratio risco/retorno para 2.0+\n');

  const runner = new BacktestRunner();
  const results = [];

  // Configuração base
  const baseConfig = {
    strategy: 'PRO_MAX',
    symbols: ['BTC_USDC_PERP', 'ETH_USDC_PERP', 'SOL_USDC_PERP'],
    days: 90,
    interval: '4h', // Timeframe mais conservador
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
    // Teste 1: Configuração atual (baseline)
    {
      name: 'Configuração Atual',
      description: 'SL_ATR=6.5, ATR_ZONE=1.5, Targets=8',
      envVars: {
        SL_ATR_MULTIPLIER: 6.5,
        ATR_ZONE_MULTIPLIER: 1.5,
        MAX_TARGETS_PER_ORDER: 8
      }
    },
    
    // Teste 2: Stop Loss mais distante
    {
      name: 'Stop Loss Distante',
      description: 'SL_ATR=8.0, ATR_ZONE=1.5, Targets=8',
      envVars: {
        SL_ATR_MULTIPLIER: 8.0,
        ATR_ZONE_MULTIPLIER: 1.5,
        MAX_TARGETS_PER_ORDER: 8
      }
    },
    
    // Teste 3: Take Profit mais distante
    {
      name: 'Take Profit Distante',
      description: 'SL_ATR=6.5, ATR_ZONE=2.0, Targets=8',
      envVars: {
        SL_ATR_MULTIPLIER: 6.5,
        ATR_ZONE_MULTIPLIER: 2.0,
        MAX_TARGETS_PER_ORDER: 8
      }
    },
    
    // Teste 4: Ambos ajustados
    {
      name: 'SL e TP Ajustados',
      description: 'SL_ATR=8.0, ATR_ZONE=2.0, Targets=8',
      envVars: {
        SL_ATR_MULTIPLIER: 8.0,
        ATR_ZONE_MULTIPLIER: 2.0,
        MAX_TARGETS_PER_ORDER: 8
      }
    },
    
    // Teste 5: Menos targets
    {
      name: 'Menos Targets',
      description: 'SL_ATR=8.0, ATR_ZONE=2.0, Targets=3',
      envVars: {
        SL_ATR_MULTIPLIER: 8.0,
        ATR_ZONE_MULTIPLIER: 2.0,
        MAX_TARGETS_PER_ORDER: 3
      }
    },
    
    // Teste 6: Filtros mais rigorosos
    {
      name: 'Filtros Rigorosos',
      description: 'ADX=25, RSI=40/60, SL_ATR=8.0, ATR_ZONE=2.0',
      envVars: {
        SL_ATR_MULTIPLIER: 8.0,
        ATR_ZONE_MULTIPLIER: 2.0,
        MAX_TARGETS_PER_ORDER: 3,
        ADX_THRESHOLD: 25,
        RSI_BULL_THRESHOLD: 40,
        RSI_BEAR_THRESHOLD: 60
      }
    },
    
    // Teste 7: Timeframe diário
    {
      name: 'Timeframe Diário',
      description: '1d, SL_ATR=8.0, ATR_ZONE=2.0, Targets=3',
      envVars: {
        SL_ATR_MULTIPLIER: 8.0,
        ATR_ZONE_MULTIPLIER: 2.0,
        MAX_TARGETS_PER_ORDER: 3,
        ACCOUNT2_TIME: '1d'
      }
    }
  ];

  console.log('🚀 Testando configurações para melhorar Profit Factor...\n');

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
        interval: config.envVars.ACCOUNT2_TIME || '4h'
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
        description: config.description,
        totalReturn: res.totalReturn,
        winRate: performance.winRate,
        totalTrades: performance.totalTrades,
        profitFactor: res.profitFactor,
        maxDrawdown: res.maxDrawdown,
        sharpeRatio: res.sharpeRatio,
        averageWin: performance.averageWin,
        averageLoss: performance.averageLoss,
        // Métricas específicas de Profit Factor
        riskRewardRatio: performance.averageWin / Math.abs(performance.averageLoss),
        tradesPerDay: performance.totalTrades / 90,
        // Score focado em Profit Factor
        profitFactorScore: calculateProfitFactorScore(res.profitFactor, performance.winRate, res.maxDrawdown)
      };

      results.push(analysis);

      console.log(`✅ ${config.name}:`);
      console.log(`   📈 Retorno: ${analysis.totalReturn.toFixed(2)}%`);
      console.log(`   🎯 Win Rate: ${analysis.winRate.toFixed(2)}%`);
      console.log(`   💰 Profit Factor: ${analysis.profitFactor.toFixed(2)}`);
      console.log(`   📉 Max Drawdown: ${analysis.maxDrawdown.toFixed(2)}%`);
      console.log(`   ⚖️ Risk/Reward: ${analysis.riskRewardRatio.toFixed(2)}`);
      console.log(`   📊 Trades: ${analysis.totalTrades}`);
      console.log(`   🎯 Score: ${analysis.profitFactorScore.toFixed(2)}`);

    } catch (error) {
      console.log(`❌ Erro no teste ${config.name}: ${error.message}`);
    }
  }

  // Análise dos resultados
  if (results.length === 0) {
    console.log('\n❌ Nenhum resultado válido obtido');
    return;
  }

  console.log('\n📊 ANÁLISE DE PROFIT FACTOR');
  console.log('='.repeat(60));

  // Ordena por Profit Factor
  results.sort((a, b) => b.profitFactor - a.profitFactor);

  console.log('\n🏆 RANKING POR PROFIT FACTOR:');
  console.log('┌─────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Configuração    │ PF       │ Retorno% │ Win Rate │ Drawdown │ Score    │');
  console.log('├─────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

  results.forEach((result, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    const name = result.name.length > 15 ? result.name.substring(0, 12) + '...' : result.name.padEnd(15);
    console.log(`│ ${rank} ${name} │ ${result.profitFactor.toFixed(2).padStart(8)} │ ${result.totalReturn.toFixed(2).padStart(8)} │ ${result.winRate.toFixed(1).padStart(8)} │ ${result.maxDrawdown.toFixed(2).padStart(8)} │ ${result.profitFactorScore.toFixed(2).padStart(8)} │`);
  });

  console.log('└─────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

  // Recomendações
  console.log('\n💡 RECOMENDAÇÕES:');
  console.log('='.repeat(30));

  const best = results[0];
  const above2 = results.filter(r => r.profitFactor >= 2.0);
  const above1 = results.filter(r => r.profitFactor >= 1.0);

  console.log(`\n🥇 MELHOR CONFIGURAÇÃO: ${best.name}`);
  console.log(`   • Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`   • Retorno: ${best.totalReturn.toFixed(2)}%`);
  console.log(`   • Win Rate: ${best.winRate.toFixed(2)}%`);

  if (above2.length > 0) {
    console.log(`\n✅ Configurações com PF ≥ 2.0: ${above2.length}`);
    above2.forEach((config, index) => {
      console.log(`   ${index + 1}. ${config.name}: PF ${config.profitFactor.toFixed(2)}`);
    });
  } else {
    console.log(`\n⚠️ Nenhuma configuração atingiu PF ≥ 2.0`);
    console.log(`   Melhor PF: ${best.profitFactor.toFixed(2)}`);
  }

  console.log(`\n📊 Configurações lucrativas (PF ≥ 1.0): ${above1.length}/${results.length}`);

  // Configuração recomendada
  console.log('\n🔧 CONFIGURAÇÃO RECOMENDADA:');
  console.log('='.repeat(30));
  
  const recommended = above2.length > 0 ? above2[0] : best;
  
  console.log(`\nPara melhorar o Profit Factor, configure:`);
  console.log(`\n# Stop Loss e Take Profit`);
  console.log(`SL_ATR_MULTIPLIER=${recommended.description.includes('8.0') ? '8.0' : '6.5'}`);
  console.log(`ATR_ZONE_MULTIPLIER=${recommended.description.includes('2.0') ? '2.0' : '1.5'}`);
  console.log(`\n# Targets`);
  console.log(`MAX_TARGETS_PER_ORDER=${recommended.description.includes('Targets=3') ? '3' : '8'}`);
  
  if (recommended.description.includes('ADX=25')) {
    console.log(`\n# Filtros mais rigorosos`);
    console.log(`ADX_THRESHOLD=25`);
    console.log(`RSI_BULL_THRESHOLD=40`);
    console.log(`RSI_BEAR_THRESHOLD=60`);
  }
  
  if (recommended.description.includes('1d')) {
    console.log(`\n# Timeframe`);
    console.log(`ACCOUNT2_TIME=1d`);
  }

  console.log('\n✅ Otimização de Profit Factor concluída!');
}

/**
 * Calcula score focado em Profit Factor
 */
function calculateProfitFactorScore(profitFactor, winRate, maxDrawdown) {
  // Score baseado em: 50% Profit Factor + 30% Win Rate + 20% Drawdown
  const pfScore = Math.min(100, profitFactor * 25); // 4.0 = 100 pontos
  const wrScore = winRate; // Já está em 0-100
  const ddScore = Math.max(0, 100 - (maxDrawdown * 10)); // 10% drawdown = 0 pontos
  
  return (pfScore * 0.5) + (wrScore * 0.3) + (ddScore * 0.2);
}

// Executa a otimização
optimizeProfitFactor().catch(console.error); 