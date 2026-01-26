import { IncomingMessage, ServerResponse } from 'http';
import { VehicleRegistryManager } from '../managers/vehicle-registry-manager';
import { APIResponse, Vehicle } from '../types';
import { Logger } from '../utils/logger';

export class VehicleController {
  private vehicleManager: VehicleRegistryManager;

  constructor() {
    this.vehicleManager = new VehicleRegistryManager();
  }

  // Adapter method to convert VehicleRecord to Vehicle
  private vehicleRecordToVehicle(deviceId: string, record: any): Vehicle {
    return {
      id: deviceId,
      plate: record.vehicleSpecs?.plate || 'N/A',
      model: `${record.vehicleSpecs?.brand || 'Unknown'} ${record.vehicleSpecs?.model || 'Unknown'}`,
      driver: record.operationalData?.usage || 'Unknown',
      year: record.vehicleSpecs?.year || 'N/A',
      color: 'N/A', // Default value
      fuelType: record.vehicleSpecs?.fuel?.fuelType || 'Unknown',
      lastUpdate: record.operationalData?.lastUpdate || new Date().toISOString()
    };
  }

  // Adapter method to convert Vehicle to VehicleRecord format for updates
  private vehicleToVehicleRecord(vehicle: Partial<Vehicle>): any {
    // Extract brand and model from combined model field
    const [brand, ...modelParts] = (vehicle.model || '').split(' ');
    
    return {
      vehicleSpecs: {
        brand: brand || 'Unknown',
        model: modelParts.join(' ') || 'Unknown',
        year: vehicle.year || 'N/A',
        plate: vehicle.plate || 'N/A',
        fuel: {
          fuelType: vehicle.fuelType || 'Unknown'
        }
      },
      operationalData: {
        usage: vehicle.driver || 'Unknown',
        lastUpdate: new Date().toISOString()
      }
    };
  }

  /**
   * GET /api/vehicles - Lista todos os veículos
   */
  async getAllVehicles(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    
    try {
      const vehicleRecords = this.vehicleManager.getAllVehicles();
      
      // Convert VehicleRecord objects to Vehicle array
      const vehicles: Vehicle[] = Object.entries(vehicleRecords).map(([deviceId, record]) => 
        this.vehicleRecordToVehicle(deviceId, record)
      );

      const response: APIResponse<Vehicle[]> = {
        success: true,
        data: vehicles,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      this.sendJsonResponse(res, response);
      Logger.info('Vehicles retrieved successfully', { count: vehicles.length });
    } catch (error) {
      this.sendError(res, 'Failed to retrieve vehicles', 500, startTime);
      Logger.error('Error retrieving vehicles', { error });
    }
  }

  /**
   * GET /api/vehicles/:id - Busca veículo por ID
   */
  async getVehicleById(req: IncomingMessage, res: ServerResponse, vehicleId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const vehicleRecord = this.vehicleManager.getVehicleById(vehicleId);
      
      if (!vehicleRecord) {
        this.sendError(res, 'Vehicle not found', 404, startTime);
        return;
      }

      const vehicle = this.vehicleRecordToVehicle(vehicleId, vehicleRecord);

      const response: APIResponse<Vehicle> = {
        success: true,
        data: vehicle,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      this.sendJsonResponse(res, response);
      Logger.info('Vehicle retrieved successfully', { vehicleId });
    } catch (error) {
      this.sendError(res, 'Failed to retrieve vehicle', 500, startTime);
      Logger.error('Error retrieving vehicle', { error, vehicleId });
    }
  }

  /**
   * POST /api/vehicles - Cria novo veículo
   */
  async createVehicle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    
    try {
      const vehicleData = await this.parseRequestBody(req);
      const vehicleRecordData = this.vehicleToVehicleRecord(vehicleData);
      
      const newVehicleRecord = this.vehicleManager.addVehicle(vehicleRecordData);
      const newVehicle = this.vehicleRecordToVehicle(newVehicleRecord.deviceInfo.deviceId, newVehicleRecord);

      const response: APIResponse<Vehicle> = {
        success: true,
        data: newVehicle,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      this.sendJsonResponse(res, response, 201);
      Logger.info('Vehicle created successfully', { vehicleId: newVehicle.id });
    } catch (error) {
      this.sendError(res, 'Failed to create vehicle', 500, startTime);
      Logger.error('Error creating vehicle', { error });
    }
  }

  /**
   * PUT /api/vehicles/:id - Atualiza veículo
   */
  async updateVehicle(req: IncomingMessage, res: ServerResponse, vehicleId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const updateData = await this.parseRequestBody(req);
      const vehicleRecordData = this.vehicleToVehicleRecord(updateData);
      
      const updatedVehicleRecord = this.vehicleManager.updateVehicle(vehicleId, vehicleRecordData);
      
      if (!updatedVehicleRecord) {
        this.sendError(res, 'Vehicle not found', 404, startTime);
        return;
      }

      const updatedVehicle = this.vehicleRecordToVehicle(vehicleId, updatedVehicleRecord);

      const response: APIResponse<Vehicle> = {
        success: true,
        data: updatedVehicle,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      this.sendJsonResponse(res, response);
      Logger.info('Vehicle updated successfully', { vehicleId });
    } catch (error) {
      this.sendError(res, 'Failed to update vehicle', 500, startTime);
      Logger.error('Error updating vehicle', { error, vehicleId });
    }
  }

  /**
   * DELETE /api/vehicles/:id - Remove veículo
   */
  async deleteVehicle(req: IncomingMessage, res: ServerResponse, vehicleId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const deleted = this.vehicleManager.deleteVehicle(vehicleId);
      
      if (!deleted) {
        this.sendError(res, 'Vehicle not found', 404, startTime);
        return;
      }

      const response: APIResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      this.sendJsonResponse(res, response);
      Logger.info('Vehicle deleted successfully', { vehicleId });
    } catch (error) {
      this.sendError(res, 'Failed to delete vehicle', 500, startTime);
      Logger.error('Error deleting vehicle', { error, vehicleId });
    }
  }

  /**
   * Utilitários privados
   */
  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
  }

  private sendJsonResponse(res: ServerResponse, data: any, statusCode: number = 200): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data, null, 2));
  }

  private sendError(res: ServerResponse, message: string, statusCode: number, startTime: number): void {
    const response: APIResponse = {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };

    this.sendJsonResponse(res, response, statusCode);
  }
} 