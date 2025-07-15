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
}

export default ColorLogger; 