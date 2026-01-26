import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

// Set debug level for analysis
Logger.setLevel(LogLevel.DEBUG);

function analyzeRealData() {
  console.log('🔍 Analisando dados reais do OBD...\n');

  // Dados reais do arquivo data_obd.txt (tentativa de interpretação)
  // '@@' = 0x4040, followed by raw binary data
  
  // Baseando na análise visual, vou tentar reconstruir o hex:
  // 4040 = @@
  // 86 00 = length
  // 04 = version
  // 218LSAB2025000002 (string) = 32 31 38 4c 53 41 42 32 30 32 35 30 30 30 30 30 32
  // padding = 00 00 00
  // 10 01 = protocol_id 0x1001
  
  const reconstructedHex = '404086000432313834c53414232303235303030303030303200000010014567891248154567891266783d000053050000580000000000000002040003629441e00011c00';
  
  console.log('📋 Testando dados reconstruídos baseados em data_obd.txt');
  console.log('Hex reconstruído:', reconstructedHex);
  console.log('');
  
  const buffer = Buffer.from(reconstructedHex, 'hex');
  
  // Analisar estrutura byte a byte
  console.log('📊 Análise estrutural:');
  console.log('Header (0-1):', buffer.slice(0, 2).toString('hex'), '=', buffer.slice(0, 2).toString('ascii'));
  console.log('Length (2-3):', buffer.slice(2, 4).toString('hex'), '=', buffer.readUInt16BE(2));
  console.log('Version (4):', buffer.slice(4, 5).toString('hex'), '=', buffer.readUInt8(4));
  console.log('Device ID (5-20):', buffer.slice(5, 21).toString('hex'), '=', buffer.slice(5, 21).toString('ascii'));
  console.log('Padding (21-23):', buffer.slice(21, 24).toString('hex'));
  console.log('Protocol ID (24-25):', buffer.slice(24, 26).toString('hex'), '=', buffer.readUInt16BE(24).toString(16));
  console.log('');
  
  // Tentar decodificar
  const decoded = ProtocolDecoder.decodeMessage(buffer);
  
  if (decoded) {
    console.log('✅ Decodificação bem-sucedida dos dados reais!');
    console.log(JSON.stringify(decoded, null, 2));
  } else {
    console.log('❌ Falha na decodificação dos dados reais');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Tentar com versão alternativa baseada no padrão do primeiro exemplo
  const alternativeHex = '40408600043231384c534142323032353030303030303200000010015f5f2c68165f2c685f0f0000350500005800000000000000020400036294411e00011c00';
  
  console.log('📋 Testando versão alternativa dos dados');
  console.log('Hex alternativo:', alternativeHex);
  console.log('');
  
  const buffer2 = Buffer.from(alternativeHex, 'hex');
  const decoded2 = ProtocolDecoder.decodeMessage(buffer2);
  
  if (decoded2) {
    console.log('✅ Decodificação alternativa bem-sucedida!');
    console.log(JSON.stringify(decoded2, null, 2));
  } else {
    console.log('❌ Falha na decodificação alternativa');
  }
  
  console.log('\n🏁 Análise concluída!');
}

// Execute analysis if this file is run directly
if (require.main === module) {
  analyzeRealData();
}

export { analyzeRealData }; 