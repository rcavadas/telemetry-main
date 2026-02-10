import * as fs from 'fs';
import * as path from 'path';
import { ProtocolDecoder } from '../protocols/protocol-decoder';

/**
 * Reprocessa todas as leituras de um dispositivo específico
 */
class DeviceReprocessor {
  static reprocess(deviceId: string): void {
    console.log(`🔄 REPROCESSANDO DISPOSITIVO: ${deviceId}`);
    console.log('=====================================\n');

    const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Arquivo readings.json não encontrado');
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const deviceReadings = data.filter((r: any) => r.deviceId === deviceId && r.rawHex);

      console.log(`📊 Total de leituras encontradas: ${deviceReadings.length}\n`);

      let updated = 0;
      let errors = 0;

      for (const reading of deviceReadings) {
        try {
          const buffer = Buffer.from(reading.rawHex, 'hex');
          const decoded = ProtocolDecoder.decodeMessage(buffer);

          if (decoded && decoded.gps && decoded.gps.latitude !== 0 && decoded.gps.longitude !== 0) {
            const oldLat = reading.latitude || 0;
            const oldLon = reading.longitude || 0;
            const newLat = decoded.gps.latitude;
            const newLon = decoded.gps.longitude;

            const latDiff = Math.abs(oldLat - newLat);
            const lonDiff = Math.abs(oldLon - newLon);

            if (latDiff > 0.001 || lonDiff > 0.001 || oldLat === 0 || oldLon === 0) {
              console.log(`🔧 Atualizando leitura ${reading.id}:`);
              console.log(`   Antes: lat=${oldLat.toFixed(6)}, lon=${oldLon.toFixed(6)}`);
              console.log(`   Depois: lat=${newLat.toFixed(6)}, lon=${newLon.toFixed(6)}`);
              console.log(`   Protocolo: ${decoded.protocolId}\n`);

              reading.latitude = newLat;
              reading.longitude = newLon;
              reading.protocolId = decoded.protocolId;
              reading.timestamp = decoded.timestamp;
              if (decoded.gps.speedKmH !== undefined) reading.speedKmH = decoded.gps.speedKmH;
              if (decoded.gps.direction !== undefined) reading.direction = decoded.gps.direction;
              if (decoded.gps.satellites !== undefined) reading.satellites = decoded.gps.satellites;
              reading.reprocessedAt = new Date().toISOString();

              updated++;
            }
          }
        } catch (error) {
          errors++;
          console.error(`❌ Erro ao reprocessar leitura ${reading.id}:`, error);
        }
      }

      console.log('\n=====================================');
      console.log(`✅ Reprocessamento concluído:`);
      console.log(`   Total processado: ${deviceReadings.length}`);
      console.log(`   Atualizadas: ${updated}`);
      console.log(`   Erros: ${errors}\n`);

      if (updated > 0) {
        // Create backup
        const backupPath = dbPath + `.backup.${Date.now()}`;
        fs.copyFileSync(dbPath, backupPath);
        console.log(`💾 Backup criado: ${backupPath}\n`);

        // Save updated data
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ ${updated} leituras atualizadas no banco de dados\n`);
      } else {
        console.log('✅ Nenhuma atualização necessária\n');
      }

    } catch (error) {
      console.error('❌ Erro ao reprocessar:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const deviceId = process.argv[2] || '218LSAB2025000003';
  DeviceReprocessor.reprocess(deviceId);
}

export { DeviceReprocessor };
