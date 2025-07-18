#!/usr/bin/env node

/**
 * Script para testar e validar configurações da Lighter Exchange
 * Executa: node test-lighter-config.js
 */

import dotenv from 'dotenv';
import LighterConfig from './src/Config/LighterConfig.js';

// Carrega variáveis de ambiente
dotenv.config();

async function testLighterConfig() {
  console.log('🔍 Testando configurações da Lighter Exchange...\n');
  
  try {
    // Inicializa configuração da Lighter
    const lighterConfig = new LighterConfig();
    await lighterConfig.initialize();
    
    // Mostra configurações
    lighterConfig.showConfigurations();
    
    // Valida configurações
    const validation = lighterConfig.validateConfigurations();
    
    console.log('\n📊 Resultado da Validação:');
    console.log('==========================');
    
    if (validation.isValid) {
      console.log('✅ Todas as configurações estão válidas!');
      
      const enabledAccounts = lighterConfig.getEnabledAccounts();
      console.log(`📈 Contas habilitadas: ${enabledAccounts.length}`);
      
      enabledAccounts.forEach(account => {
        console.log(`\n🔹 ${account.name}:`);
        console.log(`   • Estratégia: ${account.strategy}`);
        console.log(`   • Volume: ${account.volumeOrder}`);
        console.log(`   • Capital: ${account.capitalPercentage}%`);
        console.log(`   • Timeframe: ${account.time}`);
      });
      
      console.log('\n🚀 Configuração pronta para uso!');
      
    } else {
      console.log('❌ Configurações inválidas:');
      validation.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
      
      console.log('\n📝 Para corrigir:');
      console.log('   1. Verifique o arquivo .env');
      console.log('   2. Configure as API keys da Lighter');
      console.log('   3. Execute novamente este teste');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar configurações:', error.message);
    console.log('\n🔧 Possíveis soluções:');
    console.log('   1. Verifique se o arquivo .env existe');
    console.log('   2. Confirme se as variáveis estão corretas');
    console.log('   3. Verifique a conexão com a internet');
  }
}

// Executa o teste
testLighterConfig().catch(console.error); 