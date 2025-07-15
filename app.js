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

// BOT_MODE removido - sempre usa modo DEFAULT

// Instância global do Decision (será inicializada com a estratégia selecionada)
let decisionInstance = null;

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
  // Usa a instância global do Decision
  if (!decisionInstance) {
    console.error('❌ Instância do Decision não inicializada');
    return;
  }
  
  // Para modo single, cria configuração baseada na estratégia selecionada
  let config = null;
  const strategy = process.env.TRADING_STRATEGY || 'DEFAULT';
  
  if (strategy === 'DEFAULT') {
    // Usa configurações da CONTA1
    config = {
      volumeOrder: Number(process.env.ACCOUNT1_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
      capitalPercentage: Number(process.env.ACCOUNT1_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
      limitOrder: Number(process.env.ACCOUNT1_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
      time: process.env.ACCOUNT1_TIME || process.env.TIME || '5m',
      accountId: 'CONTA1'
    };
  } else if (strategy === 'PRO_MAX') {
    // Usa configurações da CONTA2
    config = {
      volumeOrder: Number(process.env.ACCOUNT2_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
      capitalPercentage: Number(process.env.ACCOUNT2_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
      limitOrder: Number(process.env.ACCOUNT2_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
      time: process.env.ACCOUNT2_TIME || process.env.TIME || '5m',
      accountId: 'CONTA2',
      // Configurações específicas da estratégia PRO_MAX
      ignoreBronzeSignals: process.env.ACCOUNT2_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
      adxLength: Number(process.env.ACCOUNT2_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
      adxThreshold: Number(process.env.ACCOUNT2_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
      adxAverageLength: Number(process.env.ACCOUNT2_ADX_AVERAGE_LENGTH) || Number(process.env.ADX_AVERAGE_LENGTH) || 21,
      useRsiValidation: process.env.ACCOUNT2_USE_RSI_VALIDATION || process.env.USE_RSI_VALIDATION || 'true',
      useStochValidation: process.env.ACCOUNT2_USE_STOCH_VALIDATION || process.env.USE_STOCH_VALIDATION || 'true',
      useMacdValidation: process.env.ACCOUNT2_USE_MACD_VALIDATION || process.env.USE_MACD_VALIDATION || 'true',
      rsiLength: Number(process.env.ACCOUNT2_RSI_LENGTH) || Number(process.env.RSI_LENGTH) || 14,
      rsiAverageLength: Number(process.env.ACCOUNT2_RSI_AVERAGE_LENGTH) || Number(process.env.RSI_AVERAGE_LENGTH) || 14,
      rsiBullThreshold: Number(process.env.ACCOUNT2_RSI_BULL_THRESHOLD) || Number(process.env.RSI_BULL_THRESHOLD) || 45,
      rsiBearThreshold: Number(process.env.ACCOUNT2_RSI_BEAR_THRESHOLD) || Number(process.env.RSI_BEAR_THRESHOLD) || 55,
      stochKLength: Number(process.env.ACCOUNT2_STOCH_K_LENGTH) || Number(process.env.STOCH_K_LENGTH) || 14,
      stochDLength: Number(process.env.ACCOUNT2_STOCH_D_LENGTH) || Number(process.env.STOCH_D_LENGTH) || 3,
      stochSmooth: Number(process.env.ACCOUNT2_STOCH_SMOOTH) || Number(process.env.STOCH_SMOOTH) || 3,
      stochBullThreshold: Number(process.env.ACCOUNT2_STOCH_BULL_THRESHOLD) || Number(process.env.STOCH_BULL_THRESHOLD) || 45,
      stochBearThreshold: Number(process.env.ACCOUNT2_STOCH_BEAR_THRESHOLD) || Number(process.env.STOCH_BEAR_THRESHOLD) || 55,
      macdFastLength: Number(process.env.ACCOUNT2_MACD_FAST_LENGTH) || Number(process.env.MACD_FAST_LENGTH) || 12,
      macdSlowLength: Number(process.env.ACCOUNT2_MACD_SLOW_LENGTH) || Number(process.env.MACD_SLOW_LENGTH) || 26,
      macdSignalLength: Number(process.env.ACCOUNT2_MACD_SIGNAL_LENGTH) || Number(process.env.MACD_SIGNAL_LENGTH) || 9
    };
  }
  
  await decisionInstance.analyze(null, null, config);
  
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
  // No modo conta única, o monitoramento é feito pelo BotInstance no modo multi-conta
  // Esta função é mantida apenas para compatibilidade
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

// Função para inicializar ou re-inicializar a estratégia do Decision
function initializeDecisionStrategy(strategyType) {
  if (!strategyType) {
    console.log('⚠️ StrategyType não fornecido para inicialização');
    return;
  }
  
  // Cria nova instância do Decision com a estratégia selecionada
  decisionInstance = new Decision(strategyType);
  console.log(`✅ Instância do Decision inicializada com estratégia: ${strategyType}`);
}

// Função para iniciar o bot em modo conta única (compatibilidade)
async function startSingleAccountBot() {
  try {
    // Para usuários leigos, sempre mostra a seleção de estratégia
    // A menos que seja especificado para pular via argumento
    const skipStrategySelection = process.argv.includes('--skip-selection') || process.argv.includes('--skip');
    
    if (skipStrategySelection) {
      // Pula a seleção e usa a estratégia do .env (compatibilidade)
      if (process.env.TRADING_STRATEGY) {
        console.log(`🤖 Backbot iniciando com estratégia: ${process.env.TRADING_STRATEGY}`);
        console.log('⏳ Aguarde...\n');
        
        // Inicializa a estratégia com a do .env
        initializeDecisionStrategy(process.env.TRADING_STRATEGY);
      } else {
        console.log('❌ Nenhuma estratégia configurada no .env');
        console.log('💡 Execute "npm start" para selecionar uma estratégia');
        process.exit(1);
      }
    } else {
      // Sempre mostra a seleção de estratégia para usuários leigos
      const selector = new StrategySelector();
      const selectedStrategy = await selector.run();
      
      // Inicializa a estratégia após a seleção
      initializeDecisionStrategy(selectedStrategy);
    }

    // Log da estratégia selecionada
    const strategy = process.env.TRADING_STRATEGY || 'DEFAULT';
    if (strategy === 'DEFAULT') {
      console.log('🔑 Estratégia DEFAULT: usando credenciais da CONTA1');
    } else if (strategy === 'PRO_MAX') {
      console.log('🔑 Estratégia PRO_MAX: usando credenciais da CONTA2');
    } else {
      console.log(`🔑 Estratégia ${strategy}: usando credenciais específicas`);
    }

    // Inicia o PnL Controller
    PnlController.run(24);

    // Inicia os serviços (modo DEFAULT por padrão)
    console.log('🚀 Iniciando serviços em modo DEFAULT...');
    startDecision();
    startStops();
    startPendingOrdersMonitor();

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
