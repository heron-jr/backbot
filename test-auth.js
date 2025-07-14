import dotenv from 'dotenv';
dotenv.config();

import AccountController from './src/Controllers/AccountController.js';

async function testAuth() {
  console.log('🔐 Testando autenticação com Backpack Exchange...\n');

  // Verifica se as variáveis de ambiente estão definidas
  console.log('📋 Verificando variáveis de ambiente:');
  console.log(`API_SECRET: ${process.env.API_SECRET ? '✅ Definida' : '❌ Não definida'}`);
  console.log(`API_KEY: ${process.env.API_KEY ? '✅ Definida' : '❌ Não definida'}`);
  console.log(`API_URL: ${process.env.API_URL ? '✅ Definida' : '❌ Não definida'}\n`);

  if (!process.env.API_SECRET || !process.env.API_KEY) {
    console.error('❌ API_SECRET e API_KEY devem estar definidas no .env');
    console.log('\n📝 Exemplo de configuração no .env:');
    console.log('API_SECRET=sua_chave_secreta_base64');
    console.log('API_KEY=sua_chave_api_base64');
    return;
  }

  try {
    console.log('🔄 Testando conexão com a API...');
    const accountData = await AccountController.get();

    if (accountData) {
      console.log('✅ Autenticação bem-sucedida!');
      console.log('\n📊 Dados da conta:');
      console.log(`- Leverage: ${accountData.leverage}x`);
      console.log(`- Capital disponível: $${accountData.capitalAvailable.toFixed(2)}`);
      console.log(`- Taxa maker: ${(accountData.fee * 100).toFixed(4)}%`);
      console.log(`- Máximo de ordens: ${accountData.maxOpenOrders}`);
      console.log(`- Mercados disponíveis: ${accountData.markets.length}`);
    } else {
      console.error('❌ Falha na autenticação. Verifique suas credenciais.');
    }
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.log('\n💡 Possíveis soluções:');
    console.log('1. Verifique se as chaves estão corretas');
    console.log('2. Verifique se as chaves estão em formato base64');
    console.log('3. Verifique se a API está funcionando');
  }
}

testAuth(); 