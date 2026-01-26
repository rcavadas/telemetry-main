import { VehicleRegistryManager } from '../managers/vehicle-registry-manager';
import { Protocol0x3400Handler, Protocol0x3400Data } from '../protocols/protocol-0x3400-handler';

// Interface unificada para dados de telemetria
interface UnifiedTelemetryData {
  deviceId: string;
  timestamp: Date;
  protocolsUsed: string[];
  
  // Dados de combustível (melhor fonte disponível)
  fuel: {
    currentLevel?: number;        // 0-100% (se disponível)
    remainingLiters?: number;     // Litros restantes
    consumptionRate?: number;     // L/h
    quality?: number;             // 0-100
    reliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    source: string;               // Qual protocolo foi usado
  };
  
  // Localização (combinada dos protocolos)
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    satelliteCount?: number;
    address?: string;
    reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  
  // Dados do motor (0x3400 apenas)
  engine?: {
    rpm: number;
    temperature: number;
    oilPressure: number;
    batteryVoltage: number;
    errorCodes: string[];
    reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  
  // Status do veículo (0x3400 apenas)
  status?: {
    engineRunning: boolean;
    gear: string;
    speed: number;
    doorsLocked: boolean;
    seatBeltDriver: boolean;
  };
  
  // Alertas gerados
  alerts: {
    critical: string[];
    warning: string[];
    info: string[];
  };
  
  // Qualidade geral dos dados
  overallQuality: number; // 0-100%
}

class MultiProtocolProcessor {
  private vehicleManager: VehicleRegistryManager;
  private protocol3400Handler: Protocol0x3400Handler;

  constructor() {
    this.vehicleManager = new VehicleRegistryManager();
    this.protocol3400Handler = new Protocol0x3400Handler(this.vehicleManager);
  }

  // Processar dados brutos baseado nos protocolos suportados
  processRawData(deviceId: string, rawData: any): UnifiedTelemetryData {
    const supportedProtocols = this.getSupportedProtocols(deviceId);
    const result: UnifiedTelemetryData = {
      deviceId,
      timestamp: new Date(),
      protocolsUsed: supportedProtocols,
      fuel: {
        reliability: 'UNKNOWN',
        source: 'none'
      },
      location: {
        latitude: 0,
        longitude: 0,
        reliability: 'LOW'
      },
      alerts: {
        critical: [],
        warning: [],
        info: []
      },
      overallQuality: 0
    };

    let qualitySum = 0;
    let qualityCount = 0;

    // Processar dados do protocolo 0x1001 (sempre presente)
    if (supportedProtocols.includes('0x1001')) {
      this.process0x1001Data(rawData, result);
      qualitySum += 60; // Qualidade média do 0x1001
      qualityCount++;
    }

    // Processar dados do protocolo 0x3400 (se disponível)
    if (supportedProtocols.includes('0x3400')) {
      const protocol3400Data = this.protocol3400Handler.generateSampleData(deviceId, 'normal');
      this.process0x3400Data(protocol3400Data, result);
      qualitySum += 95; // Qualidade alta do 0x3400
      qualityCount++;
    }

    // Calcular qualidade geral
    result.overallQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : 0;

    // Gerar alertas baseados nos dados processados
    this.generateCombinedAlerts(deviceId, result);

    return result;
  }

  private getSupportedProtocols(deviceId: string): string[] {
    const vehicle = this.vehicleManager.getVehicle(deviceId);
    return vehicle ? vehicle.deviceInfo.protocolIds : [];
  }

  private process0x1001Data(rawData: any, result: UnifiedTelemetryData): void {
    // Dados de combustível (limitados/não confiáveis)
    const fuelConfig = this.vehicleManager.getFuelConfig(result.deviceId);
    
    if (rawData.currentFuel === 512) {
      result.fuel.reliability = 'LOW';
      result.fuel.source = '0x1001 (fallback value)';
      result.alerts.warning.push('⚠️ Dados de combustível não confiáveis (valor fixo 512)');
    } else {
      // Se não for 512, pode ser um valor real
      result.fuel.currentLevel = (rawData.currentFuel / 1024) * 100;
      result.fuel.remainingLiters = (rawData.currentFuel / 1024) * fuelConfig.tankCapacity;
      result.fuel.reliability = 'MEDIUM';
      result.fuel.source = '0x1001';
    }

    // Dados de localização
    if (rawData.latitude && rawData.longitude) {
      result.location.latitude = rawData.latitude;
      result.location.longitude = rawData.longitude;
      result.location.reliability = 'HIGH';
    }

    // Dados de movimento
    if (rawData.speedKmH !== undefined) {
      result.status = {
        engineRunning: rawData.speedKmH > 0,
        gear: rawData.speedKmH > 0 ? 'D' : 'P',
        speed: rawData.speedKmH,
        doorsLocked: true, // Assumir como padrão
        seatBeltDriver: true // Assumir como padrão
      };
    }
  }

  private process0x3400Data(data: Protocol0x3400Data, result: UnifiedTelemetryData): void {
    // Dados de combustível (substituir/melhorar dados do 0x1001)
    result.fuel = {
      currentLevel: data.fuelSystem.currentLevel,
      remainingLiters: data.fuelSystem.remainingLiters,
      consumptionRate: data.fuelSystem.consumptionRate,
      quality: data.fuelSystem.fuelQuality,
      reliability: 'HIGH',
      source: '0x3400'
    };

    // Melhorar dados de localização
    result.location.altitude = data.advancedLocation.altitude;
    result.location.accuracy = data.advancedLocation.gpsAccuracy;
    result.location.satelliteCount = data.advancedLocation.satelliteCount;
    result.location.address = data.advancedLocation.nearestAddress;
    
    if (data.advancedLocation.satelliteCount >= 8) {
      result.location.reliability = 'HIGH';
    } else if (data.advancedLocation.satelliteCount >= 4) {
      result.location.reliability = 'MEDIUM';
    }

    // Dados do motor
    result.engine = {
      rpm: data.engineDiagnostics.rpm,
      temperature: data.engineDiagnostics.engineTemp,
      oilPressure: data.engineDiagnostics.oilPressure,
      batteryVoltage: data.engineDiagnostics.batteryVoltage,
      errorCodes: data.engineDiagnostics.errorCodes,
      reliability: data.engineDiagnostics.errorCodes.length === 0 ? 'HIGH' : 'MEDIUM'
    };

    // Status do veículo (substituir dados básicos do 0x1001)
    result.status = {
      engineRunning: data.vehicleStatus.engineRunning,
      gear: data.vehicleStatus.gear,
      speed: result.status?.speed || 0, // Manter velocidade do 0x1001
      doorsLocked: data.vehicleStatus.doorsLocked,
      seatBeltDriver: data.vehicleStatus.seatBeltDriver
    };
  }

  private generateCombinedAlerts(deviceId: string, result: UnifiedTelemetryData): void {
    const vehicle = this.vehicleManager.getVehicle(deviceId);
    const vehicleName = vehicle ? `${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model}` : deviceId;

    // Alertas de combustível
    if (result.fuel.currentLevel !== undefined) {
      if (result.fuel.currentLevel < 5) {
        result.alerts.critical.push(`🚨 ${vehicleName}: Combustível crítico (${result.fuel.currentLevel}%)`);
      } else if (result.fuel.currentLevel < 15) {
        result.alerts.warning.push(`⚠️ ${vehicleName}: Combustível baixo (${result.fuel.currentLevel}%)`);
      }
    }

    // Alertas do motor (se disponível)
    if (result.engine) {
      if (result.engine.temperature > 105) {
        result.alerts.critical.push(`🚨 ${vehicleName}: Superaquecimento (${result.engine.temperature}°C)`);
      }
      
      if (result.engine.oilPressure < 1.5) {
        result.alerts.critical.push(`🚨 ${vehicleName}: Pressão óleo baixa (${result.engine.oilPressure} bar)`);
      }
      
      if (result.engine.errorCodes.length > 0) {
        result.alerts.warning.push(`⚠️ ${vehicleName}: Erros detectados: ${result.engine.errorCodes.join(', ')}`);
      }
    }

    // Alertas de segurança
    if (result.status && !result.status.seatBeltDriver && result.status.engineRunning) {
      result.alerts.warning.push(`⚠️ ${vehicleName}: Cinto de segurança não afivelado`);
    }

    // Alertas de qualidade de dados
    if (result.fuel.reliability === 'LOW') {
      result.alerts.info.push(`ℹ️ ${vehicleName}: Dados de combustível não confiáveis`);
    }

    if (result.location.reliability === 'LOW') {
      result.alerts.warning.push(`⚠️ ${vehicleName}: Sinal GPS fraco`);
    }
  }

  // Gerar relatório unificado
  generateUnifiedReport(deviceId: string): void {
    console.log(`📊 RELATÓRIO UNIFICADO MULTI-PROTOCOLO - ${deviceId}`);
    console.log('='.repeat(70));

    // Simular dados brutos do 0x1001
    const rawData0x1001 = {
      currentFuel: 512,
      totalFuel: 173,
      latitude: -23.5505,
      longitude: -46.6333,
      speedKmH: 45
    };

    const processedData = this.processRawData(deviceId, rawData0x1001);
    const vehicle = this.vehicleManager.getVehicle(deviceId);

    if (vehicle) {
      console.log(`🚗 ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model} ${vehicle.vehicleSpecs.year}`);
      console.log(`├─ Protocolos suportados: ${vehicle.deviceInfo.protocolIds.join(', ')}`);
      console.log(`├─ Protocolos utilizados: ${processedData.protocolsUsed.join(', ')}`);
      console.log(`└─ Qualidade geral: ${processedData.overallQuality}%`);
    }

    console.log('\n⛽ COMBUSTÍVEL (MELHOR FONTE DISPONÍVEL):');
    console.log(`├─ Fonte: ${processedData.fuel.source}`);
    console.log(`├─ Confiabilidade: ${processedData.fuel.reliability}`);
    
    if (processedData.fuel.currentLevel !== undefined) {
      console.log(`├─ Nível: ${processedData.fuel.currentLevel}% (${processedData.fuel.remainingLiters}L)`);
      
      if (processedData.fuel.consumptionRate) {
        console.log(`├─ Taxa consumo: ${processedData.fuel.consumptionRate}L/h`);
      }
      
      if (processedData.fuel.quality) {
        console.log(`└─ Qualidade: ${processedData.fuel.quality}%`);
      }
    } else {
      console.log(`└─ ⚠️ Nível não disponível`);
    }

    console.log('\n📍 LOCALIZAÇÃO:');
    console.log(`├─ Coordenadas: ${processedData.location.latitude}, ${processedData.location.longitude}`);
    console.log(`├─ Confiabilidade: ${processedData.location.reliability}`);
    
    if (processedData.location.altitude) {
      console.log(`├─ Altitude: ${processedData.location.altitude}m`);
    }
    
    if (processedData.location.accuracy) {
      console.log(`├─ Precisão: ${processedData.location.accuracy}m`);
    }
    
    if (processedData.location.satelliteCount) {
      console.log(`├─ Satélites: ${processedData.location.satelliteCount}`);
    }
    
    if (processedData.location.address) {
      console.log(`└─ Endereço: ${processedData.location.address}`);
    } else {
      console.log(`└─ Endereço: Não disponível`);
    }

    if (processedData.engine) {
      console.log('\n🔧 DIAGNÓSTICOS DO MOTOR (0x3400):');
      console.log(`├─ RPM: ${processedData.engine.rpm}`);
      console.log(`├─ Temperatura: ${processedData.engine.temperature}°C`);
      console.log(`├─ Pressão óleo: ${processedData.engine.oilPressure} bar`);
      console.log(`├─ Bateria: ${processedData.engine.batteryVoltage}V`);
      console.log(`├─ Confiabilidade: ${processedData.engine.reliability}`);
      console.log(`└─ Erros: ${processedData.engine.errorCodes.length > 0 ? processedData.engine.errorCodes.join(', ') : 'Nenhum'}`);
    }

    if (processedData.status) {
      console.log('\n🚗 STATUS DO VEÍCULO:');
      console.log(`├─ Motor: ${processedData.status.engineRunning ? '🟢 Ligado' : '🔴 Desligado'}`);
      console.log(`├─ Velocidade: ${processedData.status.speed} km/h`);
      console.log(`├─ Marcha: ${processedData.status.gear}`);
      console.log(`├─ Portas: ${processedData.status.doorsLocked ? '🔒 Travadas' : '🔓 Abertas'}`);
      console.log(`└─ Cinto: ${processedData.status.seatBeltDriver ? '🟢 Afivelado' : '🔴 Solto'}`);
    }

    // Mostrar alertas
    const totalAlerts = processedData.alerts.critical.length + processedData.alerts.warning.length;
    if (totalAlerts > 0) {
      console.log('\n🚨 ALERTAS ATIVOS:');
      processedData.alerts.critical.forEach(alert => console.log(`   ${alert}`));
      processedData.alerts.warning.forEach(alert => console.log(`   ${alert}`));
      processedData.alerts.info.forEach(alert => console.log(`   ${alert}`));
    } else {
      console.log('\n✅ NENHUM ALERTA ATIVO');
    }

    console.log('\n🎯 VANTAGENS DO PROCESSAMENTO MULTI-PROTOCOLO:');
    console.log('├─ ✅ Dados de combustível confiáveis (0x3400) vs valor fixo (0x1001)');
    console.log('├─ ✅ Localização aprimorada com altitude e precisão');
    console.log('├─ ✅ Diagnósticos completos do motor');
    console.log('├─ ✅ Status detalhado do veículo');
    console.log('├─ ✅ Sistema de alertas inteligente');
    console.log('└─ ✅ Fallback automático para protocolos básicos');
  }

  // Comparar dados entre devices com protocolos diferentes
  compareDevices(): void {
    console.log('\n🔄 COMPARAÇÃO ENTRE DEVICES');
    console.log('='.repeat(50));

    const devices = ['218LSAB2025000004', '218LSAB2025000002'];
    
    devices.forEach(deviceId => {
      const vehicle = this.vehicleManager.getVehicle(deviceId);
      if (vehicle) {
        console.log(`\n🚗 ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model}:`);
        console.log(`├─ Protocolos: ${vehicle.deviceInfo.protocolIds.join(', ')}`);
        
        const supportsAdvanced = vehicle.deviceInfo.protocolIds.includes('0x3400');
        console.log(`├─ Dados avançados: ${supportsAdvanced ? '✅ Disponíveis' : '❌ Limitados'}`);
        console.log(`├─ Qualidade combustível: ${supportsAdvanced ? 'ALTA' : 'BAIXA'}`);
        console.log(`├─ Diagnósticos motor: ${supportsAdvanced ? 'SIM' : 'NÃO'}`);
        console.log(`└─ Alertas avançados: ${supportsAdvanced ? 'SIM' : 'BÁSICOS'}`);
      }
    });
  }
}

// Demonstração completa
function demonstrateMultiProtocolProcessing() {
  console.log('🚀 SISTEMA INTEGRADO MULTI-PROTOCOLO');
  console.log('='.repeat(60));

  const processor = new MultiProtocolProcessor();

  // Demonstrar com device que tem ambos protocolos
  processor.generateUnifiedReport('218LSAB2025000002');

  // Comparar devices
  processor.compareDevices();
}

// Executar se chamado diretamente
if (require.main === module) {
  demonstrateMultiProtocolProcessing();
}

export { MultiProtocolProcessor, UnifiedTelemetryData, demonstrateMultiProtocolProcessing }; 