import { useState, useEffect } from 'react';
import VehicleList from '../components/VehicleList';

export default function Vehicles() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🚗 Cadastro de Veículos</h1>
        <p className="text-gray-600">Gerencie a frota de veículos monitorados</p>
      </div>

      <VehicleList />
    </div>
  );
}
