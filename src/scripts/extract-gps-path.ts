import * as fs from 'fs';
import { ProtocolDecoder } from '../protocols/protocol-decoder';
import { Logger, LogLevel } from '../utils/logger';

Logger.setLevel(LogLevel.ERROR); // Reduzir logs para output limpo

interface GPSPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  direction: number;
  satellites: number;
  mileage: number;
  voltage: number;
  sequenceNumber: number;
}

class GPSPathExtractor {
  static extractPath(filePath: string): GPSPoint[] {
    console.log('🗺️  EXTRAINDO TRAJETO GPS DO ARQUIVO:', filePath);
    console.log('=====================================\n');
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado:', filePath);
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const hexDataMatches = content.match(/"hexData":\s*"([0-9a-fA-F]+)"/g);
    
    if (!hexDataMatches) {
      console.log('❌ Nenhum dado hex encontrado no arquivo');
      return [];
    }

    console.log(`📦 Total de pacotes encontrados: ${hexDataMatches.length}\n`);

    const gpsPoints: GPSPoint[] = [];
    let sequenceNumber = 1;

    hexDataMatches.forEach((match, index) => {
      const hexData = match.match(/"([0-9a-fA-F]+)"/)?.[1];
      if (!hexData) return;

      try {
        const buffer = Buffer.from(hexData, 'hex');
        const decoded = ProtocolDecoder.decodeMessage(buffer);

        if (decoded && decoded.gps && decoded.gps.latitude !== 0 && decoded.gps.longitude !== 0) {
          const gpsPoint: GPSPoint = {
            timestamp: decoded.timestamp,
            latitude: decoded.gps.latitude,
            longitude: decoded.gps.longitude,
            speedKmH: decoded.gps.speedKmH,
            direction: decoded.gps.direction,
            satellites: decoded.gps.satellites,
            mileage: decoded.tripData?.totalMileage || 0,
            voltage: decoded.voltage || 0,
            sequenceNumber: sequenceNumber++
          };

          gpsPoints.push(gpsPoint);
        }
      } catch (error) {
        // Ignorar erros silenciosamente para manter output limpo
      }
    });

    return gpsPoints;
  }

  static removeDuplicates(points: GPSPoint[]): GPSPoint[] {
    const unique: GPSPoint[] = [];
    const seen = new Set<string>();

    points.forEach(point => {
      const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(point);
      }
    });

    return unique;
  }

  static generatePath(removeDuplicates: boolean = true): void {
    const allPoints = this.extractPath('logs.txt');
    
    if (allPoints.length === 0) {
      console.log('❌ Nenhum ponto GPS válido encontrado');
      return;
    }

    // Ordenar por timestamp
    allPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const points = removeDuplicates ? this.removeDuplicates(allPoints) : allPoints;

    console.log(`📍 Total de pontos GPS extraídos: ${allPoints.length}`);
    if (removeDuplicates) {
      console.log(`📍 Pontos únicos (sem duplicatas): ${points.length}`);
    }
    console.log('');

    // Mostrar estatísticas do trajeto
    if (points.length > 0) {
      const first = points[0];
      const last = points[points.length - 1];
      
      console.log('🎯 ESTATÍSTICAS DO TRAJETO:');
      console.log(`   Início: ${first.timestamp}`);
      console.log(`   Fim: ${last.timestamp}`);
      console.log(`   Primeira coordenada: ${first.latitude.toFixed(6)}, ${first.longitude.toFixed(6)}`);
      console.log(`   Última coordenada: ${last.latitude.toFixed(6)}, ${last.longitude.toFixed(6)}`);
      
      // Calcular distância aproximada
      const latDiff = Math.abs(last.latitude - first.latitude);
      const lonDiff = Math.abs(last.longitude - first.longitude);
      const approxDistance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // Aproximação km
      console.log(`   Distância aproximada: ${approxDistance.toFixed(2)} km`);
      console.log('');
    }

    // Exportar trajeto em diferentes formatos
    this.exportToCSV(points);
    this.exportToJSON(points);
    this.exportToGoogleMaps(points);
    this.showSequentialPath(points);
  }

  static exportToCSV(points: GPSPoint[]): void {
    console.log('📄 EXPORTANDO PARA CSV...');
    
    const csvHeader = 'sequence,timestamp,latitude,longitude,speed_kmh,direction,satellites,mileage,voltage\n';
    const csvData = points.map(p => 
      `${p.sequenceNumber},${p.timestamp},${p.latitude},${p.longitude},${p.speedKmH},${p.direction},${p.satellites},${p.mileage},${p.voltage}`
    ).join('\n');
    
    const csvContent = csvHeader + csvData;
    fs.writeFileSync('gps_trajeto.csv', csvContent);
    console.log('   ✅ Arquivo salvo: gps_trajeto.csv\n');
  }

  static exportToJSON(points: GPSPoint[]): void {
    console.log('📄 EXPORTANDO PARA JSON...');
    
    const jsonData = {
      trajeto: {
        device_id: "218LSAB2025000004",
        total_pontos: points.length,
        periodo: {
          inicio: points[0]?.timestamp,
          fim: points[points.length - 1]?.timestamp
        },
        coordenadas: points
      }
    };
    
    fs.writeFileSync('gps_trajeto.json', JSON.stringify(jsonData, null, 2));
    console.log('   ✅ Arquivo salvo: gps_trajeto.json\n');
  }

  static exportToGoogleMaps(points: GPSPoint[]): void {
    console.log('🗺️  LINK PARA GOOGLE MAPS:');
    
    if (points.length === 0) return;
    
    // Criar URL do Google Maps com waypoints
    const first = points[0];
    const last = points[points.length - 1];
    
    // Google Maps limita waypoints, então vamos usar alguns pontos intermediários
    const waypoints = points.length > 10 
      ? points.filter((_, index) => index % Math.floor(points.length / 8) === 0).slice(1, -1)
      : points.slice(1, -1);
    
    let mapsUrl = `https://www.google.com/maps/dir/${first.latitude},${first.longitude}`;
    
    waypoints.forEach(point => {
      mapsUrl += `/${point.latitude},${point.longitude}`;
    });
    
    mapsUrl += `/${last.latitude},${last.longitude}`;
    
    console.log(`   🔗 ${mapsUrl}\n`);
  }

  static showSequentialPath(points: GPSPoint[]): void {
    console.log('🛤️  TRAJETO SEQUENCIAL COMPLETO:');
    console.log('=====================================');
    
    points.forEach((point, index) => {
      const time = new Date(point.timestamp).toLocaleTimeString('pt-BR');
      const prevPoint = index > 0 ? points[index - 1] : null;
      
      let movement = '';
      if (prevPoint) {
        const latMove = point.latitude - prevPoint.latitude;
        const lonMove = point.longitude - prevPoint.longitude;
        const direction = latMove > 0 ? '↑' : latMove < 0 ? '↓' : '';
        const directionLon = lonMove > 0 ? '→' : lonMove < 0 ? '←' : '';
        movement = ` ${direction}${directionLon}`;
      }
      
      console.log(`${point.sequenceNumber.toString().padStart(2, '0')}. ${time} | ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}${movement} | ${point.speedKmH.toFixed(1)}km/h | ${point.voltage.toFixed(1)}V`);
    });
    
    console.log('=====================================');
    console.log('📋 RESUMO:');
    console.log(`   Pontos GPS válidos: ${points.length}`);
    console.log(`   Período: ${new Date(points[0].timestamp).toLocaleString('pt-BR')} - ${new Date(points[points.length - 1].timestamp).toLocaleString('pt-BR')}`);
    console.log(`   Velocidade média: ${(points.reduce((sum, p) => sum + p.speedKmH, 0) / points.length).toFixed(1)} km/h`);
    console.log(`   Voltagem média: ${(points.reduce((sum, p) => sum + p.voltage, 0) / points.length).toFixed(1)}V`);
  }
}

// Executar extração com argumentos da linha de comando
const args = process.argv.slice(2);
const keepDuplicates = args.includes('--keep-duplicates') || args.includes('-d');

GPSPathExtractor.generatePath(!keepDuplicates); 