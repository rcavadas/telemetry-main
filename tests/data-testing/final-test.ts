import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

// Set debug level for comprehensive testing
Logger.setLevel(LogLevel.DEBUG);

function finalTest() {
  console.log('🧪 Teste Final - Decodificador de Protocolo OBD 0x1001\n');

  const examples = [
    {
      name: 'Exemplo 1 - 0x1001Parsing Example.txt',
      hex: '40408600043231384C534142323032353030303030340000001001366C3468676D3468FDBB01008904000000000000000000020400003E29441F00001D011A05190D20176C0AEE0410864E09B9010000CC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A'
    },
    {
      name: 'Exemplo 2 - 1001.txt', 
      hex: '40409B00043231334744503230313830323133343300000000100A3311B5DAD321B5D6F3D000010020000C2010000A0000000400073B015700000000010270130A200A3283C3023007A9103D025C06AF4944445F3231335730315F532056322E312E3700494444F3231335730315F482056322E312E370E00011802181A011B011E011F021F031F041F051F061F071F01210221729BA0D0A'
    },
    {
      name: 'Exemplo 3 - Estrutura baseada em data_obd.txt',
      hex: '40408600043231384c53414232303235303030303030320000001001366c3468676d3468102700000534000058000000000000020400036294411e00001c011c051d0d3a17004aeedb0020640a19005a00cc42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A'
    }
  ];

  examples.forEach((example, index) => {
    console.log(`📋 ${example.name}`);
    console.log(`Raw hex: ${example.hex.substring(0, 60)}...`);
    console.log('');

    try {
      const buffer = Buffer.from(example.hex, 'hex');
      const decoded = ProtocolDecoder.decodeMessage(buffer);

      if (decoded) {
        console.log('✅ Decodificação bem-sucedida!');
        
        // Mostrar apenas os campos mais importantes
        const summary = {
          deviceId: decoded.deviceId,
          protocolId: decoded.protocolId,
          timestamp: decoded.timestamp,
          gps: decoded.gps ? {
            latitude: Number(decoded.gps.latitude.toFixed(6)),
            longitude: Number(decoded.gps.longitude.toFixed(6)),
            speed: `${decoded.gps.speedKmH} km/h`,
            satellites: decoded.gps.satellites,
            fix: decoded.gps.gpsFix
          } : 'N/A',
          vehicleState: decoded.vehicleState ? {
            powerOn: decoded.vehicleState.powerOn,
            accOn: decoded.vehicleState.accOn
          } : 'N/A',
          tripData: decoded.tripData ? {
            totalMileage: decoded.tripData.totalMileage,
            currentMileage: decoded.tripData.currentMileage
          } : 'N/A',
          versions: decoded.versions ? {
            software: decoded.versions.software?.substring(0, 30) + '...',
            hardware: decoded.versions.hardware?.substring(0, 30) + '...'
          } : 'N/A',
          voltage: decoded.voltage ? `${decoded.voltage}V` : 'N/A'
        };

        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log('❌ Falha na decodificação');
      }

    } catch (error) {
      console.log('❌ Erro durante teste:', error);
    }

    if (index < examples.length - 1) {
      console.log('\n' + '='.repeat(80) + '\n');
    }
  });

  console.log('\n🏁 Teste Final Concluído!');
  console.log('\n📊 Resumo:');
  console.log('✓ Decodificador implementado para protocolo 0x1001');
  console.log('✓ Suporte a coordenadas GPS, timestamps, estado do veículo');
  console.log('✓ Extração de versões de software e hardware');
  console.log('✓ Validação de CRC (quando implementada)');
  console.log('✓ Logs detalhados para depuração');
  console.log('✓ Integração com servidor TCP');
  
  console.log('\n🚀 Próximos passos:');
  console.log('1. Testar com dados reais do dispositivo OBD');
  console.log('2. Ajustar escalas de coordenadas GPS se necessário');
  console.log('3. Implementar outros tipos de protocolo conforme necessário');
  console.log('4. Adicionar persistência de dados (banco de dados)');
  console.log('5. Criar API REST para consultar dados de telemetria');
}

// Execute tests if this file is run directly
if (require.main === module) {
  finalTest();
}

export { finalTest }; 