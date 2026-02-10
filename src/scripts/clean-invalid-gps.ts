import * as fs from 'fs';
import * as path from 'path';

/**
 * Script para limpar coordenadas GPS inválidas do banco de dados
 * Remove ou zera coordenadas que estão fora do Brasil
 */
class GPSCleaner {
  static cleanInvalidGPS(): void {
    console.log('🧹 LIMPANDO COORDENADAS GPS INVÁLIDAS');
    console.log('=====================================\n');

    const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Arquivo readings.json não encontrado');
      return;
    }

    // Brasil bounds: Latitude entre -35° e 5°, Longitude entre -75° e -30°
    const BRAZIL_BOUNDS = {
      latMin: -35,
      latMax: 5,
      lonMin: -75,
      lonMax: -30
    };

    // Rio de Janeiro bounds: Latitude entre -23.5° e -22.5°, Longitude entre -44° e -42°
    const RIO_BOUNDS = {
      latMin: -23.5,
      latMax: -22.5,
      lonMin: -44,
      lonMax: -42
    };

    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      console.log(`📊 Total de leituras: ${data.length}\n`);

      let cleaned = 0;
      let totalWithGPS = 0;
      const updates: any[] = [];

      for (const reading of data) {
        if (!reading.latitude || !reading.longitude || 
            reading.latitude === 0 || reading.longitude === 0) {
          continue;
        }

        totalWithGPS++;

        const lat = reading.latitude;
        const lon = reading.longitude;

        // Verificar se está fora do Brasil
        if (lat < BRAZIL_BOUNDS.latMin || lat > BRAZIL_BOUNDS.latMax ||
            lon < BRAZIL_BOUNDS.lonMin || lon > BRAZIL_BOUNDS.lonMax) {
          
          console.log(`🔧 Limpando leitura ${reading.id} (Device: ${reading.deviceId}):`);
          console.log(`   Coordenadas fora do Brasil: lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
          console.log(`   Protocolo: ${reading.protocolId}\n`);

          updates.push({
            id: reading.id,
            deviceId: reading.deviceId,
            oldLat: lat,
            oldLon: lon,
            protocol: reading.protocolId
          });

          // Zerar coordenadas inválidas
          reading.latitude = 0;
          reading.longitude = 0;
          cleaned++;
        }
        // Verificar se protocolo 0x4005/0x4006/0x4007 está fora do Rio de Janeiro
        else if (reading.protocolId && 
                 (reading.protocolId === '0x4005' || reading.protocolId === '0x4006' || reading.protocolId === '0x4007')) {
          const isInRioArea = lat >= RIO_BOUNDS.latMin && lat <= RIO_BOUNDS.latMax && 
                             lon >= RIO_BOUNDS.lonMin && lon <= RIO_BOUNDS.lonMax;
          
          if (!isInRioArea) {
            console.log(`🔧 Limpando leitura ${reading.id} (Device: ${reading.deviceId}):`);
            console.log(`   Coordenadas fora do Rio de Janeiro: lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}`);
            console.log(`   Protocolo: ${reading.protocolId}\n`);

            updates.push({
              id: reading.id,
              deviceId: reading.deviceId,
              oldLat: lat,
              oldLon: lon,
              protocol: reading.protocolId
            });

            // Zerar coordenadas inválidas
            reading.latitude = 0;
            reading.longitude = 0;
            cleaned++;
          }
        }
      }

      console.log('\n=====================================');
      console.log(`✅ Limpeza concluída:`);
      console.log(`   Total com GPS: ${totalWithGPS}`);
      console.log(`   Coordenadas limpas: ${cleaned}\n`);

      if (updates.length > 0) {
        // Create backup
        const backupPath = dbPath + `.backup.${Date.now()}`;
        fs.copyFileSync(dbPath, backupPath);
        console.log(`💾 Backup criado: ${backupPath}\n`);

        // Save cleaned data
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ ${cleaned} leituras limpas no banco de dados\n`);
      } else {
        console.log('✅ Nenhuma coordenada inválida encontrada!\n');
      }

    } catch (error) {
      console.error('❌ Erro ao limpar coordenadas:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  GPSCleaner.cleanInvalidGPS();
}

export { GPSCleaner };
