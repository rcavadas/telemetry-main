import { DatabaseManager } from '../models/database';

interface OBDReading {
  id: number;
  deviceId: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  speedKmH?: number;
  direction?: number;
  satellites?: number;
  gpsFix?: string;
  totalMileage?: number;
  currentMileage?: number;
  voltage?: number;
  powerOn?: boolean;
  accOn?: boolean;
  ignitionOn?: boolean;
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

interface TimelinePeriod {
  name: string;
  start: Date;
  end: Date;
  duration: number; // minutes
  location: string;
  status: string;
  description: string;
}

interface MovementAnalysis {
  totalDistance: number;
  maxSpeed: number;
  avgSpeed: number;
  movementTime: number; // minutes
  coordinates: Array<{
    lat: number;
    lon: number;
    speed: number;
    timestamp: string;
    description: string;
  }>;
}

interface ReportData {
  deviceId: string;
  vehicleSpecs: VehicleSpecs;
  totalRecords: number;
  analysisPeriod: {
    start: string;
    end: string;
    totalDuration: number; // minutes
  };
  timeline: TimelinePeriod[];
  movement: MovementAnalysis;
  electrical: {
    minVoltage: number;
    maxVoltage: number;
    avgVoltage: number;
    powerOnPercentage: number;
    accOnPercentage: number;
    ignitionOnPercentage: number;
  };
  issues: string[];
  recommendations: string[];
  googleMapsUrl: string;
}

export class ReportGenerator {
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
    }],
    ['218LSAB2025000003', {
      brand: 'Fiat',
      model: 'Palio',
      year: '2006',
      engine: '1.4L',
      power: '70 cv',
      tankCapacity: 50,
      fuelType: 'Gasolina',
      transmission: 'CVT'
    }]
  ]);

  static generateReport(deviceId: string): ReportData {
    console.log(`🔄 Gerando relatório para device: ${deviceId}`);
    
    // Carregar dados do device
    const db = DatabaseManager.getInstance();
    const readings = this.loadDeviceReadings(deviceId);
    
    if (readings.length === 0) {
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

    // Análise temporal
    const timeline = this.analyzeTimeline(readings);
    
    // Análise de movimento
    const movement = this.analyzeMovement(readings);
    
    // Análise elétrica
    const electrical = this.analyzeElectricalSystem(readings);
    
    // Período de análise
    const sortedReadings = readings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const analysisStart = sortedReadings[0].timestamp;
    const analysisEnd = sortedReadings[sortedReadings.length - 1].timestamp;
    const totalDuration = (new Date(analysisEnd).getTime() - new Date(analysisStart).getTime()) / (1000 * 60);

    // Issues e recomendações
    const issues = this.identifyIssues(readings, vehicleSpecs);
    const recommendations = this.generateRecommendations(vehicleSpecs, issues);

    // URL do Google Maps
    const googleMapsUrl = this.generateGoogleMapsUrl(movement.coordinates);

    return {
      deviceId,
      vehicleSpecs,
      totalRecords: readings.length,
      analysisPeriod: {
        start: analysisStart,
        end: analysisEnd,
        totalDuration
      },
      timeline,
      movement,
      electrical,
      issues,
      recommendations,
      googleMapsUrl
    };
  }

  private static loadDeviceReadings(deviceId: string): OBDReading[] {
    try {
      const db = DatabaseManager.getInstance();
      const readings = db.getReadings(deviceId, 1000); // Obter até 1000 registros
      return readings;
    } catch (error) {
      console.error(`Erro ao carregar dados do device ${deviceId}:`, error);
      return [];
    }
  }

  private static analyzeTimeline(readings: OBDReading[]): TimelinePeriod[] {
    const timeline: TimelinePeriod[] = [];
    
    // Agrupar por coordenadas
    const locationGroups = new Map<string, OBDReading[]>();
    readings.forEach(reading => {
      const locationKey = `${reading.latitude?.toFixed(6)},${reading.longitude?.toFixed(6)}`;
      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, []);
      }
      locationGroups.get(locationKey)!.push(reading);
    });

    // Analisar cada grupo de localização
    Array.from(locationGroups.entries()).forEach(([location, records], index) => {
      records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const start = new Date(records[0].timestamp);
      const end = new Date(records[records.length - 1].timestamp);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      
      let name = '';
      let status = '';
      let description = '';
      
      if (duration > 180) { // Mais de 3 horas
        if (start.getHours() < 6) {
          name = 'Estacionamento Noturno';
          status = 'Estacionado';
          description = 'Veículo em repouso durante a madrugada';
        } else if (start.getHours() >= 10 && start.getHours() <= 14) {
          name = 'Parada Prolongada';
          status = 'Estacionado';
          description = 'Período de parada durante o dia (possível recreio/almoço)';
        } else {
          name = 'Estacionamento';
          status = 'Estacionado';
          description = 'Veículo estacionado';
        }
      } else if (duration < 5) {
        name = 'Movimento';
        status = 'Em movimento';
        description = 'Trajeto ativo';
      } else {
        name = 'Parada Breve';
        status = 'Parado';
        description = 'Parada temporária';
      }

      timeline.push({
        name,
        start,
        end,
        duration,
        location,
        status,
        description
      });
    });

    return timeline.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private static analyzeMovement(readings: OBDReading[]): MovementAnalysis {
    const movingReadings = readings.filter(r => r.speedKmH && r.speedKmH > 0);
    const uniqueCoords = new Map<string, OBDReading>();
    
    readings.forEach(reading => {
      if (reading.latitude !== undefined && reading.longitude !== undefined) {
        const coordKey = `${reading.latitude.toFixed(6)},${reading.longitude.toFixed(6)}`;
        if (!uniqueCoords.has(coordKey)) {
          uniqueCoords.set(coordKey, reading);
        }
      }
    });

    const coordinates = Array.from(uniqueCoords.values())
      .filter(reading => reading.latitude !== undefined && reading.longitude !== undefined)
      .map((reading, index) => {
        let description = '';
        const speed = reading.speedKmH || 0;
        if (index === 0) description = 'Ponto de partida';
        else if (index === uniqueCoords.size - 1) description = 'Destino final';
        else if (speed > 60) description = 'Velocidade alta';
        else if (speed > 30) description = 'Velocidade moderada';
        else if (speed > 0) description = 'Movimento lento';
        else description = 'Parada';

        return {
          lat: reading.latitude!,
          lon: reading.longitude!,
          speed: speed,
          timestamp: reading.timestamp,
          description
        };
      });

    // Calcular distância aproximada
    let totalDistance = 0;
    if (coordinates.length > 1) {
      for (let i = 1; i < coordinates.length; i++) {
        const dist = this.calculateDistance(
          coordinates[i-1].lat, coordinates[i-1].lon,
          coordinates[i].lat, coordinates[i].lon
        );
        totalDistance += dist;
      }
    }

    const maxSpeed = Math.max(...readings.map(r => r.speedKmH || 0));
    const avgSpeed = movingReadings.length > 0 
      ? movingReadings.reduce((sum, r) => sum + (r.speedKmH || 0), 0) / movingReadings.length 
      : 0;

    // Calcular tempo em movimento
    const movementTime = movingReadings.length > 0 
      ? (new Date(movingReadings[movingReadings.length - 1].timestamp).getTime() - 
         new Date(movingReadings[0].timestamp).getTime()) / (1000 * 60)
      : 0;

    return {
      totalDistance,
      maxSpeed,
      avgSpeed,
      movementTime,
      coordinates
    };
  }

  private static analyzeElectricalSystem(readings: OBDReading[]) {
    const voltages = readings.map(r => r.voltage).filter(v => v !== undefined && v > 0) as number[];
    const powerOnCount = readings.filter(r => r.powerOn).length;
    const accOnCount = readings.filter(r => r.accOn).length;
    const ignitionOnCount = readings.filter(r => r.ignitionOn).length;

    return {
      minVoltage: voltages.length > 0 ? Math.min(...voltages) : 0,
      maxVoltage: voltages.length > 0 ? Math.max(...voltages) : 0,
      avgVoltage: voltages.length > 0 ? voltages.reduce((sum, v) => sum + v, 0) / voltages.length : 0,
      powerOnPercentage: (powerOnCount / readings.length) * 100,
      accOnPercentage: (accOnCount / readings.length) * 100,
      ignitionOnPercentage: (ignitionOnCount / readings.length) * 100
    };
  }

  private static identifyIssues(readings: OBDReading[], vehicleSpecs: VehicleSpecs): string[] {
    const issues: string[] = [];
    
    // Verificar combustível
    const fuelValues = readings.map(r => (r as any).currentFuel).filter(f => f !== undefined);
    if (fuelValues.length > 0 && fuelValues.every(f => f === 512)) {
      issues.push('Dados de combustível inválidos (valor fixo 512)');
    }

    // Verificar GPS
    const gpsReadings = readings.filter(r => r.latitude !== undefined && r.longitude !== undefined);
    if (gpsReadings.length < readings.length * 0.8) {
      issues.push('Qualidade de GPS baixa (menos de 80% dos registros)');
    }

    // Verificar voltagem
    const voltages = readings.map(r => r.voltage).filter(v => v !== undefined && v > 0) as number[];
    if (voltages.length > 0) {
      const avgVoltage = voltages.reduce((sum, v) => sum + v, 0) / voltages.length;
      if (avgVoltage < 12.0) {
        issues.push('Voltagem baixa da bateria');
      }
    }

    // Verificar compatibilidade por marca
    if (vehicleSpecs.brand === 'Audi') {
      issues.push('Protocolo básico limitado para veículos Audi (requer VAG-COM)');
    }

    return issues;
  }

  private static generateRecommendations(vehicleSpecs: VehicleSpecs, issues: string[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.includes('combustível'))) {
      recommendations.push('Verificar compatibilidade do sensor de combustível');
      if (vehicleSpecs.brand === 'Audi') {
        recommendations.push('Implementar protocolo VAG-COM para dados específicos Audi');
      }
    }

    if (issues.some(i => i.includes('GPS'))) {
      recommendations.push('Verificar instalação e posicionamento da antena GPS');
    }

    if (issues.some(i => i.includes('voltagem'))) {
      recommendations.push('Verificar sistema elétrico e bateria do veículo');
    }

    if (vehicleSpecs.brand === 'Audi') {
      recommendations.push('Considerar adaptador específico para veículos VAG (Volkswagen Audi Group)');
      recommendations.push('Implementar protocolo UDS (ISO 14229) para diagnósticos avançados');
    }

    return recommendations;
  }

  private static generateGoogleMapsUrl(coordinates: Array<{lat: number, lon: number}>): string {
    if (coordinates.length === 0) return '';
    
    const waypoints = coordinates.slice(0, 10).map(c => `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`);
    return `https://www.google.com/maps/dir/${waypoints.join('/')}`;
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

  static generateMarkdownReport(reportData: ReportData): string {
    const { deviceId, vehicleSpecs, analysisPeriod, timeline, movement, electrical, issues, recommendations, googleMapsUrl } = reportData;
    
    const startDate = new Date(analysisPeriod.start);
    const endDate = new Date(analysisPeriod.end);
    const durationHours = (analysisPeriod.totalDuration / 60).toFixed(2);
    
    return `# 📊 Relatório Automático - Device ${deviceId}

> **🚗 ${vehicleSpecs.brand} ${vehicleSpecs.model} ${vehicleSpecs.year}**  
> **📅 Gerado em:** ${new Date().toISOString()}  
> **🔄 Relatório Automático v1.0**

## 🔍 Resumo Executivo

| Métrica | Valor | Status |
|---------|-------|--------|
| **🆔 Device ID** | \`${deviceId}\` | ✅ Ativo |
| **🚗 Veículo** | ${vehicleSpecs.brand} ${vehicleSpecs.model} ${vehicleSpecs.year} | ✅ Identificado |
| **📊 Total Registros** | ${reportData.totalRecords} | ✅ Completo |
| **⏱️ Período** | ${durationHours}h (${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}) | ✅ Analisado |
| **📍 Coordenadas** | ${movement.coordinates.length} posições | ✅ GPS Funcional |
| **🏃 Movimento** | ${movement.totalDistance.toFixed(2)} km | ✅ Detectado |
| **🚀 Velocidade Máx** | ${movement.maxSpeed.toFixed(2)} km/h | ✅ Registrada |

## 🕐 Timeline de Atividades

${timeline.map((period, index) => `
### ${index + 1}. **${period.name}**
\`\`\`
⏰ Período: ${period.start.toLocaleString('pt-BR')} → ${period.end.toLocaleString('pt-BR')}
📍 Local: ${period.location}
⏱️ Duração: ${(period.duration / 60).toFixed(1)}h (${period.duration.toFixed(0)} min)
🔑 Status: ${period.status}
📝 Descrição: ${period.description}
\`\`\`
`).join('')}

## 📍 Sequência de Coordenadas

### 🗺️ **Trajeto Completo**
${movement.coordinates.length > 0 ? `[**VER NO GOOGLE MAPS**](${googleMapsUrl})` : 'Nenhum movimento detectado'}

### 📊 **Coordenadas Detalhadas**
${movement.coordinates.map((coord, index) => `
${index + 1}. **${coord.lat?.toFixed(6)}, ${coord.lon?.toFixed(6)}** (${coord.speed.toFixed(1)} km/h)
   - ${coord.description}
   - ${new Date(coord.timestamp).toLocaleString('pt-BR')}
`).join('')}

### 💾 **Dados JSON para APIs**
\`\`\`json
{
  "coordinates": ${JSON.stringify(movement.coordinates.map(c => [c.lat, c.lon]), null, 2)},
  "totalDistance": ${movement.totalDistance.toFixed(2)},
  "maxSpeed": ${movement.maxSpeed.toFixed(2)},
  "avgSpeed": ${movement.avgSpeed.toFixed(2)}
}
\`\`\`

## 📊 Análise Técnica

### 🏃 **Movimento**
\`\`\`
🚗 ESTATÍSTICAS DE VIAGEM:
├─ Distância total: ${movement.totalDistance.toFixed(2)} km
├─ Tempo em movimento: ${(movement.movementTime / 60).toFixed(1)} horas
├─ Velocidade máxima: ${movement.maxSpeed.toFixed(2)} km/h
├─ Velocidade média: ${movement.avgSpeed.toFixed(2)} km/h
└─ Coordenadas únicas: ${movement.coordinates.length} posições
\`\`\`

### 🔋 **Sistema Elétrico**
\`\`\`
⚡ ANÁLISE ELÉTRICA:
├─ Voltagem: ${electrical.minVoltage.toFixed(1)}V → ${electrical.maxVoltage.toFixed(1)}V
├─ Voltagem média: ${electrical.avgVoltage.toFixed(1)}V
├─ Power ON: ${electrical.powerOnPercentage.toFixed(1)}%
├─ ACC ativo: ${electrical.accOnPercentage.toFixed(1)}%
└─ Ignição ativa: ${electrical.ignitionOnPercentage.toFixed(1)}%
\`\`\`

## 🚗 Especificações do Veículo

\`\`\`
🚙 ${vehicleSpecs.brand.toUpperCase()} ${vehicleSpecs.model.toUpperCase()} ${vehicleSpecs.year}:
├─ Motor: ${vehicleSpecs.engine}
├─ Potência: ${vehicleSpecs.power}
├─ Tanque: ${vehicleSpecs.tankCapacity}L
├─ Combustível: ${vehicleSpecs.fuelType}
└─ Transmissão: ${vehicleSpecs.transmission}
\`\`\`

## 🚨 Problemas Identificados

${issues.length > 0 ? issues.map((issue, index) => `${index + 1}. ❌ **${issue}**`).join('\n') : '✅ Nenhum problema crítico identificado'}

## 🔧 Recomendações

${recommendations.length > 0 ? recommendations.map((rec, index) => `${index + 1}. 🔄 **${rec}**`).join('\n') : '✅ Sistema funcionando adequadamente'}

---

**⚡ Relatório gerado automaticamente pelo Sistema de Telemetria Multi-Protocolo**  
**📅 Data/Hora:** ${new Date().toLocaleString('pt-BR')}  
**📊 Fonte:** readings.json (${reportData.totalRecords} registros)  
**🔧 Versão:** v1.0
`;
  }
} 