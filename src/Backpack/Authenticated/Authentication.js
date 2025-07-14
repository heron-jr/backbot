import nacl from 'tweetnacl';

export function auth({ instruction, params = {}, timestamp, window = 5000 }) {
  try {
    // Verifica se as chaves estão definidas
    if (!process.env.PRIVATE_KEY || !process.env.PUBLIC_KEY) {
      throw new Error('PRIVATE_KEY e PUBLIC_KEY devem estar definidas no .env');
    }

    // Decodifica a chave privada
    const privateKeySeed = Buffer.from(process.env.PRIVATE_KEY, 'base64'); 
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
      'X-API-Key': process.env.PUBLIC_KEY,
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
