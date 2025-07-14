# Troubleshooting - BackBot

## Problemas Comuns e Soluções

### 1. Erros de Autenticação

#### Problema: `Invalid signature, could not verify signature`

**Causas:**
- Chaves de API incorretas
- Chaves não estão em formato base64
- Chaves não têm permissões adequadas

**Soluções:**
```bash
# Teste a autenticação
npm run test-auth

# Verifique seu .env
PRIVATE_KEY=sua_chave_privada_base64
PUBLIC_KEY=sua_chave_publica_base64
```

### 2. Erros de Ordem Inválida

#### Problema: `Order would immediately match and take`

**Causa:** O preço da ordem está muito próximo do preço de mercado, causando execução imediata que viola `postOnly: true`.

**Solução Implementada:**
- ✅ Ajuste automático de preço (5 ticks de distância)
- ✅ Fallback com preço mais conservador (10 ticks)
- ✅ Logs informativos do ajuste

**Logs Esperados:**
```
💰 SOL_USDC_PERP: Preço original 98.500000 → Ajustado 98.499500 (BID)
```

### 3. Problemas de Capital

#### Problema: `Capital insuficiente`

**Soluções:**
```bash
# Reduza o volume por operação
VOLUME_ORDER=50

# Ou use porcentagem menor
CAPITAL_PERCENTAGE=2
```

### 4. Problemas de Rate Limiting

#### Problema: `Too many requests`

**Soluções:**
```bash
# Aumente o intervalo de análise
TIME=5m

# Reduza o número de mercados
AUTHORIZED_MARKET=["BTC_USDC_PERP","SOL_USDC_PERP"]
```

### 5. Problemas de Liquidez

#### Problema: Ordens não executam

**Soluções:**
- Verifique se o mercado tem liquidez suficiente
- Reduza o volume da ordem
- Use mercados mais líquidos

### 6. Problemas de Configuração

#### Problema: Bot não inicia

**Verificações:**
```bash
# 1. Verifique se todas as variáveis estão definidas
cat .env

# 2. Teste a autenticação
npm run test-auth

# 3. Verifique os logs
npm start
```

### 7. Problemas de Performance

#### Problema: Bot lento ou travando

**Soluções:**
```bash
# Reduza o número de mercados
AUTHORIZED_MARKET=["BTC_USDC_PERP"]

# Aumente o intervalo
TIME=15m

# Reduza o limite de ordens
LIMIT_ORDER=5
```

## Logs e Debug

### Logs Informativos
```
🤖 Estratégia carregada: DEFAULT
💰 Usando valor fixo: $100.00
🔍 Analyzing SOL_USDC_PERP
💰 SOL_USDC_PERP: Preço original 98.500000 → Ajustado 98.499500 (BID)
✅ executeOrder Success! SOL_USDC_PERP
```

### Logs de Erro
```
❌ Falha ao carregar dados da conta. Verifique suas credenciais de API.
❌ OrderController.openOrder - Error: Order would immediately match and take
⚠️ Tentando ordem com preço mais conservador para SOL_USDC_PERP
```

## Configurações Recomendadas

### Para Testes
```bash
# Configuração conservadora para testes
VOLUME_ORDER=50
LIMIT_ORDER=3
AUTHORIZED_MARKET=["BTC_USDC_PERP"]
TIME=5m
```

### Para Produção
```bash
# Configuração balanceada
VOLUME_ORDER=100
CAPITAL_PERCENTAGE=5
LIMIT_ORDER=10
TIME=1m
```

### Para Alta Frequência
```bash
# Configuração agressiva
VOLUME_ORDER=200
CAPITAL_PERCENTAGE=10
LIMIT_ORDER=20
TIME=1m
```

## Comandos Úteis

### Testar Autenticação
```bash
npm run test-auth
```

### Verificar Logs
```bash
npm start
```

### Executar em Produção
```bash
npm run prod
```

## Contato e Suporte

Se você encontrar problemas não cobertos aqui:

1. **Verifique os logs** para identificar o erro específico
2. **Teste a autenticação** com `npm run test-auth`
3. **Verifique a documentação** em `docs/`
4. **Reporte o problema** com logs detalhados

## Prevenção de Problemas

### Boas Práticas
1. **Sempre teste** em ambiente de desenvolvimento primeiro
2. **Monitore os logs** regularmente
3. **Use volumes conservadores** inicialmente
4. **Verifique a liquidez** dos mercados
5. **Mantenha as chaves seguras** e atualizadas

### Checklist de Configuração
- [ ] Chaves de API configuradas corretamente
- [ ] Autenticação testada com `npm run test-auth`
- [ ] Volume de ordem apropriado para o capital
- [ ] Mercados com liquidez suficiente
- [ ] Intervalo de análise adequado
- [ ] Limite de ordens razoável 