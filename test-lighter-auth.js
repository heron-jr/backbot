import dotenv from 'dotenv';
import LighterMarkets from './src/Lighter/Public/Markets.js';
import LighterSystem from './src/Lighter/Public/System.js';
import LighterAccount from './src/Lighter/Authenticated/Account.js';
import LighterOrder from './src/Lighter/Authenticated/Order.js';
import ColorLogger from './src/Utils/ColorLogger.js';

dotenv.config();

const logger = new ColorLogger('Lighter Auth Test');

async function testLighterAuthenticated() {
    logger.info('🧪 Testando integração autenticada com Lighter Exchange...');
    
    try {
        // Verifica se as chaves API estão configuradas
        const apiKey = process.env.LIGHTER_API_KEY;
        const secretKey = process.env.LIGHTER_SECRET_KEY;
        
        if (!apiKey || !secretKey) {
            logger.warn('⚠️ Chaves API da Lighter não configuradas');
            logger.info('Configure LIGHTER_API_KEY e LIGHTER_SECRET_KEY no .env para testar endpoints autenticados');
            return;
        }
        
        // Inicializa módulos autenticados
        const account = new LighterAccount(apiKey, secretKey);
        const order = new LighterOrder(apiKey, secretKey);
        
        // Testa autenticação
        try {
            logger.info('🔐 Testando autenticação...');
            const isValid = await account.testApiKey();
            
            if (isValid) {
                logger.success('✅ Autenticação bem-sucedida');
                
                // Testa endpoints da conta
                try {
                    logger.info('💰 Testando saldo da conta...');
                    const balance = await account.getBalance();
                    logger.success('✅ Saldo obtido');
                    console.log('Balance:', JSON.stringify(balance, null, 2));
                } catch (error) {
                    logger.error(`❌ Erro ao obter saldo: ${error.message}`);
                }
                
                try {
                    logger.info('📊 Testando posições...');
                    const positions = await account.getPositions();
                    logger.success('✅ Posições obtidas');
                    console.log('Positions:', JSON.stringify(positions, null, 2));
                } catch (error) {
                    logger.error(`❌ Erro ao obter posições: ${error.message}`);
                }
                
                try {
                    logger.info('📋 Testando ordens abertas...');
                    const openOrders = await order.getOpenOrders();
                    logger.success('✅ Ordens abertas obtidas');
                    console.log('Open Orders:', JSON.stringify(openOrders, null, 2));
                } catch (error) {
                    logger.error(`❌ Erro ao obter ordens abertas: ${error.message}`);
                }
                
            } else {
                logger.error('❌ Falha na autenticação');
            }
            
        } catch (error) {
            logger.error(`❌ Erro na autenticação: ${error.message}`);
        }
        
        logger.success('🎉 Teste da integração autenticada concluído!');
        
    } catch (error) {
        logger.error(`❌ Erro durante o teste: ${error.message}`);
        console.error(error);
    }
}

// Executa o teste
testLighterAuthenticated().catch(error => {
    console.error('Teste falhou:', error);
    process.exit(1);
}); 