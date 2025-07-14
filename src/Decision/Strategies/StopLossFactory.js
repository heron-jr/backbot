import { DefaultStopLoss } from './DefaultStopLoss.js';
import { LevelStopLoss } from './LevelStopLoss.js';

export class StopLossFactory {
  /**
   * Cria uma instância do stop loss baseada na estratégia
   * @param {string} strategyType - Tipo da estratégia ('DEFAULT', 'LEVEL')
   * @returns {BaseStopLoss} - Instância do stop loss
   */
  static createStopLoss(strategyType) {
    const strategy = strategyType?.toUpperCase() || 'DEFAULT';
    
    switch(strategy) {
      case 'DEFAULT':
        return new DefaultStopLoss();
      case 'LEVEL':
        return new LevelStopLoss();
      default:
        console.log(`⚠️ Stop loss para estratégia "${strategy}" não encontrado, usando DEFAULT`);
        return new DefaultStopLoss();
    }
  }

  /**
   * Lista todos os stop losses disponíveis
   * @returns {string[]} - Array com nomes dos stop losses
   */
  static getAvailableStopLosses() {
    return ['DEFAULT', 'LEVEL'];
  }

  /**
   * Valida se um stop loss é suportado
   * @param {string} strategyType - Tipo da estratégia
   * @returns {boolean} - True se o stop loss é válido
   */
  static isValidStopLoss(strategyType) {
    return this.getAvailableStopLosses().includes(strategyType?.toUpperCase());
  }
} 