/**
 * Sistema de configuração para múltiplas contas
 * Gerencia as configurações de cada conta individualmente
 */
class AccountConfig {
  constructor() {
    this.accounts = new Map();
    this.isInitialized = false;
  }

  /**
   * Inicializa as configurações (deve ser chamado antes de usar)
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.loadConfigurations();
      this.isInitialized = true;
    }
  }

  /**
   * Valida se as credenciais de uma conta são válidas
   * @param {string} accountId - ID da conta
   * @param {string} apiKey - API Key
   * @param {string} apiSecret - API Secret
   * @returns {object} - Resultado da validação
   */
  async validateCredentials(accountId, apiKey, apiSecret) {
    try {
      // Validação básica das credenciais
      if (!apiKey || !apiSecret) {
        return {
          isValid: false,
          error: 'API Key ou Secret não fornecidos'
        };
      }

      if (apiKey.trim() === '' || apiSecret.trim() === '') {
        return {
          isValid: false,
          error: 'API Key ou Secret estão vazios'
        };
      }

      // Validação de formato (API keys geralmente têm comprimento específico)
      if (apiKey.length < 10 || apiSecret.length < 10) {
        return {
          isValid: false,
          error: 'API Key ou Secret muito curtos (formato inválido)'
        };
      }

      // Testa conexão com a API
      const originalApiKey = process.env.API_KEY;
      const originalApiSecret = process.env.API_SECRET;
      
      process.env.API_KEY = apiKey;
      process.env.API_SECRET = apiSecret;
      
      try {
        const AccountController = await import('../Controllers/AccountController.js');
        const accountData = await AccountController.default.get();
        
        if (!accountData) {
          return {
            isValid: false,
            error: 'Falha ao conectar com a API - dados da conta não obtidos'
          };
        }

        return {
          isValid: true,
          data: accountData
        };
        
      } finally {
        // Restaura variáveis originais
        process.env.API_KEY = originalApiKey;
        process.env.API_SECRET = originalApiSecret;
      }
      
    } catch (error) {
      return {
        isValid: false,
        error: `Erro na validação: ${error.message}`
      };
    }
  }

  /**
   * Carrega as configurações das contas do .env com validação
   */
  async loadConfigurations() {
    console.log('\n🔍 Validando credenciais das contas...\n');
    
    // Conta 1
    if (process.env.ACCOUNT1_API_KEY && process.env.ACCOUNT1_API_SECRET) {
      console.log('📋 Validando CONTA1...');
      const validation = await this.validateCredentials('CONTA1', process.env.ACCOUNT1_API_KEY, process.env.ACCOUNT1_API_SECRET);
      
      if (validation.isValid) {
        console.log('✅ CONTA1: Credenciais válidas');
        this.accounts.set('CONTA1', {
          id: 'CONTA1',
          name: process.env.ACCOUNT1_NAME || 'Conta Principal',
          apiKey: process.env.ACCOUNT1_API_KEY,
          apiSecret: process.env.ACCOUNT1_API_SECRET,
          strategy: process.env.ACCOUNT1_STRATEGY || 'DEFAULT',
          enabled: process.env.ACCOUNT1_ENABLED !== 'false',
          // Configurações específicas da conta
          volumeOrder: Number(process.env.ACCOUNT1_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
          capitalPercentage: Number(process.env.ACCOUNT1_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
          limitOrder: Number(process.env.ACCOUNT1_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
          time: process.env.ACCOUNT1_TIME || process.env.TIME || '5m',
          // Configurações específicas da estratégia
          ignoreBronzeSignals: process.env.ACCOUNT1_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
          adxLength: Number(process.env.ACCOUNT1_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
          adxThreshold: Number(process.env.ACCOUNT1_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
          // Configurações avançadas da estratégia PRO_MAX
          adxAverageLength: Number(process.env.ACCOUNT1_ADX_AVERAGE_LENGTH) || Number(process.env.ADX_AVERAGE_LENGTH) || 21,
          useRsiValidation: process.env.ACCOUNT1_USE_RSI_VALIDATION || process.env.USE_RSI_VALIDATION || 'true',
          useStochValidation: process.env.ACCOUNT1_USE_STOCH_VALIDATION || process.env.USE_STOCH_VALIDATION || 'true',
          useMacdValidation: process.env.ACCOUNT1_USE_MACD_VALIDATION || process.env.USE_MACD_VALIDATION || 'true',
          rsiLength: Number(process.env.ACCOUNT1_RSI_LENGTH) || Number(process.env.RSI_LENGTH) || 14,
          rsiAverageLength: Number(process.env.ACCOUNT1_RSI_AVERAGE_LENGTH) || Number(process.env.RSI_AVERAGE_LENGTH) || 14,
          rsiBullThreshold: Number(process.env.ACCOUNT1_RSI_BULL_THRESHOLD) || Number(process.env.RSI_BULL_THRESHOLD) || 45,
          rsiBearThreshold: Number(process.env.ACCOUNT1_RSI_BEAR_THRESHOLD) || Number(process.env.RSI_BEAR_THRESHOLD) || 55,
          stochKLength: Number(process.env.ACCOUNT1_STOCH_K_LENGTH) || Number(process.env.STOCH_K_LENGTH) || 14,
          stochDLength: Number(process.env.ACCOUNT1_STOCH_D_LENGTH) || Number(process.env.STOCH_D_LENGTH) || 3,
          stochSmooth: Number(process.env.ACCOUNT1_STOCH_SMOOTH) || Number(process.env.STOCH_SMOOTH) || 3,
          stochBullThreshold: Number(process.env.ACCOUNT1_STOCH_BULL_THRESHOLD) || Number(process.env.STOCH_BULL_THRESHOLD) || 45,
          stochBearThreshold: Number(process.env.ACCOUNT1_STOCH_BEAR_THRESHOLD) || Number(process.env.STOCH_BEAR_THRESHOLD) || 55,
          macdFastLength: Number(process.env.ACCOUNT1_MACD_FAST_LENGTH) || Number(process.env.MACD_FAST_LENGTH) || 12,
          macdSlowLength: Number(process.env.ACCOUNT1_MACD_SLOW_LENGTH) || Number(process.env.MACD_SLOW_LENGTH) || 26,
          macdSignalLength: Number(process.env.ACCOUNT1_MACD_SIGNAL_LENGTH) || Number(process.env.MACD_SIGNAL_LENGTH) || 9,
        });
      } else {
        console.log(`❌ CONTA1: Credenciais inválidas - ${validation.error}`);
      }
    } else {
      console.log('⚠️ CONTA1: API Key ou Secret não configurados');
    }

    // Conta 2
    if (process.env.ACCOUNT2_API_KEY && process.env.ACCOUNT2_API_SECRET) {
      console.log('📋 Validando CONTA2...');
      const validation = await this.validateCredentials('CONTA2', process.env.ACCOUNT2_API_KEY, process.env.ACCOUNT2_API_SECRET);
      
      if (validation.isValid) {
        console.log('✅ CONTA2: Credenciais válidas');
        this.accounts.set('CONTA2', {
          id: 'CONTA2',
          name: process.env.ACCOUNT2_NAME || 'Conta Pro',
          apiKey: process.env.ACCOUNT2_API_KEY,
          apiSecret: process.env.ACCOUNT2_API_SECRET,
          strategy: process.env.ACCOUNT2_STRATEGY || 'PRO_MAX',
          enabled: process.env.ACCOUNT2_ENABLED !== 'false',
          // Configurações específicas da conta
          volumeOrder: Number(process.env.ACCOUNT2_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
          capitalPercentage: Number(process.env.ACCOUNT2_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
          limitOrder: Number(process.env.ACCOUNT2_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
          time: process.env.ACCOUNT2_TIME || process.env.TIME || '5m',
          // Configurações específicas da estratégia
          ignoreBronzeSignals: process.env.ACCOUNT2_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
          adxLength: Number(process.env.ACCOUNT2_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
          adxThreshold: Number(process.env.ACCOUNT2_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
          // Configurações avançadas da estratégia PRO_MAX
          adxAverageLength: Number(process.env.ACCOUNT2_ADX_AVERAGE_LENGTH) || Number(process.env.ADX_AVERAGE_LENGTH) || 21,
          useRsiValidation: process.env.ACCOUNT2_USE_RSI_VALIDATION || process.env.USE_RSI_VALIDATION || 'true',
          useStochValidation: process.env.ACCOUNT2_USE_STOCH_VALIDATION || process.env.USE_STOCH_VALIDATION || 'true',
          useMacdValidation: process.env.ACCOUNT2_USE_MACD_VALIDATION || process.env.USE_MACD_VALIDATION || 'true',
          rsiLength: Number(process.env.ACCOUNT2_RSI_LENGTH) || Number(process.env.RSI_LENGTH) || 14,
          rsiAverageLength: Number(process.env.ACCOUNT2_RSI_AVERAGE_LENGTH) || Number(process.env.RSI_AVERAGE_LENGTH) || 14,
          rsiBullThreshold: Number(process.env.ACCOUNT2_RSI_BULL_THRESHOLD) || Number(process.env.RSI_BULL_THRESHOLD) || 45,
          rsiBearThreshold: Number(process.env.ACCOUNT2_RSI_BEAR_THRESHOLD) || Number(process.env.RSI_BEAR_THRESHOLD) || 55,
          stochKLength: Number(process.env.ACCOUNT2_STOCH_K_LENGTH) || Number(process.env.STOCH_K_LENGTH) || 14,
          stochDLength: Number(process.env.ACCOUNT2_STOCH_D_LENGTH) || Number(process.env.STOCH_D_LENGTH) || 3,
          stochSmooth: Number(process.env.ACCOUNT2_STOCH_SMOOTH) || Number(process.env.STOCH_SMOOTH) || 3,
          stochBullThreshold: Number(process.env.ACCOUNT2_STOCH_BULL_THRESHOLD) || Number(process.env.STOCH_BULL_THRESHOLD) || 45,
          stochBearThreshold: Number(process.env.ACCOUNT2_STOCH_BEAR_THRESHOLD) || Number(process.env.STOCH_BEAR_THRESHOLD) || 55,
          macdFastLength: Number(process.env.ACCOUNT2_MACD_FAST_LENGTH) || Number(process.env.MACD_FAST_LENGTH) || 12,
          macdSlowLength: Number(process.env.ACCOUNT2_MACD_SLOW_LENGTH) || Number(process.env.MACD_SLOW_LENGTH) || 26,
          macdSignalLength: Number(process.env.ACCOUNT2_MACD_SIGNAL_LENGTH) || Number(process.env.MACD_SIGNAL_LENGTH) || 9,
        });
      } else {
        console.log(`❌ CONTA2: Credenciais inválidas - ${validation.error}`);
      }
    } else {
      console.log('⚠️ CONTA2: API Key ou Secret não configurados');
    }

    console.log(`\n📊 Resumo da validação:`);
    console.log(`   • Contas configuradas: ${this.accounts.size}`);
    console.log(`   • Contas válidas: ${this.getEnabledAccounts().length}`);
    
    if (this.accounts.size === 0) {
      console.log(`\n⚠️ Nenhuma conta com credenciais válidas encontrada!`);
      console.log(`   Configure pelo menos uma conta no arquivo .env`);
    }
  }

  /**
   * Obtém todas as contas configuradas
   */
  getAllAccounts() {
    if (!this.isInitialized) {
      console.warn('⚠️ AccountConfig não foi inicializado. Chame initialize() primeiro.');
      return [];
    }
    return Array.from(this.accounts.values());
  }

  /**
   * Obtém contas habilitadas
   */
  getEnabledAccounts() {
    if (!this.isInitialized) {
      console.warn('⚠️ AccountConfig não foi inicializado. Chame initialize() primeiro.');
      return [];
    }
    return this.getAllAccounts().filter(account => account.enabled);
  }

  /**
   * Obtém uma conta específica
   */
  getAccount(accountId) {
    if (!this.isInitialized) {
      console.warn('⚠️ AccountConfig não foi inicializado. Chame initialize() primeiro.');
      return null;
    }
    return this.accounts.get(accountId);
  }

  /**
   * Verifica se uma conta está configurada
   */
  hasAccount(accountId) {
    if (!this.isInitialized) {
      console.warn('⚠️ AccountConfig não foi inicializado. Chame initialize() primeiro.');
      return false;
    }
    return this.accounts.has(accountId);
  }

  /**
   * Verifica se há contas configuradas
   */
  hasAnyAccount() {
    if (!this.isInitialized) {
      console.warn('⚠️ AccountConfig não foi inicializado. Chame initialize() primeiro.');
      return false;
    }
    return this.accounts.size > 0;
  }

  /**
   * Verifica se há configuração de múltiplas contas
   */
  hasMultiAccountConfig() {
    if (!this.isInitialized) {
      console.warn('⚠️ AccountConfig não foi inicializado. Chame initialize() primeiro.');
      return false;
    }
    return this.accounts.size > 0;
  }

  /**
   * Obtém configuração específica de uma conta
   */
  getAccountConfig(accountId, key) {
    const account = this.getAccount(accountId);
    return account ? account[key] : null;
  }

  /**
   * Define configuração específica de uma conta
   */
  setAccountConfig(accountId, key, value) {
    const account = this.getAccount(accountId);
    if (account) {
      account[key] = value;
    }
  }

  /**
   * Valida se as configurações estão corretas
   */
  validateConfigurations() {
    const errors = [];
    
    for (const [accountId, account] of this.accounts) {
      if (!account.apiKey || !account.apiSecret) {
        errors.push(`${accountId}: API Key ou Secret não configurados`);
      }
      
      if (!['DEFAULT', 'PRO_MAX'].includes(account.strategy)) {
        errors.push(`${accountId}: Estratégia inválida (${account.strategy})`);
      }
      
      if (account.volumeOrder <= 0) {
        errors.push(`${accountId}: Volume da ordem deve ser maior que 0`);
      }
      
      if (account.capitalPercentage < 0 || account.capitalPercentage > 100) {
        errors.push(`${accountId}: Porcentagem do capital deve estar entre 0 e 100`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Exibe resumo das configurações
   */
  showConfigurations() {
    console.log('\n📋 Configurações de Contas:');
    console.log('=====================================');
    
    if (this.accounts.size === 0) {
      console.log('❌ Nenhuma conta configurada');
      return;
    }
    
    for (const [accountId, account] of this.accounts) {
      const status = account.enabled ? '✅ Ativo' : '❌ Inativo';
      console.log(`\n${accountId}: ${account.name}`);
      console.log(`   • Estratégia: ${account.strategy}`);
      console.log(`   • Status: ${status}`);
      console.log(`   • Volume: $${account.volumeOrder}`);
      console.log(`   • Capital: ${account.capitalPercentage}%`);
      console.log(`   • Timeframe: ${account.time}`);
    }
  }
}

export default AccountConfig; 