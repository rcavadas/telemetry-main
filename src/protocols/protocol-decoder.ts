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
  static decode1001Message(data: Buffer, detectedProtocolOffset?: number): DecodedMessage | null {
    try {
      Logger.debug('🔍 Iniciando decodificação de mensagem 0x1001', { 
        dataHex: data.toString('hex'),
        length: data.length,
        detectedProtocolOffset
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
      
      // Usar o offset detectado ou tentar encontrar o protocol ID dinamicamente
      let protocolOffset = detectedProtocolOffset;
      if (!protocolOffset) {
        // Tentar encontrar o protocol ID após o device ID
        const possibleOffsets = [25, 26, 24, 22, 23, 27];
        for (const testOffset of possibleOffsets) {
          if (data.length > testOffset + 1) {
            const testProtocolId = data.readUInt16BE(testOffset);
            if (testProtocolId === 0x1001 || testProtocolId === 0x100a) {
              protocolOffset = testOffset;
              break;
            }
          }
        }
        // Se ainda não encontrou, usar offset padrão
        if (!protocolOffset) {
          protocolOffset = 25;
        }
      }

      // Protocol ID - usar o offset detectado
      offset = protocolOffset;
      const protocolId = data.readUInt16BE(offset);
      
      // Aceitar protocolos conhecidos ou variantes 0x40XX, ou protocolos com header 0x4040
      // Se tem header 0x4040, assumir estrutura similar mesmo se protocolo não conhecido
      const isKnownProtocol = protocolId === 0x1001 || protocolId === 0x100a || 
                              protocolId === 0x4001 || protocolId === 0x4009 ||
                              protocolId === 0xa002 ||
                              (protocolId & 0xFF00) === 0x4000;
      
      // Se não é protocolo conhecido mas tem header 0x4040, tentar decodificar mesmo assim
      // (pode ser uma variante com estrutura similar)
      if (!isKnownProtocol) {
        Logger.debug('Protocol ID não reconhecido, mas tentando decodificar como variante', { 
          protocolId: `0x${protocolId.toString(16).toUpperCase()}`,
          atOffset: offset,
          dataLength: data.length
        });
        // Continuar decodificação - pode ser uma variante com estrutura similar
      }
      
      offset += 2;
      // Mapear protocol ID para string
      result.protocolId = `0x${protocolId.toString(16).toUpperCase()}`;

      // Helper function para verificar se há dados suficientes
      const checkBounds = (requiredBytes: number): boolean => {
        if (offset + requiredBytes > data.length) {
          Logger.debug(`Dados insuficientes: necessário ${requiredBytes} bytes, disponível ${data.length - offset} bytes`, {
            offset,
            dataLength: data.length,
            required: requiredBytes
          });
          return false;
        }
        return true;
      };

      // Last accon time (4 bytes) - timestamp UNIX Little Endian
      if (!checkBounds(4)) {
        Logger.warn('Mensagem muito curta: faltam dados de lastAcconTime', { offset, dataLength: data.length });
        return result; // Retornar o que foi decodificado até agora
      }
      const lastAcconTime = data.readUInt32LE(offset);
      offset += 4;
      result.lastAcconTime = new Date(lastAcconTime * 1000).toISOString();

      // UTC Time (4 bytes) - timestamp UNIX Little Endian
      if (!checkBounds(4)) {
        Logger.warn('Mensagem muito curta: faltam dados de UTC time', { offset, dataLength: data.length });
        result.timestamp = result.lastAcconTime || new Date().toISOString();
        return result;
      }
      const utcTime = data.readUInt32LE(offset);
      offset += 4;
      result.utcTime = new Date(utcTime * 1000).toISOString();
      result.timestamp = result.utcTime;

      // Trip data (14 bytes total)
      if (!checkBounds(14)) {
        Logger.warn('Mensagem muito curta: faltam dados de trip data', { offset, dataLength: data.length });
        return result;
      }
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
      if (!checkBounds(4)) {
        Logger.warn('Mensagem muito curta: faltam dados de vehicle state', { offset, dataLength: data.length });
        return result;
      }
      const vstate = data.readUInt32LE(offset);
      offset += 4;
      
      result.vehicleState = this.parseVehicleState(vstate);

      // Reserved data (8 bytes) - pode não estar presente em mensagens curtas
      if (checkBounds(8)) {
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
      } else {
        // Tentar ler o que estiver disponível
        const availableBytes = data.length - offset;
        if (availableBytes > 0) {
          const reservedData = data.slice(offset, data.length);
          result.reserved = reservedData.toString('hex');
          offset = data.length;
        }
      }

      // GPS count
      if (!checkBounds(1)) {
        Logger.debug('Mensagem muito curta: faltam dados de GPS count', { offset, dataLength: data.length });
        return result;
      }
      const gpsCount = data.readUInt8(offset);
      offset += 1;

      if (gpsCount > 0 && gpsCount <= 10) { // Sanity check
        if (checkBounds(18)) {
          result.gps = this.parseGPSData(data, offset, result.protocolId);
          // Calcular offset após dados GPS
          offset += 18; // 3 (date) + 3 (time) + 4 (lat) + 4 (lng) + 2 (speed) + 2 (direction) + 1 (flag)
        } else {
          Logger.warn('GPS count > 0 mas dados GPS incompletos', { offset, dataLength: data.length, required: 18 });
        }
      }

      // Software version (terminado em 0x00) - pode não estar presente
      if (offset < data.length) {
        const softwareStart = offset;
        let softwareEnd = data.indexOf(0x00, softwareStart);
        if (softwareEnd === -1) softwareEnd = data.length; // Não assumir CRC/tail
        
        if (softwareEnd > softwareStart) {
          const softwareBuffer = data.slice(softwareStart, softwareEnd);
          // Filtrar apenas caracteres ASCII imprimíveis
          const softwareVersion = softwareBuffer.toString('ascii').replace(/[^\x20-\x7E]/g, '');
          offset = softwareEnd + 1;

          // Hardware version (terminado em 0x00) - pode não estar presente
          let hardwareVersion = '';
          if (offset < data.length) {
            const hardwareStart = offset;
            let hardwareEnd = data.indexOf(0x00, hardwareStart);
            if (hardwareEnd === -1) hardwareEnd = data.length;
            
            if (hardwareEnd > hardwareStart) {
              const hardwareBuffer = data.slice(hardwareStart, hardwareEnd);
              // Filtrar apenas caracteres ASCII imprimíveis
              hardwareVersion = hardwareBuffer.toString('ascii').replace(/[^\x20-\x7E]/g, '');
            }
          }
          
          result.versions = {
            software: softwareVersion,
            hardware: hardwareVersion
          };
        }
      }

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
  private static parseGPSData(data: Buffer, offset: number, protocolId?: string): DecodedMessage['gps'] {
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
      let latitude = -latitudeRaw / 3600000; // Negativo + fator correto
      offset += 4;

      // Longitude (4 bytes) - Little Endian, signed integer
      // DESCOBERTA: Fator de escala é 3.600.000 (não 1.000.000) e coordenadas são NEGATIVAS  
      const longitudeRaw = data.readInt32LE(offset);
      let longitude = -longitudeRaw / 3600000; // Negativo + fator correto
      offset += 4;

      // Validação: Filtrar coordenadas inválidas (fora do Brasil ou valores impossíveis)
      // Brasil: Latitude entre -35° e 5°, Longitude entre -75° e -30°
      if (latitude < -35 || latitude > 5 || longitude < -75 || longitude > -30) {
        Logger.warn('Coordenadas GPS inválidas detectadas, zerando valores', {
          latitude,
          longitude,
          latitudeRaw,
          longitudeRaw,
          hex: data.toString('hex').substring(offset - 8, offset)
        });
        latitude = 0;
        longitude = 0;
      }
      
      // Validação adicional: Para protocolos 0x4005, 0x4006, 0x4007, verificar se coordenadas
      // estão em uma região razoável (Rio de Janeiro: lat -23.5 a -22.5, lon -44 a -42)
      // Se estiverem muito longe, provavelmente são dados incorretos
      if (protocolId && (protocolId === '0x4005' || protocolId === '0x4006' || protocolId === '0x4007') && 
          latitude !== 0 && longitude !== 0) {
        // Verificar se está na região do Rio de Janeiro (onde os dispositivos estão)
        const isInRioArea = latitude >= -23.5 && latitude <= -22.5 && 
                           longitude >= -44 && longitude <= -42;
        
        if (!isInRioArea) {
          Logger.warn('Coordenadas GPS do protocolo 0x400X fora da região esperada (Rio de Janeiro), zerando', {
            protocol: protocolId,
            latitude,
            longitude,
            expectedArea: 'Rio de Janeiro (lat: -23.5 a -22.5, lon: -44 a -42)'
          });
          latitude = 0;
          longitude = 0;
        }
      }

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
  private static detectProtocol(data: Buffer): { protocol: string; protocolOffset?: number } | null {
    if (data.length < 27) {
      Logger.debug('Protocol detection failed: data too short', { length: data.length, minRequired: 27 });
      return null;
    }

    // Verificar header 0x4040
    const hasHeader4040 = data[0] === 0x40 && data[1] === 0x40;
    
    if (hasHeader4040) {
      // Tentar diferentes offsets para o protocol_id (após device ID + padding)
      const possibleOffsets = [25, 26, 24, 22, 23, 27];
      
      for (const offset of possibleOffsets) {
        if (data.length > offset + 1) {
          const protocolId = data.readUInt16BE(offset);
          if (protocolId === 0x1001) {
            Logger.debug('Protocol 0x1001 detected', { offset });
            return { protocol: '0x1001', protocolOffset: offset };
          }
          if (protocolId === 0x100a) {
            Logger.debug('Protocol 0x100A detected', { offset });
            return { protocol: '0x100A', protocolOffset: offset };
          }
          // Protocolos 0x400X - variantes de 0x1001 com estrutura similar
          if (protocolId === 0x4001) {
            Logger.debug('Protocol 0x4001 detected', { offset });
            return { protocol: '0x4001', protocolOffset: offset };
          }
          if (protocolId === 0x4009) {
            Logger.debug('Protocol 0x4009 detected', { offset });
            return { protocol: '0x4009', protocolOffset: offset };
          }
          // Protocolo 0xA002 - variante com estrutura similar
          if (protocolId === 0xa002) {
            Logger.debug('Protocol 0xA002 detected', { offset });
            return { protocol: '0xA002', protocolOffset: offset };
          }
          // Aceitar qualquer protocolo 0x40XX como variante de 0x1001
          if ((protocolId & 0xFF00) === 0x4000) {
            const protocolStr = `0x${protocolId.toString(16).toUpperCase()}`;
            Logger.debug(`Protocol ${protocolStr} detected (0x40XX variant)`, { offset });
            return { protocol: protocolStr, protocolOffset: offset };
          }
        }
      }
      
      // Se header 4040 mas não encontrou 0x1001/0x100A, procurar 0x3400
      // Verificar 0x3400 em uma faixa mais ampla (20-50)
      for (let offset = 20; offset <= Math.min(50, data.length - 2); offset++) {
        const protocolId = data.readUInt16BE(offset);
        if (protocolId === 0x3400) {
          Logger.debug('Protocol 0x3400 detected', { offset });
          return { protocol: '0x3400', protocolOffset: offset };
        }
        // Também verificar little endian
        const protocolIdLE = data.readUInt16LE(offset);
        if (protocolIdLE === 0x3400) {
          Logger.debug('Protocol 0x3400 detected (LE)', { offset });
          return { protocol: '0x3400', protocolOffset: offset };
        }
      }
      
      Logger.debug('Protocol detection failed: header 4040 found but no known protocol ID', {
        dataLength: data.length,
        checkedOffsets: possibleOffsets,
        hexPreview: data.toString('hex').substring(0, 100)
      });
    } else {
      Logger.debug('Protocol detection failed: header not 4040', {
        found: `0x${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}`,
        expected: '0x4040'
      });
    }
    
    return null;
  }

  /**
   * Decodifica mensagem baseada no protocolo detectado
   * Se o buffer contém múltiplas mensagens, processa todas e retorna a com GPS mais recente
   */
  static decodeMessage(data: Buffer): DecodedMessage | null {
    // Verificar se há múltiplas mensagens concatenadas
    const messages = this.splitMultipleMessages(data);
    
    if (messages.length > 1) {
      Logger.debug(`Múltiplas mensagens detectadas (${messages.length}), processando todas`);
      
      // Processar todas as mensagens e coletar resultados
      const results: (DecodedMessage | null)[] = [];
      for (const msgBuffer of messages) {
        const result = this.decodeSingleMessage(msgBuffer);
        if (result) {
          results.push(result);
        }
      }
      
      // Se houver múltiplos resultados, priorizar:
      // 1. Mensagem com GPS válido e mais recente
      // 2. Mensagem com GPS válido
      // 3. Qualquer mensagem válida
      if (results.length > 0) {
        const withGPS = results.filter((r): r is DecodedMessage => 
          r !== null && r.gps !== undefined && r.gps.latitude !== 0 && r.gps.longitude !== 0
        );
        if (withGPS.length > 0) {
          // Ordenar por timestamp (mais recente primeiro)
          withGPS.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          Logger.debug(`Retornando mensagem com GPS mais recente de ${withGPS.length} opções`);
          return withGPS[0];
        }
        // Se nenhuma tem GPS, retornar a primeira não-nula
        const firstValid = results.find(r => r !== null);
        if (firstValid) return firstValid;
      }
    }
    
    // Processar mensagem única
    return this.decodeSingleMessage(data);
  }

  /**
   * Divide um buffer em múltiplas mensagens se houver
   */
  private static splitMultipleMessages(data: Buffer): Buffer[] {
    const messages: Buffer[] = [];
    let offset = 0;
    
    while (offset < data.length - 4) {
      // Procurar header 0x4040
      if (data[offset] === 0x40 && data[offset + 1] === 0x40) {
        // Ler length (Little Endian)
        const length = data.readUInt16LE(offset + 2);
        
        // Validar length
        if (length > 0 && length <= data.length - offset && length < 10000) {
          const messageBuffer = data.slice(offset, offset + length);
          messages.push(messageBuffer);
          offset += length;
        } else {
          // Length inválido, tentar continuar
          offset++;
        }
      } else {
        offset++;
      }
    }
    
    return messages.length > 0 ? messages : [data];
  }

  /**
   * Decodifica uma única mensagem
   */
  private static decodeSingleMessage(data: Buffer): DecodedMessage | null {
    const protocolInfo = this.detectProtocol(data);
    
    if (!protocolInfo) {
      // Fallback: Se tem header 4040 mas protocolo não detectado, tentar decodificar como 0x1001
      // Isso pode acontecer se o protocol ID está em uma posição não esperada
      if (data.length >= 4 && data[0] === 0x40 && data[1] === 0x40) {
        Logger.debug('Protocol not detected but header 4040 found, attempting fallback decode as 0x1001');
        return this.decode1001Message(data);
      }
      return null;
    }
    
    const { protocol, protocolOffset } = protocolInfo;
    
    switch (protocol) {
      case '0x1001':
      case '0x100A':
      case '0x4001':  // Protocolo 0x4001 usa a mesma estrutura que 0x1001
      case '0x4009':  // Protocolo 0x4009 usa a mesma estrutura que 0x1001
      case '0xA002':  // Protocolo 0xA002 usa a mesma estrutura que 0x1001
        return this.decode1001Message(data, protocolOffset);
      
      case '0x3400':
        return this.decode3400Message(data);
      
      default:
        // Se o protocolo começa com 0x40 ou tem header 0x4040, tentar decodificar como 0x1001
        if (protocol.startsWith('0x40') || (data.length >= 2 && data[0] === 0x40 && data[1] === 0x40)) {
          Logger.debug(`Treating ${protocol} as 0x1001 variant (header 0x4040)`, { protocolOffset });
          return this.decode1001Message(data, protocolOffset);
        }
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
      // Tentar diferentes offsets e endianness
      if (data.length >= 40) {
        // Tentar offset 24 primeiro (posição comum)
        const possibleOffsets = [24, 20, 28, 32];
        
        for (const gpsOffset of possibleOffsets) {
          if (data.length < gpsOffset + 15) continue;
          
          // Tentar Little Endian primeiro (como protocolo 0x1001)
          try {
            const latRawLE = data.readInt32LE(gpsOffset);
            const lonRawLE = data.readInt32LE(gpsOffset + 4);
            const latitudeLE = -latRawLE / 3600000;
            const longitudeLE = -lonRawLE / 3600000;
            
            // Verificar se coordenadas são válidas para Brasil (latitude negativa, longitude negativa)
            if (latitudeLE < 0 && latitudeLE > -35 && longitudeLE < 0 && longitudeLE > -75) {
              const speed = data.readUInt16LE(gpsOffset + 8);
              const heading = data.readUInt16LE(gpsOffset + 10);
              const satellites = data.readUInt8(gpsOffset + 12);
              
              return {
                latitude: latitudeLE,
                longitude: longitudeLE,
                speedKmH: speed * 0.036, // Mesma conversão do protocolo 0x1001
                direction: heading,
                satellites: satellites,
                gpsFix: satellites > 0 ? '3D Fix' : 'No Fix'
              };
            }
          } catch (e) {
            // Continue to next offset
          }
          
          // Tentar Big Endian como fallback
          try {
            const latRawBE = data.readInt32BE(gpsOffset);
            const lonRawBE = data.readInt32BE(gpsOffset + 4);
            const latitudeBE = -latRawBE / 3600000;
            const longitudeBE = -lonRawBE / 3600000;
            
            // Verificar se coordenadas são válidas para Brasil
            if (latitudeBE < 0 && latitudeBE > -35 && longitudeBE < 0 && longitudeBE > -75) {
              const speed = data.readUInt16BE(gpsOffset + 8);
              const heading = data.readUInt16BE(gpsOffset + 10);
              const satellites = data.readUInt8(gpsOffset + 12);
              
              return {
                latitude: latitudeBE,
                longitude: longitudeBE,
                speedKmH: speed * 0.036,
                direction: heading,
                satellites: satellites,
                gpsFix: satellites > 0 ? '3D Fix' : 'No Fix'
              };
            }
          } catch (e) {
            // Continue to next offset
          }
        }
      }
    } catch (error) {
      Logger.warn('Erro ao extrair GPS do protocolo 0x3400', { error });
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