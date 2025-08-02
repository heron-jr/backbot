import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';
import PnlController from '../Controllers/PnlController.js';
import Markets from '../Backpack/Public/Markets.js';
import AccountController from '../Controllers/AccountController.js';
import { validateLeverageForSymbol, clearLeverageAdjustLog } from '../Utils/Utils.js';
import ColorLogger from '../Utils/ColorLogger.js';
import { promises as fs } from 'fs';
import path from 'path';

class TrailingStop {

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

  // Gerenciador de estado do trailing stop para cada posição
  static trailingState = new Map(); // Ex: { 'SOL_USDC_PERP': { trailingStopPrice: 180.50, highestPrice: 182.00, lowestPrice: 175.00, phase: 'INITIAL_RISK', initialAtrStopPrice: 175.00, partialTakeProfitPrice: 185.00 } }
  static trailingModeLogged = new Set(); // Cache para logs de modo Trailing Stop

  // Instância do ColorLogger para logs coloridos
  static colorLogger = new ColorLogger('TRAILING', 'STOP');

  // Caminho para o arquivo de persistência
  static persistenceFilePath = path.join(process.cwd(), 'persistence', 'trailing_state.json');

  // Controle de debounce para evitar salvamentos excessivos
  static saveTimeout = null;
  static lastSaveTime = 0;
  static saveDebounceMs = 5000; // Salva no máximo a cada 5 segundos

  /**
   * Salva o estado do trailing stop em arquivo JSON com debounce
   */
  static async saveStateToFile() {
    try {
      const now = Date.now();
      
      // Se tentou salvar muito recentemente, agenda para depois
      if (now - TrailingStop.lastSaveTime < TrailingStop.saveDebounceMs) {
        // Limpa timeout anterior se existir
        if (TrailingStop.saveTimeout) {
          clearTimeout(TrailingStop.saveTimeout);
        }
        
        // Agenda novo salvamento
        TrailingStop.saveTimeout = setTimeout(async () => {
          await TrailingStop.saveStateToFile();
        }, TrailingStop.saveDebounceMs - (now - TrailingStop.lastSaveTime));
        
        return;
      }
      
      TrailingStop.lastSaveTime = now;
      
      const serializableState = Array.from(TrailingStop.trailingState.entries());
      
      const dir = path.dirname(TrailingStop.persistenceFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(TrailingStop.persistenceFilePath, JSON.stringify(serializableState, null, 2));
      
      TrailingStop.debug(`💾 [PERSISTENCE] Estado do trailing stop salvo: ${serializableState.length} posições`);
    } catch (error) {
      console.error(`❌ [PERSISTENCE] Erro ao salvar estado do trailing stop:`, error.message);
    }
  }

  /**
   * Carrega o estado do trailing stop do arquivo JSON.
   */
  static async loadStateFromFile() {
    try {
      try {
        await fs.access(TrailingStop.persistenceFilePath);
      } catch (error) {
        console.log(`ℹ️ [PERSISTENCE] Arquivo de estado não encontrado, iniciando com estado vazio`);
        return;
      }
      
      const fileContent = await fs.readFile(TrailingStop.persistenceFilePath, 'utf8');
      const serializableState = JSON.parse(fileContent);
      
      TrailingStop.trailingState = new Map(serializableState);
      
      console.log(`📂 [PERSISTENCE] Estado do trailing stop carregado: ${TrailingStop.trailingState.size} posições`);
      
      for (const [symbol, state] of TrailingStop.trailingState.entries()) {
        console.log(`📊 [PERSISTENCE] ${symbol}: Trailing Stop: $${state.trailingStopPrice?.toFixed(4) || 'N/A'}, Ativo: ${state.activated}`);
      }
    } catch (error) {
      console.error(`❌ [PERSISTENCE] Erro ao carregar estado do trailing stop:`, error.message);
      console.log(`🔄 [PERSISTENCE] Iniciando com estado vazio devido ao erro`);
      TrailingStop.trailingState = new Map();
    }
  }

  /**
   * Limpa estados obsoletos que não correspondem a posições abertas atuais.
   */
  static async cleanupObsoleteStates() {
    try {
      console.log(`🧹 [CLEANUP] Verificando estados obsoletos do Trailing Stop...`);
      
      const positions = await Futures.getOpenPositions();
      const openSymbols = positions ? positions.map(p => p.symbol) : [];
      
      let cleanedStates = 0;
      const statesToRemove = [];
      
      for (const [symbol, state] of TrailingStop.trailingState.entries()) {
        if (!openSymbols.includes(symbol)) {
          statesToRemove.push(symbol);
          console.log(`🗑️ [CLEANUP] ${symbol}: Estado removido - posição não está mais aberta`);
        }
      }
      
      for (const symbol of statesToRemove) {
        TrailingStop.trailingState.delete(symbol);
        cleanedStates++;
      }
      
      if (cleanedStates > 0) {
        console.log(`💾 [CLEANUP] Salvando estado limpo com ${cleanedStates} estados removidos...`);
        await TrailingStop.saveStateToFile();
        console.log(`✅ [CLEANUP] Limpeza concluída: ${cleanedStates} estados obsoletos removidos`);
      } else {
        console.log(`ℹ️ [CLEANUP] Nenhum estado obsoleto encontrado`);
      }
      
    } catch (error) {
      console.error(`❌ [CLEANUP] Erro durante limpeza:`, error.message);
    }
  }

  /**
   * Preenche o estado do Trailing Stop para posições abertas existentes
   * que não possuem estado inicial (migração automática)
   */
  static async backfillStateForOpenPositions() {
    try {
      console.log(`🔄 [MIGRATION] Iniciando migração do Trailing Stop...`);
      
      console.log(`🧹 [MIGRATION] Limpando arquivo de persistência para dados frescos...`);
      await TrailingStop.forceCleanupAllStates();
      
      console.log(`📋 [MIGRATION] Obtendo posições abertas atuais...`);
      
      const positions = await Futures.getOpenPositions();
      if (!positions || positions.length === 0) {
        console.log(`ℹ️ [MIGRATION] Nenhuma posição aberta encontrada para migração`);
        return;
      }

      console.log(`📋 [MIGRATION] Encontradas ${positions.length} posições abertas para verificação`);
      
      let newStatesCreated = 0;
      const Account = await AccountController.get();

      for (const position of positions) {
        if (TrailingStop.trailingState.has(position.symbol)) {
          console.log(`ℹ️ [MIGRATION] ${position.symbol}: Estado já existe, pulando...`);
          continue;
        }

        const marketInfo = Account.markets?.find(market => market.symbol === position.symbol);
        if (!marketInfo) {
          console.log(`⚠️ [MIGRATION] ${position.symbol}: Par não autorizado, pulando...`);
          continue;
        }

        console.log(`🔄 [MIGRATION] ${position.symbol}: Criando estado inicial do Trailing Stop...`);

        const entryPrice = parseFloat(position.entryPrice || position.markPrice || 0);
        const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
        
        const netQuantity = parseFloat(position.netQuantity || 0);
        const isLong = netQuantity > 0;
        const isShort = netQuantity < 0;

        if (!isLong && !isShort) {
          console.log(`⚠️ [MIGRATION] ${position.symbol}: Posição neutra, pulando...`);
          continue;
        }

        const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);
        const shouldActivate = pnl > 0;
        
        // Verifica se deve usar estratégia híbrida ATR
        const enableHybridStrategy = process.env.ENABLE_HYBRID_STOP_STRATEGY === 'true';
        let initialState;
        
        if (enableHybridStrategy) {
          // Recupera ou calcula ATR para estratégia híbrida
          const atrValue = await TrailingStop.getAtrValue(position.symbol);
          const initialStopAtrMultiplier = Number(process.env.INITIAL_STOP_ATR_MULTIPLIER || 2.0);
          const takeProfitAtrMultiplier = Number(process.env.TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER || 1.5);
          
          const initialAtrStopPrice = TrailingStop.calculateAtrStopLossPrice(position, Account, atrValue, initialStopAtrMultiplier);
          const partialTakeProfitPrice = TrailingStop.calculateAtrTakeProfitPrice(position, atrValue, takeProfitAtrMultiplier);
          
          initialState = {
            symbol: position.symbol,
            entryPrice: entryPrice,
            isLong: isLong,
            isShort: isShort,
            initialStopLossPrice: initialAtrStopPrice,
            trailingStopPrice: initialAtrStopPrice,
            initialAtrStopPrice: initialAtrStopPrice,
            partialTakeProfitPrice: partialTakeProfitPrice,
            atrValue: atrValue,
            atrMultiplier: initialStopAtrMultiplier,
            takeProfitAtrMultiplier: takeProfitAtrMultiplier,
            strategyType: 'HYBRID_ATR',
            phase: 'INITIAL_RISK',
            highestPrice: isLong ? currentPrice : null,
            lowestPrice: isShort ? currentPrice : null,
            activated: shouldActivate,
            initialized: shouldActivate,
            createdAt: new Date().toISOString()
          };
          
          console.log(`🎯 [MIGRATION] ${position.symbol}: Stop Loss Inteligente configurado - Volatilidade: ${atrValue.toFixed(6)}, Stop Loss: $${initialAtrStopPrice.toFixed(4)}, Take Profit Parcial: $${partialTakeProfitPrice.toFixed(4)}`);
        } else {
          // Estratégia tradicional
          const initialStopLossPrice = TrailingStop.calculateInitialStopLossPrice(position, Account);
          
          initialState = {
            symbol: position.symbol,
            entryPrice: entryPrice,
            isLong: isLong,
            isShort: isShort,
            initialStopLossPrice: initialStopLossPrice,
            highestPrice: isLong ? currentPrice : null,
            lowestPrice: isShort ? currentPrice : null,
            trailingStopPrice: initialStopLossPrice,
            strategyType: 'TRADITIONAL',
            activated: shouldActivate,
            initialized: shouldActivate,
            createdAt: new Date().toISOString()
          };
        }

        TrailingStop.trailingState.set(position.symbol, initialState);
        newStatesCreated++;

        if (shouldActivate) {
          console.log(`✅ [MIGRATION] ${position.symbol}: Estado ATIVADO durante migração - PnL: ${pnlPct.toFixed(2)}%, Entry: $${entryPrice.toFixed(4)}, Atual: $${currentPrice.toFixed(4)}, Stop Inicial: $${initialState.initialStopLossPrice?.toFixed(4) || 'N/A'}, Tipo: ${isLong ? 'LONG' : 'SHORT'}`);
        } else {
          console.log(`✅ [MIGRATION] ${position.symbol}: Estado criado (aguardando lucro) - PnL: ${pnlPct.toFixed(2)}%, Entry: $${entryPrice.toFixed(4)}, Atual: $${currentPrice.toFixed(4)}, Stop Inicial: $${initialState.initialStopLossPrice?.toFixed(4) || 'N/A'}, Tipo: ${isLong ? 'LONG' : 'SHORT'}`);
        }
      }

      if (newStatesCreated > 0) {
        console.log(`💾 [MIGRATION] Salvando ${newStatesCreated} estados frescos no arquivo...`);
        await TrailingStop.saveStateToFile();
        console.log(`✅ [MIGRATION] Migração concluída: ${newStatesCreated} estados criados com dados atuais`);
      } else {
        console.log(`ℹ️ [MIGRATION] Nenhum novo estado necessário - arquivo limpo e atualizado`);
      }

    } catch (error) {
      console.error(`❌ [MIGRATION] Erro durante migração:`, error.message);
    }
  }

  /**
   * Recupera estado ATR para posições existentes
   * @param {string} symbol - Símbolo do mercado
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {object|null} - Estado ATR recuperado ou null
   */
  static async recoverAtrState(symbol, position, account) {
    try {
      const existingState = TrailingStop.trailingState.get(symbol);
      
      if (existingState && existingState.strategyType === 'HYBRID_ATR') {
        console.log(`🔄 [ATR_RECOVERY] ${symbol}: Recuperando estado ATR existente - ATR: ${existingState.atrValue?.toFixed(6) || 'N/A'}, Stop: $${existingState.initialAtrStopPrice?.toFixed(4) || 'N/A'}, Fase: ${existingState.phase || 'N/A'}`);
        return existingState;
      }
      
      // Se não existe estado ATR, cria um novo
      const enableHybridStrategy = process.env.ENABLE_HYBRID_STOP_STRATEGY === 'true';
      if (enableHybridStrategy) {
        const atrValue = await TrailingStop.getAtrValue(symbol);
        const initialStopAtrMultiplier = Number(process.env.INITIAL_STOP_ATR_MULTIPLIER || 2.0);
        const takeProfitAtrMultiplier = Number(process.env.TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER || 1.5);
        
        const initialAtrStopPrice = TrailingStop.calculateAtrStopLossPrice(position, account, atrValue, initialStopAtrMultiplier);
        const partialTakeProfitPrice = TrailingStop.calculateAtrTakeProfitPrice(position, atrValue, takeProfitAtrMultiplier);
        
        const recoveredState = {
          symbol: symbol,
          entryPrice: parseFloat(position.entryPrice || position.markPrice || 0),
          initialStopLossPrice: initialAtrStopPrice,
          trailingStopPrice: initialAtrStopPrice,
          initialAtrStopPrice: initialAtrStopPrice,
          partialTakeProfitPrice: partialTakeProfitPrice,
          atrValue: atrValue,
          atrMultiplier: initialStopAtrMultiplier,
          takeProfitAtrMultiplier: takeProfitAtrMultiplier,
          strategyType: 'HYBRID_ATR',
          phase: 'INITIAL_RISK',
          isLong: parseFloat(position.netQuantity || 0) > 0,
          isShort: parseFloat(position.netQuantity || 0) < 0,
          highestPrice: null,
          lowestPrice: null,
          activated: true,
          initialized: true,
          createdAt: new Date().toISOString()
        };
        
        TrailingStop.trailingState.set(symbol, recoveredState);
        await TrailingStop.saveStateToFile();
        
        console.log(`🎯 [ATR_RECOVERY] ${symbol}: Stop Loss Inteligente configurado - Volatilidade: ${atrValue.toFixed(6)}, Stop Loss: $${initialAtrStopPrice.toFixed(4)}, Take Profit Parcial: $${partialTakeProfitPrice.toFixed(4)}`);
        return recoveredState;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [ATR_RECOVERY] Erro ao recuperar estado ATR para ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Função de debug condicional
   * @param {string} message - Mensagem de debug
   */
  static debug(message) {
    if (process.env.LOG_TYPE === 'debug') {
      console.log(message);
    }
  }

  /**
   * Versão estática da função calculatePnL para uso externo
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {object} - Objeto com pnl e pnlPct
   */
  static calculatePnL(position, account) {
    try { 
      // Usa pnlRealized + pnlUnrealized para obter o PnL total correto
      const pnlRealized = parseFloat(position.pnlRealized ?? '0');
      const pnlUnrealized = parseFloat(position.pnlUnrealized ?? '0');
      const pnl = pnlRealized + pnlUnrealized;

      const notionalValue = Math.abs(parseFloat(position.netCost ?? '0'));
      
      const rawLeverage = Number(account?.leverage);
      
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const costBasis = notionalValue / leverage;

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
   * Calcula o preço de stop loss inicial baseado na configuração
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {number} - Preço de stop loss inicial
   */
  static calculateInitialStopLossPrice(position, account) {
    try {
      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      
      if (!account?.leverage) {
        console.error(`❌ [STOP_LOSS_ERROR] ${position.symbol}: Alavancagem não encontrada na Account`);
        return null;
      }
      
      const rawLeverage = Number(account.leverage);
      
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const baseStopLossPct = Math.abs(Number(process.env.MAX_NEGATIVE_PNL_STOP_PCT || -10));
      
      const actualStopLossPct = baseStopLossPct / leverage;
      
      const isLong = parseFloat(position.netQuantity) > 0;
      
      const initialStopLossPrice = isLong 
        ? currentPrice * (1 - actualStopLossPct / 100)
        : currentPrice * (1 + actualStopLossPct / 100);
      
      return initialStopLossPrice;
    } catch (error) {
      console.error(`[INITIAL_STOP] Erro ao calcular stop loss inicial para ${position.symbol}:`, error.message);
      return 0;
    }
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
  static async clearTrailingState(symbol, reason = 'manual') {
    if (TrailingStop.trailingState.has(symbol)) {
      const state = TrailingStop.trailingState.get(symbol);
      TrailingStop.trailingState.delete(symbol);
      TrailingStop.colorLogger.trailingCleanup(`${symbol}: Estado limpo (${reason}) - Trailing Stop: $${state?.trailingStopPrice?.toFixed(4) || 'N/A'}`);
      
      TrailingStop.trailingModeLogged.delete(symbol);
      
      await TrailingStop.saveStateToFile();
    }
  }

  /**
   * Limpa o estado do trailing stop quando uma posição é fechada
   * @param {object} position - Dados da posição que foi fechada
   * @param {string} closeReason - Motivo do fechamento
   */
  static async onPositionClosed(position, closeReason) {
    if (position && position.symbol) {
      await TrailingStop.clearTrailingState(position.symbol, `posição fechada: ${closeReason}`);
      
      clearLeverageAdjustLog(position.symbol);
    }
  }

  /**
   * Força a limpeza completa do estado do Trailing Stop
   * Útil quando o bot é reiniciado e precisa começar do zero
   */
  static async forceCleanupAllStates() {
    try {
      console.log(`🧹 [FORCE_CLEANUP] Limpeza completa do estado do Trailing Stop...`);
      
      const stateCount = TrailingStop.trailingState.size;
      TrailingStop.trailingState.clear();
      
      TrailingStop.trailingModeLogged.clear();
      
      clearLeverageAdjustLog();
      
      try {
        await fs.unlink(TrailingStop.persistenceFilePath);
        console.log(`🗑️ [FORCE_CLEANUP] Arquivo de persistência removido`);
      } catch (error) {
        console.log(`ℹ️ [FORCE_CLEANUP] Arquivo de persistência não encontrado`);
      }
      
      console.log(`✅ [FORCE_CLEANUP] Limpeza completa concluída: ${stateCount} estados removidos`);
      
    } catch (error) {
      console.error(`❌ [FORCE_CLEANUP] Erro durante limpeza completa:`, error.message);
    }
  }

  /**
   * Calcula o preço de stop loss baseado em ATR
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @param {number} atrValue - Valor do ATR
   * @param {number} multiplier - Multiplicador do ATR
   * @returns {number} - Preço de stop loss baseado em ATR
   */
  static calculateAtrStopLossPrice(position, account, atrValue, multiplier = 2.0) {
    try {
      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      if (currentPrice <= 0 || !atrValue || atrValue <= 0) {
        return TrailingStop.calculateInitialStopLossPrice(position, account);
      }

      const isLong = parseFloat(position.netQuantity) > 0;
      const atrDistance = atrValue * multiplier;

      if (isLong) {
        return currentPrice - atrDistance;
      } else {
        return currentPrice + atrDistance;
      }
    } catch (error) {
      console.error(`[ATR_STOP_CALC] Erro ao calcular stop loss ATR para ${position.symbol}:`, error.message);
      return TrailingStop.calculateInitialStopLossPrice(position, account);
    }
  }

  /**
   * Calcula o preço de take profit parcial baseado em ATR
   * @param {object} position - Dados da posição
   * @param {number} atrValue - Valor do ATR
   * @param {number} multiplier - Multiplicador do ATR
   * @returns {number} - Preço de take profit parcial
   */
  static calculateAtrTakeProfitPrice(position, atrValue, multiplier = 1.5) {
    try {
      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      if (currentPrice <= 0 || !atrValue || atrValue <= 0) {
        return currentPrice;
      }

      const isLong = parseFloat(position.netQuantity) > 0;
      const atrDistance = atrValue * multiplier;

      if (isLong) {
        return currentPrice + atrDistance;
      } else {
        return currentPrice - atrDistance;
      }
    } catch (error) {
      console.error(`[ATR_TP_CALC] Erro ao calcular take profit ATR para ${position.symbol}:`, error.message);
      return currentPrice;
    }
  }

  /**
   * Obtém o valor do ATR para um símbolo
   * @param {string} symbol - Símbolo da posição
   * @returns {Promise<number|null>} - Valor do ATR ou null se não disponível
   */
  static async getAtrValue(symbol) {
    try {
      const timeframe = process.env.ACCOUNT1_TIME || '30m';
      const candles = await Markets.getKLines(symbol, timeframe, 30);
      
      if (!candles || candles.length < 14) {
        return null;
      }

      const { calculateIndicators } = await import('../Decision/Indicators.js');
      const indicators = calculateIndicators(candles);
      
      return indicators.atr?.atr || null;
    } catch (error) {
      console.error(`[ATR_GET] Erro ao obter ATR para ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Atualiza o trailing stop para uma posição específica
   * 
   * 🛡️ IMPORTANTE: Este método trabalha em PARALELO com o failsafe de segurança.
   * O failsafe (MAX_NEGATIVE_PNL_STOP_PCT) é SEMPRE criado na corretora como rede de segurança.
   * Este monitoramento tático (ATR) é uma camada adicional de inteligência que pode fechar
   * a posição antes que o failsafe seja atingido.
   * 
   * @param {object} position - Dados da posição
   * @returns {object|null} - Estado atualizado do trailing stop ou null se não aplicável
   */
  async updateTrailingStopForPosition(position) {
    try {
      const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';
      const enableHybridStrategy = process.env.ENABLE_HYBRID_STOP_STRATEGY === 'true';
      
      if (!enableTrailingStop) {
        return null;
      }

      const Account = await AccountController.get();
      
      if (!Account.leverage) {
        console.error(`❌ [TRAILING_ERROR] ${position.symbol}: Alavancagem não encontrada na Account`);
        return null;
      }
      
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);
      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      const entryPrice = parseFloat(position.entryPrice || 0);
      
      if (currentPrice <= 0 || entryPrice <= 0) {
        console.error(`❌ [TRAILING_ERROR] Preços inválidos para ${position.symbol}: Current: ${currentPrice}, Entry: ${entryPrice}`);
        return null;
      }

      const isLong = parseFloat(position.netQuantity) > 0;
      const isShort = parseFloat(position.netQuantity) < 0;

      if (!isLong && !isShort) {
        return null;
      }

      let trailingState = TrailingStop.trailingState.get(position.symbol);

      // === ESTRATÉGIA HÍBRIDA (ATR) ===
      if (enableHybridStrategy) {
        // Se não existe estado, tenta recuperar estado ATR
        if (!trailingState) {
          trailingState = await TrailingStop.recoverAtrState(position.symbol, position, Account);
        }
        return await this.updateTrailingStopHybrid(position, trailingState, Account, pnl, pnlPct, currentPrice, entryPrice, isLong, isShort);
      }

      // === ESTRATÉGIA TRADICIONAL ===
      return await this.updateTrailingStopTraditional(position, trailingState, Account, pnl, pnlPct, currentPrice, entryPrice, isLong, isShort);

    } catch (error) {
      console.error(`[TRAILING_UPDATE] Erro ao atualizar trailing stop para ${position.symbol}:`, error.message);
      return null;
    } finally {
      await TrailingStop.saveStateToFile();
    }
  }

  /**
   * Atualiza trailing stop usando a estratégia híbrida (ATR)
   * 
   * 🛡️ SEGURANÇA: Este método trabalha em PARALELO com o failsafe.
   * O failsafe (MAX_NEGATIVE_PNL_STOP_PCT) é SEMPRE criado na corretora.
   * Este monitoramento tático pode fechar a posição antes do failsafe.
   */
  async updateTrailingStopHybrid(position, trailingState, account, pnl, pnlPct, currentPrice, entryPrice, isLong, isShort) {
    try {
      // === FASE 1: RISCO INICIAL ===
      if (!trailingState) {
        // Inicializa nova posição na fase de risco inicial
        const atrValue = await TrailingStop.getAtrValue(position.symbol);
        const initialStopAtrMultiplier = Number(process.env.INITIAL_STOP_ATR_MULTIPLIER || 2.0);
        const takeProfitAtrMultiplier = Number(process.env.TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER || 1.5);
        
        // 1. CALCULAR OS DOIS STOPS
        // a) Stop Tático (ATR)
        const atrStopPrice = TrailingStop.calculateAtrStopLossPrice(position, account, atrValue, initialStopAtrMultiplier);
        
        // b) Stop de Segurança Máxima (PnL)
        const maxPnlStopPrice = TrailingStop.calculateInitialStopLossPrice(position, account);
        
        // 2. LOGAR OS CÁLCULOS PARA TRANSPARÊNCIA
        console.log(`🔍 [STOP_CALC] ${position.symbol}: Stop Tático (ATR) calculado em $${atrStopPrice?.toFixed(4) || 'N/A'}`);
        console.log(`🔍 [STOP_CALC] ${position.symbol}: Stop de Segurança Máxima (${process.env.MAX_NEGATIVE_PNL_STOP_PCT}%) calculado em $${maxPnlStopPrice?.toFixed(4) || 'N/A'}`);
        
        // 3. TOMAR E LOGAR A DECISÃO
        // Para uma COMPRA (LONG), o stop mais seguro é o mais ALTO.
        // Para uma VENDA (SHORT), o stop mais seguro é o mais BAIXO.
        const finalStopPrice = isLong 
          ? Math.max(atrStopPrice || 0, maxPnlStopPrice || 0) 
          : Math.min(atrStopPrice || 0, maxPnlStopPrice || 0);
        
        console.log(`✅ [STOP_DECISION] ${position.symbol}: Stop tático ATIVO definido para $${finalStopPrice.toFixed(4)} (o mais seguro dos dois).`);
        
        const partialTakeProfitPrice = TrailingStop.calculateAtrTakeProfitPrice(position, atrValue, takeProfitAtrMultiplier);
        
        // 🎯 CRIAR ORDEM LIMIT DE TAKE PROFIT PARCIAL
        const partialPercentage = Number(process.env.PARTIAL_PROFIT_PERCENTAGE || 50);
        console.log(`🎯 [TP_LIMIT_SETUP] ${position.symbol}: Configurando ordem LIMIT de take profit parcial`);
        console.log(`📊 [TP_LIMIT_SETUP] ${position.symbol}: Preço: $${partialTakeProfitPrice?.toFixed(4) || 'N/A'}, Quantidade: ${partialPercentage}%`);
        
        // Cria a ordem LIMIT de take profit parcial na corretora
        const tpOrderResult = await OrderController.createPartialTakeProfitOrder(position, partialTakeProfitPrice, partialPercentage, account);
        
        if (tpOrderResult) {
          console.log(`✅ [TP_LIMIT_SETUP] ${position.symbol}: Ordem LIMIT de take profit parcial criada com sucesso!`);
        } else {
          console.warn(`⚠️ [TP_LIMIT_SETUP] ${position.symbol}: Falha ao criar ordem LIMIT de take profit parcial`);
        }
        
        const newState = {
          symbol: position.symbol,
          entryPrice: entryPrice,
          initialStopLossPrice: finalStopPrice,
          trailingStopPrice: finalStopPrice,
          initialAtrStopPrice: finalStopPrice,
          partialTakeProfitPrice: partialTakeProfitPrice,
          originalQuantity: Math.abs(parseFloat(position.netQuantity)), // Para rastrear take profit
          atrValue: atrValue,
          atrMultiplier: initialStopAtrMultiplier,
          takeProfitAtrMultiplier: takeProfitAtrMultiplier,
          strategyType: 'HYBRID_ATR',
          highestPrice: isLong ? currentPrice : null,
          lowestPrice: isShort ? currentPrice : null,
          isLong: isLong,
          isShort: isShort,
          phase: 'INITIAL_RISK',
          activated: true,
          initialized: true,
          createdAt: new Date().toISOString()
        };

        TrailingStop.trailingState.set(position.symbol, newState);
        await TrailingStop.saveStateToFile();
        
        TrailingStop.colorLogger.trailingActivated(`${position.symbol}: 🎯 Stop Loss Inteligente ATIVADO! Fase: Proteção Inicial - PnL: ${pnlPct.toFixed(2)}%, Entrada: $${entryPrice.toFixed(4)}, Atual: $${currentPrice.toFixed(4)}, Volatilidade: ${atrValue?.toFixed(6) || 'N/A'}, Stop Loss Final: $${finalStopPrice?.toFixed(4) || 'N/A'}, Take Profit: $${partialTakeProfitPrice?.toFixed(4) || 'N/A'}`);
        
        return newState;
      }

      // === FASE 2: MONITORAMENTO DE ORDEM LIMIT ===
      // Verifica se a ordem LIMIT de take profit parcial existe
      if (trailingState.phase === 'INITIAL_RISK') {
        const enableHybridStrategy = process.env.ENABLE_HYBRID_STOP_STRATEGY === 'true';
        
        if (enableHybridStrategy) {
          // Verifica se a ordem LIMIT de take profit parcial existe
          const hasPartialOrder = await OrderController.hasPartialTakeProfitOrder(position.symbol, position, account);
          
          if (!hasPartialOrder) {
            // Recria a ordem LIMIT de take profit parcial
            const partialTakeProfitPrice = TrailingStop.calculateAtrTakeProfitPrice(position, trailingState.atrValue, trailingState.takeProfitAtrMultiplier);
            const partialPercentage = Number(process.env.PARTIAL_PROFIT_PERCENTAGE || 50);
            
            await OrderController.createPartialTakeProfitOrder(position, partialTakeProfitPrice, partialPercentage, account);
          }
        }
        
        // Verifica se a ordem LIMIT foi executada (posição reduzida)
        const currentQuantity = Math.abs(parseFloat(position.netQuantity));
        const originalQuantity = Math.abs(parseFloat(trailingState.originalQuantity || position.netQuantity));
        const partialPercentage = Number(process.env.PARTIAL_PROFIT_PERCENTAGE || 50);
        const expectedRemainingQuantity = originalQuantity * (1 - partialPercentage / 100);
        
        // Se a quantidade foi reduzida, significa que o take profit foi executado
        if (currentQuantity <= expectedRemainingQuantity * 1.01) { // 1% de tolerância
          trailingState.phase = 'PARTIAL_PROFIT_TAKEN';
          trailingState.trailingStopPrice = entryPrice; // Move para breakeven
          
          TrailingStop.colorLogger.trailingUpdate(`${position.symbol}: 🎯 Take Profit Parcial EXECUTADO! (${partialPercentage}% da posição) - Stop movido para breakeven: $${entryPrice.toFixed(4)}`);
          
          // 🛡️ CANCELAR STOP LOSS ANTIGO E CRIAR NOVO NO BREAKEVEN
          console.log(`🔄 [BREAKEVEN] ${position.symbol}: Cancelando stop loss antigo e criando novo no breakeven...`);
          
          try {
            // Cancela ordens de stop loss existentes
            await OrderController.cancelFailsafeOrders(position.symbol, account.accountId);
            console.log(`✅ [BREAKEVEN] ${position.symbol}: Stop loss antigo cancelado`);
            
            // Cria nova ordem de stop loss no breakeven
            const newStopLossResult = await OrderController.validateAndCreateStopLoss(position, account.accountId);
            
            if (newStopLossResult) {
              console.log(`✅ [BREAKEVEN] ${position.symbol}: Nova ordem de stop loss criada no breakeven: $${entryPrice.toFixed(4)}`);
            } else {
              console.warn(`⚠️ [BREAKEVEN] ${position.symbol}: Falha ao criar nova ordem de stop loss no breakeven`);
            }
          } catch (error) {
            console.error(`❌ [BREAKEVEN] ${position.symbol}: Erro ao atualizar stop loss para breakeven:`, error.message);
          }
          
          await TrailingStop.saveStateToFile();
          
          return trailingState;
        }
      }

      // Verifica se deve fechar por stop loss inicial
      const shouldCloseByInitialStop = isLong 
        ? currentPrice <= trailingState.initialAtrStopPrice
        : currentPrice >= trailingState.initialAtrStopPrice;

      if (shouldCloseByInitialStop) {
        TrailingStop.colorLogger.trailingTrigger(`${position.symbol}: 🛑 Stop Loss Inteligente ATINGIDO! Preço Atual: $${currentPrice.toFixed(4)}, Stop ATR: $${trailingState.initialAtrStopPrice?.toFixed(4) || 'N/A'}, ATR: ${trailingState.atrValue?.toFixed(6) || 'N/A'}`);
        return {
          shouldClose: true,
          reason: `Stop Loss Inteligente: Preço $${currentPrice.toFixed(4)} cruzou stop loss $${trailingState.initialAtrStopPrice?.toFixed(4) || 'N/A'}`,
          type: 'HYBRID_INITIAL_STOP',
          trailingStopPrice: trailingState.initialAtrStopPrice,
          currentPrice: currentPrice
        };
      }

      // === FASE 3: MAXIMIZAÇÃO ===
      if (trailingState.phase === 'PARTIAL_PROFIT_TAKEN' || trailingState.phase === 'TRAILING') {
        // Transição para fase TRAILING se ainda não estiver
        if (trailingState.phase === 'PARTIAL_PROFIT_TAKEN') {
          trailingState.phase = 'TRAILING';
        }

        // Lógica tradicional de trailing stop
        const trailingStopDistance = Number(process.env.TRAILING_STOP_DISTANCE || 1.5);
        
        if (isLong) {
          if (currentPrice > trailingState.highestPrice || trailingState.highestPrice === null) {
            trailingState.highestPrice = currentPrice;
            
            const newTrailingStopPrice = currentPrice * (1 - (trailingStopDistance / 100));
            const currentStopPrice = trailingState.trailingStopPrice;
            
            const finalStopPrice = Math.max(currentStopPrice, newTrailingStopPrice);
            
            if (finalStopPrice > currentStopPrice) {
              trailingState.trailingStopPrice = finalStopPrice;
              TrailingStop.colorLogger.trailingUpdate(`${position.symbol}: 📈 Maximizando Lucros! LONG - Preço: $${currentPrice.toFixed(4)}, Stop Loss Ajustado: $${finalStopPrice.toFixed(4)}`);
            }
          }
        } else if (isShort) {
          if (currentPrice < trailingState.lowestPrice || trailingState.lowestPrice === null) {
            trailingState.lowestPrice = currentPrice;
            
            const newTrailingStopPrice = currentPrice * (1 + (trailingStopDistance / 100));
            const currentStopPrice = trailingState.trailingStopPrice;
            const finalStopPrice = Math.min(currentStopPrice, newTrailingStopPrice);
            
            if (finalStopPrice < currentStopPrice) {
              trailingState.trailingStopPrice = finalStopPrice;
              TrailingStop.colorLogger.trailingUpdate(`${position.symbol}: 📈 Maximizando Lucros! SHORT - Preço: $${currentPrice.toFixed(4)}, Stop Loss Ajustado: $${finalStopPrice.toFixed(4)}`);
            }
          }
        }
      }

      return trailingState;

    } catch (error) {
      console.error(`[HYBRID_TRAILING] Erro ao atualizar trailing stop híbrido para ${position.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Atualiza trailing stop usando a estratégia tradicional
   */
  async updateTrailingStopTraditional(position, trailingState, account, pnl, pnlPct, currentPrice, entryPrice, isLong, isShort) {
    try {
      const trailingStopDistance = Number(process.env.TRAILING_STOP_DISTANCE);
      
      if (isNaN(trailingStopDistance) || trailingStopDistance <= 0) {
        console.error(`❌ [TRAILING_ERROR] TRAILING_STOP_DISTANCE inválido: ${process.env.TRAILING_STOP_DISTANCE}`);
        return null;
      }

      if (!trailingState && pnl > 0) {
        const initialStopLossPrice = TrailingStop.calculateInitialStopLossPrice(position, account);
        
        const newState = {
          symbol: position.symbol,
          entryPrice: entryPrice,
          initialStopLossPrice: initialStopLossPrice,
          trailingStopPrice: initialStopLossPrice,
          highestPrice: isLong ? currentPrice : null,
          lowestPrice: isShort ? currentPrice : null,
          isLong: isLong,
          isShort: isShort,
          phase: 'TRAILING',
          activated: true,
          initialized: true,
          createdAt: new Date().toISOString()
        };

        TrailingStop.trailingState.set(position.symbol, newState);
        await TrailingStop.saveStateToFile();
        
        TrailingStop.colorLogger.trailingActivated(`${position.symbol}: Trailing Stop ATIVADO! Posição lucrativa detectada - PnL: ${pnlPct.toFixed(2)}%, Preço de Entrada: $${entryPrice.toFixed(4)}, Preço Atual: $${currentPrice.toFixed(4)}, Stop Inicial: $${initialStopLossPrice.toFixed(4)}`);
        
        return newState;
      }

      if (trailingState && !trailingState.activated && pnl > 0) {
        trailingState.activated = true;
        trailingState.initialized = true;
        trailingState.phase = 'TRAILING';
        
        if (isLong && currentPrice > trailingState.highestPrice) {
          trailingState.highestPrice = currentPrice;
        }
        if (isShort && currentPrice < trailingState.lowestPrice) {
          trailingState.lowestPrice = currentPrice;
        }
        
        await TrailingStop.saveStateToFile();
        
        TrailingStop.colorLogger.trailingActivated(`${position.symbol}: Trailing Stop REATIVADO! Estado existente ativado - PnL: ${pnlPct.toFixed(2)}%, Preço Atual: $${currentPrice.toFixed(4)}, Stop: $${trailingState.trailingStopPrice.toFixed(4)}`);
        
        return trailingState;
      }

      if (pnl <= 0) {
        if (trailingState && trailingState.activated) {
          TrailingStop.colorLogger.trailingHold(`${position.symbol}: Posição em prejuízo mas Trailing Stop mantido ativo para proteção - Trailing Stop: $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}`);
          return trailingState;
        }
        
        TrailingStop.clearTrailingState(position.symbol);
        return null;
      }

      if (isLong) {
        if (currentPrice > trailingState.highestPrice || trailingState.highestPrice === null) {
          trailingState.highestPrice = currentPrice;
      
          const newTrailingStopPrice = currentPrice * (1 - (trailingStopDistance / 100));
          const currentStopPrice = trailingState.trailingStopPrice;
      
          const finalStopPrice = Math.max(currentStopPrice, newTrailingStopPrice);
      
          if (finalStopPrice > currentStopPrice) {
              trailingState.trailingStopPrice = finalStopPrice;
              trailingState.activated = true;
              TrailingStop.colorLogger.trailingUpdate(`${position.symbol}: LONG - Preço melhorou para $${currentPrice.toFixed(4)}, Novo Stop MOVIDO para: $${finalStopPrice.toFixed(4)}`);
          }
        }
      } else if (isShort) {
        if (currentPrice < trailingState.lowestPrice || trailingState.lowestPrice === null) {
          trailingState.lowestPrice = currentPrice;
          
          const newTrailingStopPrice = trailingState.lowestPrice * (1 + (trailingStopDistance / 100));
          
          const currentStopPrice = trailingState.trailingStopPrice;
          const finalStopPrice = Math.min(currentStopPrice, newTrailingStopPrice);
          
          if (finalStopPrice < currentStopPrice) {
            trailingState.trailingStopPrice = finalStopPrice;
            trailingState.activated = true;
            TrailingStop.colorLogger.trailingUpdate(`${position.symbol}: SHORT - Preço melhorou para $${currentPrice.toFixed(4)}, Trailing Stop ajustado para $${finalStopPrice.toFixed(4)} (protegendo lucros)`);
          }
        }
        
        if (pnl > 0 && !trailingState.activated) {
          const newTrailingStopPrice = currentPrice * (1 + (trailingStopDistance / 100));
          const finalStopPrice = Math.min(trailingState.initialStopLossPrice, newTrailingStopPrice);
          trailingState.trailingStopPrice = finalStopPrice;
          trailingState.activated = true;
          TrailingStop.colorLogger.trailingActivate(`${position.symbol}: SHORT - Ativando Trailing Stop com lucro existente! Preço: $${currentPrice.toFixed(4)}, Stop inicial: $${finalStopPrice.toFixed(4)}`);
        }
      }

      return trailingState;

    } catch (error) {
      console.error(`[TRADITIONAL_TRAILING] Erro ao atualizar trailing stop tradicional para ${position.symbol}:`, error.message);
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
      let type = 'TRAILING_STOP';

      // === ESTRATÉGIA HÍBRIDA ===
      const enableHybridStrategy = process.env.ENABLE_HYBRID_STOP_STRATEGY === 'true';
      
      if (enableHybridStrategy && trailingState.phase) {
        // Verifica stop loss inicial da estratégia híbrida
        if (trailingState.phase === 'INITIAL_RISK' && trailingState.initialAtrStopPrice) {
          if (trailingState.isLong && currentPrice <= trailingState.initialAtrStopPrice) {
            shouldClose = true;
            reason = `Stop Loss Inteligente: Preço atual $${currentPrice.toFixed(4)} <= Stop Loss $${trailingState.initialAtrStopPrice?.toFixed(4) || 'N/A'}`;
            type = 'HYBRID_INITIAL_STOP';
          } else if (trailingState.isShort && currentPrice >= trailingState.initialAtrStopPrice) {
            shouldClose = true;
            reason = `Stop Loss Inteligente: Preço atual $${currentPrice.toFixed(4)} >= Stop Loss $${trailingState.initialAtrStopPrice?.toFixed(4) || 'N/A'}`;
            type = 'HYBRID_INITIAL_STOP';
          }
        }
        
        // Verifica trailing stop da fase de maximização
        if ((trailingState.phase === 'TRAILING' || trailingState.phase === 'PARTIAL_PROFIT_TAKEN') && trailingState.trailingStopPrice) {
          if (trailingState.isLong && currentPrice <= trailingState.trailingStopPrice) {
            shouldClose = true;
            reason = `Trailing Stop: Preço atual $${currentPrice.toFixed(4)} <= Stop Loss $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}`;
            type = 'HYBRID_TRAILING_STOP';
          } else if (trailingState.isShort && currentPrice >= trailingState.trailingStopPrice) {
            shouldClose = true;
            reason = `Trailing Stop: Preço atual $${currentPrice.toFixed(4)} >= Stop Loss $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}`;
            type = 'HYBRID_TRAILING_STOP';
          }
        }
      } else {
        // === ESTRATÉGIA TRADICIONAL ===
        if (trailingState.isLong) {
          if (currentPrice <= trailingState.trailingStopPrice) {
            shouldClose = true;
            reason = `Stop Loss: Preço atual $${currentPrice.toFixed(4)} <= Stop Loss $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}`;
          }
        } else if (trailingState.isShort) {
          if (currentPrice >= trailingState.trailingStopPrice) {
            shouldClose = true;
            reason = `Stop Loss: Preço atual $${currentPrice.toFixed(4)} >= Stop Loss $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}`;
          }
        }
      }

      if (shouldClose) {
        const phaseInfo = trailingState.phase ? ` (Fase: ${trailingState.phase})` : '';
        TrailingStop.colorLogger.trailingTrigger(`${position.symbol}: 🚨 POSIÇÃO FECHADA!${phaseInfo} Preço atual $${currentPrice.toFixed(4)} cruzou o stop loss em $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}.`);
        return {
          shouldClose: true,
          reason: reason,
          type: type,
          trailingStopPrice: trailingState.trailingStopPrice,
          currentPrice: currentPrice,
          phase: trailingState.phase
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
      
      if (!this.cachedVolume || (now - this.lastVolumeCheck) > this.volumeCacheTimeout) {
        this.cachedVolume = await PnlController.get30DayVolume();
        this.lastVolumeCheck = now;
      }

      const volume30Days = this.cachedVolume || 0;

      let tier;
      
      if (volume30Days >= 10000000) {
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
      // Usa pnlRealized + pnlUnrealized para obter o PnL total correto
      const pnlRealized = parseFloat(position.pnlRealized ?? '0');
      const pnlUnrealized = parseFloat(position.pnlUnrealized ?? '0');
      const pnl = pnlRealized + pnlUnrealized;

      const notionalValue = Math.abs(parseFloat(position.netCost ?? '0'));
      
      const rawLeverage = Number(account?.leverage);
      
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const costBasis = notionalValue / leverage;

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

      const totalFees = notional * fees.totalFee;
      
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
      
      if (!Account.leverage) {
        console.error(`❌ [PROFIT_CHECK] ${position.symbol}: Alavancagem não encontrada na Account`);
        return false;
      }      
      
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);
      
      const MAX_NEGATIVE_PNL_STOP_PCT = process.env.MAX_NEGATIVE_PNL_STOP_PCT;
      
      if (MAX_NEGATIVE_PNL_STOP_PCT !== undefined && MAX_NEGATIVE_PNL_STOP_PCT !== null && MAX_NEGATIVE_PNL_STOP_PCT !== '') {
        const maxNegativePnlStopPct = parseFloat(MAX_NEGATIVE_PNL_STOP_PCT);
        
        if (isNaN(maxNegativePnlStopPct) || !isFinite(maxNegativePnlStopPct)) {
          console.error(`❌ [PROFIT_CHECK] Valor inválido para MAX_NEGATIVE_PNL_STOP_PCT: ${MAX_NEGATIVE_PNL_STOP_PCT}`);
          return false;
        }
        
        if (isNaN(pnlPct) || !isFinite(pnlPct)) {
          console.error(`❌ [PROFIT_CHECK] PnL inválido para ${position.symbol}: ${pnlPct}`);
          return false;
        }
        
        if (pnlPct <= maxNegativePnlStopPct) {
          console.log(`🚨 [PROFIT_CHECK] ${position.symbol}: Fechando por stop loss - PnL ${pnlPct.toFixed(3)}% <= limite ${maxNegativePnlStopPct.toFixed(3)}%`);
          return true;
        }
      }
      
      const fees = await this.getFeeTier();
      
      const { minProfitUSD, totalFees } = this.calculateMinimumProfitForFees(position, fees);
      
      const netProfit = pnl - totalFees;

      if (netProfit > 0 && netProfit >= minProfitUSD) {
        console.log(`✅ [PROFIT_CHECK] ${position.symbol}: Fechando por lucro $${netProfit.toFixed(4)} >= mínimo $${minProfitUSD.toFixed(4)}`);
        return true;
      }
      
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
      
      if (!Account.leverage) {
        console.error(`❌ [CONFIG_PROFIT] ${position.symbol}: Alavancagem não encontrada na Account`);
        return false;
      }
      
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);
      
      const MAX_NEGATIVE_PNL_STOP_PCT = process.env.MAX_NEGATIVE_PNL_STOP_PCT;
      
      if (MAX_NEGATIVE_PNL_STOP_PCT !== undefined && MAX_NEGATIVE_PNL_STOP_PCT !== null && MAX_NEGATIVE_PNL_STOP_PCT !== '') {
        const maxNegativePnlStopPct = parseFloat(MAX_NEGATIVE_PNL_STOP_PCT);
        
        if (isNaN(maxNegativePnlStopPct) || !isFinite(maxNegativePnlStopPct)) {
          console.error(`❌ [CONFIG_PROFIT] Valor inválido para MAX_NEGATIVE_PNL_STOP_PCT: ${MAX_NEGATIVE_PNL_STOP_PCT}`);
          return false;
        }
        
        if (isNaN(pnlPct) || !isFinite(pnlPct)) {
          console.error(`❌ [CONFIG_PROFIT] PnL inválido para ${position.symbol}: ${pnlPct}`);
          return false;
        }
        
        if (pnlPct <= maxNegativePnlStopPct) {
          console.log(`🚨 [CONFIG_PROFIT] ${position.symbol}: Fechando por stop loss - PnL ${pnlPct.toFixed(3)}% <= limite ${maxNegativePnlStopPct.toFixed(3)}%`);
          return true;
        }
      }
      
      const minProfitPct = Number(process.env.MIN_PROFIT_PERCENTAGE || 10);
      
      const fees = await this.getFeeTier();
      
      const notional = parseFloat(position.netExposureNotional || position.notional || 0);
      const totalFees = notional * fees.totalFee;
      
      const netProfit = pnl - totalFees;
      const netProfitPct = notional > 0 ? (netProfit / notional) * 100 : 0;
      
      if (netProfit > 0 && netProfitPct >= minProfitPct) {
        console.log(`\n✅ [CONFIG_PROFIT] ${position.symbol}: Fechando por lucro ${netProfitPct.toFixed(3)}% >= mínimo ${minProfitPct.toFixed(3)}%`);
        return true;
      }
      
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
      const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';
      
      const positions = await Futures.getOpenPositions();
      
      if (!positions || positions.length === 0) {
        return;
      }

      TrailingStop.debug(`🔍 [TRAILING_MONITOR] Verificando ${positions.length} posições abertas...`);

      const Account = await AccountController.get();

      for (const position of positions) {
        const stopLossDecision = this.stopLossStrategy.shouldClosePosition(position, Account);

        if (stopLossDecision && stopLossDecision.shouldClose) {
          TrailingStop.colorLogger.positionClosed(`🛑 [STOP_LOSS] ${position.symbol}: Fechando por stop loss principal - ${stopLossDecision.reason}`);
          await OrderController.forceClose(position, Account);
          await TrailingStop.onPositionClosed(position, 'stop_loss');
          continue;
        }

        if (!enableTrailingStop && stopLossDecision && stopLossDecision.shouldTakePartialProfit) {
          TrailingStop.colorLogger.positionClosed(`💰 [PARTIAL_PROFIT] ${position.symbol}: Tomando profit parcial`);
          await OrderController.closePartialPosition(position, stopLossDecision.partialPercentage, Account);
          continue;
        }

        if (enableTrailingStop) {
          if (!TrailingStop.trailingModeLogged.has(position.symbol)) {
            console.log(`🎯 [TRAILING_MODE] ${position.symbol}: Modo Trailing Stop ativo`);
            TrailingStop.trailingModeLogged.add(position.symbol);
          }
          
          await this.updateTrailingStopForPosition(position);
          
          const trailingState = TrailingStop.trailingState.get(position.symbol);
          
          if (trailingState && trailingState.activated) {
            TrailingStop.colorLogger.trailingActiveCheck(`${position.symbol}: Trailing Stop ativo - verificando gatilho`);
            
            const trailingDecision = this.checkTrailingStopTrigger(position, trailingState);
            
            if (trailingDecision && trailingDecision.shouldClose) {
              TrailingStop.colorLogger.positionClosed(`🚨 [TRAILING_EXECUTION] ${position.symbol}: Executando fechamento por Trailing Stop. Motivo: ${trailingDecision.reason}`);
              await OrderController.forceClose(position, Account);
              await TrailingStop.onPositionClosed(position, 'trailing_stop');
              continue;
            }
            
            const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
            const priceType = position.markPrice ? 'Current Price' : 'Last Price';
            const distance = trailingState.isLong 
              ? ((currentPrice - (trailingState.trailingStopPrice || 0)) / currentPrice * 100).toFixed(2)
              : (((trailingState.trailingStopPrice || 0) - currentPrice) / currentPrice * 100).toFixed(2);
            
            const direction = trailingState.isLong ? 'LONG' : 'SHORT';
            const priceRecordLabel = trailingState.isLong ? 'Preço Máximo' : 'Preço Mínimo';
            const priceRecordValue = trailingState.isLong ? trailingState.highestPrice : trailingState.lowestPrice;
            
            TrailingStop.colorLogger.trailingActive(
                `${position.symbol} (${direction}): Trailing ativo - ` +
                `${priceType}: $${currentPrice.toFixed(4)}, ` +
                `TrailingStop: $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}, ` +
                `${priceRecordLabel}: $${priceRecordValue?.toFixed(4) || 'N/A'}, ` +
                `Distância até Stop: ${distance}%\n`
            );
          } else {
            const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
            const priceType = position.markPrice ? 'Current Price' : 'Last Price';
            const pnl = TrailingStop.calculatePnL(position, Account);
            const entryPrice = parseFloat(position.entryPrice || 0);
            
            if (pnl.pnlPct < 0) {
              TrailingStop.colorLogger.trailingWaitingProfitable(`${position.symbol}: Trailing Stop aguardando posição ficar lucrativa - ${priceType}: $${currentPrice.toFixed(4)}, Preço de Entrada: $${entryPrice.toFixed(4)}, PnL: ${pnl.pnlPct.toFixed(2)}% (prejuízo)\n`);
            } else {
              TrailingStop.colorLogger.trailingWaitingActivation(`${position.symbol}: Trailing Stop aguardando ativação - ${priceType}: $${currentPrice.toFixed(4)}, Preço de Entrada: $${entryPrice.toFixed(4)}, PnL: ${pnl.pnlPct.toFixed(2)}%\n`);
            }
          }
        } else {
          TrailingStop.colorLogger.profitFixed(`${position.symbol}: Modo Take Profit fixo ativo`);
          
          if (await this.shouldCloseForConfiguredProfit(position)) {
            TrailingStop.colorLogger.positionClosed(`💰 [PROFIT_CONFIGURED] ${position.symbol}: Fechando por profit mínimo configurado`);
            await OrderController.forceClose(position, Account);
            await TrailingStop.onPositionClosed(position, 'profit_configured');
            continue;
          }

          if (await this.shouldCloseForMinimumProfit(position)) {
            TrailingStop.colorLogger.positionClosed(`💰 [PROFIT_MINIMUM] ${position.symbol}: Fechando por profit mínimo baseado em taxas`);
            await OrderController.forceClose(position, Account);
            await TrailingStop.onPositionClosed(position, 'profit_minimum');
            continue;
          }

          const adxCrossoverDecision = await this.checkADXCrossover(position);
          if (adxCrossoverDecision && adxCrossoverDecision.shouldClose) {
            TrailingStop.colorLogger.positionClosed(`📈 [ADX_CROSSOVER] ${position.symbol}: ${adxCrossoverDecision.reason}`);
            await OrderController.forceClose(position, Account);
            await TrailingStop.onPositionClosed(position, 'adx_crossover');
            continue;
          }
          
          const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
          const priceType = position.markPrice ? 'Current Price' : 'Last Price';
          const pnl = TrailingStop.calculatePnL(position, Account);
          const entryPrice = parseFloat(position.entryPrice || 0);
          TrailingStop.colorLogger.profitMonitor(`${position.symbol}: Take Profit fixo - ${priceType}: $${currentPrice.toFixed(4)}, Preço de Entrada: $${entryPrice.toFixed(4)}, PnL: ${pnl.pnlPct.toFixed(2)}%\n`);
        }

        try {
          const marketInfo = Account.markets.find(m => m.symbol === position.symbol);
          
          if (!marketInfo) {
            TrailingStop.debug(`ℹ️ [MANUAL_POSITION] ${position.symbol}: Par não autorizado - pulando criação de stop loss`);
          } else {
            TrailingStop.debug(`🛡️ [FAILSAFE_CHECK] ${position.symbol}: Verificando stop loss de proteção...`);
            await OrderController.validateAndCreateStopLoss(position, 'DEFAULT');
          }
        } catch (error) {
          console.error(`❌ [FAILSAFE_ERROR] Erro ao validar/criar stop loss para ${position.symbol}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ [TRAILING_ERROR] Erro no stopLoss:`, error.message);
      throw error;
    }
  }

  /**
   * Verifica se deve fechar posição baseada no cruzamento do ADX (estratégia PRO_MAX)
   * @param {object} position - Dados da posição
   * @returns {Promise<object|null>} - Decisão de fechamento ou null
   */
  async checkADXCrossover(position) {
    try {
      const strategyType = process.env.TRADING_STRATEGY || 'DEFAULT';
      if (strategyType !== 'PRO_MAX') {
        return null;
      }

      const timeframe = process.env.TIME || '5m';
      const candles = await Markets.getKLines(position.symbol, timeframe, 30);
      
      if (!candles || candles.length < 20) {
        return null;
      }

      const { calculateIndicators } = await import('../Decision/Indicators.js');
      const indicators = calculateIndicators(candles);
      
      if (!indicators.adx || !indicators.adx.diPlus || !indicators.adx.diMinus) {
        return null;
      }

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
      TrailingStop.colorLogger.trailingConfig(`Trailing Stop configurado corretamente:`);
      TrailingStop.colorLogger.trailingConfig(`   - Habilitado: ${config.enabled}`);
      TrailingStop.colorLogger.trailingConfig(`   - Distância: ${config.distance}%`);
    } else {
      TrailingStop.colorLogger.trailingConfig(`Trailing Stop não configurado ou inválido:`);
      TrailingStop.colorLogger.trailingConfig(`   - ENABLE_TRAILING_STOP: ${config.config.ENABLE_TRAILING_STOP}`);
      TrailingStop.colorLogger.trailingConfig(`   - TRAILING_STOP_DISTANCE: ${config.config.TRAILING_STOP_DISTANCE}`);
    }
  }
}

const trailingStopInstance = new TrailingStop();

trailingStopInstance.saveStateToFile = TrailingStop.saveStateToFile;
trailingStopInstance.loadStateFromFile = TrailingStop.loadStateFromFile;
trailingStopInstance.clearTrailingState = TrailingStop.clearTrailingState;
trailingStopInstance.onPositionClosed = TrailingStop.onPositionClosed;
trailingStopInstance.calculatePnL = TrailingStop.calculatePnL;
trailingStopInstance.calculateInitialStopLossPrice = TrailingStop.calculateInitialStopLossPrice;
trailingStopInstance.debug = TrailingStop.debug;
trailingStopInstance.getTrailingStopConfig = TrailingStop.getTrailingStopConfig;
trailingStopInstance.logTrailingStopConfig = TrailingStop.logTrailingStopConfig;
trailingStopInstance.backfillStateForOpenPositions = TrailingStop.backfillStateForOpenPositions;
trailingStopInstance.cleanupObsoleteStates = TrailingStop.cleanupObsoleteStates;
trailingStopInstance.forceCleanupAllStates = TrailingStop.forceCleanupAllStates;

export default trailingStopInstance;