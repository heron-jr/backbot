import dotenv from 'dotenv';
dotenv.config();

import Decision from './src/Decision/Decision.js';
import TrailingStop from './src/TrailingStop/TrailingStop.js';
import PnlController from './src/Controllers/PnlController.js';
import { OrderController } from './src/Controllers/OrderController.js';
import { StrategySelector } from './src/Utils/StrategySelector.js';

const BOT_MODE = process.env.BOT_MODE;

async function startDecision() {
  await Decision.analyze();
  setTimeout(startDecision, 60000); //1m
}

async function startStops() {
  await TrailingStop.stopLoss();
  setTimeout(startStops, 1000); //1s
}

// Monitoramento rápido de ordens pendentes (apenas estratégia PRO_MAX)
let monitorInterval = 5000; // 5 segundos padrão

async function startPendingOrdersMonitor() {
  if (process.env.TRADING_STRATEGY === 'PRO_MAX') {
    try {
      await OrderController.monitorPendingEntryOrders();
      // Se sucesso, volta ao intervalo normal
      monitorInterval = 5000;
    } catch (error) {
      // Se erro, aumenta o intervalo para reduzir carga na API
      monitorInterval = Math.min(monitorInterval * 1.5, 30000); // Máximo 30 segundos
      console.warn(`⚠️ [MONITOR] Erro detectado, aumentando intervalo para ${monitorInterval/1000}s`);
    }
  }
  setTimeout(startPendingOrdersMonitor, monitorInterval);
}

// Função principal para iniciar o bot
async function startBot() {
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

// Inicia o bot
startBot();
