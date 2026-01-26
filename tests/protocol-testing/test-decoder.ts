import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

// Set debug level for testing
Logger.setLevel(LogLevel.DEBUG);

function testDecoder() {
  console.log('🧪 Iniciando testes do decodificador de protocolo...\n');

  // Exemplo 1: Do arquivo "0x1001Parsing Example.txt"
  const example1Hex = '40408600043231384C534142323032353030303030340000001001366C3468676D3468FDBB01008904000000000000000000020400003E29441F00001D011A05190D20176C0AEE0410864E09B9010000CC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A';
  
  // Exemplo 2: Do arquivo "1001.txt"
  const example2Hex = '40409B00043231334744503230313830323133343300000000100A3311B5DAD321B5D6F3D000010020000C2010000A0000000400073B015700000000010270130A200A3283C3023007A9103D025C06AF4944445F3231335730315F532056322E312E3700494444F3231335730315F482056322E312E370E00011802181A011B011E011F021F031F041F051F061F071F01210221729BA0D0A';

  console.log('📋 Teste 1: Exemplo do arquivo "0x1001Parsing Example.txt"');
  console.log('Raw data:', example1Hex);
  console.log('');
  
  const buffer1 = Buffer.from(example1Hex, 'hex');
  const decoded1 = ProtocolDecoder.decodeMessage(buffer1);
  
  if (decoded1) {
    console.log('✅ Decodificação bem-sucedida!');
    console.log(JSON.stringify(decoded1, null, 2));
  } else {
    console.log('❌ Falha na decodificação');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  console.log('📋 Teste 2: Exemplo do arquivo "1001.txt"');
  console.log('Raw data:', example2Hex);
  console.log('');
  
  const buffer2 = Buffer.from(example2Hex, 'hex');
  const decoded2 = ProtocolDecoder.decodeMessage(buffer2);
  
  if (decoded2) {
    console.log('✅ Decodificação bem-sucedida!');
    console.log(JSON.stringify(decoded2, null, 2));
  } else {
    console.log('❌ Falha na decodificação');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Teste com dados inválidos
  console.log('📋 Teste 3: Dados inválidos');
  const invalidBuffer = Buffer.from('1234567890abcdef', 'hex');
  const decoded3 = ProtocolDecoder.decodeMessage(invalidBuffer);
  
  if (decoded3) {
    console.log('⚠️  Decodificação inesperada de dados inválidos');
    console.log(JSON.stringify(decoded3, null, 2));
  } else {
    console.log('✅ Dados inválidos rejeitados corretamente');
  }

  console.log('\n🏁 Testes concluídos!');
}

// Execute tests if this file is run directly
if (require.main === module) {
  testDecoder();
}

export { testDecoder }; 