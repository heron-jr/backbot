import Markets from '../Backpack/Public/Markets.js'
import Account from '../Backpack/Authenticated/Account.js';
import Capital from '../Backpack/Authenticated/Capital.js';

class AccountController {


  async getMarkets(marketType = "PERP", orderBookState = "Open" ) {
    try {

    let markets = await Markets.getMarkets()

    markets = markets.filter((el) => {
    const matchMarketType = marketType == null || el.marketType === marketType;
    const matchOrderBookState = orderBookState == null || el.orderBookState === orderBookState;
    return matchMarketType && matchOrderBookState;
  })
  .map((el) => {
    const decimal_quantity = String(el.filters.quantity.stepSize).includes(".")
      ? String(el.filters.quantity.stepSize).split(".")[1].length
      : 0;
    const decimal_price = String(el.filters.price.tickSize).includes(".")
      ? String(el.filters.price.tickSize).split(".")[1].length
      : 0;

    return {
      symbol: el.symbol,
      decimal_quantity,
      decimal_price,
      stepSize_quantity: Number(el.filters.quantity.stepSize),
      tickSize: Number(el.filters.price.tickSize),
    };
  });


    return markets

    } catch (error) {
      console.log(error)
     return null 
    }

  }


  async get() {
    
    try {
    
    const Accounts = await Account.getAccount()
    const Collateral = await Capital.getCollateral()

    const markets = await this.getMarkets()

    const makerFee = parseFloat(Accounts.futuresMakerFee) / 10000
    const takerFee = parseFloat(Accounts.futuresTakerFee) / 10000
    const leverage = parseInt(Accounts.leverageLimit)
    const capitalAvailable = parseFloat(Collateral.netEquityAvailable) * leverage * 0.95
    
    const obj = {
        fee:makerFee,
        makerFee: makerFee,
        takerFee: takerFee,
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

  async getallMarkets(ignore) {
    let markets = await Markets.getMarkets(ignore = [])

      markets = markets.filter((el) => 
          el.marketType === "PERP" && 
          el.orderBookState === "Open" && 
          (ignore.length === 0 || !ignore.includes(el.symbol))).map((el) => {
          
          const decimal_quantity = String(el.filters.quantity.stepSize).includes(".") ? String(el.filters.quantity.stepSize.split(".")[1]).length : 0
          const decimal_price = String(el.filters.price.tickSize).includes(".") ? String(el.filters.price.tickSize.split(".")[1]).length : 0
          
          return {
              symbol: el.symbol,
              decimal_quantity: decimal_quantity,
              decimal_price: decimal_price,
              stepSize_quantity: Number(el.filters.quantity.stepSize),
              tickSize: Number(el.filters.price.tickSize)
          }
      })
    
    return markets
  }

}

export default new AccountController();


