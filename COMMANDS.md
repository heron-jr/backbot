# 🤖 BackBot - Comandos Disponíveis

## 🚀 Comandos de Inicialização

### 🎯 Comando Principal (Recomendado para iniciantes)
```bash
npm start
```
- **Sempre** mostra o menu de seleção de estratégia
- Perfeito para novos usuários
- Interface amigável e intuitiva

### ⚙️ Comandos Avançados

#### Development Mode (com auto-restart)
```bash
npm start                    # Sempre mostra seleção (recomendado)
npm run start:skip          # Pula seleção, usa estratégia do .env
```

#### Production Mode (sem auto-restart)
```bash
npm run prod                # Sempre mostra seleção
npm run prod:skip           # Pula seleção, usa estratégia do .env
```

#### Comandos Diretos (Node.js)
```bash
node app.js                 # Sempre mostra seleção
node app.js -- --skip-selection  # Pula seleção
```

## 🧪 Comandos de Teste
```bash
# Teste de autenticação
npm run test-auth
```

## 📋 Resumo dos Scripts

| Comando | Descrição | Modo | Recomendado |
|---------|-----------|------|-------------|
| `npm start` | **Sempre mostra seleção de estratégia** | Development | ✅ **Sim** |
| `npm run start:skip` | Pula seleção, usa estratégia do .env | Development | Para avançados |
| `npm run prod` | **Sempre mostra seleção de estratégia** | Production | ✅ **Sim** |
| `npm run prod:skip` | Pula seleção, usa estratégia do .env | Production | Para avançados |
| `npm run test-auth` | Teste de autenticação | Test | Para debug |

## 🎯 Estratégias Disponíveis

### DEFAULT
- **Foco**: Volume na corretora
- **Objetivo**: Maximizar número de operações
- **Ideal para**: Corretoras que pagam por volume

### PRO_MAX  
- **Foco**: Lucro e qualidade de sinais
- **Objetivo**: Maximizar retorno por operação
- **Ideal para**: Traders que buscam lucro consistente

## ⚙️ Configuração

### Para Usuários Iniciantes (Recomendado)
```bash
npm start
```
- Sempre mostra o menu de seleção
- Não precisa configurar nada no `.env`

### Para Usuários Avançados (Auto-start)
Configure no arquivo `.env`:
```bash
TRADING_STRATEGY=DEFAULT
# ou
TRADING_STRATEGY=PRO_MAX
```

Então use:
```bash
npm run start:skip
# ou
npm run prod:skip
``` 