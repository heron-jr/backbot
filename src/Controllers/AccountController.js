import Markets from '../Backpack/Public/Markets.js'
import Account from '../Backpack/Authenticated/Account.js';
import Capital from '../Backpack/Authenticated/Capital.js';

class AccountController {

  async get(config = null) {
    
    try {
    
    const Accounts = await Account.getAccount()
    const Collateral = await Capital.getCollateral()

    // Verifica se os dados da conta foram obtidos com sucesso
    if (!Accounts || !Collateral) {
      console.error('❌ Falha ao obter dados da conta. Verifique suas credenciais de API.');
      return null;
    }

    let markets = await Markets.getMarkets();
    if (!markets) {
      console.error('❌ AccountController.get - Markets.getMarkets() retornou null. API pode estar offline.');
      return null;
    }

    const AUTHORIZED_MARKET = JSON.parse(process.env.AUTHORIZED_MARKET || '[]')

    markets = markets.filter((el) => 
          el.marketType === "PERP" && 
          el.orderBookState === "Open" && 
          (AUTHORIZED_MARKET.length === 0 || AUTHORIZED_MARKET.includes(el.symbol))).map((el) => {
          
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

    const makerFee = parseFloat(Accounts.futuresMakerFee) / 10000
    const leverage = parseInt(Accounts.leverageLimit)
    const netEquityAvailable = parseFloat(Collateral.netEquityAvailable)
    const capitalAvailable = netEquityAvailable * leverage * 0.95
    
    // Log explicativo do cálculo do capital (apenas na primeira vez)
    if (!this.capitalLogged) {
      console.log(`\n📊 CÁLCULO DO CAPITAL:
   • Patrimônio Líquido Disponível: $${netEquityAvailable.toFixed(2)}
   • Alavancagem: ${leverage}x
   • Margem de segurança: 95%
   • Capital disponível: $${netEquityAvailable.toFixed(2)} × ${leverage} × 0.95 = $${capitalAvailable.toFixed(2)}`);
      this.capitalLogged = true;
    }
    
    // Usa configuração passada como parâmetro (prioridade) ou fallback para variável de ambiente
    const maxOpenOrders = config?.limitOrder || parseInt(process.env.LIMIT_ORDER)
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
      console.error('❌ AccountController.get - Error:', error.message)
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

  /**
   * Reseta os logs para permitir nova exibição
   */
  resetLogs() {
    this.capitalLogged = false;
  }

}

export default new AccountController();


