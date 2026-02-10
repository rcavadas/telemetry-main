import * as fs from 'fs';
import * as path from 'path';
import { DatabaseManager } from '../models/database';
import { ProtocolDecoder } from '../protocols/protocol-decoder';
import { Logger } from '../utils/logger';

/**
 * Script para reprocessar todas as coordenadas GPS do banco de dados
 * Aplica a fórmula correta: -latitudeRaw / 3600000 para protocolos 0x1001/0x100A/0x400X
 */
class GPSReprocessor {
  static reprocessAllGPS(): void {
    console.log('🔄 REPROCESSANDO COORDENADAS GPS');
    console.log('=====================================\n');

    try {
      const dbManager = DatabaseManager.getInstance();
      // Get all readings by loading the data file directly
      const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');
      let allReadings: any[] = [];
      
      if (fs.existsSync(dbPath)) {
        allReadings = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      } else {
        console.error('❌ Arquivo readings.json não encontrado');
        return;
      }

      console.log(`📊 Total de leituras encontradas: ${allReadings.length}\n`);

      let reprocessed = 0;
      let fixed = 0;
      let errors = 0;
      const updates: any[] = [];

      for (const reading of allReadings) {
        try {
          // Only reprocess if we have raw hex and GPS coordinates
          if (!reading.rawHex || reading.rawHex.length < 20) {
            continue;
          }

          // Check if coordinates exist and are not zero
          if (!reading.latitude || !reading.longitude || 
              reading.latitude === 0 || reading.longitude === 0) {
            continue;
          }

          // Decode the hex data again with current decoder
          const buffer = Buffer.from(reading.rawHex, 'hex');
          const decoded = ProtocolDecoder.decodeMessage(buffer);

          if (!decoded || !decoded.gps) {
            continue;
          }

          const newLat = decoded.gps.latitude;
          const newLon = decoded.gps.longitude;

          // Skip if coordinates are zero or invalid
          if (newLat === 0 || newLon === 0) {
            continue;
          }

          // Check if coordinates changed significantly (more than 0.1 degrees)
          const latDiff = Math.abs(reading.latitude - newLat);
          const lonDiff = Math.abs(reading.longitude - newLon);

          if (latDiff > 0.1 || lonDiff > 0.1) {
            console.log(`🔧 Corrigindo leitura ${reading.id} (Device: ${reading.deviceId}):`);
            console.log(`   Antes: lat=${reading.latitude.toFixed(6)}, lon=${reading.longitude.toFixed(6)}`);
            console.log(`   Depois: lat=${newLat.toFixed(6)}, lon=${newLon.toFixed(6)}`);
            console.log(`   Diferença: lat=${latDiff.toFixed(6)}, lon=${lonDiff.toFixed(6)}\n`);

            updates.push({
              id: reading.id,
              deviceId: reading.deviceId,
              oldLat: reading.latitude,
              oldLon: reading.longitude,
              newLat: newLat,
              newLon: newLon,
              protocol: reading.protocolId
            });

            fixed++;
          }

          reprocessed++;
        } catch (error) {
          errors++;
          console.error(`❌ Erro ao reprocessar leitura ${reading.id}:`, error);
        }
      }

      console.log('\n=====================================');
      console.log(`✅ Reprocessamento concluído:`);
      console.log(`   Total reprocessado: ${reprocessed}`);
      console.log(`   Coordenadas corrigidas: ${fixed}`);
      console.log(`   Erros: ${errors}\n`);

      if (updates.length > 0) {
        console.log('📝 Aplicando correções no banco de dados...\n');
        this.applyUpdates(updates);
      } else {
        console.log('✅ Nenhuma correção necessária. Todas as coordenadas estão corretas!\n');
      }

    } catch (error) {
      console.error('❌ Erro fatal ao reprocessar:', error);
      process.exit(1);
    }
  }

  private static applyUpdates(updates: any[]): void {
    try {
      const dbManager = DatabaseManager.getInstance();
      const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');

      if (!fs.existsSync(dbPath)) {
        console.error('❌ Arquivo readings.json não encontrado');
        return;
      }

      // Load all data
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      
      // Create a map for quick lookup
      const updateMap = new Map(updates.map(u => [u.id, u]));

      // Update coordinates
      let updated = 0;
      for (const reading of data) {
        const update = updateMap.get(reading.id);
        if (update) {
          reading.latitude = update.newLat;
          reading.longitude = update.newLon;
          // Update timestamp to indicate reprocessing
          reading.reprocessedAt = new Date().toISOString();
          updated++;
        }
      }

      // Create backup
      const backupPath = dbPath + `.backup.${Date.now()}`;
      fs.copyFileSync(dbPath, backupPath);
      console.log(`💾 Backup criado: ${backupPath}\n`);

      // Save updated data
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ ${updated} leituras atualizadas no banco de dados\n`);

    } catch (error) {
      console.error('❌ Erro ao aplicar atualizações:', error);
      throw error;
    }
  }
}

// Run if executed directly
if (require.main === module) {
  GPSReprocessor.reprocessAllGPS();
}

export { GPSReprocessor };
