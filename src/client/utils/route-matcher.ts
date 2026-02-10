// Função auxiliar para calcular distância Haversine (copiada de distance-calculator)
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
 * Processa uma rota GPS aplicando filtros e suavização LOCALMENTE
 * (SEM chamar OSRM - isso deve ser feito no backend)
 * 
 * NOTA: Esta função NÃO faz snap-to-road. Para snap-to-road, use o endpoint
 * /api/positions/route no backend.
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
 * Snap-to-road usando OSRM (Open Source Routing Machine)
 * Serviço público gratuito - não requer API key
 */
export async function snapToRoadsOSRM(points: GPSPoint[]): Promise<GPSPoint[]> {
  if (points.length < 2) return points;

  try {
    // Formatar coordenadas para OSRM (lon,lat)
    const coordinates = points.map(p => `${p.longitude},${p.latitude}`).join(';');
    
    // OSRM Match API - alinha pontos GPS com a rede viária
    const url = `https://router.project-osrm.org/match/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    
    console.log(`🛣️ Chamando OSRM para ${points.length} pontos...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.matchings || data.matchings.length === 0) {
      console.warn('⚠️ OSRM não retornou match válido, usando processamento local');
      return processRouteForMapMatching(points);
    }
    
    // Extrair geometria da rota matched
    const matchedGeometry = data.matchings[0].geometry;
    
    if (!matchedGeometry || !matchedGeometry.coordinates) {
      console.warn('⚠️ OSRM não retornou geometria válida, usando processamento local');
      return processRouteForMapMatching(points);
    }
    
    // Converter coordenadas OSRM (lon,lat) para nosso formato (lat,lon)
    const snappedPoints: GPSPoint[] = matchedGeometry.coordinates.map((coord: [number, number], index: number) => {
      const originalPoint = points[Math.min(index, points.length - 1)];
      return {
        latitude: coord[1], // OSRM retorna [lon, lat], precisamos [lat, lon]
        longitude: coord[0],
        timestamp: originalPoint.timestamp,
        speed: originalPoint.speed,
      };
    });
    
    console.log(`✅ OSRM processou: ${points.length} → ${snappedPoints.length} pontos`);
    
    return snappedPoints;
  } catch (error) {
    console.error('❌ Erro ao chamar OSRM:', error);
    console.warn('⚠️ Fallback para processamento local');
    return processRouteForMapMatching(points);
  }
}

/**
 * Snap-to-road usando Google Maps Roads API
 * Requer API key - mais preciso que OSRM
 */
export async function snapToRoadsGoogle(
  points: GPSPoint[],
  apiKey: string
): Promise<GPSPoint[]> {
  if (points.length < 2) return points;

  try {
    // Google Maps Roads API aceita até 100 pontos por requisição
    const maxPoints = 100;
    const batches: GPSPoint[][] = [];
    
    for (let i = 0; i < points.length; i += maxPoints) {
      batches.push(points.slice(i, i + maxPoints));
    }
    
    const allSnappedPoints: GPSPoint[] = [];
    
    for (const batch of batches) {
      // Formatar coordenadas para Google Maps (lat,lng)
      const path = batch.map(p => `${p.latitude},${p.longitude}`).join('|');
      
      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${apiKey}`;
      
      console.log(`🛣️ Chamando Google Maps Roads API para ${batch.length} pontos...`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.snappedPoints || data.snappedPoints.length === 0) {
        console.warn('⚠️ Google Maps não retornou pontos válidos para este batch');
        allSnappedPoints.push(...batch);
        continue;
      }
      
      // Converter pontos snapped para nosso formato
      const snappedBatch: GPSPoint[] = data.snappedPoints.map((snapped: any, index: number) => {
        const originalPoint = batch[Math.min(index, batch.length - 1)];
        return {
          latitude: snapped.location.latitude,
          longitude: snapped.location.longitude,
          timestamp: originalPoint.timestamp,
          speed: originalPoint.speed,
        };
      });
      
      allSnappedPoints.push(...snappedBatch);
    }
    
    console.log(`✅ Google Maps processou: ${points.length} → ${allSnappedPoints.length} pontos`);
    
    return allSnappedPoints;
  } catch (error) {
    console.error('❌ Erro ao chamar Google Maps Roads API:', error);
    console.warn('⚠️ Fallback para processamento local');
    return processRouteForMapMatching(points);
  }
}

/**
 * Snap-to-road inteligente: tenta OSRM primeiro, depois Google Maps se tiver API key
 * Fallback para processamento local se ambos falharem
 */
export async function snapToRoads(
  points: GPSPoint[],
  options: {
    useOSRM?: boolean;
    useGoogleMaps?: boolean;
    googleMapsApiKey?: string;
  } = {}
): Promise<GPSPoint[]> {
  const { useOSRM = true, useGoogleMaps = false, googleMapsApiKey } = options;
  
  // Se tiver Google Maps API key e estiver habilitado, usar primeiro (mais preciso)
  if (useGoogleMaps && googleMapsApiKey) {
    try {
      return await snapToRoadsGoogle(points, googleMapsApiKey);
    } catch (error) {
      console.warn('⚠️ Google Maps falhou, tentando OSRM...');
    }
  }
  
  // Tentar OSRM (gratuito, não requer API key)
  if (useOSRM) {
    try {
      return await snapToRoadsOSRM(points);
    } catch (error) {
      console.warn('⚠️ OSRM falhou, usando processamento local...');
    }
  }
  
  // Fallback: processamento local (filtros + suavização)
  return processRouteForMapMatching(points);
}
