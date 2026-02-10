import { useState, useEffect } from 'react';
import VehicleMap from '../components/VehicleMap';

interface Vehicle {
  deviceInfo: {
    deviceId: string;
    deviceType?: string;
    protocolIds?: string[];
    firmwareVersion?: string;
    hardwareVersion?: string;
    installationDate?: string;
    status?: string;
  };
  vehicleSpecs: {
    brand: string;
    model: string;
    year: number | string;
    category: string;
    plate?: string;
    engine?: {
      displacement?: string;
      fuelType?: string;
      power?: string;
    };
    fuel?: {
      tankCapacityLiters: number;
      fuelType: string;
      estimatedConsumption?: string;
    };
    transmission?: string;
  };
  telemetryConfig?: {
    currentFuel?: {
      status?: string;
      interpretation?: string;
      calibrated?: boolean;
      notes?: string;
    };
    totalFuel?: {
      status?: string;
      unit?: string;
      conversion?: string;
      calibrated?: boolean;
    };
    odometer?: {
      status?: string;
      interpretation?: string;
      notes?: string;
    };
  };
  operationalData?: {
    usage?: string;
    location: string;
    totalDistance: string;
    averageSpeed: string;
    lastUpdate: string;
    fuelConsumption?: number;
    odometerKm?: string;
  };
  observations?: {
    fuelGauge?: string;
    odometerReading?: number;
    issues?: string[];
  };
}

interface FuelStats {
  currentLevel: number; // percentual
  currentLiters: number; // litros atuais
  totalConsumed: number; // litros consumidos total
  averageConsumption: number; // km/L
  estimatedRange: number; // km restantes
  lastReading?: string;
}

export default function Tracking() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [fuelStats, setFuelStats] = useState<Record<string, FuelStats>>({});
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [vehicleAddresses, setVehicleAddresses] = useState<Record<string, string>>({});

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vehicles');
      const data = await response.json();

      if (data.success && data.data?.vehicles) {
        setVehicles(data.data.vehicles);
        // Load fuel stats and real-time addresses for each vehicle
        await loadFuelStats(data.data.vehicles);
        loadVehicleAddresses();
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFuelStats = async (vehicles: Record<string, Vehicle>) => {
    const stats: Record<string, FuelStats> = {};
    const vehicleList = Object.values(vehicles);

    for (const vehicle of vehicleList) {
      const deviceId = vehicle.deviceInfo.deviceId;

      try {
        // Get latest readings for this device (limit to 100 most recent)
        const response = await fetch(`/api/readings/${deviceId}?limit=100`);
        const data = await response.json();

        // Handle different response formats
        let readings: any[] = [];
        if (data.readings && Array.isArray(data.readings)) {
          // Direct format: { readings: [...] }
          readings = data.readings;
        } else if (data.success && data.data) {
          if (Array.isArray(data.data)) {
            // Array format: { success: true, data: [...] }
            readings = data.data;
          } else if (data.data.readings && Array.isArray(data.data.readings)) {
            // Nested format: { success: true, data: { readings: [...] } }
            readings = data.data.readings;
          }
        }

        if (readings.length > 0) {
          const tankCapacity = vehicle.vehicleSpecs.fuel?.tankCapacityLiters || 50; // default 50L

          // Get latest reading with fuel data
          const latestWithFuel = readings.find((r: any) => 
            r.currentFuel !== undefined || r.totalFuel !== undefined
          );

          if (latestWithFuel) {
            // Calculate current fuel level (0-1024 scale = 0-100%)
            const currentFuelRaw = latestWithFuel.currentFuel || 0;
            const currentLevel = (currentFuelRaw / 1024) * 100;
            const currentLiters = (currentFuelRaw / 1024) * tankCapacity;

            // Calculate total consumed (deciliters to liters)
            const totalFuelRaw = latestWithFuel.totalFuel || 0;
            const totalConsumed = totalFuelRaw / 10; // deciliters to liters

            // Calculate average consumption (km/L)
            const totalDistance = latestWithFuel.totalMileage || 0; // in km
            const averageConsumption = totalConsumed > 0 && totalDistance > 0
              ? totalDistance / totalConsumed
              : 0;

            // Estimate range based on current fuel and average consumption
            const estimatedRange = averageConsumption > 0
              ? currentLiters * averageConsumption
              : 0;

            stats[deviceId] = {
              currentLevel: Math.round(currentLevel * 10) / 10,
              currentLiters: Math.round(currentLiters * 10) / 10,
              totalConsumed: Math.round(totalConsumed * 10) / 10,
              averageConsumption: Math.round(averageConsumption * 10) / 10,
              estimatedRange: Math.round(estimatedRange),
              lastReading: latestWithFuel.timestamp,
            };
          } else {
            // No fuel data available
            stats[deviceId] = {
              currentLevel: 0,
              currentLiters: 0,
              totalConsumed: 0,
              averageConsumption: 0,
              estimatedRange: 0,
            };
          }
        } else {
          // No readings available
          stats[deviceId] = {
            currentLevel: 0,
            currentLiters: 0,
            totalConsumed: 0,
            averageConsumption: 0,
            estimatedRange: 0,
          };
        }
      } catch (error) {
        console.error(`Error loading fuel stats for ${deviceId}:`, error);
        stats[deviceId] = {
          currentLevel: 0,
          currentLiters: 0,
          totalConsumed: 0,
          averageConsumption: 0,
          estimatedRange: 0,
        };
      }
    }

    setFuelStats(stats);
  };

  const loadVehicleAddresses = async () => {
    try {
      const posResponse = await fetch('/api/positions');
      const posData = await posResponse.json();
      if (!posData.success || !posData.data?.positions) return;

      const positions: any[] = posData.data.positions;
      const addresses: Record<string, string> = {};

      for (const pos of positions) {
        if (!pos.deviceId || !pos.latitude || !pos.longitude || pos.latitude === 0 || pos.longitude === 0) continue;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.latitude}&lon=${pos.longitude}&format=json&zoom=16&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          if (geoRes.ok) {
            const geo = await geoRes.json();
            if (geo.display_name) {
              // Extrair partes relevantes do endereço
              const parts = [];
              const addr = geo.address || {};
              if (addr.road) parts.push(addr.road);
              if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
              if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
              if (addr.state) parts.push(addr.state);
              addresses[pos.deviceId] = parts.length > 0 ? parts.join(', ') : geo.display_name;
            }
          }
          // Respeitar rate limit do Nominatim (1 req/s)
          await new Promise(r => setTimeout(r, 1100));
        } catch (err) {
          console.warn(`Geocoding failed for ${pos.deviceId}:`, err);
        }
      }

      setVehicleAddresses(addresses);
    } catch (err) {
      console.warn('Failed to load vehicle addresses:', err);
    }
  };

  const vehicleArray = Object.values(vehicles);

  return (
    <div className="relative w-full h-full bg-slate-100/40">
      {/* Mapa em tela cheia (área útil) */}
      <div className="absolute inset-0">
        <VehicleMap selectedVehicle={selectedVehicle} dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      {/* Filtros de período da rota (estilo Traccar) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1050]">
        <div className="glass-effect flex items-end gap-3 px-4 py-2 rounded-2xl shadow-lg border border-white/40">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-700">
              De
            </label>
            <input
              type="datetime-local"
              className="text-xs rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              value={dateFrom ? dateFrom.slice(0, 16) : ''}
              onChange={(e) => {
                const v = e.target.value;
                setDateFrom(v ? new Date(v).toISOString() : null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-700">
              Até
            </label>
            <input
              type="datetime-local"
              className="text-xs rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              value={dateTo ? dateTo.slice(0, 16) : ''}
              onChange={(e) => {
                const v = e.target.value;
                setDateTo(v ? new Date(v).toISOString() : null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                // Força reload chamando loadVehicles (mapa já observa dateFrom/dateTo)
                console.log('📅 Filtro de período aplicado', { dateFrom, dateTo });
              }}
              className="btn-primary text-xs py-1 px-3"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFrom(null);
                setDateTo(null);
              }}
              className="text-[11px] text-gray-500 hover:text-gray-700"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Painel de veículos ocultável no canto esquerdo (estilo Traccar) */}
      <div
        className={`absolute top-4 left-4 z-[1100] transition-transform duration-200 ${
          panelOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="glass-effect w-80 max-h-[calc(100vh-6rem)] rounded-2xl shadow-2xl flex flex-col border border-white/40">
          {/* Cabeçalho do painel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/30 bg-white/70 rounded-t-2xl">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>🚗</span>
                <span>Veículos</span>
              </h2>
              <p className="text-xs text-gray-500">
                Clique para focar a rota no mapa
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={loadVehicles}
                className="btn-secondary text-xs py-1 px-2"
                disabled={loading}
              >
                {loading ? '⏳' : '🔄'}
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ⬅ Ocultar
              </button>
            </div>
          </div>

          {/* Conteúdo do painel */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {loading && (
              <div className="text-center py-6 text-gray-500 text-sm">
                Carregando veículos...
              </div>
            )}

            {!loading && vehicleArray.length === 0 && (
              <div className="text-center py-6 text-gray-500 text-sm">
                Nenhum veículo cadastrado
              </div>
            )}

            {!loading &&
              vehicleArray.length > 0 &&
              vehicleArray.map((vehicle) => {
                const deviceId = vehicle.deviceInfo.deviceId;
                const isSelected = selectedVehicle === deviceId;

                return (
                  <div
                    key={deviceId}
                    className={`rounded-xl border-2 transition-all duration-200 mb-1 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/90 shadow-lg'
                        : 'border-gray-200 bg-white/90 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    {/* Cabeçalho compacto: nome + deviceId */}
                    <button
                      type="button"
                      onClick={() => setSelectedVehicle(isSelected ? null : deviceId)}
                      className="w-full px-3 py-2 flex items-center justify-between"
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-gray-800 text-sm leading-tight">
                          {vehicle.vehicleSpecs.brand} {vehicle.vehicleSpecs.model}
                        </span>
                        <span className="text-[11px] text-gray-600 mt-0.5">
                          Placa: {vehicle.vehicleSpecs.plate || 'N/A'} • {deviceId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500">
                          {vehicle.vehicleSpecs.year}
                        </span>
                        <span className="text-xs text-gray-500">
                          {isSelected ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {/* Detalhes completos só quando selecionado */}
                    {isSelected && (
                      <div className="px-3 pb-3 pt-1 border-t border-blue-200 space-y-2 text-[11px]">
                        {/* Bloco principal: identificação e especificações básicas */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Categoria:</span>
                            <span className="font-medium">{vehicle.vehicleSpecs.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ano:</span>
                            <span className="font-medium">{vehicle.vehicleSpecs.year}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Placa:</span>
                            <span className="font-medium">
                              {vehicle.vehicleSpecs.plate || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Transmissão:</span>
                            <span className="font-medium">
                              {vehicle.vehicleSpecs.transmission || 'N/A'}
                            </span>
                          </div>
                          {vehicle.vehicleSpecs.engine && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Motor:</span>
                                <span className="font-medium">
                                  {vehicle.vehicleSpecs.engine.displacement || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Potência:</span>
                                <span className="font-medium">
                                  {vehicle.vehicleSpecs.engine.power || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Combustível (motor):</span>
                                <span className="font-medium">
                                  {vehicle.vehicleSpecs.engine.fuelType || 'N/A'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Estatísticas de combustível resumidas */}
                        {fuelStats[deviceId] && (
                          <div className="pt-1.5 border-t border-gray-200">
                            {/* Nível do tanque */}
                            <div className="flex justify-between items-center mb-1">
                              <span className="flex items-center gap-1 text-gray-600">
                                <span>⛽</span>
                                <span>Nível</span>
                              </span>
                              <span
                                className={`font-bold ${
                                  fuelStats[deviceId].currentLevel > 50
                                    ? 'text-green-600'
                                    : fuelStats[deviceId].currentLevel > 25
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {fuelStats[deviceId].currentLevel}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  fuelStats[deviceId].currentLevel > 50
                                    ? 'bg-green-500'
                                    : fuelStats[deviceId].currentLevel > 25
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{
                                  width: `${Math.min(fuelStats[deviceId].currentLevel, 100)}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                              <span>Autonomia</span>
                              <span className="font-medium">
                                {fuelStats[deviceId].estimatedRange} km
                              </span>
                            </div>

                            {/* Litros atuais / capacidade */}
                            <div className="text-xs text-gray-500 mt-1">
                              {fuelStats[deviceId].currentLiters}L /{' '}
                              {vehicle.vehicleSpecs.fuel?.tankCapacityLiters || 50}L
                              {vehicle.vehicleSpecs.fuel?.estimatedConsumption && (
                                <span className="ml-1">
                                  ({vehicle.vehicleSpecs.fuel.estimatedConsumption})
                                </span>
                              )}
                            </div>

                            {/* Estatísticas de consumo */}
                            <div className="mt-1.5 space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Consumo Médio:</span>
                                <span className="font-medium text-blue-600">
                                  {fuelStats[deviceId].averageConsumption > 0
                                    ? `${fuelStats[deviceId].averageConsumption} km/L`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total Consumido:</span>
                                <span className="font-medium">
                                  {fuelStats[deviceId].totalConsumed > 0
                                    ? `${fuelStats[deviceId].totalConsumed}L`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Autonomia Estimada:</span>
                                <span
                                  className={`font-medium ${
                                    fuelStats[deviceId].estimatedRange > 200
                                      ? 'text-green-600'
                                      : fuelStats[deviceId].estimatedRange > 100
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {fuelStats[deviceId].estimatedRange > 0
                                    ? `${fuelStats[deviceId].estimatedRange} km`
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {vehicle.operationalData && (
                          <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Localização:</span>
                              <span className="font-medium text-green-600 text-right text-xs max-w-[60%]" title={vehicleAddresses[deviceId] || vehicle.operationalData.location || ''}>
                                {vehicleAddresses[deviceId] || vehicle.operationalData.location || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Distância Total:</span>
                              <span className="font-medium">
                                {vehicle.operationalData.totalDistance}
                              </span>
                            </div>
                            {vehicle.operationalData.odometerKm && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Odômetro (registro):</span>
                                <span className="font-medium">
                                  {vehicle.operationalData.odometerKm}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Velocidade Média:</span>
                              <span className="font-medium">
                                {vehicle.operationalData.averageSpeed}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Última Atualização:</span>
                              <span className="font-medium text-xs">
                                {vehicle.operationalData.lastUpdate || 'N/A'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Detalhes do dispositivo e telemetria */}
                        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tipo de dispositivo:</span>
                            <span className="font-medium">
                              {vehicle.deviceInfo.deviceType || 'OBD'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Status:</span>
                            <span className="font-medium">
                              {vehicle.deviceInfo.status || 'active'}
                            </span>
                          </div>
                          {vehicle.deviceInfo.protocolIds && vehicle.deviceInfo.protocolIds.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Protocolos:</span>
                              <span className="font-medium truncate max-w-[180px]">
                                {vehicle.deviceInfo.protocolIds.join(', ')}
                              </span>
                            </div>
                          )}
                          {vehicle.deviceInfo.installationDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Instalação:</span>
                              <span className="font-medium">
                                {new Date(
                                  vehicle.deviceInfo.installationDate
                                ).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          )}
                          {(vehicle.deviceInfo.firmwareVersion ||
                            vehicle.deviceInfo.hardwareVersion) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">FW / HW:</span>
                              <span className="font-medium truncate max-w-[180px]">
                                {vehicle.deviceInfo.firmwareVersion || 'N/A'} /{' '}
                                {vehicle.deviceInfo.hardwareVersion || 'N/A'}
                              </span>
                            </div>
                          )}

                          {vehicle.telemetryConfig && (
                            <div className="mt-1 space-y-1">
                              <div className="text-[10px] text-gray-500 font-semibold">
                                Telemetria configurada
                              </div>
                              {vehicle.telemetryConfig.currentFuel && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Combustível atual:</span>
                                  <span className="font-medium truncate max-w-[180px]">
                                    {vehicle.telemetryConfig.currentFuel.status || 'N/A'}{' '}
                                    {vehicle.telemetryConfig.currentFuel.interpretation
                                      ? `(${vehicle.telemetryConfig.currentFuel.interpretation})`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {vehicle.telemetryConfig.totalFuel && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Total combustível:</span>
                                  <span className="font-medium truncate max-w-[180px]">
                                    {vehicle.telemetryConfig.totalFuel.status || 'N/A'}{' '}
                                    {vehicle.telemetryConfig.totalFuel.unit
                                      ? `(${vehicle.telemetryConfig.totalFuel.unit})`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {vehicle.telemetryConfig.odometer && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Odômetro lógico:</span>
                                  <span className="font-medium truncate max-w-[180px]">
                                    {vehicle.telemetryConfig.odometer.status || 'N/A'}{' '}
                                    {vehicle.telemetryConfig.odometer.interpretation
                                      ? `(${vehicle.telemetryConfig.odometer.interpretation})`
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {vehicle.observations && (
                            <div className="mt-2 space-y-1">
                              <div className="text-[10px] text-gray-500 font-semibold">
                                Observações
                              </div>
                              {vehicle.observations.fuelGauge && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Marcador de combustível:</span>
                                  <span className="font-medium truncate max-w-[180px]">
                                    {vehicle.observations.fuelGauge}
                                  </span>
                                </div>
                              )}
                              {typeof vehicle.observations.odometerReading === 'number' && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Odômetro anotado:</span>
                                  <span className="font-medium">
                                    {vehicle.observations.odometerReading} km
                                  </span>
                                </div>
                              )}
                              {vehicle.observations.issues &&
                                vehicle.observations.issues.length > 0 && (
                                  <div className="flex flex-col">
                                    <span className="text-gray-600">Ocorrências:</span>
                                    <ul className="list-disc list-inside text-[10px] text-gray-700 mt-0.5">
                                      {vehicle.observations.issues.map((issue, idx) => (
                                        <li key={idx}>{issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-blue-200 text-[11px] text-blue-600 flex items-center gap-2">
                          <span>📍</span>
                          <span>Selecionado - Focando no mapa</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">💡 Dica:</p>
              <p>Clique em um veículo para focar no mapa</p>
            </div>
          </div>
        </div>
      </div>

      {/* Botão flutuante para reabrir o painel quando estiver oculto */}
      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="absolute top-4 left-4 z-[1150] bg-white/90 border border-gray-300 rounded-full px-3 py-1 text-xs shadow-lg hover:bg-white flex items-center gap-1"
        >
          <span>☰</span>
          <span>Veículos</span>
        </button>
      )}
    </div>
  );
}
