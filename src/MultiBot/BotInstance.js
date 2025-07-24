import ColorLogger from '../Utils/ColorLogger.js';
import AccountConfig from '../Config/AccountConfig.js';
import Decision from '../Decision/Decision.js';
import AccountController from '../Controllers/AccountController.js';
import OrderController from '../Controllers/OrderController.js';

/**
 * Instância individual do bot para cada conta
 * Cada instância roda independentemente com suas próprias configurações
 */
class BotInstance {
  constructor(accountId, accountConfig) {
    this.accountId = accountId;
    this.config = accountConfig;
    this.logger = new ColorLogger(accountId, accountConfig.strategy);
    this.isRunning = false;
    this.analysisInterval = null;
    this.monitoringInterval = null;
    
    // Configurações específicas da conta
    this.volumeOrder = accountConfig.volumeOrder;
    this.capitalPercentage = accountConfig.capitalPercentage;
    this.limitOrder = accountConfig.limitOrder;
    this.time = accountConfig.time;
    
    // Configurações da estratégia
    this.strategy = accountConfig.strategy;
    this.ignoreBronzeSignals = accountConfig.ignoreBronzeSignals;
    this.adxLength = accountConfig.adxLength;
    this.adxThreshold = accountConfig.adxThreshold;
    
    this.logger.info(`Instância criada - Estratégia: ${this.strategy}`);
  }

  /**
   * Inicia a instância do bot
   */
  async start() {
    try {
      this.logger.success('Iniciando bot...');
      
      // Valida configurações
      const validation = this.validateConfig();
      if (!validation.isValid) {
        this.logger.error(`Configuração inválida: ${validation.errors.join(', ')}`);
        return false;
      }
      
      // Testa conexão com a API
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        this.logger.error(`Falha na conexão: ${connectionTest.error}`);
        return false;
      }
      
      this.logger.success('Conexão estabelecida com sucesso');
      
      // Configura variáveis de ambiente para esta instância
      this.setEnvironmentVariables();
      
      // Inicia análise
      this.startAnalysis();
      
      // Inicia monitoramento (para PRO_MAX)
      if (this.strategy === 'PRO_MAX') {
        this.startMonitoring();
      }
      
      this.isRunning = true;
      this.logger.success('Bot iniciado com sucesso');
      
      return true;
      
    } catch (error) {
      this.logger.error(`Erro ao iniciar bot: ${error.message}`);
      return false;
    }
  }

  /**
   * Para a instância do bot
   */
  stop() {
    try {
      this.logger.info('Parando bot...');
      
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval);
        this.analysisInterval = null;
      }
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      this.isRunning = false;
      this.logger.success('Bot parado com sucesso');
      
    } catch (error) {
      this.logger.error(`Erro ao parar bot: ${error.message}`);
    }
  }

  /**
   * Valida configurações da instância
   */
  validateConfig() {
    const errors = [];
    
    if (!this.config.apiKey || !this.config.apiSecret) {
      errors.push('API Key ou Secret não configurados');
    }
    
    if (!['DEFAULT', 'PRO_MAX'].includes(this.strategy)) {
      errors.push(`Estratégia inválida: ${this.strategy}`);
    }
    
    if (this.volumeOrder <= 0) {
      errors.push('Volume da ordem deve ser maior que 0');
    }
    
    if (this.capitalPercentage < 0 || this.capitalPercentage > 100) {
      errors.push('Porcentagem do capital deve estar entre 0 e 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Testa conexão com a API
   */
  async testConnection() {
    try {
      // Temporariamente define as variáveis de ambiente
      const originalApiKey = process.env.API_KEY;
      const originalApiSecret = process.env.API_SECRET;
      
      process.env.API_KEY = this.config.apiKey;
      process.env.API_SECRET = this.config.apiSecret;
      
      // Testa conexão
      const accountData = await AccountController.get({ strategy: this.strategy });
      
      // Restaura variáveis originais
      process.env.API_KEY = originalApiKey;
      process.env.API_SECRET = originalApiSecret;
      
      if (!accountData) {
        return {
          success: false,
          error: 'Falha ao obter dados da conta'
        };
      }
      
      return {
        success: true,
        data: accountData
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Define variáveis de ambiente para esta instância
   */
  setEnvironmentVariables() {
    // Salva variáveis originais
    this.originalEnv = {
      API_KEY: process.env.API_KEY,
      API_SECRET: process.env.API_SECRET,
      TRADING_STRATEGY: process.env.TRADING_STRATEGY,
      VOLUME_ORDER: process.env.VOLUME_ORDER,
      CAPITAL_PERCENTAGE: process.env.CAPITAL_PERCENTAGE,
      LIMIT_ORDER: process.env.LIMIT_ORDER,
      TIME: process.env.TIME,
      IGNORE_BRONZE_SIGNALS: process.env.IGNORE_BRONZE_SIGNALS,
      ADX_LENGTH: process.env.ADX_LENGTH,
      ADX_THRESHOLD: process.env.ADX_THRESHOLD,
    };
    
    // Define variáveis para esta instância
    process.env.API_KEY = this.config.apiKey;
    process.env.API_SECRET = this.config.apiSecret;
    process.env.TRADING_STRATEGY = this.strategy;
    process.env.VOLUME_ORDER = this.volumeOrder.toString();
    process.env.CAPITAL_PERCENTAGE = this.capitalPercentage.toString();
    process.env.LIMIT_ORDER = this.limitOrder.toString();
    process.env.TIME = this.time;
    process.env.IGNORE_BRONZE_SIGNALS = this.ignoreBronzeSignals;
    process.env.ADX_LENGTH = this.adxLength.toString();
    process.env.ADX_THRESHOLD = this.adxThreshold.toString();
  }

  /**
   * Restaura variáveis de ambiente originais
   */
  restoreEnvironmentVariables() {
    if (this.originalEnv) {
      Object.assign(process.env, this.originalEnv);
    }
  }

  /**
   * Inicia o ciclo de análise
   */
  startAnalysis() {
    this.logger.info(`Iniciando análise - Timeframe: ${this.time}`);
    
    // Primeira análise imediata
    this.runAnalysis();
    
    // Configura intervalo (60 segundos)
    this.analysisInterval = setInterval(() => {
      this.runAnalysis();
    }, 60000);
  }

  /**
   * Executa uma análise
   */
  async runAnalysis() {
    try {
      // Define variáveis de ambiente para esta instância
      this.setEnvironmentVariables();
      
      // Cria objeto de configuração para esta instância
      const instanceConfig = {
        volumeOrder: this.volumeOrder,
        capitalPercentage: this.capitalPercentage,
        limitOrder: this.limitOrder,
        time: this.time,
        strategy: this.strategy,
        ignoreBronzeSignals: this.ignoreBronzeSignals,
        adxLength: this.adxLength,
        adxThreshold: this.adxThreshold,
        // Configurações avançadas da estratégia PRO_MAX
        adxAverageLength: this.config.adxAverageLength,
        useRsiValidation: this.config.useRsiValidation,
        useStochValidation: this.config.useStochValidation,
        useMacdValidation: this.config.useMacdValidation,
        rsiLength: this.config.rsiLength,
        rsiAverageLength: this.config.rsiAverageLength,
        rsiBullThreshold: this.config.rsiBullThreshold,
        rsiBearThreshold: this.config.rsiBearThreshold,
        stochKLength: this.config.stochKLength,
        stochDLength: this.config.stochDLength,
        stochSmooth: this.config.stochSmooth,
        stochBullThreshold: this.config.stochBullThreshold,
        stochBearThreshold: this.config.stochBearThreshold,
        macdFastLength: this.config.macdFastLength,
        macdSlowLength: this.config.macdSlowLength,
        macdSignalLength: this.config.macdSignalLength,
        accountId: this.accountId
      };
      
      // Cria uma instância do Decision com a estratégia específica desta conta
      const decisionInstance = new Decision(this.strategy);
      
      // Executa análise passando o timeframe específico da conta, o logger e a configuração
      await decisionInstance.analyze(this.time, this.logger, instanceConfig);
      
      // Restaura variáveis originais
      this.restoreEnvironmentVariables();
      
    } catch (error) {
      this.logger.error(`Erro na análise: ${error.message}`);
    }
  }

  /**
   * Inicia monitoramento (para estratégia PRO_MAX)
   */
  startMonitoring() {
    this.logger.info('Iniciando monitoramento de take profits...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        // Define variáveis de ambiente para esta instância
        this.setEnvironmentVariables();
        
        // Executa monitoramento APENAS para esta conta
        await OrderController.monitorPendingEntryOrders(this.accountId);
        
        // Restaura variáveis originais
        this.restoreEnvironmentVariables();
        
      } catch (error) {
        this.logger.error(`Erro no monitoramento: ${error.message}`);
      }
    }, 5000); // A cada 5 segundos
  }

  /**
   * Obtém status da instância
   */
  getStatus() {
    return {
      accountId: this.accountId,
      name: this.config.name,
      strategy: this.strategy,
      isRunning: this.isRunning,
      volumeOrder: this.volumeOrder,
      capitalPercentage: this.capitalPercentage,
      time: this.time
    };
  }

  /**
   * Obtém logs da instância
   */
  getLogs() {
    return {
      accountId: this.accountId,
      strategy: this.strategy,
      isRunning: this.isRunning
    };
  }
}

export default BotInstance; 