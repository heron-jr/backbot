import nacl from 'tweetnacl';

export function auth({ instruction, params = {}, timestamp, window = 10000 }) {
  const privateKeySeed = Buffer.from(process.env.BACKPACK_API_SECRET, 'base64'); 
  const keyPair = nacl.sign.keyPair.fromSeed(privateKeySeed);

  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const baseString = sortedParams ? `${sortedParams}&` : '';
  const payload = `instruction=${instruction}&${baseString}timestamp=${timestamp}&window=${window}`;

  const signature = nacl.sign.detached(Buffer.from(payload), keyPair.secretKey);

  return {
    'X-API-Key': process.env.BACKPACK_API_KEY, 
    'X-Signature': Buffer.from(signature).toString('base64'), 
    'X-Timestamp': timestamp.toString(),
    'X-Window': window.toString(),
    'Content-Type' : 'application/json; charset=utf-8'
  };
}
