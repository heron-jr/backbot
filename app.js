import dotenv from 'dotenv';
dotenv.config();

import Decision from './src/Decision/Decision.js';
import { StrategyFactory } from './src/Decision/Strategies/StrategyFactory.js';
import TrailingStop from './src/TrailingStop/TrailingStop.js';
import PnlController from './src/Controllers/PnlController.js';
import { OrderController } from './src/Controllers/OrderController.js';
import { StrategySelector } from './src/Utils/StrategySelector.js';
import MultiBotManager from './src/MultiBot/MultiBotManager.js';
import AccountConfig from './src/Config/AccountConfig.js';
import readline from 'readline';

const BOT_MODE = process.env.BOT_MODE;

// Variáveis para controle do timer geral
let globalTimerInterval = null;
let isMultiBotMode = false;

// Variável para controle do intervalo do trailing stop
let trailingStopInterval = 1000; // começa em 1s
let trailingStopErrorCount = 0;
let trailingStopMaxInterval = 10000; // máximo 10s
let trailingStopMinInterval = 500;   // mínimo 0.5s
let trailingStopLastErrorTime = null;

// Função para exibir timer geral unificado
function showGlobalTimer() {
  if (globalTimerInterval) {
    clearInterval(globalTimerInterval);
  }

  const durationMs = 60000; // 60 segundos
  const startTime = Date.now();
  const nextAnalysis = new Date(startTime + durationMs);
  const timeString = nextAnalysis.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });

  console.log('\n' + '='.repeat(60));
  console.log('⏰ TIMER GERAL - Próxima análise para todas as contas');
  console.log('='.repeat(60));

  globalTimerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min((elapsed / durationMs) * 100, 100);
    const bars = Math.floor(progress / 5);
    const emptyBars = 20 - bars;
    
    const progressBar = '█'.repeat(bars) + '░'.repeat(emptyBars);
    const percentage = Math.floor(progress);
    
    // Limpa linha anterior e escreve o timer (sem \n)
    process.stdout.write('\r');
    process.stdout.write('⏳ Aguardando próxima análise... ');
    process.stdout.write(`[${progressBar}] ${percentage}% | Próxima: ${timeString}`);
    
    if (progress >= 100) {
      clearInterval(globalTimerInterval);
      process.stdout.write('\n');
      console.log('🔄 Iniciando nova análise...\n');
    }
  }, 1000);
}

// Função para parar o timer geral
function stopGlobalTimer() {
  if (globalTimerInterval) {
    clearInterval(globalTimerInterval);
    globalTimerInterval = null;
  }
}

async function startDecision() {
  // Para modo single, passa null como config para usar variáveis de ambiente
  await Decision.analyze(null, null, null);
  
  // Inicia o timer geral após cada análise
  showGlobalTimer();
  
  setTimeout(startDecision, 60000); //1m
}

async function startStops() {
  try {
    await TrailingStop.stopLoss();
    // Se sucesso, reduz gradualmente o intervalo até o mínimo
    if (trailingStopInterval > trailingStopMinInterval) {
      trailingStopInterval = Math.max(trailingStopMinInterval, trailingStopInterval - 250);
      // if (trailingStopInterval === trailingStopMinInterval) {
      //   console.log(`⏱️ [TRAILING] Intervalo mínimo atingido: ${trailingStopInterval}ms`);
      // }
    }
    trailingStopErrorCount = 0;
  } catch (error) {
    // Detecta erro de rate limit (HTTP 429 ou mensagem)
    if (error?.response?.status === 429 || String(error).includes('rate limit') || String(error).includes('429')) {
      trailingStopErrorCount++;
      trailingStopLastErrorTime = Date.now();
      // Aumenta o intervalo exponencialmente até o máximo
      trailingStopInterval = Math.min(trailingStopMaxInterval, trailingStopInterval * 2);
      console.warn(`⚠️ [TRAILING] Rate limit detectado! Aumentando intervalo para ${trailingStopInterval}ms`);
    } else {
      console.error('[TRAILING] Erro inesperado no trailing stop:', error.message || error);
    }
  }
  setTimeout(startStops, trailingStopInterval);
}

// Monitoramento rápido de ordens pendentes (apenas estratégia PRO_MAX)
let monitorInterval = 5000; // 5 segundos padrão

async function startPendingOrdersMonitor() {
  if (process.env.TRADING_STRATEGY === 'PRO_MAX') {
    try {
      await OrderController.monitorPendingEntryOrders('DEFAULT');
      // Se sucesso, volta ao intervalo normal
      monitorInterval = 5000;
    } catch (error) {
      // Se erro, aumenta o intervalo para reduzir carga na API
      monitorInterval = Math.min(monitorInterval * 1.5, 30000); // Máximo 30 segundos
      console.warn(`⚠️ [MONITOR-DEFAULT] Erro detectado, aumentando intervalo para ${monitorInterval/1000}s`);
    }
  }
  setTimeout(startPendingOrdersMonitor, monitorInterval);
}

// Função para exibir menu de seleção de modo interativo
async function showModeSelectionMenu(hasMultiAccountConfig) {
  return new Promise((resolve) => {
    console.log('\n🤖 BACKBOT - Seleção de Modo');
    console.log('=====================================\n');
    console.log('📋 Modos Disponíveis:\n');
    
    const choices = ['Conta Única'];
    if (hasMultiAccountConfig) {
      choices.push('Multi-Conta');
    }
    choices.push('Sair');
    
    choices.forEach((choice, index) => {
      console.log(`${index + 1}. ${choice}`);
    });
    
    console.log('\n💡 Digite o número da opção desejada');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\nEscolha (1-3): ', (answer) => {
      rl.close();
      const choice = parseInt(answer.trim());
      
      if (choice === 1) {
        resolve('single');
      } else if (choice === 2 && hasMultiAccountConfig) {
        resolve('multi');
      } else if (choice === (hasMultiAccountConfig ? 3 : 2)) {
        resolve('exit');
      } else {
        console.log('❌ Opção inválida. Tente novamente.');
        resolve(showModeSelectionMenu(hasMultiAccountConfig));
      }
    });
  });
}

// Função para re-inicializar a estratégia do Decision
function reinitializeDecisionStrategy() {
  const strategyType = process.env.TRADING_STRATEGY || 'DEFAULT';
  Decision.strategy = StrategyFactory.createStrategy(strategyType);
  console.log(`🔄 Estratégia re-inicializada: ${strategyType.toUpperCase()}`);
}

// Função para iniciar o bot em modo conta única (compatibilidade)
async function startSingleAccountBot() {
  try {
    // Para usuários leigos, sempre mostra a seleção de estratégia
    // A menos que seja especificado para pular via argumento
    const skipStrategySelection = process.argv.includes('--skip-selection') || process.argv.includes('--skip');
    
    if (skipStrategySelection) {
      // Pula a seleção e usa a estratégia do .env
      if (process.env.TRADING_STRATEGY) {
        console.log(`🤖 Backbot iniciando com estratégia: ${process.env.TRADING_STRATEGY}`);
        console.log('⏳ Aguarde...\n');
      } else {
        console.log('❌ Nenhuma estratégia configurada no .env');
        console.log('💡 Execute "npm start" para selecionar uma estratégia');
        process.exit(1);
      }
    } else {
      // Sempre mostra a seleção de estratégia para usuários leigos
      const selector = new StrategySelector();
      await selector.run();
      
      // Re-inicializa a estratégia após a seleção
      reinitializeDecisionStrategy();
    }

    // Log da estratégia selecionada
    const strategy = process.env.TRADING_STRATEGY || 'DEFAULT';
    if (strategy === 'DEFAULT') {
      console.log('🔑 Estratégia DEFAULT: usando credenciais da CONTA1');
    } else {
      console.log('🔑 Estratégia PRO_MAX: usando credenciais da CONTA2');
    }

    // Inicia o PnL Controller
    PnlController.run(24);

    // Inicia os serviços baseado no modo do bot
    if (BOT_MODE === "DEFAULT") {
      startDecision();
      startStops();
      startPendingOrdersMonitor();
    } else if (BOT_MODE === "AUTOMATIC_STOP") {
      startStops();
      startPendingOrdersMonitor();
    } else {
      console.log('⚠️ Modo de bot não reconhecido. Iniciando em modo DEFAULT...');
      startDecision();
      startStops();
      startPendingOrdersMonitor();
    }

  } catch (error) {
    console.error('❌ Erro ao iniciar o bot:', error.message);
    process.exit(1);
  }
}

// Função principal para iniciar o bot
async function startBot() {
  try {
    // Verifica se há configurações de múltiplas contas
    const accountConfig = new AccountConfig();
    const hasMultiAccountConfig = accountConfig.hasMultiAccountConfig();

    // Exibe menu de seleção de modo
    const mode = await showModeSelectionMenu(hasMultiAccountConfig);

    if (mode === 'single') {
      // Modo conta única
      console.log('🚀 Iniciando BackBot em modo Conta Única...\n');
      isMultiBotMode = false;
      await startSingleAccountBot();
    } else if (mode === 'multi') {
      // Modo multi-conta
      console.log('🚀 Iniciando BackBot em modo Multi-Conta...\n');
      isMultiBotMode = true;
      const multiBotManager = new MultiBotManager();
      await multiBotManager.runMultiMode();
    } else {
      console.log('👋 Encerrando BackBot.');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Erro ao iniciar o bot:', error.message);
    process.exit(1);
  }
}

// Inicia o bot
startBot();
