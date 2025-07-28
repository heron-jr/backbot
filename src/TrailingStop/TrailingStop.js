import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';
import PnlController from '../Controllers/PnlController.js';
import Markets from '../Backpack/Public/Markets.js';
import AccountController from '../Controllers/AccountController.js';

class TrailingStop {

  // Gerenciador de estado do trailing stop para cada posição
  static trailingState = new Map(); // Ex: { 'SOL_USDC_PERP': { trailingStopPrice: 180.50, highestPrice: 182.00, lowestPrice: 175.00 } }

  /**
   * Função de debug condicional
   * @param {string} message - Mensagem de debug
   */
  static debug(message) {
    if (process.env.LOG_TYPE === 'debug') {
      console.log(message);
    }
  }

  constructor(strategyType = null) {
    const finalStrategyType = strategyType || 'DEFAULT';
    console.log(`🔧 [TRAILING_INIT] Inicializando TrailingStop com estratégia: ${finalStrategyType}`);
    this.stopLossStrategy = StopLossFactory.createStopLoss(finalStrategyType);
    console.log(`🔧 [TRAILING_INIT] Stop loss strategy criada: ${this.stopLossStrategy.constructor.name}`);
    this.lastVolumeCheck = 0;
    this.cachedVolume = null;
    this.volumeCacheTimeout = 24 * 60 * 60 * 1000; // 24 horas em ms
    
    // Loga a configuração do trailing stop
    TrailingStop.logTrailingStopConfig();
  }

  /**
   * Re-inicializa o stop loss com uma nova estratégia
   * @param {string} strategyType - Novo tipo de estratégia
   */
  reinitializeStopLoss(strategyType) {
    if (!strategyType) {
      return;
    }
    
    this.stopLossStrategy = StopLossFactory.createStopLoss(strategyType);
  }

  /**
   * Limpa o estado do trailing stop para uma posição específica
   * @param {string} symbol - Símbolo da posição
   * @param {string} reason - Motivo da limpeza (opcional)
   */
  static clearTrailingState(symbol, reason = 'manual') {
    if (TrailingStop.trailingState.has(symbol)) {
      const state = TrailingStop.trailingState.get(symbol);
      TrailingStop.trailingState.delete(symbol);
      console.log(`🧹 [TRAILING_CLEANUP] ${symbol}: Estado limpo (${reason}) - Stop: $${state?.trailingStopPrice?.toFixed(4) || 'N/A'}`);
    }
  }

  /**
   * Limpa o estado do trailing stop quando uma posição é fechada
   * @param {object} position - Dados da posição que foi fechada
   * @param {string} closeReason - Motivo do fechamento
   */
  static onPositionClosed(position, closeReason) {
    if (position && position.symbol) {
      TrailingStop.clearTrailingState(position.symbol, `posição fechada: ${closeReason}`);
    }
  }

  /**
   * Atualiza o trailing stop para uma posição específica
   * @param {object} position - Dados da posição
   * @returns {object|null} - Estado atualizado do trailing stop ou null se não aplicável
   */
  async updateTrailingStopForPosition(position) {
    try {
      // Verifica se o trailing stop está habilitado
      const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';
      if (!enableTrailingStop) {
        return null;
      }

      // Obtém a distância do trailing stop (em porcentagem)
      const trailingStopDistance = Number(process.env.TRAILING_STOP_DISTANCE || 2.0); // 2% por padrão (valor real: 2 = 2%, 1.5 = 1.5%)
      
      if (isNaN(trailingStopDistance) || trailingStopDistance <= 0) {
        console.error(`❌ [TRAILING_ERROR] TRAILING_STOP_DISTANCE inválido: ${process.env.TRAILING_STOP_DISTANCE}`);
        return null;
      }

      // Calcula PnL da posição
      const Account = await AccountController.get();
      const leverage = Account.leverage;
      const { pnl, pnlPct } = this.calculatePnL(position, leverage);

      // Trailing stop só é ativado se a posição estiver com lucro
      if (pnl <= 0) {
        // Remove estado se posição não está mais lucrativa
        TrailingStop.clearTrailingState(position.symbol);
        return null;
      }

      // Obtém preço atual da posição
      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      if (currentPrice <= 0) {
        console.error(`❌ [TRAILING_ERROR] Preço atual inválido para ${position.symbol}: ${currentPrice}`);
        return null;
      }

      // Obtém preço de entrada
      const entryPrice = parseFloat(position.entryPrice || 0);
      if (entryPrice <= 0) {
        console.error(`❌ [TRAILING_ERROR] Preço de entrada inválido para ${position.symbol}: ${entryPrice}`);
        return null;
      }

      // Determina se é LONG ou SHORT
      const isLong = parseFloat(position.netQuantity) > 0;
      const isShort = parseFloat(position.netQuantity) < 0;

      if (!isLong && !isShort) {
        return null;
      }

      // Obtém ou inicializa o estado do trailing stop
      let trailingState = TrailingStop.trailingState.get(position.symbol);
      
      if (!trailingState) {
        // Inicializa o estado - LOG DE ATIVAÇÃO
        trailingState = {
          entryPrice: entryPrice,
          trailingStopPrice: null,
          highestPrice: isLong ? entryPrice : null,
          lowestPrice: isShort ? entryPrice : null,
          isLong: isLong,
          isShort: isShort,
          activated: false
        };
        TrailingStop.trailingState.set(position.symbol, trailingState);
        console.log(`[TRAILING_INIT] ${position.symbol}: Trailing Stop INICIALIZADO. Preço de Entrada: $${entryPrice.toFixed(4)}`);
      }

      // Atualiza o trailing stop baseado na direção da posição
      if (isLong) {
        // Para posições LONG
        if (currentPrice > trailingState.highestPrice) {
          trailingState.highestPrice = currentPrice;
          
          // Calcula novo trailing stop price
          const newTrailingStopPrice = currentPrice * (1 - (trailingStopDistance / 100));
          
          // Só atualiza se o novo stop for maior que o anterior (trailing stop só se move a favor)
          if (!trailingState.trailingStopPrice || newTrailingStopPrice > trailingState.trailingStopPrice) {
            trailingState.trailingStopPrice = newTrailingStopPrice;
            trailingState.activated = true;
            console.log(`📈 [TRAILING_UPDATE] ${position.symbol}: LONG - Preço Máximo: $${currentPrice.toFixed(4)}, Novo Stop: $${newTrailingStopPrice.toFixed(4)}`);
            console.log(`✅ [TRAILING_ACTIVATED] ${position.symbol}: Trailing Stop ATIVADO para LONG`);
          }
        } else if (pnl > 0 && !trailingState.activated) {
          // Se a posição está com lucro mas o trailing stop ainda não foi ativado,
          // ativa com o preço atual como base
          const newTrailingStopPrice = currentPrice * (1 - (trailingStopDistance / 100));
          trailingState.trailingStopPrice = newTrailingStopPrice;
          trailingState.activated = true;
          console.log(`🎯 [TRAILING_ACTIVATE] ${position.symbol}: LONG - Ativando trailing stop com lucro existente. Preço: $${currentPrice.toFixed(4)}, Stop: $${newTrailingStopPrice.toFixed(4)}`);
        }
      } else if (isShort) {
        // Para posições SHORT
        if (currentPrice < trailingState.lowestPrice) {
          trailingState.lowestPrice = currentPrice;
          
          // Calcula novo trailing stop price
          const newTrailingStopPrice = currentPrice * (1 + (trailingStopDistance / 100));
          
          // Só atualiza se o novo stop for menor que o anterior (trailing stop só se move a favor)
          if (!trailingState.trailingStopPrice || newTrailingStopPrice < trailingState.trailingStopPrice) {
            trailingState.trailingStopPrice = newTrailingStopPrice;
            trailingState.activated = true;
            console.log(`📉 [TRAILING_UPDATE] ${position.symbol}: SHORT - Preço Mínimo: $${currentPrice.toFixed(4)}, Novo Stop: $${newTrailingStopPrice.toFixed(4)}`);
            console.log(`✅ [TRAILING_ACTIVATED] ${position.symbol}: Trailing Stop ATIVADO para SHORT`);
          }
        } else if (pnl > 0 && !trailingState.activated) {
          // Se a posição está com lucro mas o trailing stop ainda não foi ativado,
          // ativa com o preço atual como base
          const newTrailingStopPrice = currentPrice * (1 + (trailingStopDistance / 100));
          trailingState.trailingStopPrice = newTrailingStopPrice;
          trailingState.activated = true;
          console.log(`🎯 [TRAILING_ACTIVATE] ${position.symbol}: SHORT - Ativando trailing stop com lucro existente. Preço: $${currentPrice.toFixed(4)}, Stop: $${newTrailingStopPrice.toFixed(4)}`);
        }
      }

      return trailingState;

    } catch (error) {
      console.error(`[TRAILING_UPDATE] Erro ao atualizar trailing stop para ${position.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Verifica se uma posição deve ser fechada por trailing stop
   * @param {object} position - Dados da posição
   * @param {object} trailingState - Estado do trailing stop
   * @returns {object|null} - Decisão de fechamento ou null
   */
  checkTrailingStopTrigger(position, trailingState) {
    try {
      if (!trailingState || !trailingState.activated || !trailingState.trailingStopPrice) {
        return null;
      }

      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      if (currentPrice <= 0) {
        return null;
      }

      let shouldClose = false;
      let reason = '';

      if (trailingState.isLong) {
        // Para LONG: fecha se preço atual <= trailing stop price
        if (currentPrice <= trailingState.trailingStopPrice) {
          shouldClose = true;
          reason = `TRAILING_STOP: Preço atual $${currentPrice.toFixed(4)} <= stop $${trailingState.trailingStopPrice.toFixed(4)}`;
        }
      } else if (trailingState.isShort) {
        // Para SHORT: fecha se preço atual >= trailing stop price
        if (currentPrice >= trailingState.trailingStopPrice) {
          shouldClose = true;
          reason = `TRAILING_STOP: Preço atual $${currentPrice.toFixed(4)} >= stop $${trailingState.trailingStopPrice.toFixed(4)}`;
        }
      }

      if (shouldClose) {
        console.log(`🚨 [TRAILING_TRIGGER] ${position.symbol}: GATILHO ATIVADO! Preço atual $${currentPrice.toFixed(4)} cruzou o stop em $${trailingState.trailingStopPrice.toFixed(4)}.`);
        return {
          shouldClose: true,
          reason: reason,
          type: 'TRAILING_STOP',
          trailingStopPrice: trailingState.trailingStopPrice,
          currentPrice: currentPrice
        };
      }

      return null;

    } catch (error) {
      console.error(`[TRAILING_CHECK] Erro ao verificar trailing stop para ${position.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Verifica se o trailing stop está ativo para uma posição
   * @param {string} symbol - Símbolo da posição
   * @returns {boolean} - True se o trailing stop está ativo
   */
  isTrailingStopActive(symbol) {
    const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';
    const trailingState = TrailingStop.trailingState.get(symbol);
    return enableTrailingStop && trailingState && trailingState.activated;
  }

  /**
   * Obtém informações detalhadas sobre o estado do trailing stop
   * @param {string} symbol - Símbolo da posição
   * @returns {object|null} - Informações do trailing stop ou null
   */
  getTrailingStopInfo(symbol) {
    const trailingState = TrailingStop.trailingState.get(symbol);
    if (!trailingState) {
      return null;
    }

    return {
      isActive: trailingState.activated,
      trailingStopPrice: trailingState.trailingStopPrice,
      highestPrice: trailingState.highestPrice,
      lowestPrice: trailingState.lowestPrice,
      isLong: trailingState.isLong,
      isShort: trailingState.isShort,
      entryPrice: trailingState.entryPrice
    };
  }

  /**
   * Obtém o tier de taxas baseado no volume de 30 dias
   * @returns {Promise<object>} Objeto com maker, taker e tier
   */
  async getFeeTier() {
    try {
      const now = Date.now();
      
      // Verifica se precisa atualizar o cache de volume
      if (!this.cachedVolume || (now - this.lastVolumeCheck) > this.volumeCacheTimeout) {
        this.cachedVolume = await PnlController.get30DayVolume();
        this.lastVolumeCheck = now;
      }

      const volume30Days = this.cachedVolume || 0;

      // Estrutura de taxas da Backpack baseada no volume de 30 dias
      let tier;
      
      if (volume30Days >= 10000000) { // $10M+
        tier = { maker: 0.0001, taker: 0.0002, name: 'DIAMOND' };
      } else if (volume30Days >= 5000000) { // $5M+
        tier = { maker: 0.0002, taker: 0.0003, name: 'PLATINUM' };
      } else if (volume30Days >= 1000000) { // $1M+
        tier = { maker: 0.0003, taker: 0.0004, name: 'GOLD' };
      } else if (volume30Days >= 500000) { // $500K+
        tier = { maker: 0.0004, taker: 0.0005, name: 'SILVER' };
      } else if (volume30Days >= 100000) { // $100K+
        tier = { maker: 0.0005, taker: 0.0006, name: 'BRONZE' };
      } else { // < $100K
        tier = { maker: 0.0006, taker: 0.0007, name: 'STANDARD' };
      }

      return {
        makerFee: tier.maker,
        takerFee: tier.taker,
        totalFee: tier.maker + tier.taker,
        tier: tier
      };
    } catch (error) {
      // Erro silencioso ao obter tier de taxas
      // Fallback para taxas padrão
      return {
        makerFee: 0.0006,
        takerFee: 0.0007,
        totalFee: 0.0013,
        tier: { name: 'STANDARD_FALLBACK' }
      };
    }
  }

  /**
   * Calcula PnL de uma posição
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {object} - PnL em USD e porcentagem
   */
  calculatePnL(position, leverage) {
    try { 
      // PnL em dólar, que já estava correto.
      const pnl = parseFloat(position.pnlUnrealized ?? '0');

      // O 'netCost' aqui é tratado como o VALOR NOCIONAL da posição.
      const notionalValue = Math.abs(parseFloat(position.netCost ?? '0'));
      
      // A base de custo real (MARGEM) é o valor nocional dividido pela alavancagem.
      // Se a alavancagem for 0 ou não informada, consideramos 1 para evitar divisão por zero.
      const costBasis = notionalValue / (leverage || 1);

      let pnlPct = 0;
      if (costBasis > 0) {
        pnlPct = (pnl / costBasis) * 100;
      }

      return {
        pnl: pnl,
        pnlPct: pnlPct,
      };
    } catch (error) {
      console.error('[PNL_CALC] Erro ao calcular PnL:', error.message);
      return { pnl: 0, pnlPct: 0 };
    }
  }

  /**
   * Calcula o profit mínimo necessário para cobrir as taxas
   * @param {object} position - Dados da posição
   * @param {object} fees - Objeto com as taxas
   * @returns {object} - Profit mínimo em USD e porcentagem
   */
  calculateMinimumProfitForFees(position, fees) {
    try {
      const notional = parseFloat(position.netExposureNotional || position.notional || 0);
      
      if (notional <= 0) {
        return { minProfitUSD: 0, minProfitPct: 0 };
      }

      // Calcula o valor total das taxas (entrada + saída)
      const totalFees = notional * fees.totalFee;
      
      // Profit mínimo deve ser pelo menos o valor das taxas
      const minProfitUSD = totalFees;
      const minProfitPct = (minProfitUSD / notional) * 100;

      return {
        minProfitUSD: minProfitUSD,
        minProfitPct: minProfitPct,
        totalFees: totalFees
      };
    } catch (error) {
      return { minProfitUSD: 0, minProfitPct: 0, totalFees: 0 };
    }
  }

  /**
   * Verifica se deve fechar posição quando o lucro líquido cobre as taxas
   * 
   * Esta função SEMPRE verifica se o lucro líquido (após deduzir taxas de entrada + saída)
   * é maior que zero. É a verificação de segurança para garantir que não há prejuízo.
   * 
   * Prioridade 1: Esta verificação acontece ANTES da verificação de MIN_PROFIT_PERCENTAGE
   * 
   * @param {object} position - Dados da posição
   * @returns {Promise<boolean>} - True se deve fechar por lucro mínimo
   */
  async shouldCloseForMinimumProfit(position) {
    try {
      const Account = await AccountController.get();
      const leverage = Account.leverage;
      const { pnl, pnlPct } = this.calculatePnL(position, leverage);
      
      // Configuração do stop loss por porcentagem (opcional)
      const MAX_NEGATIVE_PNL_STOP_PCT = process.env.MAX_NEGATIVE_PNL_STOP_PCT;
      
      // Só valida se a configuração estiver presente
      if (MAX_NEGATIVE_PNL_STOP_PCT !== undefined && MAX_NEGATIVE_PNL_STOP_PCT !== null && MAX_NEGATIVE_PNL_STOP_PCT !== '') {
        const maxNegativePnlStopPct = parseFloat(MAX_NEGATIVE_PNL_STOP_PCT);
        
        // Verifica se os valores são válidos
        if (isNaN(maxNegativePnlStopPct) || !isFinite(maxNegativePnlStopPct)) {
          console.error(`❌ [PROFIT_CHECK] Valor inválido para MAX_NEGATIVE_PNL_STOP_PCT: ${MAX_NEGATIVE_PNL_STOP_PCT}`);
          return false;
        }
        
        if (isNaN(pnlPct) || !isFinite(pnlPct)) {
          console.error(`❌ [PROFIT_CHECK] PnL inválido para ${position.symbol}: ${pnlPct}`);
          return false;
        }
        
        // Verifica se deve fechar por stop loss baseado no pnlPct
        if (pnlPct <= maxNegativePnlStopPct) {
          console.log(`🚨 [PROFIT_CHECK] ${position.symbol}: Fechando por stop loss - PnL ${pnlPct.toFixed(3)}% <= limite ${maxNegativePnlStopPct.toFixed(3)}%`);
          return true;
        }
      }
      
      // Obtém taxas dinâmicas baseado no volume de 30 dias via API
      const fees = await this.getFeeTier();
      
      // Calcula o profit mínimo necessário para cobrir as taxas
      const { minProfitUSD, minProfitPct, totalFees } = this.calculateMinimumProfitForFees(position, fees);
      
      // Lucro líquido (após taxas)
      const netProfit = pnl - totalFees;

      // Só fecha se há lucro líquido E ele cobre as taxas
      if (netProfit > 0 && netProfit >= minProfitUSD) {
        console.log(`✅ [PROFIT_CHECK] ${position.symbol}: Fechando por lucro $${netProfit.toFixed(4)} >= mínimo $${minProfitUSD.toFixed(4)}`);
        return true;
      }
      
      // Só mostra logs se há lucro significativo mas não suficiente
      if (netProfit > 0.01 && netProfit < minProfitUSD) {
        console.log(`⚠️ [PROFIT_CHECK] ${position.symbol}: Lucro $${netProfit.toFixed(4)} < mínimo $${minProfitUSD.toFixed(4)}`);
      }
      
      return false;
    } catch (error) {
      console.error('[PROFIT_CHECK] Erro ao verificar profit mínimo:', error.message);
      return false;
    }
  }

  /**
   * Verifica se deve fechar posição por profit mínimo configurado
   * 
   * ⚠️ ATENÇÃO: Configurar MIN_PROFIT_PERCENTAGE=0 fará o sistema fechar trades
   * assim que o lucro líquido cobrir as taxas (entrada + saída). Isso pode resultar
   * em fechamentos muito rápidos com lucro mínimo. Recomenda-se configurar um valor
   * maior (ex: 5-10%) para evitar perdas significativas no stop loss e garantir
   * um lucro real após todas as taxas.
   * 
   * @param {object} position - Dados da posição
   * @returns {Promise<boolean>} - True se deve fechar por profit configurado
   */
  async shouldCloseForConfiguredProfit(position) {
    try {
      const Account = await AccountController.get();
      const leverage = Account.leverage;
      const { pnl, pnlPct } = this.calculatePnL(position, leverage);
      
      // Configuração do stop loss por porcentagem (opcional)
      const MAX_NEGATIVE_PNL_STOP_PCT = process.env.MAX_NEGATIVE_PNL_STOP_PCT;
      
      // Só valida se a configuração estiver presente
      if (MAX_NEGATIVE_PNL_STOP_PCT !== undefined && MAX_NEGATIVE_PNL_STOP_PCT !== null && MAX_NEGATIVE_PNL_STOP_PCT !== '') {
        const maxNegativePnlStopPct = parseFloat(MAX_NEGATIVE_PNL_STOP_PCT);
        
        // Verifica se os valores são válidos
        if (isNaN(maxNegativePnlStopPct) || !isFinite(maxNegativePnlStopPct)) {
          console.error(`❌ [CONFIG_PROFIT] Valor inválido para MAX_NEGATIVE_PNL_STOP_PCT: ${MAX_NEGATIVE_PNL_STOP_PCT}`);
          return false;
        }
        
        if (isNaN(pnlPct) || !isFinite(pnlPct)) {
          console.error(`❌ [CONFIG_PROFIT] PnL inválido para ${position.symbol}: ${pnlPct}`);
          return false;
        }
        
        // Verifica se deve fechar por stop loss baseado no pnlPct
        if (pnlPct <= maxNegativePnlStopPct) {
          console.log(`🚨 [CONFIG_PROFIT] ${position.symbol}: Fechando por stop loss - PnL ${pnlPct.toFixed(3)}% <= limite ${maxNegativePnlStopPct.toFixed(3)}%`);
          return true;
        }
      }
      
      // Configuração de profit mínimo (apenas porcentagem)
      // MIN_PROFIT_PERCENTAGE=0: Fecha quando lucro líquido > 0 (apenas cobrir taxas)
      // MIN_PROFIT_PERCENTAGE=5: Fecha quando lucro líquido >= 5% do notional
      // MIN_PROFIT_PERCENTAGE=10: Fecha quando lucro líquido >= 10% do notional
      const minProfitPct = Number(process.env.MIN_PROFIT_PERCENTAGE || 10);
      
      // Obtém taxas dinâmicas baseado no volume de 30 dias via API
      const fees = await this.getFeeTier();
      
      const notional = parseFloat(position.netExposureNotional || position.notional || 0);
      const totalFees = notional * fees.totalFee;
      
      // Lucro líquido (após taxas)
      const netProfit = pnl - totalFees;
      const netProfitPct = notional > 0 ? (netProfit / notional) * 100 : 0;
      
      // Só fecha se há lucro líquido E atende ao critério configurado
      if (netProfit > 0 && netProfitPct >= minProfitPct) {
        console.log(`\n✅ [CONFIG_PROFIT] ${position.symbol}: Fechando por lucro ${netProfitPct.toFixed(3)}% >= mínimo ${minProfitPct.toFixed(3)}%`);
        return true;
      }
      
      // Só mostra logs se há lucro significativo mas não suficiente
      if (netProfit > 0.01 && netProfitPct < minProfitPct) {
        console.log(`\n⚠️ [CONFIG_PROFIT] ${position.symbol}: Lucro ${netProfitPct.toFixed(3)}% < mínimo ${minProfitPct.toFixed(3)}%`);
      }
      
      return false;
    } catch (error) {
      console.error('[CONFIG_PROFIT] Erro ao verificar profit configurado:', error.message);
      return false;
    }
  }

  async stopLoss() {
    try {
      const positions = await Futures.getOpenPositions();

      if (!positions || positions.length === 0) {
        return;
      }

      TrailingStop.debug(`🔍 [TRAILING_MONITOR] Verificando ${positions.length} posições abertas...`);

      for (const position of positions) {
        // Atualiza o estado do trailing stop para a posição
        await this.updateTrailingStopForPosition(position);

        // NOVA HIERARQUIA DE DECISÃO CONDICIONAL
        const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';
        const isTrailingActive = this.isTrailingStopActive(position.symbol);
        const trailingInfo = this.getTrailingStopInfo(position.symbol);
        let decision = null;

        if (enableTrailingStop) {
          // MODO TRAILING STOP: Desabilita completamente o Take Profit fixo
          TrailingStop.debug(`🎯 [TRAILING_MODE] ${position.symbol}: Modo Trailing Stop ativo - Take Profit fixo DESABILITADO`);
          
          if (isTrailingActive) {
            // Trailing Stop está ativo e no controle
            TrailingStop.debug(`🚀 [TRAILING_ACTIVE] ${position.symbol}: Trailing Stop ATIVO - Monitorando posição`);
            
            decision = this.checkTrailingStopTrigger(position, trailingInfo);
            
            if (decision && decision.shouldClose) {
              console.log(`🚨 [TRAILING_TRIGGER] ${position.symbol}: Fechando por TRAILING STOP - ${decision.reason}`);
              await OrderController.forceClose(position);
              TrailingStop.onPositionClosed(position, 'trailing_stop');
              continue;
            }
          } else {
            // Trailing Stop não está ativo (posição com prejuízo ou sem lucro suficiente)
            TrailingStop.debug(`⏳ [TRAILING_WAITING] ${position.symbol}: Aguardando posição ficar lucrativa para ativar trailing stop`);
            
            // Verifica apenas stop loss normal da estratégia (sem take profit fixo)
            decision = this.stopLossStrategy.shouldClosePosition(position);
            
            if (decision && decision.shouldClose) {
              console.log(`🛑 [STOP_LOSS_ONLY] ${position.symbol}: Fechando por stop loss normal - ${decision.reason}`);
              await OrderController.forceClose(position);
              TrailingStop.onPositionClosed(position, 'stop_loss');
              continue;
            }

            if (decision && decision.shouldTakePartialProfit) {
              console.log(`💰 [PARTIAL_PROFIT_ONLY] ${position.symbol}: Tomando profit parcial`);
              await OrderController.takePartialProfit(position, decision.partialPercentage);
              continue;
            }
          }
        } else {
          // MODO TAKE PROFIT FIXO: Usa apenas regras de Take Profit fixo
          TrailingStop.debug(`📋 [PROFIT_MODE] ${position.symbol}: Modo Take Profit fixo ativo`);
          
          // Verifica se deve fechar por profit mínimo baseado nas taxas
          if (await this.shouldCloseForMinimumProfit(position)) {
            console.log(`✅ [PROFIT_FIXED] ${position.symbol}: Fechando por profit mínimo baseado em taxas`);
            await OrderController.forceClose(position);
            TrailingStop.onPositionClosed(position, 'profit_minimum');
            continue;
          }

          // Verifica se deve fechar por profit mínimo configurado
          if (await this.shouldCloseForConfiguredProfit(position)) {
            console.log(`✅ [PROFIT_FIXED] ${position.symbol}: Fechando por profit mínimo configurado`);
            await OrderController.forceClose(position);
            TrailingStop.onPositionClosed(position, 'profit_configured');
            continue;
          }

          // Verifica ADX crossover para estratégia PRO_MAX
          const adxCrossoverDecision = await this.checkADXCrossover(position);
          if (adxCrossoverDecision && adxCrossoverDecision.shouldClose) {
            console.log(`🔄 [ADX_CROSSOVER] ${position.symbol}: ${adxCrossoverDecision.reason}`);
            await OrderController.forceClose(position);
            TrailingStop.onPositionClosed(position, 'adx_crossover');
            continue;
          }

          // Verifica stop loss normal da estratégia
          decision = this.stopLossStrategy.shouldClosePosition(position);
          
          if (decision && decision.shouldClose) {
            console.log(`🛑 [STOP_LOSS_FIXED] ${position.symbol}: Fechando por stop loss normal - ${decision.reason}`);
            await OrderController.forceClose(position);
            TrailingStop.onPositionClosed(position, 'stop_loss');
            continue;
          }

          if (decision && decision.shouldTakePartialProfit) {
            console.log(`💰 [PARTIAL_PROFIT_FIXED] ${position.symbol}: Tomando profit parcial`);
            await OrderController.takePartialProfit(position, decision.partialPercentage);
            continue;
          }
        }

        // Log de monitoramento para posições que não foram fechadas
        if (enableTrailingStop && isTrailingActive && trailingInfo) {
          const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
          const distance = trailingInfo.isLong 
            ? ((currentPrice - trailingInfo.trailingStopPrice) / currentPrice * 100).toFixed(2)
            : ((trailingInfo.trailingStopPrice - currentPrice) / currentPrice * 100).toFixed(2);
          
          TrailingStop.debug(`📊 [TRAILING_MONITOR] ${position.symbol}: Trailing ativo - Preço: $${currentPrice.toFixed(4)}, Stop: $${trailingInfo.trailingStopPrice.toFixed(4)}, Distância: ${distance}%`);
        }
      }

    } catch (error) {
      console.error('[TRAILING] Erro no stop loss:', error.message);
    }
  }

  /**
   * Verifica se deve fechar posição baseada no cruzamento do ADX (estratégia PRO_MAX)
   * @param {object} position - Dados da posição
   * @returns {Promise<object|null>} - Decisão de fechamento ou null
   */
  async checkADXCrossover(position) {
    try {
      // Só verifica para estratégia PRO_MAX
      const strategyType = process.env.TRADING_STRATEGY || 'DEFAULT';
      if (strategyType !== 'PRO_MAX') {
        return null;
      }

      // Obtém dados de mercado para calcular indicadores ADX
      const timeframe = process.env.TIME || '5m';
      const candles = await Markets.getKLines(position.symbol, timeframe, 30);
      
      if (!candles || candles.length < 20) {
        return null;
      }

      // Calcula indicadores incluindo ADX
      const { calculateIndicators } = await import('../Decision/Indicators.js');
      const indicators = calculateIndicators(candles);
      
      // Verifica se tem dados ADX válidos
      if (!indicators.adx || !indicators.adx.diPlus || !indicators.adx.diMinus) {
        return null;
      }

      // Usa a estratégia PRO_MAX para verificar crossover
      const { ProMaxStrategy } = await import('../Decision/Strategies/ProMaxStrategy.js');
      const strategy = new ProMaxStrategy();
      
      const data = { ...indicators, market: { symbol: position.symbol } };
      const crossoverDecision = strategy.shouldClosePositionByADX(position, data);
      
      return crossoverDecision;

    } catch (error) {
      console.error(`[ADX_CROSSOVER] Erro ao verificar crossover para ${position.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Verifica se o trailing stop está configurado corretamente
   * @returns {object} - Status da configuração
   */
  static getTrailingStopConfig() {
    const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';
    const trailingStopDistance = Number(process.env.TRAILING_STOP_DISTANCE || 2.0);
    
    return {
      enabled: enableTrailingStop,
      distance: trailingStopDistance,
      isValid: enableTrailingStop && !isNaN(trailingStopDistance) && trailingStopDistance > 0,
      config: {
        ENABLE_TRAILING_STOP: process.env.ENABLE_TRAILING_STOP,
        TRAILING_STOP_DISTANCE: process.env.TRAILING_STOP_DISTANCE
      }
    };
  }

  /**
   * Loga o status da configuração do trailing stop
   */
  static logTrailingStopConfig() {
    const config = TrailingStop.getTrailingStopConfig();
    
    if (config.isValid) {
      console.log(`✅ [TRAILING_CONFIG] Trailing Stop configurado corretamente:`);
      console.log(`   - Habilitado: ${config.enabled}`);
      console.log(`   - Distância: ${config.distance}%`);
    } else {
      console.log(`⚠️ [TRAILING_CONFIG] Trailing Stop não configurado ou inválido:`);
      console.log(`   - ENABLE_TRAILING_STOP: ${config.config.ENABLE_TRAILING_STOP}`);
      console.log(`   - TRAILING_STOP_DISTANCE: ${config.config.TRAILING_STOP_DISTANCE}`);
    }
  }
}

export default new TrailingStop();