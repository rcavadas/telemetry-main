import { IncomingMessage, ServerResponse } from 'http';
import { VehicleController } from '../controllers/vehicle-controller';
import { HexDecoderController } from '../controllers/hex-decoder-controller';
import { CorsMiddleware } from '../middleware/cors';
import { APIResponse, HealthStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class Router {
  private vehicleController: VehicleController;
  private hexDecoderController: HexDecoderController;
  private startTime: number;

  constructor() {
    this.vehicleController = new VehicleController();
    this.hexDecoderController = new HexDecoderController();
    this.startTime = Date.now();
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    
    // Apply CORS middleware
    CorsMiddleware.apply(req, res);
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return;
    }

    const url = new URL(req.url || '', 'http://localhost:3000');
    const pathname = url.pathname;
    const method = req.method || 'GET';

    try {
      // Health check
      if (pathname === '/health' && method === 'GET') {
        await this.handleHealth(req, res, startTime);
        return;
      }

      // Root - Serve web interface
      if (pathname === '/' && method === 'GET') {
        await this.serveWebInterface(req, res);
        return;
      }

      // API Routes
      if (pathname.startsWith('/api/')) {
        await this.handleApiRoutes(req, res, pathname, method);
        return;
      }

      // 404 Not Found
      this.send404(res, startTime);
    } catch (error) {
      this.send500(res, error, startTime);
    }
  }

  private async handleApiRoutes(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<void> {
    // Vehicle routes
    if (pathname === '/api/vehicles') {
      switch (method) {
        case 'GET':
          await this.vehicleController.getAllVehicles(req, res);
          break;
        case 'POST':
          await this.vehicleController.createVehicle(req, res);
          break;
        default:
          this.sendMethodNotAllowed(res);
      }
      return;
    }

    // Vehicle by ID routes
    const vehicleMatch = pathname.match(/^\/api\/vehicles\/([^\/]+)$/);
    if (vehicleMatch) {
      const vehicleId = vehicleMatch[1];
      switch (method) {
        case 'GET':
          await this.vehicleController.getVehicleById(req, res, vehicleId);
          break;
        case 'PUT':
          await this.vehicleController.updateVehicle(req, res, vehicleId);
          break;
        case 'DELETE':
          await this.vehicleController.deleteVehicle(req, res, vehicleId);
          break;
        default:
          this.sendMethodNotAllowed(res);
      }
      return;
    }

    // Hex decoder route
    if (pathname === '/api/decode-hex' && method === 'POST') {
      await this.hexDecoderController.decodeHex(req, res);
      return;
    }

    // API 404
    this.send404(res, Date.now());
  }

  private async handleHealth(req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> {
    const memUsage = process.memoryUsage();
    
    const healthStatus: HealthStatus = {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      tcpServer: {
        running: true,
        port: 29479,
        connections: 0
      },
      httpServer: {
        running: true,
        port: 3000
      },
      database: {
        accessible: true,
        vehicleCount: 0
      }
    };

    const response: APIResponse<HealthStatus> = {
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
  }

  private async serveWebInterface(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const htmlPath = path.join(__dirname, '../views/hex-form.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Web interface not available');
    }
  }

  private send404(res: ServerResponse, startTime: number): void {
    const response: APIResponse = {
      success: false,
      error: 'Not Found',
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private send500(res: ServerResponse, error: any, startTime: number): void {
    const response: APIResponse = {
      success: false,
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private sendMethodNotAllowed(res: ServerResponse): void {
    const response: APIResponse = {
      success: false,
      error: 'Method Not Allowed',
      timestamp: new Date().toISOString(),
      processingTime: '0ms'
    };

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }
} 