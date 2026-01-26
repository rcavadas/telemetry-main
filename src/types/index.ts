// ========================================================================================
// VEHICLE MANAGEMENT TYPES
// ========================================================================================

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  driver: string;
  year?: string;
  color?: string;
  fuelType?: string;
  batteryVoltage?: number;
  fuelLevel?: number;
  lastUpdate?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  operational?: {
    totalDistance?: number;
    totalFuelConsumed?: number;
    averageSpeed?: number;
    operatingHours?: number;
    lastMaintenanceDate?: string;
    nextMaintenanceDate?: string;
    maintenanceStatus?: 'due' | 'upcoming' | 'current';
  };
}

export interface VehicleRegistry {
  vehicles: Vehicle[];
  lastUpdated: string;
  totalVehicles: number;
}

// ========================================================================================
// API RESPONSE TYPES
// ========================================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  processingTime: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  tcpServer: {
    running: boolean;
    port: number;
    connections: number;
  };
  httpServer: {
    running: boolean;
    port: number;
  };
  database: {
    accessible: boolean;
    vehicleCount: number;
  };
}

// ========================================================================================
// HEX DECODER TYPES
// ========================================================================================

export interface HexDecodeRequest {
  hex: string;
  context?: {
    vehicleId?: string;
    timestamp?: string;
    source?: string;
  };
}

export interface HexDecodeResult {
  success: boolean;
  deviceId?: string;
  protocol?: string;
  data?: {
    [key: string]: any;
  };
  rawHex: string;
  analysis?: {
    length: number;
    segments: Array<{
      name: string;
      value: string;
      description: string;
      startPosition: number;
      endPosition: number;
    }>;
  };
  error?: string;
  processingTime: string;
}

// ========================================================================================
// OBD PROTOCOL TYPES
// ========================================================================================

export interface OBDData {
  deviceId: string;
  protocol: string;
  timestamp: string;
  rawData: string;
  decodedData: {
    [key: string]: any;
  };
  vehicleInfo?: {
    plate?: string;
    model?: string;
    driver?: string;
  };
}

export interface ProtocolHandler {
  name: string;
  identifier: string;
  decode(hex: string): Promise<any>;
  validate(hex: string): boolean;
}

// ========================================================================================
// TELEMETRY DATA TYPES
// ========================================================================================

export interface TelemetryReading {
  id: string;
  vehicleId: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
  };
  engine: {
    rpm?: number;
    temperature?: number;
    oilPressure?: number;
    fuelLevel?: number;
    fuelConsumption?: number;
  };
  electrical: {
    batteryVoltage?: number;
    alternatorVoltage?: number;
  };
  diagnostics: {
    errorCodes?: string[];
    warnings?: string[];
  };
  rawHex: string;
  protocol: string;
  quality: 'good' | 'fair' | 'poor';
}

// ========================================================================================
// SERVER CONFIGURATION TYPES
// ========================================================================================

export interface ServerConfig {
  tcp: {
    port: number;
    host: string;
    timeout: number;
  };
  http: {
    port: number;
    host: string;
    cors: boolean;
  };
  database: {
    path: string;
    backupInterval: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    filePath: string;
    maxSize: number;
  };
}

// ========================================================================================
// LOGGING TYPES
// ========================================================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: any;
  source?: string;
}

// ========================================================================================
// REPORT TYPES
// ========================================================================================

export interface ReportOptions {
  vehicleId?: string;
  startDate: string;
  endDate: string;
  format: 'html' | 'json' | 'csv';
  includeGraphs?: boolean;
  includeMap?: boolean;
}

export interface VehicleReport {
  vehicle: Vehicle;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalDistance: number;
    totalFuelConsumed: number;
    averageSpeed: number;
    operatingHours: number;
    maxSpeed: number;
    idleTime: number;
  };
  readings: TelemetryReading[];
  analysis: {
    fuelEfficiency: number;
    drivingScore: number;
    maintenanceAlerts: string[];
    recommendations: string[];
  };
} 