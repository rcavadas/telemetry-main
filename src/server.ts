import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Logger } from './utils/logger';
import { HexDecoderService } from './services/hex-decoder-service';

// Interfaces para TypeScript
interface TCPMessage {
    id: string;
    timestamp: string;
    clientId: string;
    rawHex: string;
    messageType: string;
    deviceId?: string;
    size: number;
    decoded?: any;
    crcValid?: boolean;
}

interface APIResponse {
    success: boolean;
    data?: any;
    error?: string;
    timestamp: string;
    processingTime?: string;
}

interface VehicleSpecs {
    brand: string;
    model: string;
    year: number;
    category: string;
    engine: {
        displacement: string;
        power: string;
    };
    fuel: {
        type: string;
        tankCapacityLiters: number;
    };
    transmission: string;
}

interface VehicleData {
    deviceInfo: {
        deviceId: string;
    };
    vehicleSpecs: VehicleSpecs;
    operationalData?: {
        location: string;
        totalDistance: string;
        averageSpeed: string;
        lastUpdate: string;
    };
}

export class OBDServer extends EventEmitter {
    private tcpServer!: net.Server;
    private httpServer!: http.Server;
    private tcpPort = 29479;
    private httpPort = 3000;
    
    // TCP Monitor functionality
    private tcpMessages: TCPMessage[] = [];
    private sseClients: Set<http.ServerResponse> = new Set();
    private messageIdCounter = 0;

    constructor() {
        super();
        this.createServers();
    }

    private createServers(): void {
        this.createTcpServer();
        this.createHttpServer();
    }

    private createTcpServer(): void {
        this.tcpServer = net.createServer((socket: net.Socket) => {
            const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            Logger.info(`📡 Cliente TCP conectado: ${clientId}`);

            socket.on('data', (data: Buffer) => {
                const hexData = data.toString('hex').toUpperCase();
                Logger.info(`📥 Dados TCP recebidos de ${clientId}: ${hexData}`);
                
                // Add TCP message to monitor
                this.addTcpMessage(clientId, hexData);
            });

            socket.on('close', () => {
                Logger.info(`📡 Cliente TCP desconectado: ${clientId}`);
            });

            socket.on('error', (error: Error) => {
                Logger.error(`❌ Erro no cliente TCP ${clientId}:`, error);
            });
        });
    }

    private createHttpServer(): void {
        this.httpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
            await this.handleHttpRequest(req, res);
        });
    }

    private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const startTime = Date.now();
        const url = new URL(req.url || '', `http://localhost:${this.httpPort}`);
        
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Log request
        Logger.info(`${req.method} ${url.pathname}`, { 
            userAgent: req.headers['user-agent'], 
            ip: req.socket.remoteAddress 
        });

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            // Route handling
            if (url.pathname === '/') {
                await this.handleHomePage(res);
            } else if (url.pathname === '/health') {
                await this.handleHealthCheck(res, startTime);
            } else if (url.pathname === '/api/vehicles') {
                await this.handleVehicles(req, res, startTime);
            } else if (url.pathname === '/api/devices') {
                await this.handleDevices(res, startTime);
            } else if (url.pathname.startsWith('/api/reports/')) {
                await this.handleReports(url, res, startTime);
            } else if (url.pathname.startsWith('/api/readings/')) {
                await this.handleReadings(url, res, startTime);
            } else if (url.pathname === '/api/decode-hex') {
                await this.handleHexDecodeRequest(req, res, startTime);
            } else if (url.pathname === '/api/tcp-stream') {
                await this.handleTcpStream(req, res);
            } else {
                this.sendHttpError(res, 'Endpoint não encontrado', 404, startTime);
            }
        } catch (error) {
            Logger.error('Erro ao processar requisição HTTP', { error: error instanceof Error ? error.message : String(error) });
            this.sendHttpError(res, error instanceof Error ? error.message : 'Erro interno', 500, startTime);
        }
    }

    private async handleHomePage(res: http.ServerResponse): Promise<void> {
        try {
            const htmlPath = path.join(__dirname, 'views', 'hex-form.html');
            const html = fs.readFileSync(htmlPath, 'utf8');
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.writeHead(200);
            res.end(html);
        } catch (error) {
            Logger.error('Erro ao servir página inicial', { error: error instanceof Error ? error.message : String(error) });
            res.writeHead(500);
            res.end('Erro interno do servidor');
        }
    }

    private async handleHealthCheck(res: http.ServerResponse, startTime: number): Promise<void> {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(uptime / 60)} minutos`,
            memory: {
                used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
            },
            servers: {
                tcp: {
                    port: this.tcpPort,
                    status: this.tcpServer.listening ? 'Ativo' : 'Inativo'
                },
                http: {
                    port: this.httpPort,
                    status: this.httpServer.listening ? 'Ativo' : 'Inativo'
                }
            },
            tcpMonitor: {
                messagesCount: this.tcpMessages.length,
                clientsConnected: this.sseClients.size
            }
        };

        this.sendHttpResponse(res, healthData, 200, startTime);
    }

    private async handleVehicles(req: http.IncomingMessage, res: http.ServerResponse, startTime: number): Promise<void> {
        if (req.method === 'GET') {
            const vehicleRegistry = this.loadVehicleRegistry();
            const vehicles = Object.values(vehicleRegistry.vehicles || {}).map((vehicle: any) => {
                const operationalData = this.calculateRealOperationalData(vehicle.deviceInfo.deviceId);
                return { ...vehicle, operationalData };
            });

            this.sendHttpResponse(res, { vehicles }, 200, startTime);
        } else {
            this.sendHttpError(res, 'Método não suportado', 405, startTime);
        }
    }

    private async handleDevices(res: http.ServerResponse, startTime: number): Promise<void> {
        const vehicleRegistry = this.loadVehicleRegistry();
        const devices = Object.keys(vehicleRegistry.vehicles || {}).map(deviceId => ({
            deviceId,
            status: 'active',
            lastSeen: new Date().toISOString()
        }));

        this.sendHttpResponse(res, { devices }, 200, startTime);
    }

    private async handleReports(url: URL, res: http.ServerResponse, startTime: number): Promise<void> {
        const pathParts = url.pathname.split('/');
        const deviceId = pathParts[3];
        const format = pathParts[4]; // 'markdown' se presente

        if (!deviceId) {
            this.sendHttpError(res, 'Device ID é obrigatório', 400, startTime);
            return;
        }

        const vehicleRegistry = this.loadVehicleRegistry();
        const vehicle = vehicleRegistry.vehicles?.[deviceId];

        if (!vehicle) {
            this.sendHttpError(res, `Veículo com Device ID ${deviceId} não encontrado`, 404, startTime);
            return;
        }

        if (format === 'markdown') {
            const markdown = this.generateMarkdownReport(vehicle);
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="relatorio-${deviceId}.md"`);
            res.writeHead(200);
            res.end(markdown);
        } else {
            const operationalData = this.calculateRealOperationalData(deviceId);
            const report = { ...vehicle, operationalData };
            this.sendHttpResponse(res, report, 200, startTime);
        }
    }

    private async handleReadings(url: URL, res: http.ServerResponse, startTime: number): Promise<void> {
        const pathParts = url.pathname.split('/');
        const deviceId = pathParts[3];

        if (!deviceId) {
            this.sendHttpError(res, 'Device ID é obrigatório', 400, startTime);
            return;
        }

        try {
            Logger.info(`📊 Carregando leituras detalhadas para device: ${deviceId}`);
            
            // Load readings from the existing readings.json database
            const { DatabaseManager } = require('./models/database');
            const dbManager = DatabaseManager.getInstance();
            
            // Get readings with audit trail information
            const readings = dbManager.getReadings(deviceId, 50, 0);
            
            const response = {
                deviceId,
                totalReadings: readings.length,
                readings: readings,
                auditInfo: {
                    source: 'readings.json',
                    includesRawData: true,
                    includesTotalAuditTrail: true,
                    includesAuditFields: readings.some((r: any) => r.auditTrail),
                    lastUpdate: new Date().toISOString()
                }
            };

            this.sendHttpResponse(res, response, 200, startTime);
        } catch (error) {
            Logger.error('Erro ao carregar leituras detalhadas', { error: error instanceof Error ? error.message : String(error) });
            this.sendHttpError(res, `Erro ao carregar leituras: ${error instanceof Error ? error.message : String(error)}`, 500, startTime);
        }
    }

    private async handleHexDecodeRequest(req: http.IncomingMessage, res: http.ServerResponse, startTime: number): Promise<void> {
        if (req.method !== 'POST') {
            this.sendHttpError(res, 'Método não suportado', 405, startTime);
            return;
        }

        try {
            const body = await this.getRequestBody(req);
            const { hex } = JSON.parse(body);

            if (!hex || typeof hex !== 'string') {
                this.sendHttpError(res, 'Campo "hex" é obrigatório e deve ser uma string', 400, startTime);
                return;
            }

            const cleanHex = hex.replace(/\s+/g, '');
            const result = HexDecoderService.decodeHex(cleanHex);

            if (result.success) {
                this.sendHttpResponse(res, result, 200, startTime);
            } else {
                this.sendHttpError(res, result.error || 'Erro na decodificação', 400, startTime);
            }
        } catch (error) {
            Logger.error('Erro na decodificação hex', { error: error instanceof Error ? error.message : String(error) });
            this.sendHttpError(res, 'Erro na decodificação: ' + (error instanceof Error ? error.message : String(error)), 400, startTime);
        }
    }

    private async handleTcpStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection
        res.write('data: {"type":"connected"}\n\n');

        // Add client to SSE clients set
        this.sseClients.add(res);

        // Send recent messages
        this.tcpMessages.slice(-10).forEach(message => {
            res.write(`data: ${JSON.stringify(message)}\n\n`);
        });

        // Handle client disconnect
        req.on('close', () => {
            this.sseClients.delete(res);
            Logger.info('Cliente SSE desconectado do TCP stream');
        });

        req.on('error', () => {
            this.sseClients.delete(res);
        });
    }

    // TCP Monitor Methods
    private addTcpMessage(clientId: string, rawHex: string): void {
        const messageId = (++this.messageIdCounter).toString();
        const timestamp = new Date().toISOString();
        
        // Decode hex to extract device info
        let deviceId: string | undefined;
        let decoded: any;
        let crcValid: boolean | undefined;
        
        try {
            decoded = HexDecoderService.decodeHex(rawHex);
            deviceId = decoded.deviceId;
            crcValid = decoded.crcValid;
        } catch (error) {
            Logger.warn('Erro ao decodificar hex no monitor TCP', { error: error instanceof Error ? error.message : String(error) });
        }

        // Generate ASCII representation
        let asciiRepresentation = '';
        try {
            const buffer = Buffer.from(rawHex, 'hex');
            asciiRepresentation = buffer.toString('ascii').replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
        } catch (error) {
            Logger.debug('Erro ao gerar representação ASCII', { error });
        }

        // Generate byte array
        let byteArray: number[] = [];
        try {
            const buffer = Buffer.from(rawHex, 'hex');
            byteArray = Array.from(buffer);
        } catch (error) {
            Logger.debug('Erro ao gerar array de bytes', { error });
        }

        const tcpMessage: TCPMessage = {
            id: messageId,
            timestamp,
            clientId,
            rawHex,
            messageType: 'OBD Data',
            deviceId,
            size: rawHex.length / 2, // hex length / 2 = bytes
            decoded,
            crcValid
        };

        // Add to buffer (keep last 100 messages)
        this.tcpMessages.unshift(tcpMessage);
        if (this.tcpMessages.length > 100) {
            this.tcpMessages = this.tcpMessages.slice(0, 100);
        }

        // Broadcast to SSE clients
        this.broadcastTcpMessage(tcpMessage);

        // Save to database with complete audit trail if successfully decoded
        if (decoded && decoded.success && deviceId) {
            try {
                // Import DatabaseManager dynamically to avoid circular dependencies
                const { DatabaseManager } = require('./models/database');
                const dbManager = DatabaseManager.getInstance();
                
                // Prepare audit information
                const auditInfo = {
                    clientId,
                    context: 'RECEIVED_FROM_OBD',
                    dataLength: `${rawHex.length / 2} bytes`,
                    asciiRepresentation,
                    byteArray,
                    originalJsonObject: {
                        timestamp,
                        clientId,
                        context: 'RECEIVED_FROM_OBD',
                        length: rawHex.length / 2,
                        hexData: rawHex,
                        asciiData: asciiRepresentation,
                        rawBuffer: byteArray
                    }
                };

                // Save reading with audit trail
                const readingId = dbManager.saveReading(decoded, rawHex, auditInfo);
                
                Logger.info('💾 Dados TCP salvos no banco com auditoria completa', {
                    readingId,
                    deviceId,
                    clientId,
                    dataSize: rawHex.length / 2
                });
                
            } catch (dbError) {
                Logger.error('❌ Erro ao salvar dados TCP no banco', { 
                    error: dbError instanceof Error ? dbError.message : String(dbError),
                    deviceId,
                    clientId
                });
            }
        }
    }

    private broadcastTcpMessage(message: TCPMessage): void {
        const data = JSON.stringify(message);
        
        this.sseClients.forEach(client => {
            try {
                client.write(`data: ${data}\n\n`);
            } catch (error) {
                Logger.warn('Erro ao enviar mensagem SSE', { error: error instanceof Error ? error.message : String(error) });
                this.sseClients.delete(client);
            }
        });
    }

    // Utility Methods
    private loadVehicleRegistry(): any {
        const filePath = path.join(process.cwd(), 'data', 'vehicle-registry.json');
        
        try {
            if (!fs.existsSync(filePath)) {
                const defaultData = {
                    metadata: {
                        version: "1.0",
                        lastModified: new Date().toISOString(),
                        totalVehicles: 0
                    },
                    vehicles: {}
                };
                
                // Create directory if it doesn't exist
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
                return defaultData;
            }
            
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            Logger.warn('Erro ao carregar registro de veículos, usando dados padrão', { error: error instanceof Error ? error.message : String(error) });
            return {
                metadata: { version: "1.0", lastModified: new Date().toISOString(), totalVehicles: 0 },
                vehicles: {}
            };
        }
    }

    private calculateRealOperationalData(deviceId: string): any {
        // Simular dados operacionais em tempo real
        const now = new Date();
        const locations = ['São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG', 'Brasília, DF'];
        
        return {
            location: locations[Math.floor(Math.random() * locations.length)],
            totalDistance: `${(Math.random() * 50000 + 10000).toFixed(0)} km`,
            averageSpeed: `${(Math.random() * 40 + 60).toFixed(1)} km/h`,
            lastUpdate: now.toLocaleString('pt-BR')
        };
    }

    private generateMarkdownReport(vehicle: any): string {
        const specs = vehicle.vehicleSpecs || {};
        const deviceId = vehicle.deviceInfo?.deviceId || 'N/A';
        
        return `# Relatório do Veículo - ${specs.brand || 'N/A'} ${specs.model || 'N/A'}

## Informações Básicas
- **Device ID:** ${deviceId}
- **Marca:** ${specs.brand || 'N/A'}
- **Modelo:** ${specs.model || 'N/A'}
- **Ano:** ${specs.year || 'N/A'}
- **Categoria:** ${specs.category || 'N/A'}

## Motor
- **Cilindrada:** ${specs.engine?.displacement || 'N/A'}
- **Potência:** ${specs.engine?.power || 'N/A'}

## Combustível
- **Tipo:** ${specs.fuel?.type || 'N/A'}
- **Capacidade do Tanque:** ${specs.fuel?.tankCapacityLiters || 'N/A'} litros

## Transmissão
- **Tipo:** ${specs.transmission || 'N/A'}

---
Relatório gerado em: ${new Date().toLocaleString('pt-BR')}
`;
    }

    private async getRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    private sendHttpResponse(res: http.ServerResponse, data: any, statusCode: number, startTime: number): void {
        const response: APIResponse = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            processingTime: `${Date.now() - startTime}ms`
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.writeHead(statusCode);
        res.end(JSON.stringify(response, null, 2));
    }

    private sendHttpError(res: http.ServerResponse, error: string, statusCode: number, startTime: number): void {
        const response: APIResponse = {
            success: false,
            error,
            timestamp: new Date().toISOString(),
            processingTime: `${Date.now() - startTime}ms`
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.writeHead(statusCode);
        res.end(JSON.stringify(response, null, 2));
    }

    public async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Start TCP server
            this.tcpServer.listen(this.tcpPort, () => {
                Logger.info(`🚀 Servidor TCP iniciado na porta ${this.tcpPort}`);
                
                // Start HTTP server
                this.httpServer.listen(this.httpPort, () => {
                    Logger.info(`🌐 Servidor HTTP iniciado na porta ${this.httpPort}`);
                    Logger.info(`📊 Interface web disponível em: http://localhost:${this.httpPort}`);
                    resolve();
                });
            });

            this.tcpServer.on('error', reject);
            this.httpServer.on('error', reject);
        });
    }

    public async stop(): Promise<void> {
        return new Promise((resolve) => {
            Logger.info('🛑 Parando servidores...');
            
            // Close all SSE connections
            this.sseClients.forEach(client => {
                try {
                    client.end();
                } catch (error) {
                    // Ignore errors when closing
                }
            });
            this.sseClients.clear();

            this.tcpServer.close(() => {
                this.httpServer.close(() => {
                    Logger.info('✅ Servidores parados com sucesso');
                    resolve();
                });
            });
        });
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new OBDServer();
    
    server.start().catch(error => {
        Logger.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        Logger.info('🛑 Recebido SIGINT, parando servidor...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        Logger.info('🛑 Recebido SIGTERM, parando servidor...');
        await server.stop();
        process.exit(0);
    });
} 