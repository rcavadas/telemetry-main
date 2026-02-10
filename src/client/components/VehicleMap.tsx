import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { processRouteForMapMatching, GPSPoint } from '../utils/route-matcher';

interface GPSReading {
  latitude: number;
  longitude: number;
  speedKmH?: number;
  direction?: number;
  timestamp: string;
  deviceId: string;
}

interface VehicleMapProps {
  selectedVehicle?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

interface PlaybackPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed: number;
  course: number;
  deviceId: string;
}

export default function VehicleMap({ selectedVehicle, dateFrom, dateTo }: VehicleMapProps = {}) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeArrowsRef = useRef<L.Layer[]>([]);
  const playbackMarkerRef = useRef<L.Marker | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const routePointsRef = useRef<PlaybackPoint[]>([]);
  
  const [status, setStatus] = useState('📍 Carregando veículos...');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x

  const getSpeedColor = (spd: number): string => {
    if (!Number.isFinite(spd) || spd <= 0) return '#6c757d'; // Gray parado/indefinido
    if (spd < 30) return '#007bff';  // Blue
    if (spd < 60) return '#28a745';  // Green
    if (spd < 90) return '#ffc107';  // Yellow
    return '#dc3545';                // Red
  };

  const renderTraccarArrowSvg = (opts: { size: number; rotationDeg: number; fill: string; opacity?: number }) => {
    const { size, rotationDeg, fill, opacity = 1 } = opts;
    // Traccar usa heading/course como 0° = Norte (para cima). Nosso SVG base aponta para Leste (direita).
    // Então aplicamos offset de -90° para alinhar a orientação.
    const adjustedRotation = rotationDeg - 90;
    // Shape inspirada no “pointer/arrow” do Traccar (triangular com cauda curta)
    // ViewBox 24x24 facilita alinhamento e stroke consistente
    const path = 'M12 2 L21 12 L12 22 L12 16 L3 12 L12 8 Z';
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24"
           style="transform: rotate(${adjustedRotation}deg);
                  transform-origin: 50% 50%;
                  opacity: ${opacity};
                  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.28));">
        <!-- borda externa sutil -->
        <path d="${path}" fill="${fill}" stroke="rgba(0,0,0,0.18)" stroke-width="2.2" stroke-linejoin="round"/>
        <!-- contorno branco (por cima) -->
        <path d="${path}" fill="${fill}" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>
    `;
  };

  /**
   * Ícone especial para o ponto em playback:
   * - seta maior
   * - anel externo com brilho
   * - borda mais forte para se destacar no meio das outras
   */
  const renderPlaybackArrowSvg = (opts: { size: number; rotationDeg: number; fill: string; opacity?: number }) => {
    const { size, rotationDeg, fill, opacity = 1 } = opts;
    const adjustedRotation = rotationDeg - 90;
    const path = 'M12 2 L21 12 L12 22 L12 16 L3 12 L12 8 Z';
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 32 32"
           style="transform: rotate(${adjustedRotation}deg);
                  transform-origin: 50% 50%;
                  opacity: ${opacity};
                  filter: drop-shadow(0 0 6px rgba(0,0,0,0.45));">
        <!-- anel externo para destacar o ponto atual -->
        <circle cx="16" cy="16" r="14"
                fill="rgba(255,255,255,0.15)"
                stroke="${fill}"
                stroke-width="2.4" />
        <!-- halo interno -->
        <circle cx="16" cy="16" r="9"
                fill="rgba(255,255,255,0.85)"
                stroke="${fill}"
                stroke-width="1.4" />
        <!-- seta principal -->
        <g transform="translate(4,4)">
          <path d="${path}" fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="${path}" fill="${fill}" stroke="white" stroke-width="1.6" stroke-linejoin="round"/>
        </g>
      </svg>
    `;
  };

  // Bearing (graus) entre dois pontos (0..360)
  const computeBearingDeg = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  };

  // Seleciona índices para colocar setas a cada ~X metros (com limite)
  const pickArrowIndicesByDistance = (
    points: Array<{ latitude: number; longitude: number }>,
    minMetersBetweenArrows: number,
    maxArrows: number,
  ): number[] => {
    if (points.length < 2) return [];
    const indices: number[] = [];
    let accumulated = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.longitude - a.longitude;
      const dy = b.latitude - a.latitude;
      // Aproximação rápida para evitar custo alto (bom o suficiente para amostragem)
      const approxMeters = Math.sqrt(dx * dx + dy * dy) * 111_320;
      accumulated += approxMeters;
      if (accumulated >= minMetersBetweenArrows) {
        indices.push(i);
        accumulated = 0;
        if (indices.length >= maxArrows) break;
      }
    }
    return indices;
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log('🗺️ Inicializando mapa...');
    
    // Initialize map
    const map = L.map(mapContainerRef.current).setView([-22.9068, -43.1729], 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    console.log('✅ Mapa inicializado, carregando veículos...');
    
    // Aguardar um pouco para garantir que o mapa está totalmente renderizado
    setTimeout(() => {
      loadVehicleLocations();
    }, 100);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Reload map when selected vehicle or período muda
  useEffect(() => {
    if (mapRef.current && selectedVehicle !== undefined) {
      console.log('🔄 Veículo/período selecionado mudou:', {
        selectedVehicle,
        dateFrom,
        dateTo,
      });
      // Reset playback quando muda veículo/período
      setIsPlaying(false);
      setCurrentPlaybackIndex(0);
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      loadVehicleLocations();
    }
  }, [selectedVehicle, dateFrom, dateTo]);

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  // Função para atualizar a posição do playback
  const updatePlaybackPosition = useCallback((index: number) => {
    if (!mapRef.current || routePointsRef.current.length === 0) return;

    const point = routePointsRef.current[index];
    if (!point) return;

    const color = getSpeedColor(point.speed);
    const size = point.speed > 0 ? 32 : 26; // um pouco maior que os demais

    // Criar/atualizar marcador na posição atual do playback (sem remover/recriar para evitar flicker)
    const arrowIcon = L.divIcon({
      className: 'arrow-marker-traccar',
      html: renderPlaybackArrowSvg({ size, rotationDeg: point.course, fill: color, opacity: 1 }),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const popupHtml = `
      <div style="min-width: 220px; font-family: Arial, sans-serif;">
        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">
          🚗 ${point.deviceId}
        </h3>
        <div style="font-size: 13px; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>📍 Coordenadas:</strong><br>
             ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}</p>
          <p style="margin: 4px 0;"><strong>⚡ Velocidade:</strong> 
             <span style="color: ${color}; font-weight: bold;">${point.speed.toFixed(1)} km/h</span></p>
          ${point.course > 0 ? `<p style="margin: 4px 0;"><strong>🧭 Direção:</strong> ${point.course.toFixed(0)}°</p>` : ''}
          <p style="margin: 4px 0;"><strong>⏰ Data/Hora:</strong><br>
             ${new Date(point.timestamp).toLocaleString('pt-BR')}</p>
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 4px;">
             📍 Playback: ${index + 1} / ${routePointsRef.current.length}
          </p>
        </div>
      </div>
    `;

    if (!playbackMarkerRef.current) {
      const marker = L.marker([point.latitude, point.longitude], { icon: arrowIcon });
      marker.bindPopup(popupHtml);
      marker.addTo(mapRef.current);
      playbackMarkerRef.current = marker;
    } else {
      playbackMarkerRef.current.setLatLng([point.latitude, point.longitude]);
      playbackMarkerRef.current.setIcon(arrowIcon);
      playbackMarkerRef.current.setPopupContent(popupHtml);
    }

    // Centralizar mapa na posição atual (com suavização)
    mapRef.current.setView([point.latitude, point.longitude], mapRef.current.getZoom(), {
      animate: true,
      duration: 0.3,
    });
  }, []);

  // Controles de playback
  const handlePlayPause = useCallback(() => {
    if (routePointsRef.current.length === 0) return;

    if (isPlaying) {
      // Pausar
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Reproduzir
      setIsPlaying(true);
      
      // Se chegou ao fim, voltar ao início
      if (currentPlaybackIndex >= routePointsRef.current.length - 1) {
        setCurrentPlaybackIndex(0);
        updatePlaybackPosition(0);
      }

      // Calcular intervalo baseado na velocidade (1x = 500ms, 2x = 250ms, 4x = 125ms)
      const baseInterval = 500;
      const interval = baseInterval / playbackSpeed;

      playbackIntervalRef.current = setInterval(() => {
        setCurrentPlaybackIndex((prev) => {
          const next = prev + 1;
          if (next >= routePointsRef.current.length) {
            // Chegou ao fim, pausar
            if (playbackIntervalRef.current) {
              clearInterval(playbackIntervalRef.current);
              playbackIntervalRef.current = null;
            }
            setIsPlaying(false);
            return prev;
          }
          updatePlaybackPosition(next);
          return next;
        });
      }, interval);
    }
  }, [isPlaying, currentPlaybackIndex, playbackSpeed, updatePlaybackPosition]);

  const handleGoToStart = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPlaybackIndex(0);
    updatePlaybackPosition(0);
  }, [updatePlaybackPosition]);

  const handleGoToEnd = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    const lastIndex = Math.max(0, routePointsRef.current.length - 1);
    setCurrentPlaybackIndex(lastIndex);
    updatePlaybackPosition(lastIndex);
  }, [updatePlaybackPosition]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPlaybackIndex(newIndex);
    updatePlaybackPosition(newIndex);
  }, [updatePlaybackPosition]);

  const loadVehicleLocations = async () => {
    if (!mapRef.current) {
      console.warn('Mapa não inicializado ainda');
      return;
    }

    try {
      setStatus('📍 Carregando veículos...');
      
      // Quando há veículo selecionado, usar endpoint de rota processada (com cache e snap-to-road)
      // com suporte a filtros de período (from/to). Quando não há seleção, usar endpoint de últimas posições.
      let url = '/api/positions';
      if (selectedVehicle) {
        const params = new URLSearchParams();
        params.set('deviceId', selectedVehicle);
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        url = `/api/positions/route?${params.toString()}`;
      }

      console.log('🔍 Buscando posições:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('❌ Erro na resposta:', response.status, response.statusText);
        setStatus(`❌ Erro ao carregar: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      console.log('📦 Dados recebidos da API:', data);

      // O endpoint retorna formatos diferentes:
      // - /api/positions: { success: true, data: { positions: [...], count: ... } }
      // - /api/positions/route: { success: true, data: { processedRoute: [...], cached: true/false } }
      let positions: any[] = [];
      let isProcessedRoute = false;
      
      if (data.success && data.data) {
        if (data.data.processedRoute) {
          // Endpoint de rota processada (já vem com snap-to-road do backend)
          isProcessedRoute = true;
          positions = data.data.processedRoute.map((p: any) => ({
            deviceId: data.data.deviceId,
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            speed: p.speed || 0,
            course: 0, // Será calculado depois
          }));
          console.log(`✅ Rota processada recebida do backend (cache: ${data.data.cached ? 'sim' : 'não'})`);
        } else if (data.data.positions) {
          // Endpoint de posições normais
          positions = data.data.positions;
        } else if (Array.isArray(data.data)) {
          positions = data.data;
        }
      } else if (data.positions) {
        positions = Array.isArray(data.positions) ? data.positions : [];
      } else if (Array.isArray(data)) {
        positions = data;
      }

      if (!Array.isArray(positions) || positions.length === 0) {
        setStatus('⚠️ Nenhum dado GPS disponível');
        console.warn('⚠️ Nenhuma posição encontrada. Resposta da API:', data);
        return;
      }

      console.log(`✅ ${positions.length} posição(ões) encontrada(s)`);

      // Limpar marcadores, setas de rota e polylines existentes
      markersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
      markersRef.current = [];

      routeArrowsRef.current.forEach(layer => mapRef.current?.removeLayer(layer));
      routeArrowsRef.current = [];
      
      // Limpar todas as polylines
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
          mapRef.current?.removeLayer(layer);
        }
      });

      // Group by device
      const byDevice: Record<string, any[]> = {};
      positions.forEach((pos: any) => {
        const deviceId = pos.deviceId || pos.device_id;
        if (!deviceId) return;
        if (!byDevice[deviceId]) byDevice[deviceId] = [];
        byDevice[deviceId].push(pos);
      });

      const bounds = L.latLngBounds([]);
      let totalPoints = 0;
      let vehiclesWithGPS = 0;

      console.log(`📊 Agrupando por dispositivo: ${Object.keys(byDevice).length} dispositivo(s)`);

      // Processar cada dispositivo de forma assíncrona
      for (const [deviceId, devicePositions] of Object.entries(byDevice)) {
        // Ordenar pontos por tempo (como no Traccar)
        devicePositions.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        // Filtrar pontos válidos
        const validPoints = devicePositions.filter(
          (p: any) => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0
        );

        if (validPoints.length === 0) {
          console.warn(`⚠️ Dispositivo ${deviceId} não tem pontos GPS válidos`);

          // Se for o veículo selecionado, informar claramente no status do mapa
          if (selectedVehicle && deviceId === selectedVehicle) {
            setStatus('⚠️ Veículo selecionado não possui pontos GPS válidos (coordenadas limpas como inválidas).');
          }

          continue;
        }

        console.log(`✅ Dispositivo ${deviceId}: ${validPoints.length} ponto(s) válido(s)`);
        vehiclesWithGPS++;

        // Se veículo está selecionado, os pontos já vêm processados do backend (com snap-to-road)
        // Se não está selecionado, usar pontos originais (últimas posições) sem processamento pesado
        let processedPoints = validPoints;
        
        // Apenas aplicar filtros básicos locais se NÃO for rota processada do backend
        // (para visualização geral de múltiplos veículos, sem chamar OSRM)
        if (!isProcessedRoute && !selectedVehicle) {
          const gpsPoints: GPSPoint[] = validPoints.map((p: any) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            speed: p.speed || p.speedKmH || 0,
          }));

          // Aplicar apenas filtros básicos locais (SEM snap-to-road)
          processedPoints = processRouteForMapMatching(gpsPoints, {
            filterOutliers: true,
            maxOutlierDistance: 1000,
            interpolate: false,
            smooth: false,
          });
        }
        // Se isProcessedRoute === true, os pontos já vêm processados do backend

        // Draw polyline (rota)
        // - Para o veículo selecionado com rota processada, a linha acompanha a cor da velocidade,
        //   assim como no Traccar (segmentos coloridos).
        // - Para visualização geral (sem veículo selecionado), usamos uma linha única azul.
        const routePoints = processedPoints.map((p) => 
          [p.latitude, p.longitude] as [number, number]
        );

        if (routePoints.length > 1) {
          const isSelectedRoute = !!selectedVehicle && deviceId === selectedVehicle && isProcessedRoute;

          if (isSelectedRoute) {
            // Segmenta a rota e colore cada trecho pela velocidade do ponto posterior (Traccar-like)
            for (let i = 1; i < processedPoints.length; i++) {
              const a: any = processedPoints[i - 1];
              const b: any = processedPoints[i];
              const segSpeed = (b.speed ?? b.speedKmH ?? 0) as number;
              const segColor = getSpeedColor(segSpeed);

              L.polyline(
                [
                  [a.latitude, a.longitude] as [number, number],
                  [b.latitude, b.longitude] as [number, number],
                ],
                {
                  color: segColor,
                  weight: 3,
                  opacity: 0.9,
                  smoothFactor: 1.0,
                },
              ).addTo(mapRef.current!);
            }
          } else {
            // Linha única azul para demais casos
            L.polyline(routePoints, {
              color: '#3b82f6',
              weight: 3,
              opacity: 0.6,
              smoothFactor: 1.0,
            }).addTo(mapRef.current!);
          }
        }

        // Preparar pontos para playback (apenas para veículo selecionado)
        if (selectedVehicle && deviceId === selectedVehicle && processedPoints.length > 1) {
          // Armazenar pontos para playback
          const playbackPoints: PlaybackPoint[] = [];
          let lastCourse = 0;
          
          for (let i = 0; i < processedPoints.length; i++) {
            const p: any = processedPoints[i];
            const prevP: any = i > 0 ? processedPoints[i - 1] : p;
            
            const speed = (p.speed ?? p.speedKmH ?? 0) as number;

            // Se o ponto atual e o anterior estão praticamente na mesma posição,
            // reutilizar o último curso conhecido para evitar "pulo" de direção.
            let course: number;
            const sameLat = p.latitude === prevP.latitude;
            const sameLon = p.longitude === prevP.longitude;
            if (i > 0 && sameLat && sameLon) {
              course = lastCourse;
            } else if (i > 0) {
              course = computeBearingDeg(prevP.latitude, prevP.longitude, p.latitude, p.longitude);
              lastCourse = course;
            } else {
              // Primeiro ponto: tentar usar direção vinda do backend, senão manter 0
              course = (p.course || p.direction || lastCourse || 0);
              lastCourse = course;
            }
            
            playbackPoints.push({
              latitude: p.latitude,
              longitude: p.longitude,
              timestamp: p.timestamp,
              speed,
              course,
              deviceId,
            });
          }
          
          routePointsRef.current = playbackPoints;
          
          // Se não está em playback, mostrar todas as setas da rota
          // Durante o playback, apenas a seta principal (playbackMarkerRef) será visível
          if (!isPlaying) {
            const maxArrows = 2000; // limite de segurança

            for (let i = 1; i < processedPoints.length && i < maxArrows; i++) {
              const p0: any = processedPoints[i - 1];
              const p1: any = processedPoints[i];

              // Ignorar segmentos degenerados
              if (
                p0.latitude === p1.latitude &&
                p0.longitude === p1.longitude
              ) {
                continue;
              }

              const bearing = computeBearingDeg(p0.latitude, p0.longitude, p1.latitude, p1.longitude);
              const spd = (p1.speed ?? p1.speedKmH ?? 0) as number;
              const color = getSpeedColor(spd);
              const size = 16;

              const arrowIcon = L.divIcon({
                className: 'arrow-marker-traccar',
                html: renderTraccarArrowSvg({ size, rotationDeg: bearing, fill: color, opacity: 0.95 }),
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
              });

              const arrowMarker = L.marker([p1.latitude, p1.longitude], { icon: arrowIcon });
              arrowMarker.addTo(mapRef.current!);
              routeArrowsRef.current.push(arrowMarker);
            }
          } else {
            // Durante o playback, ocultar todas as setas da rota (exceto a principal)
            routeArrowsRef.current.forEach(arrow => mapRef.current?.removeLayer(arrow));
            routeArrowsRef.current = [];
          }
        } else {
          // Limpar pontos de playback se não é o veículo selecionado
          routePointsRef.current = [];
        }

        // Última posição com destaque maior (como no Traccar)
        // Só mostrar se não estiver em modo playback para o veículo selecionado
        if (!(isPlaying && deviceId === selectedVehicle)) {
          const lastPosition: any = validPoints[validPoints.length - 1];
          const speed = (lastPosition.speed || lastPosition.speedKmH || 0) as number;
          const course = (lastPosition.course || lastPosition.direction || 0) as number;
          const color = getSpeedColor(speed);
          const size = speed > 0 ? 28 : 20; // Maior quando em movimento

          // Criar ícone de seta (estilo Traccar)
          const arrowIcon = L.divIcon({
            className: 'arrow-marker-traccar',
            html: renderTraccarArrowSvg({ size, rotationDeg: course, fill: color, opacity: 1 }),
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });

          const marker = L.marker([lastPosition.latitude, lastPosition.longitude], {
            icon: arrowIcon,
          }).addTo(mapRef.current!);

          marker.bindPopup(`
            <div style="min-width: 220px; font-family: Arial, sans-serif;">
              <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">
                🚗 ${deviceId}
              </h3>
              <div style="font-size: 13px; line-height: 1.6;">
                <p style="margin: 4px 0;"><strong>📍 Coordenadas:</strong><br>
                   ${lastPosition.latitude.toFixed(6)}, ${lastPosition.longitude.toFixed(6)}</p>
                <p style="margin: 4px 0;"><strong>⚡ Velocidade:</strong> 
                   <span style="color: ${color}; font-weight: bold;">${speed.toFixed(1)} km/h</span></p>
                ${course > 0 ? `<p style="margin: 4px 0;"><strong>🧭 Direção:</strong> ${course.toFixed(0)}°</p>` : ''}
                ${lastPosition.satellites ? `<p style="margin: 4px 0;"><strong>🛰️ Satélites:</strong> ${lastPosition.satellites}</p>` : ''}
                <p style="margin: 4px 0;"><strong>⏰ Data/Hora:</strong><br>
                   ${new Date(lastPosition.timestamp).toLocaleString('pt-BR')}</p>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 4px;">
                   📍 Última posição de ${validPoints.length} ponto(s) registrado(s)
                </p>
              </div>
            </div>
          `);

          markersRef.current.push(marker);
        }
        
        bounds.extend([validPoints[validPoints.length - 1].latitude, validPoints[validPoints.length - 1].longitude]);
        totalPoints += validPoints.length;
      }

      // Se é rota processada (backend) e nenhum ponto válido passou pelo filtro, mostrar motivo
      if (selectedVehicle && isProcessedRoute && vehiclesWithGPS === 0) {
        setStatus('⚠️ Veículo selecionado não possui pontos GPS válidos para desenhar a rota.');
        return;
      }

      // Ajustar zoom do mapa
      if (selectedVehicle && byDevice[selectedVehicle] && byDevice[selectedVehicle].length > 0) {
        const selectedPositions = byDevice[selectedVehicle].filter(
          (p: any) => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0
        );
        
        if (selectedPositions.length > 0) {
          const selectedPoints = selectedPositions.map((p: any) => 
            [p.latitude, p.longitude] as [number, number]
          );
          const selectedBounds = L.latLngBounds(selectedPoints);
          mapRef.current.fitBounds(selectedBounds, { padding: [50, 50], maxZoom: 16 });
        }
      } else if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }

      setStatus(
        `✅ ${totalPoints} ponto(s) GPS de ${vehiclesWithGPS} veículo(s) carregado(s)`
      );

      // Se há pontos para playback e não está em modo playback, inicializar posição
      if (selectedVehicle && routePointsRef.current.length > 0 && !isPlaying) {
        updatePlaybackPosition(0);
      }
    } catch (error) {
      console.error('Error loading vehicle locations:', error);
      setStatus('❌ Erro ao carregar localizações');
    }
  };

  // Atualizar posição do playback quando o índice muda manualmente
  useEffect(() => {
    if (routePointsRef.current.length > 0 && !isPlaying) {
      updatePlaybackPosition(currentPlaybackIndex);
    }
  }, [currentPlaybackIndex, isPlaying, updatePlaybackPosition]);

  // Quando o playback para, recarregar as setas da rota
  useEffect(() => {
    if (!isPlaying && selectedVehicle && routePointsRef.current.length > 0 && mapRef.current) {
      // Recarregar apenas as setas da rota (sem recarregar tudo)
      const processedPoints = routePointsRef.current.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp,
        speed: p.speed,
        speedKmH: p.speed,
        course: p.course,
        direction: p.course,
      }));

      // Limpar setas antigas
      routeArrowsRef.current.forEach(arrow => mapRef.current?.removeLayer(arrow));
      routeArrowsRef.current = [];

      // Redesenhar todas as setas
      const maxArrows = 2000;
      for (let i = 1; i < processedPoints.length && i < maxArrows; i++) {
        const p0 = processedPoints[i - 1];
        const p1 = processedPoints[i];

        if (p0.latitude === p1.latitude && p0.longitude === p1.longitude) {
          continue;
        }

        const bearing = computeBearingDeg(p0.latitude, p0.longitude, p1.latitude, p1.longitude);
        const color = getSpeedColor(p1.speed);
        const size = 16;

        const arrowIcon = L.divIcon({
          className: 'arrow-marker-traccar',
          html: renderTraccarArrowSvg({ size, rotationDeg: bearing, fill: color, opacity: 0.95 }),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const arrowMarker = L.marker([p1.latitude, p1.longitude], { icon: arrowIcon });
        arrowMarker.addTo(mapRef.current!);
        routeArrowsRef.current.push(arrowMarker);
      }
    }
  }, [isPlaying, selectedVehicle]);

  const hasPlaybackData = routePointsRef.current.length > 0 && selectedVehicle;

  return (
    <div className="w-full h-full relative">
      {/* Contêiner do mapa em tela cheia */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
      />

      {/* Botão de atualizar mapa (canto superior direito) */}
      <button
        onClick={loadVehicleLocations}
        className="btn-primary absolute top-4 right-4 z-[1000] text-sm py-2 px-4"
      >
        🔄 Atualizar Mapa
      </button>

      {/* Status e legenda de velocidade (canto inferior esquerdo) */}
      <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="px-4 py-2 bg-green-50/95 text-green-800 rounded-lg text-sm font-medium shadow-md">
          {status}
        </div>
        <div className="flex gap-3 text-[11px] bg-white/90 rounded-lg px-3 py-1.5 shadow-md items-center">
          <span className="text-gray-600 font-semibold mr-1">Velocidade:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>0-30 km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>30-60 km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>60-90 km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>90+ km/h</span>
          </div>
        </div>
      </div>

      {/* Controles de Playback (barra inferior, estilo Traccar) */}
      {hasPlaybackData && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1100] glass-effect rounded-2xl shadow-2xl border border-white/40 px-4 py-3 min-w-[600px]">
          <div className="flex items-center gap-3">
            {/* Botão Início */}
            <button
              onClick={handleGoToStart}
              disabled={currentPlaybackIndex === 0}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              title="Ir para o início"
            >
              ⏮
            </button>

            {/* Botão Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isPlaying ? '⏸' : '▶'}
              <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
            </button>

            {/* Botão Fim */}
            <button
              onClick={handleGoToEnd}
              disabled={currentPlaybackIndex >= routePointsRef.current.length - 1}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              title="Ir para o fim"
            >
              ⏭
            </button>

            {/* Slider de posição */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={Math.max(0, routePointsRef.current.length - 1)}
                value={currentPlaybackIndex}
                onChange={handleSliderChange}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-gray-600 min-w-[80px] text-right">
                {currentPlaybackIndex + 1} / {routePointsRef.current.length}
              </span>
            </div>

            {/* Seletor de velocidade */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Velocidade:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => {
                  const newSpeed = parseInt(e.target.value, 10);
                  setPlaybackSpeed(newSpeed);
                  // Se está reproduzindo, reiniciar com nova velocidade
                  if (isPlaying) {
                    handlePlayPause(); // Pausar
                    setTimeout(() => handlePlayPause(), 100); // Reproduzir com nova velocidade
                  }
                }}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
              </select>
            </div>

            {/* Informação de tempo (opcional) */}
            {routePointsRef.current[currentPlaybackIndex] && (
              <div className="text-xs text-gray-600 min-w-[140px] text-right">
                {new Date(routePointsRef.current[currentPlaybackIndex].timestamp).toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
