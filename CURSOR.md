# 🚗 Sistema de Telemetria OBD - Guia para IA

## 📋 Visão Geral do Projeto

Sistema completo de telemetria OBD para recepção, decodificação e armazenamento de dados de veículos via protocolo proprietário. Inclui servidor TCP, decodificador de protocolos, banco de dados JSON e ferramentas CLI.

## 📦 **IMPORTANTE: Gerenciamento de Pacotes**

> ⚠️ **SEMPRE usar `npx pnpm` para instalação de dependências neste projeto**

### **Comandos de Instalação**
```bash
# ✅ CORRETO - Instalar dependências
npx pnpm install express cors @types/express @types/cors

# ✅ CORRETO - Instalar dependência de desenvolvimento
npx pnpm install -D @types/node typescript ts-node

# ✅ CORRETO - Instalar globalmente
npx pnpm install -g nodemon

# ❌ NUNCA usar npm diretamente
# npm install express  # PROIBIDO
```

### **Motivos para usar PNPM**
- 🚀 **Performance superior** - instalação até 2x mais rápida
- 💾 **Economia de espaço** - compartilhamento inteligente de dependências
- 🔒 **Resolução determinística** - evita conflitos de versão
- 📦 **Compatibilidade total** - funciona com todos os pacotes npm

## 🏗️ Arquitetura do Sistema

### Componentes Principais

1. **Servidor TCP** (`src/server.ts`)
   - Recebe dados de dispositivos OBD na porta 29479
   - Decodifica protocolos 0x1001 e 0x3400
   - Salva automaticamente no banco de dados
   - Sistema de logging integrado

2. **Decodificador de Protocolos** (`src/protocol-decoder.ts`)
   - Classe estática com métodos `ProtocolDecoder.decodeMessage(Buffer)`
   - Detecta automaticamente o tipo de protocolo
   - Corrige coordenadas GPS para localização brasileira
   - Extrai Device ID completo (17 bytes)

3. **Sistema de Banco de Dados** (`src/database.ts`)
   - Implementação JSON para facilidade de uso
   - Singleton pattern: `DatabaseManager.getInstance()`
   - Campos obrigatórios: `deviceId`, `totalFuel`, `currentFuel`
   - Backup automático e exportação CSV

4. **Sistema de Logging** (`src/logger.ts`)
   - Logs estruturados com níveis (DEBUG, INFO, WARN, ERROR)
   - Timestamp ISO e contexto detalhado
   - Formatação colorida para console

## 🗃️ Estrutura de Dados

### Interface Principal (`DecodedMessage`)

```typescript
interface DecodedMessage {
  deviceId: string;           // ID completo do dispositivo (17 bytes)
  protocolId: string;         // '0x1001' ou '0x3400'
  timestamp: string;          // ISO string do GPS/dispositivo
  
  gps?: {
    latitude: number;         // Coordenadas corrigidas (Brasil)
    longitude: number;        // Fator de escala: 3.600.000
    speedKmH: number;
    direction: number;
    satellites: number;
    gpsFix: string;
  };
  
  tripData?: {
    totalMileage: number;     // Quilometragem total
    currentMileage: number;   // Quilometragem da viagem
    totalFuel: number;        // 🔥 CAMPO OBRIGATÓRIO
    currentFuel: number;      // 🔥 CAMPO OBRIGATÓRIO
  };
  
  vehicleState?: {
    powerOn: boolean;
    accOn: boolean;
    ignitionOn: boolean;
  };
  
  voltage?: number;
  versions?: {
    software: string;
    hardware: string;
  };
}
```

### Banco de Dados (`obd_readings`)

```json
{
  "id": 1,
  "deviceId": "218LSAB2025000004",
  "timestamp": "2025-05-26T13:32:23.000Z",
  "protocolId": "0x1001",
  "latitude": -22.974750,
  "longitude": -43.372520,
  "speedKmH": 15.876,
  "totalMileage": 113661,
  "currentMileage": 1161,
  "totalFuel": 0,      // Campo obrigatório
  "currentFuel": 0,    // Campo obrigatório
  "powerOn": true,
  "accOn": true,
  "voltage": 14.2,
  "rawHex": "4040860004...",
  "createdAt": "2025-05-29T00:01:24.606Z"
}
```

## 🔧 Padrões de Código

### 1. **Imports e Módulos**
```typescript
// ✅ Correto - Usar imports específicos
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ❌ Evitar - Imports genéricos
import * as fs from 'fs';
```

### 2. **Logging Pattern**
```typescript
// ✅ Sempre usar o Logger centralizado
Logger.info('📨 Dados recebidos', { hex: hexData, length: data.length });
Logger.error('❌ Erro ao processar', { error, context: 'additional_info' });

// ✅ Usar emojis para categorização visual
// 📨 Recepção de dados
// ✅ Sucesso
// ❌ Erro
// ⚠️  Warning
// 🔍 Debug/Análise
// 💾 Banco de dados
// 🗺️ GPS
// ⛽ Combustível
```

### 3. **Tratamento de Erros**
```typescript
try {
  const result = await operation();
  Logger.info('✅ Operação bem-sucedida', { result });
} catch (error) {
  Logger.error('❌ Falha na operação', { 
    error: error instanceof Error ? error.message : String(error),
    context: 'operation_context'
  });
  throw error; // Re-throw se necessário
}
```

### 4. **Singleton Pattern (Database)**
```typescript
// ✅ Sempre usar getInstance()
const dbManager = DatabaseManager.getInstance();
await dbManager.initialize();

// ❌ Nunca instanciar diretamente
// const dbManager = new DatabaseManager(); // ERRO
```

### 5. **Métodos Estáticos (ProtocolDecoder)**
```typescript
// ✅ Usar métodos estáticos
const decoded = ProtocolDecoder.decodeMessage(buffer);

// ❌ Não instanciar a classe
// const decoder = new ProtocolDecoder(); // ERRO
```

## 📁 Estrutura de Arquivos

```
src/
├── server.ts              # Servidor TCP principal
├── protocol-decoder.ts    # Decodificação de protocolos
├── database.ts            # Sistema de banco JSON
├── database-cli.ts        # CLI para gerenciar banco
├── populate-database.ts   # Script para popular banco
├── logger.ts              # Sistema de logging
├── data-logger.ts         # Logger de dados brutos
├── crc-utils.ts           # Utilitários CRC
├── login-reply.ts         # Respostas de login
├── extract-gps-path.ts    # Extrator de trilhas GPS
└── log-viewer.ts          # Visualizador de logs

tests/                     # 🧪 Diretório de testes organizados
├── README.md              # Documentação dos testes
├── analysis/              # Análises e investigações
│   ├── test-scale-factor.ts
│   ├── analyze-structure.ts
│   └── test-real-structure.ts
├── debugging/             # Ferramentas de debug
│   ├── debug-coordinates.ts
│   └── test-coordinates.ts
├── data-testing/          # Testes com dados reais
│   ├── final-test.ts
│   ├── extract-real-data.ts
│   ├── analyze-real-data.ts
│   ├── 0x1001Parsing Example.txt
│   ├── 1001.txt
│   └── data_obd.txt
├── protocol-testing/      # Testes de protocolos
│   ├── analyze-3400.ts
│   └── test-decoder.ts
└── tools/                 # Ferramentas utilitárias
    └── reprocess-logs.ts

obd_data/                  # Diretório do banco
├── readings.json          # Dados principais
├── backup_*.json          # Backups automáticos
└── export_*.csv           # Exportações

logs/                      # Logs estruturados
└── data_*.log            # Dados brutos para análise
```

## 🚀 Scripts NPM Disponíveis

```bash
# Desenvolvimento
npx pnpm run dev         # Servidor com hot-reload
npx pnpm run build       # Build TypeScript

# Banco de Dados
npx pnpm run db stats    # Estatísticas
npx pnpm run db recent   # Leituras recentes
npx pnpm run db gps <id> # Trilha GPS
npx pnpm run db export   # Exportar CSV
npx pnpm run db backup   # Criar backup
npx pnpm run populate    # Popular com logs

# Testes
npx pnpm run test        # Testes de protocolo
npx pnpm run logs        # Testar logs reais
npx pnpm run coords      # Testar coordenadas
npx pnpm run gps         # Extrair trilha GPS

# ⚠️ LEMBRETE: Sempre usar 'npx pnpm' em vez de 'npm'
```

## 🔍 Detecção de Protocolos

### Protocolo 0x1001 (Principal)
- **Header**: `0x4040`
- **Device ID**: Posição 5-21 (17 bytes úteis)
- **GPS**: Coordenadas com fator 3.600.000 e sinal negativo (Brasil)
- **Estado**: Little Endian, bits Power/ACC/Ignição

### Protocolo 0x3400 (Secundário)
- **Header**: Detectado por padrão
- **Estrutura**: Experimental, baseada em análise de dados

## 💾 Integração com Banco

### Salvamento Automático
```typescript
// No servidor, cada mensagem decodificada é salva automaticamente
const decodedMessage = ProtocolDecoder.decodeMessage(data);
if (decodedMessage) {
  const recordId = this.dbManager.saveReading(decodedMessage, hexData);
  Logger.info('💾 Dados salvos no banco', { recordId });
}
```

### Consultas Principais
```typescript
// Estatísticas gerais
const stats = dbManager.getStatistics();

// Leituras por dispositivo
const readings = dbManager.getReadings('218LSAB2025000004', 50);

// Trilha GPS
const trail = dbManager.getGPSTrail('218LSAB2025000004');

// Dados de combustível
const fuelData = dbManager.getFuelData('218LSAB2025000004');
```

## 🗺️ Correções GPS Aplicadas

### Coordenadas Brasileiras
- **Fator de escala**: 3.600.000 (não 1.000.000)
- **Sinal**: Negativo para Hemisfério Sul
- **Fórmula**: `latitude = -latitudeRaw / 3600000`
- **Validação**: Coordenadas devem estar na faixa do Rio de Janeiro

### 🚗 **Correção de Hodômetro (DESCOBERTA IMPORTANTE)**
- **Problema**: Hodômetro enviado em **milésimos de milha**, não quilômetros
- **Solução**: Conversão `totalMileage = Math.round(rawValue / 1609.344)`
- **Fator**: 1609.344 (conversão exata milha → quilômetro)
- **Exemplo**: 217.606 raw → 135 km (confere com painel do veículo)

### Exemplo de Correção
```typescript
// Dados brutos: 06520300 = 217606
// Aplicando correção: 217606 / 1609.344 = 135.21 km
// Resultado: Hodômetro correto conforme painel do veículo ✅
```

## 🌐 **Endpoints HTTP Integrados**

> **✅ NOVA FUNCIONALIDADE: API REST integrada no servidor principal**

### **Arquitetura Dual-Server**
```
🏢 SISTEMA ÚNICO (server.ts)
├─ 🔌 TCP Server (Porta 29479) - Comunicação OBD
├─ 🌐 HTTP Server (Porta 3000) - API REST + Interface Web
└─ 💾 Database Compartilhado - SQLite/JSON
```

### **Endpoints Disponíveis**
```typescript
// Health check
GET /health

// Listar dispositivos
GET /api/devices

// Relatório completo (JSON)
GET /api/reports/:deviceId

// Download relatório (Markdown)
GET /api/reports/:deviceId/markdown

// Leituras brutas
GET /api/readings/:deviceId

// Interface web
GET /
```

### **Exemplo de Uso**
```bash
# Iniciar sistema completo
npx pnpm run dev

# Testar endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/devices
curl http://localhost:3000/api/reports/218LSAB2025000004
```

### **Classes Principais**
- `SimpleReportGenerator`: Análise automática de coordenadas e relatórios
- `OBDServer`: Servidor dual (TCP + HTTP) integrado
- Interface web moderna com design glassmorphism

## ⚠️ Considerações Importantes

### TypeScript Config
- **Lib**: `["ES2020", "dom"]` para console e Node.js
- **Types**: `["node"]`