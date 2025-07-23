import { BaseStrategy } from './BaseStrategy.js';
import { calculateIndicators } from '../Indicators.js';

export class CypherPunkStrategy extends BaseStrategy {
    constructor() {
        super();
        
        // Configurações do Trade System CypherPunk
        this.minDays = 10; // Mínimo de dias para análise
        this.vwapThreshold = 0.5; // Sensibilidade VWAP
        this.wtChannelLen = 9; // Comprimento do Canal WaveTrend
        this.wtAvgLen = 12; // Comprimento da Média WaveTrend
        this.wtMaLen = 3; // Comprimento da MA do Sinal WaveTrend
        this.wtObLevel = 60; // Nível de sobrecompra
        this.wtOsLevel = -60; // Nível de sobrevenda
        this.wtSuperObLevel = 80; // Nível de super sobrecompra
        this.wtSuperOsLevel = -80; // Nível de super sobrevenda
        this.wtAttention1 = 40; // Nível de atenção 1
        this.wtAttention2 = -40; // Nível de atenção 2
        this.wtMaxLevel = 100; // Nível máximo
        this.mfiPeriod = 60; // Período do Money Flow
        this.mfiMultiplier = 225; // Multiplicador do Money Flow
        this.useDivergence = true; // Usar divergência
        this.divPivotLen = 5; // Comprimento do pivô de divergência
        this.entryPoints = 3; // 3 pontos de entrada
        this.targetPercentage = 10; // 10% por target
        this.stopLossPercentage = 2; // 2% por stop loss
        this.riskRewardRatio = 5; // Ratio risco/retorno (10%/2% = 5)
        
        // Timeframes disponíveis
        this.timeframes = {
            '1w': { type: 'Hold de Longo TF', ambient: '1w', action: '1d' },
            '3d': { type: 'Hold de Longo TF', ambient: '3d', action: '12h' },
            '1d': { type: 'Hold de Longo TF', ambient: '1d', action: '4h' },
            '12h': { type: 'Hold de Médio TF', ambient: '12h', action: '2h' },
            '8h': { type: 'Hold de Médio TF', ambient: '8h', action: '1h' },
            '6h': { type: 'Hold de Médio TF', ambient: '6h', action: '30m' },
            '4h': { type: 'Hold de Médio TF', ambient: '4h', action: '20m' },
            '2h': { type: 'Day Trade', ambient: '2h', action: '10m' },
            '1h': { type: 'Day Trade', ambient: '1h', action: '5m' },
            '30m': { type: 'Scalp Trade', ambient: '30m', action: '3m' },
            '15m': { type: 'Super Scalp Trade', ambient: '15m', action: '1m' }
        };
        
        this.currentTimeframe = '4h'; // Timeframe padrão
    }

    /**
     * Definir timeframe dinamicamente
     */
    setTimeframe(timeframe) {
        if (this.timeframes[timeframe]) {
            this.currentTimeframe = timeframe;
            console.log(`🔄 CypherPunk: Timeframe alterado para ${timeframe} (${this.timeframes[timeframe].type})`);
            return true;
        }
        console.log(`❌ CypherPunk: Timeframe ${timeframe} não suportado`);
        return false;
    }

    /**
     * Obter configuração do timeframe atual
     */
    getCurrentTimeframeConfig() {
        return this.timeframes[this.currentTimeframe];
    }

    /**
     * Obter todos os timeframes disponíveis
     */
    getAvailableTimeframes() {
        return Object.keys(this.timeframes);
    }

    /**
     * Implementação do método analyzeTrade obrigatório
     * Seguindo EXATAMENTE a ordem 1-2-3: VWAP(1) -> MOMENTUM(2) -> MONEY FLOW(3)
     */
    async analyzeTrade(fee, data, investmentUSD, media_rsi, config = null, btcTrend = 'NEUTRAL') {
        try {
            // Verificar dados mínimos
            if (!data || !data.marketPrice || !data.timestamp) {
                return null;
            }

            const currentPrice = data.marketPrice;
            const timeframeConfig = this.getCurrentTimeframeConfig();
            
            // CALCULAR OS 3 INDICADORES PRINCIPAIS NA ORDEM CORRETA
            
            // 1. VWAP(1) - Oscilador AMARELO
            const vwapSignal = this.calculateVWAP(data);
            if (!vwapSignal) {
                return null;
            }
            
            // 2. MOMENTUM(2) - Osciladores CINZA (WaveTrend)
            const momentumSignal = this.calculateMomentum(data);
            if (!momentumSignal) {
                return null;
            }
            
            // 3. MONEY FLOW(3) - Oscilador VERDE/PINK (O MAIS IMPORTANTE)
            const moneyFlowSignal = this.calculateMoneyFlow(data);
            if (!moneyFlowSignal) {
                return null;
            }
            
            // ANÁLISE NA ORDEM 1-2-3 (OBRIGATÓRIO)
            const signal = this.analyzeInOrder(vwapSignal, momentumSignal, moneyFlowSignal);
            
            if (!signal) {
                return null;
            }
            
            // ENTRADA CONFIRMADA: Todos os 3 indicadores confirmando
            console.log(`✅ CypherPunk: ${signal.action.toUpperCase()} - VWAP(1) + MOMENTUM(2) + MONEY FLOW(3) confirmando`);
            
            // Calcular preço de entrada e targets (TRADE SYSTEM PADRÃO)
            const entryPrice = currentPrice;
            const targets = this.calculateTargets(entryPrice, signal.action);
            const stopLosses = this.calculateStopLoss(entryPrice, signal.action);
            
            // Log detalhado do Trade System
            console.log(`📊 Trade System CypherPunk:`);
            console.log(`   Entry: $${entryPrice.toFixed(6)}`);
            console.log(`   Targets: ${targets.map((t, i) => `${i+1}=$${t.toFixed(6)} (${[10,20,30][i]}%)`).join(' | ')}`);
            console.log(`   Stops: ${stopLosses.map((s, i) => `${i+1}=$${s.toFixed(6)} (${[2,4,6][i]}%)`).join(' | ')}`);
            
            // Calcular PnL usando o primeiro target para validação
            const firstTarget = targets.length > 0 ? targets[0] : entryPrice;
            const firstStop = stopLosses.length > 0 ? stopLosses[0] : entryPrice;
            
            // Calcular PnL e risco (usando primeiro target e stop)
            const { pnl, risk } = this.calculatePnLAndRisk(signal.action, entryPrice, firstStop, firstTarget, investmentUSD, fee);
            
            return {
                market: data.market.symbol,
                entry: Number(entryPrice.toFixed(data.market.decimal_price)),
                stop: Number(firstStop.toFixed(data.market.decimal_price)), // Primeiro stop para compatibilidade
                target: Number(firstTarget.toFixed(data.market.decimal_price)), // Primeiro target para compatibilidade
                targets: targets.map(t => Number(t.toFixed(data.market.decimal_price))), // Todos os targets
                stopLosses: stopLosses.map(s => Number(s.toFixed(data.market.decimal_price))), // Todos os stops
                action: signal.action,
                pnl: pnl,
                risk: risk,
                reason: `CypherPunk ${timeframeConfig.type}: ${signal.action.toUpperCase()} - ${signal.reason}`,
                entryType: signal.entryType || 'STANDARD',
                tradeSystem: {
                    targets: targets,
                    stopLosses: stopLosses,
                    targetPercentages: [10, 20, 30],
                    stopPercentages: [2, 4, 6],
                    riskRewardRatio: this.riskRewardRatio
                }
            };
            
        } catch (error) {
            console.error('Erro na estratégia CypherPunk:', error);
            console.error('Stack trace:', error.stack);
            return null;
        }
    }

    /**
     * 1. VWAP(1) - Oscilador AMARELO, perto da linha Zero
     * Média Ponderada de Preço Ponderada pelo Volume
     */
    calculateVWAP(data) {
        try {
            // Usar VWAP calculado pelo Indicators.js
            if (!data.vwap || !data.vwap.vwap) {
                throw new Error('VWAP não disponível nos dados');
            }
            
            const currentPrice = data.marketPrice;
            const vwapValue = data.vwap.vwap;
            
            // VWAP próximo da linha zero (preço atual vs VWAP)
            const vwapDiff = (currentPrice - vwapValue) / vwapValue;
            
            return {
                value: vwapDiff,
                vwap: vwapValue,
                currentPrice: currentPrice,
                isBullish: vwapDiff > this.vwapThreshold,
                isBearish: vwapDiff < -this.vwapThreshold,
                isNearZero: Math.abs(vwapDiff) <= this.vwapThreshold,
                direction: vwapDiff > 0 ? 'UP' : 'DOWN'
            };
        } catch (error) {
            console.error('Erro no cálculo VWAP:', error);
            return null;
        }
    }

    /**
     * 2. MOMENTUM(2) - Osciladores grandes em tons de CINZA (WaveTrend)
     * Indica o Momento de sentimento, "Fear and Greed"
     */
    calculateMomentum(data) {
        try {
            // Usar WaveTrend calculado pelo Indicators.js (MOMENTUM 2)
            if (!data.waveTrend) {
                throw new Error('WaveTrend não disponível nos dados');
            }
            
            const waveTrend = data.waveTrend;
            
            // Usar reversão já calculada pelo WaveTrend
            const reversal = waveTrend.reversal;
            
            // Calcular valor do momentum baseado no VWAP do WaveTrend
            const momentumValue = waveTrend.vwap || 0;
            
            // Verificar exaustão baseado nos níveis do WaveTrend
            const isExhausted = Math.abs(momentumValue) > this.wtObLevel;
            
            return {
                value: momentumValue,
                wt1: waveTrend.wt1,
                wt2: waveTrend.wt2,
                isBullish: waveTrend.isBullish,
                isBearish: waveTrend.isBearish,
                reversal: reversal,
                isExhausted: isExhausted,
                isNearZero: Math.abs(momentumValue) <= 5,
                direction: momentumValue > 0 ? 'UP' : 'DOWN',
                momentumValue: momentumValue
            };
        } catch (error) {
            console.error('Erro no cálculo Momentum:', error);
            return null;
        }
    }

    /**
     * 3. MONEY FLOW(3) - O MAIS IMPORTANTE DOS TRÊS INDICADORES
     * Oscilador VERDE e PINK no gráfico (Custom MFI)
     */
    calculateMoneyFlow(data) {
        try {
            // Usar Custom Money Flow calculado pelo Indicators.js (MONEY FLOW 3)
            if (!data.customMoneyFlow) {
                throw new Error('Custom Money Flow não disponível nos dados');
            }
            
            const customMoneyFlow = data.customMoneyFlow;
            
            return {
                value: customMoneyFlow.value,
                mfi: customMoneyFlow.mfi,
                mfiAvg: customMoneyFlow.mfiAvg,
                isBullish: customMoneyFlow.isBullish,
                isBearish: customMoneyFlow.isBearish,
                isStrong: customMoneyFlow.isStrong,
                direction: customMoneyFlow.direction,
                strength: Math.abs(customMoneyFlow.value),
                history: customMoneyFlow.history
            };
        } catch (error) {
            console.error('Erro no cálculo Money Flow:', error);
            return null;
        }
    }

    /**
     * Análise na ordem 1-2-3 (OBRIGATÓRIO)
     * VWAP(1) -> MOMENTUM(2) -> MONEY FLOW(3)
     */
    analyzeInOrder(vwap, momentum, moneyFlow) {
        // Verificar se todos os indicadores estão disponíveis
        if (!vwap || !momentum || !moneyFlow) {
            return null;
        }
        
        // REGRA 1: VWAP(1) deve estar confirmando
        if (!this.validateVWAP(vwap)) {
            return null;
        }
        
        // REGRA 2: MOMENTUM(2) deve estar confirmando com reversão
        if (!this.validateMomentum(momentum)) {
            return null;
        }
        
        // REGRA 3: MONEY FLOW(3) deve estar confirmando (O MAIS IMPORTANTE)
        if (!this.validateMoneyFlow(moneyFlow)) {
            return null;
        }
        
        // VERIFICAR SE OS 3 ESTÃO NA MESMA DIREÇÃO
        const allBullish = vwap.isBullish && momentum.isBullish && moneyFlow.isBullish;
        const allBearish = vwap.isBearish && momentum.isBearish && moneyFlow.isBearish;
        
        if (!allBullish && !allBearish) {
            return null;
        }
        
        // DETERMINAR AÇÃO
        let action = null;
        let reason = '';
        let entryType = 'STANDARD';
        
        if (allBullish) {
            action = 'long';
            reason = 'VWAP(1) + MOMENTUM(2) + MONEY FLOW(3) = BULLISH';
            
            // Verificar se é entrada perfeita (reversão forte)
            if (momentum.reversal && momentum.reversal.type === 'GREEN' && momentum.reversal.strength > 10) {
                entryType = 'PERFECT';
            }
        } else if (allBearish) {
            action = 'short';
            reason = 'VWAP(1) + MOMENTUM(2) + MONEY FLOW(3) = BEARISH';
            
            // Verificar se é entrada perfeita (reversão forte)
            if (momentum.reversal && momentum.reversal.type === 'RED' && momentum.reversal.strength > 10) {
                entryType = 'PERFECT';
            }
        }
        
        return {
            action: action,
            reason: reason,
            entryType: entryType,
            vwap: vwap,
            momentum: momentum,
            moneyFlow: moneyFlow
        };
    }

    /**
     * Validação do VWAP(1)
     */
    validateVWAP(vwap) {
        // VWAP deve estar próximo da linha zero ou mostrando direção clara
        return vwap.isNearZero || vwap.isBullish || vwap.isBearish;
    }

    /**
     * Validação do MOMENTUM(2) - REGRAS DE EXAUSTÃO
     * "Quanto mais baixa (no fundo) a MOMENTUM(1), mais seguro e mais rentável serão as entradas de COMPRA"
     * "Quanto mais alta (no topo) a MOMENTUM(1), mais seguro e mais rentável serão as entradas de VENDA"
     */
    validateMomentum(momentum) {
        // Verificar se há reversão (Ponto Verde para Compra ou Ponto Vermelho para venda)
        if (momentum.reversal) {
            return true; // Reversão detectada - sinal válido
        }
        
        // Se não há reversão, verificar se está na direção correta
        if (momentum.isBullish || momentum.isBearish) {
            return true; // Direção clara - sinal válido
        }
        
        // Verificar se está próximo do zero (pode indicar mudança de direção)
        if (Math.abs(momentum.value) < 10) {
            return true; // Próximo do zero - pode ser válido
        }
        
        return false;
    }

    /**
     * Validação do MONEY FLOW(3) - O MAIS IMPORTANTE
     */
    validateMoneyFlow(moneyFlow) {
        // MONEY FLOW É REI - deve estar na direção correta
        if (!moneyFlow.isBullish && !moneyFlow.isBearish) {
            return false;
        }
        
        // Verificar se está forte o suficiente (mais flexível)
        if (Math.abs(moneyFlow.value) < 5) {
            return false;
        }
        
        return true;
    }

    /**
     * Calcular take profits baseados no TRADE SYSTEM PADRÃO
     * "DEFINIR TRÊS PONTOS DE ENTRADAS – TRÊS OBJETIVOS ALVO (LUCRO) – TRÊS STOP LOSS"
     * Targets: 10%, 20%, 30% (escalonados)
     */
    calculateTargets(entryPrice, action) {
        const takeProfits = [];
        
        // TRÊS OBJETIVOS ALVO (LUCRO) - TRADE SYSTEM PADRÃO
        // Target 1: 10% | Target 2: 20% | Target 3: 30%
        const targetPercentages = [10, 20, 30];
        
        for (let i = 0; i < targetPercentages.length; i++) {
            const percentage = targetPercentages[i];
            const targetDistance = entryPrice * (percentage / 100);
            
            if (action === 'long') {
                takeProfits.push(entryPrice + targetDistance);
            } else {
                takeProfits.push(entryPrice - targetDistance);
            }
        }
        
        return takeProfits;
    }

    /**
     * Calcular stop loss baseado no TRADE SYSTEM PADRÃO
     * "DEFINIR TRÊS PONTOS DE ENTRADAS – TRÊS OBJETIVOS ALVO (LUCRO) – TRÊS STOP LOSS"
     * Stops: 2%, 4%, 6% (escalonados)
     */
    calculateStopLoss(entryPrice, action) {
        const stopLosses = [];
        
        // TRÊS STOP LOSS - TRADE SYSTEM PADRÃO
        // Stop 1: 2% | Stop 2: 4% | Stop 3: 6%
        const stopPercentages = [2, 4, 6];
        
        for (let i = 0; i < stopPercentages.length; i++) {
            const percentage = stopPercentages[i];
            const stopDistance = entryPrice * (percentage / 100);
            
            if (action === 'long') {
                stopLosses.push(entryPrice - stopDistance);
            } else {
                stopLosses.push(entryPrice + stopDistance);
            }
        }
        
        return stopLosses;
    }

    /**
     * Calcula PnL e risco para uma operação
     * @param {string} action - 'long' ou 'short'
     * @param {number} entryPrice - Preço de entrada
     * @param {number} stopLoss - Preço do stop loss
     * @param {number} target - Preço do target
     * @param {number} investmentUSD - Valor investido em USD
     * @param {number} fee - Taxa da exchange
     * @returns {object} - { pnl, risk }
     */
    calculatePnLAndRisk(action, entryPrice, stopLoss, target, investmentUSD, fee) {
        try {
            // Calcula unidades baseadas no investimento
            const units = investmentUSD / entryPrice;
            
            // Calcula valores de entrada e saída
            const entryValue = entryPrice * units;
            const targetValue = target * units;
            const stopValue = stopLoss * units;
            
            // Calcula PnL (lucro/prejuízo)
            let pnl;
            if (action === 'long') {
                pnl = targetValue - entryValue;
            } else {
                pnl = entryValue - targetValue;
            }
            
            // Calcula risco (perda máxima)
            let risk;
            if (action === 'long') {
                risk = entryValue - stopValue;
            } else {
                risk = stopValue - entryValue;
            }
            
            // Deduz taxas (entrada + saída)
            const entryFee = entryValue * fee;
            const exitFee = targetValue * fee;
            const totalFees = entryFee + exitFee;
            
            // PnL final após taxas
            pnl -= totalFees;
            
            return {
                pnl: pnl,
                risk: risk
            };
        } catch (error) {
            console.error('Erro no cálculo PnL e risco:', error);
            return {
                pnl: 0,
                risk: 0
            };
        }
    }
} 