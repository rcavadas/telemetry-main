import * as net from 'net';
import * as http from 'http';
import { OBDCRCUtils } from './utils/crc-utils';
import { EventEmitter } from 'events';
import { LoginReply } from './login-reply';
import { Logger, LogLevel } from './utils/logger';

// Set log level based on environment
Logger.setLevel(process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO);

interface ParsedMessage {
  header: string;
  messageType: string;
  deviceId?: string;
  data: Buffer;
  raw: Buffer;
  crcInfo?: { isValid: boolean, type: string, details: string };
}

class OBDServer extends EventEmitter {
  private port: number;
  private server: net.Server | null = null;
  private clients: Map<string, net.Socket> = new Map();

  constructor(port: number = 8080) {
    super();
    this.port = port;
  }

  start() {
    this.server = net.createServer((socket: net.Socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      Logger.clientConnected(clientId);

      this.clients.set(clientId, socket);

      socket.on('data', (data: Buffer) => {
        try {
          // SEMPRE mostrar dados brutos recebidos
          Logger.rawData(data);
          
          const message = this.parseMessage(data);
          this.handleMessage(clientId, message);
        } catch (error) {
          Logger.error('Erro ao processar mensagem', { 
            clientId, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      });

      socket.on('close', () => {
        Logger.clientDisconnected(clientId);
        this.clients.delete(clientId);
      });

      socket.on('error', (error: Error) => {
        Logger.error(`Erro do cliente ${clientId}`, { error: error.message });
        this.clients.delete(clientId);
      });
    });

    this.server.listen(this.port, () => {
      Logger.serverStarted(this.port);
    });
  }

  parseMessage(data: Buffer): ParsedMessage {
    let offset = 0;
    let messageType = 'UNKNOWN';
    let deviceId: string | undefined;
    let header = '';
    let crcInfo: { isValid: boolean, type: string, details: string } | undefined;

    // Check for message start markers
    if (data.length < 2) {
      throw new Error('Mensagem muito curta');
    }

    // Validate CRC if message is long enough
    if (data.length > 4) {
      try {
        crcInfo = OBDCRCUtils.validateCRC(data);
        Logger.info(`🔍 Validação CRC: ${crcInfo.type}`, {
          válido: crcInfo.isValid,
          detalhes: crcInfo.details,
          dadosOriginais: data.toString('hex'),
          tamanhoOriginal: data.length,
          ultimosBytes: data.slice(-4).toString('hex')
        });
      } catch (error) {
        Logger.warn('Falha na validação CRC', { error });
      }
    }

    // Look for common protocol patterns
    if (data[0] === 0x40 && data[1] === 0x40) { // @@
      messageType = 'LOGIN_OR_DATA';
      offset = 2;
      
      // Try to extract device ID (usually follows after some bytes)
      const deviceIdMatch = data.toString('ascii').match(/(\d{15,18})/);
      if (deviceIdMatch) {
        deviceId = deviceIdMatch[1];
        header = deviceId;
      }
      
    } else if (data[0] === 0x24) { // $ character
      messageType = 'TEXT_COMMAND';
      const textData = data.toString('ascii');
      const endIndex = textData.indexOf('#');
      if (endIndex > 0) {
        header = textData.substring(1, endIndex);
      }
    } else {
      // Try to find readable strings in the data
      const asciiString = data.toString('ascii');
      const readableMatch = asciiString.match(/([A-Z0-9]{10,})/);
      if (readableMatch) {
        header = readableMatch[1];
        deviceId = readableMatch[1];
      }
    }

    return {
      header: header || 'BINARY_DATA',
      messageType,
      deviceId,
      data: data.slice(offset),
      raw: data,
      crcInfo,
    };
  }

  handleMessage(clientId: string, message: ParsedMessage) {
    // Emit the message event for external handling
    this.emit('message', clientId, message);

    Logger.messageReceived(clientId, {
      type: message.messageType,
      deviceId: message.deviceId,
      dataLength: message.data.length,
      crcValid: message.crcInfo?.isValid,
      crcType: message.crcInfo?.type
    });

    // Handle different message types
    switch (message.messageType) {
      case 'LOGIN_OR_DATA':
        this.handleLoginOrData(clientId, message);
        break;
      case 'TEXT_COMMAND':
        this.handleTextCommand(clientId, message);
        break;
      default:
        this.handleBinaryData(clientId, message);
    }
  }

  handleLoginOrData(clientId: string, message: ParsedMessage) {
    Logger.messageProcessed(clientId, 'LOGIN/DATA');
    
    // Extract additional information from the binary data
    const data = message.data;
    const deviceInfo: any = {};
    
    // Look for version strings, timestamps, etc.
    const asciiData = data.toString('ascii');
    const versionMatch = asciiData.match(/([\d\.]+_[A-Z]+ \d{4}-\d{2}-\d{2})/);
    if (versionMatch) {
      deviceInfo.firmware = versionMatch[1];
    }
    
    const deviceMatch = asciiData.match(/([A-Z0-9\-]+ +[A-Z0-9\-]+)/);
    if (deviceMatch) {
      deviceInfo.hardware = deviceMatch[1].trim();
    }

    if (Object.keys(deviceInfo).length > 0) {
      Logger.deviceInfo(clientId, deviceInfo);
    }
    
    // Determine if this is a login or data packet
    if (message.deviceId) {
      // Send proper login response
      const loginResponse = LoginReply.createLoginResponse(message.deviceId);
      this.sendBinaryResponse(clientId, loginResponse);
    } else {
      // Send data acknowledgment
      const ackResponse = LoginReply.createDataAckResponse();
      this.sendBinaryResponse(clientId, ackResponse);
    }
  }

  handleTextCommand(clientId: string, message: ParsedMessage) {
    Logger.messageProcessed(clientId, 'TEXT_COMMAND', { command: message.header });
    
    // Handle text-based commands if any
    this.sendResponse(clientId, this.createAckResponse());
  }

  handleBinaryData(clientId: string, message: ParsedMessage) {
    Logger.messageProcessed(clientId, 'BINARY_DATA');
    
    // Process other binary data types
    const ackResponse = LoginReply.createDataAckResponse();
    this.sendBinaryResponse(clientId, ackResponse);
  }

  createAckResponse(): string {
    // Create a simple acknowledgment response
    return '@ACK#';
  }

  sendResponse(clientId: string, response: string) {
    const client = this.clients.get(clientId);
    if (client) {
      Logger.responseSent(clientId, 'text', response);
      client.write(response);
    }
  }

  sendBinaryResponse(clientId: string, response: Buffer) {
    const client = this.clients.get(clientId);
    if (client) {
      Logger.responseSent(clientId, 'binary', response.toString('hex'));
      client.write(response);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      Logger.serverStopped();
    }
  }
}

// Create and start the server
const server = new OBDServer(29479);
server.start();

// Handle server events
server.on('message', (clientId: string, message: ParsedMessage) => {
  // This event is now handled by the logger system
});

// Handle process termination
process.on('SIGINT', () => {
  Logger.info('🛑 Encerrando servidor...');
  server.stop();
  process.exit();
}); 