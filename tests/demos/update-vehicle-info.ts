import { VehicleRegistryManager } from '../../src/managers/vehicle-registry-manager';

// Exemplo de como atualizar informações dos veículos
function updateVehicleInformation() {
  console.log('🔧 ATUALIZANDO INFORMAÇÕES DOS VEÍCULOS');
  console.log('='.repeat(50));

  try {
    const manager = new VehicleRegistryManager();

    // Atualizar informações do Device 004
    console.log('\n📝 Atualizando Device 218LSAB2025000004...');
    manager.updateVehicleSpecs('218LSAB2025000004', {
      brand: 'Toyota',
      model: 'Corolla',
      year: '2020',
      engine: {
        displacement: '1.8L',
        fuelType: 'gasoline',
        power: '144 cv'
      },
      transmission: 'CVT',
      category: 'Sedan',
      fuel: {
        tankCapacityLiters: 55,
        fuelType: 'gasoline',
        estimatedConsumption: '12.5 km/L cidade, 15.2 km/L estrada'
      }
    });

    // Atualizar informações do Device 002
    console.log('📝 Atualizando Device 218LSAB2025000002...');
    manager.updateVehicleSpecs('218LSAB2025000002', {
      brand: 'Honda',
      model: 'Civic',
      year: '2021',
      engine: {
        displacement: '2.0L',
        fuelType: 'gasoline',
        power: '158 cv'
      },
      transmission: 'CVT',
      category: 'Sedan',
      fuel: {
        tankCapacityLiters: 65,
        fuelType: 'gasoline',
        estimatedConsumption: '11.8 km/L cidade, 14.7 km/L estrada'
      }
    });

    console.log('\n✅ Informações atualizadas com sucesso!');
    
    // Mostrar relatório atualizado
    console.log('\n📊 RELATÓRIO ATUALIZADO:');
    manager.getStatusReport();

    // Demonstrar cálculos com as novas informações
    console.log('\n🧮 EXEMPLOS DE CÁLCULOS:');
    
    const devices = ['218LSAB2025000004', '218LSAB2025000002'];
    devices.forEach(deviceId => {
      const vehicle = manager.getVehicle(deviceId);
      if (vehicle) {
        console.log(`\n🚗 ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model} (${deviceId})`);
        console.log(`├─ Tanque: ${vehicle.vehicleSpecs.fuel.tankCapacityLiters}L`);
        console.log(`├─ Consumo estimado: ${vehicle.vehicleSpecs.fuel.estimatedConsumption}`);
        
        // Simular cálculo com dados reais
        if (deviceId === '218LSAB2025000002') {
          const consumoReal = manager.calculateTotalConsumption(deviceId, 173); // 17.3L
          const distanciaAprox = 57.16; // km da nossa análise
          const eficiencia = (distanciaAprox / consumoReal).toFixed(1);
          console.log(`├─ Consumo real: ${consumoReal}L em ${distanciaAprox}km`);
          console.log(`└─ Eficiência calculada: ${eficiencia} km/L`);
        } else {
          console.log(`└─ Veículo estático - sem dados de consumo`);
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar informações:', error);
  }
}

// Função para demonstrar diferentes cenários de uso
function demonstrateUsageCases() {
  console.log('\n🎯 CASOS DE USO DO SISTEMA DE REGISTRO');
  console.log('='.repeat(45));

  const manager = new VehicleRegistryManager();

  console.log('\n1️⃣ VALIDAÇÃO DE DADOS EM TEMPO REAL:');
  console.log('```typescript');
  console.log('const fuelLevel = manager.calculateFuelLevel(deviceId, rawFuel);');
  console.log('if (!fuelLevel.reliable) {');
  console.log('  alert("Dados de combustível não confiáveis!");');
  console.log('}');
  console.log('```');

  console.log('\n2️⃣ CÁLCULOS DE EFICIÊNCIA:');
  console.log('```typescript');
  console.log('const consumption = manager.calculateTotalConsumption(deviceId, rawTotal);');
  console.log('const efficiency = distance / consumption; // km/L');
  console.log('```');

  console.log('\n3️⃣ ALERTAS PERSONALIZADOS POR VEÍCULO:');
  console.log('```typescript');
  console.log('const config = manager.getFuelConfig(deviceId);');
  console.log('if (currentLevel < config.tankCapacity * 0.2) {');
  console.log('  alert(`${vehicle.brand} ${vehicle.model} - Combustível baixo!`);');
  console.log('}');
  console.log('```');

  console.log('\n4️⃣ RELATÓRIOS ESPECÍFICOS:');
  console.log('```typescript');
  console.log('const vehicle = manager.getVehicle(deviceId);');
  console.log('generateReport({');
  console.log('  brand: vehicle.vehicleSpecs.brand,');
  console.log('  fuelCapacity: vehicle.vehicleSpecs.fuel.tankCapacityLiters,');
  console.log('  reliability: vehicle.telemetryConfig.currentFuel.status');
  console.log('});');
  console.log('```');
}

// Executar se chamado diretamente
if (require.main === module) {
  updateVehicleInformation();
  demonstrateUsageCases();
}

export { updateVehicleInformation, demonstrateUsageCases }; 