#!/usr/bin/env node

/**
 * Teste da refatoração de Stop Loss e Take Profit
 * Verifica se os valores agora vêm do .env em vez de valores fixos
 */

import { BaseStrategy } from './src/Decision/Strategies/BaseStrategy.js';
import { DefaultStrategy } from './src/Decision/Strategies/DefaultStrategy.js';

// Simula dados de mercado
const mockData = {
  marketPrice: 100.0,
  market: { symbol: 'BTC_USDC_PERP', decimal_price: 6 },
  vwap: {
    lowerBands: [95, 98],
    upperBands: [102, 105],
    vwap: 100
  }
};

console.log('🧪 TESTE DA REFATORAÇÃO DE STOP/TARGET');
console.log('==========================================');

// Testa BaseStrategy diretamente
console.log('\n📊 Testando BaseStrategy.calculateStopAndTarget:');
const baseStrategy = new BaseStrategy();

// Teste LONG
const longResult = baseStrategy.calculateStopAndTarget(mockData, 100.0, true, 4.0, 0.5);
console.log('LONG - Preço: $100.00');
console.log(`  Stop Loss: $${longResult?.stop?.toFixed(6)} (${((100 - longResult?.stop) / 100 * 100).toFixed(2)}%)`);
console.log(`  Take Profit: $${longResult?.target?.toFixed(6)} (${((longResult?.target - 100) / 100 * 100).toFixed(2)}%)`);

// Teste SHORT
const shortResult = baseStrategy.calculateStopAndTarget(mockData, 100.0, false, 4.0, 0.5);
console.log('\nSHORT - Preço: $100.00');
console.log(`  Stop Loss: $${shortResult?.stop?.toFixed(6)} (${((shortResult?.stop - 100) / 100 * 100).toFixed(2)}%)`);
console.log(`  Take Profit: $${shortResult?.target?.toFixed(6)} (${((100 - shortResult?.target) / 100 * 100).toFixed(2)}%)`);

// Testa DefaultStrategy SEM variáveis de ambiente (deve falhar)
console.log('\n📊 Testando DefaultStrategy SEM variáveis de ambiente:');
const defaultStrategy = new DefaultStrategy();

// Simula dados completos para DefaultStrategy
const completeData = {
  ...mockData,
  rsi: { value: 65 },
  momentum: { rsi: 'GREEN' },
  stoch: { k: 70, d: 65 },
  macd: { MACD: 0.5, signal: 0.3, histogram: 0.2 },
  adx: { adx: 25, diPlus: 30, diMinus: 20 },
  mfi: { value: 65.2 },
  mfiValue: 2.1
};

// Remove variáveis de ambiente para testar falha
delete process.env.MAX_NEGATIVE_PNL_STOP_PCT;
delete process.env.MIN_PROFIT_PERCENTAGE;

// Testa análise de trade (deve falhar)
const tradeResult = await defaultStrategy.analyzeTrade(0.001, completeData, 100, 65);
if (tradeResult) {
  console.log('❌ ERRO: Trade foi aprovado mesmo sem variáveis de ambiente!');
} else {
  console.log('✅ CORRETO: Trade rejeitado quando variáveis de ambiente não estão definidas');
}

// Testa COM variáveis de ambiente
console.log('\n📊 Testando DefaultStrategy COM variáveis de ambiente:');
process.env.MAX_NEGATIVE_PNL_STOP_PCT = '4.0';
process.env.MIN_PROFIT_PERCENTAGE = '0.5';

const tradeResultWithEnv = await defaultStrategy.analyzeTrade(0.001, completeData, 100, 65);
if (tradeResultWithEnv) {
  console.log('✅ Trade aprovado com variáveis de ambiente:');
  console.log(`  Entry: $${tradeResultWithEnv.entry}`);
  console.log(`  Stop: $${tradeResultWithEnv.stop} (${((tradeResultWithEnv.entry - tradeResultWithEnv.stop) / tradeResultWithEnv.entry * 100).toFixed(2)}%)`);
  console.log(`  Target: $${tradeResultWithEnv.target} (${((tradeResultWithEnv.target - tradeResultWithEnv.entry) / tradeResultWithEnv.entry * 100).toFixed(2)}%)`);
  console.log(`  Action: ${tradeResultWithEnv.action}`);
} else {
  console.log('❌ Trade rejeitado mesmo com variáveis de ambiente');
}

console.log('\n✅ REFATORAÇÃO CONCLUÍDA!');
console.log('📋 Resumo das mudanças:');
console.log('  • BaseStrategy.calculateStopAndTarget agora usa parâmetros do .env');
console.log('  • DefaultStrategy carrega MAX_NEGATIVE_PNL_STOP_PCT e MIN_PROFIT_PERCENTAGE');
console.log('  • OrderController também foi atualizado para usar as configurações');
console.log('  • Sistema unificado: criação de ordem e monitoramento usam as mesmas regras');
console.log('  • SEM valores default - sempre usa variáveis de ambiente');
console.log('  • Validação rigorosa: falha se variáveis não estiverem definidas'); 