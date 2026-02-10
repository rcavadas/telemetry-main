import { ProtocolDecoder } from '../protocols/protocol-decoder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Verificar a segunda mensagem no buffer do protocolo 0x4005
 */
class SecondMessageChecker {
  static check(): void {
    console.log('🔍 VERIFICANDO SEGUNDA MENSAGEM NO BUFFER');
    console.log('=====================================\n');

    const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    const protocol4005Readings = data.filter((r: any) => 
      r.protocolId === '0x4005' && 
      r.rawHex && 
      r.latitude && 
      r.longitude && 
      r.latitude !== 0 && 
      r.longitude !== 0
    );

    if (protocol4005Readings.length === 0) {
      console.log('❌ Nenhuma leitura 0x4005 encontrada');
      return;
    }

    const reading = protocol4005Readings[0];
    const buffer = Buffer.from(reading.rawHex, 'hex');

    console.log(`📋 Buffer total: ${buffer.length} bytes\n`);

    // Encontrar todas as mensagens no buffer
    let offset = 0;
    let msgNum = 1;
    
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0x40 && buffer[offset + 1] === 0x40) {
        const length = buffer.readUInt16BE(offset + 2);
        
        if (offset + length > buffer.length) {
          console.log(`⚠️  Mensagem ${msgNum} em offset ${offset}: length ${length} excede buffer (${buffer.length})`);
          break;
        }

        const messageBuffer = buffer.slice(offset, offset + length);
        
        console.log(`\n📦 Mensagem ${msgNum}:`);
        console.log(`   Offset: ${offset}`);
        console.log(`   Length: ${length}`);
        console.log(`   Hex preview: ${messageBuffer.toString('hex').substring(0, 100)}...\n`);
        
        try {
          const decoded = ProtocolDecoder.decodeMessage(messageBuffer);
          if (decoded) {
            console.log(`   ✅ Decodificada:`);
            console.log(`      Device ID: ${decoded.deviceId}`);
            console.log(`      Protocolo: ${decoded.protocolId}`);
            console.log(`      Timestamp: ${decoded.timestamp}`);
            
            if (decoded.gps && decoded.gps.latitude !== 0 && decoded.gps.longitude !== 0) {
              console.log(`      📍 GPS: lat=${decoded.gps.latitude.toFixed(6)}, lon=${decoded.gps.longitude.toFixed(6)}`);
              console.log(`      ⚡ Velocidade: ${decoded.gps.speedKmH.toFixed(1)} km/h`);
              console.log(`      🛰️  Satélites: ${decoded.gps.satellites}`);
              
              // Verificar se está no Rio de Janeiro
              if (decoded.gps.latitude >= -23.5 && decoded.gps.latitude <= -22.5 &&
                  decoded.gps.longitude >= -44 && decoded.gps.longitude <= -42) {
                console.log(`      ✅ COORDENADAS NO RIO DE JANEIRO!`);
              }
            } else {
              console.log(`      ❌ Sem GPS válido`);
            }
          } else {
            console.log(`   ❌ Não foi possível decodificar`);
          }
        } catch (e) {
          console.log(`   ❌ Erro: ${e}`);
        }
        
        offset += length;
        msgNum++;
      } else {
        offset++;
      }
    }
  }
}

// Run if executed directly
if (require.main === module) {
  SecondMessageChecker.check();
}

export { SecondMessageChecker };
