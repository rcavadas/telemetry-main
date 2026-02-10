import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './utils/logger';
import { HexDecoderService } from './services/hex-decoder-service';
import { AuthDatabase, ServerSettings, UserRole } from './models/auth-database';
import {
    CastelFrameBuffer,
    parseFrame,
    handleCastelFrame,
    getMessageTypeName,
    CastelFrame,
} from './protocols/castel-handler';

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
    private tcpPort = parseInt(process.env.TCP_PORT || '5086', 10);
    private httpPort = parseInt(process.env.HTTP_PORT || '3000', 10);
    
    // TCP Monitor functionality
    private tcpMessages: TCPMessage[] = [];
    private sseClients: Set<http.ServerResponse> = new Set();
    private messageIdCounter = 0;

    // Auth and settings
    private authDb: AuthDatabase;
    private sessions: Map<string, { userId: number; username: string; role: UserRole; createdAt: number }> = new Map();
    private sessionTtlMs = 2 * 60 * 60 * 1000; // 2 hours

    constructor() {
        super();
        this.authDb = AuthDatabase.getInstance();
        this.loadPortsFromSettings();
        this.createServers();
    }

    private loadPortsFromSettings(): void {
        // Variáveis de ambiente têm prioridade sobre o banco de dados
        // Isso permite configuração via Docker / docker-compose
        const envHttpPort = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT, 10) : null;
        const envTcpPort = process.env.TCP_PORT ? parseInt(process.env.TCP_PORT, 10) : null;

        if (envHttpPort || envTcpPort) {
            if (envHttpPort) this.httpPort = envHttpPort;
            if (envTcpPort) this.tcpPort = envTcpPort;
            Logger.info('⚙️ Portas carregadas de variáveis de ambiente', {
                httpPort: this.httpPort,
                tcpPort: this.tcpPort
            });
            // Sincronizar banco de dados com as portas definidas por ENV
            try {
                this.authDb.updateServerSettings(this.httpPort, this.tcpPort);
            } catch (_) { /* ignora se falhar */ }
            return;
        }

        try {
            const settings: ServerSettings = this.authDb.getServerSettings();
            this.httpPort = settings.httpPort;
            this.tcpPort = settings.tcpPort;
            Logger.info('⚙️ Portas carregadas do banco de configurações', {
                httpPort: this.httpPort,
                tcpPort: this.tcpPort
            });
        } catch (error) {
            Logger.warn('⚠️ Falha ao carregar portas do banco, usando valores padrão', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private createServers(): void {
        this.createTcpServer();
        this.createHttpServer();
    }

    private createTcpServer(): void {
        this.tcpServer = net.createServer((socket: net.Socket) => {
            const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            Logger.info(`📡 Cliente TCP conectado: ${clientId}`);

            // TCP socket configuration to match Traccar/Netty behavior:
            // - Keep-alive: send periodic probes to detect dead connections
            // - NoDelay: disable Nagle's algorithm so small responses are sent immediately
            // - No timeout: let the connection stay open indefinitely (like Traccar)
            socket.setKeepAlive(true, 60000);  // enable TCP keep-alive, probe every 60s
            socket.setNoDelay(true);           // disable Nagle's algorithm (send immediately)
            socket.setTimeout(0);              // no idle timeout (like Traccar without config)

            // Each connection gets its own frame buffer for proper TCP stream reassembly
            // This is equivalent to Traccar's LengthFieldBasedFrameDecoder
            const frameBuffer = new CastelFrameBuffer();

            socket.on('data', (data: Buffer) => {
                const rawHex = data.toString('hex').toUpperCase();
                Logger.info(`📥 Dados TCP recebidos de ${clientId}: ${rawHex} (${data.length} bytes)`);

                // Feed data into the frame buffer and extract complete frames
                let frames: Buffer[];
                try {
                    frames = frameBuffer.feed(data);
                } catch (err) {
                    Logger.error(`❌ Erro no frame buffer para ${clientId}`, {
                        error: err instanceof Error ? err.message : String(err)
                    });
                    return;
                }

                if (frames.length === 0) {
                    Logger.debug(`⏳ Aguardando mais dados de ${clientId} (buffer parcial)`);
                    return;
                }

                Logger.info(`📦 ${frames.length} frame(s) completo(s) extraído(s) de ${clientId}`);

                // Process each complete frame
                for (const frameBuf of frames) {
                    const frameHex = frameBuf.toString('hex').toUpperCase();
                    Logger.debug(`🔍 Processando frame: ${frameHex}`);

                    // Parse the frame (extract version, deviceId, type, content, validate CRC)
                    const frame = parseFrame(frameBuf);
                    if (!frame) {
                        Logger.warn(`⚠️ Frame inválido de ${clientId}: ${frameHex}`);
                        // Still broadcast to TCP monitor
                        setImmediate(() => this.addTcpMessage(clientId, frameHex));
                        continue;
                    }

                    const typeName = getMessageTypeName(frame.type);
                    Logger.info(`📨 [${typeName}] de ${frame.deviceId} (v${frame.version}, CRC: ${frame.crcValid ? 'OK' : 'FAIL'})`);

                    // Determine and send response (exactly like Traccar's decodeSc)
                    // Only LOGIN, HEARTBEAT, and ALARM get responses. Everything else: no response.
                    try {
                        const response = handleCastelFrame(frame);
                        if (response && !socket.destroyed) {
                            socket.write(response);
                            Logger.info(`📤 Resposta [${typeName}] enviada para ${clientId}`, {
                                responseHex: response.toString('hex').toUpperCase(),
                                responseSize: response.length
                            });
                        }
                    } catch (replyError) {
                        Logger.warn(`⚠️ Erro ao enviar resposta para ${clientId}`, {
                            error: replyError instanceof Error ? replyError.message : String(replyError)
                        });
                    }

                    // Process and save data asynchronously (don't block the response)
                    setImmediate(() => this.addTcpMessage(clientId, frameHex));
                }
            });

            socket.on('end', () => {
                // Device sent FIN - graceful close from device side
                Logger.info(`📡 FIN recebido de ${clientId} (dispositivo fechou a conexão)`);
            });

            socket.on('close', (hadError: boolean) => {
                Logger.info(`📡 Cliente TCP desconectado: ${clientId}`, {
                    hadError,
                    bytesRead: socket.bytesRead,
                    bytesWritten: socket.bytesWritten,
                    destroyed: socket.destroyed,
                    readableEnded: socket.readableEnded,
                    writableFinished: socket.writableFinished,
                });
            });

            socket.on('timeout', () => {
                Logger.warn(`⏰ Socket timeout para ${clientId} (NÃO deveria acontecer com timeout=0)`);
            });

            socket.on('error', (error: Error) => {
                Logger.error(`❌ Erro no cliente TCP ${clientId}:`, {
                    message: error.message,
                    code: (error as any).code,
                    errno: (error as any).errno,
                });
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
            // Serve static files from React build (JS, CSS, assets)
            if (url.pathname.startsWith('/assets/') || 
                (url.pathname.endsWith('.js') && !url.pathname.startsWith('/api')) || 
                url.pathname.endsWith('.css') ||
                url.pathname.endsWith('.map')) {
                await this.handleStaticFile(res, url.pathname);
                return;
            }

            // API routes - handle before React app
            if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
                // Continue to API handling below
            } else {
                // All other routes serve React app (for React Router)
                await this.handleHomePage(res);
                return;
            }

            // Route handling for API and other endpoints
            Logger.debug('🔍 Processando rota API', { 
                pathname: url.pathname, 
                method: req.method,
                search: url.search 
            });
            if (url.pathname === '/') {
                await this.handleHomePage(res);
            } else if (url.pathname === '/health') {
                await this.handleHealthCheck(res, startTime);
            } else if (url.pathname === '/api/login' && req.method === 'POST') {
                await this.handleLogin(req, res, startTime);
            } else if (url.pathname === '/api/settings') {
                await this.handleSettings(req, res, startTime, url);
            } else if (url.pathname === '/api/users' || url.pathname.startsWith('/api/users/')) {
                await this.handleUsers(req, res, startTime, url);
            } else if (url.pathname === '/api/vehicles/update-locations') {
                await this.handleUpdateVehicleLocations(res, startTime);
            } else if (url.pathname.startsWith('/api/vehicles/')) {
                await this.handleVehicleDetail(req, res, startTime, url);
            } else if (url.pathname === '/api/vehicles') {
                await this.handleVehicles(req, res, startTime);
            } else if (url.pathname === '/api/devices') {
                await this.handleDevices(res, startTime);
            } else if (url.pathname.startsWith('/api/reports/')) {
                await this.handleReports(url, res, startTime);
            } else if (url.pathname.startsWith('/api/readings/')) {
                await this.handleReadings(url, res, startTime);
            } else if (url.pathname.startsWith('/api/odometer/')) {
                await this.handleOdometer(url, res, startTime);
            } else if (url.pathname === '/api/gps-all') {
                await this.handleAllGPSReadings(url, res, startTime);
            } else if (url.pathname === '/api/positions') {
                await this.handlePositions(url, res, startTime);
            } else if (url.pathname === '/api/positions/route' || url.pathname.startsWith('/api/positions/route/')) {
                await this.handleRouteProcessing(url, res, startTime);
            } else if (url.pathname === '/api/decode-hex') {
                await this.handleHexDecodeRequest(req, res, startTime);
            } else if (url.pathname === '/api/upload-file') {
                await this.handleFileUpload(req, res, startTime);
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

    // =========================
    // Auth helpers
    // =========================

    private cleanupExpiredSessions(): void {
        const now = Date.now();
        for (const [token, session] of this.sessions.entries()) {
            if (now - session.createdAt > this.sessionTtlMs) {
                this.sessions.delete(token);
            }
        }
    }

    private getAuthFromRequest(req: http.IncomingMessage): { username: string; role: UserRole } | null {
        this.cleanupExpiredSessions();
        const authHeader = req.headers['authorization'];
        if (!authHeader || typeof authHeader !== 'string') return null;

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
        const token = parts[1];
        const session = this.sessions.get(token);
        if (!session) return null;

        return { username: session.username, role: session.role };
    }

    private requireRole(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        startTime: number,
        role: UserRole
    ): { username: string; role: UserRole } | null {
        const auth = this.getAuthFromRequest(req);
        if (!auth) {
            this.sendHttpError(res, 'Não autenticado', 401, startTime);
            return null;
        }
        if (auth.role !== role) {
            this.sendHttpError(res, 'Acesso negado', 403, startTime);
            return null;
        }
        return auth;
    }

    private async handleLogin(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        startTime: number
    ): Promise<void> {
        try {
            const body = await this.getRequestBody(req);
            const { username, password } = JSON.parse(body);

            if (!username || !password) {
                this.sendHttpError(res, 'Usuário e senha são obrigatórios', 400, startTime);
                return;
            }

            const user = this.authDb.findUserByUsername(username);
            if (!user) {
                this.sendHttpError(res, 'Credenciais inválidas', 401, startTime);
                return;
            }

            const bcrypt = require('bcryptjs');
            const ok = bcrypt.compareSync(password, user.passwordHash);
            if (!ok) {
                this.sendHttpError(res, 'Credenciais inválidas', 401, startTime);
                return;
            }

            const token = uuidv4();
            this.sessions.set(token, {
                userId: user.id,
                username: user.username,
                role: user.role,
                createdAt: Date.now()
            });

            const response: APIResponse = {
                success: true,
                data: {
                    token,
                    username: user.username,
                    role: user.role
                },
                timestamp: new Date().toISOString(),
                processingTime: `${Date.now() - startTime}ms`
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response, null, 2));
        } catch (error) {
            Logger.error('Erro no login', {
                error: error instanceof Error ? error.message : String(error)
            });
            this.sendHttpError(res, 'Erro ao processar login', 500, startTime);
        }
    }

    private async handleSettings(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        startTime: number,
        url: URL
    ): Promise<void> {
        if (req.method === 'GET') {
            // GET /api/settings pode ser restrito a admin ou não; aqui vamos exigir admin
            const auth = this.requireRole(req, res, startTime, 'admin');
            if (!auth) return;

            try {
                const settings = this.authDb.getServerSettings();
                const response: APIResponse = {
                    success: true,
                    data: settings,
                    timestamp: new Date().toISOString(),
                    processingTime: `${Date.now() - startTime}ms`
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));
            } catch (error) {
                Logger.error('Erro ao obter configurações', {
                    error: error instanceof Error ? error.message : String(error)
                });
                this.sendHttpError(res, 'Erro ao obter configurações', 500, startTime);
            }
            return;
        }

        if (req.method === 'POST') {
            const auth = this.requireRole(req, res, startTime, 'admin');
            if (!auth) return;

            try {
                const body = await this.getRequestBody(req);
                const { httpPort, tcpPort } = JSON.parse(body);

                const newHttpPort = Number(httpPort);
                const newTcpPort = Number(tcpPort);

                if (
                    !Number.isInteger(newHttpPort) ||
                    !Number.isInteger(newTcpPort) ||
                    newHttpPort <= 0 ||
                    newTcpPort <= 0
                ) {
                    this.sendHttpError(res, 'Portas inválidas', 400, startTime);
                    return;
                }

                const updatedSettings = this.authDb.updateServerSettings(
                    newHttpPort,
                    newTcpPort
                );

                // Enviar resposta ANTES de reiniciar os servidores
                // (senão o fechamento do HTTP mata a conexão e o cliente recebe erro)
                const response: APIResponse = {
                    success: true,
                    data: {
                        settings: updatedSettings,
                        message:
                            'Portas atualizadas. Servidores HTTP e TCP serão reiniciados nas novas portas.'
                    },
                    timestamp: new Date().toISOString(),
                    processingTime: `${Date.now() - startTime}ms`
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));

                // Agendar restart dos servidores após a resposta ser enviada
                setTimeout(() => {
                    this.updatePorts(newHttpPort, newTcpPort).catch((err) => {
                        Logger.error('Erro ao reiniciar servidores nas novas portas', {
                            error: err instanceof Error ? err.message : String(err)
                        });
                    });
                }, 500);
            } catch (error) {
                Logger.error('Erro ao atualizar configurações', {
                    error: error instanceof Error ? error.message : String(error)
                });
                this.sendHttpError(res, 'Erro ao atualizar configurações', 500, startTime);
            }
            return;
        }

        this.sendHttpError(res, 'Método não suportado', 405, startTime);
    }

    private async updatePorts(newHttpPort: number, newTcpPort: number): Promise<void> {
        const oldHttp = this.httpPort;
        const oldTcp = this.tcpPort;

        if (newHttpPort === oldHttp && newTcpPort === oldTcp) {
            Logger.info('Portas já estão com os valores solicitados, nenhum restart necessário');
            return;
        }

        Logger.info('🔁 Reiniciando servidores com novas portas', {
            oldHttp,
            oldTcp,
            newHttpPort,
            newTcpPort
        });

        // Fechar servidores atuais
        await new Promise<void>((resolve) => {
            this.httpServer.close(() => {
                Logger.info('✅ Servidor HTTP antigo fechado');
                resolve();
            });
        });

        await new Promise<void>((resolve) => {
            this.tcpServer.close(() => {
                Logger.info('✅ Servidor TCP antigo fechado');
                resolve();
            });
        });

        // Atualizar portas em memória
        this.httpPort = newHttpPort;
        this.tcpPort = newTcpPort;

        // Criar novos servidores
        this.createServers();

        // Iniciar novos servidores nas novas portas
        await new Promise<void>((resolve, reject) => {
            this.tcpServer.listen(this.tcpPort, () => {
                Logger.info(`🚀 Servidor TCP reiniciado na porta ${this.tcpPort}`);
                
                this.httpServer.listen(this.httpPort, () => {
                    Logger.info(`🌐 Servidor HTTP reiniciado na porta ${this.httpPort}`);
                    Logger.info(`📊 Interface web disponível em: http://localhost:${this.httpPort}`);
                    resolve();
                });
            });

            this.tcpServer.on('error', reject);
            this.httpServer.on('error', reject);
        });

        Logger.info('✅ Servidores reiniciados com novas portas', {
            httpPort: this.httpPort,
            tcpPort: this.tcpPort
        });
    }

    private async handleUsers(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        startTime: number,
        url: URL
    ): Promise<void> {
        const auth = this.requireRole(req, res, startTime, 'admin');
        if (!auth) return;

        try {
            if (req.method === 'GET' && url.pathname === '/api/users') {
                const users = this.authDb.listUsers();
                const response: APIResponse = {
                    success: true,
                    data: users,
                    timestamp: new Date().toISOString(),
                    processingTime: `${Date.now() - startTime}ms`
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));
                return;
            }

            if (req.method === 'POST' && url.pathname === '/api/users') {
                const body = await this.getRequestBody(req);
                const { username, password, role } = JSON.parse(body);

                if (!username || !password || (role !== 'admin' && role !== 'user')) {
                    this.sendHttpError(res, 'Dados inválidos para criação de usuário', 400, startTime);
                    return;
                }

                const user = this.authDb.createUser(username, password, role);
                const response: APIResponse = {
                    success: true,
                    data: user,
                    timestamp: new Date().toISOString(),
                    processingTime: `${Date.now() - startTime}ms`
                };
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));
                return;
            }

            const userIdMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
            if (!userIdMatch) {
                this.sendHttpError(res, 'Endpoint de usuário inválido', 404, startTime);
                return;
            }

            const userId = parseInt(userIdMatch[1], 10);
            if (Number.isNaN(userId)) {
                this.sendHttpError(res, 'ID de usuário inválido', 400, startTime);
                return;
            }

            if (req.method === 'PUT') {
                const body = await this.getRequestBody(req);
                const { password, role } = JSON.parse(body);
                if (role && role !== 'admin' && role !== 'user') {
                    this.sendHttpError(res, 'Papel inválido', 400, startTime);
                    return;
                }
                const updated = this.authDb.updateUser(userId, { password, role });
                if (!updated) {
                    this.sendHttpError(res, 'Usuário não encontrado', 404, startTime);
                    return;
                }
                const response: APIResponse = {
                    success: true,
                    data: updated,
                    timestamp: new Date().toISOString(),
                    processingTime: `${Date.now() - startTime}ms`
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));
                return;
            }

            if (req.method === 'DELETE') {
                const ok = this.authDb.deleteUser(userId);
                if (!ok) {
                    this.sendHttpError(
                        res,
                        'Não é possível remover o último administrador ou usuário inexistente',
                        400,
                        startTime
                    );
                    return;
                }
                const response: APIResponse = {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                    processingTime: `${Date.now() - startTime}ms`
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));
                return;
            }

            this.sendHttpError(res, 'Método não suportado para /api/users', 405, startTime);
        } catch (error) {
            Logger.error('Erro ao processar requisição de usuários', {
                error: error instanceof Error ? error.message : String(error)
            });
            this.sendHttpError(res, 'Erro ao processar usuários', 500, startTime);
        }
    }

    private async handleStaticFile(res: http.ServerResponse, filePath: string): Promise<void> {
        try {
            const fullPath = path.join(__dirname, 'client', filePath);
            if (fs.existsSync(fullPath)) {
                const ext = path.extname(fullPath);
                const contentType = ext === '.js' ? 'application/javascript' :
                                   ext === '.css' ? 'text/css' :
                                   ext === '.json' ? 'application/json' :
                                   ext === '.map' ? 'application/json' : 'text/plain';
                
                res.setHeader('Content-Type', contentType);
                res.writeHead(200);
                res.end(fs.readFileSync(fullPath));
            } else {
                res.writeHead(404);
                res.end('File not found');
            }
        } catch (error) {
            Logger.error('Erro ao servir arquivo estático', { filePath, error });
            res.writeHead(500);
            res.end('Error');
        }
    }

    private async handleHomePage(res: http.ServerResponse): Promise<void> {
        try {
            // Try to serve React app first
            const reactIndexPath = path.join(__dirname, 'client', 'index.html');
            Logger.info('📄 Verificando React app', { 
                reactPath: reactIndexPath,
                exists: fs.existsSync(reactIndexPath),
                __dirname 
            });
            
            if (fs.existsSync(reactIndexPath)) {
                Logger.info('✅ Servindo React app');
                const html = fs.readFileSync(reactIndexPath, 'utf8');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.writeHead(200);
                res.end(html);
                return;
            }

            // Fallback to old HTML
            Logger.warn('⚠️ React app não encontrado, usando fallback HTML');
            const htmlPath = path.join(__dirname, 'views', 'hex-form.html');
            if (fs.existsSync(htmlPath)) {
                const html = fs.readFileSync(htmlPath, 'utf8');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.writeHead(200);
                res.end(html);
            } else {
                Logger.error('❌ Nenhum arquivo HTML encontrado');
                res.writeHead(500);
                res.end('Arquivo HTML não encontrado');
            }
        } catch (error) {
            Logger.error('Erro ao servir página inicial', {
                error: error instanceof Error ? error.message : String(error)
            });
            res.writeHead(500);
            res.end('Erro ao carregar página');
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
            try {
                Logger.debug('📂 Carregando registro de veículos...');
                const vehicleRegistry = this.loadVehicleRegistry();
                Logger.debug('✅ Registro carregado', { 
                    totalVehicles: Object.keys(vehicleRegistry.vehicles || {}).length 
                });
                
                const vehicles = Object.values(vehicleRegistry.vehicles || {}).map((vehicle: any) => {
                    const operationalData = this.calculateRealOperationalData(vehicle.deviceInfo?.deviceId);
                    // Persisted odometer (quilometragem atual), se existir
                    const odometerReading = vehicle.observations?.odometerReading;
                    return { 
                        ...vehicle, 
                        operationalData: {
                            ...operationalData,
                            odometerKm: typeof odometerReading === 'number' ? `${odometerReading} km` : undefined
                        }
                    };
                });

                const response = {
                    vehicles: vehicles,
                    totalVehicles: vehicles.length,
                    metadata: {
                        version: vehicleRegistry.metadata?.version || '1.0.0',
                        lastUpdate: new Date().toISOString()
                    }
                };

                Logger.info('✅ Resposta de veículos preparada', { 
                    totalVehicles: vehicles.length,
                    vehicleIds: vehicles.map((v: any) => v.deviceInfo?.deviceId || 'N/A')
                });

                this.sendHttpResponse(res, response, 200, startTime);
            } catch (error) {
                Logger.error('❌ Erro ao carregar veículos', { 
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                this.sendHttpError(res, 'Erro ao carregar veículos: ' + (error instanceof Error ? error.message : String(error)), 500, startTime);
            }
        } else if (req.method === 'POST') {
            // Criar novo veículo
            try {
                const body = await this.getRequestBody(req);
                const data = JSON.parse(body || '{}');

                const deviceId = (data.deviceId || '').trim();
                if (!deviceId) {
                    this.sendHttpError(res, 'deviceId é obrigatório', 400, startTime);
                    return;
                }

                const registry = this.loadVehicleRegistry();
                if (!registry.vehicles) {
                    registry.vehicles = {};
                }
                if (registry.vehicles[deviceId]) {
                    this.sendHttpError(res, `Veículo com deviceId ${deviceId} já existe`, 400, startTime);
                    return;
                }

                const now = new Date().toISOString();
                const odometerKm = typeof data.odometerKm === 'number' ? data.odometerKm : 0;

                const newVehicle: any = {
                    deviceInfo: {
                        deviceId,
                        deviceType: data.deviceType || 'OBD',
                        protocolIds: data.protocolIds || [],
                        firmwareVersion: data.firmwareVersion || 'unknown',
                        hardwareVersion: data.hardwareVersion || 'unknown',
                        installationDate: now,
                        status: data.status || 'active'
                    },
                    vehicleSpecs: {
                        brand: data.brand || '',
                        model: data.model || '',
                        year: data.year || '',
                        engine: {
                            displacement: data.engineDisplacement || '',
                            fuelType: data.fuelType || 'gasoline',
                            power: data.enginePower || ''
                        },
                        fuel: {
                            tankCapacityLiters: data.tankCapacityLiters || 60,
                            fuelType: data.fuelType || 'gasoline',
                            estimatedConsumption: data.estimatedConsumption || ''
                        },
                        transmission: data.transmission || '',
                        category: data.category || ''
                    },
                    telemetryConfig: {
                        currentFuel: {
                            status: 'RELIABLE',
                            interpretation: 'Percentage from 0-1024',
                            calibrated: false,
                            notes: ''
                        },
                        totalFuel: {
                            status: 'RELIABLE',
                            unit: 'liters',
                            conversion: '1:1',
                            calibrated: false
                        },
                        odometer: {
                            status: 'PENDING',
                            interpretation: '',
                            notes: ''
                        }
                    },
                    operationalData: {
                        usage: data.usage || 'daily',
                        location: '',
                        averageSpeed: 0,
                        totalDistance: odometerKm,
                        fuelConsumption: 0,
                        lastUpdate: now
                    },
                    observations: {
                        fuelGauge: '',
                        odometerReading: odometerKm,
                        issues: []
                    }
                };

                registry.vehicles[deviceId] = newVehicle;
                if (!registry.metadata) {
                    registry.metadata = { version: '1.0.0', lastModified: now, totalVehicles: 0 };
                }
                registry.metadata.lastModified = now;
                registry.metadata.totalVehicles = Object.keys(registry.vehicles).length;
                this.saveVehicleRegistry(registry);

                const operationalData = this.calculateRealOperationalData(deviceId);
                const responseVehicle = {
                    ...newVehicle,
                    operationalData: {
                        ...operationalData,
                        odometerKm: `${odometerKm} km`
                    }
                };

                this.sendHttpResponse(res, responseVehicle, 201, startTime);
            } catch (error) {
                Logger.error('❌ Erro ao criar veículo', { 
                    error: error instanceof Error ? error.message : String(error)
                });
                this.sendHttpError(res, 'Erro ao criar veículo', 500, startTime);
            }
        } else {
            this.sendHttpError(res, 'Método não suportado para /api/vehicles', 405, startTime);
        }
    }

    private async handleUpdateVehicleLocations(res: http.ServerResponse, startTime: number): Promise<void> {
        try {
            const { DatabaseManager } = require('./models/database');
            const dbManager = DatabaseManager.getInstance();
            const fs = require('fs');
            const path = require('path');
            const registryPath = path.join(process.cwd(), 'data', 'vehicle-registry.json');
            const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
            const deviceIds = Object.keys(registry.vehicles || {});

            // Buscar última posição GPS de cada dispositivo
            const allReadings = dbManager.getAllGPSReadings(undefined, undefined);
            const latestByDevice: Record<string, any> = {};
            for (const r of allReadings) {
                if (r.latitude && r.longitude && r.latitude !== 0 && r.longitude !== 0) {
                    if (!latestByDevice[r.deviceId] || new Date(r.timestamp) > new Date(latestByDevice[r.deviceId].timestamp)) {
                        latestByDevice[r.deviceId] = r;
                    }
                }
            }

            const updated: Record<string, string> = {};

            for (const deviceId of deviceIds) {
                const pos = latestByDevice[deviceId];
                if (!pos) continue;

                try {
                    const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${pos.latitude}&lon=${pos.longitude}&format=json&zoom=16&addressdetails=1&accept-language=pt-BR`;
                    const geoRes = await fetch(geoUrl, {
                        headers: { 'User-Agent': 'TelemetrySystem/1.0' }
                    });

                    if (geoRes.ok) {
                        const geo = await geoRes.json();
                        const addr = geo.address || {};
                        const parts: string[] = [];
                        if (addr.road) parts.push(addr.road);
                        if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
                        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
                        if (addr.state) parts.push(addr.state);
                        const location = parts.length > 0 ? parts.join(', ') : (geo.display_name || '');

                        if (location) {
                            // Atualizar no registro
                            const vehicle = registry.vehicles[deviceId];
                            if (vehicle && vehicle.operationalData) {
                                vehicle.operationalData.location = location;
                                vehicle.operationalData.lastUpdate = new Date().toISOString();
                            }
                            updated[deviceId] = location;
                        }
                    }

                    // Respeitar rate limit do Nominatim (1 req/s)
                    await new Promise(r => setTimeout(r, 1100));
                } catch (geoErr) {
                    Logger.warn(`Geocoding falhou para ${deviceId}`, {
                        error: geoErr instanceof Error ? geoErr.message : String(geoErr)
                    });
                }
            }

            // Salvar registro atualizado diretamente no arquivo JSON
            if (Object.keys(updated).length > 0) {
                const fs = require('fs');
                const path = require('path');
                const registryPath = path.join(process.cwd(), 'data', 'vehicle-registry.json');
                fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
                Logger.info('📍 Localizações atualizadas no registro de veículos', { updated });
            }

            this.sendHttpResponse(res, { updated, count: Object.keys(updated).length }, 200, startTime);
        } catch (error) {
            Logger.error('Erro ao atualizar localizações', {
                error: error instanceof Error ? error.message : String(error)
            });
            this.sendHttpError(res, 'Erro ao atualizar localizações', 500, startTime);
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
            
            // Parse query parameters
            const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit') || '50', 10) : 50;
            const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset') || '0', 10) : 0;
            
            // Get readings with audit trail information
            const readings = dbManager.getReadings(deviceId, limit, offset);
            
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

    private async handleOdometer(url: URL, res: http.ServerResponse, startTime: number): Promise<void> {
        const pathParts = url.pathname.split('/');
        const deviceId = pathParts[3];

        if (!deviceId) {
            this.sendHttpError(res, 'Device ID é obrigatório', 400, startTime);
            return;
        }

        try {
            Logger.info(`📏 Calculando odometria por GPS para device: ${deviceId}`);

            // Carregar leituras do banco de dados JSON e calcular odometria
            const { DatabaseManager } = require('./models/database');
            const dbManager = DatabaseManager.getInstance();
            const odometer = dbManager.getOdometerFromGps(deviceId);

            const response = {
                deviceId,
                totalDistanceMeters: odometer.totalMeters,
                totalDistanceKm: odometer.totalKm,
                points: odometer.points,
            };

            this.sendHttpResponse(res, response, 200, startTime);
        } catch (error) {
            Logger.error('Erro ao calcular odometria por GPS', {
                deviceId,
                error: error instanceof Error ? error.message : String(error),
            });
            this.sendHttpError(
                res,
                `Erro ao calcular odometria: ${error instanceof Error ? error.message : String(error)}`,
                500,
                startTime,
            );
        }
    }

    /**
     * Endpoint inspirado no /positions do Traccar.
     * GET /api/positions
     *  - sem parâmetros  -> últimas posições conhecidas de todos os devices
     *  - deviceId+from/to -> trilha histórica daquele device no intervalo
     */
    private async handlePositions(url: URL, res: http.ServerResponse, startTime: number): Promise<void> {
        try {
            Logger.info('🗺️ Carregando posições via /api/positions', {
                search: url.search
            });

            const { DatabaseManager } = require('./models/database');
            const dbManager = DatabaseManager.getInstance();

            const deviceIdParam = url.searchParams.get('deviceId');
            const from = url.searchParams.get('from') || undefined;
            const to = url.searchParams.get('to') || undefined;

            Logger.debug('📋 Parâmetros da requisição', {
                deviceId: deviceIdParam,
                from,
                to
            });

            let readings;

            if (deviceIdParam) {
                // Histórico de um device específico (trilha)
                Logger.info(`🔍 Buscando trilha para dispositivo: ${deviceIdParam}`);
                readings = dbManager.getGPSTrail(deviceIdParam, from, to);
                Logger.info(`✅ Encontradas ${readings.length} leituras na trilha`);
            } else {
                // Última posição conhecida de cada device (similar ao Traccar sem parâmetros)
                Logger.info('🔍 Buscando últimas posições de todos os dispositivos');
                const all = dbManager.getAllGPSReadings(undefined, undefined);
                Logger.info(`📊 Total de leituras GPS encontradas: ${all.length}`);
                
                const latestByDevice: { [key: string]: any } = {};
                for (const r of all) {
                    if (!latestByDevice[r.deviceId]) {
                        latestByDevice[r.deviceId] = r;
                    }
                }
                readings = Object.values(latestByDevice);
                Logger.info(`✅ Últimas posições de ${readings.length} dispositivo(s)`);
            }

            const positions = readings.map((r: any) => ({
                id: r.id,
                deviceId: r.deviceId,
                timestamp: r.timestamp,
                latitude: r.latitude,
                longitude: r.longitude,
                speed: r.speedKmH ?? 0,
                course: r.direction ?? 0,
                satellites: r.satellites,
                protocolId: r.protocolId,
            }));

            Logger.info(`📤 Retornando ${positions.length} posição(ões)`);

            const response = {
                positions,
                count: positions.length,
            };

            this.sendHttpResponse(res, response, 200, startTime);
        } catch (error) {
            Logger.error('Erro ao carregar posições em /api/positions', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.sendHttpError(
                res,
                `Erro ao carregar posições: ${error instanceof Error ? error.message : String(error)}`,
                500,
                startTime,
            );
        }
    }

    /**
     * Cache de rotas processadas (deviceId + from + to -> rota processada)
     */
    private routeCache: Map<string, { route: any[]; timestamp: number }> = new Map();
    private readonly ROUTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    private getRouteCacheKey(deviceId: string, from?: string, to?: string): string {
        return `${deviceId}:${from || 'all'}:${to || 'all'}`;
    }

    private getCachedRoute(deviceId: string, from?: string, to?: string): any[] | null {
        const key = this.getRouteCacheKey(deviceId, from, to);
        const cached = this.routeCache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.ROUTE_CACHE_TTL) {
            Logger.debug('✅ Rota encontrada no cache', { key });
            return cached.route;
        }
        
        if (cached) {
            this.routeCache.delete(key); // Remover cache expirado
        }
        
        return null;
    }

    private setCachedRoute(deviceId: string, route: any[], from?: string, to?: string): void {
        const key = this.getRouteCacheKey(deviceId, from, to);
        this.routeCache.set(key, {
            route,
            timestamp: Date.now()
        });
        Logger.debug('💾 Rota salva no cache', { key, points: route.length });
    }

    /**
     * Endpoint para processar rotas com map matching (snap-to-road)
     * GET /api/positions/route?deviceId=...&from=...&to=...
     * Retorna rotas processadas com snap-to-road aplicado (com cache)
     */
    private async handleRouteProcessing(url: URL, res: http.ServerResponse, startTime: number): Promise<void> {
        try {
            Logger.info('🛣️ Processando rota com map matching', {
                search: url.search
            });

            const { DatabaseManager } = require('./models/database');
            // Utilitário de map matching (snap-to-road) no backend
            // Caminho relativo ao arquivo compilado dist/server.js -> dist/utils/route-matcher-server.js
            const routeMatcher = require('./utils/route-matcher-server');
            const dbManager = DatabaseManager.getInstance();

            const deviceIdParam = url.searchParams.get('deviceId');
            const from = url.searchParams.get('from') || undefined;
            const to = url.searchParams.get('to') || undefined;

            if (!deviceIdParam) {
                this.sendHttpError(res, 'deviceId é obrigatório', 400, startTime);
                return;
            }

            // Verificar cache primeiro
            const cachedRoute = this.getCachedRoute(deviceIdParam, from, to);
            if (cachedRoute) {
                const response = {
                    deviceId: deviceIdParam,
                    processedRoute: cachedRoute,
                    originalPoints: cachedRoute.length,
                    processedPoints: cachedRoute.length,
                    cached: true,
                };
                this.sendHttpResponse(res, response, 200, startTime);
                return;
            }

            Logger.debug('📋 Parâmetros da requisição de rota', {
                deviceId: deviceIdParam,
                from,
                to
            });

            // Buscar trilha GPS do dispositivo
            const readings = dbManager.getGPSTrail(deviceIdParam, from, to);
            Logger.info(`✅ Encontradas ${readings.length} leituras na trilha`);

            // Filtrar coordenadas inválidas/zeradas (0,0) antes do map matching
            const readingsWithValidGps = readings.filter((r: any) =>
                r.latitude != null &&
                r.longitude != null &&
                r.latitude !== 0 &&
                r.longitude !== 0
            );

            const droppedZeroPoints = readings.length - readingsWithValidGps.length;
            Logger.info('📍 Filtragem de GPS para rota', {
                deviceId: deviceIdParam,
                totalTrailPoints: readings.length,
                validGpsPoints: readingsWithValidGps.length,
                droppedZeroPoints
            });

            if (readings.length === 0) {
                const response = {
                    deviceId: deviceIdParam,
                    processedRoute: [],
                    originalPoints: 0,
                    processedPoints: 0,
                    cached: false,
                    reason: 'NO_TRAIL_POINTS',
                };
                this.sendHttpResponse(res, response, 200, startTime);
                return;
            }

            // Se não houver pontos GPS válidos suficientes, retornar motivo claro
            if (readingsWithValidGps.length < 2) {
                const response = {
                    deviceId: deviceIdParam,
                    processedRoute: [],
                    originalPoints: readings.length,
                    processedPoints: 0,
                    cached: false,
                    reason: readingsWithValidGps.length === 0 ? 'NO_VALID_GPS_POINTS' : 'ONLY_ONE_VALID_GPS_POINT',
                    meta: {
                        totalTrailPoints: readings.length,
                        validGpsPoints: readingsWithValidGps.length,
                        droppedZeroPoints
                    }
                };
                this.sendHttpResponse(res, response, 200, startTime);
                return;
            }

            // Converter para formato GPSPoint (apenas pontos válidos)
            const gpsPoints = readingsWithValidGps.map((r: any) => ({
                latitude: r.latitude,
                longitude: r.longitude,
                timestamp: r.timestamp,
                speed: r.speedKmH || 0,
            }));

            // Processar rota com map matching
            Logger.info(`🛣️ Processando ${gpsPoints.length} pontos com OSRM...`);
            let processedPoints;
            try {
                processedPoints = await routeMatcher.processRouteForMapMatching(gpsPoints, {
                    filterOutliers: true,
                    maxOutlierDistance: 1000,
                    useOSRM: true,
                });
                Logger.info(`✅ Rota processada: ${gpsPoints.length} → ${processedPoints.length} pontos`);
            } catch (error) {
                Logger.error('Erro ao processar rota com map matching', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                throw error;
            }

            // Salvar no cache (somente se retornou algo útil)
            if (Array.isArray(processedPoints) && processedPoints.length >= 2) {
                this.setCachedRoute(deviceIdParam, processedPoints, from, to);
            }

            const response = {
                deviceId: deviceIdParam,
                processedRoute: processedPoints,
                originalPoints: gpsPoints.length,
                processedPoints: processedPoints.length,
                cached: false,
                meta: {
                    totalTrailPoints: readings.length,
                    validGpsPoints: readingsWithValidGps.length,
                    droppedZeroPoints
                }
            };

            this.sendHttpResponse(res, response, 200, startTime);
        } catch (error) {
            Logger.error('Erro ao processar rota com map matching', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.sendHttpError(
                res,
                `Erro ao processar rota: ${error instanceof Error ? error.message : String(error)}`,
                500,
                startTime,
            );
        }
    }

    private async handleAllGPSReadings(url: URL, res: http.ServerResponse, startTime: number): Promise<void> {
        try {
            Logger.info('🗺️ Carregando todas as leituras GPS');
            
            // Load readings from the existing readings.json database
            const { DatabaseManager } = require('./models/database');
            const dbManager = DatabaseManager.getInstance();
            
            // Parse query parameters
            const deviceId = url.searchParams.get('deviceId') || undefined;
            const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit') || '0', 10) : undefined;
            
            // Get all GPS readings
            const readings = dbManager.getAllGPSReadings(deviceId, limit);
            
            // Group by deviceId for route plotting
            const groupedByDevice: { [key: string]: any[] } = {};
            readings.forEach((reading: any) => {
                if (!groupedByDevice[reading.deviceId]) {
                    groupedByDevice[reading.deviceId] = [];
                }
                groupedByDevice[reading.deviceId].push(reading);
            });

            // Sort each group by timestamp (oldest first for route plotting)
            Object.keys(groupedByDevice).forEach(deviceId => {
                groupedByDevice[deviceId].sort((a, b) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
            });
            
            const response = {
                totalReadings: readings.length,
                uniqueDevices: Object.keys(groupedByDevice).length,
                readings: readings,
                groupedByDevice: groupedByDevice,
                metadata: {
                    source: 'readings.json',
                    includesGPS: true,
                    lastUpdate: new Date().toISOString()
                }
            };

            this.sendHttpResponse(res, response, 200, startTime);
        } catch (error) {
            Logger.error('Erro ao carregar todas as leituras GPS', { error: error instanceof Error ? error.message : String(error) });
            this.sendHttpError(res, `Erro ao carregar leituras GPS: ${error instanceof Error ? error.message : String(error)}`, 500, startTime);
        }
    }

    private saveVehicleRegistry(registry: any): void {
        const filePath = path.join(process.cwd(), 'data', 'vehicle-registry.json');
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf8');
            Logger.info('✅ Registro de veículos salvo com sucesso', {
                totalVehicles: Object.keys(registry.vehicles || {}).length
            });
        } catch (error) {
            Logger.error('❌ Erro ao salvar registro de veículos', { 
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async handleVehicleDetail(
        req: http.IncomingMessage, 
        res: http.ServerResponse, 
        startTime: number, 
        url: URL
    ): Promise<void> {
        const parts = url.pathname.split('/');
        const deviceId = decodeURIComponent(parts[3] || '');

        if (!deviceId) {
            this.sendHttpError(res, 'Device ID é obrigatório', 400, startTime);
            return;
        }

        const registry = this.loadVehicleRegistry();
        if (!registry.vehicles) {
            registry.vehicles = {};
        }

        const existing = registry.vehicles[deviceId];

        if (req.method === 'GET') {
            if (!existing) {
                this.sendHttpError(res, `Veículo com Device ID ${deviceId} não encontrado`, 404, startTime);
                return;
            }

            const operationalData = this.calculateRealOperationalData(deviceId);
            const odometerReading = existing.observations?.odometerReading;
            const vehicleWithOperational = {
                ...existing,
                operationalData: {
                    ...operationalData,
                    odometerKm: typeof odometerReading === 'number' ? `${odometerReading} km` : undefined
                }
            };

            this.sendHttpResponse(res, vehicleWithOperational, 200, startTime);
            return;
        }

        if (req.method === 'PUT') {
            if (!existing) {
                this.sendHttpError(res, `Veículo com Device ID ${deviceId} não encontrado`, 404, startTime);
                return;
            }

            try {
                const body = await this.getRequestBody(req);
                const data = JSON.parse(body || '{}');
                const now = new Date().toISOString();

                // Atualizar campos de especificação
                if (!existing.vehicleSpecs) existing.vehicleSpecs = {} as any;
                existing.vehicleSpecs.brand = data.brand ?? existing.vehicleSpecs.brand;
                existing.vehicleSpecs.model = data.model ?? existing.vehicleSpecs.model;
                existing.vehicleSpecs.year = data.year ?? existing.vehicleSpecs.year;
                existing.vehicleSpecs.category = data.category ?? existing.vehicleSpecs.category;

                if (!existing.vehicleSpecs.engine) {
                    existing.vehicleSpecs.engine = { displacement: '', fuelType: 'gasoline', power: '' };
                }
                if (!existing.vehicleSpecs.fuel) {
                    existing.vehicleSpecs.fuel = { tankCapacityLiters: 60, fuelType: 'gasoline', estimatedConsumption: '' };
                }

                if (data.engineDisplacement !== undefined) {
                    existing.vehicleSpecs.engine.displacement = data.engineDisplacement;
                }
                if (data.enginePower !== undefined) {
                    existing.vehicleSpecs.engine.power = data.enginePower;
                }
                if (data.fuelType !== undefined) {
                    existing.vehicleSpecs.fuel.fuelType = data.fuelType;
                }
                if (data.tankCapacityLiters !== undefined) {
                    existing.vehicleSpecs.fuel.tankCapacityLiters = data.tankCapacityLiters;
                }
                if (data.transmission !== undefined) {
                    existing.vehicleSpecs.transmission = data.transmission;
                }

                // Atualizar quilometragem atual
                if (!existing.observations) {
                    existing.observations = { fuelGauge: '', odometerReading: 0, issues: [] };
                }
                if (data.odometerKm !== undefined && !isNaN(Number(data.odometerKm))) {
                    const odo = Number(data.odometerKm);
                    existing.observations.odometerReading = odo;

                    if (!existing.operationalData) {
                        existing.operationalData = {
                            usage: 'daily',
                            location: '',
                            averageSpeed: 0,
                            totalDistance: odo,
                            fuelConsumption: 0,
                            lastUpdate: now
                        };
                    } else {
                        existing.operationalData.totalDistance = odo;
                        existing.operationalData.lastUpdate = now;
                    }
                }

                if (!registry.metadata) {
                    registry.metadata = { version: '1.0.0', lastModified: now, totalVehicles: 0 };
                }
                registry.metadata.lastModified = now;

                registry.vehicles[deviceId] = existing;
                this.saveVehicleRegistry(registry);

                const operationalData = this.calculateRealOperationalData(deviceId);
                const odometerReading = existing.observations?.odometerReading;
                const responseVehicle = {
                    ...existing,
                    operationalData: {
                        ...operationalData,
                        odometerKm: typeof odometerReading === 'number' ? `${odometerReading} km` : undefined
                    }
                };

                this.sendHttpResponse(res, responseVehicle, 200, startTime);
            } catch (error) {
                Logger.error('❌ Erro ao atualizar veículo', {
                    error: error instanceof Error ? error.message : String(error),
                    deviceId
                });
                this.sendHttpError(res, 'Erro ao atualizar veículo', 500, startTime);
            }
            return;
        }

        this.sendHttpError(res, 'Método não suportado para /api/vehicles/:id', 405, startTime);
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

            // Save to database if decoding was successful
            if (result.success && result.decoded) {
                try {
                    const { DatabaseManager } = require('./models/database');
                    const dbManager = DatabaseManager.getInstance();
                    
                    const auditInfo = {
                        clientId: 'hex-decoder-api',
                        context: 'DECODED_FROM_HEX_DECODER',
                        dataLength: `${cleanHex.length / 2} bytes`,
                        asciiRepresentation: Buffer.from(cleanHex, 'hex').toString('ascii').replace(/[^\x20-\x7E]/g, '.'),
                        byteArray: Array.from(Buffer.from(cleanHex, 'hex')),
                        originalJsonObject: {
                            source: 'hex-decoder-api',
                            timestamp: new Date().toISOString(),
                            hexLength: cleanHex.length,
                            decoded: true
                        }
                    };

                    const readingId = dbManager.saveReading(result.decoded, cleanHex, auditInfo);
                    result.savedToDatabase = true;
                    result.readingId = readingId;
                } catch (dbError) {
                    Logger.warn('⚠️ Erro ao salvar dados do hex decoder no banco', {
                        error: dbError instanceof Error ? dbError.message : String(dbError)
                    });
                    result.savedToDatabase = false;
                }
            }

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

    private async handleFileUpload(req: http.IncomingMessage, res: http.ServerResponse, startTime: number): Promise<void> {
        if (req.method !== 'POST') {
            this.sendHttpError(res, 'Método não suportado', 405, startTime);
            return;
        }

        try {
            const { FileUploadController } = require('./controllers/file-upload-controller');
            const fileUploadController = new FileUploadController();
            await fileUploadController.uploadFile(req, res);
        } catch (error) {
            Logger.error('Erro ao processar upload de arquivo', { error: error instanceof Error ? error.message : String(error) });
            this.sendHttpError(res, 'Erro ao processar upload: ' + (error instanceof Error ? error.message : String(error)), 500, startTime);
        }
    }

    private async handleTcpStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        Logger.info('📡 Iniciando conexão SSE para TCP stream');
        
        try {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // Send initial connection
            res.write('data: {"type":"connected"}\n\n');
            Logger.info('✅ Mensagem de conexão enviada ao cliente SSE');

            // Add client to SSE clients set
            this.sseClients.add(res);
            Logger.info('✅ Cliente SSE adicionado', { 
                totalClients: this.sseClients.size,
                recentMessages: this.tcpMessages.length
            });

            // Send recent messages
            const recentMessages = this.tcpMessages.slice(-10);
            Logger.debug('📤 Enviando mensagens recentes', { count: recentMessages.length });
            recentMessages.forEach(message => {
                res.write(`data: ${JSON.stringify(message)}\n\n`);
            });

            // Handle client disconnect
            req.on('close', () => {
                this.sseClients.delete(res);
                Logger.info('🔌 Cliente SSE desconectado do TCP stream', { 
                    remainingClients: this.sseClients.size 
                });
            });

            req.on('error', (error) => {
                this.sseClients.delete(res);
                Logger.error('❌ Erro no cliente SSE', { 
                    error: error instanceof Error ? error.message : String(error) 
                });
            });
        } catch (error) {
            Logger.error('❌ Erro ao configurar TCP stream', { 
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
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
            deviceId = decoded.decoded?.deviceId;
            crcValid = decoded.decoded?.crcValid;
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

                // Save reading with audit trail (decoded.decoded contém o DecodedMessage)
                const readingId = dbManager.saveReading(decoded.decoded, rawHex, auditInfo);
                
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