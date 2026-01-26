import fs from 'fs';
import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

Logger.setLevel(LogLevel.INFO);

class LogReprocessor {
  static reprocessFile(filePath: string): void {
    console.log(`🔄 Reprocessando arquivo: ${filePath}\n`);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado:', filePath);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extrair todos os hexData do arquivo
    const hexDataMatches = content.match(/"hexData":\s*"([0-9a-fA-F]+)"/g);
    
    if (!hexDataMatches) {
      console.log('❌ Nenhum dado hex encontrado no arquivo');
      return;
    }

    console.log(`📦 Total de pacotes encontrados: ${hexDataMatches.length}\n`);
    
    let processedCount = 0;
    let protocol1001Count = 0;
    let protocol100ACount = 0;
    let protocol3400Count = 0;
    let failedCount = 0;
    
    const uniqueDeviceIds = new Set<string>();
    const gpsData: Array<{ deviceId: string, lat: number, lon: number, timestamp: string }> = [];

    hexDataMatches.forEach((match, index) => {
      try {
        // Extrair o hex data
        const hexData = match.match(/"([0-9a-fA-F]+)"/)?.[1];
        if (!hexData) return;

        const buffer = Buffer.from(hexData, 'hex');
        
        console.log(`\n📋 Pacote ${index + 1}:`);
        console.log(`   Tamanho: ${buffer.length} bytes`);
        
        // Tentar decodificar
        const decoded = ProtocolDecoder.decodeMessage(buffer);
        
        if (decoded) {
          processedCount++;
          
          // Contar protocolos
          switch (decoded.protocolId) {
            case '0x1001':
              protocol1001Count++;
              break;
            case '0x100A':
              protocol100ACount++;
              break;
            case '0x3400':
              protocol3400Count++;
              break;
          }
          
          // Coletar device IDs únicos
          uniqueDeviceIds.add(decoded.deviceId);
          
          // Coletar dados GPS válidos
          if (decoded.gps && decoded.gps.latitude !== 0 && decoded.gps.longitude !== 0) {
            gpsData.push({
              deviceId: decoded.deviceId,
              lat: decoded.gps.latitude,
              lon: decoded.gps.longitude,
              timestamp: decoded.timestamp
            });
          }
          
          console.log(`   ✅ ${decoded.protocolId} - Device: ${decoded.deviceId}`);
          console.log(`   📍 GPS: lat=${decoded.gps?.latitude.toFixed(6)}, lon=${decoded.gps?.longitude.toFixed(6)}`);
          console.log(`   🚗 Estado: power=${decoded.vehicleState?.powerOn}, acc=${decoded.vehicleState?.accOn}`);
          console.log(`   🛣️  Quilometragem: ${decoded.tripData?.totalMileage} km`);
          console.log(`   ⚡ Voltagem: ${decoded.voltage || 'N/A'}V`);
          
        } else {
          failedCount++;
          console.log(`   ❌ Falha na decodificação`);
          
          // Mostrar estrutura para análise
          console.log(`   📊 Header: ${buffer.slice(0, 4).toString('hex')}`);
          if (buffer.length >= 27) {
            console.log(`   🆔 Device ID área: ${buffer.slice(5, 21).toString('ascii').replace(/\0/g, '')}`);
            console.log(`   🔧 Protocol área: ${buffer.slice(24, 28).toString('hex')}`);
          }
        }
        
      } catch (error) {
        console.log(`   ⚠️  Erro ao processar pacote ${index + 1}: ${error}`);
        failedCount++;
      }
    });

    // Resumo final
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 RESUMO DO REPROCESSAMENTO`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📦 Total de pacotes: ${hexDataMatches.length}`);
    console.log(`✅ Decodificados com sucesso: ${processedCount}`);
    console.log(`❌ Falhas: ${failedCount}`);
    console.log(`📈 Taxa de sucesso: ${((processedCount / hexDataMatches.length) * 100).toFixed(1)}%`);
    
    console.log(`\n🔧 PROTOCOLOS DETECTADOS:`);
    console.log(`• 0x1001: ${protocol1001Count}x`);
    console.log(`• 0x100A: ${protocol100ACount}x`);
    console.log(`• 0x3400: ${protocol3400Count}x`);
    
    console.log(`\n🆔 DEVICE IDs ÚNICOS:`);
    Array.from(uniqueDeviceIds).forEach(deviceId => {
      console.log(`• ${deviceId}`);
    });
    
    if (gpsData.length > 0) {
      console.log(`\n🗺️  DADOS GPS VÁLIDOS: (${gpsData.length} pontos)`);
      
      // Agrupar por device ID
      const gpsByDevice = new Map<string, typeof gpsData>();
      gpsData.forEach(point => {
        if (!gpsByDevice.has(point.deviceId)) {
          gpsByDevice.set(point.deviceId, []);
        }
        gpsByDevice.get(point.deviceId)!.push(point);
      });
      
      gpsByDevice.forEach((points, deviceId) => {
        console.log(`\n📱 Device: ${deviceId}`);
        console.log(`   📍 Total de pontos GPS: ${points.length}`);
        
        if (points.length > 0) {
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          
          console.log(`   🎯 Primeiro ponto: ${firstPoint.lat.toFixed(6)}, ${firstPoint.lon.toFixed(6)}`);
          console.log(`   🏁 Último ponto: ${lastPoint.lat.toFixed(6)}, ${lastPoint.lon.toFixed(6)}`);
          
          // Calcular centro aproximado
          const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
          const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
          console.log(`   🎯 Centro aproximado: ${centerLat.toFixed(6)}, ${centerLon.toFixed(6)}`);
        }
      });
    }
    
    console.log(`\n🎯 CONCLUSÃO:`);
    if (protocol3400Count === 0 && protocol1001Count > 0) {
      console.log(`✅ Dados são do protocolo 0x1001, não 0x3400!`);
      console.log(`✅ Detector de protocolo corrigido funcionando perfeitamente!`);
    } else if (protocol3400Count > 0) {
      console.log(`⚠️  Ainda há ${protocol3400Count} pacotes detectados como 0x3400`);
    }
  }
}

// Executar reprocessamento
const args = process.argv.slice(2);
const filePath = args[0] || 'logs.txt';

LogReprocessor.reprocessFile(filePath); 