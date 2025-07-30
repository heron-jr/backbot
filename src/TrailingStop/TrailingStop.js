import Futures from '../Backpack/Authenticated/Futures.js';
import OrderController from '../Controllers/OrderController.js';
import { StopLossFactory } from '../Decision/Strategies/StopLossFactory.js';
import PnlController from '../Controllers/PnlController.js';
import Markets from '../Backpack/Public/Markets.js';
import AccountController from '../Controllers/AccountController.js';
import { validateLeverageForSymbol, clearLeverageAdjustLog } from '../utils/Utils.js';
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
  static trailingState = new Map(); // Ex: { 'SOL_USDC_PERP': { trailingStopPrice: 180.50, highestPrice: 182.00, lowestPrice: 175.00 } }
  static trailingModeLogged = new Set(); // Cache para logs de modo Trailing Stop

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
      
      // Atualiza timestamp do último salvamento
      TrailingStop.lastSaveTime = now;
      
      // Converte o Map para um formato serializável
      const serializableState = Array.from(TrailingStop.trailingState.entries());
      
      // Cria o diretório se não existir
      const dir = path.dirname(TrailingStop.persistenceFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Salva o estado em JSON
      await fs.writeFile(TrailingStop.persistenceFilePath, JSON.stringify(serializableState, null, 2));
      
      TrailingStop.debug(`💾 [PERSISTENCE] Estado do trailing stop salvo: ${serializableState.length} posições`);
    } catch (error) {
      console.error(`❌ [PERSISTENCE] Erro ao salvar estado do trailing stop:`, error.message);
    }
  }

  /**
   * Carrega o estado do trailing stop do arquivo JSON
   */
  static async loadStateFromFile() {
    try {
      // Verifica se o arquivo existe
      try {
        await fs.access(TrailingStop.persistenceFilePath);
      } catch (error) {
        console.log(`ℹ️ [PERSISTENCE] Arquivo de estado não encontrado, iniciando com estado vazio`);
        return;
      }
      
      // Lê o arquivo
      const fileContent = await fs.readFile(TrailingStop.persistenceFilePath, 'utf8');
      const serializableState = JSON.parse(fileContent);
      
      // Reconstrói o Map
      TrailingStop.trailingState = new Map(serializableState);
      
      console.log(`📂 [PERSISTENCE] Estado do trailing stop carregado: ${TrailingStop.trailingState.size} posições`);
      
      // Log das posições carregadas
      for (const [symbol, state] of TrailingStop.trailingState.entries()) {
        console.log(`📊 [PERSISTENCE] ${symbol}: Stop: $${state.trailingStopPrice?.toFixed(4) || 'N/A'}, Ativo: ${state.activated}`);
      }
    } catch (error) {
      console.error(`❌ [PERSISTENCE] Erro ao carregar estado do trailing stop:`, error.message);
      console.log(`🔄 [PERSISTENCE] Iniciando com estado vazio devido ao erro`);
      TrailingStop.trailingState = new Map();
    }
  }

  /**
   * Limpa estados obsoletos que não correspondem a posições abertas atuais
   */
  static async cleanupObsoleteStates() {
    try {
      console.log(`🧹 [CLEANUP] Verificando estados obsoletos do Trailing Stop...`);
      
      const positions = await Futures.getOpenPositions();
      const openSymbols = positions ? positions.map(p => p.symbol) : [];
      
      let cleanedStates = 0;
      const statesToRemove = [];
      
      // Verifica quais estados não correspondem a posições abertas
      for (const [symbol, state] of TrailingStop.trailingState.entries()) {
        if (!openSymbols.includes(symbol)) {
          statesToRemove.push(symbol);
          console.log(`🗑️ [CLEANUP] ${symbol}: Estado removido - posição não está mais aberta`);
        }
      }
      
      // Remove os estados obsoletos
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
      
      // PRIMEIRO: Limpa completamente o arquivo de persistência
      console.log(`🧹 [MIGRATION] Limpando arquivo de persistência para dados frescos...`);
      await TrailingStop.forceCleanupAllStates();
      
      // SEGUNDO: Carrega dados atuais das posições abertas
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
        // Verifica se já existe estado para esta posição
        if (TrailingStop.trailingState.has(position.symbol)) {
          console.log(`ℹ️ [MIGRATION] ${position.symbol}: Estado já existe, pulando...`);
          continue;
        }

        // Verifica se é um par autorizado
        const marketInfo = Account.markets?.find(market => market.symbol === position.symbol);
        if (!marketInfo) {
          console.log(`⚠️ [MIGRATION] ${position.symbol}: Par não autorizado, pulando...`);
          continue;
        }

        console.log(`🔄 [MIGRATION] ${position.symbol}: Criando estado inicial do Trailing Stop...`);

        // Calcula o preço de entrada e atual
        const entryPrice = parseFloat(position.entryPrice || position.markPrice || 0);
        const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
        
        // Determina se é LONG ou SHORT
        const netQuantity = parseFloat(position.netQuantity || 0);
        const isLong = netQuantity > 0;
        const isShort = netQuantity < 0;

        if (!isLong && !isShort) {
          console.log(`⚠️ [MIGRATION] ${position.symbol}: Posição neutra, pulando...`);
          continue;
        }

        // Calcula o stop loss inicial
        const initialStopLossPrice = TrailingStop.calculateInitialStopLossPrice(position, Account);
        
        // Cria o estado inicial com dados ATUAIS
        const initialState = {
          symbol: position.symbol,
          entryPrice: entryPrice,
          isLong: isLong,
          isShort: isShort,
          initialStopLossPrice: initialStopLossPrice,
          highestPrice: isLong ? currentPrice : null, // Usa preço atual para LONG
          lowestPrice: isShort ? currentPrice : null, // Usa preço atual para SHORT
          trailingStopPrice: initialStopLossPrice,
          activated: false, // Só será ativado se a posição estiver com lucro
          createdAt: new Date().toISOString()
        };

        // Adiciona ao estado
        TrailingStop.trailingState.set(position.symbol, initialState);
        newStatesCreated++;

        console.log(`✅ [MIGRATION] ${position.symbol}: Estado criado com dados frescos - Entry: $${entryPrice.toFixed(4)}, Atual: $${currentPrice.toFixed(4)}, Stop Inicial: $${initialStopLossPrice.toFixed(4)}, Tipo: ${isLong ? 'LONG' : 'SHORT'}`);
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
      // PnL em dólar, que já estava correto.
      const pnl = parseFloat(position.pnlUnrealized ?? '0');

      // O 'netCost' aqui é tratado como o VALOR NOCIONAL da posição.
      const notionalValue = Math.abs(parseFloat(position.netCost ?? '0'));
      
      // A base de custo real (MARGEM) é o valor nocional dividido pela alavancagem.
      // Se a alavancagem for 0 ou não informada, consideramos 1 para evitar divisão por zero.
      const leverage = Number(account?.leverage || position.leverage || 1);
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
   * Calcula o preço de stop loss inicial baseado na configuração
   * @param {object} position - Dados da posição
   * @param {object} account - Dados da conta
   * @returns {number} - Preço de stop loss inicial
   */
  static calculateInitialStopLossPrice(position, account) {
    try {
      const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
      
      // VALIDAÇÃO: Verifica se a alavancagem existe na Account
      if (!account?.leverage) {
        console.error(`❌ [STOP_LOSS_ERROR] ${position.symbol}: Alavancagem não encontrada na Account`);
        return null;
      }
      
      const rawLeverage = Number(account.leverage);
      
      // VALIDAÇÃO: Ajusta a alavancagem baseada nas regras da Backpack
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const baseStopLossPct = Math.abs(Number(process.env.MAX_NEGATIVE_PNL_STOP_PCT || -10));
      
      // Calcula a porcentagem real considerando a alavancagem validada
      const actualStopLossPct = baseStopLossPct / leverage;
      
      // Determina se é LONG ou SHORT
      const isLong = parseFloat(position.netQuantity) > 0;
      
      // Calcula o preço de stop loss inicial
      const initialStopLossPrice = isLong 
        ? currentPrice * (1 - actualStopLossPct / 100)  // LONG: preço menor
        : currentPrice * (1 + actualStopLossPct / 100); // SHORT: preço maior
      
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
      console.log(`🧹 [TRAILING_CLEANUP] ${symbol}: Estado limpo (${reason}) - Stop: $${state?.trailingStopPrice?.toFixed(4) || 'N/A'}`);
      
      // Remove do cache de logs também
      TrailingStop.trailingModeLogged.delete(symbol);
      
      // Salva o estado após a limpeza
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
      
      // Remove do cache de logs de ajuste de alavancagem
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
      
      // Limpa o cache de logs também
      TrailingStop.trailingModeLogged.clear();
      
      // Limpa o cache de logs de ajuste de alavancagem
      clearLeverageAdjustLog();
      
      // Remove o arquivo de persistência se existir
      try {
        await fs.unlink(TrailingStop.persistenceFilePath);
        console.log(`🗑️ [FORCE_CLEANUP] Arquivo de persistência removido`);
      } catch (error) {
        // Arquivo não existe, não é problema
        console.log(`ℹ️ [FORCE_CLEANUP] Arquivo de persistência não encontrado`);
      }
      
      console.log(`✅ [FORCE_CLEANUP] Limpeza completa concluída: ${stateCount} estados removidos`);
      
    } catch (error) {
      console.error(`❌ [FORCE_CLEANUP] Erro durante limpeza completa:`, error.message);
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
      
      // VALIDAÇÃO: Verifica se a alavancagem existe na Account
      if (!Account.leverage) {
        console.error(`❌ [TRAILING_ERROR] ${position.symbol}: Alavancagem não encontrada na Account`);
        return null;
      }
      
      const rawLeverage = Account.leverage;
      
      // VALIDAÇÃO: Ajusta a alavancagem baseada nas regras da Backpack
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);

      // Trailing stop só é ativado se a posição estiver com lucro
      if (pnl <= 0) {
        // NÃO remove o estado se posição não está mais lucrativa
        // O Trailing Stop, uma vez ativado, deve permanecer ativo até a posição ser fechada
        // Isso evita que a posição fique "órfã" sem proteção
        let trailingState = TrailingStop.trailingState.get(position.symbol);
        if (trailingState && trailingState.activated) {
                      console.log(`📊 [TRAILING_HOLD] ${position.symbol}: Posição em prejuízo mas Trailing Stop mantido ativo para proteção - Stop: $${trailingState.trailingStopPrice?.toFixed(4) || 'N/A'}`);
          return trailingState;
        }
        
        // Só remove se nunca foi ativado
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
        // Calcula o stop loss inicial
        const initialStopLossPrice = TrailingStop.calculateInitialStopLossPrice(position, Account);
        
        // Inicializa o estado - LOG ÚNICO DE ATIVAÇÃO
        trailingState = {
          entryPrice: entryPrice,
          initialStopLossPrice: initialStopLossPrice, // Stop loss inicial calculado
          trailingStopPrice: initialStopLossPrice, // Inicializa com o stop inicial para garantir primeira comparação
          highestPrice: isLong ? currentPrice : null, // CORREÇÃO: Usar preço ATUAL para LONG
          lowestPrice: isShort ? currentPrice : null, // CORREÇÃO: Usar preço ATUAL para SHORT
          isLong: isLong,
          isShort: isShort,
          activated: false,
          initialized: false // Novo campo para controlar logs
        };
        TrailingStop.trailingState.set(position.symbol, trailingState);
        console.log(`✅ [TRAILING_ACTIVATED] ${position.symbol}: Trailing Stop ATIVADO! Posição lucrativa detectada - Preço de Entrada: $${entryPrice.toFixed(4)}, Preço Atual: $${currentPrice.toFixed(4)}, Stop Inicial: $${initialStopLossPrice.toFixed(4)}`);
        trailingState.initialized = true;
      }

      // Atualiza o trailing stop baseado na direção da posição
      if (isLong) {
        if (currentPrice > trailingState.highestPrice || trailingState.highestPrice === null) {
          trailingState.highestPrice = currentPrice;
      
          const newTrailingStopPrice = currentPrice * (1 - (trailingStopDistance / 100));
          const currentStopPrice = trailingState.trailingStopPrice;
      
          const finalStopPrice = Math.max(currentStopPrice, newTrailingStopPrice);
      
          if (finalStopPrice > currentStopPrice) {
              trailingState.trailingStopPrice = finalStopPrice;
              trailingState.activated = true;
              console.log(`📈 [TRAILING_UPDATE] ${position.symbol}: LONG - Preço melhorou para $${currentPrice.toFixed(4)}, Novo Stop MOVIDO para: $${finalStopPrice.toFixed(4)}`);
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
            console.log(`📉 [TRAILING_UPDATE] ${position.symbol}: SHORT - Preço melhorou para $${currentPrice.toFixed(4)}, Trailing Stop ajustado para $${finalStopPrice.toFixed(4)} (protegendo lucros)`);
          }
        }
        
        if (pnl > 0 && !trailingState.activated) {
          const newTrailingStopPrice = currentPrice * (1 + (trailingStopDistance / 100));
          const finalStopPrice = Math.min(trailingState.initialStopLossPrice, newTrailingStopPrice);
          trailingState.trailingStopPrice = finalStopPrice;
          trailingState.activated = true;
          console.log(`🎯 [TRAILING_ACTIVATE] ${position.symbol}: SHORT - Ativando Trailing Stop com lucro existente! Preço: $${currentPrice.toFixed(4)}, Stop inicial: $${finalStopPrice.toFixed(4)}`);
        }
      }

      return trailingState;

    } catch (error) {
      console.error(`[TRAILING_UPDATE] Erro ao atualizar trailing stop para ${position.symbol}:`, error.message);
      return null;
    } finally {
      // Salva o estado automaticamente após qualquer modificação
      await TrailingStop.saveStateToFile();
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
  calculatePnL(position, account) {
    try { 
      // PnL em dólar, que já estava correto.
      const pnl = parseFloat(position.pnlUnrealized ?? '0');

      // O 'netCost' aqui é tratado como o VALOR NOCIONAL da posição.
      const notionalValue = Math.abs(parseFloat(position.netCost ?? '0'));
      
      // A base de custo real (MARGEM) é o valor nocional dividido pela alavancagem.
      // Se a alavancagem for 0 ou não informada, consideramos 1 para evitar divisão por zero.
      const leverage = Number(account?.leverage || position.leverage || 1);
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
      
      // VALIDAÇÃO: Verifica se a alavancagem existe na Account
      if (!Account.leverage) {
        console.error(`❌ [PROFIT_CHECK] ${position.symbol}: Alavancagem não encontrada na Account`);
        return false;
      }
      
      const rawLeverage = Account.leverage;
      
      // VALIDAÇÃO: Ajusta a alavancagem baseada nas regras da Backpack
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);
      
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
      
      // VALIDAÇÃO: Verifica se a alavancagem existe na Account
      if (!Account.leverage) {
        console.error(`❌ [CONFIG_PROFIT] ${position.symbol}: Alavancagem não encontrada na Account`);
        return false;
      }
      
      const rawLeverage = Account.leverage;
      
      // VALIDAÇÃO: Ajusta a alavancagem baseada nas regras da Backpack
      const leverage = validateLeverageForSymbol(position.symbol, rawLeverage);
      
      const { pnl, pnlPct } = TrailingStop.calculatePnL(position, Account);
      
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

      // Obtém dados da conta uma vez para todas as posições
      const Account = await AccountController.get();

      for (const position of positions) {
        // 1. VERIFICAÇÃO DE STOP LOSS PRINCIPAL (PRIORIDADE ZERO - SEMPRE ATIVA)
        // Esta verificação é independente e sempre ativa para proteção máxima
        const stopLossDecision = this.stopLossStrategy.shouldClosePosition(position, Account);
        
        if (stopLossDecision && stopLossDecision.shouldClose) {
          console.log(`🛑 [STOP_LOSS] ${position.symbol}: Fechando por stop loss principal - ${stopLossDecision.reason}`);
          await OrderController.forceClose(position, Account);
          await TrailingStop.onPositionClosed(position, 'stop_loss');
          continue; // Pula para a próxima posição
        }

        if (stopLossDecision && stopLossDecision.shouldTakePartialProfit) {
          console.log(`💰 [PARTIAL_PROFIT] ${position.symbol}: Tomando profit parcial`);
          await OrderController.takePartialProfit(position, stopLossDecision.partialPercentage, Account);
          continue; // Pula para a próxima posição
        }

        // 2. VERIFICAÇÃO DE MODO DE SAÍDA POR LUCRO (A CORREÇÃO CENTRAL)
        const enableTrailingStop = process.env.ENABLE_TRAILING_STOP === 'true';

        if (enableTrailingStop) {
          // MODO TRAILING STOP
          // Log do modo Trailing Stop apenas uma vez por símbolo
        if (!TrailingStop.trailingModeLogged.has(position.symbol)) {
          console.log(`🎯 [TRAILING_MODE] ${position.symbol}: Modo Trailing Stop ativo`);
          TrailingStop.trailingModeLogged.add(position.symbol);
        }
          
          // Atualiza o estado do trailing stop para a posição
          await this.updateTrailingStopForPosition(position);
          
          // Verifica se o trailing stop está ativo para esta posição
          const isTrailingActive = this.isTrailingStopActive(position.symbol);
          const trailingInfo = this.getTrailingStopInfo(position.symbol);
          
          if (isTrailingActive) {
            console.log(`📊 [TRAILING_ACTIVE] ${position.symbol}: Trailing Stop ativo - verificando gatilho`);
            
            const trailingDecision = this.checkTrailingStopTrigger(position, trailingInfo);
            if (trailingDecision && trailingDecision.shouldClose) {
              console.log(`🚨 [TRAILING_TRIGGER] ${position.symbol}: Fechando por TRAILING STOP - ${trailingDecision.reason}`);
              await OrderController.forceClose(position, Account);
              await TrailingStop.onPositionClosed(position, 'trailing_stop');
              continue; // Pula para a próxima posição
            }
            
            // Log de monitoramento para trailing stop ativo
            const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
            const priceType = position.markPrice ? 'Mark Price' : 'Last Price';
            const distance = trailingInfo.isLong 
              ? ((currentPrice - trailingInfo.trailingStopPrice) / currentPrice * 100).toFixed(2)
              : ((trailingInfo.trailingStopPrice - currentPrice) / currentPrice * 100).toFixed(2);
            
            console.log(`📊 [TRAILING_MONITOR] ${position.symbol}: Trailing ativo - ${priceType}: $${currentPrice.toFixed(4)}, Trailing Stop: $${trailingInfo.trailingStopPrice.toFixed(4)}, Distância até Stop: ${distance}%\n`);
          } else {
                    // Trailing Stop habilitado mas não ativo para esta posição
        const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
        const priceType = position.markPrice ? 'Mark Price' : 'Last Price';
        const pnl = TrailingStop.calculatePnL(position, Account);
        const entryPrice = parseFloat(position.entryPrice || 0);
        
        // Mensagem user-friendly explicando por que o Trailing Stop não está ativo
        if (pnl.pnlPct < 0) {
          console.log(`📊 [TRAILING_WAITING] ${position.symbol}: Trailing Stop aguardando posição ficar lucrativa - ${priceType}: $${currentPrice.toFixed(4)}, Preço de Entrada: $${entryPrice.toFixed(4)}, PnL: ${pnl.pnlPct.toFixed(2)}% (prejuízo)\n`);
        } else {
          console.log(`📊 [TRAILING_WAITING] ${position.symbol}: Trailing Stop aguardando ativação - ${priceType}: $${currentPrice.toFixed(4)}, Preço de Entrada: $${entryPrice.toFixed(4)}, PnL: ${pnl.pnlPct.toFixed(2)}%\n`);
        }
          }
          
          // IMPORTANTE: Se Trailing Stop está habilitado, IGNORA COMPLETAMENTE as regras de Take Profit fixo
          // O Trailing Stop é o único responsável pela saída por lucro
          
        } else {
          // MODO TAKE PROFIT FIXO
          console.log(`📋 [PROFIT_MODE] ${position.symbol}: Modo Take Profit fixo ativo`);
          
          // Verifica se deve fechar por profit mínimo configurado (prioridade maior)
          if (await this.shouldCloseForConfiguredProfit(position)) {
            console.log(`✅ [PROFIT_FIXED] ${position.symbol}: Fechando por profit mínimo configurado`);
            await OrderController.forceClose(position, Account);
            await TrailingStop.onPositionClosed(position, 'profit_configured');
            continue; // Pula para a próxima posição
          }

          // Verifica se deve fechar por profit mínimo baseado nas taxas
          if (await this.shouldCloseForMinimumProfit(position)) {
            console.log(`✅ [PROFIT_FIXED] ${position.symbol}: Fechando por profit mínimo baseado em taxas`);
            await OrderController.forceClose(position, Account);
            await TrailingStop.onPositionClosed(position, 'profit_minimum');
            continue; // Pula para a próxima posição
          }

          // Verifica ADX crossover para estratégia PRO_MAX
          const adxCrossoverDecision = await this.checkADXCrossover(position);
          if (adxCrossoverDecision && adxCrossoverDecision.shouldClose) {
            console.log(`🔄 [ADX_CROSSOVER] ${position.symbol}: ${adxCrossoverDecision.reason}`);
            await OrderController.forceClose(position, Account);
            await TrailingStop.onPositionClosed(position, 'adx_crossover');
            continue; // Pula para a próxima posição
          }
          
          // Log de monitoramento para modo Take Profit fixo
          const currentPrice = parseFloat(position.markPrice || position.lastPrice || 0);
          const priceType = position.markPrice ? 'Mark Price' : 'Last Price';
          const pnl = TrailingStop.calculatePnL(position, Account);
          const entryPrice = parseFloat(position.entryPrice || 0);
          console.log(`📊 [PROFIT_MONITOR] ${position.symbol}: Take Profit fixo - ${priceType}: $${currentPrice.toFixed(4)}, Preço de Entrada: $${entryPrice.toFixed(4)}, PnL: ${pnl.pnlPct.toFixed(2)}%\n`);
        }

        // 3. VERIFICAÇÃO DE FAILSAFE ORDERS (sempre executada, independente do modo)
        // Esta verificação deve acontecer independente do Trailing Stop ou Take Profit
        try {
          // Verifica se o par está autorizado antes de tentar criar stop loss
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

// Cria a instância
const trailingStopInstance = new TrailingStop();

// Adiciona os métodos estáticos à instância para garantir acesso
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