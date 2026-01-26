// Sistema Principal de Telemetria Multi-Protocolo
export { VehicleRegistryManager } from './managers/vehicle-registry-manager';
export { Protocol0x3400Handler, Protocol0x3400Data } from './protocols/protocol-0x3400-handler';
export { MultiProtocolProcessor, UnifiedTelemetryData } from './processors/multi-protocol-processor';

// Re-exportar tipos principais
export type { VehicleRegistry, VehicleRecord } from './managers/vehicle-registry-manager';

// Exemplo de uso básico
import { VehicleRegistryManager } from './managers/vehicle-registry-manager';
import { Protocol0x3400Handler } from './protocols/protocol-0x3400-handler';
import { MultiProtocolProcessor } from './processors/multi-protocol-processor';

/**
 * Função principal para demonstrar o uso do sistema
 */
export function createTelemetrySystem() {
  const vehicleManager = new VehicleRegistryManager();
  const protocol3400Handler = new Protocol0x3400Handler(vehicleManager);
  const multiProcessor = new MultiProtocolProcessor();

  return {
    vehicleManager,
    protocol3400Handler,
    multiProcessor,
    
    // Métodos de conveniência
    processReading: (deviceId: string, rawData: any) => {
      return multiProcessor.processRawData(deviceId, rawData);
    },
    
    getVehicleInfo: (deviceId: string) => {
      return vehicleManager.getVehicle(deviceId);
    },
    
    getSupportedProtocols: (deviceId: string) => {
      const vehicle = vehicleManager.getVehicle(deviceId);
      return vehicle ? vehicle.deviceInfo.protocolIds : [];
    }
  };
}

/**
 * Exemplo de processamento de dados de telemetria
 */
export function processTelemetryExample() {
  console.log('🚀 SISTEMA DE TELEMETRIA MULTI-PROTOCOLO');
  console.log('='.repeat(50));
  
  const system = createTelemetrySystem();
  
  // Dados simulados do protocolo 0x1001
  const sampleData = {
    currentFuel: 512,
    totalFuel: 173,
    latitude: -23.5505,
    longitude: -46.6333,
    speedKmH: 45
  };
  
  // Processar dados
  const result = system.processReading('218LSAB2025000002', sampleData);
  
  console.log('\n📊 RESULTADO DO PROCESSAMENTO:');
  console.log(`├─ Device: ${result.deviceId}`);
  console.log(`├─ Protocolos utilizados: ${result.protocolsUsed.join(', ')}`);
  console.log(`├─ Qualidade geral: ${result.overallQuality}%`);
  console.log(`├─ Combustível: ${result.fuel.currentLevel}% (${result.fuel.reliability})`);
  console.log(`├─ Localização: ${result.location.latitude}, ${result.location.longitude}`);
  console.log(`└─ Alertas: ${result.alerts.critical.length + result.alerts.warning.length + result.alerts.info.length}`);
  
  // Mostrar alertas detalhadamente
  if (result.alerts.critical.length > 0 || result.alerts.warning.length > 0 || result.alerts.info.length > 0) {
    console.log('\n🚨 ALERTAS DETALHADOS:');
    
    if (result.alerts.critical.length > 0) {
      console.log('🔴 CRÍTICOS:');
      result.alerts.critical.forEach(alert => console.log(`   ${alert}`));
    }
    
    if (result.alerts.warning.length > 0) {
      console.log('🟡 AVISOS:');
      result.alerts.warning.forEach(alert => console.log(`   ${alert}`));
    }
    
    if (result.alerts.info.length > 0) {
      console.log('🔵 INFORMAÇÕES:');
      result.alerts.info.forEach(alert => console.log(`   ${alert}`));
    }
  } else {
    console.log('\n✅ NENHUM ALERTA ATIVO');
  }
  
  return result;
}

// Executar exemplo se chamado diretamente
if (require.main === module) {
  processTelemetryExample();
} 