# Campos Adicionais no Endpoint /api/readings

## Visão Geral

Adicionados 4 novos campos importantes ao endpoint `/api/readings/:deviceId` para fornecer informações mais completas sobre os dados de telemetria.

## 🆕 Campos Implementados

### ✅ Novos Campos Adicionados

#### 1. **softwareVersion**
- **Descrição**: Versão do software do dispositivo OBD
- **Tipo**: String
- **Exemplo**: `"|B4.3.9.2_BRL 2024-01-25 01"`
- **Observação**: Pode estar vazio para alguns registros

#### 2. **hardwareVersion**
- **Descrição**: Versão do hardware do dispositivo
- **Tipo**: String
- **Exemplo**: `"D-218LSA-B  HDC-36V"`
- **Observação**: Geralmente sempre preenchido

#### 3. **rawHex**
- **Descrição**: Dados hexadecimais brutos recebidos do dispositivo
- **Tipo**: String
- **Exemplo**: `"40408600043231384C5341423230..."`
- **Observação**: Dados completos em formato hexadecimal para análise técnica

#### 4. **createdAt**
- **Descrição**: Timestamp de quando o registro foi criado no banco de dados
- **Tipo**: String (ISO 8601)
- **Exemplo**: `"2025-05-29T17:35:54.104Z"`
- **Observação**: Diferente do `timestamp` que vem do dispositivo

## 📊 Estrutura da Resposta Atualizada

### Endpoint: GET /api/readings/:deviceId

```json
{
  "success": true,
  "data": {
    "deviceId": "218LSAB2025000004",
    "totalReadings": 50,
    "readings": [
      {
        "id": 432,
        "deviceId": "218LSAB2025000004",
        "timestamp": "2025-05-29T17:34:53.000Z",
        "latitude": -22.97418,
        "longitude": -43.37152,
        "speedKmH": 0,
        "direction": 0,
        "satellites": 0,
        "gpsFix": "No Fix",
        "totalMileage": 217606,
        "currentMileage": 10233,
        "voltage": 14.2,
        "powerOn": true,
        "accOn": true,
        "ignitionOn": true,
        "softwareVersion": "",
        "hardwareVersion": "B4.3.9.2_BRL 2024-01-25 01",
        "rawHex": "40408600043231384C534142323032353030303030343....",
        "createdAt": "2025-05-29T17:35:54.104Z"
      }
    ]
  },
  "timestamp": "2025-05-29T21:40:12.345Z",
  "processingTime": "15ms"
}
```

## 🔍 Exemplos de Uso

### 1. **Análise Técnica**
```bash
# Obter dados hex brutos para debugging
curl -s http://localhost:3000/api/readings/218LSAB2025000004 | \
  jq '.data.readings[0].rawHex'
```

### 2. **Verificação de Versões**
```bash
# Verificar versões de software/hardware
curl -s http://localhost:3000/api/readings/218LSAB2025000004 | \
  jq '.data.readings[0] | {softwareVersion, hardwareVersion}'
```

### 3. **Auditoria Temporal**
```bash
# Comparar timestamp do dispositivo vs criação no banco
curl -s http://localhost:3000/api/readings/218LSAB2025000004 | \
  jq '.data.readings[0] | {timestamp, createdAt}'
```

## 📋 Comparação Antes/Depois

### ❌ Antes (Campos Ausentes)
```json
{
  "id": 432,
  "deviceId": "218LSAB2025000004",
  "timestamp": "2025-05-29T17:34:53.000Z",
  "latitude": -22.97418,
  "longitude": -43.37152,
  "speedKmH": 0,
  "voltage": 14.2,
  "powerOn": true,
  "accOn": true,
  "ignitionOn": true
}
```

### ✅ Depois (Campos Adicionados)
```json
{
  "id": 432,
  "deviceId": "218LSAB2025000004",
  "timestamp": "2025-05-29T17:34:53.000Z",
  "latitude": -22.97418,
  "longitude": -43.37152,
  "speedKmH": 0,
  "voltage": 14.2,
  "powerOn": true,
  "accOn": true,
  "ignitionOn": true,
  "softwareVersion": "",
  "hardwareVersion": "B4.3.9.2_BRL 2024-01-25 01",
  "rawHex": "40408600043231384C5341423230323530303030303430000001001...",
  "createdAt": "2025-05-29T17:35:54.104Z"
}
```

## 💡 Casos de Uso dos Novos Campos

### 🔧 **softwareVersion**
- **Debugging**: Identificar versão específica em caso de bugs
- **Compatibilidade**: Verificar se protocolo é suportado
- **Atualizações**: Determinar dispositivos que precisam de update

### 🖥️ **hardwareVersion**
- **Suporte**: Identificar modelo exato do dispositivo
- **Limitações**: Conhecer capacidades específicas do hardware
- **Manutenção**: Histórico de versões para reposição

### 🔍 **rawHex**
- **Análise Forense**: Investigação detalhada de problemas
- **Desenvolvimento**: Validação de parsers de protocolo
- **Auditoria**: Verificação de integridade dos dados

### ⏰ **createdAt**
- **Latência**: Diferença entre timestamp do dispositivo e processamento
- **Auditoria**: Histórico cronológico de chegada dos dados
- **Performance**: Identificar atrasos na transmissão

## 🧪 Testes Realizados

### ✅ Device 218LSAB2025000004
```bash
curl -s http://localhost:3000/api/readings/218LSAB2025000004 | \
  jq '.data.readings[0] | {softwareVersion, hardwareVersion, rawHex, createdAt}'

# Resultado:
{
  "softwareVersion": "",
  "hardwareVersion": "B4.3.9.2_BRL 2024-01-25 01",
  "rawHex": "40408600043231384C5341423230323530303030303430000001001...",
  "createdAt": "2025-05-29T17:35:54.104Z"
}
```

### ✅ Device 218LSAB2025000002
```bash
curl -s http://localhost:3000/api/readings/218LSAB2025000002 | \
  jq '.data.readings[0] | {softwareVersion, hardwareVersion, rawHex, createdAt}'

# Resultado:
{
  "softwareVersion": "|B4.3.9.2_BRL 2024-01-25 01",
  "hardwareVersion": "D-218LSA-B  HDC-36V",
  "rawHex": "40408600043231384C534142323032353030303030323...",
  "createdAt": "2025-05-29T18:35:32.168Z"
}
```

## 🔧 Implementação Técnica

### Modificação no Servidor
```typescript
// Em src/server.ts - método loadDeviceReadings
return readings.map((reading: any) => ({
  id: reading.id,
  deviceId: reading.deviceId,
  timestamp: reading.timestamp,
  // ... campos existentes ...
  softwareVersion: reading.softwareVersion,    // ✅ NOVO
  hardwareVersion: reading.hardwareVersion,    // ✅ NOVO
  rawHex: reading.rawHex,                      // ✅ NOVO
  createdAt: reading.createdAt                 // ✅ NOVO
}));
```

### Fonte dos Dados
Os dados vêm diretamente do banco de dados JSON (`obd_data/readings.json`) onde já estavam armazenados, mas não eram expostos via API.

## 📊 Impacto nos Clientes

### ✅ **Compatibilidade Mantida**
- Todos os campos existentes permanecem inalterados
- Adição apenas de novos campos
- Clientes existentes continuam funcionando
- Backward compatibility 100%

### 📈 **Novos Recursos Disponíveis**
- Análise técnica mais detalhada
- Debugging aprimorado
- Auditoria temporal completa
- Forense de dados de telemetria

## 🌐 Endpoint Atualizado

**URL**: `GET http://localhost:3000/api/readings/:deviceId`

**Parâmetros**:
- `deviceId`: ID do dispositivo (ex: 218LSAB2025000004)

**Resposta**: JSON com até 100 leituras mais recentes

**Novos campos incluídos**: ✅ Todos implementados
- `softwareVersion`
- `hardwareVersion` 
- `rawHex`
- `createdAt`

## ✅ Status

### 🎯 **100% Implementado**
- [x] Campos adicionados ao mapeamento
- [x] Servidor atualizado e reiniciado
- [x] Testes realizados com sucesso
- [x] Compatibilidade mantida
- [x] Documentação criada

A funcionalidade está **totalmente operacional** e pronta para uso! 🚀 