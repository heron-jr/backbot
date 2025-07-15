import { DefaultStrategy } from './DefaultStrategy.js';
import { ProMaxStrategy } from './ProMaxStrategy.js';

export class StrategyFactory {
  /**
   * Cria uma instância da estratégia baseada no tipo especificado
   * @param {string} strategyType - Tipo da estratégia ('DEFAULT', 'PRO_MAX')
   * @returns {BaseStrategy} - Instância da estratégia
   */
  static createStrategy(strategyType) {
    console.log(`🔍 StrategyFactory: Tipo recebido: "${strategyType}"`);
    
    const strategy = strategyType?.toUpperCase() || 'DEFAULT';
    console.log(`🔍 StrategyFactory: Tipo processado: "${strategy}"`);
    
    switch(strategy) {
      case 'DEFAULT':
        console.log(`✅ StrategyFactory: Criando estratégia DEFAULT`);
        return new DefaultStrategy();
          case 'PRO_MAX':
      console.log(`✅ StrategyFactory: Criando estratégia PRO_MAX`);
      return new ProMaxStrategy();
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
    return ['DEFAULT', 'PRO_MAX'];
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