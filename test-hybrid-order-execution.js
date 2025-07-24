#!/usr/bin/env node

/**
 * Teste do Fluxo Híbrido de Execução de Ordens (LIMIT + fallback MARKET)
 *
 * Cenários cobertos:
 * 1. Ordem LIMIT executada normalmente.
 * 2. Ordem LIMIT não executada, sinal ainda válido, slippage OK → ordem a mercado.
 * 3. Ordem LIMIT não executada, sinal ainda válido, slippage EXCEDIDO → aborta.
 * 4. Ordem LIMIT não executada, sinal NÃO válido → aborta.
 * 5. Estatística de fallback: múltiplas execuções e validação de contagem/logs.
 */

// Mocks e helpers
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Configuração de ambiente
process.env.ORDER_EXECUTION_TIMEOUT_SECONDS = '2'; // Timeout curto para teste
process.env.MAX_SLIPPAGE_PCT = '0.2';

// Mock de preço de mercado
let mockMarketPrice = 100.00;

// Mock de análise de sinal
function mockAnalyzeSignal({ valid = true } = {}) {
  return valid;
}

// Mock de execução de ordem LIMIT
async function mockExecuteLimitOrder({ willFill = true, delay = 1000 }) {
  await sleep(delay);
  return willFill ? { filled: true, type: 'LIMIT' } : { filled: false, type: 'LIMIT' };
}

// Mock de execução de ordem MARKET
async function mockExecuteMarketOrder() {
  return { filled: true, type: 'MARKET' };
}

// Função de slippage
function calcSlippagePct(priceLimit, priceCurrent) {
  return Math.abs(priceCurrent - priceLimit) / priceLimit * 100;
}

// Estatísticas
let fallbackCount = 0;
let totalOrders = 0;

// Função principal de teste do fluxo híbrido
async function testHybridOrderExecution({
  scenario,
  willFillLimit,
  signalValidOnRecheck,
  slippagePctOnRecheck,
  repeat = 1
}) {
  for (let i = 0; i < repeat; i++) {
    totalOrders++;
    const priceLimit = 100.00;
    let priceCurrent = priceLimit * (1 + (slippagePctOnRecheck || 0) / 100);
    mockMarketPrice = priceCurrent;
    console.log(`\n=== Cenário: ${scenario} ===`);
    console.log(`Enviando ordem LIMIT a ${priceLimit}`);
    const limitResult = await mockExecuteLimitOrder({ willFill: willFillLimit });
    if (limitResult.filled) {
      console.log('✅ Ordem LIMIT executada normalmente.');
      continue;
    }
    console.log('⏰ Timeout: Ordem LIMIT não executada. Cancelando...');
    // Revalidação do sinal
    const signalValid = mockAnalyzeSignal({ valid: signalValidOnRecheck });
    const slippage = calcSlippagePct(priceLimit, priceCurrent);
    console.log(`Revalidando sinal: ${signalValid ? 'OK' : 'NÃO OK'} | Slippage: ${slippage.toFixed(3)}%`);
    if (!signalValid) {
      console.log('🚫 Sinal não é mais válido. Abortando entrada.');
      continue;
    }
    if (slippage > parseFloat(process.env.MAX_SLIPPAGE_PCT)) {
      console.log(`🚫 Slippage de ${slippage.toFixed(3)}% excede o máximo permitido (${process.env.MAX_SLIPPAGE_PCT}%). Abortando entrada.`);
      continue;
    }
    // Fallback para mercado
    const marketResult = await mockExecuteMarketOrder();
    if (marketResult.filled) {
      fallbackCount++;
      console.log('⚡ Fallback: Ordem a MERCADO executada com sucesso!');
    }
  }
}

async function runAllScenarios() {
  // 1. LIMIT executada normalmente
  await testHybridOrderExecution({
    scenario: 'LIMIT executada normalmente',
    willFillLimit: true,
    signalValidOnRecheck: true,
    slippagePctOnRecheck: 0.1
  });

  // 2. LIMIT não executada, sinal OK, slippage OK → MARKET
  await testHybridOrderExecution({
    scenario: 'LIMIT não executada, sinal OK, slippage OK',
    willFillLimit: false,
    signalValidOnRecheck: true,
    slippagePctOnRecheck: 0.1
  });

  // 3. LIMIT não executada, sinal OK, slippage EXCEDIDO → aborta
  await testHybridOrderExecution({
    scenario: 'LIMIT não executada, sinal OK, slippage EXCEDIDO',
    willFillLimit: false,
    signalValidOnRecheck: true,
    slippagePctOnRecheck: 0.3
  });

  // 4. LIMIT não executada, sinal NÃO OK → aborta
  await testHybridOrderExecution({
    scenario: 'LIMIT não executada, sinal NÃO OK',
    willFillLimit: false,
    signalValidOnRecheck: false,
    slippagePctOnRecheck: 0.1
  });

  // 5. Estatística de fallback (simula 40% fallback)
  fallbackCount = 0;
  totalOrders = 0;
  await testHybridOrderExecution({
    scenario: 'Estatística de fallback (40% fallback)',
    willFillLimit: false,
    signalValidOnRecheck: true,
    slippagePctOnRecheck: 0.1,
    repeat: 5
  });
  await testHybridOrderExecution({
    scenario: 'Estatística de fallback (60% LIMIT)',
    willFillLimit: true,
    signalValidOnRecheck: true,
    slippagePctOnRecheck: 0.1,
    repeat: 7
  });
  const fallbackPct = (fallbackCount / totalOrders) * 100;
  console.log(`\n[EXECUTION_STATS] ${fallbackPct.toFixed(1)}% das ordens precisaram de fallback para mercado (${fallbackCount}/${totalOrders})`);
  if (fallbackPct > 30) {
    console.log('⚠️ Taxa de fallback alta! Considere ajustar o timeout ou o preço da LIMIT.');
  } else {
    console.log('✅ Taxa de fallback dentro do esperado.');
  }
}

runAllScenarios().catch(console.error); 