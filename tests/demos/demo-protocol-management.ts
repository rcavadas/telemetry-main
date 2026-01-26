import { VehicleRegistryManager } from '../../src/managers/vehicle-registry-manager';

function demonstrateProtocolManagement() {
  console.log('📡 DEMONSTRAÇÃO - GERENCIAMENTO DE PROTOCOLOS');
  console.log('='.repeat(55));

  try {
    const manager = new VehicleRegistryManager();
    
    console.log('\n🔍 ESTADO INICIAL DOS PROTOCOLOS:');
    manager.getProtocolReport();
    
    console.log('\n🔧 ADICIONANDO PROTOCOLO 0x3400:');
    console.log('');
    
    // Adicionar protocolo 0x3400 ao Device 002
    manager.addProtocol('218LSAB2025000002', '0x3400');
    
    // Tentar adicionar o mesmo protocolo novamente (deve mostrar aviso)
    manager.addProtocol('218LSAB2025000002', '0x3400');
    
    // Adicionar protocolo 0x3400 ao Device 004 também
    manager.addProtocol('218LSAB2025000004', '0x3400');
    
    console.log('\n📊 ESTADO APÓS ADIÇÕES:');
    manager.getStatusReport();
    manager.getProtocolReport();
    
    console.log('\n🧪 TESTANDO FUNCIONALIDADES:');
    
    const deviceIds = ['218LSAB2025000004', '218LSAB2025000002'];
    
    deviceIds.forEach(deviceId => {
      console.log(`\n🔍 Device ${deviceId}:`);
      console.log(`├─ Suporta 0x1001: ${manager.supportsProtocol(deviceId, '0x1001') ? 'SIM' : 'NÃO'}`);
      console.log(`├─ Suporta 0x3400: ${manager.supportsProtocol(deviceId, '0x3400') ? 'SIM' : 'NÃO'}`);
      console.log(`└─ Suporta 0x9999: ${manager.supportsProtocol(deviceId, '0x9999') ? 'SIM' : 'NÃO'}`);
    });
    
    console.log('\n🔄 CENÁRIOS DE USO PRÁTICO:');
    
    // Cenário 1: Processamento baseado em protocolo
    console.log('\n1️⃣ PROCESSAMENTO BASEADO EM PROTOCOLO:');
    deviceIds.forEach(deviceId => {
      const vehicle = manager.getVehicle(deviceId);
      if (vehicle) {
        console.log(`\n   🚗 ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model}:`);
        
        vehicle.deviceInfo.protocolIds.forEach(protocolId => {
          switch (protocolId) {
            case '0x1001':
              console.log(`   ├─ ${protocolId}: Protocolo Sinocastel padrão`);
              console.log(`   │  └─ Campos: currentFuel, totalFuel, speedKmH, coordinates`);
              break;
            case '0x3400':
              console.log(`   ├─ ${protocolId}: Protocolo avançado`);
              console.log(`   │  └─ Campos: dados expandidos, sensores adicionais`);
              break;
            default:
              console.log(`   ├─ ${protocolId}: Protocolo desconhecido`);
          }
        });
      }
    });
    
    // Cenário 2: Validação de dados por protocolo
    console.log('\n2️⃣ VALIDAÇÃO POR PROTOCOLO:');
    console.log('```typescript');
    console.log('function processReading(deviceId: string, data: any) {');
    console.log('  if (manager.supportsProtocol(deviceId, "0x1001")) {');
    console.log('    // Processar dados do protocolo 0x1001');
    console.log('    const fuelData = extractFuelData_0x1001(data);');
    console.log('  }');
    console.log('  if (manager.supportsProtocol(deviceId, "0x3400")) {');
    console.log('    // Processar dados do protocolo 0x3400');
    console.log('    const advancedData = extractAdvancedData_0x3400(data);');
    console.log('  }');
    console.log('}');
    console.log('```');
    
    // Demonstrar remoção de protocolo
    console.log('\n🗑️ REMOVENDO PROTOCOLO 0x3400 DO DEVICE 004:');
    manager.removeProtocol('218LSAB2025000004', '0x3400');
    
    console.log('\n📊 ESTADO FINAL:');
    manager.getProtocolReport();
    
  } catch (error) {
    console.error('❌ Erro na demonstração:', error);
  }
}

function generateProtocolMappingExample() {
  console.log('\n🗺️ EXEMPLO DE MAPEAMENTO DE PROTOCOLOS');
  console.log('='.repeat(50));
  
  const protocolMapping = {
    '0x1001': {
      name: 'Sinocastel Standard',
      fields: [
        'currentFuel (UNRELIABLE - valor 512)',
        'totalFuel (decilitros)',
        'speedKmH', 
        'latitude/longitude',
        'totalMileage (trip distance)',
        'timestamp'
      ],
      reliability: {
        fuel: 'LOW - currentFuel é fallback',
        location: 'HIGH - GPS funcional',
        movement: 'HIGH - velocidade e distância'
      }
    },
    '0x3400': {
      name: 'Advanced Protocol',
      fields: [
        'enhanced_fuel_data',
        'engine_diagnostics', 
        'extended_sensors',
        'vehicle_status',
        'environmental_data'
      ],
      reliability: {
        fuel: 'TBD - a ser testado',
        location: 'TBD - a ser testado', 
        movement: 'TBD - a ser testado'
      }
    }
  };
  
  Object.entries(protocolMapping).forEach(([protocolId, info]) => {
    console.log(`\n📡 ${protocolId} - ${info.name}:`);
    console.log(`├─ Campos disponíveis:`);
    info.fields.forEach(field => {
      console.log(`│  • ${field}`);
    });
    console.log(`├─ Confiabilidade:`);
    Object.entries(info.reliability).forEach(([category, status]) => {
      console.log(`│  • ${category}: ${status}`);
    });
    console.log('└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─');
  });
}

// Executar se chamado diretamente
if (require.main === module) {
  demonstrateProtocolManagement();
  generateProtocolMappingExample();
}

export { demonstrateProtocolManagement, generateProtocolMappingExample }; 