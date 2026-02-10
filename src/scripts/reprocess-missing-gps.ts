import { DatabaseManager, OBDReading } from '../models/database';
import { ProtocolDecoder } from '../protocols/protocol-decoder';
import { Logger } from '../utils/logger';

// Logger.setLevel(Logger.LogLevel.INFO); // Commented out to avoid type issues

const deviceIds = ['218LSAB2025000001', '218LSAB2025000003'];

console.log('🔄 REPROCESSANDO LEITURAS SEM GPS');
console.log('=====================================\n');

const dbManager = DatabaseManager.getInstance();
// Get all readings by using a very high limit
const allReadings = dbManager.getReadings(undefined, 50000);

let totalProcessed = 0;
let totalUpdated = 0;

deviceIds.forEach(deviceId => {
    console.log(`\n📱 Processando dispositivo: ${deviceId}`);
    console.log('-----------------------------------');
    
    const deviceReadings = allReadings.filter(r => r.deviceId === deviceId);
    const withoutGPS = deviceReadings.filter(r => 
        !r.latitude || !r.longitude || r.latitude === 0 || r.longitude === 0
    );
    
    console.log(`Total de leituras: ${deviceReadings.length}`);
    console.log(`Leituras sem GPS: ${withoutGPS.length}`);
    console.log(`Reprocessando leituras sem GPS...\n`);
    
    let deviceUpdated = 0;
    
    // Process first 100 readings without GPS
    withoutGPS.slice(0, 100).forEach(reading => {
        try {
            const buffer = Buffer.from(reading.rawHex, 'hex');
            const decoded = ProtocolDecoder.decodeMessage(buffer);
            
            if (decoded && decoded.gps && decoded.gps.latitude && decoded.gps.longitude) {
                const newLat = decoded.gps.latitude;
                const newLon = decoded.gps.longitude;
                
                // Check if coordinates are valid (within Brazil bounds)
                if (newLat >= -35 && newLat <= 5 && newLon >= -75 && newLon <= -30) {
                    reading.latitude = newLat;
                    reading.longitude = newLon;
                    reading.speedKmH = decoded.gps.speedKmH;
                    reading.direction = decoded.gps.direction;
                    reading.satellites = decoded.gps.satellites;
                    reading.gpsFix = decoded.gps.gpsFix;
                    reading.protocolId = decoded.protocolId;
                    
                    deviceUpdated++;
                    totalUpdated++;
                    
                    if (deviceUpdated <= 5) {
                        console.log(`   ✅ Atualizado ID ${reading.id}: lat=${newLat.toFixed(6)}, lon=${newLon.toFixed(6)}, protocol=${decoded.protocolId}`);
                    }
                }
            }
        } catch (error) {
            // Silently skip errors
        }
        
        totalProcessed++;
    });
    
    console.log(`\n   Total processado: ${Math.min(withoutGPS.length, 100)}`);
    console.log(`   Atualizado: ${deviceUpdated}`);
});

if (totalUpdated > 0) {
    console.log(`\n=====================================`);
    console.log(`✅ Salvando alterações...`);
    dbManager.saveAllData(allReadings);
    console.log(`✅ Reprocessamento concluído:`);
    console.log(`   Total processado: ${totalProcessed}`);
    console.log(`   Total atualizado: ${totalUpdated}`);
} else {
    console.log(`\n=====================================`);
    console.log(`✅ Nenhuma atualização necessária`);
}
