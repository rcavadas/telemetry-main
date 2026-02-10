import { haversineDistanceMeters } from './distance-calculator';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
}

/**
 * Filtra outliers GPS - remove pontos que estão muito longe dos outros
 */
export function filterOutliers(points: GPSPoint[], maxDistanceMeters: number = 1000): GPSPoint[] {
  if (points.length <= 2) return points;

  const filtered: GPSPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];

    const distance = haversineDistanceMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const timeDiffHours = timeDiff / (1000 * 60 * 60);
    const requiredSpeed = timeDiffHours > 0 ? distance / (timeDiffHours * 1000) : Infinity;

    if (distance > maxDistanceMeters && requiredSpeed > 200) {
      continue;
    }

    filtered.push(curr);
  }

  return filtered;
}

/**
 * Snap-to-road usando OSRM (Open Source Routing Machine)
 */
export async function snapToRoadsOSRM(points: GPSPoint[]): Promise<GPSPoint[]> {
  if (points.length < 2) return points;

  try {
    const coordinates = points.map(p => `${p.longitude},${p.latitude}`).join(';');
    const url = `https://router.project-osrm.org/match/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    
    // Usar https nativo do Node.js para compatibilidade
    const https = require('https');
    const { URL } = require('url');
    
    // Node.js 18+ tem fetch nativo
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OBD-Telemetry-Server/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }
    
    const data: any = await response.json();
    
    if (data.code !== 'Ok' || !data.matchings || data.matchings.length === 0) {
      return points; // Retornar pontos originais se OSRM falhar
    }
    
    const matchedGeometry = data.matchings[0].geometry;
    
    if (!matchedGeometry || !matchedGeometry.coordinates) {
      return points;
    }
    
    const snappedPoints: GPSPoint[] = matchedGeometry.coordinates.map((coord: [number, number], index: number) => {
      const originalPoint = points[Math.min(index, points.length - 1)];
      return {
        latitude: coord[1],
        longitude: coord[0],
        timestamp: originalPoint.timestamp,
        speed: originalPoint.speed,
      };
    });
    
    return snappedPoints;
  } catch (error) {
    throw error;
  }
}

/**
 * Processa rota com map matching (filtros + snap-to-road)
 */
export async function processRouteForMapMatching(
  points: GPSPoint[],
  options: {
    filterOutliers?: boolean;
    maxOutlierDistance?: number;
    useOSRM?: boolean;
  } = {}
): Promise<GPSPoint[]> {
  let processed = [...points];

  // 1. Filtrar outliers
  if (options.filterOutliers !== false) {
    processed = filterOutliers(processed, options.maxOutlierDistance || 1000);
  }

  // 2. Snap-to-road usando OSRM
  if (options.useOSRM !== false && processed.length >= 2) {
    try {
      processed = await snapToRoadsOSRM(processed);
    } catch (error) {
      // Se OSRM falhar, retornar pontos filtrados
      const { Logger } = require('./logger');
      Logger.warn('OSRM falhou, retornando pontos filtrados', {
        error: error instanceof Error ? error.message : String(error),
        pointsCount: processed.length
      });
    }
  }

  return processed;
}
