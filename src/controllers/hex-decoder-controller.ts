import { IncomingMessage, ServerResponse } from 'http';
import { HexDecoderService } from '../services/hex-decoder-service';
import { APIResponse, HexDecodeRequest, HexDecodeResult } from '../types';

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