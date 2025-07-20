import dotenv from 'dotenv';
import Decision from './src/Decision/Decision.js';
import PnlController from './src/Controllers/PnlController.js';
import TrailingStopStream from './src/TrailingStop/TrailingStopStream.js'
import CacheController from './src/Controllers/CacheController.js';
import Grid from './src/Grid/Grid.js';
import Achievements from './src/Achievements/Achievements.js';
import Futures from './src/Backpack/Authenticated/Futures.js';

const Cache = new CacheController();

dotenv.config();

const TRADING_STRATEGY = process.env.TRADING_STRATEGY
const PREVIEW_FARM_LAST_HOURS = process.env.PREVIEW_FARM_LAST_HOURS

await PnlController.start(TRADING_STRATEGY)

if(PREVIEW_FARM_LAST_HOURS){
  await PnlController.run(Number(PREVIEW_FARM_LAST_HOURS))
}

await Cache.update();

await new Promise(resolve => setTimeout(resolve, 5000));


async function startDecision() {
  await Decision.analyze();
  setTimeout(startDecision, 1000 * 60); 
}

if(TRADING_STRATEGY === "DEFAULT") {
  startDecision()
  
  const enableStopLoss = String(process.env.ENABLE_STOPLOSS).toUpperCase() === "TRUE"
  if(enableStopLoss) {
    TrailingStopStream.start();
  }

}

if(TRADING_STRATEGY === "AUTOMATIC_STOP") {
  TrailingStopStream.start();
}

if(TRADING_STRATEGY === "GRID") {
  Grid.run()
}

if(TRADING_STRATEGY === "HEDGE_MARKET"){
  console.log("🐋 Don't be hasty, it's coming in the next version. Spoilers in the code.")
}

if(TRADING_STRATEGY === "ACHIEVEMENTS"){
  console.log("🐋 Don't be hasty, it's coming in the next version. Spoilers in the code.")
}
