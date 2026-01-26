import { Logger, LogLevel } from './logger';

Logger.setLevel(LogLevel.DEBUG);

class StructureAnalyzer {
  static analyzeHexStructure(hexData: string): void {
    console.log('🔍 ANÁLISE DETALHADA DA ESTRUTURA\n');
    
    const buffer = Buffer.from(hexData, 'hex');
    
    console.log(`📊 Dados hex: ${hexData}`);
    console.log(`📏 Tamanho: ${buffer.length} bytes\n`);
    
    // Análise byte por byte
    console.log('📋 ESTRUTURA BYTE-POR-BYTE:');
    console.log('Offset | Hex  | Dec | ASCII | Campo');
    console.log('-------|------|-----|-------|------------------');
    
    for (let i = 0; i < Math.min(50, buffer.length); i++) {
      const byte = buffer[i];
      const hex = byte.toString(16).padStart(2, '0').toUpperCase();
      const dec = byte.toString().padStart(3);
      const ascii = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      
      let field = '';
      if (i === 0) field = 'Header (0x40)';
      else if (i === 1) field = 'Header (0x40)';
      else if (i === 2) field = 'Length Low';
      else if (i === 3) field = 'Length High';
      else if (i === 4) field = 'Version';
      else if (i >= 5 && i <= 21) field = `Device ID [${i-5}]`;
      else if (i >= 22 && i <= 24) field = 'Padding';
      else if (i === 25) field = 'Protocol ID Low';
      else if (i === 26) field = 'Protocol ID High';
      else if (i >= 27 && i <= 30) field = 'LastAccon Time';
      else if (i >= 31 && i <= 34) field = 'UTC Time';
      else if (i >= 35 && i <= 38) field = 'Total Mileage';
      else if (i >= 39 && i <= 42) field = 'Current Mileage';
      else if (i >= 43 && i <= 46) field = 'Total Fuel';
      else if (i >= 47 && i <= 48) field = 'Current Fuel';
      else if (i >= 49 && i <= 52) field = 'Vehicle State';
      
      console.log(`  ${i.toString().padStart(2)}   | ${hex}   | ${dec} |   ${ascii}   | ${field}`);
    }
    
    // Extrair campos específicos
    console.log('\n🔧 CAMPOS EXTRAÍDOS:');
    
    // Header
    const header = buffer.readUInt16BE(0);
    console.log(`📡 Header: 0x${header.toString(16)} (${header})`);
    
    // Length  
    const length = buffer.readUInt16LE(2);
    console.log(`📏 Length: ${length} bytes`);
    
    // Version
    const version = buffer.readUInt8(4);
    console.log(`🔢 Version: ${version}`);
    
    // Device ID COMPLETO (17 bytes - posições 5-21)
    const deviceIdBytes = buffer.slice(5, 22);
    let deviceIdEnd = deviceIdBytes.indexOf(0);
    if (deviceIdEnd === -1) deviceIdEnd = deviceIdBytes.length;
    const deviceId = deviceIdBytes.slice(0, deviceIdEnd).toString('ascii');
    console.log(`🆔 Device ID: "${deviceId}" (${deviceIdEnd} bytes úteis)`);
    
    // Protocol ID
    const protocolId = buffer.readUInt16BE(25);
    console.log(`🔧 Protocol ID: 0x${protocolId.toString(16)}`);
    
    // Timestamps (com offset corrigido)
    const lastAcconTime = buffer.readUInt32LE(27);
    const utcTime = buffer.readUInt32LE(31);
    console.log(`⏰ Last AccOn: ${lastAcconTime} (${new Date(lastAcconTime * 1000).toISOString()})`);
    console.log(`⏰ UTC Time: ${utcTime} (${new Date(utcTime * 1000).toISOString()})`);
    
    // Trip data (com offset corrigido)
    const totalMileage = buffer.readUInt32LE(35);
    const currentMileage = buffer.readUInt32LE(39);
    console.log(`🛣️  Total Mileage: ${totalMileage} km`);
    console.log(`🛣️  Current Mileage: ${currentMileage} km`);
    
    // Vehicle State (com offset corrigido)
    const vstate = buffer.readUInt32LE(49);
    console.log(`🚗 Vehicle State: 0x${vstate.toString(16).padStart(8, '0')}`);
    
    // GPS data location (testar diferentes offsets)
    console.log(`\n📍 TESTANDO DIFERENTES OFFSETS PARA GPS:`);
    
    // Baseado na estrutura corrigida:
    // Device ID (17) + Padding (3) + Protocol ID (2) + Timestamps (8) + Trip Data (14) + Vehicle State (4) + Reserved (8) = 56 bytes após versão
    const possibleGpsOffsets = [60, 61, 62, 63, 64, 65];
    
    for (const testOffset of possibleGpsOffsets) {
      if (buffer.length > testOffset + 18) {
        console.log(`\n🔍 Testando offset ${testOffset}:`);
        
        const gpsCount = buffer.readUInt8(testOffset);
        console.log(`   GPS Count: ${gpsCount}`);
        
        if (gpsCount === 1) { // GPS count deve ser 1
          // Date
          const day = buffer.readUInt8(testOffset + 1);
          const month = buffer.readUInt8(testOffset + 2);
          const year = 2000 + buffer.readUInt8(testOffset + 3);
          
          // Time
          const hour = buffer.readUInt8(testOffset + 4);
          const minute = buffer.readUInt8(testOffset + 5);
          const second = buffer.readUInt8(testOffset + 6);
          
          console.log(`   📅 GPS Date: ${day}/${month}/${year}`);
          console.log(`   🕐 GPS Time: ${hour}:${minute}:${second}`);
          
          // Coordinates - Testar Little Endian como no exemplo
          const latRaw = buffer.readInt32LE(testOffset + 7);
          const lonRaw = buffer.readInt32LE(testOffset + 11);
          
          const latitude = latRaw / 1000000;
          const longitude = lonRaw / 1000000;
          
          console.log(`   🌍 Hex: ${buffer.slice(testOffset + 7, testOffset + 15).toString('hex')}`);
          console.log(`   🌍 Latitude: ${latRaw} -> ${latitude.toFixed(6)}°`);
          console.log(`   🌍 Longitude: ${lonRaw} -> ${longitude.toFixed(6)}°`);
          
          // Check if coordinates are reasonable for Rio de Janeiro
          if (latitude >= -25 && latitude <= -20 && longitude >= -45 && longitude <= -40) {
            console.log(`   ✅ COORDENADAS VÁLIDAS PARA RIO DE JANEIRO!`);
          } else {
            console.log(`   ❌ Coordenadas fora do Rio de Janeiro`);
          }
        } else if (gpsCount < 20) {
          console.log(`   ⚠️  GPS Count suspeito: ${gpsCount}`);
        }
      }
    }
    
    // Comparar com exemplo original
    console.log(`\n📋 EXEMPLO ORIGINAL (para comparação):`);
    const exampleHex = "40408600043231384C534142323032353030303030340000001001366C3468676D3468FDBB01008904000000000000000000020400003E29441F00001D011A05190D20176C0AEE0410864E09B9010000CC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A";
    const exampleBuffer = Buffer.from(exampleHex, 'hex');
    
    // No exemplo, GPS está no offset 61
    if (exampleBuffer.length > 61 + 18) {
      const exampleGpsOffset = 61;
      console.log(`📍 GPS no exemplo (offset ${exampleGpsOffset}):`);
      
      const exampleGpsCount = exampleBuffer.readUInt8(exampleGpsOffset);
      console.log(`   GPS Count: ${exampleGpsCount}`);
      
      const exampleDay = exampleBuffer.readUInt8(exampleGpsOffset + 1);
      const exampleMonth = exampleBuffer.readUInt8(exampleGpsOffset + 2);
      const exampleYear = 2000 + exampleBuffer.readUInt8(exampleGpsOffset + 3);
      
      console.log(`   📅 GPS Date: ${exampleDay}/${exampleMonth}/${exampleYear}`);
      
      const exampleLatRaw = exampleBuffer.readInt32LE(exampleGpsOffset + 7);
      const exampleLonRaw = exampleBuffer.readInt32LE(exampleGpsOffset + 11);
      
      console.log(`   🌍 Hex: ${exampleBuffer.slice(exampleGpsOffset + 7, exampleGpsOffset + 15).toString('hex')}`);
      console.log(`   🌍 Latitude: ${exampleLatRaw} -> ${(exampleLatRaw / 1000000).toFixed(6)}° (doc: -22.974750)`);
      console.log(`   🌍 Longitude: ${exampleLonRaw} -> ${(exampleLonRaw / 1000000).toFixed(6)}° (doc: -43.372520)`);
    }
  }
}

// Hex do primeiro pacote dos logs
const hexData = "40408600043231384c534142323032353030303030340000001001ae113768b4113768e84502000000000000000000000000020400003542440b00001d011c05190c0d0ae02df004805f5309000000000042342e332e392e325f42524c20323032342d30312d323520303100442d3231384c53412d4220204844432d333656000000e9820d0a";

StructureAnalyzer.analyzeHexStructure(hexData); 