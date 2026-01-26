# 🗄️ Sistema de Banco de Dados OBD

Sistema completo para armazenamento e análise de dados de telemetria OBD, incluindo GPS, combustível e informações do veículo.

## 📋 Características

- **Armazenamento JSON**: Sistema baseado em arquivos para facilidade de uso
- **Campos de Combustível**: `totalFuel` e `currentFuel` incluídos conforme solicitado
- **Device ID Completo**: Armazena os 17 bytes completos do Device ID
- **GPS Tracking**: Coordenadas corrigidas para Rio de Janeiro
- **Backup Automático**: Sistema de backup integrado
- **CLI Management**: Interface de linha de comando para gerenciar dados

## 🗃️ Estrutura de Dados

### Tabela: `obd_readings`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | ID único da leitura |
| `deviceId` | string | ID do dispositivo (17 bytes) |
| `timestamp` | string | Timestamp do GPS/veículo |
| `protocolId` | string | ID do protocolo (ex: 0x1001) |
| `latitude` | number | Latitude GPS (corrigida) |
| `longitude` | number | Longitude GPS (corrigida) |
| `speedKmH` | number | Velocidade em km/h |
| `direction` | number | Direção/heading em graus |
| `satellites` | number | Número de satélites |
| `gpsFix` | string | Status do GPS fix |
| `totalMileage` | number | **Quilometragem total** |
| `currentMileage` | number | **Quilometragem da viagem** |
| `totalFuel` | number | **🔥 Combustível total** |
| `currentFuel` | number | **🔥 Combustível da viagem** |
| `powerOn` | boolean | Estado Power On |
| `accOn` | boolean | Estado ACC On |
| `ignitionOn` | boolean | Estado Ignição |
| `voltage` | number | Tensão da bateria |
| `softwareVersion` | string | Versão do software |
| `hardwareVersion` | string | Versão do hardware |
| `rawHex` | string | Dados hex originais |
| `createdAt` | string | Timestamp de criação do registro |

## 🚀 Comandos Disponíveis

### Inicialização

```bash
# Popular banco com dados dos logs existentes
npm run populate

# Ver estatísticas gerais
npm run db stats

# Ver estatísticas de um dispositivo específico
npm run db stats 218LSAB2025000004
```

### Consultas

```bash
# Ver leituras recentes (10 últimas)
npm run db recent

# Ver 20 leituras recentes de um dispositivo
npm run db recent 218LSAB2025000004 20

# Ver trilha GPS de um dispositivo
npm run db gps 218LSAB2025000004
```

### Exportação e Backup

```bash
# Exportar todos os dados para CSV
npm run db export

# Exportar dados de um dispositivo específico
npm run db export 218LSAB2025000004

# Criar backup dos dados
npm run db backup
```

## 📊 Exemplo de Saída - Estatísticas

```
📊 ESTATÍSTICAS DO BANCO DE DADOS
==========================================
📦 Total de leituras: 50
🏷️  Dispositivos únicos: 1
📅 Primeira leitura: 26/05/2025 21:27:18
📅 Última leitura: 26/05/2025 22:10:43
🏃 Velocidade média: 25.34 km/h
🏃 Velocidade máxima: 62.15 km/h
🔋 Tensão média: 13.75V
🔋 Tensão mín/máx: 13.3V / 14.2V
🗺️  Leituras com GPS: 50
🛣️  Quilometragem máxima: 148.968 km
⛽ Combustível médio: 0
==========================================
```

## 📍 Exemplo de Saída - Leituras Recentes

```
📋 LEITURAS RECENTES
==========================================

🆔 ID: 1
📱 Device: 218LSAB2025000004
⏰ Timestamp: 2025-05-26 21:27:18
📡 Protocolo: 0x1001
📍 GPS: -22.974750, -43.372520
🏃 Velocidade: 15.88km/h | 🧭 Direção: 0°
🛰️  Satélites: 12 | 📶 Fix: 3D Located
🛣️  Km total: 148968 | Km viagem: 1161
⛽ Combustível total: 0 | Combustível viagem: 0
🔋 Estado: Power:ON | ACC:ON | Tensão:13.6V
📅 Registrado: 28/05/2025 20:45:23
------------------------------------------
```

## 🗺️ Funcionalidades de GPS

- **Coordenadas Corrigidas**: Sistema corrige automaticamente as coordenadas para Rio de Janeiro
- **Trilha Completa**: Rastreamento de toda a rota percorrida
- **Exportação Google Maps**: Links diretos para visualização no Google Maps
- **Análise de Trajeto**: Distância, duração e velocidade média

## ⛽ Dados de Combustível

O sistema inclui campos específicos para combustível conforme solicitado:

- **`totalFuel`**: Combustível total consumido
- **`currentFuel`**: Combustível da viagem atual
- **Análises**: Consumo médio, eficiência por km
- **Relatórios**: Exportação de dados de combustível

## 🔧 Arquivos Criados

```
obd_data/
├── readings.json           # Dados principais
├── backup_YYYY-MM-DD.json # Backups automáticos
└── export_*.csv           # Exportações CSV
```

## 📈 Integração com Servidor

O sistema de banco de dados está integrado ao servidor TCP principal:

- **Salvamento Automático**: Todas as leituras são salvas automaticamente
- **Performance**: Sistema otimizado para escritas rápidas
- **Reliability**: Backup automático após cada sessão

## 🎯 Uso Recomendado

1. **Inicialização**: `npm run populate` (uma vez)
2. **Monitoramento**: `npm run db stats` (diário)
3. **Análise GPS**: `npm run db gps <deviceId>` (conforme necessário)
4. **Backup**: `npm run db backup` (semanal)
5. **Exportação**: `npm run db export` (para análises externas)

## 🔍 Troubleshooting

- **Banco não inicializa**: Verifique permissões de escrita no diretório
- **Dados não aparecem**: Confirme que o servidor está salvando (`npm run dev`)
- **GPS incorreto**: O sistema corrige automaticamente as coordenadas
- **Performance lenta**: Execute `npm run db backup` para limpeza

---

🎉 **Sistema pronto para uso!** O banco de dados inclui todos os campos solicitados (fuel, deviceId) e está totalmente integrado ao sistema de telemetria OBD. 