import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { haversineDistanceMeters } from '../utils/distance-calculator';
import { DecodedMessage } from '../protocols/protocol-decoder';

export interface OBDReading {
  id: number;
  deviceId: string;
  timestamp: string;
  protocolId: string;
  latitude?: number;
  longitude?: number;
  speedKmH?: number;
  direction?: number;
  satellites?: number;
  gpsFix?: string;
  totalMileage?: number;
  currentMileage?: number;
  totalFuel?: number;
  currentFuel?: number;
  // Odometria derivada por GPS em metros (similar ao totalDistance do Traccar)
  totalOdometer?: number;
  powerOn?: boolean;
  accOn?: boolean;
  ignitionOn?: boolean;
  voltage?: number;
  softwareVersion?: string;
  hardwareVersion?: string;
  rawHex: string;
  createdAt: string;
  
  // Audit Trail Fields - Detailed logging information from logs.txt
  auditTrail?: {
    source: string;                    // Source of the data (e.g., 'tcp_server', 'logs.txt')
    clientId?: string;                 // Client IP and port (e.g., '::ffff:177.71.170.81:23546')
    context?: string;                  // Context of reception (e.g., 'RECEIVED_FROM_OBD')
    dataLength?: string;               // Length information (e.g., '128 bytes')
    asciiRepresentation?: string;      // ASCII representation of hex data
    byteArray?: number[];              // Raw byte array
    originalJsonObject?: any;          // Original JSON object from logs
    processingTime?: string;           // Time taken to process the data
    hexDataLength?: number;            // Length of hex data
    byteCount?: number;                // Number of bytes
    hasValidJson?: boolean;            // Whether JSON parsing was successful
  };
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private dbPath: string;
  private dataPath: string;
  private currentId: number = 1;

  private constructor() {
    this.dbPath = path.join(process.cwd(), 'obd_data');
    this.dataPath = path.join(this.dbPath, 'readings.json');
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      Logger.info('🗄️  Inicializando sistema de dados JSON', { path: this.dbPath });

      // Criar diretório se não existir
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }

      // Inicializar arquivo se não existir
      if (!fs.existsSync(this.dataPath)) {
        fs.writeFileSync(this.dataPath, JSON.stringify([], null, 2));
      }

      // Carregar último ID
      const existingData = this.loadData();
      if (existingData.length > 0) {
        this.currentId = Math.max(...existingData.map(r => r.id)) + 1;
      }

      Logger.info('✅ Sistema de dados inicializado com sucesso', { nextId: this.currentId });
    } catch (error) {
      Logger.error('❌ Erro ao inicializar sistema de dados', { error });
      throw error;
    }
  }

  private loadData(): OBDReading[] {
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      Logger.warn('⚠️  Erro ao carregar dados, retornando array vazio', { error });
      return [];
    }
  }

  private saveData(data: OBDReading[]): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
  }

  // Public method to save all data (for batch updates)
  saveAllData(data: OBDReading[]): void {
    this.saveData(data);
  }

  saveReading(decodedMessage: DecodedMessage, rawHex: string, auditInfo?: {
    clientId?: string;
    context?: string;
    dataLength?: string;
    asciiRepresentation?: string;
    byteArray?: number[];
    originalJsonObject?: any;
  }): number {
    try {
      const reading: OBDReading = {
        id: this.currentId++,
        deviceId: decodedMessage.deviceId,
        timestamp: decodedMessage.timestamp,
        protocolId: decodedMessage.protocolId,
        
        // GPS Data
        latitude: decodedMessage.gps?.latitude,
        longitude: decodedMessage.gps?.longitude,
        speedKmH: decodedMessage.gps?.speedKmH,
        direction: decodedMessage.gps?.direction,
        satellites: decodedMessage.gps?.satellites,
        gpsFix: decodedMessage.gps?.gpsFix,
        
        // Trip Data  
        totalMileage: decodedMessage.tripData?.totalMileage,
        currentMileage: decodedMessage.tripData?.currentMileage,
        totalFuel: decodedMessage.tripData?.totalFuel,
        currentFuel: decodedMessage.tripData?.currentFuel,
        
        // Vehicle State
        powerOn: decodedMessage.vehicleState?.powerOn,
        accOn: decodedMessage.vehicleState?.accOn,
        ignitionOn: decodedMessage.vehicleState?.ignitionOn,
        voltage: decodedMessage.voltage,
        
        // Version Info
        softwareVersion: decodedMessage.versions?.software,
        hardwareVersion: decodedMessage.versions?.hardware,
        
        // Raw Data
        rawHex: rawHex,
        createdAt: new Date().toISOString(),
        
        // Audit Trail
        auditTrail: auditInfo ? {
          source: 'tcp_server',
          clientId: auditInfo.clientId,
          context: auditInfo.context || 'RECEIVED_FROM_OBD',
          dataLength: auditInfo.dataLength || `${rawHex.length / 2} bytes`,
          asciiRepresentation: auditInfo.asciiRepresentation,
          byteArray: auditInfo.byteArray,
          originalJsonObject: auditInfo.originalJsonObject,
          processingTime: new Date().toISOString(),
          hexDataLength: rawHex.length,
          byteCount: rawHex.length / 2,
          hasValidJson: auditInfo.originalJsonObject !== undefined
        } : undefined
      };

      const data = this.loadData();
      data.push(reading);
      this.saveData(data);

      Logger.debug('💾 Leitura salva com auditoria', { 
        id: reading.id, 
        deviceId: reading.deviceId,
        timestamp: reading.timestamp,
        hasAuditTrail: !!reading.auditTrail
      });

      return reading.id;
    } catch (error) {
      Logger.error('❌ Erro ao salvar leitura', { error });
      throw error;
    }
  }

  // New method specifically for saving readings with complete audit trail from logs.txt
  saveReadingWithCompleteAudit(reading: Omit<OBDReading, 'id' | 'createdAt'>): number {
    try {
      const completeReading: OBDReading = {
        ...reading,
        id: this.currentId++,
        createdAt: new Date().toISOString()
      };

      const data = this.loadData();
      data.push(completeReading);
      this.saveData(data);

      Logger.debug('💾 Leitura salva com auditoria completa', { 
        id: completeReading.id, 
        deviceId: completeReading.deviceId,
        timestamp: completeReading.timestamp,
        auditSource: completeReading.auditTrail?.source
      });

      return completeReading.id;
    } catch (error) {
      Logger.error('❌ Erro ao salvar leitura com auditoria completa', { error });
      throw error;
    }
  }

  getReadings(deviceId?: string, limit: number = 50, offset: number = 0): OBDReading[] {
    try {
      let data = this.loadData();

      // Filtrar por deviceId se especificado
      if (deviceId) {
        data = data.filter(r => r.deviceId === deviceId);
      }

      // Ordenar por data de criação (mais recente primeiro)
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Aplicar paginação
      return data.slice(offset, offset + limit);
    } catch (error) {
      Logger.error('❌ Erro ao buscar leituras', { error });
      throw error;
    }
  }

  getGPSTrail(deviceId: string, startDate?: string, endDate?: string): OBDReading[] {
    try {
      let data = this.loadData();

      // Filtrar por device ID e coordenadas válidas
      data = data.filter(r => 
        r.deviceId === deviceId && 
        r.latitude != null && 
        r.longitude != null
      );

      // Filtrar por data se especificado
      if (startDate) {
        data = data.filter(r => r.timestamp >= startDate);
      }
      if (endDate) {
        data = data.filter(r => r.timestamp <= endDate);
      }

      // Ordenar por timestamp
      data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return data;
    } catch (error) {
      Logger.error('❌ Erro ao buscar trilha GPS', { error });
      throw error;
    }
  }

  getAllGPSReadings(deviceId?: string, limit?: number): OBDReading[] {
    try {
      let data = this.loadData();

      // Filtrar apenas leituras com coordenadas GPS válidas (não zero)
      data = data.filter(r => 
        r.latitude != null && 
        r.longitude != null &&
        r.latitude !== 0 && 
        r.longitude !== 0
      );

      // Filtrar por device ID se especificado
      if (deviceId) {
        data = data.filter(r => r.deviceId === deviceId);
      }

      // Ordenar por timestamp (mais recente primeiro)
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Aplicar limite se especificado
      if (limit && limit > 0) {
        data = data.slice(0, limit);
      }

      return data;
    } catch (error) {
      Logger.error('❌ Erro ao buscar todas as leituras GPS', { error });
      throw error;
    }
  }

  /**
   * Calcula a odometria aproximada (em metros) a partir das leituras de GPS,
   * somando a distância entre pontos consecutivos (Haversine), de forma
   * semelhante ao cálculo de totalDistance no Traccar.
   */
  getOdometerFromGps(deviceId: string): { totalMeters: number; totalKm: number; points: number } {
    try {
      const points = this.getGPSTrail(deviceId);

      if (points.length < 2) {
        return { totalMeters: 0, totalKm: 0, points: points.length };
      }

      let totalMeters = 0;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        if (
          prev.latitude != null && prev.longitude != null &&
          curr.latitude != null && curr.longitude != null &&
          prev.latitude !== 0 && prev.longitude !== 0 &&
          curr.latitude !== 0 && curr.longitude !== 0
        ) {
          const segment = haversineDistanceMeters(
            prev.latitude,
            prev.longitude,
            curr.latitude,
            curr.longitude
          );

          // Proteger contra outliers extremamente grandes (ex: saltos de GPS)
          if (segment > 0 && segment < 100000) {
            totalMeters += segment;
          } else {
            Logger.debug('⚠️ Segmento de distância ignorado por ser irreal', {
              deviceId,
              from: { lat: prev.latitude, lon: prev.longitude },
              to: { lat: curr.latitude, lon: curr.longitude },
              segment,
            });
          }
        }
      }

      return {
        totalMeters: Math.round(totalMeters),
        totalKm: Math.round((totalMeters / 1000) * 100) / 100, // duas casas decimais
        points: points.length,
      };
    } catch (error) {
      Logger.error('❌ Erro ao calcular odometria por GPS', {
        deviceId,
        error,
      });
      throw error;
    }
  }

  getStatistics(deviceId?: string): any {
    try {
      let data = this.loadData();

      if (deviceId) {
        data = data.filter(r => r.deviceId === deviceId);
      }

      const readings = data.length;
      const uniqueDevices = new Set(data.map(r => r.deviceId)).size;
      const speeds = data.filter(r => r.speedKmH != null).map(r => r.speedKmH!);
      const voltages = data.filter(r => r.voltage != null).map(r => r.voltage!);
      const readingsWithGPS = data.filter(r => r.latitude != null).length;
      const mileages = data.filter(r => r.totalMileage != null).map(r => r.totalMileage!);
      const fuels = data.filter(r => r.totalFuel != null).map(r => r.totalFuel!);

      return {
        totalReadings: readings,
        uniqueDevices: uniqueDevices,
        firstReading: data.length > 0 ? Math.min(...data.map(r => new Date(r.timestamp).getTime())) : null,
        lastReading: data.length > 0 ? Math.max(...data.map(r => new Date(r.timestamp).getTime())) : null,
        avgSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
        maxSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
        avgVoltage: voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : null,
        minVoltage: voltages.length > 0 ? Math.min(...voltages) : null,
        maxVoltage: voltages.length > 0 ? Math.max(...voltages) : null,
        readingsWithGPS: readingsWithGPS,
        maxMileage: mileages.length > 0 ? Math.max(...mileages) : null,
        avgFuel: fuels.length > 0 ? fuels.reduce((a, b) => a + b, 0) / fuels.length : null
      };
    } catch (error) {
      Logger.error('❌ Erro ao calcular estatísticas', { error });
      throw error;
    }
  }

  getFuelData(deviceId: string, limit: number = 100): OBDReading[] {
    try {
      let data = this.loadData();

      // Filtrar por deviceId e dados de combustível
      data = data.filter(r => 
        r.deviceId === deviceId && 
        (r.totalFuel != null || r.currentFuel != null)
      );

      // Ordenar por timestamp (mais recente primeiro)
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return data.slice(0, limit);
    } catch (error) {
      Logger.error('❌ Erro ao buscar dados de combustível', { error });
      throw error;
    }
  }

  exportToCSV(deviceId?: string): string {
    try {
      const data = deviceId ? this.getReadings(deviceId, 1000) : this.getReadings(undefined, 1000);
      
      if (data.length === 0) {
        return '';
      }

      // Headers
      const headers = [
        'id', 'deviceId', 'timestamp', 'protocolId',
        'latitude', 'longitude', 'speedKmH', 'direction', 'satellites', 'gpsFix',
        'totalMileage', 'currentMileage', 'totalFuel', 'currentFuel',
        'powerOn', 'accOn', 'ignitionOn', 'voltage',
        'softwareVersion', 'hardwareVersion', 'createdAt'
      ];

      const csvLines = [headers.join(',')];

      // Data rows
      for (const reading of data) {
        const row = headers.map(header => {
          const value = reading[header as keyof OBDReading];
          return value != null ? String(value) : '';
        });
        csvLines.push(row.join(','));
      }

      const csvPath = path.join(this.dbPath, `export_${deviceId || 'all'}_${Date.now()}.csv`);
      fs.writeFileSync(csvPath, csvLines.join('\n'));

      Logger.info('📊 Dados exportados para CSV', { path: csvPath, records: data.length });
      return csvPath;
    } catch (error) {
      Logger.error('❌ Erro ao exportar CSV', { error });
      throw error;
    }
  }

  close(): void {
    Logger.info('🗄️  Sistema de dados fechado');
  }

  vacuum(): void {
    Logger.info('🧹 Limpeza de dados não necessária para sistema JSON');
  }

  getDbPath(): string {
    return this.dbPath;
  }

  // Método auxiliar para backup
  backup(): string {
    try {
      const backupName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const backupPath = path.join(this.dbPath, backupName);
      
      fs.copyFileSync(this.dataPath, backupPath);
      
      Logger.info('💾 Backup criado', { path: backupPath });
      return backupPath;
    } catch (error) {
      Logger.error('❌ Erro ao criar backup', { error });
      throw error;
    }
  }
} 