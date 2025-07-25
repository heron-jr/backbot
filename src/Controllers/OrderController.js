import Order from '../Backpack/Authenticated/Order.js';
import Futures from '../Backpack/Authenticated/Futures.js';
import AccountController from './AccountController.js';
import Utils from '../utils/Utils.js';
import Markets from '../Backpack/Public/Markets.js';
import TrailingStop from '../TrailingStop/TrailingStop.js';

class OrderController {

  // Armazena ordens de entrada pendentes para monitoramento POR CONTA (apenas estratégia PRO_MAX)
  static pendingEntryOrdersByAccount = {};

  // Contador estático para evitar loop infinito
  static stopLossAttempts = null;
  
  // Cache para posições que já têm stop loss validado
  static validatedStopLossPositions = new Set();

  /**
   * Adiciona ordem de entrada para monitoramento (apenas estratégia PRO_MAX)
   * @param {string} market - Símbolo do mercado
   * @param {object} orderData - Dados da ordem (stop, isLong, etc.)
   * @param {string} accountId - ID da conta (ex: CONTA1, CONTA2)
   */
  static addPendingEntryOrder(market, orderData, accountId = 'DEFAULT') {
    if (!OrderController.pendingEntryOrdersByAccount[accountId]) {
      OrderController.pendingEntryOrdersByAccount[accountId] = {};
    }
    // Adiciona timestamp de criação da ordem
    const orderDataWithTimestamp = {
      ...orderData,
      createdAt: Date.now()
    };
    OrderController.pendingEntryOrdersByAccount[accountId][market] = orderDataWithTimestamp;
    console.log(`\n[MONITOR-${accountId}] Ordem registrada para monitoramento: ${market}`);
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
    // Executa para todas as estratégias (DEFAULT e PRO_MAX)
    // A lógica de timeout de ordens é aplicada para todas as contas
    try {
      // Define as variáveis de ambiente corretas baseado no accountId
      if (accountId === 'CONTA2') {
        process.env.API_KEY = process.env.ACCOUNT2_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT2_API_SECRET;
      } else {
        process.env.API_KEY = process.env.ACCOUNT1_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT1_API_SECRET;
      }
      
      const accountOrders = OrderController.pendingEntryOrdersByAccount[accountId];
      if (!accountOrders) {
        // Mesmo sem ordens pendentes, verifica se há posições abertas que precisam de alvos
        await OrderController.checkForUnmonitoredPositions(accountId);
        return;
      }
      
      const markets = Object.keys(accountOrders);
      if (markets.length === 0) {
        // Mesmo sem ordens pendentes, verifica se há posições abertas que precisam de alvos
        await OrderController.checkForUnmonitoredPositions(accountId);
        return;
      }

      // Tenta obter posições com retry
      let positions = [];
      try {
        positions = await Futures.getOpenPositions() || [];
        
        if (positions.length > 0) {
          // Verifica se há posições que não estão sendo monitoradas
          const monitoredMarkets = Object.keys(accountOrders || {});
          const unmonitoredPositions = positions.filter(pos => !monitoredMarkets.includes(pos.symbol));
          
          if (unmonitoredPositions.length > 0) {
            // Força criação de alvos para posições não monitoradas
            for (const position of unmonitoredPositions) {
              await OrderController.forceCreateTargetsForExistingPosition(position, accountId);
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ [MONITOR-${accountId}] Falha ao obter posições, continuando monitoramento...`);
        console.error(`❌ [MONITOR-${accountId}] Erro detalhado:`, error.message);
        positions = [];
      }
      
      for (const market of markets) {
        const orderData = accountOrders[market];
        const position = positions.find(p => p.symbol === market && Math.abs(Number(p.netQuantity)) > 0);
        
        if (position) {
          // Log detalhado de taxa total e PnL atual
          const Account = await AccountController.get();
          const marketInfo = Account.markets.find(m => m.symbol === market);
          const fee = marketInfo.fee || process.env.FEE || 0.0004;
          const entryPrice = parseFloat(position.avgEntryPrice || position.entryPrice || position.markPrice);
          const currentPrice = parseFloat(position.markPrice);
          const quantity = Math.abs(Number(position.netQuantity));
          const orderValue = entryPrice * quantity;
          const exitValue = currentPrice * quantity;
          const entryFee = orderValue * fee;
          const exitFee = exitValue * fee;
          const totalFee = entryFee + exitFee;
          
          // Usa a função calculatePnL do TrailingStop para calcular o PnL corretamente
          const leverage = Account.leverage;
          const { pnl, pnlPct } = TrailingStop.calculatePnL(position, leverage);
          
          console.log(`[MONITOR][${accountId}] ${market} | Taxa total estimada (entrada+saída): $${totalFee.toFixed(6)} | PnL atual: $${pnl.toFixed(6)} | PnL%: ${pnlPct.toFixed(3)}%`);
          // Posição foi aberta, delega para método dedicado
          await OrderController.handlePositionOpenedForProMax(market, position, orderData, accountId);
          OrderController.removePendingEntryOrder(market, accountId);
        } else {
          // Verifica timeout da ordem (10 minutos)
          const ORDER_TIMEOUT_MINUTES = Number(process.env.ORDER_TIMEOUT_MINUTES || 10);
          const orderAgeMinutes = (Date.now() - orderData.createdAt) / (1000 * 60);
          
          if (orderAgeMinutes >= ORDER_TIMEOUT_MINUTES) {
            console.log(`⏰ [MONITOR-${accountId}] ${market}: Ordem expirou após ${orderAgeMinutes.toFixed(1)} minutos (limite: ${ORDER_TIMEOUT_MINUTES} min)`);
            
            try {
              // Cancela apenas ordens de entrada (não reduceOnly)
              const openOrders = await Order.getOpenOrders(market);
              const entryOrders = openOrders && openOrders.filter(o => {
                // IMPORTANTE: Só cancela ordens de ENTRADA (não reduceOnly)
                const isEntryOrder = !o.reduceOnly;
                const isLimitOrder = o.orderType === 'Limit';
                const isCorrectSymbol = o.symbol === market;
                const isNotStopLoss = !o.stopLossTriggerPrice && !o.stopLossLimitPrice;
                const isNotTakeProfit = !o.takeProfitTriggerPrice && !o.takeProfitLimitPrice;
                const isPending = o.status === 'Pending' || o.status === 'New' || o.status === 'PartiallyFilled';
                
                // Só cancela se for ordem de entrada (não reduceOnly) e não for stop/take profit
                return isEntryOrder && isLimitOrder && isCorrectSymbol && isNotStopLoss && isNotTakeProfit && isPending;
              });
              
              if (entryOrders && entryOrders.length > 0) {
                console.log(`🔄 [MONITOR-${accountId}] ${market}: Cancelando ${entryOrders.length} ordem(ns) de entrada antiga(s) (ordens reduceOnly não são afetadas)`);
                
                // Cancela todas as ordens de entrada antigas
                const cancelPromises = entryOrders.map(order => 
                  Order.cancelOpenOrder(market, order.orderId, order.clientId)
                );
                
                await Promise.all(cancelPromises);
                console.log(`✅ [MONITOR-${accountId}] ${market}: Ordens antigas canceladas com sucesso`);
                
                // Remove do monitoramento
                OrderController.removePendingEntryOrder(market, accountId);
              } else {
                console.log(`ℹ️ [MONITOR-${accountId}] ${market}: Nenhuma ordem encontrada para cancelar`);
                OrderController.removePendingEntryOrder(market, accountId);
              }
            } catch (cancelError) {
              console.error(`❌ [MONITOR-${accountId}] ${market}: Erro ao cancelar ordens antigas:`, cancelError.message);
            }
          } else {
            // Verifica se a ordem ainda existe (não foi cancelada)
            try {
              const openOrders = await Order.getOpenOrders(market);
              const hasEntryOrder = openOrders && openOrders.some(o => {
                const isEntryOrder = !o.reduceOnly;
                const isLimitOrder = o.orderType === 'Limit';
                const isCorrectSymbol = o.symbol === market;
                const isNotStopLoss = !o.stopLossTriggerPrice && !o.stopLossLimitPrice;
                const isNotTakeProfit = !o.takeProfitTriggerPrice && !o.takeProfitLimitPrice;
                const isPending = o.status === 'Pending' || o.status === 'New' || o.status === 'PartiallyFilled';
                return isEntryOrder && isLimitOrder && isCorrectSymbol && isNotStopLoss && isNotTakeProfit && isPending;
              });
              if (!hasEntryOrder) {
                OrderController.removePendingEntryOrder(market, accountId);
              }
            } catch (orderError) {
              console.warn(`⚠️ [MONITOR-${accountId}] Falha ao verificar ordens de ${market}, mantendo no monitoramento...`);
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ [${accountId}] Erro no monitoramento de ordens pendentes:`, error.message);
    }
  }

  /**
   * Verifica se há posições abertas que não estão sendo monitoradas
   */
  static async checkForUnmonitoredPositions(accountId) {
    try {
      // Define as variáveis de ambiente corretas baseado no accountId
      if (accountId === 'CONTA2') {
        process.env.API_KEY = process.env.ACCOUNT2_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT2_API_SECRET;
      } else {
        process.env.API_KEY = process.env.ACCOUNT1_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT1_API_SECRET;
      }

      const positions = await Futures.getOpenPositions() || [];
      
      if (positions.length === 0) {
        return;
      }
      // Logar todas as posições abertas (monitoradas ou não)
      for (const position of positions) {
        const Account = await AccountController.get();
        const marketInfo = Account.markets.find(m => m.symbol === position.symbol);
        const fee = marketInfo.fee || process.env.FEE || 0.0004;
        const entryPrice = parseFloat(position.avgEntryPrice || position.entryPrice || position.markPrice);
        const currentPrice = parseFloat(position.markPrice);
        const quantity = Math.abs(Number(position.netQuantity));
        const orderValue = entryPrice * quantity;
        const exitValue = currentPrice * quantity;
        const entryFee = orderValue * fee;
        const exitFee = exitValue * fee;
        const totalFee = entryFee + exitFee;
        
        // Usa a função calculatePnL do TrailingStop para calcular o PnL corretamente
        const leverage = Account.leverage;
        const { pnl, pnlPct } = TrailingStop.calculatePnL(position, leverage);
        
        const percentFee = orderValue > 0 ? (totalFee / orderValue) * 100 : 0;
        console.log(`[MONITOR][ALL] ${position.symbol} | Volume: $${orderValue.toFixed(2)} | Taxa total estimada (entrada+saída): $${totalFee.toFixed(6)} (≈ ${percentFee.toFixed(2)}%) | PnL atual: $${pnl.toFixed(6)} | PnL%: ${pnlPct.toFixed(3)}%`);
      }
      
      // Verifica se há posições que não estão sendo monitoradas
      const accountOrders = OrderController.pendingEntryOrdersByAccount[accountId] || {};
      const monitoredMarkets = Object.keys(accountOrders);
      const unmonitoredPositions = positions.filter(pos => !monitoredMarkets.includes(pos.symbol));
      
      if (unmonitoredPositions.length > 0) {
        // Verifica se já foram criados alvos para essas posições (evita loop infinito)
        for (const position of unmonitoredPositions) {
          // Verifica se já existem ordens de take profit para esta posição
          const existingOrders = await Order.getOpenOrders(position.symbol);
          const hasTakeProfitOrders = existingOrders && existingOrders.some(order => 
            order.takeProfitTriggerPrice || order.takeProfitLimitPrice
          );
          
          if (hasTakeProfitOrders) {
            // Verifica se já validamos o stop loss desta posição
            const positionKey = `${accountId}_${position.symbol}`;
            if (!OrderController.validatedStopLossPositions.has(positionKey)) {
              // Mesmo com take profits, valida se existe stop loss
              await OrderController.validateAndCreateStopLoss(position, accountId);
            }
            continue;
          }
          
          await OrderController.forceCreateTargetsForExistingPosition(position, accountId);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ [MONITOR-${accountId}] Falha ao verificar posições não monitoradas:`, error.message);
    }
  }

  /**
   * Lógica dedicada para tratar a criação dos Take Profits após execução da ordem PRO_MAX
   */
  static async handlePositionOpenedForProMax(market, position, orderData, accountId) {
    // Só executa para contas PRO_MAX
    if (accountId !== 'CONTA2' && !accountId.includes('PRO_MAX')) {
      return;
    }
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
      
      // Limita pelo número máximo de ordens de take profit definido no .env
      const maxTakeProfitOrders = parseInt(process.env.MAX_TAKE_PROFIT_ORDERS) || 5;
      const finalTPs = Math.min(nTPs, maxTakeProfitOrders);
      
      if (finalTPs === 0) {
        console.error(`❌ [PRO_MAX] Posição muito pequena para criar qualquer TP válido para ${market}`);
        return;
      }

      // Log explicativo quando são criadas menos ordens do que o esperado
      if (finalTPs < targets.length) {
        console.log(`📊 [PRO_MAX] ${market}: Ajuste de quantidade de TPs:`);
        console.log(`   • Targets calculados: ${targets.length}`);
        console.log(`   • Tamanho da posição: ${totalQuantity}`);
        console.log(`   • Step size mínimo: ${stepSize_quantity}`);
        console.log(`   • Máximo de TPs possíveis: ${maxTPs} (${totalQuantity} ÷ ${stepSize_quantity})`);
        console.log(`   • Limite configurado: ${maxTakeProfitOrders} (MAX_TAKE_PROFIT_ORDERS)`);
        console.log(`   • TPs que serão criados: ${finalTPs}`);
        if (finalTPs < nTPs) {
          console.log(`   • Motivo: Limitado pela configuração MAX_TAKE_PROFIT_ORDERS=${maxTakeProfitOrders}`);
        } else {
          console.log(`   • Motivo: Posição pequena não permite dividir em ${targets.length} ordens de ${stepSize_quantity} cada`);
        }
      }

      const quantities = [];
      let remaining = totalQuantity;
      
      // Para posições pequenas, tenta criar pelo menos 3 alvos se possível
      const minTargets = Math.min(3, targets.length);
      const actualTargets = Math.max(finalTPs, minTargets);
      
      for (let i = 0; i < actualTargets; i++) {
        let qty;
        if (i === actualTargets - 1) {
          qty = remaining; // tudo que sobrou
        } else {
          // Para posições pequenas, divide igualmente
          qty = Math.floor((totalQuantity / actualTargets) / stepSize_quantity) * stepSize_quantity;
          if (qty < stepSize_quantity) {
            qty = stepSize_quantity;
            // Log quando a quantidade calculada é menor que o step size
            if (actualTargets < targets.length) {
              console.log(`   • TP ${i + 1}: Quantidade calculada (${(totalQuantity / actualTargets).toFixed(6)}) < step size (${stepSize_quantity}), ajustado para ${stepSize_quantity}`);
            }
          }
          if (qty > remaining) qty = remaining;
        }
        quantities.push(qty);
        remaining -= qty;
      }
      
      // Ajusta targets para o número real de TPs
      const usedTargets = targets.slice(0, actualTargets);
      const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
      const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
      console.log(`🎯 [PRO_MAX] ${market}: Criando ${actualTargets} take profits. Quantidades: [${quantities.join(', ')}] (total: ${totalQuantity})`);
      // Cria ordens de take profit
      for (let i = 0; i < actualTargets; i++) {
        const targetPrice = parseFloat(usedTargets[i]);
        const takeProfitTriggerPrice = targetPrice;
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
        if (result && !result.error) {
          console.log(`✅ [PRO_MAX] ${market}: Take Profit ${i + 1}/${actualTargets} criado - Preço: ${targetPrice.toFixed(6)}, Quantidade: ${qty}, OrderID: ${result.orderId || 'N/A'}`);
        } else {
          console.log(`❌ [PRO_MAX] ${market}: Take Profit ${i + 1}/${actualTargets} FALHOU - Preço: ${targetPrice.toFixed(6)}, Quantidade: ${qty}, Motivo: ${result?.error || 'desconhecido'}`);
        }
      }

      // Cria ordem de stop loss simples se necessário
      if (stop !== undefined && !isNaN(parseFloat(stop))) {
        const stopBody = {
          symbol: market,
          side: isLong ? 'Ask' : 'Bid', // Para LONG, vende (Ask) para fechar. Para SHORT, compra (Bid) para fechar
          orderType: 'Limit',
          postOnly: true,
          reduceOnly: true,
          quantity: formatQuantity(totalQuantity),
          price: formatPrice(stop),
          timeInForce: 'GTC',
          clientId: Math.floor(Math.random() * 1000000) + 9999
        };
        const stopResult = await Order.executeOrder(stopBody);
        
        if (stopResult && !stopResult.error) {
          console.log(`🛡️ [PRO_MAX] ${market}: Stop loss criado - Preço: ${stop.toFixed(6)}, Quantidade: ${totalQuantity}`);
        } else {
          console.log(`⚠️ [PRO_MAX] ${market}: Não foi possível criar stop loss. Motivo: ${stopResult && stopResult.error ? stopResult.error : 'desconhecido'}`);
        }
      }

      // Valida se existe stop loss e cria se necessário
      await OrderController.validateAndCreateStopLoss(position, accountId);
    } catch (error) {
      console.error(`❌ [PRO_MAX] Erro ao processar posição aberta para ${market}:`, error.message);
    }
  }

  /**
   * Força a criação de alvos para posições já abertas que não foram monitoradas
   */
  static async forceCreateTargetsForExistingPosition(position, accountId) {
    // Só executa para contas PRO_MAX
    if (accountId !== 'CONTA2' && !accountId.includes('PRO_MAX')) {
      return;
    }
    try {
      // Define as variáveis de ambiente corretas baseado no accountId
      if (accountId === 'CONTA2') {
        process.env.API_KEY = process.env.ACCOUNT2_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT2_API_SECRET;
      } else {
        process.env.API_KEY = process.env.ACCOUNT1_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT1_API_SECRET;
      }
      
      // Busca informações do mercado
      const Account = await AccountController.get();
      const marketInfo = Account.markets.find(m => m.symbol === position.symbol);
      if (!marketInfo) {
        console.error(`❌ [PRO_MAX] Market info não encontrada para ${position.symbol}`);
        return;
      }
      
      const decimal_quantity = marketInfo.decimal_quantity;
      const decimal_price = marketInfo.decimal_price;
      const stepSize_quantity = marketInfo.stepSize_quantity;

      // Preço real de entrada
      const entryPrice = parseFloat(position.avgEntryPrice || position.entryPrice || position.markPrice);
      const isLong = parseFloat(position.netQuantity) > 0;
      
      // Recalcula os targets usando a estratégia PRO_MAX
      const { ProMaxStrategy } = await import('../Decision/Strategies/ProMaxStrategy.js');
      const strategy = new ProMaxStrategy();
      
      // Usa timeframe padrão
      const timeframe = process.env.TIME || '5m';
      const candles = await Markets.getKLines(position.symbol, timeframe, 30);
      const { calculateIndicators } = await import('../Decision/Indicators.js');
      const indicators = calculateIndicators(candles);
      const data = { ...indicators, market: marketInfo, marketPrice: entryPrice };
      const action = isLong ? 'long' : 'short';
      
      const stopAndTargets = strategy.calculateStopAndMultipleTargets(data, entryPrice, action);
      if (!stopAndTargets) {
        console.error(`❌ [PRO_MAX] Não foi possível calcular targets para ${position.symbol}`);
        return;
      }
      
      const { stop, targets } = stopAndTargets;
      if (!targets || targets.length === 0) {
        console.error(`❌ [PRO_MAX] Nenhum target calculado para ${position.symbol}`);
        return;
      }

      // Quantidade total da posição
      const totalQuantity = Math.abs(Number(position.netQuantity));
      // Número máximo de TPs possíveis baseado no step size
      const maxTPs = Math.floor(totalQuantity / stepSize_quantity);
      const nTPs = Math.min(targets.length, maxTPs);
      
      // Limita pelo número máximo de ordens de take profit definido no .env
      const maxTakeProfitOrders = parseInt(process.env.MAX_TAKE_PROFIT_ORDERS) || 5;
      const finalTPs = Math.min(nTPs, maxTakeProfitOrders);
      
      if (finalTPs === 0) {
        console.error(`❌ [PRO_MAX] Posição muito pequena para criar qualquer TP válido para ${position.symbol}`);
        return;
      }

      // Log explicativo quando são criadas menos ordens do que o esperado
      if (finalTPs < targets.length) {
        console.log(`📊 [PRO_MAX] ${position.symbol}: Ajuste de quantidade de TPs:`);
        console.log(`   • Targets calculados: ${targets.length}`);
        console.log(`   • Tamanho da posição: ${totalQuantity}`);
        console.log(`   • Step size mínimo: ${stepSize_quantity}`);
        console.log(`   • Máximo de TPs possíveis: ${maxTPs} (${totalQuantity} ÷ ${stepSize_quantity})`);
        console.log(`   • Limite configurado: ${maxTakeProfitOrders} (MAX_TAKE_PROFIT_ORDERS)`);
        console.log(`   • TPs que serão criados: ${finalTPs}`);
        if (finalTPs < nTPs) {
          console.log(`   • Motivo: Limitado pela configuração MAX_TAKE_PROFIT_ORDERS=${maxTakeProfitOrders}`);
        } else {
          console.log(`   • Motivo: Posição pequena não permite dividir em ${targets.length} ordens de ${stepSize_quantity} cada`);
        }
      }

      const quantities = [];
      let remaining = totalQuantity;
      
      // Para posições pequenas, tenta criar pelo menos 3 alvos se possível
      const minTargets = Math.min(3, targets.length);
      const actualTargets = Math.max(finalTPs, minTargets);
      
      for (let i = 0; i < actualTargets; i++) {
        let qty;
        if (i === actualTargets - 1) {
          qty = remaining; // tudo que sobrou
        } else {
          // Para posições pequenas, divide igualmente
          qty = Math.floor((totalQuantity / actualTargets) / stepSize_quantity) * stepSize_quantity;
          if (qty < stepSize_quantity) {
            qty = stepSize_quantity;
            // Log quando a quantidade calculada é menor que o step size
            if (actualTargets < targets.length) {
              console.log(`   • TP ${i + 1}: Quantidade calculada (${(totalQuantity / actualTargets).toFixed(6)}) < step size (${stepSize_quantity}), ajustado para ${stepSize_quantity}`);
            }
          }
          if (qty > remaining) qty = remaining;
        }
        quantities.push(qty);
        remaining -= qty;
      }
      
      // Ajusta targets para o número real de TPs
      const usedTargets = targets.slice(0, actualTargets);
      const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
      const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
      
      console.log(`\n🎯 [PRO_MAX] ${position.symbol}: Criando ${actualTargets} take profits. Quantidades: [${quantities.join(', ')}] (total: ${totalQuantity})`);
      
      // Cria ordens de take profit
      for (let i = 0; i < actualTargets; i++) {
        const targetPrice = parseFloat(usedTargets[i]);
        const takeProfitTriggerPrice = targetPrice;
        const qty = quantities[i];
        const orderBody = {
          symbol: position.symbol,
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
        if (result && !result.error) {
          console.log(`✅ [PRO_MAX] ${position.symbol}: Take Profit ${i + 1}/${actualTargets} criado - Preço: ${targetPrice.toFixed(6)}, Quantidade: ${qty}, OrderID: ${result.orderId || 'N/A'}`);
        } else {
          console.log(`❌ [PRO_MAX] ${position.symbol}: Take Profit ${i + 1}/${actualTargets} FALHOU - Preço: ${targetPrice.toFixed(6)}, Quantidade: ${qty}, Motivo: ${result?.error || 'desconhecido'}`);
        }
      }

      // Cria ordem de stop loss se necessário
      if (stop !== undefined && !isNaN(parseFloat(stop))) {
        const stopLossTriggerPrice = Number(stop);
        const stopBody = {
          symbol: position.symbol,
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
          console.log(`🛡️ [PRO_MAX] ${position.symbol}: Stop loss criado - Preço: ${stop.toFixed(6)}`);
        }
      }
      
      // Valida se existe stop loss e cria se necessário
      await OrderController.validateAndCreateStopLoss(position, accountId);
    } catch (error) {
      console.error(`❌ [PRO_MAX] Erro ao forçar criação de alvos para ${position.symbol}:`, error.message);
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
        return true;
      }

      // Filtra apenas ordens de entrada pendentes (não ordens de stop loss ou take profit)
      const pendingEntryOrders = openOrders.filter(order => {
        // Verifica se é uma ordem pendente
        const isPending = order.status === 'Pending' || 
                         order.status === 'New' || 
                         order.status === 'PartiallyFilled';
        
        // Verifica se NÃO é uma ordem de stop loss ou take profit
        const isNotStopLoss = !order.stopLossTriggerPrice && !order.stopLossLimitPrice;
        const isNotTakeProfit = !order.takeProfitTriggerPrice && !order.takeProfitLimitPrice;
        
        // Verifica se NÃO é uma ordem reduceOnly (que são ordens de saída)
        const isNotReduceOnly = !order.reduceOnly;
        
        return isPending && isNotStopLoss && isNotTakeProfit && isNotReduceOnly;
      });

      if (pendingEntryOrders.length === 0) {
        console.log(`ℹ️ ${symbol}: Nenhuma ordem de entrada pendente encontrada para cancelar`);
        return true;
      }

      // Log detalhado das ordens que serão canceladas
      console.log(`🔍 ${symbol}: Encontradas ${pendingEntryOrders.length} ordens de entrada pendentes para cancelar:`);
      pendingEntryOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ID: ${order.orderId}, Status: ${order.status}, ReduceOnly: ${order.reduceOnly}, StopLoss: ${!!order.stopLossTriggerPrice}, TakeProfit: ${!!order.takeProfitTriggerPrice}`);
      });

      // Cancela apenas as ordens de entrada pendentes específicas
      const cancelPromises = pendingEntryOrders.map(order => 
        Order.cancelOpenOrder(symbol, order.orderId, order.clientId)
      );
      
      const cancelResults = await Promise.all(cancelPromises);
      const successfulCancels = cancelResults.filter(result => result !== null).length;
      
      if (successfulCancels > 0) {
        console.log(`🗑️ ${symbol}: ${successfulCancels} ordens de entrada pendentes canceladas com sucesso`);
        return true;
      } else {
        console.error(`❌ ${symbol}: Falha ao cancelar ordens de entrada pendentes`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Erro ao cancelar ordens de entrada pendentes para ${symbol}:`, error.message);
      return false;
    }
  }

  static async forceClose(position) {
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
    // Log detalhado da taxa de fechamento
    const fee = market.fee || process.env.FEE || 0.0004;
    // Tente obter o preço de execução real
    let closePrice = closeResult?.price || position.markPrice || position.entryPrice;
    const exitValue = parseFloat(body.quantity) * parseFloat(closePrice);
    const exitFee = exitValue * fee;
    console.log(`[LOG][FEE] Fechamento: ${position.symbol} | Valor: $${exitValue.toFixed(2)} | Fee saída: $${exitFee.toFixed(6)} (${(fee * 100).toFixed(4)}%)`);
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
  static async takePartialProfit(position, partialPercentage = 50) {
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

      // Realiza o take profit parcial
      const partialResult = await Order.executeOrder(body);
      
      if (partialResult) {
        return true;
      } else {
        return false;
      }

    } catch (error) {
      console.error(`❌ Erro ao realizar take profit parcial para ${position.symbol}:`, error.message);
      return false;
    }
  }

  // Estatísticas globais de fallback
  static fallbackCount = 0;
  static totalHybridOrders = 0;

  // Função auxiliar para calcular slippage percentual
  static calcSlippagePct(priceLimit, priceCurrent) {
    return Math.abs(priceCurrent - priceLimit) / priceLimit * 100;
  }

  // Função auxiliar para revalidar sinal (deve ser adaptada para chamar a estratégia correta)
  static async revalidateSignal({ market, accountId, originalSignalData }) {
    // Exemplo: chamar novamente a análise da estratégia
    // Aqui, apenas retorna true (mock), mas deve ser implementado conforme a lógica real
    return true;
  }

  // Função principal de execução híbrida
  static async openHybridOrder({ entry, stop, target, action, market, volume, decimal_quantity, decimal_price, stepSize_quantity, accountId = 'DEFAULT', originalSignalData }) {
    try {
      OrderController.totalHybridOrders++;
      const isLong = action === "long";
      const side = isLong ? "Bid" : "Ask";
      const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
      const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
      const entryPrice = parseFloat(entry);
      const marketInfo = await AccountController.get();
      const currentMarket = marketInfo?.markets?.find(m => m.symbol === market);
      const orderValue = volume;
      const leverage = marketInfo.leverage;
      const marginRequired = orderValue / leverage;
      const markPrices = await Markets.getAllMarkPrices(market);
      const currentMarketPrice = parseFloat(markPrices[0]?.markPrice || entryPrice);
      const tickSize = currentMarket?.tickSize || 0.0001;
      let finalPrice = formatPrice(entryPrice);
      let quantity = formatQuantity(Math.floor((orderValue / entryPrice) / stepSize_quantity) * stepSize_quantity);
      const body = {
        symbol: market,
        side,
        orderType: "Limit",
        postOnly: true,
        quantity,
        price: finalPrice,
        timeInForce: "GTC",
        selfTradePrevention: "RejectTaker"
      };
      // 1. Envia ordem LIMIT
      const limitResult = await Order.executeOrder(body);
      if (!limitResult || limitResult.error) {
        console.error(`❌ [${accountId}] ${market}: Falha ao enviar ordem LIMIT: ${limitResult && limitResult.error}`);
        return { error: limitResult && limitResult.error };
      }
      console.log(`📋 [${accountId}] ${market}: Ordem LIMIT enviada (ID: ${limitResult.id || 'N/A'}) a ${finalPrice}`);
      // 2. Monitorar execução por ORDER_EXECUTION_TIMEOUT_SECONDS
      const timeoutSec = Number(process.env.ORDER_EXECUTION_TIMEOUT_SECONDS || 12);
      let filled = false;
      for (let i = 0; i < timeoutSec; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const openOrders = await Order.getOpenOrders(market);
        const stillOpen = openOrders && openOrders.some(o => o.orderId === limitResult.orderId && (o.status === 'Pending' || o.status === 'New' || o.status === 'PartiallyFilled'));
        if (!stillOpen) {
          filled = true;
          break;
        }
      }
      if (filled) {
        console.log(`✅ [${accountId}] ${market}: Ordem LIMIT executada normalmente.`);
        return { success: true, type: 'LIMIT', limitResult };
      }
      // 3. Timeout: cancela ordem LIMIT
      await Order.cancelOpenOrder(market, limitResult.id);
      console.log(`⏰ [${accountId}] ${market}: Timeout - Ordem LIMIT não executada. Cancelada.`);
      // 4. Revalida sinal e slippage
      const signalValid = await OrderController.revalidateSignal({ market, accountId, originalSignalData });
      const markPrices2 = await Markets.getAllMarkPrices(market);
      const priceCurrent = parseFloat(markPrices2[0]?.markPrice || entryPrice);
      const slippage = OrderController.calcSlippagePct(entryPrice, priceCurrent);
      console.log(`[${accountId}] ${market}: Revalidação - Sinal: ${signalValid ? 'OK' : 'NÃO OK'} | Slippage: ${slippage.toFixed(3)}%`);
      if (!signalValid) {
        console.log(`🚫 [${accountId}] ${market}: Sinal não é mais válido. Abortando entrada.`);
        return { aborted: true, reason: 'signal' };
      }
      if (slippage > parseFloat(process.env.MAX_SLIPPAGE_PCT || 0.2)) {
        console.log(`🚫 [${accountId}] ${market}: Slippage de ${slippage.toFixed(3)}% excede o máximo permitido (${process.env.MAX_SLIPPAGE_PCT}%). Abortando entrada.`);
        return { aborted: true, reason: 'slippage' };
      }
      // 5. Fallback: envia ordem a mercado
      const marketBody = {
        symbol: market,
        side,
        orderType: "Market",
        quantity,
        timeInForce: "IOC",
        selfTradePrevention: "RejectTaker"
      };
      const marketResult = await Order.executeOrder(marketBody);
      if (marketResult && !marketResult.error) {
        OrderController.fallbackCount++;
        console.log(`⚡ [${accountId}] ${market}: Fallback - Ordem a MERCADO executada com sucesso!`);
        // Estatística de fallback
        if (OrderController.totalHybridOrders % 50 === 0) {
          const fallbackPct = (OrderController.fallbackCount / OrderController.totalHybridOrders) * 100;
          console.log(`\n[EXECUTION_STATS] ${fallbackPct.toFixed(1)}% das ordens precisaram de fallback para mercado (${OrderController.fallbackCount}/${OrderController.totalHybridOrders})`);
          if (fallbackPct > 30) {
            console.log('⚠️ Taxa de fallback alta! Considere ajustar o timeout ou o preço da LIMIT.');
          } else {
            console.log('✅ Taxa de fallback dentro do esperado.');
          }
        }
        return { success: true, type: 'MARKET', marketResult };
      } else {
        console.log(`❌ [${accountId}] ${market}: Fallback - Falha ao executar ordem a mercado: ${marketResult && marketResult.error}`);
        return { error: marketResult && marketResult.error };
      }
    } catch (error) {
      console.error(`❌ [${accountId}] ${market}: Erro no fluxo híbrido:`, error.message);
      return { error: error.message };
    }
  };

  /**
   * Método openOrder - wrapper para openHybridOrder
   * @param {object} orderData - Dados da ordem
   * @returns {object} - Resultado da execução da ordem
   */
  static async openOrder(orderData) {
    try {
      // Valida se os parâmetros obrigatórios estão presentes
      const requiredParams = ['entry', 'action', 'market', 'volume', 'decimal_quantity', 'decimal_price', 'stepSize_quantity'];
      for (const param of requiredParams) {
        if (!orderData[param]) {
          console.error(`❌ [openOrder] Parâmetro obrigatório ausente: ${param}`);
          return { error: `Parâmetro obrigatório ausente: ${param}` };
        }
      }

      // Chama o método openHybridOrder com os dados fornecidos
      const result = await OrderController.openHybridOrder({
        entry: orderData.entry,
        stop: orderData.stop,
        target: orderData.target,
        action: orderData.action,
        market: orderData.market,
        volume: orderData.volume,
        decimal_quantity: orderData.decimal_quantity,
        decimal_price: orderData.decimal_price,
        stepSize_quantity: orderData.stepSize_quantity,
        accountId: orderData.accountId || 'DEFAULT',
        originalSignalData: orderData.originalSignalData
      });

      return result;
    } catch (error) {
      console.error(`❌ [openOrder] Erro ao executar ordem:`, error.message);
      return { error: error.message };
    }
  }

  static async getRecentOpenOrders(market) {
    const orders = await Order.getOpenOrders(market)
    
    if (!orders || orders.length === 0) {
      return [];
    }

    // Filtra apenas ordens de entrada Limit (não stop loss/take profit)
    const entryOrders = orders.filter(order => {
      // Verifica se é uma ordem pendente
      const isPending = order.status === 'Pending' || 
                       order.status === 'New' || 
                       order.status === 'PartiallyFilled';
      
      // Verifica se é uma ordem Limit (ordens de entrada)
      const isLimitOrder = order.orderType === 'Limit';
      
      // Verifica se NÃO é uma ordem de stop loss ou take profit
      const isNotStopLoss = !order.stopLossTriggerPrice && !order.stopLossLimitPrice;
      const isNotTakeProfit = !order.takeProfitTriggerPrice && !order.takeProfitLimitPrice;
      
      // Verifica se NÃO é uma ordem reduceOnly (que são ordens de saída)
      const isNotReduceOnly = !order.reduceOnly;
      
      const isEntryOrder = isPending && isLimitOrder && isNotStopLoss && isNotTakeProfit && isNotReduceOnly;
      
      // Log detalhado para debug
      if (isPending) {
        console.log(`   📋 ${market}: ID=${order.orderId}, Type=${order.orderType}, Status=${order.status}, ReduceOnly=${order.reduceOnly}, StopLoss=${!!order.stopLossTriggerPrice}, TakeProfit=${!!order.takeProfitTriggerPrice} → ${isEntryOrder ? 'ENTRADA' : 'OUTRO'}`);
      }
      
      return isEntryOrder;
    });

    const orderShorted = entryOrders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return orderShorted;
  }

  /**
   * Obtém apenas ordens de entrada recentes (não stop loss/take profit)
   * @param {string} market - Símbolo do mercado
   * @returns {Array} - Lista de ordens de entrada
   */
  async getRecentEntryOrders(market) {
    const orders = await Order.getOpenOrders(market)
    
    if (!orders || orders.length === 0) {
      return [];
    }

    // Filtra apenas ordens de entrada Limit (não stop loss/take profit)
    const entryOrders = orders.filter(order => {
      // Verifica se é uma ordem pendente
      const isPending = order.status === 'Pending' || 
                       order.status === 'New' || 
                       order.status === 'PartiallyFilled';
      
      // Verifica se é uma ordem Limit (ordens de entrada)
      const isLimitOrder = order.orderType === 'Limit';
      
      // Verifica se NÃO é uma ordem de stop loss ou take profit
      const isNotStopLoss = !order.stopLossTriggerPrice && !order.stopLossLimitPrice;
      const isNotTakeProfit = !order.takeProfitTriggerPrice && !order.takeProfitLimitPrice;
      
      // Verifica se NÃO é uma ordem reduceOnly (que são ordens de saída)
      const isNotReduceOnly = !order.reduceOnly;
      
      const isEntryOrder = isPending && isLimitOrder && isNotStopLoss && isNotTakeProfit && isNotReduceOnly;
      
      // Log detalhado para debug
      if (isPending) {
        console.log(`   📋 ${market}: ID=${order.orderId}, Type=${order.orderType}, Status=${order.status}, ReduceOnly=${order.reduceOnly}, StopLoss=${!!order.stopLossTriggerPrice}, TakeProfit=${!!order.takeProfitTriggerPrice} → ${isEntryOrder ? 'ENTRADA' : 'OUTRO'}`);
      }
      
      return isEntryOrder;
    });

    const orderShorted = entryOrders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const result = orderShorted.map((el) => {
        const minutes = Utils.minutesAgo(el.createdAt);
        console.log(`   ⏰ ${market}: Ordem ${el.id} criada há ${minutes} minutos`);
        return {
            id: el.id,
            minutes: minutes,
            triggerPrice: parseFloat(el.triggerPrice),
            price: parseFloat(el.price)
        }
    });

    return result;
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

  /**
   * Valida se existe stop loss para uma posição e cria se não existir
   * @param {object} position - Dados da posição
   * @param {string} accountId - ID da conta
   * @returns {boolean} - True se stop loss foi criado ou já existia
   */
  static async validateAndCreateStopLoss(position, accountId) {
    
    try {
      // Define as variáveis de ambiente corretas baseado no accountId
      if (accountId === 'CONTA2') {
        process.env.API_KEY = process.env.ACCOUNT2_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT2_API_SECRET;
      } else {
        process.env.API_KEY = process.env.ACCOUNT1_API_KEY;
        process.env.API_SECRET = process.env.ACCOUNT1_API_SECRET;
      }

      // Verifica se já existe stop loss para esta posição
      const existingOrders = await Order.getOpenOrders(position.symbol);
      
      const hasStopLoss = existingOrders && existingOrders.some(order => 
        order.status === 'TriggerPending' && order.reduceOnly
      );

      if (hasStopLoss) {
        // Se já validamos esta posição, não loga novamente
        const positionKey = `${accountId}_${position.symbol}`;
        if (!OrderController.validatedStopLossPositions.has(positionKey)) {
          console.log(`ℹ️ [${accountId}] ${position.symbol}: Stop loss já existe`);
          OrderController.validatedStopLossPositions.add(positionKey);
        }
        return true;
      }

      console.log(`⚠️ [${accountId}] ${position.symbol}: Stop loss não encontrado, criando...`);

      // Busca informações do mercado
      const Account = await AccountController.get();
      const marketInfo = Account.markets.find(m => m.symbol === position.symbol);
      if (!marketInfo) {
        console.error(`❌ [${accountId}] Market info não encontrada para ${position.symbol}`);
        return false;
      }

      const decimal_quantity = marketInfo.decimal_quantity;
      const decimal_price = marketInfo.decimal_price;

      // Preço real de entrada
      const entryPrice = parseFloat(position.avgEntryPrice || position.entryPrice || position.markPrice);
      const isLong = parseFloat(position.netQuantity) > 0;
      const totalQuantity = Math.abs(Number(position.netQuantity));

      // Calcula stop loss usando a estratégia apropriada
      const strategyName = accountId === 'CONTA2' ? 'PRO_MAX' : 'DEFAULT';
      const { ProMaxStrategy, DefaultStrategy } = await import('../Decision/Strategies/ProMaxStrategy.js');
      const strategy = strategyName === 'PRO_MAX' ? new ProMaxStrategy() : new DefaultStrategy();

      // Usa timeframe padrão
      const timeframe = process.env.TIME || '5m';
      const candles = await Markets.getKLines(position.symbol, timeframe, 30);
      const { calculateIndicators } = await import('../Decision/Indicators.js');
      const indicators = calculateIndicators(candles);
      const data = { ...indicators, market: marketInfo, marketPrice: entryPrice };
      const action = isLong ? 'long' : 'short';

      let stop;
      if (strategyName === 'PRO_MAX') {
        const stopAndTargets = strategy.calculateStopAndMultipleTargets(data, entryPrice, action);
        if (stopAndTargets && stopAndTargets.stop) {
          stop = stopAndTargets.stop;
        }
      } else {
        const stopAndTarget = strategy.calculateStopAndTarget(data, entryPrice, isLong);
        if (stopAndTarget && stopAndTarget.stop) {
          stop = stopAndTarget.stop;
        }
      }

      // Se não conseguiu calcular o stop, força o cálculo do ATR e recalcula
      if (!stop || isNaN(parseFloat(stop))) {
        console.log(`⚠️ [${accountId}] ${position.symbol}: ATR não disponível, calculando manualmente...`);
        
        // Calcula ATR manualmente se não estiver disponível
        if (!data.atr || !data.atr.atr || data.atr.atr <= 0) {
          const atrValue = this.calculateATR(candles, 14); // ATR de 14 períodos
          if (atrValue && atrValue > 0) {
            data.atr = { atr: atrValue };
            console.log(`📊 [${accountId}] ${position.symbol}: ATR calculado: ${atrValue.toFixed(6)}`);
            
            // Recalcula o stop loss com o ATR calculado
            if (strategyName === 'PRO_MAX') {
              const stopAndTargets = strategy.calculateStopAndMultipleTargets(data, entryPrice, action);
              if (stopAndTargets && stopAndTargets.stop) {
                stop = stopAndTargets.stop;
              }
            } else {
              const stopAndTarget = strategy.calculateStopAndTarget(data, entryPrice, isLong);
              if (stopAndTarget && stopAndTarget.stop) {
                stop = stopAndTarget.stop;
              }
            }
          }
        }
      }

      // Se ainda não conseguiu calcular, erro crítico
      if (!stop || isNaN(parseFloat(stop))) {
        console.error(`❌ [${accountId}] ${position.symbol}: Falha crítica ao calcular stop loss. ATR e fallback não disponíveis.`);
        return false;
      }

      // Cria a ordem de stop loss simples com reduceOnly
      const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
      const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
      
      // Ordem simples de limite com reduceOnly para fechar a posição no stop loss
      const stopBody = {
        symbol: position.symbol,
        side: isLong ? 'Ask' : 'Bid', // Para LONG, vende (Ask) para fechar. Para SHORT, compra (Bid) para fechar
        orderType: 'Limit',
        postOnly: true,
        reduceOnly: true,
        quantity: formatQuantity(totalQuantity),
        price: formatPrice(stop),
        timeInForce: 'GTC',
        clientId: Math.floor(Math.random() * 1000000) + 9999
      };

      const stopResult = await Order.executeOrder(stopBody);
      
      if (stopResult && !stopResult.error) {
        console.log(`✅ [${accountId}] ${position.symbol}: Stop loss criado - Preço: ${stop.toFixed(6)}, Quantidade: ${totalQuantity}`);
        // Adiciona ao cache de posições validadas
        const positionKey = `${accountId}_${position.symbol}`;
        OrderController.validatedStopLossPositions.add(positionKey);
        return true;
      } else {
        console.log(`⚠️ [${accountId}] ${position.symbol}: Não foi possível criar stop loss. Motivo: ${stopResult && stopResult.error ? stopResult.error : 'desconhecido'}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ [${accountId}] Erro ao validar/criar stop loss para ${position.symbol}:`, error.message);
      return false;
    }
  }

  /**
   * Remove posição do cache de stop loss validado (quando posição é fechada)
   * @param {string} symbol - Símbolo do mercado
   * @param {string} accountId - ID da conta
   */
  static removeFromStopLossCache(symbol, accountId) {
    const positionKey = `${accountId}_${symbol}`;
    OrderController.validatedStopLossPositions.delete(positionKey);
  }

  /**
   * Calcula o ATR (Average True Range) manualmente
   * @param {Array} candles - Array de candles
   * @param {number} period - Período para o cálculo (padrão 14)
   * @returns {number|null} - Valor do ATR ou null se não conseguir calcular
   */
  static calculateATR(candles, period = 14) {
    try {
      if (!candles || candles.length < period + 1) {
        console.warn(`⚠️ ATR: Dados insuficientes. Necessário: ${period + 1}, Disponível: ${candles?.length || 0}`);
        return null;
      }

      // Calcula True Range para cada candle
      const trueRanges = [];
      for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const previous = candles[i - 1];
        
        const high = parseFloat(current.high);
        const low = parseFloat(current.low);
        const prevClose = parseFloat(previous.close);
        
        const tr1 = high - low; // High - Low
        const tr2 = Math.abs(high - prevClose); // |High - Previous Close|
        const tr3 = Math.abs(low - prevClose); // |Low - Previous Close|
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
      }

      // Calcula ATR como média móvel simples dos True Ranges
      if (trueRanges.length < period) {
        return null;
      }

      const atrValues = trueRanges.slice(-period);
      const atr = atrValues.reduce((sum, tr) => sum + tr, 0) / period;

      return atr;

    } catch (error) {
      console.error('❌ Erro ao calcular ATR:', error.message);
      return null;
    }
  }

  /**
   * Valida se o limite de posições abertas foi atingido
   * @param {string} accountId - ID da conta para logs
   * @returns {object} - { isValid: boolean, message: string, currentCount: number, maxCount: number }
   */
  static async validateMaxOpenTrades(accountId = 'DEFAULT') {
    try {
      const positions = await Futures.getOpenPositions();
      const maxOpenTrades = Number(process.env.MAX_OPEN_TRADES || 5);
      const currentOpenPositions = positions.filter(p => Math.abs(Number(p.netQuantity)) > 0).length;
      
      if (currentOpenPositions >= maxOpenTrades) {
        return {
          isValid: false,
          message: `🚫 MAX_OPEN_TRADES atingido: ${currentOpenPositions}/${maxOpenTrades} posições abertas`,
          currentCount: currentOpenPositions,
          maxCount: maxOpenTrades
        };
      }
      
      return {
        isValid: true,
        message: `✅ Posições abertas: ${currentOpenPositions}/${maxOpenTrades}`,
        currentCount: currentOpenPositions,
        maxCount: maxOpenTrades
      };
    } catch (error) {
      console.error(`❌ [${accountId}] Erro ao validar MAX_OPEN_TRADES:`, error.message);
      return {
        isValid: false,
        message: `Erro ao validar MAX_OPEN_TRADES: ${error.message}`,
        currentCount: 0,
        maxCount: 0
      };
    }
  }

}

// Função utilitária para decidir fechamento seguro
function shouldCloseByProfitOrFees(entryPrice, currentPrice, quantity, fee, minProfitPct) {
  const entryValue = entryPrice * quantity;
  const currentValue = currentPrice * quantity;
  let pnl = currentValue - entryValue;
  const entryFee = entryValue * fee;
  const exitFee = currentValue * fee;
  const totalFees = entryFee + exitFee;
  const netProfit = pnl - totalFees;
  const netProfitPct = entryValue > 0 ? (netProfit / entryValue) * 100 : 0;
  if (minProfitPct === 0) {
    // Só fecha se lucro líquido >= taxas totais
    return netProfit > 0 && netProfit >= totalFees;
  } else {
    // Fecha se lucro percentual >= mínimo configurado
    return netProfit > 0 && netProfitPct >= minProfitPct;
  }
}

export default OrderController;


