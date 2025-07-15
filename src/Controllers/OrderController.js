import Order from '../Backpack/Authenticated/Order.js';
import Futures from '../Backpack/Authenticated/Futures.js';
import AccountController from './AccountController.js';
import Utils from '../utils/Utils.js';
import Markets from '../Backpack/Public/Markets.js';

class OrderController {

  // Armazena ordens de entrada pendentes para monitoramento POR CONTA (apenas estratégia PRO_MAX)
  static pendingEntryOrdersByAccount = {};

  /**
   * Adiciona ordem de entrada para monitoramento (apenas estratégia PRO_MAX)
   * @param {string} market - Símbolo do mercado
   * @param {object} orderData - Dados da ordem (stop, isLong, etc.)
   * @param {string} accountId - ID da conta (ex: CONTA1, CONTA2)
   */
  static addPendingEntryOrder(market, orderData, accountId = 'DEFAULT') {
    // Inicializa o objeto da conta se não existir
    if (!OrderController.pendingEntryOrdersByAccount[accountId]) {
      OrderController.pendingEntryOrdersByAccount[accountId] = {};
    }
    
    // Remove qualquer campo targets do orderData
    const { targets, ...cleanOrderData } = orderData;
    OrderController.pendingEntryOrdersByAccount[accountId][market] = {
      ...cleanOrderData,
      addedAt: Date.now()
    };
  }

  /**
   * Remove ordem de entrada do monitoramento
   * @param {string} market - Símbolo do mercado
   * @param {string} accountId - ID da conta (ex: CONTA1, CONTA2)
   */
  static removePendingEntryOrder(market, accountId = 'DEFAULT') {
    if (OrderController.pendingEntryOrdersByAccount[accountId]) {
      delete OrderController.pendingEntryOrdersByAccount[accountId][market];
    }
  }

  /**
   * Monitora ordens de entrada pendentes e cria take profits quando executadas
   * @param {string} accountId - ID da conta para monitorar
   */
  static async monitorPendingEntryOrders(accountId = 'DEFAULT') {
    try {
      console.log(`\n🚀 [MONITOR-${accountId}] Iniciando monitoramento...`);
      
      const accountOrders = OrderController.pendingEntryOrdersByAccount[accountId];
      if (!accountOrders) {
        console.log(`📭 [MONITOR-${accountId}] Nenhuma ordem pendente para esta conta`);
        return;
      }
      
      const markets = Object.keys(accountOrders);
      if (markets.length === 0) {
        console.log(`📭 [MONITOR-${accountId}] Nenhum mercado pendente`);
        return;
      }

      // Log de debug para verificar se está monitorando
      console.log(`🔍 [MONITOR-${accountId}] Monitorando ${markets.length} ordens pendentes: ${markets.join(', ')}`);

      // Tenta obter posições com retry
      let positions = [];
      try {
        console.log(`📡 [MONITOR-${accountId}] Obtendo posições da API...`);
        positions = await Futures.getOpenPositions() || [];
        console.log(`📊 [MONITOR-${accountId}] Posições obtidas: ${positions.length} - Símbolos: ${positions.map(p => p.symbol).join(', ')}`);
      } catch (error) {
        console.warn(`⚠️ [MONITOR-${accountId}] Falha ao obter posições, continuando monitoramento...`);
        positions = [];
      }
      
      for (const market of markets) {
        const orderData = accountOrders[market];
        const position = positions.find(p => p.symbol === market && Math.abs(Number(p.netQuantity)) > 0);
        
        console.log(`🔍 [MONITOR-${accountId}] Verificando ${market}: Posição encontrada = ${position ? 'SIM' : 'NÃO'}`);
        if (position) {
          console.log(`📈 [MONITOR-${accountId}] ${market}: netQuantity = ${position.netQuantity}, avgEntryPrice = ${position.avgEntryPrice}`);
        }
        
        if (position) {
          // Posição foi aberta, delega para método dedicado
          console.log(`🎯 [${accountId}] ${market}: Ordem de entrada executada, processando TPs...`);
          await OrderController.handlePositionOpenedForProMax(market, position, orderData, accountId);
          OrderController.removePendingEntryOrder(market, accountId);
        } else {
          // Verifica se a ordem ainda existe (não foi cancelada)
          try {
            console.log(`📋 [MONITOR-${accountId}] ${market}: Obtendo ordens abertas...`);
            const openOrders = await Order.getOpenOrders(market);
            const hasEntryOrder = openOrders && openOrders.some(o => 
              !o.reduceOnly && o.orderType === 'Limit' && o.symbol === market
            );
            
            console.log(`📋 [MONITOR-${accountId}] ${market}: Ordens abertas = ${openOrders ? openOrders.length : 0}, Ordem de entrada existe = ${hasEntryOrder ? 'SIM' : 'NÃO'}`);
            
            if (!hasEntryOrder) {
              // Ordem não existe mais (foi cancelada ou executada sem posição)
              console.log(`⚠️ [${accountId}] ${market}: Ordem de entrada não encontrada, removendo do monitoramento`);
              OrderController.removePendingEntryOrder(market, accountId);
            }
          } catch (orderError) {
            console.warn(`⚠️ [MONITOR-${accountId}] Falha ao verificar ordens de ${market}, mantendo no monitoramento...`);
          }
        }
      }
      
      console.log(`✅ [MONITOR-${accountId}] Monitoramento concluído`);
    } catch (error) {
      console.error(`❌ [${accountId}] Erro no monitoramento de ordens pendentes:`, error.message);
    }
  }

  /**
   * Lógica dedicada para tratar a criação dos Take Profits após execução da ordem PRO_MAX
   */
  static async handlePositionOpenedForProMax(market, position, orderData, accountId) {
    try {
      // Busca informações do mercado
      const Account = await AccountController.get();
      const marketInfo = Account.markets.find(m => m.symbol === market);
      if (!marketInfo) {
        console.error(`❌ [PRO_MAX] Market info não encontrada para ${market}`);
        return;
      }
      const decimal_quantity = marketInfo.decimal_quantity;
      const decimal_price = marketInfo.decimal_price;
      const stepSize_quantity = marketInfo.stepSize_quantity;

      // Preço real de entrada
      const entryPrice = parseFloat(position.avgEntryPrice || position.entryPrice || position.markPrice);
      const isLong = parseFloat(position.netQuantity) > 0;
      
      // Recalcula os targets usando a estratégia PRO_MAX
      // Importa a estratégia para usar o cálculo
      const { ProMaxStrategy } = await import('../Decision/Strategies/ProMaxStrategy.js');
      const strategy = new ProMaxStrategy();
      // Para o cálculo, precisamos de dados de mercado (ATR, etc). Usamos o último candle disponível.
      // Usa o timeframe da ordem ou fallback para variável de ambiente
      const timeframe = orderData?.time || process.env.TIME || '5m';
      const candles = await Markets.getKLines(market, timeframe, 30);
      const { calculateIndicators } = await import('../Decision/Indicators.js');
      const indicators = calculateIndicators(candles);
      const data = { ...indicators, market: marketInfo, marketPrice: entryPrice };
      const action = isLong ? 'long' : 'short';
      const stopAndTargets = strategy.calculateStopAndMultipleTargets(data, entryPrice, action);
      if (!stopAndTargets) {
        console.error(`❌ [PRO_MAX] Não foi possível calcular targets para ${market}`);
        return;
      }
      const { stop, targets } = stopAndTargets;
      if (!targets || targets.length === 0) {
        console.error(`❌ [PRO_MAX] Nenhum target calculado para ${market}`);
        return;
      }

      // Quantidade total da posição
      const totalQuantity = Math.abs(Number(position.netQuantity));
      // Número máximo de TPs possíveis baseado no step size
      const maxTPs = Math.floor(totalQuantity / stepSize_quantity);
      const nTPs = Math.min(targets.length, maxTPs);
      
      if (nTPs === 0) {
        console.error(`❌ [PRO_MAX] Posição muito pequena para criar qualquer TP válido para ${market}`);
        return;
      }

      // Log explicativo quando são criadas menos ordens do que o esperado
      if (nTPs < targets.length) {
        console.log(`📊 [PRO_MAX] ${market}: Ajuste de quantidade de TPs:`);
        console.log(`   • Targets calculados: ${targets.length}`);
        console.log(`   • Tamanho da posição: ${totalQuantity}`);
        console.log(`   • Step size mínimo: ${stepSize_quantity}`);
        console.log(`   • Máximo de TPs possíveis: ${maxTPs} (${totalQuantity} ÷ ${stepSize_quantity})`);
        console.log(`   • TPs que serão criados: ${nTPs}`);
        console.log(`   • Motivo: Posição pequena não permite dividir em ${targets.length} ordens de ${stepSize_quantity} cada`);
      }

      const quantities = [];
      let remaining = totalQuantity;
      for (let i = 0; i < nTPs; i++) {
        let qty;
        if (i === nTPs - 1) {
          qty = remaining; // tudo que sobrou
        } else {
          qty = Math.floor((totalQuantity / nTPs) / stepSize_quantity) * stepSize_quantity;
          if (qty < stepSize_quantity) {
            qty = stepSize_quantity;
            // Log quando a quantidade calculada é menor que o step size
            if (nTPs < targets.length) {
              console.log(`   • TP ${i + 1}: Quantidade calculada (${(totalQuantity / nTPs).toFixed(6)}) < step size (${stepSize_quantity}), ajustado para ${stepSize_quantity}`);
            }
          }
          if (qty > remaining) qty = remaining;
        }
        quantities.push(qty);
        remaining -= qty;
      }
      // Ajusta targets para o número real de TPs
      const usedTargets = targets.slice(0, nTPs);
      const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
      const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
      console.log(`🎯 [PRO_MAX] ${market}: Criando ${nTPs} take profits. Quantidades: [${quantities.join(', ')}] (total: ${totalQuantity})`);
      // Cria ordens de take profit
      for (let i = 0; i < nTPs; i++) {
        const targetPrice = parseFloat(usedTargets[i]);
        const takeProfitTriggerPrice = (targetPrice + Number(position.markPrice)) / 2;
        const qty = quantities[i];
        const orderBody = {
          symbol: market,
          side: isLong ? 'Ask' : 'Bid',
          orderType: 'Limit',
          postOnly: true,
          reduceOnly: true,
          quantity: formatQuantity(qty),
          price: formatPrice(targetPrice),
          takeProfitTriggerBy: 'LastPrice',
          takeProfitTriggerPrice: formatPrice(takeProfitTriggerPrice),
          takeProfitLimitPrice: formatPrice(targetPrice),
          timeInForce: 'GTC',
          selfTradePrevention: 'RejectTaker',
          clientId: Math.floor(Math.random() * 1000000) + i
        };
        const result = await Order.executeOrder(orderBody);
        if (result) {
          console.log(`✅ [PRO_MAX] ${market}: Take Profit ${i + 1}/${nTPs} criado - Preço: ${targetPrice.toFixed(6)}, Quantidade: ${qty}`);
        } else {
          console.log(`⚠️ [PRO_MAX] ${market}: Take Profit ${i + 1}/${nTPs} não criado`);
        }
      }

      // Cria ordem de stop loss se necessário
      if (stop !== undefined && !isNaN(parseFloat(stop))) {
        const stopLossTriggerPrice = (Number(stop) + Number(position.markPrice)) / 2;
        const stopBody = {
          symbol: market,
          side: isLong ? 'Ask' : 'Bid',
          orderType: 'Limit',
          postOnly: true,
          reduceOnly: true,
          quantity: formatQuantity(totalQuantity),
          price: formatPrice(stop),
          stopLossTriggerBy: 'LastPrice',
          stopLossTriggerPrice: formatPrice(stopLossTriggerPrice),
          stopLossLimitPrice: formatPrice(stop),
          timeInForce: 'GTC',
          selfTradePrevention: 'RejectTaker',
          clientId: Math.floor(Math.random() * 1000000) + 9999
        };
        const stopResult = await Order.executeOrder(stopBody);
        if (stopResult) {
          // console.log(`🛡️ [PRO_MAX] ${market}: Stop loss criado - Preço: ${stop.toFixed(6)}`);
        }
      }
    } catch (error) {
      console.error(`❌ [PRO_MAX] Erro ao processar posição aberta para ${market}:`, error.message);
    }
  }

  /**
   * Valida se há margem suficiente para abrir uma ordem
   * @param {string} market - Símbolo do mercado
   * @param {number} volume - Volume em USD
   * @param {object} accountInfo - Informações da conta
   * @returns {object} - { isValid: boolean, message: string }
   */
  async validateMargin(market, volume, accountInfo) {
    try {
      // Obtém posições abertas para calcular margem em uso
      const positions = await Futures.getOpenPositions();
      const currentPosition = positions?.find(p => p.symbol === market);
      
      // Calcula margem necessária para a nova ordem (volume / leverage)
      const requiredMargin = volume / accountInfo.leverage;
      
      // Calcula margem já em uso
      let usedMargin = 0;
      if (positions && positions.length > 0) {
        usedMargin = positions.reduce((total, pos) => {
          const positionValue = Math.abs(parseFloat(pos.netQuantity) * parseFloat(pos.markPrice));
          return total + positionValue;
        }, 0);
      }
      
      // Margem disponível (com margem de segurança de 95%)
      const availableMargin = accountInfo.capitalAvailable * 0.95;
      const remainingMargin = availableMargin - usedMargin;
      
      // Verifica se há margem suficiente
      if (requiredMargin > remainingMargin) {
        return {
          isValid: false,
          message: `Necessário: $${requiredMargin.toFixed(2)}, Disponível: $${remainingMargin.toFixed(2)}, Em uso: $${usedMargin.toFixed(2)}`
        };
      }
      
      return {
        isValid: true,
        message: `Margem OK - Disponível: $${remainingMargin.toFixed(2)}, Necessário: $${requiredMargin.toFixed(2)}`
      };
      
    } catch (error) {
      console.error('❌ Erro na validação de margem:', error.message);
      return {
        isValid: false,
        message: `Erro ao validar margem: ${error.message}`
      };
    }
  }

  async cancelPendingOrders(symbol) {
    try {
      // Obtém ordens abertas para o símbolo
      const openOrders = await Order.getOpenOrders(symbol);
      
      if (!openOrders || openOrders.length === 0) {
        console.log(`📭 Nenhuma ordem pendente para ${symbol}`);
        return true;
      }

      // Cancela todas as ordens pendentes
      const cancelResult = await Order.cancelOpenOrders(symbol);
      
      if (cancelResult) {
        console.log(`🗑️ ${openOrders.length} ordens canceladas para ${symbol}`);
        return true;
      } else {
        console.error(`❌ Falha ao cancelar ordens para ${symbol}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Erro ao cancelar ordens para ${symbol}:`, error.message);
      return false;
    }
  }

  async forceClose(position) {
    const Account = await AccountController.get()
    const market = Account.markets.find((el) => {
        return el.symbol === position.symbol
    })
    const isLong = parseFloat(position.netQuantity) > 0;
    const quantity = Math.abs(parseFloat(position.netQuantity));
    const decimal = market.decimal_quantity

    const body = {
        symbol: position.symbol,
        orderType: 'Market',
        side: isLong ? 'Ask' : 'Bid', // Ask if LONG , Bid if SHORT
        reduceOnly: true, 
        clientId: Math.floor(Math.random() * 1000000),
        quantity:String(quantity.toFixed(decimal))
    };

    // Fecha a posição
    const closeResult = await Order.executeOrder(body);
    
    // Cancela ordens pendentes para este símbolo
    if (closeResult) {
      await this.cancelPendingOrders(position.symbol);
    }

    return closeResult;
  }

  /**
   * Realiza take profit parcial de uma posição
   * @param {object} position - Dados da posição
   * @param {number} partialPercentage - Porcentagem da posição para realizar
   * @returns {boolean} - Sucesso da operação
   */
  async takePartialProfit(position, partialPercentage = 50) {
    try {
      const Account = await AccountController.get()
      const market = Account.markets.find((el) => {
          return el.symbol === position.symbol
      })
      
      const isLong = parseFloat(position.netQuantity) > 0;
      const totalQuantity = Math.abs(parseFloat(position.netQuantity));
      const partialQuantity = (totalQuantity * partialPercentage) / 100;
      const decimal = market.decimal_quantity

      const body = {
          symbol: position.symbol,
          orderType: 'Market',
          side: isLong ? 'Ask' : 'Bid', // Ask if LONG , Bid if SHORT
          reduceOnly: true, 
          clientId: Math.floor(Math.random() * 1000000),
          quantity: String(partialQuantity.toFixed(decimal))
      };

      // console.log(`💰 ${position.symbol}: Realizando take profit parcial de ${partialPercentage}% (${partialQuantity.toFixed(decimal)} de ${totalQuantity.toFixed(decimal)})`);

      // Realiza o take profit parcial
      const partialResult = await Order.executeOrder(body);
      
      if (partialResult) {
        // console.log(`✅ ${position.symbol}: Take profit parcial realizado com sucesso`);
        return true;
      } else {
        // console.error(`❌ ${position.symbol}: Falha ao realizar take profit parcial`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Erro ao realizar take profit parcial para ${position.symbol}:`, error.message);
      return false;
    }
  }

  async openOrder({ entry, stop, target, action, market, volume, decimal_quantity, decimal_price, stepSize_quantity, accountId = 'DEFAULT' }) {
    try {
    const isLong = action === "long";
    const side = isLong ? "Bid" : "Ask";
    const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
    const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
    const entryPrice = parseFloat(entry);
    // Obtém informações da conta e mercado
    const marketInfo = await AccountController.get();
    if (!marketInfo) {
      console.error(`❌ Não foi possível obter informações da conta para ${market}`);
      return false;
    }
    const currentMarket = marketInfo?.markets?.find(m => m.symbol === market);
    const tickSize = currentMarket?.tickSize || 0.0001;
    // Validação de margem antes de tentar abrir a ordem
    const marginValidation = await this.validateMargin(market, volume, marketInfo);
    if (!marginValidation.isValid) {
      // console.warn(`⚠️ [${accountId}] MARGEM INSUFICIENTE: ${market} - ${marginValidation.message}`);
      return false;
    }
    // Obtém o preço atual do mercado para usar como referência
    const markPrices = await Markets.getAllMarkPrices(market);
    const currentMarketPrice = parseFloat(markPrices[0]?.markPrice || entryPrice);
    // Calcula a diferença percentual entre o preço de entrada e o preço atual
    const priceDiff = Math.abs(entryPrice - currentMarketPrice) / currentMarketPrice;
    // Ajusta o multiplicador baseado na volatilidade
    let tickMultiplier = 20; // Base mais conservador
    if (priceDiff < 0.001) { tickMultiplier = 30; }
    else if (priceDiff < 0.005) { tickMultiplier = 25; }
    // Usa o preço de mercado atual como base para evitar rejeições
    let adjustedPrice;
    if (isLong) {
      adjustedPrice = currentMarketPrice - (tickSize * tickMultiplier);
    } else {
      adjustedPrice = currentMarketPrice + (tickSize * tickMultiplier);
    }
    const quantity = formatQuantity(Math.floor((volume / adjustedPrice) / stepSize_quantity) * stepSize_quantity);
    const price = formatPrice(adjustedPrice);
    // Log do ajuste de preço
    // console.log(`💰 [${accountId}] ${market}: Preço estratégia ${entryPrice.toFixed(6)} → Preço mercado ${currentMarketPrice.toFixed(6)} → Ajustado ${adjustedPrice.toFixed(6)} (${isLong ? 'BID' : 'ASK'}) [Diff: ${(priceDiff * 100).toFixed(3)}%]`);
    const body = {
      symbol: market,
      side,
      orderType: "Limit",
      postOnly: true,  
      quantity,
      price,
      timeInForce: "GTC",
      selfTradePrevention: "RejectTaker"
    };
    const stopLossTriggerPrice = (Number(stop) + Number(price)) / 2 
    // Estratégia PRO_MAX: adiciona para monitoramento e cria apenas a ordem de entrada
    // Verifica se é estratégia PRO_MAX baseado no accountId ou configuração da conta
    const isProMaxStrategy = accountId.includes('PRO_MAX') || accountId === 'CONTA2';
    if (isProMaxStrategy) {
      OrderController.addPendingEntryOrder(market, {
        stop,
        isLong,
        decimal_quantity,
        decimal_price,
        stepSize_quantity
      }, accountId);
      console.log(`📋 [${accountId}] ${market}: Ordem de entrada adicionada ao monitoramento (estratégia PRO_MAX)`);
    } else if (target !== undefined && !isNaN(parseFloat(target))) {
      // Fallback para target único (estratégia DEFAULT)
      const takeProfitTriggerPrice = (Number(target) + Number(price)) / 2;
      body.takeProfitTriggerBy = "LastPrice";
      body.takeProfitTriggerPrice = formatPrice(takeProfitTriggerPrice);
      body.takeProfitLimitPrice = formatPrice(target);
      // console.log(`🎯 [${accountId}] ${market}: Take Profit configurado - Target: ${target.toFixed(6)}, Trigger: ${takeProfitTriggerPrice.toFixed(6)}`);
    } else {
      // console.log(`⚠️ [${accountId}] ${market}: Take Profit não configurado - Target: ${target}`);
    }
    if (stop !== undefined && !isNaN(parseFloat(stop))) {
      body.stopLossTriggerBy = "LastPrice";
      body.stopLossTriggerPrice = formatPrice(stopLossTriggerPrice);
      body.stopLossLimitPrice = formatPrice(stop);
    }
    if(body.quantity > 0 && body.price > 0){
      const result = await Order.executeOrder(body);
      if (!result) {
        // console.log(`⚠️ [${accountId}] Tentando ordem com preço mais conservador para ${market}`);
        const moreConservativePrice = isLong 
          ? currentMarketPrice - (tickSize * (tickMultiplier + 15))
          : currentMarketPrice + (tickSize * (tickMultiplier + 15));
        body.price = formatPrice(moreConservativePrice);
        // console.log(`💰 [${accountId}] ${market}: Novo preço ${moreConservativePrice.toFixed(6)}`);
        const retryResult = await Order.executeOrder(body);
        if (retryResult) {
          // console.log(`✅ [${accountId}] executeOrder Success! ${market}`);
        } else {
          // console.error(`❌ [${accountId}] executeOrder - Error! ${market}`);
        }
        return retryResult;
      }
      // console.log(`✅ [${accountId}] executeOrder Success! ${market}`);
      return result;
    }
    // console.error(`❌ [${accountId}] ${market}: Quantidade (${body.quantity}) ou preço (${body.price}) inválidos`);
    return false;
    } catch (error) {
      console.error(`❌ [${accountId}] OrderController.openOrder - Error:`, error.message);
      return false;
    }
  }

  async getRecentOpenOrders(market) {
    const orders = await Order.getOpenOrders(market)
    const orderShorted = orders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return orderShorted.map((el) => {
        return {
            id: el.id,
            minutes: Utils.minutesAgo(el.createdAt),
            triggerPrice: parseFloat(el.triggerPrice),
            price: parseFloat(el.price)
        }
    })
  }

  async getAllOrdersSchedule(markets_open) {
    const orders = await Order.getOpenOrders()
    const orderShorted = orders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const list = orderShorted.map((el) => {
        return {
            id: el.id,
            minutes: Utils.minutesAgo(el.createdAt),
            triggerPrice: parseFloat(el.triggerPrice),
            symbol: el.symbol
        }
    })

    return list.filter((el) => !markets_open.includes(el.symbol)) 
  }

  async createStopTS({ symbol, price, isLong, quantity }) {

  const Account = await AccountController.get();
  const find = Account.markets.find(el => el.symbol === symbol);

  if (!find) throw new Error(`Symbol ${symbol} not found in account data`);

  const decimal_quantity = find.decimal_quantity;
  const decimal_price = find.decimal_price;
  const tickSize = find.tickSize * 10

  if (price <= 0) throw new Error("Invalid price: must be > 0");

  price = Math.abs(price); 
  
  const triggerPrice = isLong ? price - tickSize : price + tickSize  
  const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
  const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
  const body = {
    symbol,
    orderType: 'Limit',
    side: isLong ? 'Ask' : 'Bid',
    reduceOnly: true,
    postOnly: true,  
    timeInForce: 'GTC',
    selfTradePrevention: "RejectTaker",
    price: formatPrice(price),
    triggerBy: 'LastPrice',
    triggerPrice: formatPrice(triggerPrice),
    triggerQuantity: formatQuantity(quantity),
  };

  return await Order.executeOrder(body);
  }

}

export default new OrderController();
export { OrderController };


