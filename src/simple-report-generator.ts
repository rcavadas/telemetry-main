interface OBDReading {
  id: number;
  deviceId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  direction: number;
  satellites: number;
  gpsFix: string;
  totalMileage: number;
  currentMileage: number;
  voltage: number;
  powerOn: boolean;
  accOn: boolean;
  ignitionOn: boolean;
}

interface VehicleSpecs {
  brand: string;
  model: string;
  year: string;
  engine: string;
  power: string;
  tankCapacity: number;
  fuelType: string;
  transmission: string;
}

interface ReportSummary {
  deviceId: string;
  vehicle: string;
  totalRecords: number;
  period: string;
  totalDistance: number;
  maxSpeed: number;
  movementTime: number;
  coordinates: Array<{lat: number, lon: number, speed: number, time: string}>;
  issues: string[];
  googleMapsUrl: string;
}

export class SimpleReportGenerator {
  private static vehicleDatabase: Map<string, VehicleSpecs> = new Map([
    ['218LSAB2025000004', {
      brand: 'Audi',
      model: 'A4',
      year: '2014',
      engine: '2.0L TFSI',
      power: '187 cv',
      tankCapacity: 55,
      fuelType: 'Gasolina Premium',
      transmission: 'Tiptronic 8 velocidades'
    }],
    ['218LSAB2025000002', {
      brand: 'Honda',
      model: 'Civic',
      year: '2018',
      engine: '1.8L',
      power: '140 cv',
      tankCapacity: 50,
      fuelType: 'Gasolina',
      transmission: 'CVT'
    }]
  ]);

  static generateReport(deviceId: string, readingsData?: OBDReading[]): ReportSummary {
    console.log(`🔄 Gerando relatório para device: ${deviceId}`);
    
    // Se dados não fornecidos, retorna exemplo
    let readings = readingsData || [];
    
    if (readings.length === 0) {
      // Dados de exemplo para demonstração
      readings = this.getExampleData(deviceId);
    }

    const deviceReadings = readings.filter(r => r.deviceId === deviceId);
    
    if (deviceReadings.length === 0) {
      throw new Error(`Nenhum dado encontrado para device ${deviceId}`);
    }

    // Obter especificações do veículo
    const vehicleSpecs = this.vehicleDatabase.get(deviceId) || {
      brand: 'Desconhecido',
      model: 'Desconhecido',
      year: 'N/A',
      engine: 'N/A',
      power: 'N/A',
      tankCapacity: 0,
      fuelType: 'N/A',
      transmission: 'N/A'
    };

    // Análise básica
    const sortedReadings = deviceReadings.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstReading = sortedReadings[0];
    const lastReading = sortedReadings[sortedReadings.length - 1];
    
    // Calcular estatísticas
    const uniqueCoords = this.getUniqueCoordinates(sortedReadings);
    const totalDistance = this.calculateTotalDistance(uniqueCoords);
    const maxSpeed = Math.max(...sortedReadings.map(r => r.speedKmH));
    const movingReadings = sortedReadings.filter(r => r.speedKmH > 0);
    
    const movementTime = movingReadings.length > 0 
      ? (new Date(lastReading.timestamp).getTime() - new Date(firstReading.timestamp).getTime()) / (1000 * 60)
      : 0;

    // Coordenadas para mapa
    const coordinates = uniqueCoords.map(reading => ({
      lat: reading.latitude,
      lon: reading.longitude,
      speed: reading.speedKmH,
      time: reading.timestamp
    }));

    // URL do Google Maps
    const googleMapsUrl = this.generateGoogleMapsUrl(coordinates);

    // Identificar problemas
    const issues = this.identifyBasicIssues(sortedReadings);

    return {
      deviceId,
      vehicle: `${vehicleSpecs.brand} ${vehicleSpecs.model} ${vehicleSpecs.year}`,
      totalRecords: deviceReadings.length,
      period: `${firstReading.timestamp} até ${lastReading.timestamp}`,
      totalDistance: Math.round(totalDistance * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      movementTime: Math.round(movementTime),
      coordinates,
      issues,
      googleMapsUrl
    };
  }

  private static getUniqueCoordinates(readings: OBDReading[]): OBDReading[] {
    const coordMap = new Map<string, OBDReading>();
    
    readings.forEach(reading => {
      const key = `${reading.latitude.toFixed(6)},${reading.longitude.toFixed(6)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, reading);
      }
    });
    
    return Array.from(coordMap.values());
  }

  private static calculateTotalDistance(coordinates: OBDReading[]): number {
    let totalDistance = 0;
    
    for (let i = 1; i < coordinates.length; i++) {
      const dist = this.calculateDistance(
        coordinates[i-1].latitude, coordinates[i-1].longitude,
        coordinates[i].latitude, coordinates[i].longitude
      );
      totalDistance += dist;
    }
    
    return totalDistance;
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private static generateGoogleMapsUrl(coordinates: Array<{lat: number, lon: number}>): string {
    if (coordinates.length === 0) return '';
    
    const waypoints = coordinates.slice(0, 10).map(c => `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`);
    return `https://www.google.com/maps/dir/${waypoints.join('/')}`;
  }

  private static identifyBasicIssues(readings: OBDReading[]): string[] {
    const issues: string[] = [];
    
    // Verificar GPS
    const validGpsReadings = readings.filter(r => r.latitude !== 0 && r.longitude !== 0);
    if (validGpsReadings.length < readings.length * 0.8) {
      issues.push('Qualidade de GPS baixa');
    }

    // Verificar voltagem
    const voltages = readings.map(r => r.voltage).filter(v => v > 0);
    if (voltages.length > 0) {
      const avgVoltage = voltages.reduce((sum, v) => sum + v, 0) / voltages.length;
      if (avgVoltage < 12.0) {
        issues.push('Voltagem baixa da bateria');
      }
    }

    // Verificar movimento
    const movingReadings = readings.filter(r => r.speedKmH > 0);
    if (movingReadings.length === 0) {
      issues.push('Nenhum movimento detectado');
    }

    return issues;
  }

  private static getExampleData(deviceId: string): OBDReading[] {
    // Dados de exemplo baseados no readings.json original
    return [
      {
        id: 1,
        deviceId,
        timestamp: '2025-05-29T00:56:16.000Z',
        latitude: -23.018880,
        longitude: -43.452050,
        speedKmH: 0,
        direction: 0,
        satellites: 8,
        gpsFix: 'valid',
        totalMileage: 45320.5,
        currentMileage: 0,
        voltage: 12.2,
        powerOn: true,
        accOn: false,
        ignitionOn: false
      },
      {
        id: 2,
        deviceId,
        timestamp: '2025-05-29T14:19:47.000Z',
        latitude: -23.010760,
        longitude: -43.451310,
        speedKmH: 51.1,
        direction: 45,
        satellites: 9,
        gpsFix: 'valid',
        totalMileage: 45325.2,
        currentMileage: 4.7,
        voltage: 13.8,
        powerOn: true,
        accOn: true,
        ignitionOn: true
      },
      {
        id: 3,
        deviceId,
        timestamp: '2025-05-29T14:34:53.000Z',
        latitude: -22.974180,
        longitude: -43.371520,
        speedKmH: 0,
        direction: 0,
        satellites: 8,
        gpsFix: 'valid',
        totalMileage: 45330.1,
        currentMileage: 9.6,
        voltage: 14.2,
        powerOn: true,
        accOn: true,
        ignitionOn: false
      }
    ];
  }

  static generateSimpleMarkdownReport(summary: ReportSummary): string {
    return `# 📊 Relatório Automático - Device ${summary.deviceId}

> **🚗 ${summary.vehicle}**  
> **📅 Gerado em:** ${new Date().toLocaleString('pt-BR')}

## 📋 Resumo

| Métrica | Valor |
|---------|-------|
| **Device ID** | ${summary.deviceId} |
| **Veículo** | ${summary.vehicle} |
| **Registros** | ${summary.totalRecords} |
| **Distância** | ${summary.totalDistance} km |
| **Velocidade Máx** | ${summary.maxSpeed} km/h |
| **Tempo Movimento** | ${summary.movementTime} min |

## 📍 Coordenadas

${summary.coordinates.map((coord, index) => `
${index + 1}. **${coord.lat}, ${coord.lon}** (${coord.speed} km/h)
   - ${new Date(coord.time).toLocaleString('pt-BR')}
`).join('')}

## 🗺️ Google Maps

[**VER TRAJETO NO GOOGLE MAPS**](${summary.googleMapsUrl})

## 🚨 Problemas

${summary.issues.length > 0 ? summary.issues.map(issue => `- ❌ ${issue}`).join('\n') : '✅ Nenhum problema detectado'}

---

**📅 Gerado em:** ${new Date().toLocaleString('pt-BR')}
`;
  }
} 