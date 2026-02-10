import { IncomingMessage, ServerResponse } from 'http';
import { APIResponse } from '../types';
import { DatabaseManager } from '../models/database';
import { ProtocolDecoder } from '../protocols/protocol-decoder';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface FileUploadResult {
  totalHexFound: number;
  successfullyDecoded: number;
  savedToDatabase: number;
  errors: number;
  fuelDataSummary?: {
    readingsWithFuel: number;
    uniqueDevices: number;
    totalConsumed: number;
    averageLevel: number;
  };
  details: {
    hex: string;
    decoded: boolean;
    saved: boolean;
    deviceId?: string;
    error?: string;
    hasFuelData?: boolean;
  }[];
}

export class FileUploadController {
  /**
   * POST /api/upload-file - Upload e processa arquivo com dados hex
   */
  async uploadFile(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Parse multipart form data
      const formData = await this.parseMultipartFormData(req);
      const file = formData.file;
      
      if (!file) {
        this.sendError(res, 'Nenhum arquivo enviado', 400, startTime);
        return;
      }

      // Read file content
      const fileContent = file.content.toString('utf8');
      
      // Extract hex data from file
      const hexDataArray = this.extractHexData(fileContent);
      
      Logger.info('📁 Arquivo recebido para processamento', {
        fileName: file.filename,
        fileSize: file.content.length,
        hexStringsFound: hexDataArray.length
      });

      // Process each hex string
      const result = await this.processHexData(hexDataArray);

      const response: APIResponse<FileUploadResult> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response, null, 2));

      Logger.info('✅ Processamento de arquivo concluído', {
        totalHex: result.totalHexFound,
        decoded: result.successfullyDecoded,
        saved: result.savedToDatabase,
        errors: result.errors
      });

    } catch (error: any) {
      Logger.error('❌ Erro ao processar upload de arquivo', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.sendError(res, `Erro ao processar arquivo: ${error.message || 'Unknown error'}`, 500, startTime);
    }
  }

  /**
   * Extract hex strings from file content
   */
  private extractHexData(content: string): string[] {
    const hexStrings: string[] = [];
    
    // Pattern 1: Hex strings in quotes (JSON format)
    const jsonHexPattern = /"hexData"\s*:\s*"([0-9A-Fa-f]+)"/gi;
    let match;
    while ((match = jsonHexPattern.exec(content)) !== null) {
      hexStrings.push(match[1].toUpperCase());
    }

    // Pattern 2: Standalone hex strings (min 8 characters, even length)
    const standaloneHexPattern = /\b([0-9A-Fa-f]{8,})\b/g;
    while ((match = standaloneHexPattern.exec(content)) !== null) {
      const hex = match[1].toUpperCase();
      // Only add if it's a valid hex string (even length, reasonable size)
      if (hex.length % 2 === 0 && hex.length >= 8 && hex.length <= 500) {
        // Check if it's not already added and looks like OBD data (starts with common patterns)
        if (!hexStrings.includes(hex) && (hex.startsWith('4040') || hex.length >= 20)) {
          hexStrings.push(hex);
        }
      }
    }

    // Pattern 3: Hex strings separated by spaces/newlines
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      // Remove common prefixes/suffixes and extract hex
      const cleaned = line.trim()
        .replace(/^.*?([0-9A-Fa-f]{8,}).*?$/i, '$1')
        .replace(/[^0-9A-Fa-f]/gi, '');
      
      if (cleaned.length >= 8 && cleaned.length % 2 === 0 && cleaned.length <= 500) {
        const upperHex = cleaned.toUpperCase();
        if (!hexStrings.includes(upperHex) && (upperHex.startsWith('4040') || upperHex.length >= 20)) {
          hexStrings.push(upperHex);
        }
      }
    }

    // Remove duplicates
    return [...new Set(hexStrings)];
  }

  /**
   * Process hex data array - decode and save to database
   */
  private async processHexData(hexArray: string[]): Promise<FileUploadResult> {
    const result: FileUploadResult = {
      totalHexFound: hexArray.length,
      successfullyDecoded: 0,
      savedToDatabase: 0,
      errors: 0,
      details: []
    };

    const dbManager = DatabaseManager.getInstance();
    const fuelStats = {
      readingsWithFuel: 0,
      uniqueDevices: new Set<string>(),
      totalConsumed: 0,
      totalLevel: 0,
      levelCount: 0
    };

    for (const hex of hexArray) {
      const detail: FileUploadResult['details'][0] = {
        hex: hex.substring(0, 50) + (hex.length > 50 ? '...' : ''),
        decoded: false,
        saved: false
      };

      try {
        // Convert hex to buffer
        const buffer = Buffer.from(hex, 'hex');
        
        // Decode message
        const decoded = ProtocolDecoder.decodeMessage(buffer);
        
        if (decoded) {
          detail.decoded = true;
          detail.deviceId = decoded.deviceId;
          result.successfullyDecoded++;

          // Check for fuel data
          const tripData = decoded.tripData;
          const hasFuelData = tripData?.currentFuel !== undefined || 
                             tripData?.totalFuel !== undefined;
          detail.hasFuelData = hasFuelData;

          if (hasFuelData && tripData) {
            fuelStats.readingsWithFuel++;
            if (decoded.deviceId) {
              fuelStats.uniqueDevices.add(decoded.deviceId);
            }

            // Calculate fuel level percentage (0-1024 scale)
            if (tripData.currentFuel !== undefined) {
              const level = (tripData.currentFuel / 1024) * 100;
              fuelStats.totalLevel += level;
              fuelStats.levelCount++;
            }

            // Calculate total consumed (deciliters to liters)
            if (tripData.totalFuel !== undefined) {
              fuelStats.totalConsumed += tripData.totalFuel / 10;
            }
          }

          // Save to database
          try {
            const auditInfo = {
              clientId: 'file-upload',
              context: 'UPLOADED_FROM_FILE',
              dataLength: `${buffer.length} bytes`,
              asciiRepresentation: buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.'),
              byteArray: Array.from(buffer),
              originalJsonObject: {
                source: 'file-upload',
                timestamp: new Date().toISOString(),
                hexLength: hex.length,
                hasFuelData
              }
            };

            const readingId = dbManager.saveReading(decoded, hex, auditInfo);
            detail.saved = true;
            result.savedToDatabase++;

            Logger.debug('💾 Hex salvo do arquivo', {
              readingId,
              deviceId: decoded.deviceId,
              hexLength: hex.length,
              hasFuelData
            });
          } catch (dbError) {
            detail.error = `Erro ao salvar: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
            result.errors++;
            Logger.warn('⚠️ Erro ao salvar hex no banco', {
              hex: hex.substring(0, 50),
              error: dbError instanceof Error ? dbError.message : String(dbError)
            });
          }
        } else {
          detail.error = 'Não foi possível decodificar';
          result.errors++;
        }
      } catch (error) {
        detail.error = error instanceof Error ? error.message : String(error);
        result.errors++;
      }

      result.details.push(detail);
    }

    // Add fuel data summary if any fuel data was found
    if (fuelStats.readingsWithFuel > 0) {
      result.fuelDataSummary = {
        readingsWithFuel: fuelStats.readingsWithFuel,
        uniqueDevices: fuelStats.uniqueDevices.size,
        totalConsumed: fuelStats.totalConsumed,
        averageLevel: fuelStats.levelCount > 0 
          ? fuelStats.totalLevel / fuelStats.levelCount 
          : 0
      };
    }

    return result;
  }

  /**
   * Parse multipart/form-data manually (simple implementation)
   */
  private async parseMultipartFormData(req: IncomingMessage): Promise<{ file?: { filename: string; content: Buffer } }> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let boundary: string | null = null;

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const data = Buffer.concat(chunks);
          const contentType = req.headers['content-type'] || '';
          
          // Extract boundary
          const boundaryMatch = contentType.match(/boundary=([^;]+)/);
          if (!boundaryMatch) {
            reject(new Error('Boundary not found in Content-Type'));
            return;
          }
          
          boundary = '--' + boundaryMatch[1].trim();
          const parts = this.splitMultipartData(data, boundary);
          
          let file: { filename: string; content: Buffer } | undefined;

          for (const part of parts) {
            // Parse headers
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd === -1) continue;

            const headers = part.slice(0, headerEnd).toString('utf8');
            const body = part.slice(headerEnd + 4);

            // Check if this is a file field
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            const nameMatch = headers.match(/name="([^"]+)"/);

            if (filenameMatch && nameMatch) {
              // Remove trailing \r\n from body
              const content = body.slice(0, body.length - 2);
              file = {
                filename: filenameMatch[1],
                content: content
              };
            }
          }

          resolve({ file });
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * Split multipart data by boundary
   */
  private splitMultipartData(data: Buffer, boundary: string): Buffer[] {
    const parts: Buffer[] = [];
    const boundaryBuffer = Buffer.from(boundary, 'utf8');
    let start = 0;

    while (true) {
      const index = data.indexOf(boundaryBuffer, start);
      if (index === -1) break;

      if (start < index) {
        parts.push(data.slice(start, index));
      }
      start = index + boundaryBuffer.length;
    }

    return parts.filter(part => part.length > 0);
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
