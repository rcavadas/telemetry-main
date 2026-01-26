import { VehicleRegistryManager } from '../managers/vehicle-registry-manager';

// Tipos específicos para protocolo 0x3400
interface Protocol0x3400Data {
  // Dados de combustível avançados
  fuelSystem: {
    currentLevel: number;           // Nível real do tanque (0-100%)
    remainingLiters: number;        // Litros restantes
    consumptionRate: number;        // Taxa de consumo L/h
    fuelQuality: number;            // Qualidade do combustível (0-100)
    fuelTemperature: number;        // Temperatura do combustível °C
    lowFuelWarning: boolean;        // Alerta combustível baixo
  };
  
  // Diagnósticos do motor
  engineDiagnostics: {
    rpm: number;                    // Rotações por minuto
    engineTemp: number;             // Temperatura do motor °C
    oilPressure: number;            // Pressão do óleo bar
    coolantLevel: number;           // Nível do radiador %
    batteryVoltage: number;         // Voltagem da bateria V
    engineLoad: number;             // Carga do motor %
    errorCodes: string[];           // Códigos de erro DTC
  };
  
  // Sensores ambientais
  environmental: {
    ambientTemp: number;            // Temperatura ambiente °C
    humidity: number;               // Umidade %
    barometricPressure: number;     // Pressão atmosférica hPa
    airQuality: number;             // Qualidade do ar (0-100)
  };
  
  // Status do veículo
  vehicleStatus: {
    doorsLocked: boolean;           // Portas travadas
    lightsOn: boolean;              // Faróis ligados
    parkingBrake: boolean;          // Freio de mão
    seatBeltDriver: boolean;        // Cinto motorista
    engineRunning: boolean;         // Motor ligado
    acOn: boolean;                  // Ar condicionado
    gear: string;                   // Marcha atual
  };
  
  // Dados de localização avançada
  advancedLocation: {
    altitude: number;               // Altitude m
    heading: number;                // Direção °
    satelliteCount: number;         // Número de satélites
    gpsAccuracy: number;            // Precisão GPS m
    nearestAddress: string;         // Endereço mais próximo
  };
  
  // Timestamp e metadata
  metadata: {
    protocolVersion: string;        // Versão do protocolo
    deviceTimestamp: Date;          // Timestamp do device
    dataQuality: number;            // Qualidade dos dados %
    sequenceNumber: number;         // Número sequencial
  };
}

class Protocol0x3400Handler {
  private vehicleManager: VehicleRegistryManager;

  constructor(vehicleManager: VehicleRegistryManager) {
    this.vehicleManager = vehicleManager;
  }

  // Simular dados do protocolo 0x3400
  generateSampleData(deviceId: string, scenario: 'normal' | 'low_fuel' | 'engine_warning' | 'city_driving'): Protocol0x3400Data {
    const vehicle = this.vehicleManager.getVehicle(deviceId);
    if (!vehicle) {
      throw new Error(`Vehicle ${deviceId} not found`);
    }

    const baseData: Protocol0x3400Data = {
      fuelSystem: {
        currentLevel: 50,
        remainingLiters: vehicle.vehicleSpecs.fuel.tankCapacityLiters / 2,
        consumptionRate: 8.5,
        fuelQuality: 95,
        fuelTemperature: 25,
        lowFuelWarning: false
      },
      engineDiagnostics: {
        rpm: 800,
        engineTemp: 90,
        oilPressure: 3.2,
        coolantLevel: 100,
        batteryVoltage: 12.6,
        engineLoad: 15,
        errorCodes: []
      },
      environmental: {
        ambientTemp: 22,
        humidity: 65,
        barometricPressure: 1013.25,
        airQuality: 85
      },
      vehicleStatus: {
        doorsLocked: true,
        lightsOn: false,
        parkingBrake: false,
        seatBeltDriver: true,
        engineRunning: true,
        acOn: false,
        gear: 'P'
      },
      advancedLocation: {
        altitude: 760,
        heading: 45,
        satelliteCount: 12,
        gpsAccuracy: 2.5,
        nearestAddress: 'Av. Paulista, 1000 - São Paulo, SP'
      },
      metadata: {
        protocolVersion: '0x3400-v2.1',
        deviceTimestamp: new Date(),
        dataQuality: 98,
        sequenceNumber: Math.floor(Math.random() * 10000)
      }
    };

    // Aplicar cenários específicos
    switch (scenario) {
      case 'low_fuel':
        baseData.fuelSystem.currentLevel = 8;
        baseData.fuelSystem.remainingLiters = vehicle.vehicleSpecs.fuel.tankCapacityLiters * 0.08;
        baseData.fuelSystem.lowFuelWarning = true;
        break;

      case 'engine_warning':
        baseData.engineDiagnostics.engineTemp = 105;
        baseData.engineDiagnostics.oilPressure = 1.8;
        baseData.engineDiagnostics.errorCodes = ['P0128', 'P0171'];
        baseData.fuelSystem.fuelQuality = 75;
        break;

      case 'city_driving':
        baseData.engineDiagnostics.rpm = 2200;
        baseData.engineDiagnostics.engineLoad = 45;
        baseData.vehicleStatus.gear = 'D';
        baseData.vehicleStatus.acOn = true;
        baseData.fuelSystem.consumptionRate = 12.5;
        baseData.advancedLocation.heading = 180;
        break;
    }

    return baseData;
  }

  // Validar dados do protocolo 0x3400
  validateData(data: Protocol0x3400Data): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validações críticas
    if (data.fuelSystem.currentLevel < 0 || data.fuelSystem.currentLevel > 100) {
      errors.push('Nível de combustível fora da faixa válida (0-100%)');
    }

    if (data.engineDiagnostics.engineTemp > 110) {
      errors.push('Temperatura do motor crítica (>110°C)');
    }

    if (data.engineDiagnostics.oilPressure < 1.0) {
      errors.push('Pressão do óleo muito baixa (<1.0 bar)');
    }

    // Validações de aviso
    if (data.fuelSystem.currentLevel < 15) {
      warnings.push('Combustível baixo (<15%)');
    }

    if (data.engineDiagnostics.engineTemp > 95) {
      warnings.push('Temperatura do motor elevada (>95°C)');
    }

    if (data.engineDiagnostics.errorCodes.length > 0) {
      warnings.push(`Códigos de erro detectados: ${data.engineDiagnostics.errorCodes.join(', ')}`);
    }

    if (data.advancedLocation.satelliteCount < 4) {
      warnings.push('Sinal GPS fraco (<4 satélites)');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }

  // Comparar dados 0x1001 vs 0x3400
  compareProtocols(deviceId: string, data0x1001: any, data0x3400: Protocol0x3400Data): void {
    console.log(`🔍 COMPARAÇÃO DE PROTOCOLOS - Device ${deviceId}`);
    console.log('='.repeat(60));

    const vehicle = this.vehicleManager.getVehicle(deviceId);
    if (vehicle) {
      console.log(`🚗 Veículo: ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model}`);
    }

    console.log('\n📊 DADOS DE COMBUSTÍVEL:');
    console.log(`├─ 0x1001 currentFuel: ${data0x1001.currentFuel} (⚠️ valor fixo 512)`);
    console.log(`├─ 0x3400 currentLevel: ${data0x3400.fuelSystem.currentLevel}% (✅ dado real)`);
    console.log(`├─ 0x3400 remainingLiters: ${data0x3400.fuelSystem.remainingLiters}L`);
    console.log(`└─ 0x3400 consumptionRate: ${data0x3400.fuelSystem.consumptionRate}L/h`);

    console.log('\n🗺️ DADOS DE LOCALIZAÇÃO:');
    console.log(`├─ 0x1001 GPS: lat=${data0x1001.latitude}, lng=${data0x1001.longitude}`);
    console.log(`├─ 0x3400 GPS: mesmas coordenadas + altitude=${data0x3400.advancedLocation.altitude}m`);
    console.log(`├─ 0x3400 precisão: ${data0x3400.advancedLocation.gpsAccuracy}m`);
    console.log(`└─ 0x3400 endereço: ${data0x3400.advancedLocation.nearestAddress}`);

    console.log('\n🚗 DADOS EXCLUSIVOS DO 0x3400:');
    console.log(`├─ Motor: ${data0x3400.engineDiagnostics.rpm} RPM, ${data0x3400.engineDiagnostics.engineTemp}°C`);
    console.log(`├─ Status: Marcha ${data0x3400.vehicleStatus.gear}, AC ${data0x3400.vehicleStatus.acOn ? 'ON' : 'OFF'}`);
    console.log(`├─ Ambiente: ${data0x3400.environmental.ambientTemp}°C, ${data0x3400.environmental.humidity}% umidade`);
    console.log(`└─ Qualidade: ${data0x3400.metadata.dataQuality}% confiável`);
  }

  // Gerar alertas baseados nos dados
  generateAlerts(deviceId: string, data: Protocol0x3400Data): {
    critical: string[];
    warning: string[];
    info: string[];
  } {
    const critical: string[] = [];
    const warning: string[] = [];
    const info: string[] = [];

    const vehicle = this.vehicleManager.getVehicle(deviceId);
    const vehicleName = vehicle ? `${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model}` : deviceId;

    // Alertas críticos
    if (data.engineDiagnostics.engineTemp > 105) {
      critical.push(`🚨 ${vehicleName}: Superaquecimento do motor (${data.engineDiagnostics.engineTemp}°C)`);
    }

    if (data.engineDiagnostics.oilPressure < 1.5) {
      critical.push(`🚨 ${vehicleName}: Pressão do óleo baixa (${data.engineDiagnostics.oilPressure} bar)`);
    }

    if (data.fuelSystem.currentLevel < 5) {
      critical.push(`🚨 ${vehicleName}: Combustível crítico (${data.fuelSystem.currentLevel}%)`);
    }

    // Alertas de aviso
    if (data.fuelSystem.lowFuelWarning) {
      warning.push(`⚠️ ${vehicleName}: Combustível baixo (${data.fuelSystem.remainingLiters}L restantes)`);
    }

    if (data.engineDiagnostics.errorCodes.length > 0) {
      warning.push(`⚠️ ${vehicleName}: Códigos de erro: ${data.engineDiagnostics.errorCodes.join(', ')}`);
    }

    if (!data.vehicleStatus.seatBeltDriver && data.vehicleStatus.engineRunning) {
      warning.push(`⚠️ ${vehicleName}: Cinto de segurança não afivelado`);
    }

    // Informações
    if (data.fuelSystem.fuelQuality < 85) {
      info.push(`ℹ️ ${vehicleName}: Qualidade do combustível baixa (${data.fuelSystem.fuelQuality}%)`);
    }

    if (data.advancedLocation.satelliteCount > 10) {
      info.push(`ℹ️ ${vehicleName}: Excelente sinal GPS (${data.advancedLocation.satelliteCount} satélites)`);
    }

    return { critical, warning, info };
  }

  // Relatório detalhado
  generateDetailedReport(deviceId: string, data: Protocol0x3400Data): void {
    console.log(`📋 RELATÓRIO DETALHADO 0x3400 - Device ${deviceId}`);
    console.log('='.repeat(65));

    const vehicle = this.vehicleManager.getVehicle(deviceId);
    if (vehicle) {
      console.log(`🚗 ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model} ${vehicle.vehicleSpecs.year}`);
      console.log(`├─ Tanque: ${vehicle.vehicleSpecs.fuel.tankCapacityLiters}L`);
      console.log(`└─ Protocolos: ${vehicle.deviceInfo.protocolIds.join(', ')}`);
    }

    console.log('\n⛽ SISTEMA DE COMBUSTÍVEL:');
    console.log(`├─ Nível atual: ${data.fuelSystem.currentLevel}% (${data.fuelSystem.remainingLiters}L)`);
    console.log(`├─ Taxa de consumo: ${data.fuelSystem.consumptionRate}L/h`);
    console.log(`├─ Qualidade: ${data.fuelSystem.fuelQuality}%`);
    console.log(`├─ Temperatura: ${data.fuelSystem.fuelTemperature}°C`);
    console.log(`└─ Alerta baixo: ${data.fuelSystem.lowFuelWarning ? '🔴 SIM' : '🟢 NÃO'}`);

    console.log('\n🔧 DIAGNÓSTICOS DO MOTOR:');
    console.log(`├─ RPM: ${data.engineDiagnostics.rpm}`);
    console.log(`├─ Temperatura: ${data.engineDiagnostics.engineTemp}°C`);
    console.log(`├─ Pressão óleo: ${data.engineDiagnostics.oilPressure} bar`);
    console.log(`├─ Nível radiador: ${data.engineDiagnostics.coolantLevel}%`);
    console.log(`├─ Bateria: ${data.engineDiagnostics.batteryVoltage}V`);
    console.log(`├─ Carga motor: ${data.engineDiagnostics.engineLoad}%`);
    console.log(`└─ Erros: ${data.engineDiagnostics.errorCodes.length > 0 ? data.engineDiagnostics.errorCodes.join(', ') : 'Nenhum'}`);

    console.log('\n🌡️ DADOS AMBIENTAIS:');
    console.log(`├─ Temperatura: ${data.environmental.ambientTemp}°C`);
    console.log(`├─ Umidade: ${data.environmental.humidity}%`);
    console.log(`├─ Pressão: ${data.environmental.barometricPressure} hPa`);
    console.log(`└─ Qualidade ar: ${data.environmental.airQuality}%`);

    console.log('\n🚗 STATUS DO VEÍCULO:');
    console.log(`├─ Motor: ${data.vehicleStatus.engineRunning ? '🟢 Ligado' : '🔴 Desligado'}`);
    console.log(`├─ Marcha: ${data.vehicleStatus.gear}`);
    console.log(`├─ Portas: ${data.vehicleStatus.doorsLocked ? '🔒 Travadas' : '🔓 Destravadas'}`);
    console.log(`├─ Cinto: ${data.vehicleStatus.seatBeltDriver ? '🟢 Afivelado' : '🔴 Solto'}`);
    console.log(`└─ A/C: ${data.vehicleStatus.acOn ? '❄️ Ligado' : '🔴 Desligado'}`);

    console.log('\n📍 LOCALIZAÇÃO AVANÇADA:');
    console.log(`├─ Altitude: ${data.advancedLocation.altitude}m`);
    console.log(`├─ Direção: ${data.advancedLocation.heading}°`);
    console.log(`├─ Satélites: ${data.advancedLocation.satelliteCount}`);
    console.log(`├─ Precisão: ${data.advancedLocation.gpsAccuracy}m`);
    console.log(`└─ Endereço: ${data.advancedLocation.nearestAddress}`);

    const validation = this.validateData(data);
    const alerts = this.generateAlerts(deviceId, data);

    console.log('\n🚨 STATUS DE VALIDAÇÃO:');
    console.log(`├─ Dados válidos: ${validation.isValid ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`├─ Erros: ${validation.errors.length}`);
    console.log(`├─ Avisos: ${validation.warnings.length}`);
    console.log(`└─ Qualidade: ${data.metadata.dataQuality}%`);

    if (alerts.critical.length > 0 || alerts.warning.length > 0) {
      console.log('\n🚨 ALERTAS ATIVOS:');
      alerts.critical.forEach(alert => console.log(`   ${alert}`));
      alerts.warning.forEach(alert => console.log(`   ${alert}`));
    }
  }
}

// Função de demonstração completa
function demonstrateProtocol0x3400() {
  console.log('🚀 DEMONSTRAÇÃO COMPLETA - PROTOCOLO 0x3400');
  console.log('='.repeat(60));

  try {
    const vehicleManager = new VehicleRegistryManager();
    const protocol3400 = new Protocol0x3400Handler(vehicleManager);

    // Testar apenas device que suporta 0x3400
    const deviceId = '218LSAB2025000002'; // Honda Civic
    
    if (!vehicleManager.supportsProtocol(deviceId, '0x3400')) {
      console.log(`❌ Device ${deviceId} não suporta protocolo 0x3400`);
      return;
    }

    console.log(`✅ Device ${deviceId} suporta protocolo 0x3400\n`);

    // Cenário 1: Operação normal
    console.log('📊 CENÁRIO 1: OPERAÇÃO NORMAL');
    console.log('-'.repeat(40));
    const normalData = protocol3400.generateSampleData(deviceId, 'normal');
    protocol3400.generateDetailedReport(deviceId, normalData);

    // Cenário 2: Combustível baixo
    console.log('\n\n📊 CENÁRIO 2: COMBUSTÍVEL BAIXO');
    console.log('-'.repeat(40));
    const lowFuelData = protocol3400.generateSampleData(deviceId, 'low_fuel');
    const lowFuelAlerts = protocol3400.generateAlerts(deviceId, lowFuelData);
    
    console.log('🚨 ALERTAS GERADOS:');
    lowFuelAlerts.critical.forEach(alert => console.log(`   ${alert}`));
    lowFuelAlerts.warning.forEach(alert => console.log(`   ${alert}`));

    // Cenário 3: Problema no motor
    console.log('\n\n📊 CENÁRIO 3: PROBLEMAS NO MOTOR');
    console.log('-'.repeat(40));
    const engineWarningData = protocol3400.generateSampleData(deviceId, 'engine_warning');
    const engineAlerts = protocol3400.generateAlerts(deviceId, engineWarningData);
    
    console.log('🚨 ALERTAS CRÍTICOS:');
    engineAlerts.critical.forEach(alert => console.log(`   ${alert}`));
    engineAlerts.warning.forEach(alert => console.log(`   ${alert}`));

    // Comparação com protocolo 0x1001
    console.log('\n\n📊 COMPARAÇÃO COM PROTOCOLO 0x1001');
    console.log('-'.repeat(40));
    const mockData0x1001 = {
      currentFuel: 512,
      totalFuel: 173,
      latitude: -23.5505,
      longitude: -46.6333,
      speedKmH: 45
    };
    
    protocol3400.compareProtocols(deviceId, mockData0x1001, normalData);

  } catch (error) {
    console.error('❌ Erro na demonstração:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  demonstrateProtocol0x3400();
}

export { Protocol0x3400Handler, Protocol0x3400Data, demonstrateProtocol0x3400 }; 