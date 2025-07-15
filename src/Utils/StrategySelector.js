import readline from 'readline';
import fs from 'fs';
import path from 'path';

export class StrategySelector {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Exibe o menu de seleção de estratégia
   */
  showMenu() {
    console.log('\n🤖 BACKBOT - Seleção de Estratégia');
    console.log('=====================================\n');
    
    console.log('📋 Estratégias Disponíveis:\n');
    
    console.log('1️⃣  DEFAULT');
    console.log('   📊 Foco: Volume na corretora');
    console.log('   🎯 Objetivo: Maximizar número de operações');
    console.log('   💡 Características:');
    console.log('      • Sinais mais frequentes');
    console.log('      • Stop loss dinâmico');
    console.log('      • Take profit único');
    console.log('      • Ideal para corretoras que pagam por volume\n');
    
    console.log('2️⃣  PRO_MAX');
    console.log('   📈 Foco: Lucro e qualidade de sinais');
    console.log('   🎯 Objetivo: Maximizar retorno por operação');
    console.log('   💡 Características:');
    console.log('      • Sinais filtrados por qualidade (BRONZE/SILVER/GOLD/DIAMOND)');
    console.log('      • Múltiplos take profits');
    console.log('      • Stop loss baseado em ATR');
    console.log('      • Ideal para traders que buscam lucro consistente\n');
    
    console.log('3️⃣  Sair\n');
  }

  /**
   * Aguarda a seleção do usuário
   */
  async selectStrategy() {
    return new Promise((resolve) => {
      this.rl.question('Escolha sua estratégia (1-3): ', (answer) => {
        const choice = answer.trim();
        
        switch (choice) {
          case '1':
            console.log('\n✅ Estratégia DEFAULT selecionada!');
            console.log('🎯 Foco: Volume na corretora');
            this.rl.close();
            resolve('DEFAULT');
            break;
            
          case '2':
            console.log('\n✅ Estratégia PRO_MAX selecionada!');
            console.log('🎯 Foco: Lucro e qualidade de sinais');
            this.rl.close();
            resolve('PRO_MAX');
            break;
            
          case '3':
            console.log('\n👋 Saindo do Backbot...');
            this.rl.close();
            process.exit(0);
            break;
            
          default:
            console.log('\n❌ Opção inválida! Por favor, escolha 1, 2 ou 3.\n');
            this.showMenu();
            this.selectStrategy().then(resolve);
            break;
        }
      });
    });
  }

  /**
   * Atualiza o arquivo .env com a estratégia selecionada
   */
  updateEnvFile(strategy) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      
      // Lê o arquivo .env se existir
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      
      // Atualiza ou adiciona a variável TRADING_STRATEGY
      const lines = envContent.split('\n');
      let strategyLineIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('TRADING_STRATEGY=')) {
          strategyLineIndex = i;
          break;
        }
      }
      
      const newStrategyLine = `TRADING_STRATEGY=${strategy}`;
      
      if (strategyLineIndex >= 0) {
        lines[strategyLineIndex] = newStrategyLine;
      } else {
        lines.push(newStrategyLine);
      }
      
      // Escreve o arquivo atualizado
      fs.writeFileSync(envPath, lines.join('\n'));
      
      console.log(`📝 Arquivo .env atualizado com estratégia: ${strategy}`);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar arquivo .env:', error.message);
      console.log('⚠️ A estratégia será aplicada apenas nesta sessão.');
    }
  }

  /**
   * Processo completo de seleção
   */
  async run() {
    this.showMenu();
    const selectedStrategy = await this.selectStrategy();
    this.updateEnvFile(selectedStrategy);
    
    // Atualiza a variável de ambiente para esta sessão
    process.env.TRADING_STRATEGY = selectedStrategy;
    
    console.log(`\n🚀 Iniciando Backbot com estratégia: ${selectedStrategy}`);
    console.log('⏳ Aguarde...\n');
    
    return selectedStrategy;
  }

  /**
   * Pergunta se o usuário quer alterar a estratégia atual
   */
  async askToChangeStrategy(currentStrategy) {
    return new Promise((resolve) => {
      console.log(`\n🤖 Backbot - Estratégia Atual: ${currentStrategy}`);
      console.log('=====================================\n');
      console.log('Deseja alterar a estratégia? (s/n): ');
      
      this.rl.question('', (answer) => {
        const choice = answer.trim().toLowerCase();
        
        if (choice === 's' || choice === 'sim' || choice === 'y' || choice === 'yes') {
          this.rl.close();
          resolve(true);
        } else {
          console.log(`\n✅ Mantendo estratégia atual: ${currentStrategy}`);
          this.rl.close();
          resolve(false);
        }
      });
    });
  }
} 