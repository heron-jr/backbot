# Estratégias de Trading - BackBot

## Visão Geral

O BackBot agora suporta múltiplas estratégias de trading através de um sistema modular. Cada estratégia é implementada como uma classe separada que herda de `BaseStrategy`.

## Estratégias Disponíveis

### 1. DEFAULT
- **Descrição:** Estratégia original do bot
- **Lógica:** Combina EMA, RSI, MACD e VWAP para identificar oportunidades
- **Configuração:** `TRADING_STRATEGY=DEFAULT`

### 2. LEVEL
- **Descrição:** Estratégia baseada em níveis de suporte e resistência
- **Status:** Em desenvolvimento
- **Configuração:** `TRADING_STRATEGY=LEVEL`

## Configuração

### Variável de Ambiente
```bash
# .env
TRADING_STRATEGY=DEFAULT  # ou LEVEL
```

### Valores Suportados
- `DEFAULT` - Estratégia padrão (atual)
- `LEVEL` - Estratégia baseada em níveis

## Estrutura de Arquivos

```
src/Decision/Strategies/
├── BaseStrategy.js      # Classe base para todas as estratégias
├── StrategyFactory.js   # Factory para criar estratégias
├── DefaultStrategy.js   # Implementação da estratégia DEFAULT
└── LevelStrategy.js     # Implementação da estratégia LEVEL
```

## Dados Disponíveis para Estratégias

Cada estratégia recebe os seguintes dados de mercado:

### Indicadores Técnicos
```javascript
{
  ema: {
    ema9: number,           // EMA de 9 períodos
    ema21: number,          // EMA de 21 períodos
    diff: number,           // Diferença EMA9 - EMA21
    diffPct: number,        // Diferença percentual
    signal: 'bullish' | 'bearish',
    crossed: 'goldenCross' | 'deathCross' | null,
    candlesAgo: number | null  // Candles desde o último cruzamento
  },
  rsi: {
    value: number,          // Valor atual do RSI
    history: number[]       // Histórico do RSI
  },
  macd: {
    MACD: number,           // Linha MACD
    MACD_signal: number,    // Linha de sinal
    MACD_histogram: number  // Histograma
  },
  bollinger: {
    BOLL_upper: number,     // Banda superior
    BOLL_middle: number,    // Banda média
    BOLL_lower: number      // Banda inferior
  },
  vwap: {
    vwap: number,           // Valor VWAP
    stdDev: number,         // Desvio padrão
    upperBands: number[],   // Bandas superiores (±1, ±2, ±3)
    lowerBands: number[]    // Bandas inferiores (±1, ±2, ±3)
  },
  volume: {
    history: object[],      // Histórico de volume
    volume: { trend, slope, forecast },
    variance: { trend, slope, forecast },
    price: { trend, slope, forecast }
  },
  // Novos indicadores
  atr: {
    value: number,          // Valor atual do ATR (Average True Range)
    history: number[]       // Histórico do ATR
  },
  slowStochastic: {
    k: number,              // Linha %K do Stochastic
    d: number,              // Linha %D do Stochastic (média móvel de %K)
    history: object[]       // Histórico com {k, d}
  },
  adx: {
    adx: number,            // Valor ADX (Average Directional Index)
    pdi: number,            // +DI (Positive Directional Indicator)
    mdi: number,            // -DI (Negative Directional Indicator)
    adxEma: number,         // EMA de 21 períodos do ADX
    history: object[],      // Histórico com {adx, pdi, mdi}
    emaHistory: number[]    // Histórico da EMA do ADX
  }
}
```

### Dados de Mercado
```javascript
{
  market: {
    symbol: string,         // Símbolo do mercado
    decimal_quantity: number,
    decimal_price: number,
    stepSize_quantity: number,
    tickSize: number
  },
  marketPrice: number,      // Preço atual do mercado
  candles: object[]         // Dados de candlestick
}
```

## Implementando uma Nova Estratégia

### 1. Criar Nova Classe
```javascript
// src/Decision/Strategies/MinhaEstrategia.js
import { BaseStrategy } from './BaseStrategy.js';

export class MinhaEstrategia extends BaseStrategy {
  analyzeTrade(fee, data, investmentUSD, media_rsi) {
    // SUA LÓGICA AQUI
    return null; // ou objeto com decisão
  }
}
```

### 2. Adicionar ao Factory
```javascript
// src/Decision/Strategies/StrategyFactory.js
import { MinhaEstrategia } from './MinhaEstrategia.js';

// Adicionar no switch case:
case 'MINHA_ESTRATEGIA':
  return new MinhaEstrategia();
```

### 3. Configurar
```bash
# .env
TRADING_STRATEGY=MINHA_ESTRATEGIA
```

## Métodos Úteis da BaseStrategy

### validateData(data)
Valida se os dados necessários estão disponíveis.

### calculatePnLAndRisk(action, entry, stop, target, investmentUSD, fee)
Calcula PnL e risco de uma operação.

### calculateStopAndTarget(data, price, isLong, percentVwap)
Calcula stop e target baseados em bandas VWAP.

## Exemplo de Retorno de Estratégia

```javascript
{
  market: "SOL_USDC_PERP",
  entry: 98.50,           // Preço de entrada
  stop: 97.20,            // Preço de stop
  target: 100.30,         // Preço alvo
  action: "long",         // "long" ou "short"
  pnl: 15.20,            // PnL esperado
  risk: 8.50             // Risco calculado
}
```

## Logs e Debug

Cada estratégia pode usar `console.log` para debug:
```javascript
console.log('🎯 MinhaEstrategia: Sinal encontrado', { entry, stop, target });
```

## Boas Práticas

1. **Validação:** Sempre valide dados antes de processar
2. **Tratamento de Erro:** Use try/catch em métodos críticos
3. **Logs:** Adicione logs informativos para debug
4. **Documentação:** Documente a lógica da estratégia
5. **Testes:** Teste a estratégia antes de usar em produção

## Migração de Estratégias

Para trocar de estratégia:
1. Altere `TRADING_STRATEGY` no `.env`
2. Reinicie o bot
3. Monitore os logs para confirmar a mudança

## Troubleshooting

### Estratégia não encontrada
- Verifique se o valor de `TRADING_STRATEGY` está correto
- Confirme se a estratégia foi adicionada ao `StrategyFactory`

### Erro na estratégia
- Verifique os logs para detalhes do erro
- Confirme se todos os dados necessários estão disponíveis
- Teste a estratégia com dados de exemplo 