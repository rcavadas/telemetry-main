import fs from 'fs';

function investigate512Issue() {
  console.log('🔍 INVESTIGAÇÃO PROFUNDA: VALOR 512 - REAL OU PADRÃO?');
  console.log('='.repeat(65));
  
  const data = JSON.parse(fs.readFileSync('obd_data/readings.json', 'utf8'));
  
  // Separar por devices
  const device004 = data.filter((r: any) => r.deviceId === '218LSAB2025000004');
  const device002 = data.filter((r: any) => r.deviceId === '218LSAB2025000002');
  
  console.log('\n📊 ESTATÍSTICAS GERAIS:');
  console.log(`├─ Device 004: ${device004.length} registros`);
  console.log(`├─ Device 002: ${device002.length} registros`);
  console.log(`└─ Total: ${data.length} registros`);
  
  console.log('\n🔍 ANÁLISE HEX DOS VALORES 512:');
  
  // Função para extrair currentFuel do HEX
  function extractCurrentFuelFromHex(hexString: string): number | null {
    try {
      const buffer = Buffer.from(hexString, 'hex');
      // Baseado na estrutura: offset 37 + 12 = 49 para currentFuel
      const offset = 37 + 12;
      if (buffer.length >= offset + 2) {
        return buffer.readUInt16LE(offset);
      }
    } catch (e) {
      // Ignorar erros
    }
    return null;
  }
  
  // Analisar alguns registros de cada device
  console.log('\n📋 DEVICE 004 (painel ~5% combustível):');
  device004.slice(0, 5).forEach((record: any, i: number) => {
    const hexFuel = extractCurrentFuelFromHex(record.rawHex);
    console.log(`├─ Registro ${i + 1}:`);
    console.log(`│  ├─ DB currentFuel: ${record.currentFuel}`);
    console.log(`│  ├─ HEX currentFuel: ${hexFuel}`);
    console.log(`│  └─ Match: ${record.currentFuel === hexFuel ? '✅' : '❌'}`);
  });
  
  console.log('\n📋 DEVICE 002 (painel ~50% combustível):');
  device002.slice(0, 5).forEach((record: any, i: number) => {
    const hexFuel = extractCurrentFuelFromHex(record.rawHex);
    console.log(`├─ Registro ${i + 1}:`);
    console.log(`│  ├─ DB currentFuel: ${record.currentFuel}`);
    console.log(`│  ├─ HEX currentFuel: ${hexFuel}`);
    console.log(`│  └─ Match: ${record.currentFuel === hexFuel ? '✅' : '❌'}`);
  });
  
  console.log('\n🧮 ANÁLISE DE PADRÕES HEX:');
  
  // Extrair todos os valores de currentFuel do HEX
  const hexValues004 = device004.map((r: any) => extractCurrentFuelFromHex(r.rawHex)).filter((v: any) => v !== null);
  const hexValues002 = device002.map((r: any) => extractCurrentFuelFromHex(r.rawHex)).filter((v: any) => v !== null);
  
  console.log(`├─ Device 004 valores únicos HEX: ${[...new Set(hexValues004)].join(', ')}`);
  console.log(`├─ Device 002 valores únicos HEX: ${[...new Set(hexValues002)].join(', ')}`);
  
  // Verificar se há outros valores além de 512
  const allHexValues = [...hexValues004, ...hexValues002];
  const uniqueValues = [...new Set(allHexValues)];
  
  console.log(`├─ Valores únicos globais: ${uniqueValues.join(', ')}`);
  console.log(`├─ Apenas 512?: ${uniqueValues.length === 1 && uniqueValues[0] === 512 ? 'SIM' : 'NÃO'}`);
  
  console.log('\n🔍 ANÁLISE DOS BYTES ESPECÍFICOS:');
  
  // Analisar o padrão dos bytes 0x0002 que representam 512
  const sample004 = device004[0];
  const sample002 = device002[0];
  
  if (sample004?.rawHex) {
    const buffer004 = Buffer.from(sample004.rawHex, 'hex');
    const fuelOffset = 37 + 12;
    const fuelBytes004 = buffer004.subarray(fuelOffset, fuelOffset + 2);
    console.log(`├─ Device 004 fuel bytes: ${fuelBytes004.toString('hex').toUpperCase()}`);
    console.log(`├─ Little Endian: ${fuelBytes004.readUInt16LE(0)}`);
    console.log(`├─ Big Endian: ${fuelBytes004.readUInt16BE(0)}`);
  }
  
  if (sample002?.rawHex) {
    const buffer002 = Buffer.from(sample002.rawHex, 'hex');
    const fuelOffset = 37 + 12;
    const fuelBytes002 = buffer002.subarray(fuelOffset, fuelOffset + 2);
    console.log(`├─ Device 002 fuel bytes: ${fuelBytes002.toString('hex').toUpperCase()}`);
    console.log(`├─ Little Endian: ${fuelBytes002.readUInt16LE(0)}`);
    console.log(`├─ Big Endian: ${fuelBytes002.readUInt16BE(0)}`);
  }
  
  console.log('\n🎯 TEORIAS SOBRE O VALOR 512:');
  console.log('');
  console.log('1️⃣ VALOR PADRÃO/FALLBACK:');
  console.log('├─ 512 = 0x0200 em hex');
  console.log('├─ Pode ser valor retornado quando sensor não funciona');
  console.log('├─ Sistema usa 512 como "50%" padrão');
  console.log('└─ Coincidência que device 002 tinha realmente 50%');
  console.log('');
  
  console.log('2️⃣ ERRO DE ESCALA/CALIBRAÇÃO:');
  console.log('├─ Diferentes veículos, mesma leitura "bruta"');
  console.log('├─ Necessário fator de calibração por veículo');
  console.log('├─ 512 pode ser "meio da escala" sem calibração');
  console.log('└─ Interpretação linear pode estar errada');
  console.log('');
  
  console.log('3️⃣ PROBLEMA NO SENSOR/OBD:');
  console.log('├─ Dispositivos podem não ter acesso ao sensor real');
  console.log('├─ OBD pode não suportar leitura de combustível');
  console.log('├─ Retorna valor fixo quando dado não disponível');
  console.log('└─ 512 = "unknown" ou "not supported"');
  console.log('');
  
  console.log('4️⃣ CONFIGURAÇÃO INCORRETA:');
  console.log('├─ Devices precisam configuração específica do veículo');
  console.log('├─ Mapeamento de PID incorreto');
  console.log('├─ Protocolo usando campo errado');
  console.log('└─ Necessário reconfiguração dos devices');
  
  console.log('\n📈 PRÓXIMAS INVESTIGAÇÕES:');
  console.log('├─ 1. Verificar outros dispositivos/dados históricos');
  console.log('├─ 2. Testar diferentes níveis de combustível');
  console.log('├─ 3. Validar configuração dos devices');
  console.log('├─ 4. Revisar mapeamento do protocolo');
  console.log('└─ 5. Consultar fabricante sobre calibração');
  
  console.log('\n⚠️ RECOMENDAÇÃO IMEDIATA:');
  console.log('├─ NÃO confiar em currentFuel = 512 como valor real');
  console.log('├─ Marcar como "dados não confiáveis"');
  console.log('├─ Investigar configuração dos sensores');
  console.log('└─ Implementar validação cruzada com outros dados');
}

investigate512Issue(); 