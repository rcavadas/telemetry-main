import { Logger } from '../utils/logger';

export interface DecodedMessage {
  deviceId: string;
  protocolId: string;
  timestamp: string;
  lastAcconTime?: string;
  utcTime?: string;
  gps?: {
    latitude: number;
    longitude: number;
    speedKmH: number;
    direction: number;
    gpsFix: string;
    satellites: number;
    date: string;
    time: string;
  };
  vehicleState?: {
    powerOn: boolean;
    accOn: boolean;
    ignitionOn: boolean;
    rawState: string;
  };
  tripData?: {
    totalMileage: number;
    totalOdometer: number;
    currentMileage: number;
    totalFuel: number;
    currentFuel: number;
  };
  versions?: {
    software: string;
    hardware: string;
  };
  voltage?: number;
  signalStrength?: number;
  crcValid?: boolean;
  reserved?: string;
  rawData?: {
    protocol: string;
    length: number;
    hex: string;
    detectedAt: string;
  };
}

export class ProtocolDecoder {
  
  /**
   * Decodifica uma mensagem do protocolo 0x1001
   */
  static decode1001Message(data: Buffer): DecodedMessage | null {
    try {
      Logger.debug('🔍 Iniciando decodificação de mensagem 0x1001', { 
        dataHex: data.toString('hex'),
        length: data.length 
      });

      if (data.length < 25) {
        Logger.warn('Mensagem muito curta para ser 0x1001', { length: data.length });
        return null;
      }

      let offset = 0;
      const result: DecodedMessage = {
        deviceId: '',
        protocolId: '',
        timestamp: new Date().toISOString()
      };

      // Verificar header do protocolo (0x4040)
      const protocolHead = data.readUInt16BE(offset);
      offset += 2;
      
      if (protocolHead !== 0x4040) {
        Logger.warn('Header de protocolo inválido', { 
          expected: '0x4040', 
          found: `0x${protocolHead.toString(16)}` 
        });
        return null;
      }

      // Protocol length (Little Endian)
      const protocolLength = data.readUInt16LE(offset);
      offset += 2;
      Logger.debug('Protocol length:', protocolLength);

      // Protocol version
      const protocolVersion = data.readUInt8(offset);
      offset += 1;
      Logger.debug('Protocol version:', protocolVersion);

      // Device ID: Pode variar de 16 a 17 bytes úteis + padding até null
      // Vamos ler até encontrar padding zeros ou 22 bytes máximo
      const deviceIdStart = offset;
      let deviceIdLength = 0;
      
      // Encontrar o final real do Device ID (até primeiro 0x00 ou máximo 17 bytes)
      for (let i = 0; i < 17; i++) {
        if (data[deviceIdStart + i] === 0) break;
        deviceIdLength++;
      }
      
      result.deviceId = data.slice(deviceIdStart, deviceIdStart + deviceIdLength).toString('ascii');
      Logger.debug('Device ID extraído:', { deviceId: result.deviceId, length: deviceIdLength });
      
      // Pular para após o Device ID + padding (geralmente posição 25)
      offset = 25;

      // Protocol ID (sempre na posição 25-26)
      const protocolId = data.readUInt16BE(offset);
      if (protocolId !== 0x1001) {
        Logger.warn('Protocol ID inválido', { 
          expected: '0x1001', 
          found: `0x${protocolId.toString(16)}` 
        });
        return null;
      }
      
      offset += 2;
      result.protocolId = '0x1001';

      // Last accon time (4 bytes) - timestamp UNIX Little Endian
      const lastAcconTime = data.readUInt32LE(offset);
      offset += 4;
      result.lastAcconTime = new Date(lastAcconTime * 1000).toISOString();

      // UTC Time (4 bytes) - timestamp UNIX Little Endian
      const utcTime = data.readUInt32LE(offset);
      offset += 4;
      result.utcTime = new Date(utcTime * 1000).toISOString();
      result.timestamp = result.utcTime;

      // Trip data
      const rawTotalMileage = data.readUInt32LE(offset);
      result.tripData = {
        totalMileage: rawTotalMileage,    // Valor em MILHAS
        totalOdometer: (rawTotalMileage / 1609.34)*1000,        // Valor em QUILÔMETROS
        currentMileage: data.readUInt32LE(offset + 4),
        totalFuel: data.readUInt32LE(offset + 8),
        currentFuel: data.readUInt16LE(offset + 14)
      };
      offset += 14;

      // Vehicle state (4 bytes) - CORRIGIDO: Little Endian
      const vstate = data.readUInt32LE(offset);
      offset += 4;
      
      result.vehicleState = this.parseVehicleState(vstate);

      // Reserved data (8 bytes)
      const reservedData = data.slice(offset, offset + 8);
      offset += 8;
      result.reserved = reservedData.toString('hex');
      
      // Parse voltage if available in reserved data
      if (reservedData.length >= 2) {
        const voltageRaw = reservedData.readUInt8(1);
        if (voltageRaw > 0) {
          result.voltage = (voltageRaw * 0.1) + 8; // Conforme documentação
        }
      }

      // GPS count
      const gpsCount = data.readUInt8(offset);
      offset += 1;

      if (gpsCount > 0 && gpsCount <= 10) { // Sanity check
        result.gps = this.parseGPSData(data, offset);
        // Calcular offset após dados GPS
        offset += 18; // 3 (date) + 3 (time) + 4 (lat) + 4 (lng) + 2 (speed) + 2 (direction) + 1 (flag)
      }

      // Software version (terminado em 0x00)
      const softwareStart = offset;
      let softwareEnd = data.indexOf(0x00, softwareStart);
      if (softwareEnd === -1) softwareEnd = data.length - 4; // -4 para CRC e tail
      
      const softwareBuffer = data.slice(softwareStart, softwareEnd);
      // Filtrar apenas caracteres ASCII imprimíveis
      const softwareVersion = softwareBuffer.toString('ascii').replace(/[^\x20-\x7E]/g, '');
      offset = softwareEnd + 1;

      // Hardware version (terminado em 0x00)
      const hardwareStart = offset;
      let hardwareEnd = data.indexOf(0x00, hardwareStart);
      if (hardwareEnd === -1) hardwareEnd = data.length - 4;
      
      const hardwareBuffer = data.slice(hardwareStart, hardwareEnd);
      // Filtrar apenas caracteres ASCII imprimíveis
      const hardwareVersion = hardwareBuffer.toString('ascii').replace(/[^\x20-\x7E]/g, '');

      result.versions = {
        software: softwareVersion,
        hardware: hardwareVersion
      };

      Logger.info('✅ Mensagem 0x1001 decodificada com sucesso', {
        deviceId: result.deviceId,
        timestamp: result.timestamp,
        gpsAvailable: !!result.gps,
        mileage: result.tripData?.totalMileage
      });

      return result;

    } catch (error) {
      Logger.error('❌ Erro ao decodificar mensagem 0x1001', { 
        error: error instanceof Error ? error.message : String(error),
        dataLength: data.length 
      });
      return null;
    }
  }

  /**
   * Parse vehicle state bits
   */
  private static parseVehicleState(vstate: number): DecodedMessage['vehicleState'] {
    const s0 = (vstate) & 0xFF;
    const s1 = (vstate >> 8) & 0xFF;
    const s2 = (vstate >> 16) & 0xFF;
    const s3 = (vstate >> 24) & 0xFF;

    return {
      powerOn: (s1 & 0x02) !== 0,     // Bit 1 of S1
      accOn: (s2 & 0x04) !== 0,       // Bit 2 of S2
      ignitionOn: (s2 & 0x04) !== 0,  // Bit 2 of S2 (ACC ON)
      rawState: `${s0.toString(16).padStart(2, '0')}${s1.toString(16).padStart(2, '0')}${s2.toString(16).padStart(2, '0')}${s3.toString(16).padStart(2, '0')}`
    };
  }

  /**
   * Parse GPS data
   */
  private static parseGPSData(data: Buffer, offset: number): DecodedMessage['gps'] {
    try {
      // Date (3 bytes) - DDMMYY
      const day = data.readUInt8(offset);
      const month = data.readUInt8(offset + 1);
      const year = 2000 + data.readUInt8(offset + 2);
      offset += 3;

      // Time (3 bytes) - HHMMSS
      const hour = data.readUInt8(offset);
      const minute = data.readUInt8(offset + 1);
      const second = data.readUInt8(offset + 2);
      offset += 3;

      // Latitude (4 bytes) - Little Endian, signed integer
      // DESCOBERTA: Fator de escala é 3.600.000 (não 1.000.000) e coordenadas são NEGATIVAS
      const latitudeRaw = data.readInt32LE(offset);
      const latitude = -latitudeRaw / 3600000; // Negativo + fator correto
      offset += 4;

      // Longitude (4 bytes) - Little Endian, signed integer
      // DESCOBERTA: Fator de escala é 3.600.000 (não 1.000.000) e coordenadas são NEGATIVAS  
      const longitudeRaw = data.readInt32LE(offset);
      const longitude = -longitudeRaw / 3600000; // Negativo + fator correto
      offset += 4;

      // Speed (2 bytes) - Little Endian, scale by 100
      // Conforme exemplo: B901 = 01B9 = 441 -> 4.41 km/h, mas doc diz 15.88
      // Vamos testar sem divisão: 441 * 0.036 = 15.876 ≈ 15.88 km/h
      const speedRaw = data.readUInt16LE(offset);
      const speedKmH = speedRaw * 0.036; // Conversão correta baseada no exemplo
      offset += 2;

      // Direction (2 bytes) - Little Endian
      const direction = data.readUInt16LE(offset);
      offset += 2;

      // Flag (1 byte) - contains GPS fix info and satellite count
      const flag = data.readUInt8(offset);
      
      const gpsFix = this.parseGPSFix((flag >> 2) & 0x03);
      const satellites = (flag >> 4) & 0x0F;

      Logger.debug('GPS data parsed', {
        rawCoords: { latitudeRaw, longitudeRaw },
        finalCoords: { latitude, longitude },
        scaleFactor: 3600000,
        speedKmH,
        satellites
      });

      return {
        latitude,
        longitude,
        speedKmH,
        direction,
        gpsFix,
        satellites,
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
      };

    } catch (error) {
      Logger.error('Erro ao parsear dados GPS', { error });
      return {
        latitude: 0,
        longitude: 0,
        speedKmH: 0,
        direction: 0,
        gpsFix: 'No Fix',
        satellites: 0,
        date: '',
        time: ''
      };
    }
  }

  /**
   * Parse GPS fix type from flag bits
   */
  private static parseGPSFix(fixBits: number): string {
    switch (fixBits) {
      case 0: return 'No Fix';
      case 1: return '2D Fix';
      case 2: return '3D Fix';
      case 3: return '3D Fix';
      default: return 'Unknown';
    }
  }

  /**
   * Detecta o tipo de protocolo baseado nos dados
   */
  private static detectProtocol(data: Buffer): string | null {
    if (data.length < 27) return null;

    // Verificar header 0x4040
    if (data[0] === 0x40 && data[1] === 0x40) {
      // Tentar diferentes offsets para o protocol_id (após device ID + padding)
      const possibleOffsets = [25, 26, 24];
      
      for (const offset of possibleOffsets) {
        if (data.length > offset + 1) {
          const protocolId = data.readUInt16BE(offset);
          if (protocolId === 0x1001) {
            return '0x1001';
          }
          if (protocolId === 0x100a) {
            return '0x100A';
          }
        }
      }
    }
    
    // Para protocolo 0x3400, procurar em posições específicas (não no device ID)
    // Se chegou aqui e não achou 0x1001/0x100A, procurar por 0x3400 em posições não conflitantes
    const hex = data.toString('hex').toLowerCase();
    
    // Verificar 0x3400 apenas após a posição 30 (fora da zona do device ID)
    for (let offset = 30; offset <= 40; offset++) {
      if (offset + 2 <= data.length) {
        const protocolHex = data.subarray(offset, offset + 2).toString('hex');
        if (protocolHex === '3400' || protocolHex === '0034') {
          return '0x3400';
        }
      }
    }
    
    return null;
  }

  /**
   * Decodifica mensagem baseada no protocolo detectado
   */
  static decodeMessage(data: Buffer): DecodedMessage | null {
    const protocol = this.detectProtocol(data);
    
    if (!protocol) {
      return null;
    }
    
    switch (protocol) {
      case '0x1001':
      case '0x100A':
        return this.decode1001Message(data);
      
      case '0x3400':
        return this.decode3400Message(data);
      
      default:
        return null;
    }
  }

  /**
   * 🆕 Decodifica mensagem do protocolo 0x3400
   */
  private static decode3400Message(data: Buffer): DecodedMessage | null {
    try {
      Logger.info('🔍 Tentando decodificar protocolo 0x3400', {
        length: data.length,
        hex: data.toString('hex').substring(0, 100) + '...'
      });

      // Estrutura inicial baseada em padrões comuns
      // Esta será refinada conforme analisamos os dados reais
      const decoded: DecodedMessage = {
        deviceId: this.extract3400DeviceId(data),
        protocolId: '0x3400',
        timestamp: this.extract3400Timestamp(data),
        gps: this.extract3400GPS(data),
        vehicleState: this.extract3400VehicleState(data),
        tripData: this.extract3400TripData(data),
        versions: this.extract3400Versions(data),
        rawData: {
          protocol: '0x3400',
          length: data.length,
          hex: data.toString('hex'),
          detectedAt: new Date().toISOString()
        }
      };

      Logger.info('✅ Protocolo 0x3400 decodificado', { deviceId: decoded.deviceId });
      return decoded;
      
    } catch (error) {
      Logger.error('❌ Erro ao decodificar protocolo 0x3400', { 
        error: error instanceof Error ? error.message : String(error),
        dataLength: data.length 
      });
      return null;
    }
  }

  /**
   * Extrai Device ID do protocolo 0x3400
   */
  private static extract3400DeviceId(data: Buffer): string {
    try {
      // Tentar extrair device ID de posições comuns
      // Posição 4-19 (15 bytes) é comum para device IDs
      if (data.length >= 20) {
        const deviceIdBytes = data.subarray(4, 19);
        const deviceId = deviceIdBytes.toString('ascii').replace(/\0/g, '').trim();
        if (deviceId.length > 0) {
          return deviceId;
        }
      }
      
      // Fallback: usar primeiros bytes como hex
      return data.subarray(0, Math.min(8, data.length)).toString('hex').toUpperCase();
    } catch {
      return 'UNKNOWN_3400_DEVICE';
    }
  }

  /**
   * Extrai timestamp do protocolo 0x3400
   */
  private static extract3400Timestamp(data: Buffer): string {
    try {
      // Assumir timestamp Unix em posição comum (bytes 20-23)
      if (data.length >= 24) {
        const timestamp = data.readUInt32BE(20);
        if (timestamp > 1000000000 && timestamp < 4000000000) {
          return new Date(timestamp * 1000).toISOString();
        }
      }
    } catch {
      // Fallback para timestamp atual
    }
    return new Date().toISOString();
  }

  /**
   * Extrai dados GPS do protocolo 0x3400
   */
  private static extract3400GPS(data: Buffer): any {
    try {
      // Estrutura GPS comum: lat(4) + lon(4) + speed(2) + heading(2) + satellites(1)
      if (data.length >= 40) {
        const gpsOffset = 24; // Posição comum após timestamp
        
        const latitude = data.readInt32BE(gpsOffset) / 1000000; // Comum divisor para coordenadas
        const longitude = data.readInt32BE(gpsOffset + 4) / 1000000;
        const speed = data.readUInt16BE(gpsOffset + 8);
        const heading = data.readUInt16BE(gpsOffset + 10);
        const satellites = data.readUInt8(gpsOffset + 12);
        
        return {
          latitude: latitude,
          longitude: longitude,
          speed: speed,
          heading: heading,
          satellites: satellites,
          accuracy: 'unknown'
        };
      }
    } catch {
      // Fallback GPS
    }
    
    return {
      latitude: 0,
      longitude: 0,
      speed: 0,
      heading: 0,
      satellites: 0,
      accuracy: 'no_fix'
    };
  }

  /**
   * Extrai estado do veículo do protocolo 0x3400
   */
  private static extract3400VehicleState(data: Buffer): any {
    try {
      if (data.length >= 50) {
        const stateOffset = 40; // Posição comum após GPS
        const stateByte = data.readUInt8(stateOffset);
        
        return {
          powerOn: (stateByte & 0x01) !== 0,
          accOn: (stateByte & 0x02) !== 0,
          ignitionOn: (stateByte & 0x04) !== 0,
          gpsValid: (stateByte & 0x08) !== 0,
          charging: (stateByte & 0x10) !== 0,
          stateByte: stateByte
        };
      }
    } catch {
      // Fallback state
    }
    
    return {
      powerOn: false,
      accOn: false,
      ignitionOn: false,
      gpsValid: false,
      charging: false,
      stateByte: 0
    };
  }

  /**
   * Extrai dados de viagem do protocolo 0x3400
   */
  private static extract3400TripData(data: Buffer): any {
    try {
      if (data.length >= 60) {
        const tripOffset = 45;
        const mileage = data.readUInt32BE(tripOffset);
        const fuelLevel = data.readUInt8(tripOffset + 4);
        
        return {
          totalMileage: mileage,
          totalOdometer: Math.round(data.readUInt32BE(tripOffset + 8) / 1.6),
          fuelLevel: fuelLevel,
          tripMileage: 0
        };
      }
    } catch {
      // Fallback trip data
    }
    
    return {
      totalMileage: 0,
      totalOdometer: 0,
      fuelLevel: 0,
      tripMileage: 0
    };
  }

  /**
   * Extrai versões de software/hardware do protocolo 0x3400
   */
  private static extract3400Versions(data: Buffer): any {
    try {
      // Versões geralmente no final do pacote
      const versionOffset = Math.max(0, data.length - 20);
      
      return {
        hardwareVersion: data.subarray(versionOffset, versionOffset + 8).toString('ascii').replace(/\0/g, '').trim() || 'unknown',
        softwareVersion: data.subarray(versionOffset + 8, versionOffset + 16).toString('ascii').replace(/\0/g, '').trim() || 'unknown'
      };
    } catch {
      return {
        hardwareVersion: 'unknown',
        softwareVersion: 'unknown'
      };
    }
  }
} 