import * as http from 'http';

const BASE_URL = 'http://localhost:3000';

async function checkGPSAPI() {
    console.log('🔍 VERIFICANDO API GPS');
    console.log('=====================================\n');

    // Test device 218LSAB2025000001
    console.log('1. Testando dispositivo 218LSAB2025000001:');
    try {
        const response1 = await fetch(`${BASE_URL}/api/gps-all?deviceId=218LSAB2025000001`);
        const data1 = await response1.json();
        console.log(`   Total de leituras: ${data1.data?.totalReadings || 0}`);
        console.log(`   Dispositivos únicos: ${data1.data?.uniqueDevices || 0}`);
        if (data1.data?.readings && data1.data.readings.length > 0) {
            console.log(`   Primeiras 3 coordenadas:`);
            data1.data.readings.slice(0, 3).forEach((r: any, i: number) => {
                console.log(`      ${i + 1}. Lat: ${r.latitude?.toFixed(6)}, Lon: ${r.longitude?.toFixed(6)}, Speed: ${r.speedKmH || 0} km/h, Timestamp: ${r.timestamp}`);
            });
        }
    } catch (error) {
        console.error('   ❌ Erro:', error);
    }
    console.log('');

    // Test device 218LSAB2025000003
    console.log('2. Testando dispositivo 218LSAB2025000003:');
    try {
        const response2 = await fetch(`${BASE_URL}/api/gps-all?deviceId=218LSAB2025000003`);
        const data2 = await response2.json();
        console.log(`   Total de leituras: ${data2.data?.totalReadings || 0}`);
        console.log(`   Dispositivos únicos: ${data2.data?.uniqueDevices || 0}`);
        if (data2.data?.readings && data2.data.readings.length > 0) {
            console.log(`   Todas as coordenadas:`);
            data2.data.readings.forEach((r: any, i: number) => {
                console.log(`      ${i + 1}. Lat: ${r.latitude?.toFixed(6)}, Lon: ${r.longitude?.toFixed(6)}, Speed: ${r.speedKmH || 0} km/h, Timestamp: ${r.timestamp}`);
            });
        }
    } catch (error) {
        console.error('   ❌ Erro:', error);
    }
    console.log('');

    // Test all devices
    console.log('3. Testando todos os dispositivos:');
    try {
        const response3 = await fetch(`${BASE_URL}/api/gps-all`);
        const data3 = await response3.json();
        console.log(`   Total de leituras: ${data3.data?.totalReadings || 0}`);
        console.log(`   Dispositivos únicos: ${data3.data?.uniqueDevices || 0}`);
        if (data3.data?.groupedByDevice) {
            console.log(`   Dispositivos com GPS:`);
            Object.keys(data3.data.groupedByDevice).forEach(deviceId => {
                const readings = data3.data.groupedByDevice[deviceId];
                console.log(`      ${deviceId}: ${readings.length} pontos GPS`);
            });
        }
    } catch (error) {
        console.error('   ❌ Erro:', error);
    }
}

checkGPSAPI();
