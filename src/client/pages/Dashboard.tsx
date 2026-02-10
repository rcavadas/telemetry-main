import { useState, useEffect } from 'react';
import TCPMonitor from '../components/TCPMonitor';
import VehicleMap from '../components/VehicleMap';
import FileUpload from '../components/FileUpload';
import HexDecoder from '../components/HexDecoder';
import StatusCards from '../components/StatusCards';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Dashboard</h1>
        <p className="text-gray-600">Visão geral do sistema de telemetria</p>
        <StatusCards />
      </div>

      {/* TCP Monitor */}
      <TCPMonitor />

      {/* Map */}
      <VehicleMap />

      {/* File Upload */}
      <FileUpload />

      {/* Hex Decoder */}
      <HexDecoder />
    </div>
  );
}
