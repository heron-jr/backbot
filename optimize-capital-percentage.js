import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function optimizeCapitalPercentage() {
  console.log('💰 Otimizando ACCOUNT2_CAPITAL_PERCENTAGE...\n');
  
  const runner = new BacktestRunner();
  
  // Configuração base
  const baseConfig = {
    strategy: 'PRO_MAX',
    symbols: ['BTC_USDC_PERP', 'ETH_USDC_PERP', 'SOL_USDC_PERP'],
    days: 90, // Período robusto para otimização
    interval: '4h',
    initialBalance: 1000,
    fee: 0.0004,
    maxConcurrentTrades: 5,
    enableStopLoss: true,
    enableTakeProfit: true,
    slippage: 0.0001,
    useSyntheticData: false,
    saveResults: false
  };
  
  // Valores de ACCOUNT2_CAPITAL_PERCENTAGE para testar
  const capitalConfigs = [
    { name: '10% Capital', value: 10, investment: 100 },
    { name: '20% Capital', value: 20, investment: 200 },
    { name: '30% Capital', value: 30, investment: 300 },
    { name: '40% Capital (Atual)', value: 40, investment: 400 },
    { name: '50% Capital', value: 50, investment: 500 },
    { name: '60% Capital', value: 60, investment: 600 },
    { name: '70% Capital', value: 70, investment: 700 },
    { name: '80% Capital', value: 80, investment: 800 }
  ];
  
  const results = [];
  
  console.log('📊 Testando diferentes porcentagens de capital por trade:\n');
  
  for (const capitalConfig of capitalConfigs) {
    console.log(`\n🔧 Testando: ${capitalConfig.name}`);
    console.log('-'.repeat(50));
    
    // Define a variável de ambiente
    process.env.ACCOUNT2_CAPITAL_PERCENTAGE = capitalConfig.value.toString();
    
    // Atualiza o investimento por trade baseado na porcentagem
    const config = {
      ...baseConfig,
      investmentPerTrade: capitalConfig.investment
    };
    
    try {
      const result = await runner.runBacktest(config);
      
      const summary = {
        name: capitalConfig.name,
        capitalPercentage: capitalConfig.value,
        investmentPerTrade: capitalConfig.investment,
        totalReturn: result.results.totalReturn,
        winRate: result.performance.winRate,
        totalTrades: result.performance.totalTrades,
        profitFactor: result.results.profitFactor,
        maxDrawdown: result.results.maxDrawdown,
        sharpeRatio: result.results.sharpeRatio,
        averageWin: result.performance.averageWin,
        averageLoss: result.performance.averageLoss,
        // Análise de risco
        riskRewardRatio: result.performance.averageWin / Math.abs(result.performance.averageLoss),
        // Análise de eficiência
        returnPerTrade: result.results.totalReturn / result.performance.totalTrades,
        // Análise de capital
        capitalEfficiency: result.results.totalReturn / capitalConfig.value
      };
      
      results.push(summary);
      
      console.log(`✅ Resultados para ${capitalConfig.name}:`);
      console.log(`   📈 Retorno: ${summary.totalReturn.toFixed(2)}%`);
      console.log(`   🎯 Win Rate: ${summary.winRate.toFixed(2)}%`);
      console.log(`   📊 Total Trades: ${summary.totalTrades}`);
      console.log(`   💰 Profit Factor: ${summary.profitFactor.toFixed(2)}`);
      console.log(`   📉 Max Drawdown: ${summary.maxDrawdown.toFixed(2)}%`);
      console.log(`   💵 Investimento por Trade: $${capitalConfig.investment}`);
      console.log(`   ⚖️ Risk/Reward: ${summary.riskRewardRatio.toFixed(2)}`);
      console.log(`   📊 Retorno por Trade: ${summary.returnPerTrade.toFixed(3)}%`);
      console.log(`   🎯 Eficiência de Capital: ${summary.capitalEfficiency.toFixed(3)}`);
      
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
  
  // Ordena por eficiência de capital
  const sortedByEfficiency = [...results].sort((a, b) => b.capitalEfficiency - a.capitalEfficiency);
  
  console.log('\n🎯 TOP 3 POR EFICIÊNCIA DE CAPITAL:');
  sortedByEfficiency.slice(0, 3).forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: ${result.capitalEfficiency.toFixed(3)} | Retorno: ${result.totalReturn.toFixed(2)}% | PF: ${result.profitFactor.toFixed(2)}`);
  });
  
  // Ordena por menor drawdown
  const sortedByDrawdown = [...results].sort((a, b) => a.maxDrawdown - b.maxDrawdown);
  
  console.log('\n🛡️ TOP 3 POR MENOR RISCO (Drawdown):');
  sortedByDrawdown.slice(0, 3).forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: ${result.maxDrawdown.toFixed(2)}% | Retorno: ${result.totalReturn.toFixed(2)}% | PF: ${result.profitFactor.toFixed(2)}`);
  });
  
  // Tabela completa
  console.log('\n📋 TABELA COMPLETA:');
  console.log('Capital%'.padEnd(12) + 
              'Retorno%'.padEnd(10) + 
              'Win Rate%'.padEnd(11) + 
              'PF'.padEnd(6) + 
              'Max DD%'.padEnd(10) + 
              'Trades'.padEnd(8) + 
              'Eficiência');
  console.log('-'.repeat(80));
  
  results.forEach(result => {
    console.log(
      `${result.capitalPercentage}%`.padEnd(12) +
      result.totalReturn.toFixed(2).padEnd(10) +
      result.winRate.toFixed(1).padEnd(11) +
      result.profitFactor.toFixed(2).padEnd(6) +
      result.maxDrawdown.toFixed(2).padEnd(10) +
      result.totalTrades.toString().padEnd(8) +
      result.capitalEfficiency.toFixed(3)
    );
  });
  
  // Recomendação
  console.log('\n🎯 RECOMENDAÇÃO:');
  const bestOverall = sortedByReturn[0];
  const bestEfficiency = sortedByEfficiency[0];
  const bestRisk = sortedByDrawdown[0];
  
  console.log(`Melhor retorno: ${bestOverall.name} (${bestOverall.capitalPercentage}%)`);
  console.log(`Melhor eficiência: ${bestEfficiency.name} (${bestEfficiency.capitalPercentage}%)`);
  console.log(`Menor risco: ${bestRisk.name} (${bestRisk.capitalPercentage}%)`);
  
  // Recomendação baseada em equilíbrio
  const balancedRecommendation = results.find(r => 
    r.capitalPercentage >= 20 && 
    r.capitalPercentage <= 60 && 
    r.profitFactor > 0.5 && 
    r.maxDrawdown < 5
  ) || bestOverall;
  
  console.log(`\n⚖️ RECOMENDAÇÃO EQUILIBRADA: ${balancedRecommendation.name} (${balancedRecommendation.capitalPercentage}%)`);
  console.log(`Configure no seu .env: ACCOUNT2_CAPITAL_PERCENTAGE=${balancedRecommendation.capitalPercentage}`);
  
  console.log('\n📊 ANÁLISE:');
  console.log(`• Menos capital (10-20%): Menor risco, menor retorno`);
  console.log(`• Mais capital (60-80%): Maior risco, maior retorno`);
  console.log(`• Capital ideal: Equilibra retorno, risco e eficiência`);
  console.log(`• Considere: Tamanho da conta, tolerância ao risco, objetivos`);
  
  return results;
}

optimizeCapitalPercentage().catch(console.error); 