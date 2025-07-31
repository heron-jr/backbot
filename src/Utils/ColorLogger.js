/**
 * Sistema de logs coloridos para múltiplos bots
 * Cada conta/estratégia tem sua própria cor para fácil identificação
 */
class ColorLogger {
  constructor(accountId, strategy) {
    this.accountId = accountId;
    this.strategy = strategy;
    this.prefix = `\n🤖 [${accountId}-${strategy}]`;
    this.pauseLogs = false; // Controle de pausa de logs
    
    // Cores para diferentes contas
    this.colors = {
      CONTA1: '\x1b[36m', // Cyan
      CONTA2: '\x1b[35m', // Magenta
      CONTA3: '\x1b[33m', // Yellow
      CONTA4: '\x1b[32m', // Green
      DEFAULT: '\x1b[37m', // White
    };
    
    this.resetColor = '\x1b[0m';
    this.color = this.colors[accountId] || this.colors.DEFAULT;
  }

  /**
   * Log normal
   */
  log(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} ${message}${this.resetColor}`);
  }

  /**
   * Log de sucesso (verde)
   */
  success(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} ✅ ${message}${this.resetColor}`);
  }

  /**
   * Log de erro (vermelho)
   */
  error(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} ❌ ${message}${this.resetColor}`);
  }

  /**
   * Log de aviso (amarelo)
   */
  warn(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} ⚠️ ${message}${this.resetColor}`);
  }

  /**
   * Log de informação (azul)
   */
  info(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} ℹ️ ${message}${this.resetColor}`);
  }

  /**
   * Log de análise
   */
  analyze(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} 🔍 ${message}${this.resetColor}`);
  }

  /**
   * Log de execução de ordem
   */
  order(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} 📊 ${message}${this.resetColor}`);
  }

  /**
   * Log de capital/volume
   */
  capital(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} 💰 ${message}${this.resetColor}`);
  }

  /**
   * Log de estratégia específica
   */
  strategy(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} 🎯 ${message}${this.resetColor}`);
  }

  /**
   * Log de loading progressivo
   */
  loading(message) {
    if (this.pauseLogs) return;
    process.stdout.write(`${this.color}${this.prefix} ⏳ ${message}${this.resetColor}`);
  }

  /**
   * Limpa linha atual (para loading)
   */
  clearLine() {
    if (this.pauseLogs) return;
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  // ===== MÉTODOS ESPECÍFICOS PARA TRAILING STOP =====

  /**
   * Log de Trailing Stop aguardando posição ficar lucrativa (FUSCIA)
   */
  trailingWaitingProfitable(message) {
    if (this.pauseLogs) return;
    const fuchsiaColor = '\x1b[95m'; // Fúcsia
    console.log(`${fuchsiaColor}📊 [TRAILING_WAITING] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop aguardando ativação (LARANJA)
   */
  trailingWaitingActivation(message) {
    if (this.pauseLogs) return;
    const orangeColor = '\x1b[33m'; // Laranja
    console.log(`${orangeColor}📊 [TRAILING_WAITING] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop ativo e em lucro (VERDE)
   */
  trailingActive(message) {
    if (this.pauseLogs) return;
    const greenColor = '\x1b[32m'; // Verde
    console.log(`${greenColor}📊 [TRAILING_MONITOR] ${message}${this.resetColor}`);
  }

  /**
   * Log de Take Profit monitorado e em lucro (VERDE)
   */
  profitMonitor(message) {
    if (this.pauseLogs) return;
    const greenColor = '\x1b[32m'; // Verde
    console.log(`${greenColor}📊 [PROFIT_MONITOR] ${message}${this.resetColor}`);
  }

  /**
   * Log de Take Profit fixo (AZUL)
   */
  profitFixed(message) {
    if (this.pauseLogs) return;
    const blueColor = '\x1b[34m'; // Azul
    console.log(`${blueColor}📋 [PROFIT_MODE] ${message}${this.resetColor}`);
  }

  /**
   * Log de fechamento por profit (VERDE BRILHANTE)
   */
  profitClose(message) {
    if (this.pauseLogs) return;
    const brightGreenColor = '\x1b[92m'; // Verde brilhante
    console.log(`${brightGreenColor}✅ [PROFIT_FIXED] ${message}${this.resetColor}`);
  }

  /**
   * Log de ADX Crossover (AMARELO)
   */
  adxCrossover(message) {
    if (this.pauseLogs) return;
    const yellowColor = '\x1b[93m'; // Amarelo brilhante
    console.log(`${yellowColor}🔄 [ADX_CROSSOVER] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop habilitado (CIANO)
   */
  trailingEnabled(message) {
    if (this.pauseLogs) return;
    const cyanColor = '\x1b[36m'; // Ciano
    console.log(`${cyanColor}🚨 [TRAILING_MODE] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop em hold/proteção (VERMELHO)
   */
  trailingHold(message) {
    if (this.pauseLogs) return;
    const redColor = '\x1b[31m'; // Vermelho
    console.log(`${redColor}📊 [TRAILING_HOLD] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop ativo verificando gatilho (VERDE BRILHANTE)
   */
  trailingActiveCheck(message) {
    if (this.pauseLogs) return;
    const brightGreenColor = '\x1b[92m'; // Verde brilhante
    console.log(`${brightGreenColor}📊 [TRAILING_ACTIVE] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop trigger/gatilho ativado (VERMELHO BRILHANTE)
   */
  trailingTrigger(message) {
    if (this.pauseLogs) return;
    const brightRedColor = '\x1b[91m'; // Vermelho brilhante
    console.log(`${brightRedColor}🚨 [TRAILING_TRIGGER] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop ativado (VERDE BRILHANTE)
   */
  trailingActivated(message) {
    if (this.pauseLogs) return;
    const brightGreenColor = '\x1b[92m'; // Verde brilhante
    console.log(`${brightGreenColor}✅ [TRAILING_ACTIVATED] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop atualizado (AZUL)
   */
  trailingUpdate(message) {
    if (this.pauseLogs) return;
    const blueColor = '\x1b[34m'; // Azul
    console.log(`${blueColor}📈 [TRAILING_UPDATE] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop ativando (AMARELO)
   */
  trailingActivate(message) {
    if (this.pauseLogs) return;
    const yellowColor = '\x1b[33m'; // Amarelo
    console.log(`${yellowColor}🎯 [TRAILING_ACTIVATE] ${message}${this.resetColor}`);
  }

  /**
   * Log de Trailing Stop cleanup (CINZA)
   */
  trailingCleanup(message) {
    if (this.pauseLogs) return;
    const grayColor = '\x1b[90m'; // Cinza
    console.log(`${grayColor}🧹 [TRAILING_CLEANUP] ${message}${this.resetColor}`);
  }

  /**
   * Log de configuração do trailing stop
   */
  trailingConfig(message) {
    if (this.pauseLogs) return;
    console.log(`${this.color}${this.prefix} ⚙️ ${message}${this.resetColor}`);
  }

  /**
   * Log de fechamento de operação (vermelho brilhante para destacar)
   */
  positionClosed(message) {
    if (this.pauseLogs) return;
    console.log(`\x1b[91m${this.prefix} 🚨 ${message}\x1b[0m`);
  }
}

export default ColorLogger; 