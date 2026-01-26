import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

// Set debug level for testing
Logger.setLevel(LogLevel.DEBUG);

function testRealStructure() {
  console.log('🧪 Testando estrutura real baseada em data_obd.txt...\n');

  // Baseado no header observado: '@�\x00\x04218LSAB2025000002\x00\x00\x00\x10\x01��'
  // '@@' = 4040 (header)
  // '\x86' = 86 (length baixo)
  // '\x00' = 00 (length alto) -> length = 0x0086 = 134
  // '\x04' = 04 (version)
  // '218LSAB2025000002' = device ID
  // '\x00\x00\x00' = padding
  // '\x10\x01' = 1001 (protocol ID em little endian)

  // Construindo hex manual baseado na estrutura real
  const header = '4040';           // @@
  const length = '8600';           // 134 bytes (little endian)
  const version = '04';            // version 4
  const deviceId = '3231384c5341423230323530303030303032000000'; // "218LSAB2025000002" + padding
  const protocolId = '1001';       // 0x1001 

  // Dados adicionais sintéticos para completar o pacote
  const timestampData = '12345678';    // last_accon_time
  const utcTimeData = '87654321';      // utc_time  
  const tripData = '10270000' +        // total_mileage
                   '05340000' +        // current_mileage  
                   '58000000' +        // total_fuel
                   '0000';             // current_fuel
  const vehicleState = '00020400';     // vstate
  const reserved = '036294411e00001c'; // reserved data
  const gpsCount = '01';               // gps_count = 1
  const gpsData = '1c051d' +           // date (28/05/29)
                  '0d3a17' +           // time (13:58:23)
                  '004aeedb' +         // latitude
                  '0020640a' +         // longitude  
                  '1900' +             // speed
                  '5a00' +             // direction
                  'cc';                // flag
  const swVersion = '534f465457415245000000000000000000000000000000000000000000000000'; // "SOFTWARE" + padding
  const hwVersion = '484152445741524500000000000000000000000000000000000000000000000000'; // "HARDWARE" + padding
  const crc = '1234';                  // CRC placeholder
  const tail = '0d0a';                 // tail

  const fullHex = header + length + version + deviceId + protocolId + 
                  timestampData + utcTimeData + tripData + vehicleState + 
                  reserved + gpsCount + gpsData + swVersion + hwVersion + 
                  crc + tail;

  console.log('📋 Teste baseado na estrutura real observada');
  console.log('Device ID esperado: 218LSAB2025000002');
  console.log('Hex construído:', fullHex);
  console.log('Tamanho:', fullHex.length / 2, 'bytes');
  console.log('');

  const buffer = Buffer.from(fullHex, 'hex');

  // Análise estrutural
  console.log('📊 Análise estrutural:');
  console.log('Header (0-1):', buffer.slice(0, 2).toString('hex'));
  console.log('Length (2-3):', buffer.slice(2, 4).toString('hex'), '=', buffer.readUInt16LE(2)); // Little endian
  console.log('Version (4):', buffer.slice(4, 5).toString('hex'));
  console.log('Device ID (5-20):', buffer.slice(5, 21).toString('hex'));
  console.log('Device ID ASCII:', buffer.slice(5, 21).toString('ascii').replace(/\0/g, ''));
  console.log('Protocol ID (25-26):', buffer.slice(25, 27).toString('hex'), '=', buffer.readUInt16BE(25).toString(16));
  console.log('');

  // Tentativa de decodificação real
  const decoded = ProtocolDecoder.decodeMessage(buffer);
  
  if (decoded) {
    console.log('✅ Decodificação bem-sucedida!');
    console.log(JSON.stringify(decoded, null, 2));
  } else {
    console.log('❌ Falha na decodificação');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Teste com estrutura mais simples para depuração
  const simpleHex = '40408600043231384c534142323032353030303030303032000000001001' +
                    '12345678876543211027000005340000580000000000' +
                    '0002040003629441e00001c01' +
                    '1c051d0d3a17004aeedb0020640a19005a00cc';
  
  console.log('📋 Teste com estrutura simplificada');
  console.log('Hex simplificado:', simpleHex);
  console.log('');

  const buffer2 = Buffer.from(simpleHex, 'hex');
  const decoded2 = ProtocolDecoder.decodeMessage(buffer2);

  if (decoded2) {
    console.log('✅ Decodificação simplificada bem-sucedida!');
    console.log(JSON.stringify(decoded2, null, 2));
  } else {
    console.log('❌ Falha na decodificação simplificada');
  }

  console.log('\n🏁 Testes concluídos!');
}

// Execute tests if this file is run directly
if (require.main === module) {
  testRealStructure();
}

export { testRealStructure }; 