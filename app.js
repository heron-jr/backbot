import dotenv from 'dotenv';
import Decision from './src/Decision/Decision.js';
import TrailingStop from './src/TrailingStop/TrailingStop.js';
import PnlController from './src/Controllers/PnlController.js';
dotenv.config();

const BOT_MODE = process.env.BOT_MODE

async function startDecision() {
  await Decision.analyze();
  setTimeout(startDecision, 60000); //1m
}

async function startStops() {
  await TrailingStop.stopLoss();
  setTimeout(startStops, 1000); //1s
}

PnlController.run(24)

if(BOT_MODE === "DEFAULT") {
  startDecision()
  startStops()
}

if(BOT_MODE === "AUTOMATIC_STOP") {
  startStops()
}
