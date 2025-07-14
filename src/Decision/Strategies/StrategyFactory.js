import { DefaultStrategy } from './DefaultStrategy.js';
import { LevelStrategy } from './LevelStrategy.js';

export class StrategyFactory {
  /**
   * Cria uma instância da estratégia baseada no tipo especificado
   * @param {string} strategyType - Tipo da estratégia ('DEFAULT', 'LEVEL')
   * @returns {BaseStrategy} - Instância da estratégia
   */
  static createStrategy(strategyType) {
    const strategy = strategyType?.toUpperCase() || 'DEFAULT';
    
    switch(strategy) {
      case 'DEFAULT':
        return new DefaultStrategy();
      case 'LEVEL':
        return new LevelStrategy();
      default:
        console.log(`⚠️ Estratégia "${strategy}" não encontrada, usando DEFAULT`);
        return new DefaultStrategy();
    }
  }

  /**
   * Lista todas as estratégias disponíveis
   * @returns {string[]} - Array com nomes das estratégias
   */
  static getAvailableStrategies() {
    return ['DEFAULT', 'LEVEL'];
  }

  /**
   * Valida se uma estratégia é suportada
   * @param {string} strategyType - Tipo da estratégia
   * @returns {boolean} - True se a estratégia é válida
   */
  static isValidStrategy(strategyType) {
    return this.getAvailableStrategies().includes(strategyType?.toUpperCase());
  }
} 