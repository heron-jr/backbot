/**
 * Sistema de configuração para múltiplas contas
 * Gerencia as configurações de cada conta individualmente
 */
class AccountConfig {
  constructor() {
    this.accounts = new Map();
    this.loadConfigurations();
  }

  /**
   * Carrega as configurações das contas do .env
   */
  loadConfigurations() {
    // Conta 1
    if (process.env.ACCOUNT1_API_KEY && process.env.ACCOUNT1_API_SECRET) {
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
    }

    // Conta 2
    if (process.env.ACCOUNT2_API_KEY && process.env.ACCOUNT2_API_SECRET) {
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
    }

    // Conta 3 (futuro)
    if (process.env.ACCOUNT3_API_KEY && process.env.ACCOUNT3_API_SECRET) {
      this.accounts.set('CONTA3', {
        id: 'CONTA3',
        name: process.env.ACCOUNT3_NAME || 'Conta 3',
        apiKey: process.env.ACCOUNT3_API_KEY,
        apiSecret: process.env.ACCOUNT3_API_SECRET,
        strategy: process.env.ACCOUNT3_STRATEGY || 'DEFAULT',
        enabled: process.env.ACCOUNT3_ENABLED !== 'false',
        // Configurações específicas da conta
        volumeOrder: Number(process.env.ACCOUNT3_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
        capitalPercentage: Number(process.env.ACCOUNT3_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
        limitOrder: Number(process.env.ACCOUNT3_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
        time: process.env.ACCOUNT3_TIME || process.env.TIME || '5m',
        // Configurações específicas da estratégia
        ignoreBronzeSignals: process.env.ACCOUNT3_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
        adxLength: Number(process.env.ACCOUNT3_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
        adxThreshold: Number(process.env.ACCOUNT3_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
      });
    }

    // Conta 4 (futuro)
    if (process.env.ACCOUNT4_API_KEY && process.env.ACCOUNT4_API_SECRET) {
      this.accounts.set('CONTA4', {
        id: 'CONTA4',
        name: process.env.ACCOUNT4_NAME || 'Conta 4',
        apiKey: process.env.ACCOUNT4_API_KEY,
        apiSecret: process.env.ACCOUNT4_API_SECRET,
        strategy: process.env.ACCOUNT4_STRATEGY || 'DEFAULT',
        enabled: process.env.ACCOUNT4_ENABLED !== 'false',
        // Configurações específicas da conta
        volumeOrder: Number(process.env.ACCOUNT4_VOLUME_ORDER) || Number(process.env.VOLUME_ORDER) || 100,
        capitalPercentage: Number(process.env.ACCOUNT4_CAPITAL_PERCENTAGE) || Number(process.env.CAPITAL_PERCENTAGE) || 0,
        limitOrder: Number(process.env.ACCOUNT4_LIMIT_ORDER) || Number(process.env.LIMIT_ORDER) || 100,
        time: process.env.ACCOUNT4_TIME || process.env.TIME || '5m',
        // Configurações específicas da estratégia
        ignoreBronzeSignals: process.env.ACCOUNT4_IGNORE_BRONZE_SIGNALS || process.env.IGNORE_BRONZE_SIGNALS || 'true',
        adxLength: Number(process.env.ACCOUNT4_ADX_LENGTH) || Number(process.env.ADX_LENGTH) || 14,
        adxThreshold: Number(process.env.ACCOUNT4_ADX_THRESHOLD) || Number(process.env.ADX_THRESHOLD) || 20,
      });
    }
  }

  /**
   * Obtém todas as contas configuradas
   */
  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  /**
   * Obtém contas habilitadas
   */
  getEnabledAccounts() {
    return this.getAllAccounts().filter(account => account.enabled);
  }

  /**
   * Obtém uma conta específica
   */
  getAccount(accountId) {
    return this.accounts.get(accountId);
  }

  /**
   * Verifica se uma conta está configurada
   */
  hasAccount(accountId) {
    return this.accounts.has(accountId);
  }

  /**
   * Verifica se há contas configuradas
   */
  hasAnyAccount() {
    return this.accounts.size > 0;
  }

  /**
   * Verifica se há configuração de múltiplas contas
   */
  hasMultiAccountConfig() {
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