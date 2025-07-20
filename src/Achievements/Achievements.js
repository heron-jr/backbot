import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js'
import Order from '../Backpack/Authenticated/Order.js';
import PnlController from '../Controllers/PnlController.js';
import Markets from '../Backpack/Public/Markets.js'
import Account from '../Backpack/Authenticated/Account.js';
import Capital from '../Backpack/Authenticated/Capital.js';

class Achievements {

    check24Hour(date) {
        const inputDate = new Date(date)
        const now = new Date()
        const diffInMs = now - inputDate
        const hoursDiff = diffInMs / (1000 * 60 * 60)
        return hoursDiff < 24
    }


    async checkVolume() {
        try {
        const SPOT_MARKET = String(process.env.SPOT_MARKET)
        const START_UTC = String(process.env.START_UTC)
        const GOAL_VOLUME = Number(process.env.GOAL_VOLUME)
        const results = await PnlController.getVolumeMarket(SPOT_MARKET, START_UTC)

        const limitTime = this.check24Hour(START_UTC)

        if(!limitTime) {
            console.log("Passed the first 24 hours ☠️")
        }
    
        if(results) {

            let {totalVolume, totalFee} = results

            totalVolume = Number(totalVolume.toFixed(0))
            totalFee = Number(totalFee.toFixed(2))

            console.log("")
            
            console.log("💸 Fees", totalFee)
            console.log("📈 Current Volume", totalVolume)
            console.log("🎯 Goal", GOAL_VOLUME)

            if(totalVolume >= GOAL_VOLUME) {
                console.log("🎉 Congratulations, you reached your goal!", totalVolume)
            } else {
                console.log("📈 Remaining Volume",GOAL_VOLUME - totalVolume)
            }

            console.log("")

            if(!limitTime) {
                return null
            }

            return (totalVolume - GOAL_VOLUME)

        } else {
            return null
        }

    } catch (error) {
        console.log(error)
        return null   
    }
    }
  
  async run() {
    try {

    const {volume} = await this.checkVolume()

    if(volume) {
        const SPOT_MARKET = String(process.env.SPOT_MARKET)
        const GOAL_VOLUME = Number(process.env.GOAL_VOLUME)
    
        const markets = await Markets.getMarkets()
        const market = markets.find((el) => el.symbol === SPOT_MARKET)
        
        const stepSize_quantity = Number(market.filters.quantity.stepSize)
        const decimal_quantity = String(market.filters.quantity.stepSize).includes(".") ? String(market.filters.quantity.stepSize).split(".")[1].length : 0;

        const Balances = await Capital.getBalances()
        const Collateral = await Capital.getCollateral()

        const amout = Number(Balances[market.baseSymbol].available)
        const usdc = String(Number(Collateral.collateral.find((el) => el.symbol === "USDC").collateralValue).toFixed(0))
        
        const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();

        if(amout < 1) {
            await OrderController.openOrderSpot({side: "Bid", symbol : SPOT_MARKET, volume: usdc, quantity:usdc})
            console.log("Comprando", usdc, "dolares em",market.baseSymbol)
        } else {
            console.log("Vendendo", amout, "de ",market.baseSymbol, "em USDC")
            const quantity = formatQuantity(Math.floor(amout / stepSize_quantity) * stepSize_quantity);
            await OrderController.openOrderSpot({side: "Ask", symbol : SPOT_MARKET, volume: usdc, quantity})
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        await this.run()
    }

    } catch (error) {
        console.log(error)
        return false   
    }
  }
   
}

export default new Achievements();

