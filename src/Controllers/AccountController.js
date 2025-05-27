import Markets from '../Backpack/Public/Markets.js'
import Account from '../Backpack/Authenticated/Account.js';
import Capital from '../Backpack/Authenticated/Capital.js';

class AccountController {

  async get() {

    const Accounts = await Account.getAccount()
    const Collateral = await Capital.getCollateral()
    let markets = await Markets.getMarkets()

    markets = markets.filter((el) => el.marketType === "PERP" && el.orderBookState === "Open" ).map((el) => {
        return {
            symbol: el.symbol,
            decimal_quantity: String(el.filters.quantity.stepSize.split(".")[1]).length,
            decimal_price: String(el.filters.price.tickSize.split(".")[1]).length
        }
    })
   
    const makerFee = parseFloat(Accounts.futuresMakerFee) / 10000
    const leverage = parseInt(Accounts.leverageLimit)
    const capitalAvailable = parseFloat(Collateral.netEquityAvailable) * leverage
    
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

  }

}

export default new AccountController();


