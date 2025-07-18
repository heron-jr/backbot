import axios from 'axios';
import ColorLogger from '../Utils/ColorLogger.js';

export class DataProvider {
  constructor() {
    this.logger = new ColorLogger('BACKTEST', 'DATA');
    this.backpackUrl = 'https://api.backpack.exchange';
    this.binanceUrl = 'https://api.binance.com';
    this.maxCandlesPerRequest = 1000; // Limite da API
  }

  /**
   * Obtém dados históricos de múltiplos símbolos com suporte a períodos longos
   * @param {Array} symbols - Lista de símbolos para buscar
   * @param {string} interval - Intervalo dos candles (1m, 5m, 15m, 1h, 4h, 1d)
   * @param {number} days - Número de dias para buscar
   * @param {number} startTime - Timestamp de início (opcional)
   * @param {number} endTime - Timestamp de fim (opcional)
   * @returns {object} - Dados históricos organizados por símbolo
   */
  async getHistoricalData(symbols, interval = '1h', days = 30, startTime = null, endTime = null) {
    try {
      this.logger.info(`📊 Obtendo dados históricos REAIS para ${symbols.length} símbolos...`);
      this.logger.info(`📅 Período: ${days} dias | Intervalo: ${interval}`);
      
      const historicalData = {};
      const promises = symbols.map(symbol => 
        this.getSymbolDataExtended(symbol, interval, days, startTime, endTime)
      );
      
      const results = await Promise.allSettled(promises);
      
      let successCount = 0;
      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const result = results[i];
        
        if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
          historicalData[symbol] = result.value;
          successCount++;
          this.logger.info(`✅ ${symbol}: ${result.value.length} candles (${this.formatPeriod(result.value)})`);
        } else {
          this.logger.error(`❌ ${symbol}: Erro ao obter dados`);
        }
      }
      
      this.logger.info(`📈 Dados obtidos com sucesso para ${successCount}/${symbols.length} símbolos`);
      
      if (successCount === 0) {
        throw new Error('Nenhum símbolo com dados válidos encontrado');
      }
      
      return historicalData;
      
    } catch (error) {
      this.logger.error(`❌ Erro ao obter dados históricos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém dados históricos para um símbolo específico com suporte a períodos longos
   * Tenta Backpack primeiro, depois Binance como fallback
   */
  async getSymbolDataExtended(symbol, interval, days, startTime = null, endTime = null) {
    try {
      // Primeiro tenta obter dados da Backpack
      this.logger.info(`🔄 [BACKPACK] Tentando obter dados para ${symbol}...`);
      
      try {
        const backpackData = await this.getBackpackSymbolData(symbol, interval, days, startTime, endTime);
        if (backpackData && backpackData.length > 0) {
          this.logger.info(`✅ [BACKPACK] Dados obtidos com sucesso para ${symbol}: ${backpackData.length} candles`);
          return backpackData;
        }
      } catch (backpackError) {
        this.logger.warn(`⚠️ [BACKPACK] Falha ao obter dados para ${symbol}: ${backpackError.message}`);
      }
      
      // Se Backpack falhou, tenta Binance como fallback
      this.logger.info(`🔄 [BINANCE] Usando Binance como fallback para ${symbol}...`);
      
      try {
        const binanceData = await this.getBinanceSymbolData(symbol, interval, days, startTime, endTime);
        if (binanceData && binanceData.length > 0) {
          this.logger.info(`✅ [BINANCE] Dados obtidos com sucesso para ${symbol}: ${binanceData.length} candles`);
          return binanceData;
        }
      } catch (binanceError) {
        this.logger.error(`❌ [BINANCE] Falha ao obter dados para ${symbol}: ${binanceError.message}`);
      }
      
      // Se ambas falharam, retorna array vazio
      this.logger.error(`❌ Falha total ao obter dados para ${symbol} (Backpack e Binance)`);
      return [];
      
    } catch (error) {
      this.logger.error(`❌ Erro geral ao obter dados para ${symbol}: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtém dados históricos da Backpack para um símbolo específico
   */
  async getBackpackSymbolData(symbol, interval, days, startTime = null, endTime = null) {
    try {
      const end = endTime || Date.now();
      const start = startTime || (end - (days * 24 * 60 * 60 * 1000));
      
      const allCandles = [];
      let currentStart = start;
      
      this.logger.info(`🔄 [BACKPACK] Buscando dados para ${symbol} de ${new Date(start).toLocaleDateString()} até ${new Date(end).toLocaleDateString()}`);
      
      while (currentStart < end) {
        const params = {
          symbol: symbol,
          interval: interval,
          limit: this.maxCandlesPerRequest
        };
        
        // Se não é a primeira requisição, usa o timestamp do último candle como startTime
        if (allCandles.length > 0) {
          const lastCandle = allCandles[allCandles.length - 1];
          params.startTime = Math.floor((lastCandle.timestamp + 1) / 1000); // Converte para segundos
        } else {
          params.startTime = Math.floor(currentStart / 1000); // Converte para segundos
        }
        
        params.endTime = Math.floor(end / 1000); // Converte para segundos
        
        const response = await axios.get(`${this.backpackUrl}/api/v1/klines`, { params });
        
        if (!response.data || !Array.isArray(response.data)) {
          throw new Error('Resposta inválida da API Backpack');
        }
        
        if (response.data.length === 0) {
          break; // Não há mais dados
        }
        
        // Converte e adiciona candles (formato objeto da Backpack)
        const candles = response.data.map(candle => {
          // Converte string de data para timestamp
          const startTime = new Date(candle.start).getTime();
          
          return {
            timestamp: startTime,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume),
            quoteVolume: parseFloat(candle.quoteVolume),
            start: parseFloat(candle.open)
          };
        });
        
        allCandles.push(...candles);
        
        // Atualiza timestamp de início para próxima requisição
        currentStart = candles[candles.length - 1].timestamp + 1;
        
        // Rate limiting para não sobrecarregar a API
        if (response.data.length === this.maxCandlesPerRequest) {
          await this.delay(100); // 100ms entre requisições
        }
        
        this.logger.info(`   📊 [BACKPACK] ${symbol}: ${candles.length} candles obtidos (total: ${allCandles.length})`);
      }
      
      // Remove duplicatas e ordena por timestamp
      const uniqueCandles = this.removeDuplicates(allCandles);
      uniqueCandles.sort((a, b) => a.timestamp - b.timestamp);
      
      this.logger.info(`✅ [BACKPACK] ${symbol}: Total de ${uniqueCandles.length} candles únicos`);
      
      return uniqueCandles;
      
    } catch (error) {
      this.logger.error(`❌ [BACKPACK] Erro ao obter dados para ${symbol}: ${error.message}`);
      throw error; // Re-throw para que o método principal possa tentar Binance
    }
  }

  /**
   * Remove candles duplicados baseado no timestamp
   */
  removeDuplicates(candles) {
    const seen = new Set();
    return candles.filter(candle => {
      const duplicate = seen.has(candle.timestamp);
      seen.add(candle.timestamp);
      return !duplicate;
    });
  }

  /**
   * Formata período dos dados para exibição
   */
  formatPeriod(candles) {
    if (candles.length === 0) return 'sem dados';
    
    const first = new Date(candles[0].timestamp);
    const last = new Date(candles[candles.length - 1].timestamp);
    const days = Math.ceil((last - first) / (1000 * 60 * 60 * 24));
    
    return `${days} dias (${first.toLocaleDateString()} - ${last.toLocaleDateString()})`;
  }

  /**
   * Converte símbolos da Backpack para formato da Binance
   * Ex: BTC_USDC_PERP -> BTCUSDT
   */
  convertSymbolToBinance(symbol) {
    // Remove _PERP e substitui _ por nada
    let binanceSymbol = symbol.replace('_PERP', '').replace(/_/g, '');
    
    // Mapeamento específico para pares comuns
    const symbolMap = {
      'BTCUSDC': 'BTCUSDT',
      'ETHUSDC': 'ETHUSDT',
      'SOLUSDC': 'SOLUSDT',
      'ADAUSDC': 'ADAUSDT',
      'DOTUSDC': 'DOTUSDT',
      'LINKUSDC': 'LINKUSDT',
      'MATICUSDC': 'MATICUSDT',
      'AVAXUSDC': 'AVAXUSDT',
      'UNIUSDC': 'UNIUSDT',
      'ATOMUSDC': 'ATOMUSDT',
      'LTCUSDC': 'LTCUSDT',
      'BCHUSDC': 'BCHUSDT',
      'XRPUSDC': 'XRPUSDT',
      'DOGEUSDC': 'DOGEUSDT',
      'SHIBUSDC': 'SHIBUSDT',
      'TRXUSDC': 'TRXUSDT',
      'ETCUSDC': 'ETCUSDT',
      'FILUSDC': 'FILUSDT',
      'NEARUSDC': 'NEARUSDT',
      'ALGOUSDC': 'ALGOUSDT'
    };
    
    return symbolMap[binanceSymbol] || binanceSymbol;
  }

  /**
   * Delay para rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém dados históricos da Binance para um símbolo específico
   */
  async getBinanceSymbolData(symbol, interval, days, startTime = null, endTime = null) {
    try {
      const binanceSymbol = this.convertSymbolToBinance(symbol);
      const end = endTime || Date.now();
      const start = startTime || (end - (days * 24 * 60 * 60 * 1000));
      
      const allCandles = [];
      let currentStart = start;
      
      this.logger.info(`🔄 [BINANCE] Buscando dados para ${symbol} (${binanceSymbol}) de ${new Date(start).toLocaleDateString()} até ${new Date(end).toLocaleDateString()}`);
      
      while (currentStart < end) {
        const params = {
          symbol: binanceSymbol,
          interval: interval,
          limit: this.maxCandlesPerRequest
        };
        
        // Se não é a primeira requisição, usa o timestamp do último candle como startTime
        if (allCandles.length > 0) {
          const lastCandle = allCandles[allCandles.length - 1];
          params.startTime = lastCandle.timestamp + 1; // Binance usa milissegundos
        } else {
          params.startTime = currentStart;
        }
        
        params.endTime = end;
        
        const response = await axios.get(`${this.binanceUrl}/api/v3/klines`, { params });
        
        if (!response.data || !Array.isArray(response.data)) {
          throw new Error('Resposta inválida da API Binance');
        }
        
        if (response.data.length === 0) {
          break; // Não há mais dados
        }
        
        // Converte dados da Binance para formato padrão
        const candles = response.data.map(candle => ({
          timestamp: candle[0], // open time em milissegundos
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          quoteVolume: parseFloat(candle[6]), // quote asset volume
          start: parseFloat(candle[1])
        }));
        
        allCandles.push(...candles);
        
        // Atualiza timestamp de início para próxima requisição
        currentStart = candles[candles.length - 1].timestamp + 1;
        
        // Rate limiting para não sobrecarregar a API
        if (response.data.length === this.maxCandlesPerRequest) {
          await this.delay(100); // 100ms entre requisições
        }
        
        this.logger.info(`   📊 [BINANCE] ${symbol}: ${candles.length} candles obtidos (total: ${allCandles.length})`);
      }
      
      // Remove duplicatas e ordena por timestamp
      const uniqueCandles = this.removeDuplicates(allCandles);
      uniqueCandles.sort((a, b) => a.timestamp - b.timestamp);
      
      this.logger.info(`✅ [BINANCE] ${symbol}: Total de ${uniqueCandles.length} candles únicos`);
      
      return uniqueCandles;
      
    } catch (error) {
      this.logger.error(`❌ [BINANCE] Erro ao obter dados para ${symbol}: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtém dados históricos para um símbolo específico (método original mantido para compatibilidade)
   */
  async getSymbolData(symbol, interval, limit, startTime, endTime) {
    try {
      const params = {
        symbol: symbol,
        interval: interval,
        limit: Math.min(limit, this.maxCandlesPerRequest)
      };
      
      if (startTime) params.startTime = Math.floor(startTime / 1000); // Converte para segundos
      if (endTime) params.endTime = Math.floor(endTime / 1000); // Converte para segundos
      
      const response = await axios.get(`${this.backpackUrl}/api/v1/klines`, { params });
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Resposta inválida da API');
      }
      
      // Converte dados para formato padrão (formato objeto da Backpack)
      return response.data.map(candle => {
        // Converte string de data para timestamp
        const startTime = new Date(candle.start).getTime();
        
        return {
          timestamp: startTime,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume),
          quoteVolume: parseFloat(candle.quoteVolume),
          start: parseFloat(candle.open)
        };
      });
      
    } catch (error) {
      this.logger.error(`❌ Erro ao obter dados para ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtém lista de símbolos disponíveis com filtros otimizados
   */
  async getAvailableSymbols() {
    try {
      this.logger.info('📋 Obtendo lista de símbolos disponíveis...');
      
      const response = await axios.get(`${this.baseUrl}/api/v1/markets`);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Resposta inválida da API');
      }
      
      // Filtra apenas símbolos com volume significativo e liquidez
      const activeSymbols = response.data
        .filter(market => 
          market.status === 'TRADING' && 
          market.quoteAsset === 'USDC' &&
          parseFloat(market.volume24h) > 50000 && // Volume mínimo de $50k
          parseFloat(market.quoteVolume) > 1000000 // Volume em USDC > $1M
        )
        .map(market => market.symbol)
        .sort();
      
      this.logger.info(`✅ ${activeSymbols.length} símbolos ativos encontrados`);
      
      return activeSymbols;
      
    } catch (error) {
      this.logger.error(`❌ Erro ao obter símbolos: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtém símbolos mais líquidos para backtest
   */
  async getTopLiquidSymbols(limit = 20) {
    try {
      this.logger.info(`📊 Obtendo top ${limit} símbolos mais líquidos...`);
      
      const response = await axios.get(`${this.baseUrl}/api/v1/markets`);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Resposta inválida da API');
      }
      
      // Filtra e ordena por volume
      const liquidSymbols = response.data
        .filter(market => 
          market.status === 'TRADING' && 
          market.quoteAsset === 'USDC' &&
          parseFloat(market.volume24h) > 100000 // Volume mínimo de $100k
        )
        .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
        .slice(0, limit)
        .map(market => market.symbol);
      
      this.logger.info(`✅ Top ${liquidSymbols.length} símbolos por liquidez:`);
      liquidSymbols.forEach((symbol, index) => {
        this.logger.info(`   ${index + 1}. ${symbol}`);
      });
      
      return liquidSymbols;
      
    } catch (error) {
      this.logger.error(`❌ Erro ao obter símbolos líquidos: ${error.message}`);
      return [];
    }
  }

  /**
   * Gera dados sintéticos para teste (mantido para compatibilidade, mas não recomendado para análise real)
   */
  generateSyntheticData(symbols, days = 30, interval = '1h') {
    this.logger.warn('⚠️ ATENÇÃO: Usando dados sintéticos - NÃO recomendado para análise real!');
    this.logger.info(`🔧 Gerando dados sintéticos para ${symbols.length} símbolos...`);
    
    const historicalData = {};
    const candlesPerDay = this.getCandlesPerDay(interval);
    const totalCandles = days * candlesPerDay;
    
    for (const symbol of symbols) {
      const candles = [];
      let basePrice = 100 + Math.random() * 900; // Preço base entre $100-$1000
      
      for (let i = 0; i < totalCandles; i++) {
        const timestamp = Date.now() - (totalCandles - i) * this.getIntervalMs(interval);
        
        // Simula movimento de preço com tendência e volatilidade
        const volatility = 0.02; // 2% de volatilidade
        const trend = Math.sin(i / 100) * 0.01; // Tendência cíclica
        const random = (Math.random() - 0.5) * volatility;
        
        basePrice *= (1 + trend + random);
        
        const open = basePrice;
        const high = open * (1 + Math.random() * 0.01);
        const low = open * (1 - Math.random() * 0.01);
        const close = low + Math.random() * (high - low);
        const volume = 1000 + Math.random() * 9000;
        
        candles.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume,
          quoteVolume: volume * close,
          start: open
        });
      }
      
      historicalData[symbol] = candles;
    }
    
    return historicalData;
  }

  /**
   * Calcula número de candles por dia baseado no intervalo
   */
  getCandlesPerDay(interval) {
    const intervals = {
      '1m': 1440,
      '5m': 288,
      '15m': 96,
      '30m': 48,
      '1h': 24,
      '4h': 6,
      '1d': 1
    };
    
    return intervals[interval] || 24;
  }

  /**
   * Calcula milissegundos do intervalo
   */
  getIntervalMs(interval) {
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return intervals[interval] || 60 * 60 * 1000;
  }

  /**
   * Valida se os dados estão completos e consistentes
   */
  validateData(historicalData, interval = '1h') {
    const issues = [];
    
    for (const [symbol, candles] of Object.entries(historicalData)) {
      if (!Array.isArray(candles) || candles.length === 0) {
        issues.push(`${symbol}: Sem dados`);
        continue;
      }
      
      // Verifica se candles estão ordenados cronologicamente
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].timestamp <= candles[i-1].timestamp) {
          issues.push(`${symbol}: Candles não ordenados na posição ${i}`);
          break;
        }
      }
      
      // Verifica se há gaps muito grandes (usando o intervalo correto)
      const expectedInterval = this.getIntervalMs(interval);
      const maxGap = expectedInterval * 3; // Permite gaps de até 3x o intervalo
      
      for (let i = 1; i < candles.length; i++) {
        const gap = candles[i].timestamp - candles[i-1].timestamp;
        if (gap > maxGap) {
          const gapHours = Math.round(gap / (60 * 60 * 1000));
          const expectedHours = Math.round(expectedInterval / (60 * 60 * 1000));
          issues.push(`${symbol}: Gap de ${gapHours}h entre candles ${i-1} e ${i} (esperado: ~${expectedHours}h)`);
        }
      }
      
      // Verifica se preços são válidos
      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        if (candle.high < candle.low || candle.open <= 0 || candle.close <= 0) {
          issues.push(`${symbol}: Preços inválidos no candle ${i}`);
        }
      }
    }
    
    if (issues.length > 0) {
      this.logger.warn(`⚠️ Problemas encontrados nos dados (intervalo: ${interval}):`);
      issues.forEach(issue => this.logger.warn(`   ${issue}`));
    }
    
    return issues.length === 0;
  }
} 