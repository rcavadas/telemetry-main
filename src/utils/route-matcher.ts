import { haversineDistanceMeters } from './distance-calculator';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
}

/**
 * Filtra outliers GPS - remove pontos que estão muito longe dos outros
 * (indicando erros de GPS ou saltos de sinal)
 */
export function filterOutliers(points: GPSPoint[], maxDistanceMeters: number = 1000): GPSPoint[] {
  if (points.length <= 2) return points;

  const filtered: GPSPoint[] = [points[0]]; // Sempre manter o primeiro ponto

  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];

    const distance = haversineDistanceMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    // Calcular tempo entre pontos
    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const timeDiffHours = timeDiff / (1000 * 60 * 60);

    // Velocidade necessária para percorrer essa distância nesse tempo
    const requiredSpeed = timeDiffHours > 0 ? distance / (timeDiffHours * 1000) : Infinity; // km/h

    // Se a distância for muito grande OU a velocidade necessária for irreal (>200 km/h)
    // e a distância for maior que maxDistanceMeters, considerar outlier
    if (distance > maxDistanceMeters && requiredSpeed > 200) {
      console.warn(`⚠️ Ponto GPS filtrado (outlier): distância ${distance.toFixed(0)}m, velocidade necessária ${requiredSpeed.toFixed(0)} km/h`);
      continue;
    }

    filtered.push(curr);
  }

  return filtered;
}

/**
 * Interpola pontos entre coordenadas distantes para criar rotas mais suaves
 */
export function interpolateRoute(points: GPSPoint[], maxGapMeters: number = 500): GPSPoint[] {
  if (points.length <= 1) return points;

  const interpolated: GPSPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const distance = haversineDistanceMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    // Se a distância for muito grande, interpolar pontos intermediários
    if (distance > maxGapMeters) {
      const numInterpolations = Math.ceil(distance / maxGapMeters);
      const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();

      for (let j = 1; j < numInterpolations; j++) {
        const ratio = j / numInterpolations;
        const interpolatedPoint: GPSPoint = {
          latitude: prev.latitude + (curr.latitude - prev.latitude) * ratio,
          longitude: prev.longitude + (curr.longitude - prev.longitude) * ratio,
          timestamp: new Date(new Date(prev.timestamp).getTime() + timeDiff * ratio).toISOString(),
          speed: prev.speed && curr.speed 
            ? prev.speed + (curr.speed - prev.speed) * ratio 
            : prev.speed || curr.speed,
        };
        interpolated.push(interpolatedPoint);
      }
    }

    interpolated.push(curr);
  }

  return interpolated;
}

/**
 * Suaviza a rota usando média móvel simples
 */
export function smoothRoute(points: GPSPoint[], windowSize: number = 3): GPSPoint[] {
  if (points.length <= windowSize) return points;

  const smoothed: GPSPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, i + Math.ceil(windowSize / 2));

    let sumLat = 0;
    let sumLon = 0;
    let count = 0;

    for (let j = start; j < end; j++) {
      sumLat += points[j].latitude;
      sumLon += points[j].longitude;
      count++;
    }

    smoothed.push({
      ...points[i],
      latitude: sumLat / count,
      longitude: sumLon / count,
    });
  }

  return smoothed;
}

/**
 * Processa uma rota GPS aplicando filtros e suavização
 * para manter as linhas mais próximas das vias reais
 */
export function processRouteForMapMatching(
  points: GPSPoint[],
  options: {
    filterOutliers?: boolean;
    maxOutlierDistance?: number;
    interpolate?: boolean;
    maxGapMeters?: number;
    smooth?: boolean;
    smoothWindow?: number;
  } = {}
): GPSPoint[] {
  let processed = [...points];

  // 1. Filtrar outliers
  if (options.filterOutliers !== false) {
    processed = filterOutliers(processed, options.maxOutlierDistance || 1000);
  }

  // 2. Interpolar pontos distantes
  if (options.interpolate !== false) {
    processed = interpolateRoute(processed, options.maxGapMeters || 500);
  }

  // 3. Suavizar rota
  if (options.smooth !== false) {
    processed = smoothRoute(processed, options.smoothWindow || 3);
  }

  return processed;
}

/**
 * Prepara pontos para snap-to-road usando Google Maps Roads API
 * (requer API key - implementação futura)
 */
export async function snapToRoads(
  points: GPSPoint[],
  apiKey?: string
): Promise<GPSPoint[]> {
  if (!apiKey) {
    console.warn('⚠️ Google Maps API key não fornecida, usando processamento local');
    return processRouteForMapMatching(points);
  }

  // TODO: Implementar chamada à Google Maps Roads API
  // https://developers.google.com/maps/documentation/roads/snap-to-roads
  
  // Por enquanto, retorna processamento local
  return processRouteForMapMatching(points);
}
