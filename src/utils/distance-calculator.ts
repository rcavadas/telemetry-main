import { Logger } from './logger';

const EARTH_RADIUS_METERS = 6371000; // Raio médio da Terra em metros

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    lat1 === undefined || lon1 === undefined ||
    lat2 === undefined || lon2 === undefined
  ) {
    return 0;
  }

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METERS * c;

  if (!Number.isFinite(distance) || Number.isNaN(distance)) {
    Logger.warn('⚠️ Distância Haversine inválida calculada', {
      lat1,
      lon1,
      lat2,
      lon2,
      distance,
    });
    return 0;
  }

  return distance;
}

