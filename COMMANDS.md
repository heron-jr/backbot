# 🤖 BackBot - Comandos Disponíveis

## 🚀 Comandos de Inicialização

### 🎯 Comando Principal (Recomendado para produção)
```bash
npm start
```
- **Executa diretamente** a estratégia DEFAULT (sem menu)
- Perfeito para produção e automação
- Inicia imediatamente sem interação

### 🎮 Comando com Menu Interativo (Recomendado para desenvolvimento)
```bash
npm run menu
```
- **Sempre** mostra o menu de seleção de estratégia
- Perfeito para desenvolvimento e testes
- Interface amigável e intuitiva

### ⚙️ Comandos Avançados

#### Development Mode (com auto-restart)
```bash
npm start                    # Executa DEFAULT diretamente
npm run menu                 # Mostra seleção de estratégia
npm run start:skip          # Pula seleção, usa estratégia do .env
```

#### Production Mode (sem auto-restart)
```bash
npm run prod                # Executa DEFAULT diretamente
npm run prod:menu           # Mostra seleção de estratégia
npm run prod:skip           # Pula seleção, usa estratégia do .env
```

#### Comandos Diretos (Node.js)
```bash
node app.js                 # Mostra seleção de estratégia
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
| `npm start` | **Executa DEFAULT diretamente** | Development | ✅ **Produção** |
| `npm run menu` | **Mostra seleção de estratégia** | Development | ✅ **Desenvolvimento** |
| `npm run start:skip` | Pula seleção, usa estratégia do .env | Development | Para avançados |
| `npm run prod` | **Executa DEFAULT diretamente** | Production | ✅ **Produção** |
| `npm run prod:menu` | **Mostra seleção de estratégia** | Production | ✅ **Desenvolvimento** |
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

### Para Produção (Recomendado)
```bash
npm start
```
- Executa diretamente a estratégia DEFAULT
- Ideal para automação e produção

### Para Desenvolvimento/Testes (Recomendado)
```bash
npm run menu
```
- Sempre mostra o menu de seleção
- Perfeito para testar diferentes estratégias

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