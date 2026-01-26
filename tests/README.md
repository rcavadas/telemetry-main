# 🧪 Diretório de Testes

Este diretório contém todos os arquivos desenvolvidos durante a fase de desenvolvimento, testes e análises do sistema de telemetria OBD.

## 📁 Estrutura Organizada

### 📊 `analysis/`
Scripts de análise e investigação de dados:
- `test-scale-factor.ts` - Teste de fatores de escala para conversão de unidades
- `analyze-structure.ts` - Análise da estrutura de dados do protocolo
- `test-real-structure.ts` - Teste com estrutura de dados reais

### 🐛 `debugging/`
Ferramentas de depuração e correção:
- `debug-coordinates.ts` - Debug de coordenadas GPS
- `test-coordinates.ts` - Teste de correção de coordenadas

### 📋 `data-testing/`
Testes com dados reais e exemplos:
- `final-test.ts` - Teste final de validação
- `extract-real-data.ts` - Extração de dados reais do sistema
- `analyze-real-data.ts` - Análise de dados coletados
- `0x1001Parsing Example.txt` - Exemplo de parsing do protocolo 0x1001
- `1001.txt` - Dados de exemplo do protocolo 1001
- `data_obd.txt` - Dados OBD coletados

### 🔌 `protocol-testing/`
Testes específicos de protocolos:
- `analyze-3400.ts` - Análise do protocolo 0x3400
- `test-decoder.ts` - Teste do decodificador de protocolos

### 🛠️ `tools/`
Ferramentas utilitárias desenvolvidas:
- `reprocess-logs.ts` - Ferramenta de reprocessamento de logs
- `decode-hex.ts` - **🔍 Decodificador interativo de hexadecimal**

## 🎯 Propósito

Estes arquivos foram fundamentais para:

1. **Descoberta do Problema**: Identificação da discrepância no hodômetro (217 km vs 135 km)
2. **Análise de Protocolos**: Compreensão dos protocolos 0x1001 e 0x3400
3. **Correção de GPS**: Implementação da correção para coordenadas brasileiras
4. **Validação de Dados**: Verificação da precisão dos dados decodificados
5. **Desenvolvimento Iterativo**: Testes incrementais até a solução final

## 📈 Resultados Alcançados

- ✅ Correção do hodômetro (fator de conversão: 1609.344)
- ✅ GPS funcionando com precisão para Brasil
- ✅ Sistema completo de telemetria operacional
- ✅ Banco de dados organizado e funcional
- ✅ CLI para consulta e análise de dados

## 🚀 Uso

### **🔍 Decodificador Hexadecimal (MAIS USADO)**

Para decodificar qualquer hexadecimal OBD rapidamente:

```bash
npx ts-node tests/tools/decode-hex.ts "<SEU_HEXADECIMAL>"
```

**Exemplo:**
```bash
npx ts-node tests/tools/decode-hex.ts "40408600043231384C53414232303235303030303034000000100125AB3768FCAC3768065203000000000000000000000000020400003B29441400001D011C05191405250077F00474E45209000000000042342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000073AF0D0A"
```

### Outros Testes

Para executar qualquer teste:

```bash
npx ts-node tests/[categoria]/[arquivo].ts
```

Exemplo:
```bash
npx ts-node tests/analysis/test-scale-factor.ts
npx ts-node tests/debugging/debug-coordinates.ts
```

## 📝 Histórico

Estes arquivos representam a jornada completa de desenvolvimento, desde a identificação de problemas até a implementação das soluções finais. Mantidos para referência, documentação e possíveis melhorias futuras. 