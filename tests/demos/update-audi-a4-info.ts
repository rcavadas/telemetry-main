import { VehicleRegistryManager } from '../../src/managers/vehicle-registry-manager';

// Atualizar informações corretas do Device 004 - Audi A4 2014
function updateAudiA4Information() {
  console.log('🔧 ATUALIZANDO INFORMAÇÕES DO AUDI A4 2014');
  console.log('='.repeat(50));

  try {
    const manager = new VehicleRegistryManager();

    // Atualizar informações corretas do Device 004 - Audi A4 2014
    console.log('\n📝 Atualizando Device 218LSAB2025000004 - Audi A4 2014...');
    manager.updateVehicleSpecs('218LSAB2025000004', {
      brand: 'Audi',
      model: 'A4',
      year: '2014',
      engine: {
        displacement: '2.0L',
        fuelType: 'gasoline',
        power: '187 cv'
      },
      transmission: 'Tiptronic',
      category: 'Sedan',
      fuel: {
        tankCapacityLiters: 55,
        fuelType: 'gasoline',
        estimatedConsumption: '10.5 km/L cidade, 13.8 km/L estrada'
      }
    });

    console.log('\n✅ Informações do Audi A4 2014 atualizadas com sucesso!');
    
    // Mostrar relatório atualizado
    console.log('\n📊 RELATÓRIO ATUALIZADO:');
    manager.getStatusReport();

    // Mostrar configuração específica do Audi
    console.log('\n🚗 CONFIGURAÇÃO DETALHADA DO AUDI A4:');
    const vehicle = manager.getVehicle('218LSAB2025000004');
    if (vehicle) {
      console.log(`├─ Veículo: ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model} ${vehicle.vehicleSpecs.year}`);
      console.log(`├─ Motor: ${vehicle.vehicleSpecs.engine.displacement} ${vehicle.vehicleSpecs.engine.power}`);
      console.log(`├─ Tanque: ${vehicle.vehicleSpecs.fuel.tankCapacityLiters}L`);
      console.log(`├─ Transmissão: ${vehicle.vehicleSpecs.transmission}`);
      console.log(`├─ Consumo estimado: ${vehicle.vehicleSpecs.fuel.estimatedConsumption}`);
      console.log(`├─ Status combustível: ${vehicle.telemetryConfig.currentFuel.status}`);
      console.log(`└─ Protocolos: ${vehicle.deviceInfo.protocolIds.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar informações:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  updateAudiA4Information();
}

export { updateAudiA4Information }; 