# BackBot - Bot de Trading Inteligente para Backpack Exchange

Bot de trading automatizado avançado para Backpack Exchange com estratégia inteligente baseada em múltiplos indicadores técnicos e filtros de confirmação.

## 🚀 Funcionalidades

- **Estratégia DEFAULT**: Sistema inteligente com 8 camadas de validação
- **Estratégia PRO_MAX**: Em breve - Estratégia avançada baseada em ADX
- **Sistema de Backtest**: Teste suas estratégias com dados históricos
- **Multi-Bot**: Execute múltiplas instâncias simultaneamente
- **Trailing Stop**: Proteção automática de lucros
- **🛡️ Sistema de Ordens de Segurança (Failsafe)**: SL/TP automáticos com cálculo correto de alavancagem
- **Logs Coloridos**: Interface visual clara e informativa

## 📊 Sistema de Backtest

O BackBot inclui um sistema de backtest para validar a estratégia DEFAULT com dados históricos reais da API.

## 🛠️ Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd backbot

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas chaves da Backpack
```

## ⚙️ Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar API Keys

O arquivo `.env` já está pré-configurado com todas as configurações necessárias! 🎉

**Você só precisa alterar a API KEY do Account 1:**

```env
# ========================================
# CONTA 1 - ESTRATÉGIA DEFAULT
# ========================================
ACCOUNT1_API_KEY=<API_KEY_ACCOCUNT1>      # ← ALTERE AQUI  
ACCOUNT1_API_SECRET=<SECRET_KEY_ACCOUNT1> # ← ALTERE AQUI
```

**Como obter suas API Keys na Backpack Exchange:**

1. Acesse: https://backpack.exchange
2. Faça login na sua conta
3. Vá para: Account > API Keys
4. Clique em "Create New API Key"
5. Configure:
   - Nome: "Backbot Trading"
   - Permissões: READ, TRADE
6. Salve as credenciais e copie para o arquivo `.env`

**⚠️ Configurações já pré-definidas:**
- Estratégia: DEFAULT (8 camadas de validação)
- Capital por trade: 30% (configurável)
- Máximo de posições: 3
- Timeframe: 5m
- Stop loss e take profit automáticos

**🔧 Configurações opcionais (já configuradas):**
- `MAX_NEGATIVE_PNL_STOP_PCT=10` - Stop loss em %
- `MIN_PROFIT_PCT=0.5` - Lucro mínimo
- `ORDER_TIMEOUT_MINUTES=10` - Timeout de ordens

## 🛡️ Sistema de Ordens de Segurança (Failsafe)

O bot inclui um sistema automático de ordens de segurança que cria Stop Loss e Take Profit para todas as posições abertas, servindo como uma "rede de segurança" caso o monitoramento ativo falhe.

### Funcionalidades
- **Cálculo Correto**: SL/TP calculados considerando alavancagem da posição
- **Criação Automática**: SL/TP criados imediatamente após abertura de posição
- **Monitoramento Contínuo**: Verifica e recria ordens se necessário
- **Configurável**: Preços baseados em variáveis de ambiente
- **Multi-Conta**: Suporte completo para CONTA1 e CONTA2

### Configuração
```bash
# Porcentagem mínima de lucro para take profit
MIN_PROFIT_PERCENTAGE=0.5

# Porcentagem máxima de perda para stop loss
MAX_NEGATIVE_PNL_STOP_PCT=4.0
```

### Exemplo de Cálculo
- **Cenário**: BTC a $50,000 com alavancagem 20x
- **Configuração**: TP 0.5%, SL 4%
- **Resultado**: 
  - TP executado em $50,012.50 (0.5% de lucro real)
  - SL executado em $50,100.00 (4% de perda real)

📖 [Documentação Completa do Sistema Failsafe](FAILSAFE_ORDERS_V2.md)

## 🚀 Uso

### Executar Bot de Trading

```bash
npm install

npm start
```

## 📈 Estratégias

### DEFAULT Strategy - Sistema Inteligente de 8 Camadas
- **Objetivo**: Trading inteligente com múltiplas validações
- **Camada 1**: Momentum (RSI Avançado) - Cruzamentos GREEN/RED + Sobrevenda/Sobrecompra
- **Camada 2**: Stochastic - Cruzamentos K/D em zonas extremas
- **Camada 3**: MACD - Momentum e tendência (histograma + cruzamentos)
- **Camada 4**: ADX - Força e direção da tendência
- **Camada 5**: Money Flow - Filtro de confirmação (MFI > 50 para LONG, < 50 para SHORT)
- **Camada 6**: VWAP - Filtro de tendência intradiária (Preço > VWAP para LONG, < VWAP para SHORT)
- **Camada 7**: BTC Trend - Filtro macro de correlação com Bitcoin
- **Camada 8**: Stop/Target - Cálculo inteligente baseado em VWAP + StdDev

### PRO_MAX Strategy - Em Breve
- **Status**: Em desenvolvimento
- **Objetivo**: Estratégia avançada baseada em ADX com múltiplas confluências
- **Base**: ADX (Average Directional Index) com níveis BRONZE, SILVER, GOLD, PLATINUM
- **Nota**: Esta estratégia ainda não está completa e não deve ser usada em produção

## 📁 Estrutura do Projeto

```
backbot/
├── src/
│   ├── Backpack/           # Integração com Backpack Exchange
│   ├── Config/            # Configurações
│   ├── Controllers/       # Controladores
│   ├── Decision/          # Lógica de decisão
│   │   ├── Strategies/    # Estratégias de trading
│   │   └── Indicators.js  # Indicadores técnicos
│   ├── MultiBot/          # Sistema multi-bot
│   ├── TrailingStop/      # Trailing stop
│   ├── Utils/             # Utilitários
│   └── Backtest/          # Sistema de backtest
│       ├── BacktestEngine.js
│       ├── BacktestRunner.js
│       └── DataProvider.js
├── backtest.js            # Script principal do backtest
├── bootstrap.js           # Inicialização do bot
└── package.json
```

## ⚠️ Disclaimer

Este software é para fins educacionais. Trading de criptomoedas envolve riscos significativos. Use por sua conta e risco.

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**BackBot** - Trading automatizado inteligente para Backpack Exchange 🚀