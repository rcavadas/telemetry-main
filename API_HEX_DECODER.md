# 🔍 API de Decodificação Hexadecimal OBD

## Visão Geral

Nova API para decodificar dados hexadecimais de dispositivos OBD em tempo real. Baseada no decoder de produção incorporado do sistema de teste.

## 📡 Endpoint

```
POST /api/decode-hex
```

## 📋 Requisição

### Headers
```
Content-Type: application/json
```

### Body (JSON)
```json
{
  "hex": "40408600043231384C53414232303235303030303034...",
  // OU
  "hexData": "40408600043231384C53414232303235303030303034...",
  // OU  
  "rawHex": "40408600043231384C53414232303235303030303034..."
}
```

**Campos aceitos:**
- `hex` - String hexadecimal para decodificar
- `hexData` - Alias para hex
- `rawHex` - Alias para hex (compatibilidade com dados existentes)

## 📤 Resposta

### Sucesso (200)
```json
{
  "success": true,
  "data": {
    "decoded": {
      "deviceId": "218LSAB2025000004",
      "protocolId": "0x1001",
      "timestamp": "2025-05-30T00:09:25.000Z",
      "gps": {
        "latitude": -22.87043,
        "longitude": -43.5487,
        "speedKmH": 0,
        "direction": 2640,
        "gpsFix": "3D Fix",
        "satellites": 15,
        "date": "2025-05-30",
        "time": "00:09:26"
      },
      "tripData": {
        "totalMileage": 266801,
        "totalOdometer": 165782.87,
        "currentMileage": 12717,
        "totalFuel": 0,
        "currentFuel": 512
      },
      "vehicleState": {
        "powerOn": true,
        "accOn": true,
        "ignitionOn": true,
        "rawState": "00020400"
      },
      "voltage": 13.8,
      "versions": {
        "software": "|B4.3.9.2_BRL 2024-01-25 01",
        "hardware": "D-218LSA-B  HDC-36V"
      }
    },
    "analysis": {
      "header": "4040",
      "length": 134,
      "deviceId": "218LSAB2025000004",
      "protocol": "0x1001"
    },
    "input": {
      "hex": "40408600043231384C534142323032353...",
      "length": 134
    }
  },
  "timestamp": "2025-05-30T17:50:48.552Z",
  "processingTime": "1ms"
}
```

### Erro (400/500)
```json
{
  "success": false,
  "error": "Descrição do erro",
  "timestamp": "2025-05-30T17:50:35.970Z",
  "processingTime": "1ms"
}
```

## 🔧 Funcionalidades

### ✅ Validações Automáticas
- ✅ **Hex válido**: Verifica caracteres hexadecimais (0-9, A-F)
- ✅ **Comprimento par**: Garante bytes completos
- ✅ **Tamanho mínimo**: Mínimo 4 bytes para análise
- ✅ **Limpeza automática**: Remove espaços e quebras de linha

### 📊 Análise Estrutural
- **Header**: Identifica protocolo por header (0x4040)
- **Device ID**: Extrai automaticamente do pacote
- **Protocol ID**: Detecta protocolo (0x1001, 0x3400, etc.)
- **Comprimento**: Valida tamanho do pacote

### 🚗 Dados Decodificados
- **GPS**: Coordenadas, velocidade, direção, satélites
- **Viagem**: Hodômetro, quilometragem, combustível
- **Veículo**: Power, ACC, ignição, voltagem
- **Versões**: Software e hardware do dispositivo

## 🛠️ Exemplos de Uso

### 1. Decodificação Simples
```bash
curl -X POST "http://localhost:3000/api/decode-hex" \
  -H "Content-Type: application/json" \
  -d '{"hex": "40408600043231384C53414232..."}'
```

### 2. Com dados reais do readings.json
```bash
curl -X POST "http://localhost:3000/api/decode-hex" \
  -H "Content-Type: application/json" \
  -d '{"rawHex": "40408600043231384C53414232303235303030303034000000100192F3386835F7386831120400AD31000000000000000000020400003A42441000001C011E051900091A6C4FE804983358090000500AFC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D333656000000BCFC0D0A"}'
```

### 3. Extrair campos específicos
```bash
curl -X POST "http://localhost:3000/api/decode-hex" \
  -H "Content-Type: application/json" \
  -d '{"hex": "..."}' | jq '.data.decoded | {deviceId, gps, tripData}'
```

## ⚠️ Possíveis Erros

| Erro | Causa | Solução |
|------|-------|---------|
| `Campo "hex" é obrigatório` | Body sem campo hex | Adicionar campo hex/hexData/rawHex |
| `Hex string vazia ou inválida` | String vazia | Fornecer dados hex válidos |
| `Número par de caracteres` | Hex incompleto | Verificar se hex está completo |
| `Caracteres não-hexadecimais` | Caracteres inválidos | Usar apenas 0-9, A-F |
| `Dados muito curtos` | Menos de 4 bytes | Fornecer pacote completo |
| `Não foi possível decodificar` | Protocolo não suportado | Verificar se é protocolo 0x1001/0x3400 |
| `JSON inválido` | Body malformado | Verificar sintaxe JSON |

## 🚀 Protocolos Suportados

- ✅ **0x1001**: Protocolo principal OBD
- ✅ **0x3400**: Protocolo secundário (experimental)
- 🔄 **Extensível**: Fácil adição de novos protocolos

## 🔒 Segurança

- ✅ **CORS habilitado**: Permite requisições cross-origin
- ✅ **Validação de entrada**: Sanitização automática
- ✅ **Logs de auditoria**: Registro de todas as operações
- ✅ **Tratamento de erros**: Respostas consistentes

## 📈 Performance

- ⚡ **Tempo de resposta**: ~1ms típico
- 🔄 **Processamento síncrono**: Resposta imediata
- 📊 **Monitoramento**: Logs detalhados de performance
- 🛡️ **Estabilidade**: Tratamento robusto de erros

## 🔗 Integração com Sistema Existente

### Compatibilidade
- ✅ **readings.json**: Processa dados do banco existente
- ✅ **API unificada**: Mesmo servidor (porta 3000)
- ✅ **Logs integrados**: Sistema de logging unificado
- ✅ **Banco de dados**: Pode salvar resultados automaticamente

### Próximos Passos
- [ ] Endpoint batch para múltiplos hex
- [ ] Cache de resultados
- [ ] Webhook para notificações
- [ ] Interface web para teste 