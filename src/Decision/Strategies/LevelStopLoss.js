import { BaseStopLoss } from './BaseStopLoss.js';

export class LevelStopLoss extends BaseStopLoss {
  /**
   * Implementação do stop loss para estratégia LEVEL
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @param {object} marketData - Dados de mercado atuais
   * @returns {object|null} - Objeto com decisão de fechamento ou null se não deve fechar
   */
  shouldClosePosition(position, account, marketData) {
    try {
      // Validação inicial dos dados
      if (!this.validateData(position, account)) {
        return null;
      }

      // TODO: IMPLEMENTAR LÓGICA ESPECÍFICA DA ESTRATÉGIA LEVEL
      // Por enquanto, usa a mesma lógica da DEFAULT
      console.log('🎯 LevelStopLoss: Lógica específica ainda não implementada, usando DEFAULT');

      // Configurações do stop loss (mesma da DEFAULT por enquanto)
      const STOP_LOSS_TYPE = process.env.STOP_LOSS_TYPE || 'USD';
      const USE_PERCENTAGE = STOP_LOSS_TYPE.toUpperCase() === 'PERCENTAGE';
      const MAX_NEGATIVE_PNL_STOP = Number(process.env.MAX_NEGATIVE_PNL_STOP || -5);
      const MAX_NEGATIVE_PNL_STOP_PCT = Number(process.env.MAX_NEGATIVE_PNL_STOP_PCT || -4);
      const MINIMAL_VOLUME = Number(process.env.MINIMAL_VOLUME || 50);

      // Verifica volume mínimo
      if (this.isVolumeBelowMinimum(position, MINIMAL_VOLUME)) {
        return {
          shouldClose: true,
          reason: `VOLUME_MIN: Volume ${Number(position.netExposureNotional)} menor que mínimo ${MINIMAL_VOLUME}`,
          type: 'VOLUME_MIN'
        };
      }

      // Calcula PnL
      const { pnl, pnlPct } = this.calculatePnL(position, account);

      // Verifica stop loss baseado no tipo configurado
      if (USE_PERCENTAGE) {
        if (pnlPct <= MAX_NEGATIVE_PNL_STOP_PCT) {
          return {
            shouldClose: true,
            reason: `PERCENTAGE: PnL ${pnlPct}% <= limite ${MAX_NEGATIVE_PNL_STOP_PCT}%`,
            type: 'PERCENTAGE',
            pnl,
            pnlPct
          };
        }
      } else {
        if (pnl <= MAX_NEGATIVE_PNL_STOP) {
          return {
            shouldClose: true,
            reason: `USD: PnL $${pnl.toFixed(2)} <= limite $${MAX_NEGATIVE_PNL_STOP}`,
            type: 'USD',
            pnl,
            pnlPct
          };
        }
      }

      // Não deve fechar
      return null;

    } catch (error) {
      console.error('LevelStopLoss.shouldClosePosition - Error:', error);
      return null;
    }
  }

  /**
   * Método auxiliar para análise específica da estratégia LEVEL
   * @param {object} marketData - Dados de mercado
   * @returns {object} - Análise específica da estratégia
   */
  analyzeLevelSpecificStopLoss(marketData) {
    // TODO: Implementar análises específicas da estratégia LEVEL
    return {
      // Exemplo de análises que podem ser implementadas:
      // levelSupport: this.findLevelSupport(marketData),
      // levelResistance: this.findLevelResistance(marketData),
      // volumeProfile: this.analyzeVolumeProfile(marketData),
      // priceAction: this.analyzePriceAction(marketData)
    };
  }
} 