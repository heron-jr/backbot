import { BaseStopLoss } from './BaseStopLoss.js';
import TrailingStop from '../../TrailingStop/TrailingStop.js';

export class DefaultStopLoss extends BaseStopLoss {
  /**
   * Implementação do stop loss para estratégia DEFAULT
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @param {object} marketData - Dados de mercado atuais
   * @returns {object|null} - Objeto com decisão de fechamento ou null se não deve fechar
   */
  shouldClosePosition(position, account) {
    try {
      // Validação inicial dos dados
      if (!this.validateData(position, account)) {
        console.error(`❌ [STOP_LOSS_DEBUG] ${position.symbol}: Dados inválidos - position: ${!!position}, account: ${!!account}, symbol: ${position?.symbol}, netQuantity: ${position?.netQuantity}`);
        return null;
      }

      // Configurações do stop loss - SEMPRE usar porcentagem
      const MAX_NEGATIVE_PNL_STOP_PCT = Number(process.env.MAX_NEGATIVE_PNL_STOP_PCT || -4);

      const ENABLE_TP_VALIDATION = process.env.ENABLE_TP_VALIDATION === 'true';
      
      // Verifica se os valores são válidos
      if (isNaN(MAX_NEGATIVE_PNL_STOP_PCT)) {
        console.error(`❌ [STOP_LOSS_ERROR] Valor inválido detectado:`);
        console.error(`   MAX_NEGATIVE_PNL_STOP_PCT: ${MAX_NEGATIVE_PNL_STOP_PCT} (isNaN: ${isNaN(MAX_NEGATIVE_PNL_STOP_PCT)})`);
        return null;
      }
      
      // Verifica se os valores são números finitos
      if (!isFinite(MAX_NEGATIVE_PNL_STOP_PCT)) {
        console.error(`❌ [STOP_LOSS_ERROR] Valor não finito detectado:`);
        console.error(`   MAX_NEGATIVE_PNL_STOP_PCT: ${MAX_NEGATIVE_PNL_STOP_PCT} (isFinite: ${isFinite(MAX_NEGATIVE_PNL_STOP_PCT)})`);
        return null;
      }

      // Calcula PnL
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, account);
      
      // Verifica se o PnL é válido
      if (isNaN(pnl) || isNaN(pnlPct)) {
        console.error(`❌ [STOP_LOSS_ERROR] PnL inválido detectado:`);
        console.error(`   pnl: ${pnl} (isNaN: ${isNaN(pnl)})`);
        console.error(`   pnlPct: ${pnlPct} (isNaN: ${isNaN(pnlPct)})`);
        return null;
      }

      // Verifica se o PnL está abaixo do limite negativo
      // Para valores negativos: -10% <= -4% = true (deve fechar)
      const shouldCloseByPercentage = pnlPct <= MAX_NEGATIVE_PNL_STOP_PCT;
      
      if (shouldCloseByPercentage) {
        console.log(`🚨 [STOP_LOSS] ${position.symbol}: Fechando por stop loss em %`);
        console.log(`   • PnL atual: ${pnlPct.toFixed(2)}%`);
        console.log(`   • Limite: ${MAX_NEGATIVE_PNL_STOP_PCT}%`);
        console.log(`   • Diferença: ${(pnlPct - MAX_NEGATIVE_PNL_STOP_PCT).toFixed(2)}%`);
        return {
          shouldClose: true,
          reason: `PERCENTAGE: PnL ${pnlPct}% <= limite ${MAX_NEGATIVE_PNL_STOP_PCT}%`,
          type: 'PERCENTAGE',
          pnl,
          pnlPct
        };
      }

      // Monitoramento de take profit mínimo em tempo real (se habilitada)
      if (ENABLE_TP_VALIDATION && pnl > 0) {
        const takeProfitMonitoring = this.monitorTakeProfitMinimum(position, account);
        
        if (takeProfitMonitoring && takeProfitMonitoring.shouldTakePartialProfit) {
          return takeProfitMonitoring;
        }
      }

      // Não deve fechar
      return null;

    } catch (error) {
      console.error('DefaultStopLoss.shouldClosePosition - Error:', error);
      return null;
    }
  }

} 