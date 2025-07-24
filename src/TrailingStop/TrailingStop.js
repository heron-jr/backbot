import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';
import PnlController from '../Controllers/PnlController.js';
import Markets from '../Backpack/Public/Markets.js';

class TrailingStop {

  constructor(strategyType = null) {
    const finalStrategyType = strategyType || 'DEFAULT';
    console.log(`🔧 [TRAILING_INIT] Inicializando TrailingStop com estratégia: ${finalStrategyType}`);
    this.stopLossStrategy = StopLossFactory.createStopLoss(finalStrategyType);
    console.log(`🔧 [TRAILING_INIT] Stop loss strategy criada: ${this.stopLossStrategy.constructor.name}`);
    this.lastVolumeCheck = 0;
    this.cachedVolume = null;
    this.volumeCacheTimeout = 24 * 60 * 60 * 1000; // 24 horas em ms
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
  calculatePnL(position) {
    try { 
      const pnl = parseFloat(position.pnlUnrealized || 0);

      const costBasis = Math.abs(parseFloat(position.netCost ?? '0'));

      let pnlPct = 0;
      if (costBasis > 0) {
        pnlPct = (pnl / costBasis) * 100;
      }
      
      return {
        pnl: pnl,
        pnlPct: pnlPct
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
      const { pnl, pnlPct } = this.calculatePnL(position);
      
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
          console.log(`🚨 [PROFIT_CHECK] ${position.symbol}: Fechando por stop loss - PnL ${pnlPct.toFixed(2)}% <= limite ${maxNegativePnlStopPct}%`);
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
      const { pnl, pnlPct } = this.calculatePnL(position);
      
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
        console.log(`\n✅ [CONFIG_PROFIT] ${position.symbol}: Fechando por lucro ${netProfitPct.toFixed(2)}% >= mínimo ${minProfitPct}%`);
        return true;
      }
      
      // Só mostra logs se há lucro significativo mas não suficiente
      if (netProfit > 0.01 && netProfitPct < minProfitPct) {
        console.log(`\n⚠️ [CONFIG_PROFIT] ${position.symbol}: Lucro ${netProfitPct.toFixed(2)}% < mínimo ${minProfitPct}%`);
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

      for (const position of positions) {
        // Verifica se deve fechar por profit mínimo baseado nas taxas (prioridade 1)
        if (await this.shouldCloseForMinimumProfit(position)) {
          console.log(`🔍 [TRAILING_DEBUG] ${position.symbol}: Fechando por profit mínimo baseado em taxas`);
          await OrderController.forceClose(position);
          continue;
        }

        // Verifica se deve fechar por profit mínimo configurado (prioridade 2)
        if (await this.shouldCloseForConfiguredProfit(position)) {
          console.log(`🔍 [TRAILING_DEBUG] ${position.symbol}: Fechando por profit mínimo configurado`);
          await OrderController.forceClose(position);
          continue;
        }

        // Verifica ADX crossover para estratégia PRO_MAX (prioridade 3)
        const adxCrossoverDecision = await this.checkADXCrossover(position);
        if (adxCrossoverDecision && adxCrossoverDecision.shouldClose) {
          console.log(`🔄 [ADX_CROSSOVER] ${position.symbol}: ${adxCrossoverDecision.reason}`);
          await OrderController.forceClose(position);
          continue;
        }

        // Verifica stop loss normal (prioridade 4)
        const decision = this.stopLossStrategy.shouldClosePosition(position);
        
        if (decision && decision.shouldClose) {
          console.log(`🔍 [TRAILING_DEBUG] ${position.symbol}: Fechando por stop loss normal`);
          await OrderController.forceClose(position);
          continue;
        }

        if (decision && decision.shouldTakePartialProfit) {
          console.log(`🔍 [TRAILING_DEBUG] ${position.symbol}: Tomando profit parcial`);
          await OrderController.takePartialProfit(position, decision.partialPercentage);
          continue;
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
}

export default new TrailingStop();