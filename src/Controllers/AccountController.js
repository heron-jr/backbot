import Markets from '../Backpack/Public/Markets.js'
import Account from '../Backpack/Authenticated/Account.js';
import Capital from '../Backpack/Authenticated/Capital.js';

class AccountController {

  // Propriedades estáticas para gerenciar o cache
  static accountCache = null;
  static lastCacheTime = 0;
  static cacheDuration = 10000; // 10 segundos em milissegundos
  static capitalLogged = false; // Movido para estático para funcionar com cache

  async get(config = null) {
    
    const now = Date.now();
    
    // 1. VERIFICA O CACHE
    if (AccountController.accountCache && (now - AccountController.lastCacheTime < AccountController.cacheDuration)) {
      // Retorna os dados do cache silenciosamente
      return AccountController.accountCache;
    }
    
    try {
    
    // 2. LÓGICA EXISTENTE (SE O CACHE FOR INVÁLIDO)
    // Determina a estratégia baseada na configuração ou variável de ambiente
    const strategy = config?.strategy || process.env.TRADING_STRATEGY || 'DEFAULT';
    
    const Accounts = await Account.getAccount(strategy)
    const Collateral = await Capital.getCollateral(strategy)

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
    
    // Log para debug (apenas quando não está usando cache)
    console.log(`🔍 [ACCOUNT] AUTHORIZED_MARKET: ${JSON.stringify(AUTHORIZED_MARKET)}`);
    console.log(`🔍 [ACCOUNT] Total de markets antes do filtro: ${markets.length}`);

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
    if (!AccountController.capitalLogged) {
      console.log(`\n📊 CÁLCULO DO CAPITAL:
   • Patrimônio Líquido Disponível: $${netEquityAvailable.toFixed(2)}
   • Alavancagem: ${leverage}x
   • Margem de segurança: 95%
   • Capital disponível: $${netEquityAvailable.toFixed(2)} × ${leverage} × 0.95 = $${capitalAvailable.toFixed(2)}`);
      AccountController.capitalLogged = true;
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

    // 3. SALVA NO CACHE ANTES DE RETORNAR
    AccountController.accountCache = obj;
    AccountController.lastCacheTime = now;
    
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
    AccountController.capitalLogged = false;
  }

  /**
   * Limpa o cache forçando uma nova busca de dados
   */
  static clearCache() {
    AccountController.accountCache = null;
    AccountController.lastCacheTime = 0;
    console.log(`🔄 [ACCOUNT] Cache limpo - próxima chamada buscará dados frescos`);
  }

  /**
   * Obtém informações sobre o estado do cache
   */
  static getCacheInfo() {
    const now = Date.now();
    const timeSinceLastCache = now - AccountController.lastCacheTime;
    const isCacheValid = AccountController.accountCache && (timeSinceLastCache < AccountController.cacheDuration);
    
    return {
      hasCache: !!AccountController.accountCache,
      isCacheValid: isCacheValid,
      timeSinceLastCache: timeSinceLastCache,
      cacheDuration: AccountController.cacheDuration,
      remainingTime: Math.max(0, AccountController.cacheDuration - timeSinceLastCache)
    };
  }

}

export default new AccountController();


