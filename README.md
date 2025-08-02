# BackBot - Bot de Trading Inteligente para Backpack Exchange

Bot de trading automatizado de nível profissional para a Backpack Exchange, focado em farming de volume com gestão de risco avançada e **Stop Loss Adaptativo Inteligente**.

## 🚀 Funcionalidades Principais

- **Estratégia `DEFAULT` Inteligente**: Sistema robusto com 8 camadas de validação para encontrar sinais de alta confluência.
- **🛡️ Stop Loss Adaptativo com ATR**: Sistema inteligente que ajusta o stop loss automaticamente baseado na volatilidade do mercado usando ATR (Average True Range).
- **🎯 Take Profit Parcial Inteligente**: Executa automaticamente pela corretora, garantindo que parte dos lucros seja protegida mesmo se o bot parar.
- **Execução Híbrida de Ordens**: Tenta executar ordens com taxas mínimas (LIMIT) e possui um fallback inteligente para ordens a MERCADO, garantindo que boas oportunidades não sejam perdidas.
- **Trailing Stop Dinâmico**: Maximiza os lucros ao permitir que operações vencedoras "corram", movendo o stop loss automaticamente para proteger os ganhos.
- **Sistema de "Failsafe" na Corretora**: Cria ordens de Stop Loss e Take Profit diretamente na exchange como uma rede de segurança contra falhas.
- **Persistência de Estado**: Salva o estado do Trailing Stop em um arquivo `trailing_state.json`, garantindo que o bot sobreviva a reinicializações sem perder a gestão das posições.
- **Sistema de Backtest de Alta Fidelidade**: Permite testar e otimizar a estratégia com simulações que replicam o comportamento do mercado em tempo real.
- **Logs Claros e Informativos**: Saída de console limpa que permite acompanhar as decisões do bot.

---

## 🛠️ Instalação e Configuração

### Passo 1: Instalação
```bash
# Clone o repositório
git clone <URL_DO_SEU_REPOSITORIO>
cd backbot

# Instale as dependências
npm install
```

### Passo 2: Configuração do `.env`
Abra o arquivo `.env` e preencha com suas chaves de API da Backpack e ajuste os parâmetros conforme a explicação abaixo.

---

## ⚙️ Entendendo as Configurações (`.env`)

Aqui está uma explicação detalhada das principais configurações no seu arquivo `.env`.

### Configuração da Conta Principal (`DEFAULT`)
Estas são as configurações para a sua estratégia principal de farming de volume.

| Variável | Exemplo | Descrição |
| :--- | :--- | :--- |
| `ACCOUNT1_CAPITAL_PERCENTAGE` | `20` | **Capital por Operação.** Define a porcentagem do seu capital que será usada como margem para cada nova operação. `20` significa 20%. |
| `ACCOUNT1_TIME` | `15m` | **Timeframe de Análise.** O tempo gráfico que o bot usará para analisar o mercado e encontrar sinais. |
| `MAX_OPEN_TRADES` | `3` | **Máximo de Posições Abertas.** O número máximo de operações que o bot pode manter abertas simultaneamente. |

### Configurações de Execução de Ordens
Controla como o bot se comporta ao abrir uma posição.

| Variável | Exemplo | Descrição |
| :--- | :--- | :--- |
| `ORDER_EXECUTION_TIMEOUT_SECONDS`| `30` | **Timeout da Ordem a Limite.** Tempo em segundos que o bot espera por uma ordem a limite (mais barata) ser executada. Se o tempo expirar, ele cancela e tenta uma ordem a mercado para não perder a oportunidade. |
| `MAX_SLIPPAGE_PCT`| `0.5` | **Derrapagem Máxima.** Trava de segurança. Se, no momento da execução a mercado, o preço já se moveu mais que esta porcentagem, o bot cancela a operação para te proteger. `0.5` significa 0.5%. |

### Configurações de Risco e Lucro (MUITO IMPORTANTE)
Esta seção define a matemática da sua estratégia.

| Variável | Exemplo | Descrição |
| :--- | :--- | :--- |
| **`ENABLE_TRAILING_STOP`** | `true` | **Ativa o Trailing Stop.** Se `true`, o bot usará o stop móvel para maximizar os lucros e ignorará o `MIN_PROFIT_PERCENTAGE`. Se `false`, usará o Take Profit fixo. |
| **`TRAILING_STOP_DISTANCE`** | `1.5` | **Distância do Trailing Stop.** A "folga" em porcentagem que o stop móvel ficará do preço. Valores maiores dão mais espaço para o trade respirar, mas protegem menos o lucro. |
| **`MIN_PROFIT_PERCENTAGE`** | `10` | **Alvo de Lucro Fixo (só usado se o Trailing Stop estiver DESATIVADO).** Define a meta de lucro em porcentagem sobre a margem para fechar uma operação. |
| **`MAX_NEGATIVE_PNL_STOP_PCT`**| `-10`| **Stop Loss Máximo.** Define a perda máxima em porcentagem sobre a margem antes que a posição seja fechada para proteger seu capital. |

### 🛡️ Configurações do Stop Loss Adaptativo (NOVO!)
Sistema inteligente que ajusta o stop loss automaticamente baseado na volatilidade do mercado.

| Variável | Exemplo | Descrição |
| :--- | :--- | :--- |
| **`ENABLE_HYBRID_STOP_STRATEGY`** | `true` | **Ativa o Stop Loss Adaptativo.** Se `true`, o bot usará ATR para calcular stop loss dinâmico. Se `false`, usará stop loss fixo baseado em `MAX_NEGATIVE_PNL_STOP_PCT`. |
| **`INITIAL_STOP_ATR_MULTIPLIER`** | `2.0` | **Multiplicador ATR para Stop Inicial.** Quanto maior, mais distante será o stop loss inicial. Recomendado: 2.0 para mercados normais, 1.5 para mercados voláteis. |
| **`TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER`** | `1.5` | **Multiplicador ATR para Take Profit Parcial.** Define onde será executado o take profit parcial. Recomendado: 1.5 para equilíbrio risco/lucro. |
| **`PARTIAL_PROFIT_PERCENTAGE`** | `50` | **Porcentagem da Posição para TP Parcial.** Quantos % da posição serão fechados no take profit parcial. Recomendado: 50% para equilíbrio. |

**Recomendação de Distância do Trailing Stop por Timeframe:**

| Timeframe | `TRAILING_STOP_DISTANCE` Sugerido |
| :--- | :--- |
| 15m | 1.0% a 1.5% |
| 30m, 1h | 1.5% a 2.9% |
| 2h, 4h | 3.0% a 4.0% |

**Recomendação de Multiplicadores ATR por Volatilidade:**

| Condição de Mercado | `INITIAL_STOP_ATR_MULTIPLIER` | `TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER` |
| :--- | :--- | :--- |
| Mercado Calmo (Baixa Volatilidade) | 2.5 | 2.0 |
| Mercado Normal | 2.0 | 1.5 |
| Mercado Volátil (Alta Volatilidade) | 1.5 | 1.0 |

---

## 🛡️ Como Funciona o Stop Loss Adaptativo na Prática

### **📊 O que é ATR (Average True Range)?**
ATR é um indicador que mede a volatilidade do mercado. Quanto maior o ATR, mais volátil é o mercado. O bot usa isso para ajustar automaticamente o stop loss.

### **🎯 Como Funciona na Prática:**

#### **1. 🚀 Entrada na Posição**
- Bot calcula o ATR atual do mercado
- Define stop loss = ATR × `INITIAL_STOP_ATR_MULTIPLIER`
- Define take profit parcial = ATR × `TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER`
- **Exemplo:** ATR = 2%, Multiplicador = 2.0 → Stop Loss = 4% da entrada

#### **2. 🎯 Take Profit Parcial Executado**
- Quando o preço atinge o take profit parcial, a corretora executa automaticamente
- Bot detecta a redução da posição
- **Move o stop loss para o preço de entrada (breakeven)**
- Agora você está protegido contra perdas!

#### **3. 📈 Trailing Stop Ativo**
- Após o take profit parcial, o trailing stop entra em ação
- Stop loss vai "seguindo" o preço para maximizar lucros
- **Proteção total dos lucros já realizados**

### **🛡️ Dupla Proteção:**
1. **Failsafe na Corretora:** Ordem de stop loss sempre ativa na exchange
2. **Monitoramento Inteligente:** Bot monitora e ajusta baseado em ATR

### **💡 Exemplo Prático:**
```
Mercado: BTC/USDC
ATR: 2.5% (mercado normal)
Configuração: INITIAL_STOP_ATR_MULTIPLIER = 2.0

Resultado:
- Stop Loss: 5% da entrada (2.5% × 2.0)
- Take Profit Parcial: 3.75% da entrada (2.5% × 1.5)
- Após TP parcial: Stop vai para breakeven
- Trailing: Protege lucros automaticamente
```

---

## 🚀 Executando o Bot

Para iniciar o bot com a sua configuração, use o comando:

```bash
npm start
```

O bot começará a analisar o mercado e a operar de acordo com suas configurações.

## ⚠️ Disclaimer

Este software é fornecido para fins educacionais e de pesquisa. O trading de criptomoedas envolve riscos significativos. Os autores não se responsabilizam por quaisquer perdas financeiras. **Use por sua conta e risco.**