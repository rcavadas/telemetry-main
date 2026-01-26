import { HexDecoderService } from '../../src/services/hex-decoder-service';
import { Logger } from '../../src/utils/logger';

function decodeHex(hexString: string) {
  console.log('🔍 DECODIFICADOR HEXADECIMAL OBD');
  console.log('='.repeat(50));
  
  // Limpar o hex (remover espaços, quebras de linha, etc.)
  const cleanHex = hexString.replace(/[\s\n\r]/g, '');
  
  console.log(`📋 Hex de entrada: ${cleanHex}`);
  console.log(`📏 Tamanho: ${cleanHex.length} caracteres (${cleanHex.length / 2} bytes)`);
  console.log('');

  try {
    // Tentar decodificar usando o serviço
    console.log('⚙️  DECODIFICANDO...');
    const result = HexDecoderService.decodeHex(cleanHex);
    
    if (result.success && result.decoded) {
      const decoded = result.decoded;
      
      console.log('✅ DECODIFICAÇÃO BEM-SUCEDIDA!');
      console.log('='.repeat(50));
      
      // Mostrar resultado formatado
      console.log(`🆔 Device ID: ${decoded.deviceId}`);
      console.log(`📡 Protocolo: ${decoded.protocolId}`);
      console.log(`⏰ Timestamp: ${decoded.timestamp}`);
      
      if (decoded.gps) {
        console.log('');
        console.log('🗺️  DADOS GPS:');
        console.log(`├─ Latitude: ${decoded.gps.latitude}°`);
        console.log(`├─ Longitude: ${decoded.gps.longitude}°`);
        console.log(`├─ Velocidade: ${decoded.gps.speedKmH} km/h`);
        console.log(`├─ Direção: ${decoded.gps.direction}°`);
        console.log(`├─ Satélites: ${decoded.gps.satellites}`);
        console.log(`└─ Fix GPS: ${decoded.gps.gpsFix}`);
      }
      
      if (decoded.tripData) {
        console.log('');
        console.log('🛣️  DADOS DE VIAGEM:');
        console.log(`├─ Total (milhas): ${decoded.tripData?.totalMileage || 0} mi`);
        console.log(`├─ Hodômetro (km): ${decoded.tripData?.totalOdometer || 0} km`);
        console.log(`├─ Km viagem: ${decoded.tripData?.currentMileage || 0} km`);
        console.log(`├─ Combustível total: ${decoded.tripData?.totalFuel || 0}`);
        console.log(`└─ Combustível viagem: ${decoded.tripData?.currentFuel || 0}`);
      }
      
      if (decoded.vehicleState) {
        console.log('');
        console.log('🚗 ESTADO DO VEÍCULO:');
        console.log(`├─ Power: ${decoded.vehicleState.powerOn ? 'ON' : 'OFF'}`);
        console.log(`├─ ACC: ${decoded.vehicleState.accOn ? 'ON' : 'OFF'}`);
        console.log(`└─ Ignição: ${decoded.vehicleState.ignitionOn ? 'ON' : 'OFF'}`);
      }
      
      if (decoded.voltage) {
        console.log('');
        console.log(`🔋 Tensão: ${decoded.voltage}V`);
      }
      
      if (decoded.versions) {
        console.log('');
        console.log('💻 VERSÕES:');
        console.log(`├─ Software: ${decoded.versions.software}`);
        console.log(`└─ Hardware: ${decoded.versions.hardware}`);
      }
      
      console.log('');
      console.log('📄 JSON COMPLETO:');
      console.log(JSON.stringify(decoded, null, 2));
      
    } else {
      console.log('❌ FALHA NA DECODIFICAÇÃO');
      console.log(`└─ ${result.error}`);
      
      if (result.analysis) {
        console.log('');
        console.log('🔍 ANÁLISE DOS DADOS:');
        console.log(`├─ Header: ${result.analysis.header}`);
        console.log(`├─ Tamanho: ${result.analysis.length} bytes`);
        console.log(`├─ Device ID detectado: ${result.analysis.deviceId || 'N/A'}`);
        console.log(`└─ Protocolo detectado: ${result.analysis.protocol || 'N/A'}`);
      }
    }
    
  } catch (error) {
    console.log('❌ ERRO AO PROCESSAR HEX:');
    console.log(`└─ ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log('');
  console.log('='.repeat(50));
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔍 DECODIFICADOR HEXADECIMAL OBD');
  console.log('='.repeat(50));
  console.log('');
  console.log('📋 USO:');
  console.log('npx ts-node tests/utilities/decode-hex.ts <HEXADECIMAL>');
  console.log('');
  console.log('📝 EXEMPLO:');
  console.log('npx ts-node tests/utilities/decode-hex.ts "40408600043231384C53414232303235303030303034000000100125AB3768FCAC3768065203000000000000000000000000020400003B29441400001D011C05191405250077F00474E45209000000000042342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000073AF0D0A"');
  console.log('');
  process.exit(1);
}

// Juntar todos os argumentos (caso o hex seja passado com espaços)
const hexInput = args.join('');
decodeHex(hexInput); 