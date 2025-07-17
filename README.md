# BackBot

A crypto trading bot for Backpack Exchange. It trades perpetual futures automatically using custom strategies and real-time market data.

## 🏃‍♂️ Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the bot:**
   ```bash
   # Executa diretamente a estratégia DEFAULT (sem menu)
   npm start
   
   # Executa a estratégia PROMAX (desenvolvimento com auto-reload)
   npm run promax
   
   # Executa a estratégia PROMAX em produção
   npm run promax:prod
   
   # Executa com menu de seleção de estratégia
   npm run menu
   
   # Executa em produção com menu de seleção
   npm run prod:menu
   ```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Configurações da API
API_URL=https://api.backpack.exchange
ACCOUNT1_API_KEY=sua_api_key_conta1
ACCOUNT1_API_SECRET=sua_api_secret_conta1
ACCOUNT2_API_KEY=sua_api_key_conta2
ACCOUNT2_API_SECRET=sua_api_secret_conta2

# Configurações de Trading
TRADING_STRATEGY=DEFAULT  # ou PRO_MAX
TIME=5m                   # Timeframe para análise
CAPITAL_PERCENTAGE=30     # Percentual do capital por operação
LEVERAGE=1               # Alavancagem
MIN_PROFIT_PERCENTAGE=5  # Percentual mínimo de lucro para fechar (5-10% recomendado)
MAX_TAKE_PROFIT_ORDERS=5 # Número máximo de ordens de take profit por posição

# Configurações de Segurança
IGNORE_BRONZE_SIGNALS=true  # Ignora sinais bronze (menos confiáveis)
```

### ⚠️ Aviso Importante sobre MIN_PROFIT_PERCENTAGE

**NÃO configure `MIN_PROFIT_PERCENTAGE=0`** a menos que você entenda completamente as implicações:

- **Valor 0**: Pode causar fechamentos muito rápidos com lucros mínimos
- **Recomendado**: Entre 5-10% para operações mais seguras
- **Efeito**: Controla quando o trailing stop deve fechar a posição baseado no lucro líquido

### Configuração MAX_TAKE_PROFIT_ORDERS

A variável `MAX_TAKE_PROFIT_ORDERS` controla o número máximo de ordens de take profit que serão criadas para cada posição:

- **Padrão**: 5 ordens
- **Efeito**: Limita a quantidade de alvos de lucro por operação
- **Recomendado**: Entre 3-10 dependendo da sua estratégia
- **Evita**: Criação excessiva de ordens e loops infinitos