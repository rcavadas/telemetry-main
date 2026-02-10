import { DatabaseManager } from '../models/database';

const deviceIds = ['218LSAB2025000001', '218LSAB2025000003'];

console.log('🔍 VERIFICANDO LEITURAS DOS DISPOSITIVOS');
console.log('=====================================\n');

const dbManager = DatabaseManager.getInstance();
// Get all readings (including those without GPS) by using getReadings with a high limit
const allReadings = dbManager.getReadings(undefined, 10000);

deviceIds.forEach(deviceId => {
    console.log(`\n📱 Dispositivo: ${deviceId}`);
    console.log('-----------------------------------');
    
    const deviceReadings = allReadings.filter(r => r.deviceId === deviceId);
    console.log(`Total de leituras: ${deviceReadings.length}`);
    
    const withGPS = deviceReadings.filter(r => 
        r.latitude != null && r.longitude != null && 
        r.latitude !== 0 && r.longitude !== 0
    );
    console.log(`Leituras com GPS válido: ${withGPS.length}`);
    
    const withoutGPS = deviceReadings.filter(r => 
        !r.latitude || !r.longitude || r.latitude === 0 || r.longitude === 0
    );
    console.log(`Leituras sem GPS: ${withoutGPS.length}`);
    
    if (withGPS.length > 0) {
        console.log('\n📍 Coordenadas GPS:');
        const uniqueCoords = new Map<string, number>();
        withGPS.forEach(r => {
            const key = `${r.latitude?.toFixed(6)},${r.longitude?.toFixed(6)}`;
            uniqueCoords.set(key, (uniqueCoords.get(key) || 0) + 1);
        });
        
        uniqueCoords.forEach((count, coords) => {
            const [lat, lon] = coords.split(',');
            console.log(`   ${lat}, ${lon} (${count} leituras)`);
        });
        
        // Verificar se há leituras sem GPS que deveriam ter
        console.log('\n🔍 Verificando leituras sem GPS que podem ter dados:');
        const samplesWithoutGPS = withoutGPS.slice(0, 5);
        samplesWithoutGPS.forEach(r => {
            console.log(`   ID ${r.id}: Protocol ${r.protocolId}, Timestamp: ${r.timestamp}`);
        });
    }
});
