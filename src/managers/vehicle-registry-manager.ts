import fs from 'fs';
import path from 'path';

// Tipos TypeScript para o registro
interface VehicleRegistry {
  vehicles: Record<string, VehicleRecord>;
  metadata: {
    version: string;
    lastUpdate: string;
    notes: string;
    validation: Record<string, string>;
  };
}

interface VehicleRecord {
  deviceInfo: {
    deviceId: string;
    deviceType: string;
    protocolIds: string[];
    firmwareVersion: string;
    hardwareVersion: string;
    installationDate: string;
    status: string;
  };
  vehicleSpecs: {
    brand: string;
    model: string;
    year: string;
    engine: {
      displacement: string;
      fuelType: string;
      power: string;
    };
    fuel: {
      tankCapacityLiters: number;
      fuelType: string;
      estimatedConsumption: string;
    };
    transmission: string;
    category: string;
  };
  telemetryConfig: {
    currentFuel: {
      status: string;
      interpretation: string;
      calibrated: boolean;
      notes: string;
    };
    totalFuel: {
      status: string;
      unit: string;
      conversion: string;
      calibrated: boolean;
    };
    odometer: {
      status: string;
      interpretation: string;
      notes: string;
    };
  };
  operationalData: {
    usage: string;
    location: string;
    averageSpeed: number;
    totalDistance: number;
    fuelConsumption: number;
    lastUpdate: string;
  };
  observations: {
    fuelGauge: string;
    odometerReading: number;
    issues: string[];
  };
}

class VehicleRegistryManager {
  private registryPath: string;
  private registry!: VehicleRegistry; // Definite assignment assertion

  constructor(registryPath: string = 'data/vehicle-registry.json') {
    this.registryPath = registryPath;
    this.loadRegistry();
  }

  private loadRegistry(): void {
    try {
      const data = fs.readFileSync(this.registryPath, 'utf8');
      this.registry = JSON.parse(data);
    } catch (error) {
      console.error('❌ Erro ao carregar registro de veículos:', error);
      throw error;
    }
  }

  private saveRegistry(): void {
    try {
      const data = JSON.stringify(this.registry, null, 2);
      fs.writeFileSync(this.registryPath, data, 'utf8');
      console.log('✅ Registro de veículos salvo com sucesso');
    } catch (error) {
      console.error('❌ Erro ao salvar registro de veículos:', error);
      throw error;
    }
  }

  // Buscar veículo por deviceId
  getVehicle(deviceId: string): VehicleRecord | null {
    return this.registry.vehicles[deviceId] || null;
  }

  // Listar todos os veículos como Record
  getAllVehicles(): Record<string, VehicleRecord> {
    return this.registry.vehicles;
  }

  // Listar todos os veículos como array
  getAllVehiclesArray(): VehicleRecord[] {
    return Object.values(this.registry.vehicles);
  }

  // Buscar veículo por ID
  getVehicleById(vehicleId: string): VehicleRecord | null {
    return this.getVehicle(vehicleId);
  }

  // Adicionar novo veículo
  addVehicle(vehicleData: Partial<VehicleRecord>): VehicleRecord {
    if (!vehicleData.deviceInfo?.deviceId) {
      throw new Error('deviceId é obrigatório');
    }

    const deviceId = vehicleData.deviceInfo.deviceId;
    
    if (this.registry.vehicles[deviceId]) {
      throw new Error(`Veículo com deviceId ${deviceId} já existe`);
    }

    const newVehicle: VehicleRecord = {
      deviceInfo: {
        deviceId,
        deviceType: vehicleData.deviceInfo?.deviceType || 'OBD',
        protocolIds: vehicleData.deviceInfo?.protocolIds || [],
        firmwareVersion: vehicleData.deviceInfo?.firmwareVersion || 'unknown',
        hardwareVersion: vehicleData.deviceInfo?.hardwareVersion || 'unknown',
        installationDate: new Date().toISOString(),
        status: 'active'
      },
      vehicleSpecs: {
        brand: vehicleData.vehicleSpecs?.brand || '',
        model: vehicleData.vehicleSpecs?.model || '',
        year: vehicleData.vehicleSpecs?.year || '',
        engine: vehicleData.vehicleSpecs?.engine || {
          displacement: '',
          fuelType: 'gasoline',
          power: ''
        },
        fuel: vehicleData.vehicleSpecs?.fuel || {
          tankCapacityLiters: 60,
          fuelType: 'gasoline',
          estimatedConsumption: ''
        },
        transmission: vehicleData.vehicleSpecs?.transmission || '',
        category: vehicleData.vehicleSpecs?.category || ''
      },
      telemetryConfig: vehicleData.telemetryConfig || {
        currentFuel: {
          status: 'RELIABLE',
          interpretation: 'Percentage from 0-1024',
          calibrated: false,
          notes: ''
        },
        totalFuel: {
          status: 'RELIABLE',
          unit: 'liters',
          conversion: '1:1',
          calibrated: false
        },
        odometer: {
          status: 'PENDING',
          interpretation: '',
          notes: ''
        }
      },
      operationalData: vehicleData.operationalData || {
        usage: 'daily',
        location: '',
        averageSpeed: 0,
        totalDistance: 0,
        fuelConsumption: 0,
        lastUpdate: new Date().toISOString()
      },
      observations: vehicleData.observations || {
        fuelGauge: '',
        odometerReading: 0,
        issues: []
      }
    };

    this.registry.vehicles[deviceId] = newVehicle;
    this.registry.metadata.lastUpdate = new Date().toISOString();
    this.saveRegistry();

    return newVehicle;
  }

  // Atualizar veículo
  updateVehicle(vehicleId: string, updateData: Partial<VehicleRecord>): VehicleRecord | null {
    const existingVehicle = this.getVehicle(vehicleId);
    if (!existingVehicle) {
      return null;
    }

    // Merge dos dados
    const updatedVehicle: VehicleRecord = {
      ...existingVehicle,
      ...updateData,
      deviceInfo: {
        ...existingVehicle.deviceInfo,
        ...updateData.deviceInfo
      },
      vehicleSpecs: {
        ...existingVehicle.vehicleSpecs,
        ...updateData.vehicleSpecs,
        engine: {
          ...existingVehicle.vehicleSpecs.engine,
          ...updateData.vehicleSpecs?.engine
        },
        fuel: {
          ...existingVehicle.vehicleSpecs.fuel,
          ...updateData.vehicleSpecs?.fuel
        }
      },
      telemetryConfig: {
        ...existingVehicle.telemetryConfig,
        ...updateData.telemetryConfig
      },
      operationalData: {
        ...existingVehicle.operationalData,
        ...updateData.operationalData,
        lastUpdate: new Date().toISOString()
      },
      observations: {
        ...existingVehicle.observations,
        ...updateData.observations
      }
    };

    this.registry.vehicles[vehicleId] = updatedVehicle;
    this.registry.metadata.lastUpdate = new Date().toISOString();
    this.saveRegistry();

    return updatedVehicle;
  }

  // Deletar veículo
  deleteVehicle(vehicleId: string): boolean {
    if (!this.registry.vehicles[vehicleId]) {
      return false;
    }

    delete this.registry.vehicles[vehicleId];
    this.registry.metadata.lastUpdate = new Date().toISOString();
    this.saveRegistry();

    return true;
  }

  // Novo método: adicionar protocolo a um device
  addProtocol(deviceId: string, protocolId: string): void {
    if (!this.registry.vehicles[deviceId]) {
      throw new Error(`Veículo ${deviceId} não encontrado`);
    }

    if (!this.registry.vehicles[deviceId].deviceInfo.protocolIds.includes(protocolId)) {
      this.registry.vehicles[deviceId].deviceInfo.protocolIds.push(protocolId);
      this.registry.metadata.lastUpdate = new Date().toISOString();
      this.saveRegistry();
      console.log(`✅ Protocolo ${protocolId} adicionado ao device ${deviceId}`);
    } else {
      console.log(`⚠️ Protocolo ${protocolId} já existe no device ${deviceId}`);
    }
  }

  // Novo método: remover protocolo de um device
  removeProtocol(deviceId: string, protocolId: string): void {
    if (!this.registry.vehicles[deviceId]) {
      throw new Error(`Veículo ${deviceId} não encontrado`);
    }

    const protocols = this.registry.vehicles[deviceId].deviceInfo.protocolIds;
    const index = protocols.indexOf(protocolId);
    
    if (index > -1) {
      protocols.splice(index, 1);
      this.registry.metadata.lastUpdate = new Date().toISOString();
      this.saveRegistry();
      console.log(`✅ Protocolo ${protocolId} removido do device ${deviceId}`);
    } else {
      console.log(`⚠️ Protocolo ${protocolId} não encontrado no device ${deviceId}`);
    }
  }

  // Novo método: verificar se device suporta protocolo
  supportsProtocol(deviceId: string, protocolId: string): boolean {
    const vehicle = this.getVehicle(deviceId);
    return vehicle ? vehicle.deviceInfo.protocolIds.includes(protocolId) : false;
  }

  // Atualizar especificações do veículo
  updateVehicleSpecs(deviceId: string, specs: Partial<VehicleRecord['vehicleSpecs']>): void {
    if (!this.registry.vehicles[deviceId]) {
      throw new Error(`Veículo ${deviceId} não encontrado`);
    }

    this.registry.vehicles[deviceId].vehicleSpecs = {
      ...this.registry.vehicles[deviceId].vehicleSpecs,
      ...specs
    };

    this.registry.metadata.lastUpdate = new Date().toISOString();
    this.saveRegistry();
  }

  // Atualizar configuração de telemetria
  updateTelemetryConfig(deviceId: string, config: Partial<VehicleRecord['telemetryConfig']>): void {
    if (!this.registry.vehicles[deviceId]) {
      throw new Error(`Veículo ${deviceId} não encontrado`);
    }

    this.registry.vehicles[deviceId].telemetryConfig = {
      ...this.registry.vehicles[deviceId].telemetryConfig,
      ...config
    };

    this.registry.metadata.lastUpdate = new Date().toISOString();
    this.saveRegistry();
  }

  // Adicionar nova observação
  addObservation(deviceId: string, issue: string): void {
    if (!this.registry.vehicles[deviceId]) {
      throw new Error(`Veículo ${deviceId} não encontrado`);
    }

    this.registry.vehicles[deviceId].observations.issues.push(issue);
    this.registry.metadata.lastUpdate = new Date().toISOString();
    this.saveRegistry();
  }

  // Obter configuração de combustível para cálculos
  getFuelConfig(deviceId: string) {
    const vehicle = this.getVehicle(deviceId);
    if (!vehicle) {
      throw new Error(`Veículo ${deviceId} não encontrado`);
    }

    return {
      tankCapacity: vehicle.vehicleSpecs.fuel.tankCapacityLiters,
      currentFuelStatus: vehicle.telemetryConfig.currentFuel.status,
      totalFuelUnit: vehicle.telemetryConfig.totalFuel.unit,
      totalFuelConversion: vehicle.telemetryConfig.totalFuel.conversion,
      isCurrentFuelReliable: vehicle.telemetryConfig.currentFuel.status === 'RELIABLE',
      isTotalFuelReliable: vehicle.telemetryConfig.totalFuel.status === 'RELIABLE'
    };
  }

  // Calcular nível de combustível (se confiável)
  calculateFuelLevel(deviceId: string, rawCurrentFuel: number): {
    reliable: boolean;
    percentage?: number;
    liters?: number;
    warning?: string;
  } {
    const config = this.getFuelConfig(deviceId);
    
    if (!config.isCurrentFuelReliable) {
      return {
        reliable: false,
        warning: 'Dados de currentFuel não confiáveis para este veículo'
      };
    }

    const percentage = (rawCurrentFuel / 1024) * 100;
    const liters = (rawCurrentFuel / 1024) * config.tankCapacity;

    return {
      reliable: true,
      percentage: Math.round(percentage * 10) / 10,
      liters: Math.round(liters * 10) / 10
    };
  }

  // Calcular consumo total
  calculateTotalConsumption(deviceId: string, rawTotalFuel: number): number {
    const config = this.getFuelConfig(deviceId);
    
    if (config.totalFuelUnit === 'deciliters') {
      return rawTotalFuel / 10; // Converter decilitros para litros
    }
    
    return rawTotalFuel; // Assumir que já está em litros
  }

  // Relatório de status
  getStatusReport(): void {
    console.log('🚗 RELATÓRIO DE VEÍCULOS REGISTRADOS');
    console.log('='.repeat(50));
    
    Object.entries(this.registry.vehicles).forEach(([deviceId, vehicle]) => {
      console.log(`\n📋 Device: ${deviceId}`);
      console.log(`├─ Marca/Modelo: ${vehicle.vehicleSpecs.brand} ${vehicle.vehicleSpecs.model}`);
      console.log(`├─ Ano: ${vehicle.vehicleSpecs.year}`);
      console.log(`├─ Protocolos: ${vehicle.deviceInfo.protocolIds.join(', ')}`);
      console.log(`├─ Tanque: ${vehicle.vehicleSpecs.fuel.tankCapacityLiters}L`);
      console.log(`├─ CurrentFuel: ${vehicle.telemetryConfig.currentFuel.status}`);
      console.log(`├─ TotalFuel: ${vehicle.telemetryConfig.totalFuel.status}`);
      console.log(`├─ Uso: ${vehicle.operationalData.usage}`);
      console.log(`├─ Problemas: ${vehicle.observations.issues.length}`);
      
      if (vehicle.observations.issues.length > 0) {
        vehicle.observations.issues.forEach((issue, i) => {
          console.log(`│  ${i + 1}. ${issue}`);
        });
      }
      
      console.log('└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─');
    });
    
    console.log(`\n📊 RESUMO:`);
    console.log(`├─ Total de veículos: ${Object.keys(this.registry.vehicles).length}`);
    console.log(`├─ Última atualização: ${this.registry.metadata.lastUpdate}`);
    console.log(`└─ Versão do registro: ${this.registry.metadata.version}`);
  }

  // Novo método: relatório de protocolos
  getProtocolReport(): void {
    console.log('\n📡 RELATÓRIO DE PROTOCOLOS SUPORTADOS');
    console.log('='.repeat(50));
    
    const allProtocols = new Set<string>();
    
    Object.entries(this.registry.vehicles).forEach(([deviceId, vehicle]) => {
      vehicle.deviceInfo.protocolIds.forEach(protocol => allProtocols.add(protocol));
    });
    
    console.log(`\n🔧 Protocolos únicos no sistema: ${allProtocols.size}`);
    Array.from(allProtocols).forEach(protocol => {
      console.log(`├─ ${protocol}`);
      
      // Contar devices que suportam este protocolo
      const supportingDevices = Object.entries(this.registry.vehicles)
        .filter(([_, vehicle]) => vehicle.deviceInfo.protocolIds.includes(protocol))
        .map(([deviceId]) => deviceId);
      
      console.log(`│  └─ Devices: ${supportingDevices.length} (${supportingDevices.join(', ')})`);
    });
  }
}

// Exemplo de uso e teste
function demonstrateVehicleRegistry() {
  console.log('🚗 DEMONSTRAÇÃO DO GERENCIADOR DE VEÍCULOS');
  console.log('='.repeat(55));

  try {
    const manager = new VehicleRegistryManager();
    
    // Mostrar relatório inicial
    manager.getStatusReport();
    
    console.log('\n🔧 TESTE DE CONFIGURAÇÕES:');
    
    // Testar configuração de combustível
    const deviceIds = ['218LSAB2025000004', '218LSAB2025000002'];
    
    deviceIds.forEach(deviceId => {
      console.log(`\n📊 Device ${deviceId}:`);
      
      const config = manager.getFuelConfig(deviceId);
      console.log(`├─ Tanque: ${config.tankCapacity}L`);
      console.log(`├─ CurrentFuel confiável: ${config.isCurrentFuelReliable ? 'SIM' : 'NÃO'}`);
      console.log(`├─ TotalFuel confiável: ${config.isTotalFuelReliable ? 'SIM' : 'NÃO'}`);
      
      // Teste de cálculo de nível (com valor 512)
      const fuelLevel = manager.calculateFuelLevel(deviceId, 512);
      if (fuelLevel.reliable) {
        console.log(`├─ Nível calculado: ${fuelLevel.percentage}% (${fuelLevel.liters}L)`);
      } else {
        console.log(`├─ ⚠️ ${fuelLevel.warning}`);
      }
      
      // Teste de consumo total
      const consumption = manager.calculateTotalConsumption(deviceId, 173);
      console.log(`└─ Consumo (173 raw): ${consumption}L`);
    });
    
    // Mostrar relatório de protocolos
    manager.getProtocolReport();
    
  } catch (error) {
    console.error('❌ Erro na demonstração:', error);
  }
}

// Executar demonstração se chamado diretamente
if (require.main === module) {
  demonstrateVehicleRegistry();
}

export { VehicleRegistryManager, VehicleRegistry, VehicleRecord }; 