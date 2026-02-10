import { ProtocolDecoder } from '../protocols/protocol-decoder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script para debugar o protocolo 0x4005 e encontrar onde estão os dados GPS corretos
 */
class Protocol4005Debugger {
  static debug(): void {
    console.log('🔍 DEBUG PROTOCOLO 0x4005');
    console.log('=====================================\n');

    const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Encontrar leituras do protocolo 0x4005 com GPS
    const protocol4005Readings = data.filter((r: any) => 
      r.protocolId === '0x4005' && 
      r.rawHex && 
      r.latitude && 
      r.longitude && 
      r.latitude !== 0 && 
      r.longitude !== 0
    );

    console.log(`📊 Leituras 0x4005 encontradas: ${protocol4005Readings.length}\n`);

    if (protocol4005Readings.length === 0) {
      console.log('❌ Nenhuma leitura 0x4005 encontrada');
      return;
    }

    // Analisar a primeira leitura em detalhes
    const reading = protocol4005Readings[0];
    console.log(`📋 Analisando leitura ID: ${reading.id}`);
    console.log(`   Device: ${reading.deviceId}`);
    console.log(`   Coordenadas atuais: lat=${reading.latitude.toFixed(6)}, lon=${reading.longitude.toFixed(6)}`);
    console.log(`   Hex length: ${reading.rawHex.length}\n`);

    const buffer = Buffer.from(reading.rawHex, 'hex');
    console.log(`📦 Buffer length: ${buffer.length} bytes\n`);

    // Tentar encontrar GPS em diferentes offsets
    console.log('🔍 Procurando dados GPS em diferentes offsets:\n');

    // Offset atual (usado pelo decodificador)
    const currentOffset = 61; // Offset padrão após device ID + protocol
    
    // Tentar offsets ao redor do offset atual
    for (let offset = currentOffset - 10; offset <= currentOffset + 20; offset++) {
      if (buffer.length < offset + 18) continue;

      try {
        // Tentar ler como Little Endian (como 0x1001)
        const latRawLE = buffer.readInt32LE(offset);
        const lonRawLE = buffer.readInt32LE(offset + 4);
        const latLE = -latRawLE / 3600000;
        const lonLE = -lonRawLE / 3600000;

        // Verificar se está no Brasil
        if (latLE >= -35 && latLE <= 5 && lonLE >= -75 && lonLE <= -30) {
          console.log(`   ✅ Offset ${offset} (LE): lat=${latLE.toFixed(6)}, lon=${lonLE.toFixed(6)}`);
        }

        // Tentar ler como Big Endian
        const latRawBE = buffer.readInt32BE(offset);
        const lonRawBE = buffer.readInt32BE(offset + 4);
        const latBE = -latRawBE / 3600000;
        const lonBE = -lonRawBE / 3600000;

        if (latBE >= -35 && latBE <= 5 && lonBE >= -75 && lonBE <= -30) {
          console.log(`   ✅ Offset ${offset} (BE): lat=${latBE.toFixed(6)}, lon=${lonBE.toFixed(6)}`);
        }

        // Tentar sem sinal negativo
        const latLEPos = latRawLE / 3600000;
        const lonLEPos = lonRawLE / 3600000;
        if (latLEPos >= -35 && latLEPos <= 5 && lonLEPos >= -75 && lonLEPos <= -30) {
          console.log(`   ✅ Offset ${offset} (LE Pos): lat=${latLEPos.toFixed(6)}, lon=${lonLEPos.toFixed(6)}`);
        }

        const latBEPos = latRawBE / 3600000;
        const lonBEPos = lonRawBE / 3600000;
        if (latBEPos >= -35 && latBEPos <= 5 && lonBEPos >= -75 && lonBEPos <= -30) {
          console.log(`   ✅ Offset ${offset} (BE Pos): lat=${latBEPos.toFixed(6)}, lon=${lonBEPos.toFixed(6)}`);
        }

      } catch (e) {
        // Ignorar erros
      }
    }

    console.log('\n📊 Hex dump do buffer (offset 50-100):');
    const hexDump = buffer.slice(50, Math.min(100, buffer.length));
    console.log(hexDump.toString('hex'));
    console.log('');

    // Verificar se há múltiplas mensagens no buffer
    console.log('🔍 Verificando se há múltiplas mensagens no buffer:');
    let messageCount = 0;
    for (let i = 0; i < buffer.length - 4; i++) {
      if (buffer[i] === 0x40 && buffer[i + 1] === 0x40) {
        messageCount++;
        const length = buffer.readUInt16BE(i + 2);
        console.log(`   Mensagem ${messageCount} encontrada em offset ${i}, length: ${length}`);
      }
    }
    console.log('');

    // Se houver múltiplas mensagens, tentar decodificar cada uma
    if (messageCount > 1) {
      console.log('🔄 Tentando decodificar cada mensagem separadamente:\n');
      let offset = 0;
      let msgNum = 1;
      
      while (offset < buffer.length - 4) {
        if (buffer[offset] === 0x40 && buffer[offset + 1] === 0x40) {
          const length = buffer.readUInt16BE(offset + 2);
          const messageBuffer = buffer.slice(offset, offset + length);
          
          console.log(`   Mensagem ${msgNum} (offset ${offset}, length ${length}):`);
          try {
            const decoded = ProtocolDecoder.decodeMessage(messageBuffer);
            if (decoded && decoded.gps && decoded.gps.latitude !== 0 && decoded.gps.longitude !== 0) {
              console.log(`      ✅ GPS encontrado: lat=${decoded.gps.latitude.toFixed(6)}, lon=${decoded.gps.longitude.toFixed(6)}`);
              console.log(`      Protocolo: ${decoded.protocolId}`);
            } else {
              console.log(`      ❌ Sem GPS válido`);
            }
          } catch (e) {
            console.log(`      ❌ Erro ao decodificar: ${e}`);
          }
          console.log('');
          
          offset += length;
          msgNum++;
        } else {
          offset++;
        }
      }
    }
  }
}

// Run if executed directly
if (require.main === module) {
  Protocol4005Debugger.debug();
}

export { Protocol4005Debugger };
