import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';
import PnlController from '../Controllers/PnlController.js';
import Markets from '../Backpack/Public/Markets.js';

class TrailingStop {

  constructor(strategyType = null) {
    const finalStrategyType = strategyType || 'DEFAULT';
    this.stopLossStrategy = StopLossFactory.createStopLoss(finalStrategyType);
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
  calculatePnL(position, account) {
    try {
      const notional = parseFloat(position.netExposureNotional || position.notional || 0);
      
      // Tenta diferentes campos para obter o PnL
      let pnl = 0;
      
      // Prioridade 1: unrealizedPnl
      if (position.unrealizedPnl !== undefined && position.unrealizedPnl !== null && parseFloat(position.unrealizedPnl) !== 0) {
        pnl = parseFloat(position.unrealizedPnl);
      }
      // Prioridade 2: pnlUnrealized
      else if (position.pnlUnrealized !== undefined && position.pnlUnrealized !== null && parseFloat(position.pnlUnrealized) !== 0) {
        pnl = parseFloat(position.pnlUnrealized);
      }
      // Prioridade 3: pnl
      else if (position.pnl !== undefined && position.pnl !== null && parseFloat(position.pnl) !== 0) {
        pnl = parseFloat(position.pnl);
      }
      // Prioridade 4: pnlRealized + pnlUnrealized
      else if ((position.pnlRealized !== undefined && parseFloat(position.pnlRealized) !== 0) || 
               (position.pnlUnrealized !== undefined && parseFloat(position.pnlUnrealized) !== 0)) {
        pnl = parseFloat(position.pnlRealized || 0) + parseFloat(position.pnlUnrealized || 0);
      }
      // Prioridade 5: Calcula manualmente usando entryPrice e markPrice
      else if (position.entryPrice && position.markPrice && position.size) {
        const entryPrice = parseFloat(position.entryPrice);
        const markPrice = parseFloat(position.markPrice);
        const size = parseFloat(position.size);
        const isLong = position.side === 'Long' || position.side === 'long';
        
        if (isLong) {
          pnl = (markPrice - entryPrice) * size;
        } else {
          pnl = (entryPrice - markPrice) * size;
        }
        
        console.log(`🔧 [PNL_CALC] ${position.symbol}: Calculado manualmente`);
        console.log(`   Entry: $${entryPrice}, Mark: $${markPrice}, Size: ${size}, Side: ${position.side}`);
        console.log(`   PnL calculado: $${pnl.toFixed(4)}`);
      }
      
      // Log para debug quando PnL é 0 mas deveria ter valor
      if (pnl === 0 && notional > 0) {
        console.log(`⚠️ [PNL_DEBUG] ${position.symbol}: PnL zero detectado`);
        console.log(`   Campos disponíveis:`, {
          unrealizedPnl: position.unrealizedPnl,
          pnlUnrealized: position.pnlUnrealized,
          pnl: position.pnl,
          pnlRealized: position.pnlRealized,
          entryPrice: position.entryPrice,
          markPrice: position.markPrice,
          size: position.size,
          side: position.side,
          notional: notional
        });
      }
      
      if (notional <= 0) {
        return { pnl: 0, pnlPct: 0 };
      }
      
      const pnlPct = (pnl / notional) * 100;
      
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
   * @param {object} account - Dados da conta
   * @returns {Promise<boolean>} - True se deve fechar por lucro mínimo
   */
  async shouldCloseForMinimumProfit(position, account) {
    try {
      const { pnl, pnlPct } = this.calculatePnL(position, account);
      
      // Obtém taxas dinâmicas baseado no volume de 30 dias via API
      const fees = await this.getFeeTier();
      
      // Calcula o profit mínimo necessário para cobrir as taxas
      const { minProfitUSD, minProfitPct, totalFees } = this.calculateMinimumProfitForFees(position, fees);
      
      // Lucro líquido (após taxas)
      const netProfit = pnl - totalFees;
      const netProfitPct = parseFloat(position.netExposureNotional || position.notional || 0) > 0 ? 
                          (netProfit / parseFloat(position.netExposureNotional || position.notional || 0)) * 100 : 0;
      
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
   * @param {object} account - Dados da conta
   * @returns {Promise<boolean>} - True se deve fechar por profit configurado
   */
  async shouldCloseForConfiguredProfit(position, account) {
    try {
      const { pnl, pnlPct } = this.calculatePnL(position, account);
      
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
      const Account = await AccountController.get();

      if (!positions || positions.length === 0) {
        return;
      }

      for (const position of positions) {
        // Verifica se deve fechar por profit mínimo baseado nas taxas (prioridade 1)
        if (await this.shouldCloseForMinimumProfit(position, Account)) {
          await OrderController.forceClose(position);
          continue;
        }

        // Verifica se deve fechar por profit mínimo configurado (prioridade 2)
        if (await this.shouldCloseForConfiguredProfit(position, Account)) {
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
        const decision = this.stopLossStrategy.shouldClosePosition(position, Account);
        
        if (decision && decision.shouldClose) {
          await OrderController.forceClose(position);
          continue;
        }

        if (decision && decision.shouldTakePartialProfit) {
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