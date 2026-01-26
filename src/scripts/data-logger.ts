import fs from 'fs';
import path from 'path';

export class DataLogger {
  private static logDir = 'logs';
  private static logFile = 'raw-obd-data.log';

  static {
    // Criar diretório de logs se não existir
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log dados brutos recebidos do OBD
   */
  static logRawData(clientId: string, data: Buffer, context?: string): void {
    const timestamp = new Date().toISOString();
    const hexData = data.toString('hex');
    const asciiData = data.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
    
    const logEntry = {
      timestamp,
      clientId,
      context: context || 'RECEIVED_DATA',
      length: data.length,
      hexData,
      asciiData,
      rawBuffer: Array.from(data) // Array de bytes para análise
    };

    // Formatação legível para o arquivo
    const formattedEntry = [
      '=' .repeat(80),
      `TIMESTAMP: ${timestamp}`,
      `CLIENT: ${clientId}`,
      `CONTEXT: ${logEntry.context}`,
      `LENGTH: ${logEntry.length} bytes`,
      '',
      'HEX DATA:',
      this.formatHexData(hexData),
      '',
      'ASCII DATA:',
      asciiData,
      '',
      'BYTE ARRAY:',
      `[${logEntry.rawBuffer.join(', ')}]`,
      '',
      'JSON OBJECT:',
      JSON.stringify(logEntry, null, 2),
      ''
    ].join('\n');

    // Salvar no arquivo
    const logPath = path.join(this.logDir, this.logFile);
    fs.appendFileSync(logPath, formattedEntry + '\n');

    // Também printar no console para debug imediato
    console.log('\n🔍 DADOS BRUTOS RECEBIDOS:');
    console.log('─'.repeat(60));
    console.log(`📅 Timestamp: ${timestamp}`);
    console.log(`🌐 Cliente: ${clientId}`);
    console.log(`📏 Tamanho: ${logEntry.length} bytes`);
    console.log('📊 Hex Data:');
    console.log(this.formatHexData(hexData));
    console.log('📝 ASCII Data:');
    console.log(`"${asciiData}"`);
    console.log('🔢 Bytes:');
    console.log(`[${logEntry.rawBuffer.slice(0, 50).join(', ')}${logEntry.rawBuffer.length > 50 ? '...' : ''}]`);
    console.log('─'.repeat(60));
  }

  /**
   * Formatar dados hex para visualização (16 bytes por linha)
   */
  private static formatHexData(hexData: string): string {
    const lines: string[] = [];
    for (let i = 0; i < hexData.length; i += 32) { // 32 chars = 16 bytes
      const chunk = hexData.slice(i, i + 32);
      const offset = (i / 2).toString(16).padStart(4, '0').toUpperCase();
      const formattedChunk = chunk.match(/.{2}/g)?.join(' ') || chunk;
      lines.push(`${offset}: ${formattedChunk}`);
    }
    return lines.join('\n');
  }

  /**
   * Log dados decodificados para comparação
   */
  static logDecodedData(clientId: string, decoded: any): void {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      clientId,
      context: 'DECODED_DATA',
      decodedData: decoded
    };

    const formattedEntry = [
      '=' .repeat(80),
      `DECODED DATA - ${timestamp}`,
      `CLIENT: ${clientId}`,
      '',
      'DECODED JSON:',
      JSON.stringify(decoded, null, 2),
      ''
    ].join('\n');

    const logPath = path.join(this.logDir, this.logFile);
    fs.appendFileSync(logPath, formattedEntry + '\n');

    console.log('\n✅ DADOS DECODIFICADOS:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(decoded, null, 2));
    console.log('─'.repeat(60));
  }

  /**
   * Log erros de decodificação
   */
  static logDecodingError(clientId: string, data: Buffer, error: string): void {
    const timestamp = new Date().toISOString();
    const hexData = data.toString('hex');
    
    const logEntry = {
      timestamp,
      clientId,
      context: 'DECODING_ERROR',
      error,
      hexData,
      length: data.length
    };

    const formattedEntry = [
      '=' .repeat(80),
      `DECODING ERROR - ${timestamp}`,
      `CLIENT: ${clientId}`,
      `ERROR: ${error}`,
      `LENGTH: ${data.length} bytes`,
      '',
      'FAILED HEX DATA:',
      this.formatHexData(hexData),
      ''
    ].join('\n');

    const logPath = path.join(this.logDir, this.logFile);
    fs.appendFileSync(logPath, formattedEntry + '\n');

    console.log('\n❌ ERRO DE DECODIFICAÇÃO:');
    console.log('─'.repeat(60));
    console.log(`📅 Timestamp: ${timestamp}`);
    console.log(`🌐 Cliente: ${clientId}`);
    console.log(`❌ Erro: ${error}`);
    console.log(`📏 Tamanho: ${data.length} bytes`);
    console.log('📊 Hex Data:');
    console.log(this.formatHexData(hexData));
    console.log('─'.repeat(60));
  }

  /**
   * Limpar logs antigos (manter apenas últimos 7 dias)
   */
  static cleanOldLogs(): void {
    const logPath = path.join(this.logDir, this.logFile);
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceModified > 7) {
        const backupName = `${this.logFile}.${stats.mtime.toISOString().split('T')[0]}.bak`;
        const backupPath = path.join(this.logDir, backupName);
        fs.renameSync(logPath, backupPath);
        console.log(`📦 Log antigo arquivado como: ${backupName}`);
      }
    }
  }

  /**
   * Obter estatísticas dos logs
   */
  static getLogStats(): any {
    const logPath = path.join(this.logDir, this.logFile);
    if (!fs.existsSync(logPath)) {
      return { exists: false };
    }

    const stats = fs.statSync(logPath);
    const content = fs.readFileSync(logPath, 'utf-8');
    const entries = content.split('='.repeat(80)).length - 1;

    return {
      exists: true,
      size: stats.size,
      sizeHuman: `${(stats.size / 1024).toFixed(2)} KB`,
      lastModified: stats.mtime.toISOString(),
      entries
    };
  }
} 