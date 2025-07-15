import ColorLogger from '../Utils/ColorLogger.js';
import AccountConfig from '../Config/AccountConfig.js';
import BotInstance from './BotInstance.js';

/**
 * Gerenciador principal para múltiplas instâncias do bot
 * Controla a execução paralela de diferentes contas/estratégias
 */
class MultiBotManager {
  constructor() {
    this.bots = new Map(); // Map<accountId, BotInstance>
    this.logger = new ColorLogger('MANAGER', 'MULTI');
    this.isRunning = false;
    this.selectedAccounts = [];
  }

  /**
   * Inicializa o gerenciador
   */
  async initialize() {
    this.logger.info('Inicializando MultiBot Manager...');
    
    // Carrega configurações
    AccountConfig.loadConfigurations();
    
    // Valida configurações
    const validation = AccountConfig.validateConfigurations();
    if (!validation.isValid) {
      this.logger.error('Configurações inválidas:');
      validation.errors.forEach(error => this.logger.error(`  • ${error}`));
      return false;
    }
    
    // Verifica se há contas configuradas
    if (!AccountConfig.hasAnyAccount()) {
      this.logger.error('Nenhuma conta configurada');
      return false;
    }
    
    this.logger.success('MultiBot Manager inicializado com sucesso');
    return true;
  }

  /**
   * Mostra menu de seleção de modo
   */
  async showModeSelection() {
    console.log('\n🤖 BACKBOT - Seleção de Modo');
    console.log('=====================================');
    console.log('\n📋 Modos Disponíveis:\n');
    
    console.log('1️⃣  CONTA ÚNICA');
    console.log('   • Uma conta, uma estratégia');
    console.log('   • Modo atual do bot\n');
    
    console.log('2️⃣  MÚLTIPLAS CONTAS');
    console.log('   • Duas contas, estratégias diferentes');
    console.log('   • Logs separados por conta');
    console.log('   • Execução em paralelo\n');
    
    console.log('3️⃣  Sair\n');
    
    // Verifica se há contas configuradas
    const enabledAccounts = AccountConfig.getEnabledAccounts();
    if (enabledAccounts.length === 0) {
      console.log('⚠️  Nenhuma conta habilitada encontrada');
      console.log('   Configure as contas no arquivo .env\n');
      return 'SINGLE';
    }
    
    console.log('📊 Contas Configuradas:');
    enabledAccounts.forEach(account => {
      console.log(`   • ${account.id}: ${account.name} (${account.strategy})`);
    });
    console.log('');
    
    return 'MULTI';
  }

  /**
   * Mostra menu de seleção de contas
   */
  async showAccountSelection() {
    const accountConfig = new AccountConfig();
    const enabledAccounts = accountConfig.getEnabledAccounts();
    
    console.log('\n🤖 Seleção de Contas');
    console.log('=====================================\n');
    
    console.log('📋 Contas Disponíveis:\n');
    
    enabledAccounts.forEach((account, index) => {
      const status = account.enabled ? '✅ Ativo' : '❌ Inativo';
      console.log(`${index + 1}️⃣  ${account.id}: ${account.name}`);
      console.log(`   • Estratégia: ${account.strategy}`);
      console.log(`   • Status: ${status}`);
      console.log(`   • Volume: $${account.volumeOrder}`);
      console.log(`   • Capital: ${account.capitalPercentage}%`);
      console.log(`   • Timeframe: ${account.time}\n`);
    });
    
    console.log(`${enabledAccounts.length + 1}️⃣  TODAS AS CONTAS`);
    console.log('   • Executa todas as contas habilitadas\n');
    
    console.log(`${enabledAccounts.length + 2}️⃣  Voltar\n`);
    
    // Simula seleção (em implementação real, seria input do usuário)
    return enabledAccounts.map(account => account.id);
  }

  /**
   * Inicia os bots selecionados
   */
  async startBots(accountIds) {
    try {
      this.logger.info(`Iniciando ${accountIds.length} bot(s)...`);
      
      // Cria instâncias dos bots
      const accountConfig = new AccountConfig();
      for (const accountId of accountIds) {
        const account = accountConfig.getAccount(accountId);
        if (!account) {
          this.logger.error(`Conta ${accountId} não encontrada`);
          continue;
        }
        
        if (!account.enabled) {
          this.logger.warn(`Conta ${accountId} está desabilitada`);
          continue;
        }
        
        const botInstance = new BotInstance(accountId, account);
        this.bots.set(accountId, botInstance);
      }
      
      // Inicia todos os bots em paralelo
      const startPromises = Array.from(this.bots.values()).map(bot => bot.start());
      const results = await Promise.all(startPromises);
      
      // Verifica resultados
      const successful = results.filter(result => result === true).length;
      const failed = results.filter(result => result === false).length;
      
      this.logger.success(`${successful} bot(s) iniciado(s) com sucesso`);
      if (failed > 0) {
        this.logger.error(`${failed} bot(s) falharam ao iniciar`);
      }
      
      this.isRunning = successful > 0;
      this.selectedAccounts = accountIds;
      
      if (this.isRunning) {
        this.logger.success('MultiBot iniciado com sucesso!');
        this.showStatus();
      }
      
      return this.isRunning;
      
    } catch (error) {
      this.logger.error(`Erro ao iniciar bots: ${error.message}`);
      return false;
    }
  }

  /**
   * Para todos os bots
   */
  stopBots() {
    try {
      this.logger.info('Parando todos os bots...');
      
      for (const [accountId, bot] of this.bots) {
        bot.stop();
      }
      
      this.bots.clear();
      this.isRunning = false;
      this.selectedAccounts = [];
      
      this.logger.success('Todos os bots parados com sucesso');
      
    } catch (error) {
      this.logger.error(`Erro ao parar bots: ${error.message}`);
    }
  }

  /**
   * Mostra status dos bots
   */
  showStatus() {
    console.log('\n📊 Status dos Bots');
    console.log('=====================================');
    
    if (this.bots.size === 0) {
      console.log('❌ Nenhum bot em execução');
      return;
    }
    
    for (const [accountId, bot] of this.bots) {
      const status = bot.getStatus();
      const runningStatus = status.isRunning ? '🟢 Executando' : '🔴 Parado';
      
      console.log(`\n${accountId}: ${status.name}`);
      console.log(`   • Estratégia: ${status.strategy}`);
      console.log(`   • Status: ${runningStatus}`);
      console.log(`   • Volume: $${status.volumeOrder}`);
      console.log(`   • Capital: ${status.capitalPercentage}%`);
      console.log(`   • Timeframe: ${status.time}`);
    }
    
    console.log('\n💡 Use Ctrl+C para parar todos os bots');
  }

  /**
   * Obtém status de todos os bots
   */
  getAllStatus() {
    const status = [];
    
    for (const [accountId, bot] of this.bots) {
      status.push(bot.getStatus());
    }
    
    return status;
  }

  /**
   * Verifica se há bots em execução
   */
  hasRunningBots() {
    return this.isRunning && this.bots.size > 0;
  }

  /**
   * Obtém número de bots em execução
   */
  getRunningBotsCount() {
    return Array.from(this.bots.values()).filter(bot => bot.isRunning).length;
  }

  /**
   * Executa em modo conta única (compatibilidade)
   */
  async runSingleMode() {
    this.logger.info('Executando em modo conta única...');
    
    // Usa configurações padrão
    const accountConfig = new AccountConfig();
    const defaultAccount = accountConfig.getEnabledAccounts()[0];
    if (!defaultAccount) {
      this.logger.error('Nenhuma conta configurada para modo único');
      return false;
    }
    
    return await this.startBots([defaultAccount.id]);
  }

  /**
   * Executa em modo múltiplas contas
   */
  async runMultiMode() {
    this.logger.info('Executando em modo múltiplas contas...');
    
    const accountConfig = new AccountConfig();
    const enabledAccounts = accountConfig.getEnabledAccounts();
    if (enabledAccounts.length === 0) {
      this.logger.error('Nenhuma conta habilitada encontrada');
      return false;
    }
    
    const accountIds = enabledAccounts.map(account => account.id);
    const success = await this.startBots(accountIds);
    
    if (success) {
      // Inicia o timer geral para modo multi-bot
      this.startGlobalTimer();
      
      // Configura o timer para se repetir a cada 60 segundos
      setInterval(() => {
        this.startGlobalTimer();
      }, 60000);
    }
    
    return success;
  }

  /**
   * Inicia o timer geral para modo multi-bot
   */
  startGlobalTimer() {
    const durationMs = 60000; // 60 segundos
    const startTime = Date.now();
    const nextAnalysis = new Date(startTime + durationMs);
    const timeString = nextAnalysis.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });

    console.log('\n' + '='.repeat(60));
    console.log('⏰ TIMER GERAL - Próxima análise para todas as contas');
    console.log('='.repeat(60));

    const timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / durationMs) * 100, 100);
      const bars = Math.floor(progress / 5);
      const emptyBars = 20 - bars;
      
      const progressBar = '█'.repeat(bars) + '░'.repeat(emptyBars);
      const percentage = Math.floor(progress);
      
      // Limpa linha anterior e escreve o timer (sem \n)
      process.stdout.write('\r');
      process.stdout.write('⏳ Aguardando próxima análise... ');
      process.stdout.write(`[${progressBar}] ${percentage}% | Próxima: ${timeString}`);
      
      if (progress >= 100) {
        clearInterval(timerInterval);
        process.stdout.write('\n');
        console.log('🔄 Iniciando nova análise...\n');
      }
    }, 1000);

    // Retorna o intervalo para poder parar se necessário
    return timerInterval;
  }

  /**
   * Coordena os logs das contas para evitar conflitos
   */
  coordinateLogs() {
    // Pausa temporariamente os logs das contas durante o timer
    for (const [accountId, bot] of this.bots) {
      if (bot.logger) {
        bot.logger.pauseLogs = true;
      }
    }
  }

  /**
   * Resume os logs das contas
   */
  resumeLogs() {
    for (const [accountId, bot] of this.bots) {
      if (bot.logger) {
        bot.logger.pauseLogs = false;
      }
    }
  }
}

export default MultiBotManager; 