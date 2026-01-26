import { ServerConfig } from '../types';

export const config: ServerConfig = {
  tcp: {
    port: 29479,
    host: '0.0.0.0',
    timeout: 300000 // 5 minutes
  },
  http: {
    port: 3000,
    host: '0.0.0.0',
    cors: true
  },
  database: {
    path: './data',
    backupInterval: 3600000 // 1 hour
  },
  logging: {
    level: 'info',
    filePath: './logs',
    maxSize: 10485760 // 10MB
  }
};

export const API_ENDPOINTS = {
  HEALTH: '/health',
  VEHICLES: '/api/vehicles',
  VEHICLE_BY_ID: '/api/vehicles/:id',
  DECODE_HEX: '/api/decode-hex',
  REPORTS: '/api/reports',
  LOGS: '/api/logs',
  SETTINGS: '/api/settings'
} as const;

export const FILE_PATHS = {
  VEHICLE_REGISTRY: 'vehicle-registry.json',
  WEB_INTERFACE: 'hex-form.html',
  REPORTS_DIR: 'reports',
  LOGS_DIR: 'logs',
  BACKUP_DIR: 'backups'
} as const;

export const OBD_PROTOCOLS = {
  SINOCASTEL_0x3400: '0x3400',
  GENERIC_OBD: 'generic'
} as const;

export default config; 