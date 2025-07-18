/**
 * Configuração específica para Lighter Exchange
 * Gerencia as configurações de API keys e parâmetros da Lighter
 */
class LighterConfig {
  constructor() {
    this.accounts = new Map();
    this.isInitialized = false;
  }

  /**
   * Inicializa as configurações da Lighter
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.loadLighterConfigurations();
      this.isInitialized = true;
    }
  }

  /**
   * Valida as credenciais da Lighter
   * @param {string} accountId - ID da conta
   * @param {string} apiKey - API Key da Lighter
   * @param {string} apiSecret - API Secret da Lighter
   * @param {string} passphrase - Passphrase (opcional)
   * @returns {object} - Resultado da validação
   */
  async validateLighterCredentials(accountId, apiKey, apiSecret, passphrase = '') {
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

      // Validação de formato (API keys da Lighter geralmente têm comprimento específico)
      if (apiKey.length < 10 || apiSecret.length < 10) {
        return {
          isValid: false,
          error: 'API Key ou Secret muito curtos (formato inválido)'
        };
      }

      // Testa conexão com a API da Lighter
      const originalApiKey = process.env.LIGHTER_API_KEY;
      const originalApiSecret = process.env.LIGHTER_API_SECRET;
      const originalPassphrase = process.env.LIGHTER_PASSPHRASE;
      
      process.env.LIGHTER_API_KEY = apiKey;
      process.env.LIGHTER_API_SECRET = apiSecret;
      if (passphrase) {
        process.env.LIGHTER_PASSPHRASE = passphrase;
      }
      
      try {
        // Importa o módulo de autenticação da Lighter
        const { default: Authentication } = await import('../Lighter/Authenticated/Authentication.js');
        const auth = new Authentication();
        
        // Testa a autenticação
        const authResult = await auth.authenticate();
        
        if (!authResult.success) {
          return {
            isValid: false,
            error: `Falha na autenticação: ${authResult.error || 'Erro desconhecido'}`
          };
        }

        return {
          isValid: true,
          data: authResult
        };
        
      } finally {
        // Restaura variáveis originais
        process.env.LIGHTER_API_KEY = originalApiKey;
        process.env.LIGHTER_API_SECRET = originalApiSecret;
        process.env.LIGHTER_PASSPHRASE = originalPassphrase;
      }
      
    } catch (error) {
      return {
        isValid: false,
        error: `Erro na validação: ${error.message}`
      };
    }
  }

  /**
   * Carrega as configurações das contas Lighter do .env
   */
  async loadLighterConfigurations() {
    console.log('\n🔍 Validando credenciais da Lighter Exchange...\n');
    
    // Conta Lighter 1
    if (process.env.LIGHTER1_API_KEY && process.env.LIGHTER1_API_SECRET) {
      console.log('📋 Validando LIGHTER1...');
      const validation = await this.validateLighterCredentials(
        'LIGHTER1', 
        process.env.LIGHTER1_API_KEY, 
        process.env.LIGHTER1_API_SECRET,
        process.env.LIGHTER1_PASSPHRASE
      );
      
      if (validation.isValid) {
        console.log('✅ LIGHTER1: Credenciais válidas');
        this.accounts.set('LIGHTER1', {
          id: 'LIGHTER1',
          name: process.env.LIGHTER1_NAME || 'Lighter Conta Principal',
          apiKey: process.env.LIGHTER1_API_KEY,
          apiSecret: process.env.LIGHTER1_API_SECRET,
          passphrase: process.env.LIGHTER1_PASSPHRASE || '',
          strategy: process.env.LIGHTER1_STRATEGY || 'DEFAULT',
          enabled: process.env.LIGHTER1_ENABLED !== 'false',
          // Configurações específicas da Lighter
          baseUrl: process.env.LIGHTER_BASE_URL || 'https://api.lighter.xyz',
          // Configurações de trading
          volumeOrder: Number(process.env.LIGHTER1_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
          capitalPercentage: Number(process.env.LIGHTER1_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
          limitOrder: Number(process.env.LIGHTER1_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
          time: process.env.LIGHTER1_TIME || process.env.TIME || '5m',
          // Configurações de estratégia
          ignoreBronzeSignals: process.env.LIGHTER1_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
          adxLength: Number(process.env.LIGHTER1_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
          adxThreshold: Number(process.env.LIGHTER1_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
        });
      } else {
        console.log(`❌ LIGHTER1: Credenciais inválidas - ${validation.error}`);
      }
    } else {
      console.log('⚠️ LIGHTER1: API Key ou Secret não configurados');
    }

    // Conta Lighter 2
    if (process.env.LIGHTER2_API_KEY && process.env.LIGHTER2_API_SECRET) {
      console.log('📋 Validando LIGHTER2...');
      const validation = await this.validateLighterCredentials(
        'LIGHTER2', 
        process.env.LIGHTER2_API_KEY, 
        process.env.LIGHTER2_API_SECRET,
        process.env.LIGHTER2_PASSPHRASE
      );
      
      if (validation.isValid) {
        console.log('✅ LIGHTER2: Credenciais válidas');
        this.accounts.set('LIGHTER2', {
          id: 'LIGHTER2',
          name: process.env.LIGHTER2_NAME || 'Lighter Conta Pro',
          apiKey: process.env.LIGHTER2_API_KEY,
          apiSecret: process.env.LIGHTER2_API_SECRET,
          passphrase: process.env.LIGHTER2_PASSPHRASE || '',
          strategy: process.env.LIGHTER2_STRATEGY || 'PRO_MAX',
          enabled: process.env.LIGHTER2_ENABLED !== 'false',
          // Configurações específicas da Lighter
          baseUrl: process.env.LIGHTER_BASE_URL || 'https://api.lighter.xyz',
          // Configurações de trading
          volumeOrder: Number(process.env.LIGHTER2_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
          capitalPercentage: Number(process.env.LIGHTER2_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
          limitOrder: Number(process.env.LIGHTER2_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
          time: process.env.LIGHTER2_TIME || process.env.TIME || '5m',
          // Configurações de estratégia
          ignoreBronzeSignals: process.env.LIGHTER2_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
          adxLength: Number(process.env.LIGHTER2_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
          adxThreshold: Number(process.env.LIGHTER2_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
        });
      } else {
        console.log(`❌ LIGHTER2: Credenciais inválidas - ${validation.error}`);
      }
    } else {
      console.log('⚠️ LIGHTER2: API Key ou Secret não configurados');
    }

    console.log(`\n📊 Resumo da validação Lighter:`);
    console.log(`   • Contas configuradas: ${this.accounts.size}`);
    console.log(`   • Contas válidas: ${this.getEnabledAccounts().length}`);
    
    if (this.accounts.size === 0) {
      console.log(`\n⚠️ Nenhuma conta Lighter com credenciais válidas encontrada!`);
      console.log(`   Configure pelo menos uma conta no arquivo .env`);
    }
  }

  /**
   * Obtém todas as contas Lighter configuradas
   */
  getAllAccounts() {
    if (!this.isInitialized) {
      console.warn('⚠️ LighterConfig não foi inicializado. Chame initialize() primeiro.');
      return [];
    }
    return Array.from(this.accounts.values());
  }

  /**
   * Obtém contas Lighter habilitadas
   */
  getEnabledAccounts() {
    if (!this.isInitialized) {
      console.warn('⚠️ LighterConfig não foi inicializado. Chame initialize() primeiro.');
      return [];
    }
    return this.getAllAccounts().filter(account => account.enabled);
  }

  /**
   * Obtém uma conta Lighter específica
   */
  getAccount(accountId) {
    if (!this.isInitialized) {
      console.warn('⚠️ LighterConfig não foi inicializado. Chame initialize() primeiro.');
      return null;
    }
    return this.accounts.get(accountId);
  }

  /**
   * Verifica se uma conta Lighter está configurada
   */
  hasAccount(accountId) {
    if (!this.isInitialized) {
      console.warn('⚠️ LighterConfig não foi inicializado. Chame initialize() primeiro.');
      return false;
    }
    return this.accounts.has(accountId);
  }

  /**
   * Verifica se há contas Lighter configuradas
   */
  hasAnyAccount() {
    if (!this.isInitialized) {
      console.warn('⚠️ LighterConfig não foi inicializado. Chame initialize() primeiro.');
      return false;
    }
    return this.accounts.size > 0;
  }

  /**
   * Verifica se há múltiplas contas Lighter configuradas
   */
  hasMultiAccountConfig() {
    if (!this.isInitialized) {
      console.warn('⚠️ LighterConfig não foi inicializado. Chame initialize() primeiro.');
      return false;
    }
    return this.accounts.size > 1;
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
   * Valida todas as configurações
   */
  validateConfigurations() {
    const errors = [];
    
    if (!this.hasAnyAccount()) {
      errors.push('Nenhuma conta Lighter configurada');
    }
    
    const enabledAccounts = this.getEnabledAccounts();
    if (enabledAccounts.length === 0) {
      errors.push('Nenhuma conta Lighter habilitada');
    }
    
    // Valida configurações específicas de cada conta
    enabledAccounts.forEach(account => {
      if (!account.apiKey || !account.apiSecret) {
        errors.push(`${account.id}: API Key ou Secret não configurados`);
      }
      
      if (account.volumeOrder <= 0) {
        errors.push(`${account.id}: Volume de ordem deve ser maior que 0`);
      }
      
      if (account.capitalPercentage < 0 || account.capitalPercentage > 100) {
        errors.push(`${account.id}: Percentual de capital deve estar entre 0 e 100`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mostra todas as configurações
   */
  showConfigurations() {
    console.log('\n📋 Configurações da Lighter Exchange:');
    console.log('=====================================');
    
    if (!this.hasAnyAccount()) {
      console.log('❌ Nenhuma conta configurada');
      return;
    }
    
    this.getAllAccounts().forEach(account => {
      console.log(`\n🔹 ${account.name} (${account.id}):`);
      console.log(`   Status: ${account.enabled ? '✅ Habilitada' : '❌ Desabilitada'}`);
      console.log(`   Estratégia: ${account.strategy}`);
      console.log(`   API Key: ${account.apiKey ? '✅ Configurada' : '❌ Não configurada'}`);
      console.log(`   API Secret: ${account.apiSecret ? '✅ Configurado' : '❌ Não configurado'}`);
      console.log(`   Passphrase: ${account.passphrase ? '✅ Configurada' : '❌ Não configurada'}`);
      console.log(`   Volume: ${account.volumeOrder}`);
      console.log(`   Capital: ${account.capitalPercentage}%`);
      console.log(`   Timeframe: ${account.time}`);
    });
  }
}

export default LighterConfig; 