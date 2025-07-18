#!/usr/bin/env node

/**
 * Teste Radical de Profit Factor
 * Configurações extremas para conseguir PF > 2.0
 */

import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function testRadicalProfitFactor() {
  console.log('🚀 Teste Radical de Profit Factor');
  console.log('='.repeat(50));
  console.log('Configurações extremas para PF > 2.0\n');

  const runner = new BacktestRunner();

  // Configuração base
  const baseConfig = {
    strategy: 'PRO_MAX',
    symbols: ['BTC_USDC_PERP'], // Apenas BTC para teste
    days: 90,
    interval: '1d',
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

  // Configurações radicais para testar
  const radicalConfigs = [
    {
      name: 'Configuração Radical 1',
      description: 'SL=15, TP=4, Targets=1, ADX=35',
      envVars: {
        SL_ATR_MULTIPLIER: 15.0,
        ATR_ZONE_MULTIPLIER: 4.0,
        MAX_TARGETS_PER_ORDER: 1,
        ADX_THRESHOLD: 35,
        RSI_BULL_THRESHOLD: 30,
        RSI_BEAR_THRESHOLD: 70,
        ACCOUNT2_TIME: '1d'
      }
    },
    {
      name: 'Configuração Radical 2',
      description: 'SL=20, TP=5, Targets=2, ADX=40',
      envVars: {
        SL_ATR_MULTIPLIER: 20.0,
        ATR_ZONE_MULTIPLIER: 5.0,
        MAX_TARGETS_PER_ORDER: 2,
        ADX_THRESHOLD: 40,
        RSI_BULL_THRESHOLD: 25,
        RSI_BEAR_THRESHOLD: 75,
        ACCOUNT2_TIME: '1d'
      }
    },
    {
      name: 'Configuração Ultra Conservadora',
      description: 'SL=25, TP=6, Targets=1, ADX=45',
      envVars: {
        SL_ATR_MULTIPLIER: 25.0,
        ATR_ZONE_MULTIPLIER: 6.0,
        MAX_TARGETS_PER_ORDER: 1,
        ADX_THRESHOLD: 45,
        RSI_BULL_THRESHOLD: 20,
        RSI_BEAR_THRESHOLD: 80,
        ACCOUNT2_TIME: '1d'
      }
    }
  ];

  console.log('🧪 Testando configurações radicais...\n');

  for (const config of radicalConfigs) {
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

      const result = await runner.runBacktest(baseConfig);

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

      console.log(`✅ ${config.name}:`);
      console.log(`   📈 Retorno: ${res.totalReturn.toFixed(2)}%`);
      console.log(`   🎯 Win Rate: ${performance.winRate.toFixed(2)}%`);
      console.log(`   💰 Profit Factor: ${res.profitFactor.toFixed(2)}`);
      console.log(`   📉 Max Drawdown: ${res.maxDrawdown.toFixed(2)}%`);
      console.log(`   ⚖️ Risk/Reward: ${(performance.averageWin / Math.abs(performance.averageLoss)).toFixed(2)}`);
      console.log(`   📊 Trades: ${performance.totalTrades}`);
      console.log(`   💰 Média Ganho: $${performance.averageWin.toFixed(2)}`);
      console.log(`   💸 Média Perda: $${performance.averageLoss.toFixed(2)}`);

      if (res.profitFactor >= 2.0) {
        console.log(`   🎉 SUCESSO! PF ≥ 2.0 alcançado!`);
      } else if (res.profitFactor >= 1.0) {
        console.log(`   ✅ Lucrativo! PF ≥ 1.0`);
      } else {
        console.log(`   ❌ Ainda não lucrativo`);
      }

    } catch (error) {
      console.log(`❌ Erro no teste ${config.name}: ${error.message}`);
    }
  }

  console.log('\n💡 RECOMENDAÇÕES RADICAIS:');
  console.log('='.repeat(30));
  console.log('\nSe nenhuma configuração atingir PF ≥ 2.0:');
  console.log('\n1. Considere mudar de estratégia');
  console.log('2. Use timeframe semanal (1w)');
  console.log('3. Reduza drasticamente o número de trades');
  console.log('4. Aumente ainda mais os filtros');
  console.log('5. Considere estratégia de swing trading');

  console.log('\n✅ Teste radical concluído!');
}

// Executa o teste
testRadicalProfitFactor().catch(console.error); 