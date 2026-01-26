# 📁 Organização do Projeto - Sistema de Telemetria OBD

## ✅ Reorganização Concluída

O projeto foi completamente reorganizado para separar claramente o código de produção dos arquivos de desenvolvimento e testes.

## 📂 Nova Estrutura

### 🏗️ **Código de Produção** (`src/`)
```
src/
├── server.ts              # 🚀 Servidor TCP principal
├── protocol-decoder.ts    # 🔍 Decodificação de protocolos
├── database.ts            # 💾 Sistema de banco JSON
├── database-cli.ts        # 🖥️  CLI para gerenciar banco
├── populate-database.ts   # 📊 Script para popular banco
├── logger.ts              # 📝 Sistema de logging
├── data-logger.ts         # 📋 Logger de dados brutos
├── crc-utils.ts           # 🔧 Utilitários CRC
├── login-reply.ts         # 📨 Respostas de login
├── extract-gps-path.ts    # 🗺️  Extrator de trilhas GPS
└── log-viewer.ts          # 👁️  Visualizador de logs
```

### 🧪 **Arquivos de Teste** (`tests/`)
```
tests/
├── README.md              # 📖 Documentação dos testes
├── analysis/              # 📊 Análises e investigações
│   ├── test-scale-factor.ts      # Teste de fatores de escala
│   ├── analyze-structure.ts      # Análise da estrutura de dados
│   └── test-real-structure.ts    # Teste com estrutura real
├── debugging/             # 🐛 Ferramentas de debug
│   ├── debug-coordinates.ts      # Debug de coordenadas GPS
│   └── test-coordinates.ts       # Teste de correção de coordenadas
├── data-testing/          # 📋 Testes com dados reais
│   ├── final-test.ts             # Teste final de validação
│   ├── extract-real-data.ts      # Extração de dados reais
│   ├── analyze-real-data.ts      # Análise de dados coletados
│   ├── 0x1001Parsing Example.txt # Exemplo de parsing 0x1001
│   ├── 1001.txt                  # Dados de exemplo protocolo 1001
│   └── data_obd.txt              # Dados OBD coletados
├── protocol-testing/      # 🔌 Testes de protocolos
│   ├── analyze-3400.ts           # Análise do protocolo 0x3400
│   └── test-decoder.ts           # Teste do decodificador
└── tools/                 # 🛠️  Ferramentas utilitárias
    └── reprocess-logs.ts         # Reprocessamento de logs
```

### 💾 **Dados e Configuração**
```
obd_data/                  # Banco de dados
├── readings.json          # Dados principais
├── backup_*.json          # Backups automáticos
└── export_*.csv           # Exportações

logs/                      # Logs estruturados
└── data_*.log            # Dados brutos para análise

📄 Arquivos de configuração e documentação no diretório raiz
```

## 🎯 Benefícios da Organização

### ✅ **Código Limpo**
- **Separação clara**: Produção vs Desenvolvimento
- **Fácil manutenção**: Código principal organizado
- **Navegação simples**: Estrutura lógica e intuitiva

### 🧪 **Testes Organizados**
- **Categorização**: Por tipo de teste (análise, debug, dados, protocolos)
- **Documentação**: README explicativo em cada categoria
- **Histórico preservado**: Toda a jornada de desenvolvimento mantida

### 🚀 **Desenvolvimento Eficiente**
- **Foco no essencial**: `src/` contém apenas código de produção
- **Referência rápida**: Testes organizados por categoria
- **Reutilização**: Ferramentas utilitárias separadas

## 📋 Como Usar

### Executar Sistema Principal
```bash
# Servidor de produção
pnpm run dev

# CLI do banco de dados
npx ts-node src/database-cli.ts stats
```

### Executar Testes
```bash
# Testes de análise
npx ts-node tests/analysis/test-scale-factor.ts

# Testes de debug
npx ts-node tests/debugging/debug-coordinates.ts

# Testes de dados
npx ts-node tests/data-testing/final-test.ts

# Testes de protocolos
npx ts-node tests/protocol-testing/analyze-3400.ts

# Ferramentas
npx ts-node tests/tools/reprocess-logs.ts
```

## 🎉 Status Final

- ✅ **11 arquivos de produção** organizados em `src/`
- ✅ **12 arquivos de teste** organizados em `tests/`
- ✅ **5 categorias** de teste bem definidas
- ✅ **Documentação completa** em cada diretório
- ✅ **Funcionalidade preservada** - todos os testes funcionando
- ✅ **Estrutura escalável** para futuras adições

## 📚 Documentação Relacionada

- `CURSOR.md` - Guia completo para IA/desenvolvedores
- `tests/README.md` - Documentação específica dos testes
- `README.md` - Documentação geral do projeto
- `DATABASE_README.md` - Documentação do banco de dados

---

**Projeto 100% organizado e funcional!** 🎯 