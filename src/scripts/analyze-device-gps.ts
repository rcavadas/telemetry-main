import * as fs from 'fs';
import * as path from 'path';
import { ProtocolDecoder } from '../protocols/protocol-decoder';

/**
 * Script para analisar coordenadas GPS de um dispositivo específico
 */
class DeviceGPSAnalyzer {
  static analyzeDevice(deviceId: string): void {
    console.log(`🔍 ANÁLISE GPS DO DISPOSITIVO: ${deviceId}`);
    console.log('=====================================\n');

    const dbPath = path.join(process.cwd(), 'obd_data', 'readings.json');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Arquivo readings.json não encontrado');
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const deviceReadings = data.filter((r: any) => 
        r.deviceId === deviceId && 
        r.rawHex && 
        r.rawHex.length > 20
      );

      console.log(`📊 Total de leituras encontradas: ${deviceReadings.length}\n`);

      const gpsReadings = deviceReadings.filter((r: any) => 
        r.latitude && r.longitude && r.latitude !== 0 && r.longitude !== 0
      );

      console.log(`📍 Leituras com GPS válido: ${gpsReadings.length}\n`);

      if (gpsReadings.length === 0) {
        console.log('❌ Nenhuma leitura com GPS válido encontrada');
        return;
      }

      // Agrupar por protocolo
      const byProtocol: { [key: string]: any[] } = {};
      gpsReadings.forEach((r: any) => {
        const protocol = r.protocolId || 'unknown';
        if (!byProtocol[protocol]) {
          byProtocol[protocol] = [];
        }
        byProtocol[protocol].push(r);
      });

      console.log('📡 Leituras por protocolo:');
      Object.keys(byProtocol).forEach(protocol => {
        console.log(`   ${protocol}: ${byProtocol[protocol].length} leituras`);
      });
      console.log('');

      // Mostrar coordenadas únicas
      const uniqueCoords = new Map<string, { lat: number; lon: number; protocol: string; count: number }>();
      
      gpsReadings.forEach((r: any) => {
        const key = `${r.latitude.toFixed(4)}_${r.longitude.toFixed(4)}`;
        if (!uniqueCoords.has(key)) {
          uniqueCoords.set(key, {
            lat: r.latitude,
            lon: r.longitude,
            protocol: r.protocolId || 'unknown',
            count: 1
          });
        } else {
          uniqueCoords.get(key)!.count++;
        }
      });

      console.log(`📍 Coordenadas únicas encontradas: ${uniqueCoords.size}\n`);
      console.log('Coordenadas:');
      Array.from(uniqueCoords.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .forEach(coord => {
          console.log(`   Lat: ${coord.lat.toFixed(6)}, Lon: ${coord.lon.toFixed(6)} (Protocol: ${coord.protocol}, Count: ${coord.count})`);
        });
      console.log('');

      // Reprocessar algumas leituras para verificar
      console.log('🔄 REPROCESSANDO ALGUMAS LEITURAS PARA VERIFICAR:\n');
      let reprocessed = 0;
      let different = 0;

      for (const reading of gpsReadings.slice(0, 5)) {
        try {
          const buffer = Buffer.from(reading.rawHex, 'hex');
          const decoded = ProtocolDecoder.decodeMessage(buffer);

          if (decoded && decoded.gps && decoded.gps.latitude !== 0 && decoded.gps.longitude !== 0) {
            reprocessed++;
            const latDiff = Math.abs(reading.latitude - decoded.gps.latitude);
            const lonDiff = Math.abs(reading.longitude - decoded.gps.longitude);

            if (latDiff > 0.001 || lonDiff > 0.001) {
              different++;
              console.log(`⚠️  Leitura ${reading.id}:`);
              console.log(`   Banco: lat=${reading.latitude.toFixed(6)}, lon=${reading.longitude.toFixed(6)}`);
              console.log(`   Reprocessado: lat=${decoded.gps.latitude.toFixed(6)}, lon=${decoded.gps.longitude.toFixed(6)}`);
              console.log(`   Protocolo: ${reading.protocolId}`);
              console.log(`   Diferença: lat=${latDiff.toFixed(6)}, lon=${lonDiff.toFixed(6)}\n`);
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao reprocessar leitura ${reading.id}:`, error);
        }
      }

      console.log(`\n✅ Reprocessadas: ${reprocessed}, Diferentes: ${different}`);

    } catch (error) {
      console.error('❌ Erro ao analisar dispositivo:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const deviceId = process.argv[2] || '218LSAB2025000003';
  DeviceGPSAnalyzer.analyzeDevice(deviceId);
}

export { DeviceGPSAnalyzer };
