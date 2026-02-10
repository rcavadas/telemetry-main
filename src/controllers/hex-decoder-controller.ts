import { IncomingMessage, ServerResponse } from 'http';
import { HexDecoderService } from '../services/hex-decoder-service';
import { APIResponse, HexDecodeRequest, HexDecodeResult } from '../types';
import { DatabaseManager } from '../models/database';
import { Logger } from '../utils/logger';

export class HexDecoderController {
  private hexDecoderService: HexDecoderService;

  constructor() {
    this.hexDecoderService = new HexDecoderService();
  }

  /**
   * POST /api/decode-hex - Decodifica string hex
   */
  async decodeHex(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    
    try {
      const body = await this.parseRequestBody(req);
      const requestData: HexDecodeRequest = JSON.parse(body);

      if (!requestData.hex) {
        this.sendError(res, 'Missing hex field', 400, startTime);
        return;
      }

      const result = await HexDecoderService.decodeHex(requestData.hex);

      // Save to database if decoding was successful and has valid data
      if (result.success && result.decoded) {
        try {
          const dbManager = DatabaseManager.getInstance();
          const cleanHex = requestData.hex.replace(/[\s\n\r]/g, '');
          
          // Prepare audit information for hex decoder
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
          
          Logger.info('💾 Dados do hex decoder salvos no banco', {
            readingId,
            deviceId: result.decoded.deviceId,
            hasGPS: !!(result.decoded.gps && result.decoded.gps.latitude && result.decoded.gps.longitude)
          });

          // Add saved flag to response
          result.savedToDatabase = true;
          result.readingId = readingId;
        } catch (dbError) {
          Logger.warn('⚠️ Erro ao salvar dados do hex decoder no banco', {
            error: dbError instanceof Error ? dbError.message : String(dbError)
          });
          // Don't fail the request if database save fails
          result.savedToDatabase = false;
        }
      }

      const response: APIResponse<any> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error: any) {
      this.sendError(res, `Decode error: ${error.message || 'Unknown error'}`, 500, startTime);
    }
  }

  /**
   * Utilitários privados
   */
  private async parseRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: any) => body += chunk.toString());
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  private sendError(res: ServerResponse, message: string, statusCode: number, startTime: number): void {
    const response: APIResponse = {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }
} 