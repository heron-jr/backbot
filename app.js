import dotenv from 'dotenv';
dotenv.config();

import Decision from './src/Decision/Decision.js';
import TrailingStop from './src/TrailingStop/TrailingStop.js';
import PnlController from './src/Controllers/PnlController.js';
import { OrderController } from './src/Controllers/OrderController.js';

const BOT_MODE = process.env.BOT_MODE

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

PnlController.run(24)

if(BOT_MODE === "DEFAULT") {
  startDecision()
  startStops()
  startPendingOrdersMonitor() // Adiciona monitoramento rápido
}

if(BOT_MODE === "AUTOMATIC_STOP") {
  startStops()
  startPendingOrdersMonitor() // Adiciona monitoramento rápido mesmo no modo AUTOMATIC_STOP
}
