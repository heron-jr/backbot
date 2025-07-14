# Gerenciamento de Capital - BackBot

## Visão Geral

O BackBot oferece duas formas de definir o volume de investimento por operação:
1. **Valor Fixo** (método original)
2. **Porcentagem do Capital** (novo método)

## Configuração

### Variáveis de Ambiente

```bash
# .env

# Método 1: Valor Fixo (USD)
VOLUME_ORDER=100

# Método 2: Porcentagem do Capital (0-100)
CAPITAL_PERCENTAGE=5  # 5% do capital disponível

# Outras configurações
LIMIT_ORDER=5         # Máximo de ordens abertas
```

### Prioridade de Configuração

1. **Se `CAPITAL_PERCENTAGE > 0`:** Usa porcentagem do capital
2. **Se `CAPITAL_PERCENTAGE = 0` ou não definido:** Usa valor fixo (`VOLUME_ORDER`)

## Exemplos de Uso

### Exemplo 1: Valor Fixo
```bash
# .env
VOLUME_ORDER=100
CAPITAL_PERCENTAGE=0  # ou não definir

# Resultado: Sempre investe $100 por operação
```

### Exemplo 2: Porcentagem do Capital
```bash
# .env
VOLUME_ORDER=100      # valor de fallback
CAPITAL_PERCENTAGE=5  # 5% do capital

# Cenário: Capital disponível = $10,000
# Resultado: Investe $500 por operação (5% de $10,000)
```

### Exemplo 3: Porcentagem Alta
```bash
# .env
CAPITAL_PERCENTAGE=10  # 10% do capital

# Cenário: Capital disponível = $5,000
# Resultado: Investe $500 por operação (10% de $5,000)
```

## Cálculo do Capital Disponível

```javascript
// Fórmula usada pelo bot
const capitalAvailable = netEquityAvailable * leverage * 0.95
```

**Onde:**
- `netEquityAvailable`: Patrimônio líquido da conta
- `leverage`: Alavancagem da exchange
- `0.95`: Fator de segurança (95% do capital total)

## Vantagens de Cada Método

### Valor Fixo (`VOLUME_ORDER`)
- ✅ **Previsível:** Sempre o mesmo valor
- ✅ **Controle direto:** Você define exatamente quanto investir
- ❌ **Não se adapta:** Não considera mudanças no capital

### Porcentagem (`CAPITAL_PERCENTAGE`)
- ✅ **Adaptativo:** Se ajusta ao capital disponível
- ✅ **Escalável:** Cresce/diminui com seu capital
- ✅ **Flexível:** Funciona com diferentes tamanhos de conta
- ❌ **Variável:** Valor muda conforme o capital

## Recomendações

### Para Contas Pequenas (< $1,000)
```bash
CAPITAL_PERCENTAGE=10  # 10% do capital
```

### Para Contas Médias ($1,000 - $10,000)
```bash
CAPITAL_PERCENTAGE=5   # 5% do capital
```

### Para Contas Grandes (> $10,000)
```bash
CAPITAL_PERCENTAGE=2   # 2% do capital
```

### Para Testes/Desenvolvimento
```bash
VOLUME_ORDER=50        # Valor fixo baixo
CAPITAL_PERCENTAGE=0   # Desabilita porcentagem
```

## Logs e Monitoramento

O bot mostra no console qual método está sendo usado:

```
💰 Usando 5% do capital: $500.00
```

ou

```
💰 Usando valor fixo: $100.00
```

## Validações de Segurança

### Limite Máximo
- O bot nunca investe mais que o capital disponível
- Se a porcentagem resultar em valor maior que o capital, usa o capital total

### Múltiplas Operações
- Cada operação respeita o limite individual
- O total de operações é limitado por `LIMIT_ORDER`

## Exemplo Completo

```bash
# .env
VOLUME_ORDER=100           # Fallback se porcentagem = 0
CAPITAL_PERCENTAGE=5       # 5% do capital
LIMIT_ORDER=5              # Máximo 5 ordens abertas

# Cenário:
# - Capital disponível: $8,000
# - Volume por operação: $400 (5% de $8,000)
# - Máximo total investido: $2,000 (5 operações × $400)
```

## Migração

### De Valor Fixo para Porcentagem
```bash
# Antes
VOLUME_ORDER=100

# Depois
VOLUME_ORDER=100          # mantém como fallback
CAPITAL_PERCENTAGE=5      # adiciona porcentagem
```

### De Porcentagem para Valor Fixo
```bash
# Antes
CAPITAL_PERCENTAGE=5

# Depois
CAPITAL_PERCENTAGE=0      # desabilita porcentagem
VOLUME_ORDER=100          # usa valor fixo
```

## Troubleshooting

### Problema: Volume muito alto
- **Solução:** Reduza `CAPITAL_PERCENTAGE` ou `VOLUME_ORDER`

### Problema: Volume muito baixo
- **Solução:** Aumente `CAPITAL_PERCENTAGE` ou `VOLUME_ORDER`

### Problema: Muitas operações simultâneas
- **Solução:** Reduza `LIMIT_ORDER` ou `CAPITAL_PERCENTAGE`

### Problema: Capital insuficiente
- **Solução:** Verifique se o capital disponível é suficiente para as operações 