import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function optimizeTargets() {
  console.log('🎯 Otimizando MAX_TARGETS_PER_ORDER para estratégia PRO_MAX...\n');
  
  const runner = new BacktestRunner();
  
  // Configuração base
  const baseConfig = {
    strategy: 'PRO_MAX',
    symbols: ['BTC_USDC_PERP', 'ETH_USDC_PERP', 'SOL_USDC_PERP'],
    days: 90, // Período robusto para otimização
    interval: '4h',
    initialBalance: 1000,
    investmentPerTrade: 20, // Usando o melhor valor encontrado anteriormente
    fee: 0.0004,
    maxConcurrentTrades: 5,
    enableStopLoss: true,
    enableTakeProfit: true,
    slippage: 0.0001,
    useSyntheticData: false,
    saveResults: false
  };
  
  // Valores de MAX_TARGETS_PER_ORDER para testar
  const targetConfigs = [
    { name: '3 Targets', value: 3 },
    { name: '5 Targets', value: 5 },
    { name: '8 Targets', value: 8 },
    { name: '10 Targets', value: 10 },
    { name: '12 Targets', value: 12 },
    { name: '15 Targets', value: 15 },
    { name: '20 Targets', value: 20 }
  ];
  
  const results = [];
  
  console.log('📊 Testando diferentes configurações de targets:\n');
  
  for (const targetConfig of targetConfigs) {
    console.log(`\n🔧 Testando: ${targetConfig.name}`);
    console.log('-'.repeat(50));
    
    // Define a variável de ambiente
    process.env.MAX_TARGETS_PER_ORDER = targetConfig.value.toString();
    
    try {
      const result = await runner.runBacktest(baseConfig);
      
      const summary = {
        name: targetConfig.name,
        maxTargets: targetConfig.value,
        totalReturn: result.results.totalReturn,
        winRate: result.performance.winRate,
        totalTrades: result.performance.totalTrades,
        profitFactor: result.results.profitFactor,
        maxDrawdown: result.results.maxDrawdown,
        sharpeRatio: result.results.sharpeRatio,
        averageWin: result.performance.averageWin,
        averageLoss: result.performance.averageLoss,
        // Análise específica de targets
        partialExecutions: result.results.trades.filter(t => t.isPartial).length,
        fullExecutions: result.results.trades.filter(t => !t.isPartial).length,
        targetHitRate: 0
      };
      
      // Calcula taxa de acerto de targets
      if (result.results.trades.length > 0) {
        summary.targetHitRate = (summary.partialExecutions / result.results.trades.length) * 100;
      }
      
      results.push(summary);
      
      console.log(`✅ Resultados para ${targetConfig.name}:`);
      console.log(`   📈 Retorno: ${summary.totalReturn.toFixed(2)}%`);
      console.log(`   🎯 Win Rate: ${summary.winRate.toFixed(2)}%`);
      console.log(`   📊 Total Trades: ${summary.totalTrades}`);
      console.log(`   💰 Profit Factor: ${summary.profitFactor.toFixed(2)}`);
      console.log(`   📉 Max Drawdown: ${summary.maxDrawdown.toFixed(2)}%`);
      console.log(`   🎯 Targets Executados: ${summary.partialExecutions}/${summary.totalTrades} (${summary.targetHitRate.toFixed(1)}%)`);
      console.log(`   💰 Média Ganho: $${summary.averageWin.toFixed(2)}`);
      console.log(`   💸 Média Perda: $${summary.averageLoss.toFixed(2)}`);
      
    } catch (error) {
      console.error(`❌ Erro no teste: ${error.message}`);
    }
  }
  
  // Análise comparativa
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPARAÇÃO DE RESULTADOS');
  console.log('='.repeat(80));
  
  // Ordena por retorno total
  const sortedByReturn = [...results].sort((a, b) => b.totalReturn - a.totalReturn);
  
  console.log('\n🏆 TOP 3 POR RETORNO:');
  sortedByReturn.slice(0, 3).forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: ${result.totalReturn.toFixed(2)}% | Win Rate: ${result.winRate.toFixed(1)}% | PF: ${result.profitFactor.toFixed(2)}`);
  });
  
  // Ordena por profit factor
  const sortedByPF = [...results].sort((a, b) => b.profitFactor - a.profitFactor);
  
  console.log('\n💰 TOP 3 POR PROFIT FACTOR:');
  sortedByPF.slice(0, 3).forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: PF ${result.profitFactor.toFixed(2)} | Retorno: ${result.totalReturn.toFixed(2)}% | Win Rate: ${result.winRate.toFixed(1)}%`);
  });
  
  // Ordena por taxa de acerto de targets
  const sortedByTargetHit = [...results].sort((a, b) => b.targetHitRate - a.targetHitRate);
  
  console.log('\n🎯 TOP 3 POR TAXA DE ACERTO DE TARGETS:');
  sortedByTargetHit.slice(0, 3).forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: ${result.targetHitRate.toFixed(1)}% | Retorno: ${result.totalReturn.toFixed(2)}% | PF: ${result.profitFactor.toFixed(2)}`);
  });
  
  // Tabela completa
  console.log('\n📋 TABELA COMPLETA:');
  console.log('Targets'.padEnd(12) + 
              'Retorno%'.padEnd(10) + 
              'Win Rate%'.padEnd(11) + 
              'PF'.padEnd(6) + 
              'Target Hit%'.padEnd(12) + 
              'Trades'.padEnd(8) + 
              'Max DD%');
  console.log('-'.repeat(80));
  
  results.forEach(result => {
    console.log(
      result.name.padEnd(12) +
      result.totalReturn.toFixed(2).padEnd(10) +
      result.winRate.toFixed(1).padEnd(11) +
      result.profitFactor.toFixed(2).padEnd(6) +
      result.targetHitRate.toFixed(1).padEnd(12) +
      result.totalTrades.toString().padEnd(8) +
      result.maxDrawdown.toFixed(2)
    );
  });
  
  // Recomendação
  console.log('\n🎯 RECOMENDAÇÃO:');
  const bestOverall = sortedByReturn[0];
  console.log(`Melhor configuração geral: ${bestOverall.name} (${bestOverall.maxTargets} targets)`);
  console.log(`Configure no seu .env: MAX_TARGETS_PER_ORDER=${bestOverall.maxTargets}`);
  
  console.log('\n📊 ANÁLISE:');
  console.log(`• Menos targets (3-5): Maior precisão, menor risco`);
  console.log(`• Mais targets (10-20): Maior potencial de lucro, maior risco`);
  console.log(`• Target ideal: Equilibra retorno, win rate e taxa de acerto`);
  
  return results;
}

optimizeTargets().catch(console.error); 