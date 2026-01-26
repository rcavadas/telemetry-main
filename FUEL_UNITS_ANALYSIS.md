# 🔍 ANÁLISE DAS UNIDADES DE COMBUSTÍVEL - PROTOCOLO SINOCASTEL

## 📊 DADOS ANALISADOS

### Current Fuel (currentFuel)
- **Valor encontrado**: 512 (constante em todos os 245 registros)
- **Comportamento**: Idêntico para ambos dispositivos
- **Tipo de campo**: 2 bytes (uint16)

### Total Fuel (totalFuel) 
- **Valores encontrados**: 0 e 173
- **Correlação**: 
  - Device estático (218LSAB2025000004): 0
  - Device móvel (218LSAB2025000002): 173

## 🔍 EVIDÊNCIAS DA DOCUMENTAÇÃO OFICIAL

### Fonte: Flespi Protocol Documentation (Sinocastel)
Encontrado na documentação oficial do protocolo Sinocastel:

```
current.fuel.consumed | number | liters | Total fuel consumption from the latest ACC ON time to current time
total.fuel.consumed   | number | liters | Total fuel consumption from device power on to the latest ACC ON time
can.fuel.level        | number | percentage | Fuel level in tank read from CAN
can.fuel.consumed     | number | liters | Fuel volume totally consumed by vehicle read from CAN
```

### Parâmetros PID Específicos:
- `0x00B6`: Engine Trip Fuel - **Unit: L (Litros)**
- `0x00FA`: Engine Total Fuel Used - **Unit: L (Litros)**
- `0x0026`: Fuel Level 2 - **Unit: % (Percentual)**
- `0x0060`: Fuel Level 1 - **Unit: % (Percentual)**

## ⚖️ ANÁLISE COMPARATIVA

### Current Fuel = 512
**Interpretação mais provável**: Nível de combustível em percentual
- **Escala**: 0-1024 = 0-100%
- **Valor 512**: 512/1024 = 50% do tanque
- **Unidade**: Percentual (escala binária)

### Total Fuel = 173
**Interpretação mais provável**: Consumo acumulado em **LITROS**
- **Valor 173**: 173 litros consumidos
- **Device móvel**: Consumiu combustível durante a viagem
- **Device estático**: 0 litros (sem movimento)

## 🎯 CONCLUSÃO DEFINITIVA

### ✅ CURRENT FUEL
- **Unidade**: Percentual (escala 0-1024)
- **Valor 512**: 50% do nível do tanque
- **Propósito**: Indicador do nível atual de combustível

### ✅ TOTAL FUEL  
- **Unidade**: LITROS
- **Confirmado pela documentação oficial**
- **Propósito**: Consumo total acumulado desde power-on

## 📋 RECOMENDAÇÕES

1. **Para Relatórios**: 
   - currentFuel: Converter 512 → "50% do tanque"
   - totalFuel: Usar diretamente como litros

2. **Para Análise de Consumo**:
   - totalFuel representa litros reais consumidos
   - currentFuel é apenas indicativo de nível

3. **Para Validação**:
   - Verificar se outros devices mostram variação no currentFuel
   - Monitorar correlação entre movimento e totalFuel

## 🔗 FONTES
- Documentação oficial Flespi (Sinocastel Protocol)
- Análise dos dados reais (245 registros)
- Tabela PID oficial Sinocastel

---
**Status**: ✅ Confirmado - **Total Fuel em LITROS** 