import Markets from '../Backpack/Public/Markets.js'
import Account from '../Backpack/Authenticated/Account.js';
import Capital from '../Backpack/Authenticated/Capital.js';

class AccountController {

  async get() {
    
    try {
    
    const Accounts = await Account.getAccount()
    const Collateral = await Capital.getCollateral()

    let markets = await Markets.getMarkets()

    const AUTHORIZED_MARKET = JSON.parse(process.env.AUTHORIZED_MARKET || '[]')


    markets = markets.filter((el) => 
          el.marketType === "PERP" && 
          el.orderBookState === "Open" && 
          (AUTHORIZED_MARKET.length === 0 || AUTHORIZED_MARKET.includes(el.symbol))).map((el) => {
          return {
              symbol: el.symbol,
              decimal_quantity: String(el.filters.quantity.stepSize.split(".")[1]).length,
              decimal_price: String(el.filters.price.tickSize.split(".")[1]).length,
              tickSize: Number(el.filters.price.tickSize)
          }
      })

    const makerFee = parseFloat(Accounts.futuresMakerFee) / 10000
    const leverage = parseInt(Accounts.leverageLimit)
    const capitalAvailable = parseFloat(Collateral.netEquityAvailable) * leverage * 0.95
    
    const maxOpenOrders = parseInt(process.env.LIMIT_ORDER)
    const minVolumeDollar = capitalAvailable / maxOpenOrders 

    const obj = {
        maxOpenOrders,
        minVolumeDollar,
        fee:makerFee,
        leverage:leverage,
        capitalAvailable,
        markets
    }

    return obj

    } catch (error) {
      console.log(error)
     return null 
    }

  }

}

export default new AccountController();


