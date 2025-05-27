import dotenv from 'dotenv';
import Decision from './src/Decision/Decision.js';
import TrailingStop from './src/TrailingStop/TrailingStop.js'

dotenv.config();

async function startStopLoss() {
  await TrailingStop.stopLoss()
  setTimeout(startStopLoss, 2500); //2.5s 
}

async function startDecision() {
  await Decision.analyze();
  setTimeout(startDecision, 60000); //1m
}

startDecision()
startStopLoss()
