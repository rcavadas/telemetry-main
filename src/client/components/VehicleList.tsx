import { useState, useEffect } from 'react';

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
    engine: {
      displacement: string;
      power: string;
      fuelType?: string;
    };
    fuel: {
      type: string;
      tankCapacityLiters: number;
      estimatedConsumption?: string;
    };
    transmission: string;
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
    odometerKm?: string;
  };
  observations?: {
    fuelGauge?: string;
    odometerReading?: number;
    issues?: string[];
  };
}

interface VehicleFormState {
  deviceId: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  category: string;
  engineDisplacement: string;
  enginePower: string;
  fuelType: string;
  tankCapacityLiters: string;
  transmission: string;
  odometerKm: string;
}

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOdo, setIsLoadingOdo] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleFormState>({
    deviceId: '',
    plate: '',
    brand: '',
    model: '',
    year: '',
    category: '',
    engineDisplacement: '',
    enginePower: '',
    fuelType: '',
    tankCapacityLiters: '',
    transmission: '',
    odometerKm: ''
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/vehicles');
      const data = await response.json();

      if (data.success && data.data?.vehicles) {
        const byId: Record<string, Vehicle> = {};
        for (const v of data.data.vehicles as any[]) {
          if (v.deviceInfo?.deviceId) {
            byId[v.deviceInfo.deviceId] = v as Vehicle;
          }
        }
        setVehicles(byId);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDeviceId(null);
    setForm({
      deviceId: '',
      plate: '',
      brand: '',
      model: '',
      year: '',
      category: '',
      engineDisplacement: '',
      enginePower: '',
      fuelType: '',
      tankCapacityLiters: '',
      transmission: '',
      odometerKm: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    const deviceId = vehicle.deviceInfo.deviceId;
    setEditingDeviceId(deviceId);

    setForm({
      deviceId,
      plate: vehicle.vehicleSpecs.plate || '',
      brand: vehicle.vehicleSpecs.brand || '',
      model: vehicle.vehicleSpecs.model || '',
      year: String(vehicle.vehicleSpecs.year || ''),
      category: vehicle.vehicleSpecs.category || '',
      engineDisplacement: vehicle.vehicleSpecs.engine.displacement || '',
      enginePower: vehicle.vehicleSpecs.engine.power || '',
      fuelType: vehicle.vehicleSpecs.fuel.type || '',
      tankCapacityLiters: String(vehicle.vehicleSpecs.fuel.tankCapacityLiters || ''),
      transmission: vehicle.vehicleSpecs.transmission || '',
      odometerKm: vehicle.operationalData?.odometerKm
        ? vehicle.operationalData.odometerKm.replace(' km', '')
        : ''
    });

    setIsModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const loadOdometerFromLogs = async () => {
    const deviceId = (editingDeviceId || form.deviceId).trim();
    if (!deviceId) return;

    try {
      setIsLoadingOdo(true);
      // Usa endpoint dedicado que calcula a odometria por GPS (sem depender de totalMileage bruto)
      const response = await fetch(`/api/odometer/${deviceId}`);
      const data = await response.json();

      const totalKm =
        data?.data?.totalDistanceKm ??
        data?.totalDistanceKm ??
        0;

      if (typeof totalKm === 'number' && totalKm > 0) {
        setForm((prev) => ({ ...prev, odometerKm: String(totalKm.toFixed(2)) }));
      }
    } catch (error) {
      console.error('Erro ao carregar quilometragem dos logs:', error);
    } finally {
      setIsLoadingOdo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        deviceId: form.deviceId.trim(),
        plate: form.plate.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: form.year.trim(),
        category: form.category.trim(),
        engineDisplacement: form.engineDisplacement.trim(),
        enginePower: form.enginePower.trim(),
        fuelType: form.fuelType.trim(),
        tankCapacityLiters: form.tankCapacityLiters ? Number(form.tankCapacityLiters) : undefined,
        transmission: form.transmission.trim(),
        odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined
      };

      if (!payload.deviceId) {
        alert('Device ID é obrigatório');
        setIsSaving(false);
        return;
      }

      let url = '/api/vehicles';
      let method: 'POST' | 'PUT' = 'POST';

      if (editingDeviceId) {
        url = `/api/vehicles/${encodeURIComponent(editingDeviceId)}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Erro ao salvar veículo');
      } else {
        setIsModalOpen(false);
        await loadVehicles();
      }
    } catch (error) {
      console.error('Erro ao salvar veículo:', error);
      alert('Erro ao salvar veículo. Veja o console para mais detalhes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="text-gray-500">Carregando veículos...</div>
      </div>
    );
  }

  const vehicleArray = Object.values(vehicles);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Frota cadastrada</h2>
        <button onClick={openCreateModal} className="btn-primary text-sm py-2 px-4">
          ➕ Novo Veículo
        </button>
      </div>

      {vehicleArray.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-gray-500">Nenhum veículo cadastrado</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicleArray.map((vehicle) => (
            <div
              key={vehicle.deviceInfo.deviceId}
              className="card hover:shadow-2xl transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {vehicle.vehicleSpecs.brand} {vehicle.vehicleSpecs.model}
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Placa: {vehicle.vehicleSpecs.plate || 'N/A'} • {vehicle.deviceInfo.deviceId}
                    </p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                    {vehicle.vehicleSpecs.year}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Categoria:</span>
                    <span className="font-medium">{vehicle.vehicleSpecs.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Motor:</span>
                    <span className="font-medium">{vehicle.vehicleSpecs.engine.displacement}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Potência:</span>
                    <span className="font-medium">
                      {vehicle.vehicleSpecs.engine.power || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Combustível:</span>
                    <span className="font-medium">
                      {vehicle.vehicleSpecs.fuel.type}
                      {vehicle.vehicleSpecs.engine.fuelType
                        ? ` (${vehicle.vehicleSpecs.engine.fuelType})`
                        : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tanque:</span>
                    <span className="font-medium">
                      {vehicle.vehicleSpecs.fuel.tankCapacityLiters} L
                      {vehicle.vehicleSpecs.fuel.estimatedConsumption && (
                        <span className="ml-1 text-xs text-gray-500">
                          ({vehicle.vehicleSpecs.fuel.estimatedConsumption})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transmissão:</span>
                    <span className="font-medium">{vehicle.vehicleSpecs.transmission}</span>
                  </div>

                  {vehicle.operationalData && (
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Localização:</span>
                        <span className="font-medium">{vehicle.operationalData.location}</span>
                      </div>
                      {vehicle.operationalData.odometerKm && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quilometragem atual:</span>
                          <span className="font-medium text-blue-600">
                            {vehicle.operationalData.odometerKm}
                          </span>
                        </div>
                      )}
                      {vehicle.operationalData.totalDistance && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Distância total:</span>
                          <span className="font-medium">
                            {vehicle.operationalData.totalDistance}
                          </span>
                        </div>
                      )}
                      {vehicle.operationalData.averageSpeed && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Velocidade média:</span>
                          <span className="font-medium">
                            {vehicle.operationalData.averageSpeed}
                          </span>
                        </div>
                      )}
                      {vehicle.operationalData.lastUpdate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Última atualização:</span>
                          <span className="font-medium text-xs">
                            {vehicle.operationalData.lastUpdate}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detalhes adicionais: dispositivo, telemetria e observações (resumo) */}
                  <div className="border-t pt-2 mt-2 space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Tipo dispositivo:</span>
                      <span className="font-medium">
                        {vehicle.deviceInfo.deviceType || 'OBD'}
                      </span>
                    </div>
                    {vehicle.deviceInfo.status && (
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="font-medium">{vehicle.deviceInfo.status}</span>
                      </div>
                    )}
                    {vehicle.deviceInfo.protocolIds &&
                      vehicle.deviceInfo.protocolIds.length > 0 && (
                        <div className="flex justify-between">
                          <span>Protocolos:</span>
                          <span className="font-medium truncate max-w-[140px]">
                            {vehicle.deviceInfo.protocolIds.join(', ')}
                          </span>
                        </div>
                      )}
                    {vehicle.telemetryConfig && (
                      <div className="flex justify-between">
                        <span>Telemetria:</span>
                        <span className="font-medium truncate max-w-[140px]">
                          {vehicle.telemetryConfig.currentFuel?.status || 'Configurada'}
                        </span>
                      </div>
                    )}
                    {vehicle.observations?.issues && vehicle.observations.issues.length > 0 && (
                      <div className="flex justify-between">
                        <span>Ocorrências:</span>
                        <span className="font-medium">
                          {vehicle.observations.issues.length} registro(s)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => openEditModal(vehicle)}
                  className="btn-secondary text-xs px-3 py-1"
                >
                  ✏️ Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingDeviceId ? 'Editar Veículo' : 'Novo Veículo'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device ID
                  </label>
                  <input
                    type="text"
                    name="deviceId"
                    value={form.deviceId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!!editingDeviceId}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placa
                  </label>
                  <input
                    type="text"
                    name="plate"
                    value={form.plate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ABC1234 ou ABC-1234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    name="brand"
                    value={form.brand}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    name="model"
                    value={form.model}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ano
                  </label>
                  <input
                    type="text"
                    name="year"
                    value={form.year}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motor (cilindrada)
                  </label>
                  <input
                    type="text"
                    name="engineDisplacement"
                    value={form.engineDisplacement}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Potência
                  </label>
                  <input
                    type="text"
                    name="enginePower"
                    value={form.enginePower}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de combustível
                  </label>
                  <input
                    type="text"
                    name="fuelType"
                    value={form.fuelType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Gasolina, Diesel, Flex..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacidade do tanque (L)
                  </label>
                  <input
                    type="number"
                    name="tankCapacityLiters"
                    value={form.tankCapacityLiters}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transmissão
                  </label>
                  <input
                    type="text"
                    name="transmission"
                    value={form.transmission}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Manual, Automático, CVT..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quilometragem atual (km)
                  </label>
                  <input
                    type="number"
                    name="odometerKm"
                    value={form.odometerKm}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={0}
                  />
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button
                    type="button"
                    onClick={loadOdometerFromLogs}
                    className="btn-secondary text-sm px-4 py-2"
                    disabled={isLoadingOdo || (!editingDeviceId && !form.deviceId)}
                  >
                    {isLoadingOdo ? '⏳ Carregando...' : '📥 Carregar dos logs'}
                  </button>
                  <span className="text-xs text-gray-500 self-center">
                    Usa a leitura mais recente de `totalMileage` dos logs (convertido para km).
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
