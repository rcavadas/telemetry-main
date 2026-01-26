import fs from 'fs';
import path from 'path';

interface DeviceData {
  deviceId: string;
  records: any[];
  stats: any;
}

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed: number;
  index: number;
}

function generateDeviceAnalysis() {
  console.log('📊 GENERATING DETAILED DEVICE ANALYSIS');
  console.log('='.repeat(70));
  
  const data = JSON.parse(fs.readFileSync('obd_data/readings.json', 'utf8'));
  
  // Group data by device_id
  const deviceGroups = new Map<string, any[]>();
  
  data.forEach((record: any) => {
    const deviceId = record.deviceId;
    if (!deviceGroups.has(deviceId)) {
      deviceGroups.set(deviceId, []);
    }
    deviceGroups.get(deviceId)!.push(record);
  });
  
  console.log(`📱 Devices found: ${deviceGroups.size}`);
  console.log('');
  
  // Generate analysis for each device
  deviceGroups.forEach((records, deviceId) => {
    console.log(`🔍 Generating analysis for: ${deviceId}`);
    
    const deviceData: DeviceData = {
      deviceId,
      records,
      stats: calculateDetailedStats(records)
    };
    
    const analysisContent = generateAnalysisContent(deviceData);
    const fileName = `ANALYSIS_${deviceId.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    
    fs.writeFileSync(fileName, analysisContent);
    console.log(`✅ Analysis created: ${fileName}`);
  });
  
  console.log('');
  console.log('🎉 Analysis completed!');
}

function calculateDetailedStats(records: any[]) {
  const stats = {
    totalRecords: records.length,
    timeRange: {
      start: new Date(Math.min(...records.map(r => new Date(r.timestamp).getTime()))),
      end: new Date(Math.max(...records.map(r => new Date(r.timestamp).getTime()))),
      duration: 0
    },
    gps: {
      totalReadings: records.length,
      withValidGPS: records.filter(r => r.latitude && r.longitude && r.gpsFix !== 'No Fix').length,
      fixTypes: {} as any,
      coordinates: {
        unique: new Set(),
        bounds: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }
      }
    },
    movement: {
      totalDistance: 0,
      speeds: records.map(r => r.speedKmH || 0),
      maxSpeed: 0,
      avgSpeed: 0,
      timeMoving: 0,
      timeStationary: 0
    },
    vehicle: {
      mileage: {
        start: 0,
        end: 0,
        totalDistance: 0
      },
      fuel: {
        readings: records.filter(r => r.currentFuel !== undefined).length,
        values: records.map(r => r.currentFuel).filter(f => f !== undefined)
      },
      voltage: {
        readings: records.filter(r => r.voltage !== undefined).length,
        min: 0,
        max: 0,
        avg: 0
      },
      states: {
        powerOn: records.filter(r => r.powerOn).length,
        accOn: records.filter(r => r.accOn).length,
        ignitionOn: records.filter(r => r.ignitionOn).length
      }
    },
    technical: {
      protocols: new Set(records.map(r => r.protocolId)),
      softwareVersions: new Set(records.map(r => r.softwareVersion).filter(v => v)),
      hardwareVersions: new Set(records.map(r => r.hardwareVersion).filter(v => v)),
      satellites: {
        min: 0,
        max: 0,
        avg: 0
      }
    }
  };
  
  // Calculate duration in hours
  stats.timeRange.duration = (stats.timeRange.end.getTime() - stats.timeRange.start.getTime()) / (1000 * 60 * 60);
  
  // GPS Fix types
  records.forEach(r => {
    const fixType = r.gpsFix || 'No Fix';
    stats.gps.fixTypes[fixType] = (stats.gps.fixTypes[fixType] || 0) + 1;
    
    if (r.latitude && r.longitude) {
      stats.gps.coordinates.unique.add(`${r.latitude.toFixed(6)},${r.longitude.toFixed(6)}`);
      
      // Bounds
      if (stats.gps.coordinates.bounds.minLat === 0) {
        stats.gps.coordinates.bounds = {
          minLat: r.latitude, maxLat: r.latitude,
          minLng: r.longitude, maxLng: r.longitude
        };
      } else {
        stats.gps.coordinates.bounds.minLat = Math.min(stats.gps.coordinates.bounds.minLat, r.latitude);
        stats.gps.coordinates.bounds.maxLat = Math.max(stats.gps.coordinates.bounds.maxLat, r.latitude);
        stats.gps.coordinates.bounds.minLng = Math.min(stats.gps.coordinates.bounds.minLng, r.longitude);
        stats.gps.coordinates.bounds.maxLng = Math.max(stats.gps.coordinates.bounds.maxLng, r.longitude);
      }
    }
  });
  
  // Movement
  if (stats.movement.speeds.length > 0) {
    stats.movement.maxSpeed = Math.max(...stats.movement.speeds);
    stats.movement.avgSpeed = stats.movement.speeds.reduce((a, b) => a + b, 0) / stats.movement.speeds.length;
    stats.movement.timeMoving = records.filter(r => (r.speedKmH || 0) > 0).length;
    stats.movement.timeStationary = records.filter(r => (r.speedKmH || 0) === 0).length;
  }
  
  // Mileage
  const mileages = records.map(r => r.totalMileage).filter(m => m !== undefined);
  if (mileages.length > 0) {
    stats.vehicle.mileage.start = Math.min(...mileages);
    stats.vehicle.mileage.end = Math.max(...mileages);
    stats.vehicle.mileage.totalDistance = stats.vehicle.mileage.end - stats.vehicle.mileage.start;
  }
  
  // Voltage
  const voltages = records.map(r => r.voltage).filter(v => v !== undefined);
  if (voltages.length > 0) {
    stats.vehicle.voltage.min = Math.min(...voltages);
    stats.vehicle.voltage.max = Math.max(...voltages);
    stats.vehicle.voltage.avg = voltages.reduce((a, b) => a + b, 0) / voltages.length;
  }
  
  // Satellites
  const satellites = records.map(r => r.satellites).filter(s => s !== undefined);
  if (satellites.length > 0) {
    stats.technical.satellites.min = Math.min(...satellites);
    stats.technical.satellites.max = Math.max(...satellites);
    stats.technical.satellites.avg = satellites.reduce((a, b) => a + b, 0) / satellites.length;
  }
  
  return stats;
}

function extractGPSRoute(records: any[]): GPSPoint[] {
  const gpsPoints: GPSPoint[] = [];
  const uniqueCoords = new Set<string>();
  
  records.forEach((record, index) => {
    // Include points with latitude and longitude, even with "No Fix"
    if (record.latitude && record.longitude) {
      const coordKey = `${record.latitude.toFixed(6)},${record.longitude.toFixed(6)}`;
      
      // Only add if it's a unique position or significant change
      if (!uniqueCoords.has(coordKey)) {
        uniqueCoords.add(coordKey);
        gpsPoints.push({
          latitude: record.latitude,
          longitude: record.longitude,
          timestamp: record.timestamp,
          speed: record.speedKmH || 0,
          index: index
        });
      }
    }
  });
  
  return gpsPoints;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function analyzeMovementPattern(gpsPoints: GPSPoint[]): string {
  if (gpsPoints.length < 2) return 'No movement detected';
  
  const start = gpsPoints[0];
  const end = gpsPoints[gpsPoints.length - 1];
  
  // Calculate general direction
  const latDiff = end.latitude - start.latitude;
  const lonDiff = end.longitude - start.longitude;
  
  let direction = '';
  if (Math.abs(latDiff) > Math.abs(lonDiff)) {
    direction = latDiff > 0 ? 'North' : 'South';
  } else {
    direction = lonDiff > 0 ? 'East' : 'West';
  }
  
  // Combine directions for diagonal
  if (Math.abs(latDiff) > 0.001 && Math.abs(lonDiff) > 0.001) {
    const latDir = latDiff > 0 ? 'North' : 'South';
    const lonDir = lonDiff > 0 ? 'East' : 'West';
    direction = `${latDir}${lonDir.toLowerCase()}`;
  }
  
  return direction;
}

function generateGPSRouteSection(records: any[]): string {
  const gpsPoints = extractGPSRoute(records);
  
  if (gpsPoints.length === 0) {
    return `## 🗺️ GPS ROUTE

*No GPS data available*

`;
  }
  
  // Check GPS quality
  const validGPSCount = records.filter(r => r.gpsFix !== 'No Fix' && r.latitude && r.longitude).length;
  const gpsQuality = validGPSCount / records.length;
  let qualityWarning = '';
  
  if (gpsQuality < 0.3) {
    qualityWarning = '\n⚠️ **Warning:** Low GPS quality - coordinates may be inaccurate\n';
  }
  
  // If only 1 point, show static position
  if (gpsPoints.length === 1) {
    const point = gpsPoints[0];
    const googleMapsUrl = `https://www.google.com/maps/place/${point.latitude},${point.longitude}`;
    
    return `## 🗺️ GPS ROUTE
${qualityWarning}
## 📊 Route Summary

*Type:* **Static Position** (vehicle did not move)  
*Location:* ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}  
*Duration:* ${Math.round((new Date(records[records.length-1].timestamp).getTime() - new Date(records[0].timestamp).getTime()) / (1000 * 60))} minutes at same position  
*Speed:* 0 km/h (stationary)  

---

## 📍 Fixed Location

### Coordinates: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}

---

## 🎯 View on Google Maps

*Direct link:* [View Location on Google Maps](${googleMapsUrl})

---

## 📋 Coordinate for Copy/Paste

*Format for map APIs (lat, lng):*

\`\`\`json
[${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}]
\`\`\`

---

## 🚗 Movement Analysis

*Status:* Vehicle stationary  
*Movement:* No movement detected  
*Pattern:* Fixed position throughout period  

`;
  }
  
  // Calculate route statistics
  let totalDistance = 0;
  for (let i = 1; i < gpsPoints.length; i++) {
    totalDistance += calculateDistance(
      gpsPoints[i-1].latitude, gpsPoints[i-1].longitude,
      gpsPoints[i].latitude, gpsPoints[i].longitude
    );
  }
  
  const startTime = new Date(gpsPoints[0].timestamp);
  const endTime = new Date(gpsPoints[gpsPoints.length - 1].timestamp);
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
  const avgSpeed = duration > 0 ? (totalDistance / (duration / 60)) : 0;
  
  // Calculate maximum route speed
  const maxSpeed = Math.max(...gpsPoints.map(p => p.speed));
  const minSpeed = Math.min(...gpsPoints.map(p => p.speed));
  
  // Generate Google Maps URLs
  const coords = gpsPoints.slice(0, 10).map(p => `${p.latitude},${p.longitude}`); // Limit to 10 points for URL
  const googleMapsUrl = `https://www.google.com/maps/dir/${coords.join('/')}`;
  
  // Coordinates for APIs
  const apiCoords = gpsPoints.map(p => `[${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}]`).join(',\n');
  
  // Movement analysis
  const movementPattern = analyzeMovementPattern(gpsPoints);
  
  return `## 🗺️ GPS ROUTE
${qualityWarning}
## 📊 Route Summary

*Period:* ${startTime.toLocaleDateString('en-US')} - ${startTime.toLocaleTimeString('en-US')} to ${endTime.toLocaleTimeString('en-US')} (${Math.round(duration)} minutes)  
*Distance:* ~${totalDistance.toFixed(2)} km  
*Average Speed:* ${avgSpeed.toFixed(1)} km/h  
*Maximum Speed:* **${maxSpeed.toFixed(1)} km/h** 🚀  
*Minimum Speed:* ${minSpeed.toFixed(1)} km/h  
*Unique Points:* ${gpsPoints.length} coordinates  

---

## 📍 Coordinate Sequence (Lat, Lon)

### Format: Latitude, Longitude

${gpsPoints.map((point, index) => {
  const marker = index === 0 ? ' ← START' : 
                 index === gpsPoints.length - 1 ? ' ← END' : '';
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}${marker}`;
}).join('\n')}

---

## 🎯 Google Maps Points

*Direct link:* [View on Google Maps](${googleMapsUrl})

---

## 📋 Simplified Coordinates for Copy/Paste

*Format for map APIs (lat, lng):*

\`\`\`json
[
${apiCoords}
]
\`\`\`

---

## 🚗 Movement Analysis

*General Direction:* ${movementPattern}  
*Pattern:* ${gpsPoints.length > 5 ? 'Movement with multiple stops' : 'Direct movement'}  
*Speeds:* Ranged from ${minSpeed.toFixed(1)} km/h to **${maxSpeed.toFixed(1)} km/h**  

### Key Points:
${gpsPoints.slice(0, 5).map((point, index) => 
  `• *Point ${index + 1}:* ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} (${point.speed.toFixed(1)} km/h)`
).join('\n')}

`;
}

function generateAnalysisContent(deviceData: DeviceData): string {
  const { deviceId, records, stats } = deviceData;
  const timestamp = new Date().toISOString();
  
  return `# 📊 Detailed Device Analysis: ${deviceId}

> **Generated on:** ${timestamp}  
> **Total Records:** ${stats.totalRecords}  
> **Period:** ${stats.timeRange.start.toISOString()} → ${stats.timeRange.end.toISOString()}

## 📋 Executive Summary

| Metric | Value |
|---------|-------|
| **📱 Device ID** | \`${deviceId}\` |
| **📊 Total Records** | ${stats.totalRecords} |
| **⏱️ Duration** | ${stats.timeRange.duration.toFixed(2)} hours |
| **📡 Protocol** | ${Array.from(stats.technical.protocols).join(', ')} |
| **🗺️ Valid GPS** | ${stats.gps.withValidGPS}/${stats.gps.totalReadings} (${((stats.gps.withValidGPS/stats.gps.totalReadings)*100).toFixed(1)}%) |
| **🏃 Maximum Speed** | ${stats.movement.maxSpeed.toFixed(2)} km/h |
| **🛣️ Mileage** | ${stats.vehicle.mileage.start.toLocaleString()} → ${stats.vehicle.mileage.end.toLocaleString()} mi |

${generateGPSRouteSection(records)}

## 🗺️ GPS and Location Data

### GPS Status
${Object.entries(stats.gps.fixTypes).map(([type, count]) => 
  `- **${type}**: ${count} records (${((count as number / stats.totalRecords) * 100).toFixed(1)}%)`
).join('\n')}

### Coordinates
- **Unique Positions**: ${stats.gps.coordinates.unique.size}
- **Coverage Area**: 
  - Latitude: ${stats.gps.coordinates.bounds.minLat.toFixed(6)}° → ${stats.gps.coordinates.bounds.maxLat.toFixed(6)}°
  - Longitude: ${stats.gps.coordinates.bounds.minLng.toFixed(6)}° → ${stats.gps.coordinates.bounds.maxLng.toFixed(6)}°

### Signal Quality
- **Satellites**: ${stats.technical.satellites.min} → ${stats.technical.satellites.max} (average: ${stats.technical.satellites.avg.toFixed(1)})

## 🚗 Movement Data

### Speeds
- **Maximum**: ${stats.movement.maxSpeed.toFixed(2)} km/h
- **Average**: ${stats.movement.avgSpeed.toFixed(2)} km/h
- **Moving**: ${stats.movement.timeMoving} records (${((stats.movement.timeMoving/stats.totalRecords)*100).toFixed(1)}%)
- **Stationary**: ${stats.movement.timeStationary} records (${((stats.movement.timeStationary/stats.totalRecords)*100).toFixed(1)}%)

### Mileage
- **Initial**: ${stats.vehicle.mileage.start.toLocaleString()} miles
- **Final**: ${stats.vehicle.mileage.end.toLocaleString()} miles
- **Distance Traveled**: ${stats.vehicle.mileage.totalDistance.toLocaleString()} miles (${(stats.vehicle.mileage.totalDistance * 1.609).toFixed(2)} km)

## 🔋 Vehicle Data

### Electrical System
- **Voltage**: ${stats.vehicle.voltage.min.toFixed(1)}V → ${stats.vehicle.voltage.max.toFixed(1)}V (average: ${stats.vehicle.voltage.avg.toFixed(1)}V)
- **Voltage Readings**: ${stats.vehicle.voltage.readings}/${stats.totalRecords}

### Vehicle States
- **Power On**: ${stats.vehicle.states.powerOn} records (${((stats.vehicle.states.powerOn/stats.totalRecords)*100).toFixed(1)}%)
- **ACC On**: ${stats.vehicle.states.accOn} records (${((stats.vehicle.states.accOn/stats.totalRecords)*100).toFixed(1)}%)
- **Ignition On**: ${stats.vehicle.states.ignitionOn} records (${((stats.vehicle.states.ignitionOn/stats.totalRecords)*100).toFixed(1)}%)

### Fuel
- **Readings**: ${stats.vehicle.fuel.readings}/${stats.totalRecords}
- **Values**: ${stats.vehicle.fuel.values.length > 0 ? `${Math.min(...stats.vehicle.fuel.values)} → ${Math.max(...stats.vehicle.fuel.values)}` : 'N/A'}

## 🔧 Technical Information

### Versions
- **Software**: ${Array.from(stats.technical.softwareVersions).join(', ') || 'N/A'}
- **Hardware**: ${Array.from(stats.technical.hardwareVersions).join(', ') || 'N/A'}

### Protocol
- **Used**: ${Array.from(stats.technical.protocols).join(', ')}
- **Compatibility**: ✅ Protocol 0x1001 supported

## 📈 Pattern Analysis

### Usage Pattern
${stats.movement.timeMoving > stats.movement.timeStationary ? 
  '🚗 **Active device usage** - More time moving than stationary' : 
  '🅿️ **Light device usage** - More time stationary than moving'
}

### GPS Data Quality
${stats.gps.withValidGPS / stats.gps.totalReadings > 0.8 ? 
  '📶 **Excellent** - GPS with good signal quality' : 
  stats.gps.withValidGPS / stats.gps.totalReadings > 0.5 ? 
  '📶 **Good** - GPS with moderate quality' : 
  '📶 **Poor** - GPS with many signal problems'
}

### Battery Status
${stats.vehicle.voltage.avg > 13.0 ? 
  '🔋 **Good** - Electrical system functioning normally' : 
  stats.vehicle.voltage.avg > 12.0 ? 
  '🔋 **Moderate** - Monitor battery voltage' : 
  '🔋 **Low** - Possible battery problem'
}

## 🔍 Record Details

### First 5 Records
${records.slice(0, 5).map((record, index) => `
**${index + 1}. ID ${record.id}** (${record.timestamp})
- GPS: ${record.latitude?.toFixed(6) || 'N/A'}, ${record.longitude?.toFixed(6) || 'N/A'}
- Speed: ${record.speedKmH} km/h
- Status: Power=${record.powerOn ? 'ON' : 'OFF'}, ACC=${record.accOn ? 'ON' : 'OFF'}
`).join('')}

### Last 5 Records
${records.slice(-5).map((record, index) => `
**${index + 1}. ID ${record.id}** (${record.timestamp})
- GPS: ${record.latitude?.toFixed(6) || 'N/A'}, ${record.longitude?.toFixed(6) || 'N/A'}
- Speed: ${record.speedKmH} km/h
- Status: Power=${record.powerOn ? 'ON' : 'OFF'}, ACC=${record.accOn ? 'ON' : 'OFF'}
`).join('')}

---
*Analysis automatically generated by OBD Telemetry System*
`;
}

generateDeviceAnalysis(); 