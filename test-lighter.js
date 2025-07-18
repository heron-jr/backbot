import dotenv from 'dotenv';
import LighterMarkets from './src/Lighter/Public/Markets.js';
import LighterSystem from './src/Lighter/Public/System.js';
import ColorLogger from './src/Utils/ColorLogger.js';

dotenv.config();

const logger = new ColorLogger('Lighter Test');

async function testLighterIntegration() {
    logger.info('🧪 Testando integração com Lighter Exchange...');
    
    try {
        // Testa endpoints públicos
        logger.info('🌐 Testando endpoints públicos...');
        
        // Inicializa módulos
        const markets = new LighterMarkets();
        const system = new LighterSystem();
        
        // Testa status do sistema
        try {
            logger.info('📊 Testando status do sistema...');
            const systemStatus = await system.getSystemStatus();
            logger.success('✅ Status do sistema obtido');
            console.log('System Status:', JSON.stringify(systemStatus, null, 2));
        } catch (error) {
            logger.error(`❌ Erro ao obter status do sistema: ${error.message}`);
        }
        
        // Testa mercados disponíveis
        try {
            logger.info('📈 Testando mercados disponíveis...');
            const marketsList = await markets.getMarkets();
            logger.success(`✅ ${marketsList.length} mercados encontrados`);
            
            if (marketsList.length > 0) {
                const firstMarket = marketsList[0];
                logger.info(`📊 Testando mercado: ${firstMarket.symbol}`);
                
                // Testa ticker do mercado
                const ticker = await markets.getTicker(firstMarket.symbol);
                logger.success('✅ Ticker do mercado obtido');
                console.log('Ticker:', JSON.stringify(ticker, null, 2));
            }
        } catch (error) {
            logger.error(`❌ Erro ao obter mercados: ${error.message}`);
        }
        
        logger.success('🎉 Teste da integração Lighter concluído!');
        
    } catch (error) {
        logger.error(`❌ Erro durante o teste: ${error.message}`);
        console.error(error);
    }
}

// Executa o teste
testLighterIntegration().catch(error => {
    console.error('Teste falhou:', error);
    process.exit(1);
}); 