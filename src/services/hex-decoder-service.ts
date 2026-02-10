import { ProtocolDecoder, DecodedMessage } from '../protocols/protocol-decoder';
import { Logger } from '../utils/logger';

export interface HexDecodeResult {
  success: boolean;
  decoded?: DecodedMessage;
  analysis?: {
    header: string;
    length: number;
    deviceId: string;
    protocol?: string;
  };
  error?: string;
  timestamp: string;
  savedToDatabase?: boolean;
  readingId?: number;
}

export class HexDecoderService {
  
  /**
   * Decodifica uma string hexadecimal e retorna resultado detalhado
   */
  static decodeHex(hexString: string): HexDecodeResult {
    const timestamp = new Date().toISOString();
    
    try {
      // Limpar o hex (remover espaços, quebras de linha, etc.)
      const cleanHex = hexString.replace(/[\s\n\r]/g, '');
      
      if (!cleanHex || cleanHex.length === 0) {
        return {
          success: false,
          error: 'Hex string vazia ou inválida',
          timestamp
        };
      }
      
      if (cleanHex.length % 2 !== 0) {
        return {
          success: false,
          error: 'Hex string deve ter número par de caracteres',
          timestamp
        };
      }
      
      // Validar se é hexadecimal válido
      if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
        return {
          success: false,
          error: 'String contém caracteres não-hexadecimais',
          timestamp
        };
      }
      
      // Converter para Buffer
      const buffer = Buffer.from(cleanHex, 'hex');
      
      if (buffer.length < 4) {
        return {
          success: false,
          error: 'Dados muito curtos para análise (mínimo 4 bytes)',
          timestamp
        };
      }
      
      // Análise inicial
      const analysis = {
        header: buffer.subarray(0, 2).toString('hex').toUpperCase(),
        length: buffer.length >= 4 ? buffer.readUInt16LE(2) : 0,
        deviceId: buffer.length >= 22 ? buffer.subarray(5, 22).toString('ascii').replace(/\0/g, '') : '',
        protocol: buffer.length >= 27 ? `0x${buffer.readUInt16BE(25).toString(16)}` : undefined
      };
      
      // Tentar decodificar com ProtocolDecoder
      const decoded = ProtocolDecoder.decodeMessage(buffer);
      
      if (decoded) {
        Logger.info('✅ Hex decodificado com sucesso via API', {
          deviceId: decoded.deviceId,
          protocol: decoded.protocolId,
          dataSize: buffer.length
        });
        
        return {
          success: true,
          decoded,
          analysis,
          timestamp
        };
      } else {
        // Diagnóstico detalhado para ajudar a identificar o problema
        const diagnostic: any = {
          hexLength: cleanHex.length,
          bufferSize: buffer.length,
          header: analysis.header,
          expectedHeader: '4040'
        };
        
        // Verificar se o header está correto
        if (analysis.header !== '4040') {
          diagnostic.headerMismatch = true;
        }
        
        // Verificar protocolos possíveis nas posições esperadas
        if (buffer.length >= 27) {
          const protocolAt25 = buffer.length > 26 ? buffer.readUInt16BE(25).toString(16).toUpperCase() : 'N/A';
          const protocolAt26 = buffer.length > 27 ? buffer.readUInt16BE(26).toString(16).toUpperCase() : 'N/A';
          const protocolAt24 = buffer.length > 25 ? buffer.readUInt16BE(24).toString(16).toUpperCase() : 'N/A';
          
          diagnostic.protocolChecks = {
            atOffset25: `0x${protocolAt25}`,
            atOffset26: `0x${protocolAt26}`,
            atOffset24: `0x${protocolAt24}`,
            expected: ['0x1001', '0x100A', '0x4001', '0x4009', '0xA002', '0x40XX (variants)', '0x3400', 'any with 0x4040 header']
          };
          
          // Verificar se há 0x3400 entre offsets 30-40
          const protocol3400Found = [];
          for (let offset = 30; offset <= Math.min(40, buffer.length - 2); offset++) {
            const protocolHex = buffer.subarray(offset, offset + 2).toString('hex').toUpperCase();
            if (protocolHex === '3400' || protocolHex === '0034') {
              protocol3400Found.push({ offset, hex: protocolHex });
            }
          }
          if (protocol3400Found.length > 0) {
            diagnostic.protocol3400Found = protocol3400Found;
          }
        }
        
        // Adicionar preview dos primeiros bytes para debug
        diagnostic.hexPreview = cleanHex.substring(0, 100) + (cleanHex.length > 100 ? '...' : '');
        
        Logger.warn('⚠️ Falha na decodificação via API', diagnostic);
        
        return {
          success: false,
          analysis,
          error: 'Não foi possível decodificar os dados. Possíveis causas: header inválido, protocolo não suportado, dados corrompidos. Verifique os logs para detalhes do diagnóstico.',
          timestamp
        };
      }
      
    } catch (error) {
      Logger.error('❌ Erro ao decodificar hex via API', { 
        error: error instanceof Error ? error.message : String(error),
        hexInput: hexString.substring(0, 100) + (hexString.length > 100 ? '...' : '')
      });
      
      return {
        success: false,
        error: `Erro ao processar hex: ${error instanceof Error ? error.message : String(error)}`,
        timestamp
      };
    }
  }
  
  /**
   * Decodifica e formata resultado para exibição em console/log
   */
  static decodeHexFormatted(hexString: string): string {
    const result = this.decodeHex(hexString);
    
    let output = '🔍 DECODIFICADOR HEXADECIMAL OBD\n';
    output += '='.repeat(50) + '\n';
    
    if (result.success && result.decoded) {
      const decoded = result.decoded;
      
      output += `🆔 Device ID: ${decoded.deviceId}\n`;
      output += `📡 Protocolo: ${decoded.protocolId}\n`;
      output += `⏰ Timestamp: ${decoded.timestamp}\n`;
      
      if (decoded.gps) {
        output += '\n🗺️  DADOS GPS:\n';
        output += `├─ Latitude: ${decoded.gps.latitude}°\n`;
        output += `├─ Longitude: ${decoded.gps.longitude}°\n`;
        output += `├─ Velocidade: ${decoded.gps.speedKmH} km/h\n`;
        output += `├─ Direção: ${decoded.gps.direction}°\n`;
        output += `├─ Satélites: ${decoded.gps.satellites}\n`;
        output += `└─ Fix GPS: ${decoded.gps.gpsFix}\n`;
      }
      
      if (decoded.tripData) {
        output += '\n🛣️  DADOS DE VIAGEM:\n';
        output += `├─ Total (milhas): ${decoded.tripData?.totalMileage || 0} mi\n`;
        output += `├─ Hodômetro (km): ${decoded.tripData?.totalOdometer || 0} km\n`;
        output += `├─ Km viagem: ${decoded.tripData?.currentMileage || 0} km\n`;
        output += `├─ Combustível total: ${decoded.tripData?.totalFuel || 0}\n`;
        output += `└─ Combustível viagem: ${decoded.tripData?.currentFuel || 0}\n`;
      }
      
      if (decoded.vehicleState) {
        output += '\n🚗 ESTADO DO VEÍCULO:\n';
        output += `├─ Power: ${decoded.vehicleState.powerOn ? 'ON' : 'OFF'}\n`;
        output += `├─ ACC: ${decoded.vehicleState.accOn ? 'ON' : 'OFF'}\n`;
        output += `└─ Ignição: ${decoded.vehicleState.ignitionOn ? 'ON' : 'OFF'}\n`;
      }
      
      if (decoded.voltage) {
        output += `\n🔋 Tensão: ${decoded.voltage}V\n`;
      }
      
      if (decoded.versions) {
        output += '\n💻 VERSÕES:\n';
        output += `├─ Software: ${decoded.versions.software}\n`;
        output += `└─ Hardware: ${decoded.versions.hardware}\n`;
      }
      
    } else {
      output += '❌ FALHA NA DECODIFICAÇÃO\n';
      output += `└─ ${result.error}\n`;
      
      if (result.analysis) {
        output += '\n🔍 ANÁLISE DOS DADOS:\n';
        output += `├─ Header: ${result.analysis.header}\n`;
        output += `├─ Tamanho: ${result.analysis.length} bytes\n`;
        output += `├─ Device ID detectado: ${result.analysis.deviceId || 'N/A'}\n`;
        output += `└─ Protocolo detectado: ${result.analysis.protocol || 'N/A'}\n`;
      }
    }
    
    output += '\n' + '='.repeat(50);
    
    return output;
  }
} 