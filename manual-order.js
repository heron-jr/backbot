#!/usr/bin/env node

import dotenv from 'dotenv';
import readline from 'readline';
import AccountController from './src/Controllers/AccountController.js';
import OrderController from './src/Controllers/OrderController.js';
import { ProMaxStrategy } from './src/Decision/Strategies/ProMaxStrategy.js';
import Markets from './src/Backpack/Public/Markets.js';
import { calculateIndicators } from './src/Decision/Indicators.js';

// Carrega as variáveis de ambiente
dotenv.config();

// Configuração do readline para entrada interativa
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas ao usuário
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Função para mostrar opções e obter escolha
async function showOptions(title, options) {
  console.log(`\n${title}:`);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });
  
  const choice = await askQuestion('\nEscolha uma opção: ');
  const choiceIndex = parseInt(choice) - 1;
  
  if (choiceIndex >= 0 && choiceIndex < options.length) {
    return choiceIndex;
  } else {
    console.log('❌ Opção inválida. Tente novamente.');
    return await showOptions(title, options);
  }
}

// Função para obter informações da conta
async function getAccountInfo() {
  console.log('\n🔐 Configurando conta...');
  
  const accountOptions = ['CONTA1', 'CONTA2'];
  const accountChoice = await showOptions('Selecione a conta', accountOptions);
  const accountId = accountOptions[accountChoice];
  
  // Define as variáveis de ambiente baseado na conta escolhida
  if (accountId === 'CONTA2') {
    process.env.API_KEY = process.env.ACCOUNT2_API_KEY;
    process.env.API_SECRET = process.env.ACCOUNT2_API_SECRET;
  } else {
    process.env.API_KEY = process.env.ACCOUNT1_API_KEY;
    process.env.API_SECRET = process.env.ACCOUNT1_API_SECRET;
  }
  
  console.log(`✅ Conta selecionada: ${accountId}`);
  return accountId;
}

// Função para obter informações do mercado
async function getMarketInfo() {
  console.log('\n📊 Obtendo informações dos mercados...');
  
  try {
    const Account = await AccountController.get();
    const markets = Account.markets.map(m => m.symbol);
    
    console.log(`\nMercados disponíveis (${markets.length}):`);
    markets.forEach((market, index) => {
      console.log(`  ${index + 1}. ${market}`);
    });
    
    const marketChoice = await askQuestion('\nDigite o número do mercado ou o símbolo diretamente: ');
    
    let selectedMarket;
    const marketIndex = parseInt(marketChoice) - 1;
    
    if (marketIndex >= 0 && marketIndex < markets.length) {
      selectedMarket = markets[marketIndex];
    } else if (markets.includes(marketChoice.toUpperCase())) {
      selectedMarket = marketChoice.toUpperCase();
    } else {
      console.log('❌ Mercado inválido. Tente novamente.');
      return await getMarketInfo();
    }
    
    const marketInfo = Account.markets.find(m => m.symbol === selectedMarket);
    console.log(`✅ Mercado selecionado: ${selectedMarket}`);
    console.log(`   • Tick Size: ${marketInfo.tickSize}`);
    console.log(`   • Step Size: ${marketInfo.stepSize_quantity}`);
    console.log(`   • Decimais preço: ${marketInfo.decimal_price}`);
    console.log(`   • Decimais quantidade: ${marketInfo.decimal_quantity}`);
    
    return { symbol: selectedMarket, info: marketInfo };
  } catch (error) {
    console.error('❌ Erro ao obter informações dos mercados:', error.message);
    process.exit(1);
  }
}

// Função para obter tipo de ordem
async function getOrderType() {
  const orderTypes = ['Limit', 'Market'];
  const orderTypeIndex = await showOptions('Tipo de ordem', orderTypes);
  const orderType = orderTypes[orderTypeIndex];
  
  console.log(`✅ Tipo de ordem: ${orderType}`);
  return orderType;
}

// Função para obter ação (long/short)
async function getAction() {
  const actions = ['LONG', 'SHORT'];
  const actionIndex = await showOptions('Tipo de posição', actions);
  const action = actions[actionIndex].toLowerCase();
  
  console.log(`✅ Ação: ${action.toUpperCase()}`);
  return action;
}

// Função para obter preço
async function getPrice(orderType, marketInfo) {
  if (orderType === 'Market') {
    // Buscar preço de mercado atual
    try {
      const markPrices = await Markets.getAllMarkPrices(marketInfo.symbol);
      const markPrice = parseFloat(markPrices[0]?.markPrice);
      if (!isNaN(markPrice) && markPrice > 0) {
        console.log(`✅ Ordem de mercado - preço de referência: ${markPrice}`);
        return markPrice;
      } else {
        console.log('❌ Não foi possível obter o preço de mercado atual.');
        return null;
      }
    } catch (e) {
      console.log('❌ Erro ao buscar preço de mercado:', e.message);
      return null;
    }
  }
  
  const priceInput = await askQuestion(`\n💰 Digite o preço de entrada (ex: 45.123): `);
  const price = parseFloat(priceInput);
  
  if (isNaN(price) || price <= 0) {
    console.log('❌ Preço inválido. Tente novamente.');
    return await getPrice(orderType, marketInfo);
  }
  
  // Formata o preço conforme as regras do mercado
  const formattedPrice = parseFloat(price.toFixed(marketInfo.decimal_price));
  console.log(`✅ Preço: ${formattedPrice}`);
  
  return formattedPrice;
}

// Função para obter volume
async function getVolume() {
  console.log('\n💡 INFORMAÇÃO IMPORTANTE:');
  console.log('   • A margem é o valor que você quer arriscar');
  console.log('   • O valor real da operação será: Margem × Alavancagem');
  console.log('   • Exemplo: $10 de margem com 20x = $200 de operação');
  console.log('   • A quantidade será calculada automaticamente');
  
  const volumeInput = await askQuestion(`\n💵 Digite a margem em USD (ex: 100): `);
  const volume = parseFloat(volumeInput);
  
  if (isNaN(volume) || volume <= 0) {
    console.log('❌ Margem inválida. Tente novamente.');
    return await getVolume();
  }
  
  console.log(`✅ Margem: $${volume}`);
  return volume;
}

// Função para calcular alvos e stop loss
async function calculateTargetsAndStop(market, price, action, accountId) {
  console.log('\n🎯 Calculando alvos e stop loss...');
  console.log('   • Usando estratégia PRO_MAX com ATR');
  console.log('   • Stop loss: baseado em ATR × 5.0');
  console.log('   • Take profits: baseado em ATR × 1.5');
  console.log('   • Máximo de 15% de distância do preço atual');
  
  try {
    // Obtém dados de mercado
    const timeframe = process.env.TIME || '5m';
    const candles = await Markets.getKLines(market.symbol, timeframe, 30);
    const indicators = calculateIndicators(candles);
    const data = { ...indicators, market: market.info, marketPrice: price };
    
    // Usa estratégia PRO_MAX para calcular
    const strategy = new ProMaxStrategy();
    const stopAndTargets = strategy.calculateStopAndMultipleTargets(data, price, action);
    
    if (!stopAndTargets) {
      console.log('❌ Não foi possível calcular alvos e stop loss');
      return null;
    }
    
    const { stop, targets } = stopAndTargets;
    
    console.log(`\n📊 Resultados do cálculo:`);
    console.log(`   • Stop Loss: ${stop.toFixed(6)}`);
    console.log(`   • Alvos calculados: ${targets.length}`);
    
    // Mostra os primeiros 5 alvos
    targets.slice(0, 5).forEach((target, index) => {
      console.log(`   • Target ${index + 1}: ${target.toFixed(6)}`);
    });
    
    if (targets.length > 5) {
      console.log(`   • ... e mais ${targets.length - 5} alvos`);
    }
    
    return { stop, targets };
  } catch (error) {
    console.error('❌ Erro ao calcular alvos e stop loss:', error.message);
    return null;
  }
}

// Função para confirmar ordem
async function confirmOrder(orderData) {
  // Obtém informações da conta para mostrar a alavancagem
  const Account = await AccountController.get();
  const leverage = Account.leverage;
  const actualVolume = orderData.volume * leverage;
  
  // Calcula a quantidade aproximada para mostrar ao usuário
  const estimatedQuantity = actualVolume / orderData.price;
  
  console.log('\n📋 RESUMO DA ORDEM:');
  console.log(`   • Mercado: ${orderData.market.symbol}`);
  console.log(`   • Tipo: ${orderData.orderType}`);
  console.log(`   • Ação: ${orderData.action.toUpperCase()}`);
  console.log(`   • Preço: ${orderData.price || 'Mercado'}`);
  console.log(`   • Margem: $${orderData.volume}`);
  console.log(`   • Alavancagem: ${leverage}x`);
  console.log(`   • Valor da operação: $${actualVolume.toFixed(2)}`);
  console.log(`   • Quantidade estimada: ${estimatedQuantity.toFixed(6)}`);
  console.log(`   • Stop Loss: ${orderData.stop.toFixed(6)}`);
  console.log(`   • Alvos: ${orderData.targets.length}`);
  
  console.log('\n💡 CÁLCULO:');
  console.log(`   • Margem: $${orderData.volume}`);
  console.log(`   • Alavancagem: ${leverage}x`);
  console.log(`   • Operação: $${orderData.volume} × ${leverage} = $${actualVolume.toFixed(2)}`);
  console.log(`   • Quantidade: $${actualVolume.toFixed(2)} ÷ $${orderData.price} = ${estimatedQuantity.toFixed(6)}`);
  
  const confirm = await askQuestion('\n❓ Confirma a criação desta ordem? (s/n): ');
  return confirm.toLowerCase() === 's' || confirm.toLowerCase() === 'sim';
}

// Função para executar a ordem
async function executeOrder(orderData, accountId) {
  console.log('\n🚀 Executando ordem...');
  
  try {
    console.log(`🔍 [DEBUG] Enviando ordem com stop: ${orderData.stop.toFixed(6)}`);
    
    const result = await OrderController.openOrder({
      entry: orderData.price,
      stop: orderData.stop,
      target: orderData.targets[0], // Usa apenas o primeiro alvo para a ordem inicial
      action: orderData.action,
      market: orderData.market.symbol,
      volume: orderData.volume,
      decimal_quantity: orderData.market.info.decimal_quantity,
      decimal_price: orderData.market.info.decimal_price,
      stepSize_quantity: orderData.market.info.stepSize_quantity,
      accountId: accountId
    });
    
    if (result && !result.error) {
      console.log('✅ Ordem executada com sucesso!');
      console.log(`📋 Order ID: ${result.orderId || 'N/A'}`);
      
      // Se há mais alvos, pergunta se quer criar ordens adicionais
      if (orderData.targets.length > 1) {
        const createMore = await askQuestion('\n❓ Deseja criar ordens para os outros alvos? (s/n): ');
        if (createMore.toLowerCase() === 's' || createMore.toLowerCase() === 'sim') {
          console.log('\n🎯 Criando ordens para alvos adicionais...');
          // Aqui você pode implementar a criação das outras ordens
        }
      }
      
      return true;
    } else {
      console.log('❌ Falha ao executar ordem:', result?.error || 'Erro desconhecido');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao executar ordem:', error.message);
    return false;
  }
}

// Função principal
async function main() {
  console.log('🤖 BOT - Criação Manual de Ordens');
  console.log('=====================================');
  console.log('\n💡 COMO FUNCIONA:');
  console.log('   • Você define a MARGEM (valor que quer arriscar)');
  console.log('   • O bot calcula o valor real da operação usando a alavancagem');
  console.log('   • A quantidade é calculada automaticamente');
  console.log('   • Stop loss e take profits são criados automaticamente');
  console.log('   • Exemplo: $10 de margem com 20x = $200 de operação');
  console.log('');
  
  try {
    // 1. Configurar conta
    const accountId = await getAccountInfo();
    
    // 2. Selecionar mercado
    const market = await getMarketInfo();
    
    // 3. Selecionar tipo de ordem
    const orderType = await getOrderType();
    
    // 4. Selecionar ação
    const action = await getAction();
    
    // 5. Obter preço (se não for mercado)
    const price = await getPrice(orderType, market.info);
    
    // 6. Obter volume
    const volume = await getVolume();
    
    // 7. Calcular alvos e stop loss
    const targetsAndStop = await calculateTargetsAndStop(market, price, action, accountId);
    
    if (!targetsAndStop) {
      console.log('\n❌ Não foi possível prosseguir sem os cálculos.');
      rl.close();
      return;
    }
    
    // 8. Preparar dados da ordem
    const orderData = {
      market,
      orderType,
      action,
      price,
      volume,
      stop: targetsAndStop.stop,
      targets: targetsAndStop.targets
    };
    
    // 9. Confirmar ordem
    const confirmed = await confirmOrder(orderData);
    
    if (!confirmed) {
      console.log('\n❌ Ordem cancelada pelo usuário.');
      rl.close();
      return;
    }
    
    // 10. Executar ordem
    const success = await executeOrder(orderData, accountId);
    
    if (success) {
      console.log('\n🎉 Processo concluído com sucesso!');
    } else {
      console.log('\n❌ Processo falhou.');
    }
    
  } catch (error) {
    console.error('\n❌ Erro durante o processo:', error.message);
  } finally {
    rl.close();
  }
}

// Executar o script
main().catch(console.error); 