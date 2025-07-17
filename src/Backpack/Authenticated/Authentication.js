import nacl from 'tweetnacl';

export function auth({ instruction, params = {}, timestamp, window = 30000, strategy = null }) {
  try {
    // Determina qual conta usar baseado na estratégia
    const finalStrategy = strategy || process.env.TRADING_STRATEGY || 'DEFAULT';
    let apiKey, apiSecret;
    
    if (finalStrategy === 'DEFAULT') {
      // Para estratégia DEFAULT, usa credenciais da CONTA1
      apiKey = process.env.ACCOUNT1_API_KEY;
      apiSecret = process.env.ACCOUNT1_API_SECRET;
    } else if (finalStrategy === 'PRO_MAX') {
      // Para estratégia PRO_MAX, tenta usar credenciais da CONTA2 primeiro
      apiKey = process.env.ACCOUNT2_API_KEY;
      apiSecret = process.env.ACCOUNT2_API_SECRET;
      
      // Se CONTA2 não estiver configurada, usa CONTA1 como fallback
      if (!apiKey || !apiSecret) {
        console.log(`⚠️ [AUTH] CONTA2 não configurada para estratégia PRO_MAX`);
        console.log(`   Usando credenciais da CONTA1 como fallback`);
        apiKey = process.env.ACCOUNT1_API_KEY;
        apiSecret = process.env.ACCOUNT1_API_SECRET;
      }
    } else {
      // Fallback para credenciais padrão (compatibilidade)
      apiKey = process.env.API_KEY;
      apiSecret = process.env.API_SECRET;
    }
    
    // Verifica se as chaves estão definidas
    if (!apiSecret || !apiKey) {
      throw new Error(`API_SECRET e API_KEY devem estar definidas no .env para estratégia ${finalStrategy}`);
    }

    // Decodifica a chave privada
    const privateKeySeed = Buffer.from(apiSecret, 'base64'); 
    const keyPair = nacl.sign.keyPair.fromSeed(privateKeySeed);

    // Ordena e constrói os parâmetros
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const baseString = sortedParams ? `${sortedParams}&` : '';
    const payload = `instruction=${instruction}&${baseString}timestamp=${timestamp}&window=${window}`;

    // Gera a assinatura
    const signature = nacl.sign.detached(Buffer.from(payload), keyPair.secretKey);

    return {
      'X-API-Key': apiKey,
      'X-Signature': Buffer.from(signature).toString('base64'),
      'X-Timestamp': timestamp.toString(),
      'X-Window': window.toString(),
      'Content-Type': 'application/json; charset=utf-8'
    };
  } catch (error) {
    console.error('❌ Erro na autenticação:', error.message);
    throw error;
  }
}
