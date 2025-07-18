import './bootstrap.js';
import { BacktestRunner } from './src/Backtest/BacktestRunner.js';

async function optimizeStrategy() {
  const runner = new BacktestRunner();
  
  console.log('🔧 Otimizando Estratégia PRO_MAX...\n');
  
  // Configuração base
  const baseConfig = {
    strategy: 'PRO_MAX',
    symbols: ['BTC_USDC_PERP', 'ETH_USDC_PERP', 'SOL_USDC_PERP'],
    days: 90, // Período menor para otimização mais rápida
    interval: '4h',
    initialBalance: 100,
    investmentPerTrade: 20, // Usando o melhor valor encontrado
    fee: 0.0004,
    maxConcurrentTrades: 5,
    enableStopLoss: true,
    enableTakeProfit: true,
    slippage: 0.0001,
    useSyntheticData: false
  };
  
  // Parâmetros para testar (incluindo ATR e SL)
  const optimizationParams = [
    // Teste 1: Configuração padrão (baseline)
    {
      name: 'Configuração Padrão',
      description: 'ATR_ZONE=1.5, SL_ATR=6.5 (atual)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 1.5,
        SL_ATR_MULTIPLIER: 6.5
      }
    },
    
    // Teste 2: ATR Zone menor (targets mais próximos)
    {
      name: 'ATR Zone Menor',
      description: 'ATR_ZONE=1.0, SL_ATR=6.5 (targets mais próximos)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 1.0,
        SL_ATR_MULTIPLIER: 6.5
      }
    },
    
    // Teste 3: ATR Zone maior (targets mais distantes)
    {
      name: 'ATR Zone Maior',
      description: 'ATR_ZONE=2.0, SL_ATR=6.5 (targets mais distantes)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 2.0,
        SL_ATR_MULTIPLIER: 6.5
      }
    },
    
    // Teste 4: Stop Loss menor (mais agressivo)
    {
      name: 'Stop Loss Menor',
      description: 'ATR_ZONE=1.5, SL_ATR=4.0 (stop mais próximo)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 1.5,
        SL_ATR_MULTIPLIER: 4.0
      }
    },
    
    // Teste 5: Stop Loss maior (mais conservador)
    {
      name: 'Stop Loss Maior',
      description: 'ATR_ZONE=1.5, SL_ATR=8.0 (stop mais distante)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 1.5,
        SL_ATR_MULTIPLIER: 8.0
      }
    },
    
    // Teste 6: Combinação otimizada 1
    {
      name: 'Otimizado 1',
      description: 'ATR_ZONE=1.2, SL_ATR=5.0 (balanceado)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 1.2,
        SL_ATR_MULTIPLIER: 5.0
      }
    },
    
    // Teste 7: Combinação otimizada 2
    {
      name: 'Otimizado 2',
      description: 'ATR_ZONE=1.8, SL_ATR=7.0 (conservador)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 1.8,
        SL_ATR_MULTIPLIER: 7.0
      }
    },
    
    // Teste 8: Combinação agressiva
    {
      name: 'Agressivo',
      description: 'ATR_ZONE=0.8, SL_ATR=3.0 (muito agressivo)',
      config: { ...baseConfig },
      envVars: {
        ATR_ZONE_MULTIPLIER: 0.8,
        SL_ATR_MULTIPLIER: 3.0
      }
    }
  ];
  
  const results = [];
  
  for (const param of optimizationParams) {
    try {
      console.log(`\n🔄 Testando: ${param.name}`);
      console.log(`📝 ${param.description}`);
      console.log('='.repeat(50));
      
      // Define variáveis de ambiente temporariamente
      const originalATRZone = process.env.ATR_ZONE_MULTIPLIER;
      const originalSLATR = process.env.SL_ATR_MULTIPLIER;
      
      process.env.ATR_ZONE_MULTIPLIER = param.envVars.ATR_ZONE_MULTIPLIER.toString();
      process.env.SL_ATR_MULTIPLIER = param.envVars.SL_ATR_MULTIPLIER.toString();
      
      console.log(`🎯 ATR_ZONE_MULTIPLIER: ${process.env.ATR_ZONE_MULTIPLIER}`);
      console.log(`🎯 SL_ATR_MULTIPLIER: ${process.env.SL_ATR_MULTIPLIER}`);
      
      const report = await runner.runBacktest(param.config);
      
      // Restaura variáveis originais
      if (originalATRZone) {
        process.env.ATR_ZONE_MULTIPLIER = originalATRZone;
      } else {
        delete process.env.ATR_ZONE_MULTIPLIER;
      }
      
      if (originalSLATR) {
        process.env.SL_ATR_MULTIPLIER = originalSLATR;
      } else {
        delete process.env.SL_ATR_MULTIPLIER;
      }
      
      // Verifica se o relatório é válido
      if (!report || !report.results || !report.performance) {
        console.log(`⚠️ Teste ${param.name} não retornou resultados válidos`);
        continue;
      }
      
      const { results: res, performance } = report;
      
      const summary = {
        name: param.name,
        description: param.description,
        atrZone: param.envVars.ATR_ZONE_MULTIPLIER,
        slAtr: param.envVars.SL_ATR_MULTIPLIER,
        winRate: performance.winRate || 0,
        totalTrades: performance.totalTrades || 0,
        totalReturn: res.totalReturn || 0,
        profitFactor: res.profitFactor || 0,
        sharpeRatio: res.sharpeRatio || 0,
        maxDrawdown: res.maxDrawdown || 0,
        averageWin: performance.averageWin || 0,
        averageLoss: performance.averageLoss || 0,
        riskRewardRatio: performance.averageWin && performance.averageLoss ? performance.averageWin / Math.abs(performance.averageLoss) : 0
      };
      
      results.push(summary);
      
      console.log(`✅ Resultados:`);
      console.log(`   Win Rate: ${summary.winRate.toFixed(2)}%`);
      console.log(`   Total Trades: ${summary.totalTrades}`);
      console.log(`   Retorno: ${summary.totalReturn.toFixed(2)}%`);
      console.log(`   Profit Factor: ${summary.profitFactor.toFixed(2)}`);
      console.log(`   Risk/Reward: ${summary.riskRewardRatio.toFixed(2)}`);
      console.log(`   Sharpe: ${summary.sharpeRatio.toFixed(2)}`);
      console.log(`   Max DD: ${summary.maxDrawdown.toFixed(2)}%`);
      
    } catch (error) {
      console.error(`❌ Erro no teste ${param.name}: ${error.message}`);
    }
  }
  
  // Verifica se temos resultados válidos
  if (results.length === 0) {
    console.log('\n❌ Nenhum teste foi executado com sucesso. Verifique os erros acima.');
    return;
  }
  
  // Análise comparativa
  console.log('\n' + '='.repeat(80));
  console.log('📊 ANÁLISE COMPARATIVA DOS RESULTADOS');
  console.log('='.repeat(80));
  
  // Ordena por profit factor
  results.sort((a, b) => b.profitFactor - a.profitFactor);
  
  console.log('\n🏆 Ranking por Profit Factor:');
  results.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`${medal} ${result.name}: PF=${result.profitFactor.toFixed(2)}, Return=${result.totalReturn.toFixed(2)}%, R/R=${result.riskRewardRatio.toFixed(2)}`);
    console.log(`    ATR_ZONE=${result.atrZone}, SL_ATR=${result.slAtr}`);
  });
  
  // Ordena por retorno total
  results.sort((a, b) => b.totalReturn - a.totalReturn);
  
  console.log('\n💰 Ranking por Retorno Total:');
  results.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`${medal} ${result.name}: Return=${result.totalReturn.toFixed(2)}%, PF=${result.profitFactor.toFixed(2)}, R/R=${result.riskRewardRatio.toFixed(2)}`);
    console.log(`    ATR_ZONE=${result.atrZone}, SL_ATR=${result.slAtr}`);
  });
  
  // Ordena por risk/reward ratio
  results.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
  
  console.log('\n⚖️ Ranking por Risk/Reward Ratio:');
  results.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`${medal} ${result.name}: R/R=${result.riskRewardRatio.toFixed(2)}, Return=${result.totalReturn.toFixed(2)}%, PF=${result.profitFactor.toFixed(2)}`);
    console.log(`    ATR_ZONE=${result.atrZone}, SL_ATR=${result.slAtr}`);
  });
  
  // Recomendações
  console.log('\n💡 RECOMENDAÇÕES:');
  
  const bestProfitFactor = results[0];
  const bestReturn = results.find(r => r.totalReturn > 0);
  const bestRiskReward = results[0];
  
  if (bestProfitFactor.profitFactor > 1.0) {
    console.log(`✅ Melhor Profit Factor: ${bestProfitFactor.name} (${bestProfitFactor.profitFactor.toFixed(2)})`);
    console.log(`   Configuração: ATR_ZONE_MULTIPLIER=${bestProfitFactor.atrZone}, SL_ATR_MULTIPLIER=${bestProfitFactor.slAtr}`);
  }
  
  if (bestReturn) {
    console.log(`✅ Melhor Retorno: ${bestReturn.name} (${bestReturn.totalReturn.toFixed(2)}%)`);
    console.log(`   Configuração: ATR_ZONE_MULTIPLIER=${bestReturn.atrZone}, SL_ATR_MULTIPLIER=${bestReturn.slAtr}`);
  }
  
  if (bestRiskReward.riskRewardRatio > 0.5) {
    console.log(`✅ Melhor Risk/Reward: ${bestRiskReward.name} (${bestRiskReward.riskRewardRatio.toFixed(2)})`);
    console.log(`   Configuração: ATR_ZONE_MULTIPLIER=${bestRiskReward.atrZone}, SL_ATR_MULTIPLIER=${bestRiskReward.slAtr}`);
  }
  
  console.log('\n🎯 PRÓXIMOS PASSOS:');
  console.log('1. Implementar os parâmetros vencedores no .env');
  console.log('2. Testar em período mais longo (365 dias)');
  console.log('3. Ajustar filtros de entrada se necessário');
  console.log('4. Considerar combinação de múltiplas melhorias');
}

// Executa otimização
optimizeStrategy().catch(console.error); 